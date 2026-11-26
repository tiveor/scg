import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';

import { runCli, parseVars, type CliIO } from '../src/cli_runner.js';

const repoRoot = path.join(__dirname, '..');

let tmpDir: string;
let originalCwd: string;
let out: string[];
let err: string[];
let io: CliIO;

beforeEach(() => {
  originalCwd = process.cwd();
  tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'scg-cli-')));
  // Run from an empty folder, like a user calling `npx @tiveor/scg`
  process.chdir(tmpDir);
  out = [];
  err = [];
  io = { log: (m) => out.push(m), error: (m) => err.push(m) };
});

afterEach(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('scg generate', () => {
  it('works with a bundled pack from any folder (README example)', async () => {
    const manifest = path.join(
      repoRoot,
      'templates',
      'react-component',
      'scaffold.json'
    );
    const code = await runCli(
      ['generate', `--manifest=${manifest}`, '--vars=name=Button'],
      io
    );

    expect(err).toEqual([]);
    expect(code).toBe(0);
    const component = path.join(
      tmpDir,
      'src',
      'components',
      'Button',
      'Button.tsx'
    );
    expect(fs.readFileSync(component, 'utf8')).toContain('Button');
  });

  it('does not overwrite edited files without --force', async () => {
    fs.mkdirSync('tpl');
    fs.writeFileSync('tpl/x.ejs', 'hi');
    fs.writeFileSync(
      'scaffold.json',
      JSON.stringify({
        engine: 'EJS',
        templateDir: 'tpl',
        outputDir: 'out',
        variables: {},
        structure: [{ template: 'x.ejs', output: 'x.txt' }]
      })
    );

    expect(await runCli(['generate'], io)).toBe(0);
    fs.writeFileSync('out/x.txt', 'changed');

    expect(await runCli(['generate'], io)).toBe(0);
    expect(fs.readFileSync('out/x.txt', 'utf8')).toBe('changed');
    expect(out.join('\n')).toMatch(/--force/);

    expect(await runCli(['generate', '--force'], io)).toBe(0);
    expect(fs.readFileSync('out/x.txt', 'utf8')).toBe('hi');
  });

  it('fails with a clear message when the manifest is missing', async () => {
    expect(await runCli(['generate', '--manifest=nope.json'], io)).toBe(1);
    expect(err[0]).toMatch(/Manifest not found/);
  });
});

describe('scg render', () => {
  it('fails on an unknown engine instead of printing the raw template', async () => {
    fs.writeFileSync('a.ejs', '<%= name %>');
    const code = await runCli(
      ['render', 'a.ejs', '--engine=NOPE', '--data={"name":"x"}'],
      io
    );
    expect(code).toBe(1);
    expect(err[0]).toMatch(/Unknown template engine "NOPE"/);
    expect(out).toEqual([]);
  });

  it('fails when the engine cannot be inferred', async () => {
    fs.writeFileSync('a.txt', 'x');
    expect(await runCli(['render', 'a.txt'], io)).toBe(1);
    expect(err[0]).toMatch(/--engine/);
  });

  it('accepts lowercase engine names', async () => {
    fs.writeFileSync('a.tpl', 'Hello <%= name %>');
    const code = await runCli(
      ['render', 'a.tpl', '--engine=ejs', '--data={"name":"World"}'],
      io
    );
    expect(code).toBe(0);
    expect(out).toEqual(['Hello World']);
  });
});

describe('parseVars', () => {
  it('parses comma-separated pairs', () => {
    expect(parseVars('name=Button,style=module')).toEqual({
      name: 'Button',
      style: 'module'
    });
  });

  it('supports escaped commas and "=" in values', () => {
    expect(parseVars('title=Hello\\, world,query=a=b')).toEqual({
      title: 'Hello, world',
      query: 'a=b'
    });
  });

  it('accepts a JSON object with typed values', () => {
    expect(parseVars('{"name":"A, B","withTest":true,"n":2}')).toEqual({
      name: 'A, B',
      withTest: true,
      n: 2
    });
  });

  it('rejects invalid JSON', () => {
    expect(() => parseVars('{nope')).toThrow(/Invalid JSON/);
  });
});
