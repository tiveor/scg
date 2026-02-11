import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';

import { StringHelper } from '../src/string_helper.js';
import { FileHelper } from '../src/file_helper.js';
import { CommandHelper } from '../src/command_helper.js';
import { ParamHelper } from '../src/param_helper.js';
import { TemplateBuilder } from '../src/template_builder.js';
import { TEMPLATE_HANDLERS } from '../src/template_handlers.js';
import { Pipeline } from '../src/pipeline.js';
import { Scaffold } from '../src/scaffold.js';
import { Watcher } from '../src/watcher.js';

const exampleDir = path.join(__dirname, '..', 'example');

// ============================================================
// StringHelper
// ============================================================

describe('StringHelper', () => {
  describe('replace', () => {
    it('should search and replace the test param', () => {
      const replaced = StringHelper.replace(
        'This is a {{test}}',
        '{{test}}',
        'joke'
      );
      expect(replaced).toBe('This is a joke');
    });

    it('should replace all occurrences', () => {
      const replaced = StringHelper.replace(
        '{{name}} likes {{name}}',
        '{{name}}',
        'Alice'
      );
      expect(replaced).toBe('Alice likes Alice');
    });

    it('should handle tokens with regex special characters', () => {
      const replaced = StringHelper.replace(
        'Price is $100.00 total',
        '$100.00',
        '$200.00'
      );
      expect(replaced).toBe('Price is $200.00 total');
    });

    it('should return empty string for non-string line', () => {
      expect(StringHelper.replace(null, 'a', 'b')).toBe('');
      expect(StringHelper.replace(undefined, 'a', 'b')).toBe('');
      expect(StringHelper.replace(123, 'a', 'b')).toBe('');
    });

    it('should return line unchanged for non-string token', () => {
      expect(StringHelper.replace('hello', null, 'b')).toBe('hello');
    });
  });

  describe('escapeRegex', () => {
    it('should escape regex special characters', () => {
      const escaped = StringHelper.escapeRegex('$100.00 (test)');
      expect(escaped).toBe('\\$100\\.00 \\(test\\)');
    });
  });

  describe('capitalize', () => {
    it('should capitalize first character', () => {
      expect(StringHelper.capitalize('hello')).toBe('Hello');
    });

    it('should return empty string for non-string', () => {
      expect(StringHelper.capitalize(123)).toBe('');
      expect(StringHelper.capitalize(null)).toBe('');
    });

    it('should handle empty string', () => {
      expect(StringHelper.capitalize('')).toBe('');
    });

    it('should handle single character', () => {
      expect(StringHelper.capitalize('a')).toBe('A');
    });
  });
});

// ============================================================
// FileHelper
// ============================================================

describe('FileHelper', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scg-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('readFileToString', () => {
    it('should read a file and return its content as string', () => {
      const filePath = path.join(tmpDir, 'test.txt');
      fs.writeFileSync(filePath, 'hello world');
      const content = FileHelper.readFileToString(filePath);
      expect(content).toBe('hello world');
    });
  });

  describe('convertJsonFileToObject', () => {
    it('should parse a JSON file to an object', () => {
      const filePath = path.join(tmpDir, 'test.json');
      fs.writeFileSync(filePath, '{"name": "scg", "version": 1}');
      const obj = FileHelper.convertJsonFileToObject<{
        name: string;
        version: number;
      }>(filePath);
      expect(obj.name).toBe('scg');
      expect(obj.version).toBe(1);
    });
  });

  describe('createFolder', () => {
    it('should create a folder', () => {
      const folderPath = path.join(tmpDir, 'new-folder');
      FileHelper.createFolder(folderPath);
      expect(fs.existsSync(folderPath)).toBe(true);
    });

    it('should create nested folders', () => {
      const folderPath = path.join(tmpDir, 'a', 'b', 'c');
      FileHelper.createFolder(folderPath);
      expect(fs.existsSync(folderPath)).toBe(true);
    });

    it('should not throw if folder already exists', () => {
      const folderPath = path.join(tmpDir, 'existing');
      fs.mkdirSync(folderPath);
      expect(() => FileHelper.createFolder(folderPath)).not.toThrow();
    });
  });

  describe('removeFolder', () => {
    it('should remove a folder', () => {
      const folderPath = path.join(tmpDir, 'to-remove');
      fs.mkdirSync(folderPath);
      FileHelper.removeFolder(folderPath);
      expect(fs.existsSync(folderPath)).toBe(false);
    });

    it('should not throw if folder does not exist', () => {
      expect(() =>
        FileHelper.removeFolder(path.join(tmpDir, 'nonexistent'))
      ).not.toThrow();
    });
  });

  describe('removeFile', () => {
    it('should remove a file', () => {
      const filePath = path.join(tmpDir, 'to-remove.txt');
      fs.writeFileSync(filePath, 'delete me');
      FileHelper.removeFile(filePath);
      expect(fs.existsSync(filePath)).toBe(false);
    });

    it('should not throw if file does not exist', () => {
      expect(() =>
        FileHelper.removeFile(path.join(tmpDir, 'nonexistent.txt'))
      ).not.toThrow();
    });
  });

  describe('simpleReplace', () => {
    it('should replace token with value', () => {
      const result = FileHelper.simpleReplace('Hello {{name}}', {
        token: '{{name}}',
        value: 'World'
      });
      expect(result).toBe('Hello World');
    });
  });

  // --- Async methods ---

  describe('readFileAsync', () => {
    it('should read a file asynchronously', async () => {
      const filePath = path.join(tmpDir, 'async.txt');
      fs.writeFileSync(filePath, 'async content');
      const content = await FileHelper.readFileAsync(filePath);
      expect(content).toBe('async content');
    });
  });

  describe('readJsonFileAsync', () => {
    it('should parse a JSON file asynchronously', async () => {
      const filePath = path.join(tmpDir, 'async.json');
      fs.writeFileSync(filePath, '{"key": "value"}');
      const obj = await FileHelper.readJsonFileAsync<{ key: string }>(
        filePath
      );
      expect(obj.key).toBe('value');
    });
  });

  describe('writeFileAsync', () => {
    it('should write a file asynchronously', async () => {
      const filePath = path.join(tmpDir, 'sub', 'write.txt');
      await FileHelper.writeFileAsync(filePath, 'written content');
      expect(fs.readFileSync(filePath, 'utf8')).toBe('written content');
    });
  });

  describe('createFolderAsync', () => {
    it('should create a folder asynchronously', async () => {
      const folderPath = path.join(tmpDir, 'async-folder');
      await FileHelper.createFolderAsync(folderPath);
      expect(fs.existsSync(folderPath)).toBe(true);
    });
  });

  describe('removeFolderAsync', () => {
    it('should remove a folder asynchronously', async () => {
      const folderPath = path.join(tmpDir, 'async-remove');
      fs.mkdirSync(folderPath);
      await FileHelper.removeFolderAsync(folderPath);
      expect(fs.existsSync(folderPath)).toBe(false);
    });
  });

  describe('removeFileAsync', () => {
    it('should remove a file asynchronously', async () => {
      const filePath = path.join(tmpDir, 'async-remove.txt');
      fs.writeFileSync(filePath, 'delete me');
      await FileHelper.removeFileAsync(filePath);
      expect(fs.existsSync(filePath)).toBe(false);
    });
  });

  describe('existsAsync', () => {
    it('should return true for existing file', async () => {
      const filePath = path.join(tmpDir, 'exists.txt');
      fs.writeFileSync(filePath, 'hi');
      expect(await FileHelper.existsAsync(filePath)).toBe(true);
    });

    it('should return false for non-existing file', async () => {
      expect(
        await FileHelper.existsAsync(path.join(tmpDir, 'nope.txt'))
      ).toBe(false);
    });
  });
});

// ============================================================
// CommandHelper
// ============================================================

describe('CommandHelper', () => {
  describe('run', () => {
    it('should execute a command and return stdout', async () => {
      const result = await CommandHelper.run('.', 'echo hello');
      expect(result.trim()).toBe('hello');
    });

    it('should reject when directory is missing', async () => {
      await expect(CommandHelper.run('', 'echo hello')).rejects.toThrow(
        'directory is required'
      );
    });

    it('should reject when no command is given', async () => {
      await expect(CommandHelper.run('.')).rejects.toThrow(
        'at least one command is required'
      );
    });

    it('should reject on invalid command', async () => {
      await expect(
        CommandHelper.run('.', 'nonexistent_command_xyz')
      ).rejects.toThrow();
    });

    it('should reject potentially unsafe commands', async () => {
      await expect(
        CommandHelper.run('.', 'echo hello; rm -rf /')
      ).rejects.toThrow('potentially unsafe command');
    });
  });

  describe('runClean', () => {
    it('should return output without newlines', async () => {
      const result = await CommandHelper.runClean('.', 'echo hello');
      expect(result).toBe('hello');
    });
  });
});

// ============================================================
// ParamHelper
// ============================================================

describe('ParamHelper', () => {
  let originalArgv: string[];

  beforeEach(() => {
    originalArgv = process.argv.slice();
  });

  afterEach(() => {
    process.argv = originalArgv;
  });

  describe('addCustomParam', () => {
    it('should add a parameter to process.argv', () => {
      const before = process.argv.length;
      ParamHelper.addCustomParam('--test=123');
      expect(process.argv.length).toBe(before + 1);
      expect(process.argv[process.argv.length - 1]).toBe('--test=123');
    });
  });

  describe('getCommandByIndex', () => {
    it('should return argv value at index', () => {
      const result = ParamHelper.getCommandByIndex(0);
      expect(result).toBe(process.argv[0]);
    });

    it('should return empty string for out-of-bounds index', () => {
      const result = ParamHelper.getCommandByIndex(9999);
      expect(result).toBe('');
    });
  });

  describe('getParams', () => {
    it('should parse --key=value params', () => {
      process.argv = ['node', 'test', '--name=Alice', '--age=30'];
      const params = ParamHelper.getParams();
      expect(params.name).toBe('Alice');
      expect(params.age).toBe('30');
    });

    it('should strip quotes from values', () => {
      process.argv = ['node', 'test', '--name="Alice"', "--city='Paris'"];
      const params = ParamHelper.getParams();
      expect(params.name).toBe('Alice');
      expect(params.city).toBe('Paris');
    });

    it('should return empty object when no params', () => {
      process.argv = ['node', 'test'];
      const params = ParamHelper.getParams();
      expect(params).toEqual({});
    });
  });
});

// ============================================================
// TemplateBuilder (with plugin system)
// ============================================================

describe('TemplateBuilder', () => {
  describe('render (from string)', () => {
    it('should render EJS template from string', async () => {
      const builder = new TemplateBuilder(TEMPLATE_HANDLERS.EJS);
      const result = await builder.render('Hello <%= name %>', {
        name: 'World'
      });
      expect(result).toBe('Hello World');
    });

    it('should render Handlebars template from string', async () => {
      const builder = new TemplateBuilder(TEMPLATE_HANDLERS.HANDLEBARS);
      const result = await builder.render('Hello {{name}}', {
        name: 'World'
      });
      expect(result).toBe('Hello World');
    });

    it('should render Pug template from string', async () => {
      const builder = new TemplateBuilder(TEMPLATE_HANDLERS.PUG);
      const result = await builder.render('p #{name}', { name: 'World' });
      expect(result).toBe('<p>World</p>');
    });

    it('should default to Handlebars for unknown handler', async () => {
      const builder = new TemplateBuilder('UNKNOWN');
      const result = await builder.render('Hello {{name}}', {
        name: 'World'
      });
      expect(result).toBe('Hello World');
    });
  });

  describe('renderFile', () => {
    it('should render EJS template from file', async () => {
      const builder = new TemplateBuilder(TEMPLATE_HANDLERS.EJS);
      const result = await builder.renderFile(
        path.join(exampleDir, 'ejs', 'hello.ejs'),
        { title: 'Test', body: 'Body' },
        {}
      );
      expect(result).toContain('Test');
      expect(result).toContain('Body');
    });

    it('should render Handlebars template from file', async () => {
      const builder = new TemplateBuilder(TEMPLATE_HANDLERS.HANDLEBARS);
      const result = await builder.renderFile(
        path.join(exampleDir, 'handlebars', 'hello.handlebars'),
        { title: 'Test', body: 'Body' },
        {}
      );
      expect(result).toContain('Test');
      expect(result).toContain('Body');
    });

    it('should render Pug template from file', async () => {
      const builder = new TemplateBuilder(TEMPLATE_HANDLERS.PUG);
      const result = await builder.renderFile(
        path.join(exampleDir, 'pug', 'hello.pug'),
        { title: 'Test', body: 'Body' },
        {}
      );
      expect(result).toContain('Test');
      expect(result).toContain('Body');
    });
  });

  describe('registerEngine (plugin system)', () => {
    it('should register and use a custom engine', async () => {
      TemplateBuilder.registerEngine('custom', {
        render: async (source, data) => {
          return source.replace(
            /\$\{(\w+)\}/g,
            (_, key) => String(data[key] ?? '')
          );
        },
        renderFile: async (fileName, data) => {
          const source = fs.readFileSync(fileName, 'utf8');
          return source.replace(
            /\$\{(\w+)\}/g,
            (_, key) => String(data[key] ?? '')
          );
        }
      });

      const builder = new TemplateBuilder('custom');
      const result = await builder.render('Hello ${name}!', {
        name: 'Plugin'
      });
      expect(result).toBe('Hello Plugin!');
    });

    it('should list registered engines', () => {
      const engines = TemplateBuilder.getRegisteredEngines();
      expect(engines).toContain('HANDLEBARS');
      expect(engines).toContain('EJS');
      expect(engines).toContain('PUG');
      expect(engines).toContain('custom');
    });

    it('should get an engine by name', () => {
      const engine = TemplateBuilder.getEngine('EJS');
      expect(engine).toBeDefined();
      expect(typeof engine!.render).toBe('function');
    });

    it('should throw for invalid engine name', () => {
      expect(() =>
        TemplateBuilder.registerEngine('', {
          render: async () => '',
          renderFile: async () => ''
        })
      ).toThrow('engine name must be a non-empty string');
    });

    it('should throw for invalid engine object', () => {
      expect(() =>
        TemplateBuilder.registerEngine('bad', {} as any)
      ).toThrow('engine must implement render() and renderFile() methods');
    });
  });
});

// ============================================================
// TEMPLATE_HANDLERS
// ============================================================

describe('TEMPLATE_HANDLERS', () => {
  it('should export HANDLEBARS, EJS, and PUG', () => {
    expect(TEMPLATE_HANDLERS.HANDLEBARS).toBe('HANDLEBARS');
    expect(TEMPLATE_HANDLERS.EJS).toBe('EJS');
    expect(TEMPLATE_HANDLERS.PUG).toBe('PUG');
  });
});

// ============================================================
// Pipeline
// ============================================================

describe('Pipeline', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scg-pipeline-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should process a string through transforms', async () => {
    const result = await new Pipeline()
      .fromString('hello world')
      .transform((s) => s.toUpperCase())
      .transform((s) => `[${s}]`)
      .execute();
    expect(result).toBe('[HELLO WORLD]');
  });

  it('should read from a file', async () => {
    const filePath = path.join(tmpDir, 'input.txt');
    fs.writeFileSync(filePath, 'file content');
    const result = await new Pipeline().fromFile(filePath).execute();
    expect(result).toBe('file content');
  });

  it('should render from a template file', async () => {
    const result = await new Pipeline()
      .fromTemplate(
        path.join(exampleDir, 'ejs', 'hello.ejs'),
        { title: 'Pipeline', body: 'Works' },
        'EJS'
      )
      .execute();
    expect(result).toContain('Pipeline');
    expect(result).toContain('Works');
  });

  it('should render from a template string', async () => {
    const result = await new Pipeline()
      .fromTemplateString('Hello <%= name %>', { name: 'Pipeline' }, 'EJS')
      .execute();
    expect(result).toBe('Hello Pipeline');
  });

  it('should write output to a file', async () => {
    const outputPath = path.join(tmpDir, 'output.txt');
    const result = await new Pipeline()
      .fromString('output content')
      .writeTo(outputPath);
    expect(result).toBe('output content');
    expect(fs.readFileSync(outputPath, 'utf8')).toBe('output content');
  });

  it('should create directories when writing', async () => {
    const outputPath = path.join(tmpDir, 'sub', 'deep', 'output.txt');
    await new Pipeline().fromString('nested').writeTo(outputPath);
    expect(fs.readFileSync(outputPath, 'utf8')).toBe('nested');
  });

  it('should support async transforms', async () => {
    const result = await new Pipeline()
      .fromString('async')
      .transform(async (s) => {
        return new Promise((resolve) =>
          setTimeout(() => resolve(s + ' done'), 10)
        );
      })
      .execute();
    expect(result).toBe('async done');
  });

  it('should throw if no content is set', async () => {
    await expect(new Pipeline().execute()).rejects.toThrow(
      'Pipeline has no content'
    );
  });
});

// ============================================================
// Scaffold
// ============================================================

describe('Scaffold', () => {
  let tmpDir: string;
  let templateDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scg-scaffold-'));
    templateDir = path.join(tmpDir, 'templates');
    fs.mkdirSync(templateDir);

    // Create EJS templates
    fs.writeFileSync(
      path.join(templateDir, 'component.ejs'),
      'export const <%= name %> = () => null;'
    );
    fs.writeFileSync(
      path.join(templateDir, 'test.ejs'),
      'import { <%= name %> } from "./<%= name %>";'
    );
    fs.writeFileSync(
      path.join(templateDir, 'index.ejs'),
      'export { <%= name %> } from "./<%= name %>";'
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should generate files from a manifest', async () => {
    const outputDir = path.join(tmpDir, 'output', '{{name}}');
    const result = await Scaffold.from({
      engine: 'EJS',
      templateDir,
      outputDir,
      variables: { name: 'Button' },
      structure: [
        { template: 'component.ejs', output: '{{name}}.tsx' },
        { template: 'test.ejs', output: '{{name}}.test.tsx' },
        { template: 'index.ejs', output: 'index.ts' }
      ]
    });

    expect(result.files).toHaveLength(3);
    expect(result.dryRun).toBe(false);

    const componentPath = path.join(tmpDir, 'output', 'Button', 'Button.tsx');
    expect(fs.existsSync(componentPath)).toBe(true);
    expect(fs.readFileSync(componentPath, 'utf8')).toContain(
      'export const Button'
    );

    const testPath = path.join(tmpDir, 'output', 'Button', 'Button.test.tsx');
    expect(fs.existsSync(testPath)).toBe(true);

    const indexPath = path.join(tmpDir, 'output', 'Button', 'index.ts');
    expect(fs.existsSync(indexPath)).toBe(true);
  });

  it('should support dry run mode', async () => {
    const outputDir = path.join(tmpDir, 'dry-output', '{{name}}');
    const result = await Scaffold.from({
      engine: 'EJS',
      templateDir,
      outputDir,
      variables: { name: 'Card' },
      structure: [{ template: 'component.ejs', output: '{{name}}.tsx' }],
      dryRun: true
    });

    expect(result.files).toHaveLength(1);
    expect(result.dryRun).toBe(true);
    // File should NOT be created in dry run
    expect(fs.existsSync(path.join(tmpDir, 'dry-output'))).toBe(false);
  });
});

// ============================================================
// Watcher
// ============================================================

describe('Watcher', () => {
  it('should start and stop without errors', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scg-watcher-'));
    const outputDir = path.join(tmpDir, 'output');

    try {
      const watcher = new Watcher({
        templateDir: tmpDir,
        outputDir,
        engine: 'EJS',
        variables: { name: 'Test' }
      });

      expect(watcher.isRunning).toBe(false);
      watcher.start();
      expect(watcher.isRunning).toBe(true);
      watcher.stop();
      expect(watcher.isRunning).toBe(false);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('should not start twice', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scg-watcher-'));

    try {
      const watcher = new Watcher({
        templateDir: tmpDir,
        outputDir: path.join(tmpDir, 'out'),
        engine: 'EJS',
        variables: {}
      });

      watcher.start();
      watcher.start(); // should be idempotent
      expect(watcher.isRunning).toBe(true);
      watcher.stop();
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
