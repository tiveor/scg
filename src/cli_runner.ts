import fs from 'fs';
import path from 'path';
import { TemplateBuilder } from './template_builder.js';
import { Scaffold, type ScaffoldOptions } from './scaffold.js';
import {
  engineFromExtension,
  knownTemplateExtensions
} from './template_handlers.js';

/** @internal Output streams used by the CLI (injectable for tests). */
export interface CliIO {
  log: (message: string) => void;
  error: (message: string) => void;
}

const defaultIO: CliIO = {
  log: (message) => console.log(message),
  error: (message) => console.error(message)
};

const HELP = `
SCG - Simple Code Generator

Usage:
  scg <command> [options]

Commands:
  init                    Initialize a scaffold manifest (scaffold.json)
  generate                Generate files from a scaffold manifest
  render <template>       Render a single template file

Options:
  --manifest=<path>       Path to scaffold manifest (default: scaffold.json)
  --vars=<key=val,...>    Variables as comma-separated pairs (escape commas as \\,)
                          or as a JSON object (e.g. --vars='{"name":"Button"}')
  --data=<json>           JSON data for template rendering
  --engine=<name>         Template engine (EJS, HANDLEBARS, PUG)
  --output=<path>         Output file path (for render command)
  --dry-run               Preview without writing files
  --force                 Overwrite existing files that differ from the templates

Examples:
  scg init
  scg generate --manifest=scaffold.json --vars=name=Button
  scg render template.ejs --data='{"name": "World"}'
  scg render template.ejs --data='{"name": "World"}' --output=output.html
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

function cmdInit(io: CliIO): number {
  const filePath = 'scaffold.json';
  if (fs.existsSync(filePath)) {
    io.error(
      `${filePath} already exists. Edit it, or delete it to start over.`
    );
    return 1;
  }

  const manifest: ScaffoldOptions = {
    engine: 'EJS',
    templateDir: './templates',
    outputDir: './generated/{{name}}',
    variables: { name: 'MyComponent' },
    structure: [
      { template: 'component.ejs', output: '{{name}}.tsx' },
      { template: 'test.ejs', output: '{{name}}.test.tsx' },
      { template: 'index.ejs', output: 'index.ts' }
    ]
  };
  fs.writeFileSync(filePath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  io.log(`Created ${filePath}`);
  io.log('Edit the manifest and run: scg generate');
  return 0;
}

async function cmdGenerate(args: string[], io: CliIO): Promise<number> {
  const flags = parseFlags(args);
  const manifestPath = flags['manifest'] ?? 'scaffold.json';
  const dryRun = args.includes('--dry-run');
  const force = args.includes('--force');

  if (!fs.existsSync(manifestPath)) {
    io.error(`Manifest not found: ${manifestPath}`);
    io.error('Run "scg init" to create one.');
    return 1;
  }

  const manifest = Scaffold.loadManifest(manifestPath);
  if (flags['vars'] !== undefined) {
    Object.assign(manifest.variables, parseVars(flags['vars']));
  }

  const result = await Scaffold.from({
    ...manifest,
    dryRun,
    overwrite: force
  });

  const verb = dryRun ? 'Would write' : 'Generated';
  if (result.files.length > 0) {
    io.log(`${verb} ${result.files.length} file(s):`);
    for (const file of result.files) io.log(`  + ${file}`);
  }
  if (result.unchanged.length > 0) {
    io.log(`Up to date (${result.unchanged.length}):`);
    for (const file of result.unchanged) io.log(`  = ${file}`);
  }
  if (result.skipped.length > 0) {
    io.log(
      `Skipped ${result.skipped.length} existing file(s) with local changes:`
    );
    for (const file of result.skipped) io.log(`  ! ${file}`);
    io.log('Run again with --force to overwrite them.');
  }
  if (
    result.files.length === 0 &&
    result.unchanged.length === 0 &&
    result.skipped.length === 0
  ) {
    io.log('Nothing to generate: the manifest structure is empty.');
  }
  return 0;
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
  io: CliIO = defaultIO
): Promise<number> {
  const command = args[0];
  try {
    switch (command) {
      case 'init':
        return cmdInit(io);
      case 'generate':
        return await cmdGenerate(args, io);
      case 'render':
        return await cmdRender(args, io);
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
    io.error((error as Error).message);
    return 1;
  }
}
