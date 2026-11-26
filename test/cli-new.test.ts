import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';

import { runCli, type CliIO, type CliEnv } from '../src/cli_runner.js';
import { PromptCancelledError, type Prompter } from '../src/prompter.js';

let tmpDir: string;
let originalCwd: string;
let out: string[];
let err: string[];
let io: CliIO;
const nonInteractive: CliEnv = { interactive: false, color: false };

beforeEach(() => {
  originalCwd = process.cwd();
  tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'scg-cli-new-')));
  process.chdir(tmpDir);
  out = [];
  err = [];
  io = { log: (m) => out.push(m), error: (m) => err.push(m) };
});

afterEach(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

/** Prompter that answers by message and fails on unexpected questions. */
function scripted(answers: Record<string, unknown>): Prompter {
  const answer = (message: string) => {
    if (!(message in answers)) throw new Error(`Unexpected prompt: ${message}`);
    const value = answers[message];
    if (value instanceof Error) throw value;
    return value;
  };
  return {
    text: async ({ message }) => answer(message) as string,
    confirm: async ({ message }) => answer(message) as boolean,
    select: async ({ message }) => answer(message) as string,
    multiselect: async ({ message }) => answer(message) as string[]
  };
}

const exists = (...parts: string[]) => fs.existsSync(path.join(tmpDir, ...parts));
const read = (...parts: string[]) => fs.readFileSync(path.join(tmpDir, ...parts), 'utf8');

describe('scg new (built-in react-component)', () => {
  it('generates with --yes and the positional name', async () => {
    const code = await runCli(['new', 'react-component', 'user card', '--yes'], io, nonInteractive);
    expect(err).toEqual([]);
    expect(code).toBe(0);
    expect(read('src/components/UserCard/UserCard.tsx')).toContain('export function UserCard(');
    expect(exists('src/components/UserCard/UserCard.module.css')).toBe(true);
    expect(exists('src/components/UserCard/UserCard.test.tsx')).toBe(true);
    expect(out[0]).toBe(`✔ created    ${path.join('src', 'components', 'UserCard', 'UserCard.tsx')}`);
  });

  it('respects typed flags', async () => {
    await runCli(
      ['new', 'react-component', 'Button', '--withTest=false', '--cssModule=no'],
      io,
      nonInteractive
    );
    expect(exists('src/components/Button/Button.test.tsx')).toBe(false);
    expect(exists('src/components/Button/Button.module.css')).toBe(false);
    expect(read('src/components/Button/Button.tsx')).not.toContain('styles');
  });

  it('fails without the name when not interactive, listing the flag', async () => {
    const code = await runCli(['new', 'react-component'], io, nonInteractive);
    expect(code).toBe(1);
    expect(err[0]).toContain('Missing required input for "react-component":');
    expect(err[0]).toContain('--name=<text>');
    expect(exists('src')).toBe(false);
  });

  it('asks for missing values in an interactive terminal', async () => {
    const env: CliEnv = {
      interactive: true,
      color: false,
      prompter: scripted({
        'Component name': 'Modal',
        'Add a CSS module?': false,
        'Add a test (Testing Library)?': true
      })
    };
    expect(await runCli(['new', 'react-component'], io, env)).toBe(0);
    expect(exists('src/components/Modal/Modal.test.tsx')).toBe(true);
    expect(exists('src/components/Modal/Modal.module.css')).toBe(false);
  });

  it('--yes skips prompts even in an interactive terminal', async () => {
    const env: CliEnv = { interactive: true, color: false, prompter: scripted({}) };
    expect(await runCli(['new', 'react-component', 'Tab', '--yes'], io, env)).toBe(0);
  });

  it('exits 130 and writes nothing when the user cancels', async () => {
    const env: CliEnv = {
      interactive: true,
      color: false,
      prompter: scripted({ 'Component name': new PromptCancelledError() })
    };
    expect(await runCli(['new', 'react-component'], io, env)).toBe(130);
    expect(err).toEqual(['Cancelled. No files were written.']);
    expect(exists('src')).toBe(false);
  });

  it('lets the user pick the generator interactively', async () => {
    const env: CliEnv = {
      interactive: true,
      color: false,
      prompter: scripted({
        'Which generator?': 'express-route',
        'Resource name (singular, e.g. user)': 'blog post'
      })
    };
    expect(await runCli(['new'], io, env)).toBe(0);
    expect(read('src/routes/blog-post/blog-post.controller.ts')).toContain(
      'new BlogPostService()'
    );
  });
});

describe('scg new errors', () => {
  it('lists generators when none is given and not interactive', async () => {
    expect(await runCli(['new'], io, nonInteractive)).toBe(1);
    expect(err[1]).toBe(
      'Available generators: express-route, github-action, react-component, vue-component'
    );
  });

  it('suggests the closest generator name', async () => {
    expect(await runCli(['new', 'vue-componnt', 'X'], io, nonInteractive)).toBe(1);
    expect(err[0]).toContain('Did you mean "vue-component"?');
  });

  it('rejects invalid typed values', async () => {
    const code = await runCli(['new', 'react-component', 'X', '--withTest=maybe'], io, nonInteractive);
    expect(code).toBe(1);
    expect(err[0]).toContain('Invalid value for --withTest: "maybe"');
  });

  it('rejects names that fail the pattern', async () => {
    const code = await runCli(['new', 'react-component', '1bad'], io, nonInteractive);
    expect(code).toBe(1);
    expect(err[0]).toContain('Invalid value for --name: "1bad"');
  });
});

describe('scg init + project generators', () => {
  it('creates a working generator in .scg/<name>', async () => {
    expect(await runCli(['init', 'widget'], io, nonInteractive)).toBe(0);
    expect(exists('.scg/widget/scaffold.json')).toBe(true);
    expect(exists('.scg/widget/file.ts.ejs')).toBe(true);

    expect(await runCli(['new', 'widget', 'price tag'], io, nonInteractive)).toBe(0);
    expect(read('src/price-tag/PriceTag.ts')).toBe(
      "export function priceTag(): string {\n  return 'Price Tag';\n}\n"
    );
  });

  it('defaults the name to component and refuses to overwrite', async () => {
    expect(await runCli(['init'], io, nonInteractive)).toBe(0);
    expect(exists('.scg/component/scaffold.json')).toBe(true);
    expect(await runCli(['init'], io, nonInteractive)).toBe(1);
    expect(err[0]).toMatch(/already exists/);
  });

  it('rejects invalid generator names', async () => {
    expect(await runCli(['init', '../evil'], io, nonInteractive)).toBe(1);
    expect(exists('evil')).toBe(false);
  });

  it('a project generator overrides the built-in one and shows in list', async () => {
    await runCli(['init', 'react-component'], io, nonInteractive);
    await runCli(['new', 'react-component', 'Card'], io, nonInteractive);
    expect(exists('src/card/Card.ts')).toBe(true);

    out = [];
    expect(await runCli(['list'], io, nonInteractive)).toBe(0);
    expect(out[0]).toBe('Project (.scg/):');
    expect(out[1]).toMatch(/^ {2}react-component +Describe what this generator creates$/);
    expect(out).toContainEqual(
      expect.stringMatching(/react-component +React component .*\(overridden by project\)$/)
    );
  });
});

describe('scg generate uses the new output', () => {
  it('prints created and skipped files', async () => {
    const manifest = path.join(originalCwd, 'templates', 'react-component', 'scaffold.json');
    await runCli(['generate', `--manifest=${manifest}`, '--vars=name=Box'], io, nonInteractive);
    fs.writeFileSync('src/components/Box/Box.tsx', 'mine');
    out = [];
    await runCli(['generate', `--manifest=${manifest}`, '--vars=name=Box'], io, nonInteractive);
    expect(out).toContainEqual(
      `! skipped    ${path.join('src', 'components', 'Box', 'Box.tsx')}  (local changes, use --force)`
    );
  });
});

describe('every built-in pack runs non-interactively', () => {
  it.each([
    ['react-component', ['Button'], 'src/components/Button/Button.tsx'],
    ['vue-component', ['nav bar'], 'src/components/NavBar.vue'],
    ['express-route', ['user'], 'src/routes/user/user.routes.ts'],
    ['github-action', ['--yes'], '.github/workflows/ci.yml']
  ])('%s', async (pack, extra, expected) => {
    const code = await runCli(['new', pack, ...extra], io, nonInteractive);
    expect(err).toEqual([]);
    expect(code).toBe(0);
    expect(exists(expected)).toBe(true);
  });

  it('github-action renders the chosen node versions and package manager', async () => {
    await runCli(
      ['new', 'github-action', 'Checks', '--nodeVersions=24,26', '--packageManager=pnpm'],
      io,
      nonInteractive
    );
    const yml = read('.github/workflows/checks.yml');
    expect(yml).toContain('node-version: [24, 26]');
    expect(yml).toContain('pnpm install --frozen-lockfile');
    expect(yml).toContain('${{ matrix.node-version }}');
  });
});
