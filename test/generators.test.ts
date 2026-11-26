import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';

import {
  listGenerators,
  resolveGenerator,
  suggest,
  packageRoot
} from '../src/generators.js';

const BUILT_IN = ['express-route', 'github-action', 'react-component', 'vue-component'];

let tmpDir: string;
beforeEach(() => {
  tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'scg-gen-')));
});
afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function projectGenerator(name: string, description = `my ${name}`): void {
  const dir = path.join(tmpDir, '.scg', name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'scaffold.json'),
    JSON.stringify({
      description,
      engine: 'EJS',
      outputDir: 'out',
      structure: []
    })
  );
}

describe('packageRoot', () => {
  it('finds the folder with the SCG package.json and templates', () => {
    expect(fs.existsSync(path.join(packageRoot(), 'templates'))).toBe(true);
  });
});

describe('listGenerators', () => {
  it('lists the built-in packs from an empty folder', () => {
    const list = listGenerators(tmpDir);
    expect(list.map((g) => g.name)).toEqual(BUILT_IN);
    expect(list.every((g) => g.source === 'built-in')).toBe(true);
  });

  it('lists project generators first and marks overridden built-ins', () => {
    projectGenerator('react-component');
    projectGenerator('widget');
    fs.mkdirSync(path.join(tmpDir, '.scg', 'not-a-generator'));

    const list = listGenerators(tmpDir);
    expect(list.slice(0, 2).map((g) => [g.name, g.source])).toEqual([
      ['react-component', 'project'],
      ['widget', 'project']
    ]);
    const builtInReact = list.find(
      (g) => g.name === 'react-component' && g.source === 'built-in'
    );
    expect(builtInReact?.overridden).toBe(true);
    expect(list.some((g) => g.name === 'not-a-generator')).toBe(false);
  });

  it('lists invalid project manifests with a note', () => {
    const dir = path.join(tmpDir, '.scg', 'broken');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'scaffold.json'), '{ nope');
    const broken = listGenerators(tmpDir).find((g) => g.name === 'broken');
    expect(broken?.description).toBe('(invalid manifest)');
  });
});

describe('resolveGenerator', () => {
  it('prefers a project generator over the built-in one', () => {
    projectGenerator('react-component');
    const found = resolveGenerator('react-component', tmpDir);
    expect(found.source).toBe('project');
    expect(found.manifestPath).toBe(
      path.join(tmpDir, '.scg', 'react-component', 'scaffold.json')
    );
  });

  it('falls back to the built-in pack', () => {
    expect(resolveGenerator('vue-component', tmpDir).source).toBe('built-in');
  });

  it('suggests the closest name and lists the rest', () => {
    expect(() => resolveGenerator('react-compnent', tmpDir)).toThrow(
      /Unknown generator "react-compnent"\. Did you mean "react-component"\?\nAvailable generators: express-route, github-action, react-component, vue-component/
    );
  });
});

describe('suggest', () => {
  it('returns undefined when nothing is close', () => {
    expect(suggest('xyz', BUILT_IN)).toBeUndefined();
  });
});
