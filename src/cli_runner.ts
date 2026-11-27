import fs from 'fs';
import path from 'path';
import { TemplateBuilder } from './template_builder.js';
import { Scaffold } from './scaffold.js';
import { loadManifest, RESERVED_FLAGS, type GeneratorManifest } from './manifest.js';
import {
  listGenerators,
  resolveGenerator,
  PROJECT_GENERATORS_DIR
} from './generators.js';
import { resolveInputs } from './inputs.js';
import { PromptCancelledError, type Prompter } from './prompter.js';
import { formatResult } from './output.js';
import { serveStdio } from './mcp.js';
import {
  engineFromExtension,
  knownTemplateExtensions
} from './template_handlers.js';

/** @internal Output streams used by the CLI (injectable for tests). */
export interface CliIO {
  log: (message: string) => void;
  error: (message: string) => void;
}

/** @internal Terminal capabilities (injectable for tests). */
export interface CliEnv {
  /** Whether prompts may be shown (stdin and stdout are TTYs). */
  interactive: boolean;
  /** Asks for missing values when interactive. */
  prompter?: Prompter;
  /** Whether output may use ANSI colors. */
  color: boolean;
}

const defaultIO: CliIO = {
  log: (message) => console.log(message),
  error: (message) => console.error(message)
};

const defaultEnv: CliEnv = { interactive: false, color: false };

const HELP = `
SCG - Simple Code Generator

Usage:
  scg <command> [options]

Commands:
  new <generator> [value]  Run a generator by name (asks for missing values)
  list                     List project (.scg/) and built-in generators
  init [name]              Create a project generator in .scg/<name>/ (default: component)
  generate                 Generate files from a scaffold manifest path
  render <template>        Render a single template file
  mcp                      Serve the generators to AI agents over MCP (stdio)

Options for new and generate:
  --<input>=<value>        Value for a generator input (e.g. --name=Button --withTest=false)
  --vars=<key=val,...>     Several values as pairs (escape commas as \\,) or as JSON
  --yes                    Never ask; use defaults for anything not provided
  --dry-run                Preview without writing files
  --force                  Overwrite existing files that differ from the templates
  --manifest=<path>        Manifest for generate (default: scaffold.json)

Options for render:
  --data=<json>            JSON data for the template
  --engine=<name>          Template engine (EJS, HANDLEBARS, PUG)
  --output=<path>          Write to a file instead of stdout

Examples:
  scg new react-component Button
  scg new react-component Button --cssModule=false --withTest=false --yes
  scg list
  scg init widget
  scg generate --manifest=scaffold.json --vars=name=Button
  scg render template.ejs --data='{"name": "World"}'
  claude mcp add scg -- npx -y @tiveor/scg mcp
`;

/** @internal Parses `--key=value` flags. */
export function parseFlags(args: string[]): Record<string, string> {
  const flags: Record<string, string> = {};
  for (const arg of args) {
    const match = arg.match(/^--([a-zA-Z0-9_-]+)=(.*)$/s);
    if (match) {
      flags[match[1]] = match[2].replace(/^['"]/, '').replace(/['"]$/, '');
    }
  }
  return flags;
}

/**
 * @internal Parses the `--vars` flag: a JSON object, or `key=value` pairs
 * separated by commas, where a literal comma is written as `\,`.
 */
export function parseVars(varsStr: string): Record<string, unknown> {
  const trimmed = varsStr.trim();
  if (trimmed.startsWith('{')) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      throw new Error('Invalid JSON in --vars flag');
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('--vars JSON must be an object');
    }
    return parsed as Record<string, unknown>;
  }

  const vars: Record<string, unknown> = {};
  for (const rawPair of varsStr.split(/(?<!\\),/)) {
    const pair = rawPair.replace(/\\,/g, ',');
    const [key, ...rest] = pair.split('=');
    if (key && rest.length > 0) {
      vars[key.trim()] = rest.join('=').trim();
    }
  }
  return vars;
}

/** @internal Splits `new` arguments into positionals and `--key[=value]` flags. */
export function parseArgs(args: string[]): {
  positionals: string[];
  flags: Record<string, string | true>;
} {
  const positionals: string[] = [];
  const flags: Record<string, string | true> = {};
  for (const arg of args) {
    const withValue = arg.match(/^--([a-zA-Z0-9_$-]+)=(.*)$/s);
    const bare = arg.match(/^--([a-zA-Z0-9_$-]+)$/);
    if (withValue) {
      flags[withValue[1]] = withValue[2]
        .replace(/^['"]/, '')
        .replace(/['"]$/, '');
    } else if (bare) {
      flags[bare[1]] = true;
    } else {
      positionals.push(arg);
    }
  }
  return { positionals, flags };
}

/** @internal Values for generator inputs: `--vars` first, then individual flags. */
function providedValues(
  flags: Record<string, string | true>
): Record<string, unknown> {
  const provided: Record<string, unknown> = {};
  if (typeof flags['vars'] === 'string') {
    Object.assign(provided, parseVars(flags['vars']));
  }
  for (const [key, value] of Object.entries(flags)) {
    if (!RESERVED_FLAGS.includes(key)) provided[key] = value;
  }
  return provided;
}

async function runScaffold(
  manifest: GeneratorManifest,
  variables: Record<string, unknown>,
  flags: Record<string, string | true>,
  io: CliIO,
  env: CliEnv
): Promise<number> {
  const result = await Scaffold.from({
    ...manifest,
    variables,
    dryRun: flags['dry-run'] === true,
    overwrite: flags['force'] === true
  });

  const lines = formatResult(result, process.cwd(), env.color);
  if (lines.length === 0) {
    io.log('Nothing to generate.');
  }
  for (const line of lines) io.log(line);
  return 0;
}

async function cmdNew(args: string[], io: CliIO, env: CliEnv): Promise<number> {
  const { positionals, flags } = parseArgs(args.slice(1));
  if (positionals.length > 2) {
    io.error(`Too many arguments: ${positionals.slice(2).join(' ')}`);
    return 1;
  }

  const interactive = env.interactive && flags['yes'] !== true && !!env.prompter;
  let name = positionals[0];
  if (!name) {
    const available = listGenerators().filter((g) => !g.overridden);
    if (!interactive) {
      io.error('Usage: scg new <generator> [value] [--<input>=<value>...]');
      io.error(`Available generators: ${available.map((g) => g.name).join(', ')}`);
      return 1;
    }
    name = await env.prompter!.select({
      message: 'Which generator?',
      options: available.map((g) => g.name)
    });
  }

  const generator = resolveGenerator(name);
  const manifest = loadManifest(generator.manifestPath);
  const variables = await resolveInputs(manifest, providedValues(flags), {
    generatorName: name,
    positional: positionals[1],
    interactive,
    prompter: env.prompter
  });
  return runScaffold(manifest, variables, flags, io, env);
}

function cmdList(io: CliIO): number {
  const generators = listGenerators();
  const width = Math.max(...generators.map((g) => g.name.length)) + 2;
  for (const source of ['project', 'built-in'] as const) {
    const group = generators.filter((g) => g.source === source);
    if (group.length === 0) continue;
    io.log(source === 'project' ? `Project (${PROJECT_GENERATORS_DIR}/):` : 'Built-in:');
    for (const g of group) {
      const note = g.overridden ? ' (overridden by project)' : '';
      io.log(`  ${g.name.padEnd(width)}${g.description ?? ''}${note}`);
    }
  }
  io.log('');
  io.log('Run: scg new <generator>');
  return 0;
}

const INIT_TEMPLATE = `export function <%= h.camel(name) %>(): string {
  return '<%= h.title(name) %>';
}
`;

function cmdInit(args: string[], io: CliIO): number {
  const name = parseArgs(args.slice(1)).positionals[0] ?? 'component';
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(name)) {
    io.error(
      `Invalid generator name "${name}": use letters, digits, "-" and "_"`
    );
    return 1;
  }

  const dir = path.join(PROJECT_GENERATORS_DIR, name);
  if (fs.existsSync(dir)) {
    io.error(`${dir} already exists. Edit it, or delete it to start over.`);
    return 1;
  }

  const manifest: Omit<GeneratorManifest, 'variables'> = {
    name,
    description: 'Describe what this generator creates',
    engine: 'EJS',
    templateDir: '.',
    outputDir: 'src/{{name:kebab}}',
    prompts: [
      {
        name: 'name',
        type: 'text',
        message: 'Name',
        positional: true,
        required: true
      }
    ],
    structure: [{ template: 'file.ts.ejs', output: '{{name:pascal}}.ts' }]
  };
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'scaffold.json'),
    JSON.stringify(manifest, null, 2) + '\n',
    'utf8'
  );
  fs.writeFileSync(path.join(dir, 'file.ts.ejs'), INIT_TEMPLATE, 'utf8');

  io.log(`Created ${path.join(dir, 'scaffold.json')}`);
  io.log(`Created ${path.join(dir, 'file.ts.ejs')}`);
  io.log(`Edit them, then run: scg new ${name} MyThing`);
  return 0;
}

async function cmdGenerate(
  args: string[],
  io: CliIO,
  env: CliEnv
): Promise<number> {
  const { flags } = parseArgs(args.slice(1));
  const manifestPath =
    typeof flags['manifest'] === 'string' ? flags['manifest'] : 'scaffold.json';

  if (!fs.existsSync(manifestPath)) {
    io.error(`Manifest not found: ${manifestPath}`);
    io.error('Run "scg init" to create a generator.');
    return 1;
  }

  const manifest = loadManifest(manifestPath);
  const variables = await resolveInputs(manifest, providedValues(flags), {
    generatorName: manifestPath,
    interactive: false
  });
  return runScaffold(manifest, variables, flags, io, env);
}

async function cmdRender(args: string[], io: CliIO): Promise<number> {
  const templatePath = args[1];
  if (!templatePath || templatePath.startsWith('--')) {
    io.error(
      'Usage: scg render <template> [--data=<json>] [--engine=<name>] [--output=<path>]'
    );
    return 1;
  }

  const flags = parseFlags(args);
  const engine = flags['engine'] ?? engineFromExtension(templatePath);
  if (!engine) {
    io.error(
      `Cannot infer the template engine for "${templatePath}". ` +
        `Pass --engine=<name> or use one of: ${knownTemplateExtensions().join(
          ', '
        )}`
    );
    return 1;
  }

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(flags['data'] ?? '{}');
  } catch {
    io.error('Invalid JSON in --data flag');
    return 1;
  }

  const builder = new TemplateBuilder(engine);
  const result = await builder.renderFile(templatePath, data, {});

  const outputPath = flags['output'];
  if (outputPath) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, result, 'utf8');
    io.log(`Written to ${outputPath}`);
  } else {
    io.log(result);
  }
  return 0;
}

/**
 * @internal Runs the CLI with the given arguments (without `node` and the script path).
 * @returns The process exit code
 */
export async function runCli(
  args: string[],
  io: CliIO = defaultIO,
  env: CliEnv = defaultEnv
): Promise<number> {
  const command = args[0];
  try {
    switch (command) {
      case 'new':
        return await cmdNew(args, io, env);
      case 'list':
        return cmdList(io);
      case 'init':
        return cmdInit(args, io);
      case 'generate':
        return await cmdGenerate(args, io, env);
      case 'render':
        return await cmdRender(args, io);
      case 'mcp':
        await serveStdio();
        return 0;
      case '--help':
      case '-h':
      case undefined:
        io.log(HELP);
        return 0;
      default:
        io.error(`Unknown command: ${command}`);
        io.log(HELP);
        return 1;
    }
  } catch (error) {
    if (error instanceof PromptCancelledError) {
      io.error('Cancelled. No files were written.');
      return 130;
    }
    io.error((error as Error).message);
    return 1;
  }
}
