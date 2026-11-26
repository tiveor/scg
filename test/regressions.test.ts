// Regression tests for bugs found while auditing v0.5.1.
// Each describe block names the behavior that used to be broken.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';

import { CommandHelper } from '../src/command_helper.js';
import { ParamHelper } from '../src/param_helper.js';
import { Pipeline } from '../src/pipeline.js';
import { Scaffold } from '../src/scaffold.js';
import { Watcher } from '../src/watcher.js';
import { engineFromExtension } from '../src/template_handlers.js';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'scg-regr-')));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeTemplate(name: string, content: string): string {
  const templateDir = path.join(tmpDir, 'templates');
  fs.mkdirSync(templateDir, { recursive: true });
  fs.writeFileSync(path.join(templateDir, name), content);
  return templateDir;
}

describe('engineFromExtension', () => {
  it('maps known template extensions', () => {
    expect(engineFromExtension('a.ejs')).toBe('EJS');
    expect(engineFromExtension('a.HBS')).toBe('HANDLEBARS');
    expect(engineFromExtension('a.handlebars')).toBe('HANDLEBARS');
    expect(engineFromExtension('dir.v2/a.pug')).toBe('PUG');
  });

  it('returns undefined for unknown extensions', () => {
    expect(engineFromExtension('notes.txt')).toBeUndefined();
    expect(engineFromExtension('Makefile')).toBeUndefined();
  });
});

describe('Pipeline: unknown extension', () => {
  it('throws instead of rendering with Handlebars', () => {
    expect(() =>
      new Pipeline().fromTemplate('notes.txt', { name: 'x' })
    ).toThrow(/Cannot infer the template engine/);
  });
});

describe('Scaffold: never overwrites user changes by default', () => {
  const structure = [{ template: 'x.ejs', output: 'x.txt' }];

  it('skips existing files with different content', async () => {
    const templateDir = writeTemplate('x.ejs', 'generated <%= name %>');
    const outputDir = path.join(tmpDir, 'out');
    const options = {
      engine: 'EJS',
      templateDir,
      outputDir,
      variables: { name: 'A' },
      structure
    };

    const first = await Scaffold.from(options);
    expect(first.files).toHaveLength(1);

    const target = path.join(outputDir, 'x.txt');
    fs.writeFileSync(target, 'edited by hand');

    const second = await Scaffold.from(options);
    expect(second.files).toEqual([]);
    expect(second.skipped).toEqual([target]);
    expect(fs.readFileSync(target, 'utf8')).toBe('edited by hand');
  });

  it('reports identical files as unchanged', async () => {
    const templateDir = writeTemplate('x.ejs', 'same');
    const options = {
      engine: 'EJS',
      templateDir,
      outputDir: path.join(tmpDir, 'out'),
      variables: {},
      structure
    };
    await Scaffold.from(options);
    const again = await Scaffold.from(options);
    expect(again.files).toEqual([]);
    expect(again.unchanged).toHaveLength(1);
    expect(again.skipped).toEqual([]);
  });

  it('overwrites when overwrite is true', async () => {
    const templateDir = writeTemplate('x.ejs', 'fresh');
    const outputDir = path.join(tmpDir, 'out');
    fs.mkdirSync(outputDir);
    fs.writeFileSync(path.join(outputDir, 'x.txt'), 'old');

    const result = await Scaffold.from({
      engine: 'EJS',
      templateDir,
      outputDir,
      variables: {},
      structure,
      overwrite: true
    });
    expect(result.files).toHaveLength(1);
    expect(fs.readFileSync(path.join(outputDir, 'x.txt'), 'utf8')).toBe(
      'fresh'
    );
  });

  it('dry run reports conflicts without writing', async () => {
    const templateDir = writeTemplate('x.ejs', 'fresh');
    const outputDir = path.join(tmpDir, 'out');
    fs.mkdirSync(outputDir);
    fs.writeFileSync(path.join(outputDir, 'x.txt'), 'old');

    const result = await Scaffold.from({
      engine: 'EJS',
      templateDir,
      outputDir,
      variables: {},
      structure,
      dryRun: true
    });
    expect(result.skipped).toHaveLength(1);
    expect(fs.readFileSync(path.join(outputDir, 'x.txt'), 'utf8')).toBe('old');
  });

  it('writes nothing if any template fails to render', async () => {
    const templateDir = writeTemplate('ok.ejs', 'ok');
    const outputDir = path.join(tmpDir, 'out');
    await expect(
      Scaffold.from({
        engine: 'EJS',
        templateDir,
        outputDir,
        variables: {},
        structure: [
          { template: 'ok.ejs', output: 'ok.txt' },
          { template: 'missing.ejs', output: 'missing.txt' }
        ]
      })
    ).rejects.toThrow(/ENOENT/);
    expect(fs.existsSync(outputDir)).toBe(false);
  });
});

describe('Scaffold: paths cannot escape the output directory', () => {
  it('rejects variables with ".." segments', async () => {
    const templateDir = writeTemplate('x.ejs', 'x');
    await expect(
      Scaffold.from({
        engine: 'EJS',
        templateDir,
        outputDir: path.join(tmpDir, 'out', '{{name}}'),
        variables: { name: '../../escaped' },
        structure: [{ template: 'x.ejs', output: 'x.txt' }]
      })
    ).rejects.toThrow(/contains "\.\."/);
    expect(fs.existsSync(path.join(tmpDir, 'escaped'))).toBe(false);
  });

  it('rejects absolute variable values', async () => {
    const templateDir = writeTemplate('x.ejs', 'x');
    await expect(
      Scaffold.from({
        engine: 'EJS',
        templateDir,
        outputDir: path.join(tmpDir, 'out'),
        variables: { name: '/etc/passwd' },
        structure: [{ template: 'x.ejs', output: '{{name}}' }]
      })
    ).rejects.toThrow(/absolute/);
  });

  it('rejects manifest outputs that point outside outputDir', async () => {
    const templateDir = writeTemplate('x.ejs', 'x');
    await expect(
      Scaffold.from({
        engine: 'EJS',
        templateDir,
        outputDir: path.join(tmpDir, 'out'),
        variables: {},
        structure: [{ template: 'x.ejs', output: '../outside.txt' }]
      })
    ).rejects.toThrow(/outside the output directory/);
  });

  it('allows nested folders inside variables', async () => {
    const templateDir = writeTemplate('x.ejs', '<%= name %>');
    const result = await Scaffold.from({
      engine: 'EJS',
      templateDir,
      outputDir: path.join(tmpDir, 'out'),
      variables: { name: 'admin/Button' },
      structure: [{ template: 'x.ejs', output: '{{name}}.txt' }]
    });
    expect(result.files).toEqual([
      path.join(tmpDir, 'out', 'admin', 'Button.txt')
    ]);
  });
});

describe('Scaffold: non-string variables', () => {
  it('passes arrays and booleans to templates', async () => {
    const templateDir = writeTemplate(
      'x.ejs',
      '<% if (withTest) { %><%= fields.join(",") %><% } %>'
    );
    const result = await Scaffold.from({
      engine: 'EJS',
      templateDir,
      outputDir: path.join(tmpDir, 'out'),
      variables: { withTest: true, fields: ['a', 'b'] },
      structure: [{ template: 'x.ejs', output: 'x.txt' }]
    });
    expect(fs.readFileSync(result.files[0], 'utf8')).toBe('a,b');
  });

  it('rejects non-primitive variables used in paths', async () => {
    const templateDir = writeTemplate('x.ejs', 'x');
    await expect(
      Scaffold.from({
        engine: 'EJS',
        templateDir,
        outputDir: path.join(tmpDir, 'out'),
        variables: { name: ['a'] },
        structure: [{ template: 'x.ejs', output: '{{name}}.txt' }]
      })
    ).rejects.toThrow(/not a string, number or boolean/);
  });
});

describe('Scaffold.loadManifest: templateDir is relative to the manifest', () => {
  it('resolves templateDir against the manifest folder', () => {
    const packDir = path.join(tmpDir, 'pack');
    fs.mkdirSync(packDir);
    const manifestPath = path.join(packDir, 'scaffold.json');
    fs.writeFileSync(
      manifestPath,
      JSON.stringify({
        engine: 'EJS',
        templateDir: './',
        outputDir: './out',
        variables: { name: 'X' },
        structure: []
      })
    );

    const manifest = Scaffold.loadManifest(manifestPath);
    expect(manifest.templateDir).toBe(packDir);
    expect(manifest.outputDir).toBe('./out');
  });

  it('throws a clear error for invalid JSON', () => {
    const manifestPath = path.join(tmpDir, 'bad.json');
    fs.writeFileSync(manifestPath, '{ nope');
    expect(() => Scaffold.loadManifest(manifestPath)).toThrow(
      /Invalid JSON in manifest/
    );
  });

  it('every bundled template pack resolves its templates', () => {
    const packsDir = path.join(__dirname, '..', 'templates');
    for (const pack of fs.readdirSync(packsDir)) {
      const manifest = Scaffold.loadManifest(
        path.join(packsDir, pack, 'scaffold.json')
      );
      for (const file of manifest.structure) {
        expect(
          fs.existsSync(path.join(manifest.templateDir, file.template)),
          `${pack}/${file.template}`
        ).toBe(true);
      }
    }
  });
});

describe('CommandHelper: stdout wins over stderr', () => {
  it('returns stdout when the command also writes to stderr', async () => {
    const script = path.join(tmpDir, 'both.cjs');
    fs.writeFileSync(
      script,
      'process.stderr.write("progress\\n"); process.stdout.write("result\\n");'
    );
    const output = await CommandHelper.run(tmpDir, `node ${script}`);
    expect(output).toBe('result\n');
  });

  it('falls back to stderr when stdout is empty', async () => {
    const script = path.join(tmpDir, 'err.cjs');
    fs.writeFileSync(script, 'process.stderr.write("only-stderr");');
    const output = await CommandHelper.run(tmpDir, `node ${script}`);
    expect(output).toBe('only-stderr');
  });
});

describe('ParamHelper: keys with dashes and underscores', () => {
  let originalArgv: string[];
  beforeEach(() => {
    originalArgv = process.argv.slice();
  });
  afterEach(() => {
    process.argv = originalArgv;
  });

  it('parses --dry-run=true and --out_dir=x', () => {
    process.argv = ['node', 'test', '--dry-run=true', '--out_dir=src/x'];
    expect(ParamHelper.getParams()).toEqual({
      'dry-run': 'true',
      out_dir: 'src/x'
    });
  });

  it('ignores arguments that only contain --key=value in the middle', () => {
    process.argv = ['node', 'test', 'path/--name=x'];
    expect(ParamHelper.getParams()).toEqual({});
  });
});

describe('Watcher.rebuild: keeps the real output extension', () => {
  function makeWatcher(outputExtension?: string) {
    const templateDir = path.join(tmpDir, 'tpl');
    fs.mkdirSync(templateDir, { recursive: true });
    return {
      templateDir,
      outputDir: path.join(tmpDir, 'gen'),
      watcher: new Watcher({
        templateDir,
        outputDir: path.join(tmpDir, 'gen'),
        engine: 'EJS',
        variables: { name: 'Button' },
        outputExtension
      })
    };
  }

  it('Button.tsx.ejs becomes Button.tsx', async () => {
    const { templateDir, outputDir, watcher } = makeWatcher();
    const file = path.join(templateDir, 'Button.tsx.ejs');
    fs.writeFileSync(file, 'export const <%= name %> = 1;');

    const written = await watcher.rebuild(file);
    expect(written).toBe(path.join(outputDir, 'Button.tsx'));
    expect(fs.readFileSync(written!, 'utf8')).toBe('export const Button = 1;');
  });

  it('page.ejs still becomes page.html by default', async () => {
    const { templateDir, outputDir, watcher } = makeWatcher();
    const file = path.join(templateDir, 'page.ejs');
    fs.writeFileSync(file, 'hi');
    expect(await watcher.rebuild(file)).toBe(path.join(outputDir, 'page.html'));
  });

  it('uses outputExtension when given', async () => {
    const { templateDir, outputDir, watcher } = makeWatcher('.ts');
    const file = path.join(templateDir, 'model.ejs');
    fs.writeFileSync(file, 'x');
    expect(await watcher.rebuild(file)).toBe(path.join(outputDir, 'model.ts'));
  });

  it('only strips the trailing extension', async () => {
    const { templateDir, outputDir, watcher } = makeWatcher();
    const sub = path.join(templateDir, 'a.ejs.d');
    fs.mkdirSync(sub);
    const file = path.join(sub, 'b.ejs');
    fs.writeFileSync(file, 'x');
    expect(await watcher.rebuild(file)).toBe(
      path.join(outputDir, 'a.ejs.d', 'b.html')
    );
  });

  it('ignores unwatched extensions', async () => {
    const { templateDir, watcher } = makeWatcher();
    const file = path.join(templateDir, 'notes.txt');
    fs.writeFileSync(file, 'x');
    expect(await watcher.rebuild(file)).toBeNull();
  });
});
