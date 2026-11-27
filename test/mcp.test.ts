import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { PassThrough } from 'stream';

import {
  createMcpServer,
  serveStdio,
  inputSchema,
  toolName,
  generatorTools,
  SUPPORTED_PROTOCOL_VERSIONS
} from '../src/mcp.js';
import type { GeneratorManifest } from '../src/manifest.js';

let tmpDir: string;
let originalCwd: string;
let warnings: string[];

beforeEach(() => {
  originalCwd = process.cwd();
  tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'scg-mcp-')));
  process.chdir(tmpDir);
  warnings = [];
});

afterEach(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function server() {
  return createMcpServer({ cwd: tmpDir, warn: (m) => warnings.push(m) });
}

let nextId = 1;
async function request(method: string, params: Record<string, unknown> = {}) {
  const response = await server().handle({
    jsonrpc: '2.0',
    id: nextId++,
    method,
    params
  });
  return response as {
    result?: any;
    error?: { code: number; message: string };
  };
}

function projectGenerator(
  name: string,
  manifest: Record<string, unknown>,
  files: Record<string, string> = {}
) {
  const dir = path.join(tmpDir, '.scg', name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'scaffold.json'), JSON.stringify(manifest));
  for (const [file, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, file), content);
  }
}

const widget = {
  name: 'widget',
  description: 'A widget',
  engine: 'EJS',
  outputDir: 'src/{{name:kebab}}',
  prompts: [
    {
      name: 'name',
      type: 'text',
      message: 'Widget name',
      required: true,
      positional: true
    },
    { name: 'withTest', type: 'confirm', default: false }
  ],
  structure: [
    { template: 'w.ejs', output: '{{name:pascal}}.ts' },
    { template: 't.ejs', output: '{{name:pascal}}.test.ts', when: 'withTest' }
  ]
};
const widgetFiles = {
  'w.ejs': 'export const <%= h.camel(name) %> = 1;\n',
  't.ejs': 'test\n'
};

describe('inputSchema', () => {
  it('maps every prompt type and marks required inputs without defaults', () => {
    const manifest: GeneratorManifest = {
      engine: 'EJS',
      templateDir: '.',
      outputDir: 'out',
      structure: [],
      variables: { legacy: 'x', branch: 'main' },
      prompts: [
        {
          name: 'name',
          type: 'text',
          message: 'Name',
          required: true,
          pattern: '^[A-Z]'
        },
        { name: 'count', type: 'number', default: 2 },
        { name: 'ok', type: 'confirm', description: 'Is it ok?' },
        {
          name: 'kind',
          type: 'select',
          choices: ['a', 'b'],
          required: true,
          default: 'a'
        },
        { name: 'tags', type: 'multiselect', choices: ['x', 'y'] },
        { name: 'branch', type: 'text', required: true }
      ]
    };
    const schema = inputSchema(manifest);

    expect(schema.required).toEqual(['name']);
    expect(schema.properties).toMatchObject({
      name: { type: 'string', pattern: '^[A-Z]', description: 'Name' },
      count: { type: 'number', default: 2 },
      ok: { type: 'boolean', description: 'Is it ok?' },
      kind: { type: 'string', enum: ['a', 'b'], default: 'a' },
      tags: {
        type: 'array',
        items: { type: 'string', enum: ['x', 'y'] },
        uniqueItems: true
      },
      branch: { type: 'string' },
      legacy: { type: 'string', default: 'x' },
      'dry-run': { type: 'boolean' },
      force: { type: 'boolean' }
    });
  });

  it('omits required when nothing is required', () => {
    const schema = inputSchema({
      engine: 'EJS',
      templateDir: '.',
      outputDir: 'o',
      structure: []
    });
    expect(schema).not.toHaveProperty('required');
  });
});

describe('toolName', () => {
  it('prefixes and sanitizes the generator name', () => {
    expect(toolName('react-component')).toBe('generate_react-component');
    expect(toolName('my.gen')).toBe('generate_my_gen');
  });
});

describe('generatorTools', () => {
  it('lists built-in packs and project generators, without overridden built-ins', () => {
    projectGenerator(
      'react-component',
      { ...widget, description: 'Our components' },
      widgetFiles
    );
    const tools = generatorTools(tmpDir);
    const names = tools.map((t) => t.name);
    expect(names).toContain('generate_github-action');
    expect(names.filter((n) => n === 'generate_react-component')).toHaveLength(
      1
    );
    expect(
      tools.find((t) => t.name === 'generate_react-component')?.generator.source
    ).toBe('project');
  });

  it('describes the files a generator creates', () => {
    projectGenerator('widget', widget, widgetFiles);
    const tool = generatorTools(tmpDir).find(
      (t) => t.name === 'generate_widget'
    )!;
    expect(tool.description).toContain('A widget');
    expect(tool.description).toContain(
      '- src/{{name:kebab}}/{{name:pascal}}.ts'
    );
    expect(tool.description).toContain(
      '- src/{{name:kebab}}/{{name:pascal}}.test.ts (when withTest)'
    );
  });

  it('skips invalid manifests with a warning', () => {
    projectGenerator('broken', { engine: 'EJS' });
    const names = generatorTools(tmpDir, (m) => warnings.push(m)).map(
      (t) => t.name
    );
    expect(names).not.toContain('generate_broken');
    expect(warnings.join('\n')).toMatch(/Skipping generator "broken"/);
  });
});

describe('protocol', () => {
  it('negotiates the protocol version', async () => {
    const known = await request('initialize', {
      protocolVersion: '2025-06-18'
    });
    expect(known.result.protocolVersion).toBe('2025-06-18');
    expect(known.result.capabilities).toEqual({
      tools: { listChanged: false }
    });
    expect(known.result.serverInfo.name).toBe('scg');
    expect(known.result.serverInfo.version).toMatch(/^\d+\.\d+\.\d+/);

    const unknown = await request('initialize', {
      protocolVersion: '1999-01-01'
    });
    expect(unknown.result.protocolVersion).toBe(SUPPORTED_PROTOCOL_VERSIONS[0]);
  });

  it('answers ping and ignores notifications', async () => {
    expect((await request('ping')).result).toEqual({});
    expect(
      await server().handle({
        jsonrpc: '2.0',
        method: 'notifications/initialized'
      })
    ).toBeUndefined();
  });

  it('rejects unknown methods and tools', async () => {
    expect((await request('resources/list')).error?.code).toBe(-32601);
    const unknownTool = await request('tools/call', {
      name: 'generate_nope',
      arguments: {}
    });
    expect(unknownTool.error).toEqual({
      code: -32602,
      message: 'Unknown tool: generate_nope'
    });
  });

  it('lists tools with name, description and schema only', async () => {
    const { result } = await request('tools/list');
    const tool = result.tools.find(
      (t: any) => t.name === 'generate_react-component'
    );
    expect(Object.keys(tool).sort()).toEqual([
      'description',
      'inputSchema',
      'name'
    ]);
    expect(tool.inputSchema.required).toEqual(['name']);
  });
});

describe('tools/call', () => {
  it('generates the files and reports them', async () => {
    projectGenerator('widget', widget, widgetFiles);
    const { result } = await request('tools/call', {
      name: 'generate_widget',
      arguments: { name: 'price tag', withTest: true }
    });

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toEqual({
      files: ['src/price-tag/PriceTag.ts', 'src/price-tag/PriceTag.test.ts'],
      unchanged: [],
      skipped: [],
      dryRun: false
    });
    expect(result.content[0].text).toBe(
      '✔ created    src/price-tag/PriceTag.ts\n✔ created    src/price-tag/PriceTag.test.ts'
    );
    expect(fs.readFileSync('src/price-tag/PriceTag.ts', 'utf8')).toBe(
      'export const priceTag = 1;\n'
    );
  });

  it('previews with dry-run and protects local changes unless forced', async () => {
    projectGenerator('widget', widget, widgetFiles);
    const call = (args: Record<string, unknown>) =>
      request('tools/call', {
        name: 'generate_widget',
        arguments: { name: 'Box', ...args }
      });

    const preview = await call({ 'dry-run': true });
    expect(preview.result.structuredContent.dryRun).toBe(true);
    expect(fs.existsSync('src/box')).toBe(false);

    await call({});
    fs.writeFileSync('src/box/Box.ts', 'edited\n');
    const again = await call({});
    expect(again.result.structuredContent.skipped).toEqual(['src/box/Box.ts']);
    expect(fs.readFileSync('src/box/Box.ts', 'utf8')).toBe('edited\n');

    const forced = await call({ force: true });
    expect(forced.result.structuredContent.files).toEqual(['src/box/Box.ts']);
  });

  it('returns input problems as tool errors the agent can fix', async () => {
    projectGenerator('widget', widget, widgetFiles);
    const missing = await request('tools/call', {
      name: 'generate_widget',
      arguments: {}
    });
    expect(missing.result.isError).toBe(true);
    expect(missing.result.content[0].text).toMatch(
      /Missing required input for "widget":\n {2}--name=<text>/
    );

    const invalid = await request('tools/call', {
      name: 'generate_widget',
      arguments: { name: 'x', withTest: 'maybe' }
    });
    expect(invalid.result.isError).toBe(true);
    expect(invalid.result.content[0].text).toMatch(
      /Invalid value for --withTest/
    );
    expect(fs.existsSync('src')).toBe(false);
  });

  it('runs a built-in pack', async () => {
    const { result } = await request('tools/call', {
      name: 'generate_react-component',
      arguments: { name: 'user card', withTest: false }
    });
    expect(result.isError).toBeUndefined();
    expect(result.structuredContent.files).toContain(
      'src/components/UserCard/UserCard.tsx'
    );
  });
});

describe('serveStdio', () => {
  it('speaks newline-delimited JSON-RPC', async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const chunks: string[] = [];
    output.on('data', (c) => chunks.push(String(c)));

    const done = serveStdio(input, output, { cwd: tmpDir, warn: () => {} });
    input.write(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { protocolVersion: '2025-11-25' }
      }) + '\n'
    );
    input.write(
      JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) +
        '\n'
    );
    input.write('not json\n');
    input.write(
      JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'ping' }) + '\n'
    );
    input.end();
    await done;

    const responses = chunks
      .join('')
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l));
    expect(responses).toHaveLength(3);
    expect(responses.find((r) => r.id === 1).result.protocolVersion).toBe(
      '2025-11-25'
    );
    expect(responses.find((r) => r.id === null).error.code).toBe(-32700);
    expect(responses.find((r) => r.id === 2).result).toEqual({});
  });
});
