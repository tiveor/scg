import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';

import {
  validateManifest,
  loadManifest,
  ManifestError
} from '../src/manifest.js';

const base = {
  engine: 'EJS',
  templateDir: '.',
  outputDir: 'src/{{name:pascal}}',
  structure: [{ template: 'a.ejs', output: '{{name}}.ts' }]
};

function problemsOf(raw: unknown): string[] {
  try {
    validateManifest(raw, 'test.json');
  } catch (error) {
    expect(error).toBeInstanceOf(ManifestError);
    return (error as ManifestError).problems;
  }
  return [];
}

describe('validateManifest', () => {
  it('accepts a full manifest with typed prompts', () => {
    const manifest = validateManifest(
      {
        ...base,
        name: 'comp',
        description: 'A component',
        prompts: [
          { name: 'name', type: 'text', positional: true, required: true, pattern: '^[A-Z]' },
          { name: 'style', type: 'select', choices: ['a', 'b'], default: 'a' },
          { name: 'features', type: 'multiselect', choices: ['x', 'y'] },
          { name: 'withTest', type: 'confirm', default: true },
          { name: 'count', type: 'number' }
        ],
        structure: [
          { template: 'a.ejs', output: '{{name:kebab}}.ts' },
          { template: 'b.ejs', output: 'b.ts', when: '!withTest' }
        ]
      },
      'test.json'
    );
    expect(manifest.prompts).toHaveLength(5);
  });

  it('accepts a legacy manifest with only variables and defaults templateDir', () => {
    const { templateDir: _ignored, ...legacy } = base;
    const manifest = validateManifest(
      { ...legacy, variables: { name: 'X' } },
      'test.json'
    );
    expect(manifest.templateDir).toBe('.');
    expect(manifest.variables).toEqual({ name: 'X' });
  });

  it('reports every problem at once with its path', () => {
    const problems = problemsOf({
      outputDir: 'x/{{name:shout}}',
      prompts: [
        { name: '1bad', type: 'text' },
        { name: 'kind', type: 'colour' },
        { name: 'pick', type: 'select' },
        { name: 'flag', type: 'confirm', pattern: 'x' },
        { name: 'txt', type: 'text', pattern: '(' },
        { name: 'force', type: 'text' },
        { name: 'dup', type: 'text', positional: true },
        { name: 'dup', type: 'text', positional: true }
      ],
      structure: [
        { template: 'a.ejs', output: 'a' },
        { template: 'b.ejs', output: 'b', when: 'nope' },
        { output: 'c' }
      ]
    });

    expect(problems).toEqual(
      expect.arrayContaining([
        'engine: required (e.g. "EJS")',
        expect.stringMatching(/^outputDir: unknown modifier "shout"/),
        expect.stringMatching(/^prompts\[0\]\.name: must be an identifier/),
        expect.stringMatching(/^prompts\[1\]\.type: must be one of/),
        'prompts[2].choices: required for type "select" (array of strings)',
        'prompts[3].pattern: only allowed for type "text"',
        'prompts[4].pattern: invalid regular expression',
        'prompts[5].name: "force" is reserved for a CLI flag',
        'prompts[7].name: duplicate prompt "dup"',
        'prompts: only one prompt can be positional',
        'structure[1].when: unknown variable "nope"',
        'structure[2].template: required'
      ])
    );
  });

  it('rejects a select default outside the choices', () => {
    expect(
      problemsOf({
        ...base,
        prompts: [{ name: 's', type: 'select', choices: ['a'], default: 'z' }]
      })
    ).toEqual(['prompts[0].default: must be one of the choices']);
  });

  it('accepts when referring to a legacy variable', () => {
    expect(
      problemsOf({
        ...base,
        variables: { withDocs: true },
        structure: [{ template: 'a', output: 'a', when: 'withDocs' }]
      })
    ).toEqual([]);
  });

  it('rejects non-object manifests', () => {
    expect(problemsOf([])).toEqual(['the manifest must be a JSON object']);
  });
});

describe('loadManifest', () => {
  let tmpDir: string;
  beforeEach(() => {
    tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'scg-man-')));
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('resolves templateDir against the manifest folder', () => {
    const file = path.join(tmpDir, 'scaffold.json');
    fs.writeFileSync(file, JSON.stringify({ ...base, templateDir: 'tpl' }));
    expect(loadManifest(file).templateDir).toBe(path.join(tmpDir, 'tpl'));
  });

  it('includes the file path in validation errors', () => {
    const file = path.join(tmpDir, 'scaffold.json');
    fs.writeFileSync(file, JSON.stringify({ outputDir: 'x', structure: [] }));
    expect(() => loadManifest(file)).toThrow(
      `Invalid manifest ${file}:\n  - engine: required`
    );
  });
});
