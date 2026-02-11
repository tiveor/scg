#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { TemplateBuilder } from './template_builder.js';
import { Scaffold, type ScaffoldOptions } from './scaffold.js';

const args = process.argv.slice(2);
const command = args[0];

function parseFlags(args: string[]): Record<string, string> {
  const flags: Record<string, string> = {};
  for (const arg of args) {
    const match = arg.match(/^--([a-zA-Z0-9_-]+)=(.*)$/);
    if (match) {
      flags[match[1]] = match[2].replace(/^['"]/, '').replace(/['"]$/, '');
    }
  }
  return flags;
}

function printHelp(): void {
  console.log(`
SCG - Simple Code Generator

Usage:
  scg <command> [options]

Commands:
  init                    Initialize a scaffold manifest (scaffold.json)
  generate                Generate files from a scaffold manifest
  render <template>       Render a single template file

Options:
  --manifest=<path>       Path to scaffold manifest (default: scaffold.json)
  --vars=<key=val,...>    Comma-separated variables (e.g. name=Button,style=module)
  --data=<json>           JSON data for template rendering
  --engine=<name>         Template engine (EJS, HANDLEBARS, PUG)
  --output=<path>         Output file path (for render command)
  --dry-run               Preview without writing files

Examples:
  scg init
  scg generate --manifest=scaffold.json --vars=name=Button
  scg render template.ejs --data='{"name": "World"}'
  scg render template.ejs --data='{"name": "World"}' --output=output.html
`);
}

function parseVars(varsStr: string): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const pair of varsStr.split(',')) {
    const [key, ...rest] = pair.split('=');
    if (key && rest.length > 0) {
      vars[key.trim()] = rest.join('=').trim();
    }
  }
  return vars;
}

async function cmdInit(): Promise<void> {
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
  const filePath = 'scaffold.json';
  fs.writeFileSync(filePath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`Created ${filePath}`);
  console.log('Edit the manifest and run: scg generate');
}

async function cmdGenerate(): Promise<void> {
  const flags = parseFlags(args);
  const manifestPath = flags['manifest'] ?? 'scaffold.json';
  const dryRun = args.includes('--dry-run');

  if (!fs.existsSync(manifestPath)) {
    console.error(`Manifest not found: ${manifestPath}`);
    console.error('Run "scg init" to create one.');
    process.exit(1);
  }

  const manifest = JSON.parse(
    fs.readFileSync(manifestPath, 'utf8')
  ) as ScaffoldOptions;

  if (flags['vars']) {
    Object.assign(manifest.variables, parseVars(flags['vars']));
  }

  manifest.dryRun = dryRun;

  const result = await Scaffold.from(manifest);

  if (dryRun) {
    console.log('Dry run - files that would be created:');
  } else {
    console.log('Generated files:');
  }

  for (const file of result.files) {
    console.log(`  ${file}`);
  }
}

async function cmdRender(): Promise<void> {
  const templatePath = args[1];
  if (!templatePath) {
    console.error('Usage: scg render <template> [--data=<json>] [--engine=<name>] [--output=<path>]');
    process.exit(1);
  }

  const flags = parseFlags(args);
  const engine = flags['engine'] ?? extToEngine(templatePath);
  const dataStr = flags['data'] ?? '{}';
  const outputPath = flags['output'];

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(dataStr);
  } catch {
    console.error('Invalid JSON in --data flag');
    process.exit(1);
  }

  const builder = new TemplateBuilder(engine);
  const result = await builder.renderFile(templatePath, data, {});

  if (outputPath) {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(outputPath, result, 'utf8');
    console.log(`Written to ${outputPath}`);
  } else {
    console.log(result);
  }
}

function extToEngine(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.ejs':
      return 'EJS';
    case '.hbs':
    case '.handlebars':
      return 'HANDLEBARS';
    case '.pug':
    case '.jade':
      return 'PUG';
    default:
      return 'HANDLEBARS';
  }
}

async function main(): Promise<void> {
  switch (command) {
    case 'init':
      await cmdInit();
      break;
    case 'generate':
      await cmdGenerate();
      break;
    case 'render':
      await cmdRender();
      break;
    case '--help':
    case '-h':
    case undefined:
      printHelp();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
