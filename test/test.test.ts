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

const exampleDir = path.join(__dirname, '..', 'example');

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
});

describe('CommandHelper', () => {
  describe('run', () => {
    it('should execute a command and return stdout', async () => {
      const result = await CommandHelper.run('.', 'echo hello');
      expect(result.trim()).toBe('hello');
    });

    it('should reject when directory is missing', async () => {
      await expect(
        CommandHelper.run('', 'echo hello')
      ).rejects.toThrow('directory is required');
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
});

describe('TEMPLATE_HANDLERS', () => {
  it('should export HANDLEBARS, EJS, and PUG', () => {
    expect(TEMPLATE_HANDLERS.HANDLEBARS).toBe('HANDLEBARS');
    expect(TEMPLATE_HANDLERS.EJS).toBe('EJS');
    expect(TEMPLATE_HANDLERS.PUG).toBe('PUG');
  });
});
