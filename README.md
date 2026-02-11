# SCG - Simple Code Generator

[![npm version](https://badge.fury.io/js/%40tiveor%2Fscg.svg)](https://badge.fury.io/js/%40tiveor%2Fscg)

A utility library for code generation and template processing in Node.js. Provides helpers for template rendering (EJS, Handlebars, Pug), string manipulation, file operations, command execution, and CLI parameter parsing.

## Installation

```bash
npm install @tiveor/scg
```

## Quick Start

```javascript
const {
  StringHelper,
  FileHelper,
  CommandHelper,
  ParamHelper,
  TemplateBuilder,
  TEMPLATE_HANDLERS
} = require('@tiveor/scg');
```

## API Reference

### TemplateBuilder

Unified interface to render templates with EJS, Handlebars, or Pug.

```javascript
const builder = new TemplateBuilder(TEMPLATE_HANDLERS.EJS);

// Render from string
const html = await builder.render('Hello <%= name %>', { name: 'World' });

// Render from file
const page = await builder.renderFile('template.ejs', { title: 'Home' });
```

Available handlers: `TEMPLATE_HANDLERS.EJS`, `TEMPLATE_HANDLERS.HANDLEBARS`, `TEMPLATE_HANDLERS.PUG`

#### Examples with each engine

```javascript
// EJS
const ejs = new TemplateBuilder(TEMPLATE_HANDLERS.EJS);
await ejs.render('Hello <%= name %>', { name: 'World' });

// Handlebars
const hbs = new TemplateBuilder(TEMPLATE_HANDLERS.HANDLEBARS);
await hbs.render('Hello {{name}}', { name: 'World' });

// Pug
const pug = new TemplateBuilder(TEMPLATE_HANDLERS.PUG);
await pug.render('p #{name}', { name: 'World' });
```

### StringHelper

Static methods for string manipulation.

```javascript
// Replace all occurrences of a token (regex-safe)
StringHelper.replace('Hello {{name}}!', '{{name}}', 'World');
// => "Hello World!"

// Works safely with regex special characters
StringHelper.replace('Price: $10.00', '$10.00', '$20.00');
// => "Price: $20.00"

// Capitalize first character
StringHelper.capitalize('hello');
// => "Hello"

// Escape regex special characters
StringHelper.escapeRegex('$100.00 (test)');
// => "\\$100\\.00 \\(test\\)"
```

### FileHelper

Static methods for file system operations.

```javascript
// Read file to string
const content = FileHelper.readFileToString('config.txt');

// Parse JSON file to object
const config = FileHelper.convertJsonFileToObject('config.json');

// Create/remove folders
FileHelper.createFolder('output/components');
FileHelper.removeFolder('output/temp');

// Remove file
FileHelper.removeFile('output/old.txt');

// Generate file from template with variable replacement
await FileHelper.createFileFromFile({
  template: 'templates/component.txt',
  newFile: 'output/Button.tsx',
  variables: [
    { token: '{{name}}', value: 'Button' },
    { token: '{{style}}', value: 'primary' }
  ]
});

// Generate string from template
const result = await FileHelper.createStringFromFile({
  template: 'templates/component.txt',
  variables: [
    { token: '{{name}}', value: 'Button' }
  ]
});
```

### CommandHelper

Execute shell commands as promises.

```javascript
// Run a command
const output = await CommandHelper.run('.', 'ls -la');

// Chain multiple commands
const result = await CommandHelper.run('.', 'git add .', 'git status');

// Run and clean output (strips newlines)
const version = await CommandHelper.runClean('.', 'node --version');
```

### ParamHelper

Parse CLI parameters from `process.argv`.

```javascript
// Add custom parameters
ParamHelper.addCustomParam('--env=production');

// Get parameter by index
const script = ParamHelper.getCommandByIndex(1);

// Parse all --key=value parameters
// Example: node script.js --name=Alice --port=3000
const params = ParamHelper.getParams();
// => { name: "Alice", port: "3000" }
```

## Running Examples

```bash
node example/index.js
```

## Running Tests

```bash
npm test
```

## Template Engine Documentation

- [EJS](https://ejs.co/#docs)
- [Pug](https://pugjs.org/api/getting-started.html)
- [Handlebars](https://handlebarsjs.com/guide/)

## License

MIT - Alvaro Orellana - AlvaroTech.dev
