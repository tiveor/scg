var assert = require('assert');
var path = require('path');
var fs = require('fs');
var os = require('os');

var { StringHelper } = require('../src/string_helper');
var { FileHelper } = require('../src/file_helper');
var { CommandHelper } = require('../src/command_helper');
var { ParamHelper } = require('../src/param_helper');
var { TemplateBuilder } = require('../src/template_builder');
var TEMPLATE_HANDLERS = require('../src/template_handlers');

// Helper to get absolute paths for example templates
var exampleDir = path.join(__dirname, '..', 'example');

describe('StringHelper', function () {
  describe('replace', function () {
    it('should search and replace the test param', function () {
      var replaced = StringHelper.replace(
        'This is a {{test}}',
        '{{test}}',
        'joke'
      );
      assert.strictEqual(replaced, 'This is a joke');
    });

    it('should replace all occurrences', function () {
      var replaced = StringHelper.replace(
        '{{name}} likes {{name}}',
        '{{name}}',
        'Alice'
      );
      assert.strictEqual(replaced, 'Alice likes Alice');
    });

    it('should handle tokens with regex special characters', function () {
      var replaced = StringHelper.replace(
        'Price is $100.00 total',
        '$100.00',
        '$200.00'
      );
      assert.strictEqual(replaced, 'Price is $200.00 total');
    });

    it('should return empty string for non-string line', function () {
      assert.strictEqual(StringHelper.replace(null, 'a', 'b'), '');
      assert.strictEqual(StringHelper.replace(undefined, 'a', 'b'), '');
      assert.strictEqual(StringHelper.replace(123, 'a', 'b'), '');
    });

    it('should return line unchanged for non-string token', function () {
      assert.strictEqual(StringHelper.replace('hello', null, 'b'), 'hello');
    });
  });

  describe('escapeRegex', function () {
    it('should escape regex special characters', function () {
      var escaped = StringHelper.escapeRegex('$100.00 (test)');
      assert.strictEqual(escaped, '\\$100\\.00 \\(test\\)');
    });
  });

  describe('capitalize', function () {
    it('should capitalize first character', function () {
      assert.strictEqual(StringHelper.capitalize('hello'), 'Hello');
    });

    it('should return empty string for non-string', function () {
      assert.strictEqual(StringHelper.capitalize(123), '');
      assert.strictEqual(StringHelper.capitalize(null), '');
    });

    it('should handle empty string', function () {
      assert.strictEqual(StringHelper.capitalize(''), '');
    });

    it('should handle single character', function () {
      assert.strictEqual(StringHelper.capitalize('a'), 'A');
    });
  });
});

describe('FileHelper', function () {
  var tmpDir;

  beforeEach(function () {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scg-test-'));
  });

  afterEach(function () {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('readFileToString', function () {
    it('should read a file and return its content as string', function () {
      var filePath = path.join(tmpDir, 'test.txt');
      fs.writeFileSync(filePath, 'hello world');
      var content = FileHelper.readFileToString(filePath);
      assert.strictEqual(content, 'hello world');
    });
  });

  describe('convertJsonFileToObject', function () {
    it('should parse a JSON file to an object', function () {
      var filePath = path.join(tmpDir, 'test.json');
      fs.writeFileSync(filePath, '{"name": "scg", "version": 1}');
      var obj = FileHelper.convertJsonFileToObject(filePath);
      assert.strictEqual(obj.name, 'scg');
      assert.strictEqual(obj.version, 1);
    });
  });

  describe('createFolder', function () {
    it('should create a folder', function () {
      var folderPath = path.join(tmpDir, 'new-folder');
      FileHelper.createFolder(folderPath);
      assert.ok(fs.existsSync(folderPath));
    });

    it('should create nested folders', function () {
      var folderPath = path.join(tmpDir, 'a', 'b', 'c');
      FileHelper.createFolder(folderPath);
      assert.ok(fs.existsSync(folderPath));
    });

    it('should not throw if folder already exists', function () {
      var folderPath = path.join(tmpDir, 'existing');
      fs.mkdirSync(folderPath);
      assert.doesNotThrow(function () {
        FileHelper.createFolder(folderPath);
      });
    });
  });

  describe('removeFolder', function () {
    it('should remove a folder', function () {
      var folderPath = path.join(tmpDir, 'to-remove');
      fs.mkdirSync(folderPath);
      FileHelper.removeFolder(folderPath);
      assert.ok(!fs.existsSync(folderPath));
    });

    it('should not throw if folder does not exist', function () {
      assert.doesNotThrow(function () {
        FileHelper.removeFolder(path.join(tmpDir, 'nonexistent'));
      });
    });
  });

  describe('removeFile', function () {
    it('should remove a file', function () {
      var filePath = path.join(tmpDir, 'to-remove.txt');
      fs.writeFileSync(filePath, 'delete me');
      FileHelper.removeFile(filePath);
      assert.ok(!fs.existsSync(filePath));
    });

    it('should not throw if file does not exist', function () {
      assert.doesNotThrow(function () {
        FileHelper.removeFile(path.join(tmpDir, 'nonexistent.txt'));
      });
    });
  });

  describe('simpleReplace', function () {
    it('should replace token with value', function () {
      var result = FileHelper.simpleReplace('Hello {{name}}', {
        token: '{{name}}',
        value: 'World'
      });
      assert.strictEqual(result, 'Hello World');
    });
  });
});

describe('CommandHelper', function () {
  describe('run', function () {
    it('should execute a command and return stdout', function () {
      return CommandHelper.run('.', 'echo hello').then(function (result) {
        assert.strictEqual(result.trim(), 'hello');
      });
    });

    it('should reject when directory is missing', function () {
      return CommandHelper.run(null, 'echo hello').then(
        function () {
          assert.fail('should have rejected');
        },
        function (err) {
          assert.ok(err.message.includes('directory is required'));
        }
      );
    });

    it('should reject when no command is given', function () {
      return CommandHelper.run('.').then(
        function () {
          assert.fail('should have rejected');
        },
        function (err) {
          assert.ok(err.message.includes('at least one command is required'));
        }
      );
    });

    it('should reject on invalid command', function () {
      return CommandHelper.run('.', 'nonexistent_command_xyz').then(
        function () {
          assert.fail('should have rejected');
        },
        function (err) {
          assert.ok(err);
        }
      );
    });

    it('should chain multiple commands', function () {
      return CommandHelper.run('.', 'echo hello', 'echo world').then(
        function (result) {
          assert.ok(result.includes('hello'));
          assert.ok(result.includes('world'));
        }
      );
    });
  });

  describe('runClean', function () {
    it('should return output without newlines', function () {
      return CommandHelper.runClean('.', 'echo hello').then(function (result) {
        assert.strictEqual(result, 'hello');
      });
    });
  });
});

describe('ParamHelper', function () {
  var originalArgv;

  beforeEach(function () {
    originalArgv = process.argv.slice();
  });

  afterEach(function () {
    process.argv = originalArgv;
  });

  describe('addCustomParam', function () {
    it('should add a parameter to process.argv', function () {
      var before = process.argv.length;
      ParamHelper.addCustomParam('--test=123');
      assert.strictEqual(process.argv.length, before + 1);
      assert.strictEqual(process.argv[process.argv.length - 1], '--test=123');
    });
  });

  describe('getCommandByIndex', function () {
    it('should return argv value at index', function () {
      var result = ParamHelper.getCommandByIndex(0);
      assert.strictEqual(result, process.argv[0]);
    });

    it('should return empty string for out-of-bounds index', function () {
      var result = ParamHelper.getCommandByIndex(9999);
      assert.strictEqual(result, '');
    });
  });

  describe('getParams', function () {
    it('should parse --key=value params', function () {
      process.argv = ['node', 'test', '--name=Alice', '--age=30'];
      var params = ParamHelper.getParams();
      assert.strictEqual(params.name, 'Alice');
      assert.strictEqual(params.age, '30');
    });

    it('should strip quotes from values', function () {
      process.argv = ['node', 'test', '--name="Alice"', "--city='Paris'"];
      var params = ParamHelper.getParams();
      assert.strictEqual(params.name, 'Alice');
      assert.strictEqual(params.city, 'Paris');
    });

    it('should return empty object when no params', function () {
      process.argv = ['node', 'test'];
      var params = ParamHelper.getParams();
      assert.deepStrictEqual(params, {});
    });
  });
});

describe('TemplateBuilder', function () {
  describe('render (from string)', function () {
    it('should render EJS template from string', function () {
      var builder = new TemplateBuilder(TEMPLATE_HANDLERS.EJS);
      return builder
        .render('Hello <%= name %>', { name: 'World' })
        .then(function (result) {
          assert.strictEqual(result, 'Hello World');
        });
    });

    it('should render Handlebars template from string', function () {
      var builder = new TemplateBuilder(TEMPLATE_HANDLERS.HANDLEBARS);
      return builder
        .render('Hello {{name}}', { name: 'World' })
        .then(function (result) {
          assert.strictEqual(result, 'Hello World');
        });
    });

    it('should render Pug template from string', function () {
      var builder = new TemplateBuilder(TEMPLATE_HANDLERS.PUG);
      return builder
        .render('p #{name}', { name: 'World' })
        .then(function (result) {
          assert.strictEqual(result, '<p>World</p>');
        });
    });

    it('should default to Handlebars for unknown handler', function () {
      var builder = new TemplateBuilder('UNKNOWN');
      return builder
        .render('Hello {{name}}', { name: 'World' })
        .then(function (result) {
          assert.strictEqual(result, 'Hello World');
        });
    });
  });

  describe('renderFile', function () {
    it('should render EJS template from file', function () {
      var builder = new TemplateBuilder(TEMPLATE_HANDLERS.EJS);
      return builder
        .renderFile(
          path.join(exampleDir, 'ejs', 'hello.ejs'),
          { title: 'Test', body: 'Body' },
          {}
        )
        .then(function (result) {
          assert.ok(result.includes('Test'));
          assert.ok(result.includes('Body'));
        });
    });

    it('should render Handlebars template from file', function () {
      var builder = new TemplateBuilder(TEMPLATE_HANDLERS.HANDLEBARS);
      return builder
        .renderFile(
          path.join(exampleDir, 'handlebars', 'hello.handlebars'),
          { title: 'Test', body: 'Body' },
          {}
        )
        .then(function (result) {
          assert.ok(result.includes('Test'));
          assert.ok(result.includes('Body'));
        });
    });

    it('should render Pug template from file', function () {
      var builder = new TemplateBuilder(TEMPLATE_HANDLERS.PUG);
      return builder
        .renderFile(
          path.join(exampleDir, 'pug', 'hello.pug'),
          { title: 'Test', body: 'Body' },
          {}
        )
        .then(function (result) {
          assert.ok(result.includes('Test'));
          assert.ok(result.includes('Body'));
        });
    });
  });
});

describe('TEMPLATE_HANDLERS', function () {
  it('should export HANDLEBARS, EJS, and PUG', function () {
    assert.strictEqual(TEMPLATE_HANDLERS.HANDLEBARS, 'HANDLEBARS');
    assert.strictEqual(TEMPLATE_HANDLERS.EJS, 'EJS');
    assert.strictEqual(TEMPLATE_HANDLERS.PUG, 'PUG');
  });
});

describe('index (main exports)', function () {
  var scg = require('../index');

  it('should export all modules', function () {
    assert.ok(scg.StringHelper);
    assert.ok(scg.FileHelper);
    assert.ok(scg.CommandHelper);
    assert.ok(scg.ParamHelper);
    assert.ok(scg.TemplateBuilder);
    assert.ok(scg.TEMPLATE_HANDLERS);
  });
});
