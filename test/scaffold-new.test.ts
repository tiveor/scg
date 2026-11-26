import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';

import { Scaffold, type ScaffoldOptions } from '../src/scaffold.js';

let tmpDir: string;
let templateDir: string;

beforeEach(() => {
  tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'scg-new-')));
  templateDir = path.join(tmpDir, 'tpl');
  fs.mkdirSync(templateDir);
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function template(name: string, content: string): void {
  fs.writeFileSync(path.join(templateDir, name), content);
}

function options(overrides: Partial<ScaffoldOptions>): ScaffoldOptions {
  return {
    engine: 'EJS',
    templateDir,
    outputDir: path.join(tmpDir, 'out'),
    variables: {},
    structure: [],
    ...overrides
  };
}

const read = (...parts: string[]) =>
  fs.readFileSync(path.join(tmpDir, 'out', ...parts), 'utf8');

describe('structure[].when', () => {
  beforeEach(() => template('t.ejs', 'x'));

  it.each([
    ['withTest', true, true],
    ['withTest', false, false],
    ['!withTest', true, false],
    ['!withTest', false, true]
  ])('when %j with withTest=%j generates=%j', async (when, withTest, generated) => {
    const result = await Scaffold.from(
      options({
        variables: { withTest },
        structure: [
          { template: 't.ejs', output: 'always.txt' },
          { template: 't.ejs', output: 'maybe.txt', when }
        ]
      })
    );
    expect(result.files.some((f) => f.endsWith('maybe.txt'))).toBe(generated);
    expect(fs.existsSync(path.join(tmpDir, 'out', 'maybe.txt'))).toBe(generated);
  });
});

describe('path case modifiers', () => {
  beforeEach(() => template('t.ejs', 'x'));

  it('applies modifiers to outputDir and outputs', async () => {
    const result = await Scaffold.from(
      options({
        outputDir: path.join(tmpDir, 'out', '{{name:kebab}}'),
        variables: { name: 'user profile' },
        structure: [
          { template: 't.ejs', output: '{{name:pascal}}.tsx' },
          { template: 't.ejs', output: '{{ name:constant }}.txt' },
          { template: 't.ejs', output: '{{name}}.raw' }
        ]
      })
    );
    expect(result.files).toEqual([
      path.join(tmpDir, 'out', 'user-profile', 'UserProfile.tsx'),
      path.join(tmpDir, 'out', 'user-profile', 'USER_PROFILE.txt'),
      path.join(tmpDir, 'out', 'user-profile', 'user profile.raw')
    ]);
  });

  it('rejects unknown modifiers', async () => {
    await expect(
      Scaffold.from(
        options({
          variables: { name: 'a' },
          structure: [{ template: 't.ejs', output: '{{name:shout}}.txt' }]
        })
      )
    ).rejects.toThrow(/unknown modifier "shout"/);
  });

  it('still rejects ".." after applying a modifier', async () => {
    await expect(
      Scaffold.from(
        options({
          variables: { name: '../x' },
          structure: [{ template: 't.ejs', output: '{{name:lower}}.txt' }]
        })
      )
    ).rejects.toThrow(/contains "\.\."/);
  });

  it('leaves tokens for unknown variables untouched', async () => {
    const result = await Scaffold.from(
      options({
        variables: {},
        structure: [{ template: 't.ejs', output: 'keep-{{missing}}.txt' }]
      })
    );
    expect(result.files[0]).toMatch(/keep-\{\{missing\}\}\.txt$/);
  });
});

describe('template helpers', () => {
  it('exposes h.* in EJS', async () => {
    template('t.ejs', '<%= h.pascal(name) %> <%= h.plural(h.kebab(name)) %>');
    await Scaffold.from(
      options({
        variables: { name: 'user profile' },
        structure: [{ template: 't.ejs', output: 'a.txt' }]
      })
    );
    expect(read('a.txt')).toBe('UserProfile user-profiles');
  });

  it('exposes h.* in Pug', async () => {
    template('t.pug', 'p= h.camel(name)');
    await Scaffold.from(
      options({
        engine: 'PUG',
        variables: { name: 'user profile' },
        structure: [{ template: 't.pug', output: 'a.html' }]
      })
    );
    expect(read('a.html')).toBe('<p>userProfile</p>');
  });

  it('registers Handlebars helpers', async () => {
    template('t.hbs', '{{constant name}}-{{kebab name}}');
    await Scaffold.from(
      options({
        engine: 'HANDLEBARS',
        variables: { name: 'userProfile' },
        structure: [{ template: 't.hbs', output: 'a.txt' }]
      })
    );
    expect(read('a.txt')).toBe('USER_PROFILE-user-profile');
  });

  it('lets a user variable called h win over the helpers', async () => {
    template('t.ejs', '<%= h %>');
    await Scaffold.from(
      options({
        variables: { h: 'mine' },
        structure: [{ template: 't.ejs', output: 'a.txt' }]
      })
    );
    expect(read('a.txt')).toBe('mine');
  });
});

describe('Handlebars helpers never shadow data', () => {
  it('prints a variable called title instead of calling the helper', async () => {
    template('t.hbs', '{{title}} / {{pascal name}}');
    await Scaffold.from(
      options({
        engine: 'HANDLEBARS',
        variables: { title: 'My Page', name: 'user profile' },
        structure: [{ template: 't.hbs', output: 'a.txt' }]
      })
    );
    expect(read('a.txt')).toBe('My Page / UserProfile');
  });
});
