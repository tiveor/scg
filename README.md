# SCG - Simple Code Generator

[![npm version](https://img.shields.io/npm/v/@tiveor/scg.svg)](https://www.npmjs.com/package/@tiveor/scg)

A utility library for code generation and template processing in Node.js. Provides helpers for template rendering (EJS, Handlebars, Pug), string manipulation, file operations, command execution, CLI parameter parsing, a scaffold engine, a template pipeline, and a file watcher.

Written in TypeScript with full type definitions. Supports both ESM and CommonJS.

## Installation

```bash
npm install @tiveor/scg
```

## Quick Start

```typescript
// ESM
import {
  StringHelper,
  FileHelper,
  CommandHelper,
  ParamHelper,
  TemplateBuilder,
  Pipeline,
  Scaffold,
  Watcher,
  TEMPLATE_HANDLERS
} from '@tiveor/scg';

// CommonJS
const { TemplateBuilder, TEMPLATE_HANDLERS } = require('@tiveor/scg');
```

## API Reference

### TemplateBuilder

Unified interface to render templates with EJS, Handlebars, Pug, or any custom engine.

```typescript
const builder = new TemplateBuilder(TEMPLATE_HANDLERS.EJS);

// Render from string
const html = await builder.render('Hello <%= name %>', { name: 'World' });

// Render from file
const page = await builder.renderFile('template.ejs', { title: 'Home' });
```

Available handlers: `TEMPLATE_HANDLERS.EJS`, `TEMPLATE_HANDLERS.HANDLEBARS`, `TEMPLATE_HANDLERS.PUG`

#### Plugin System

Register custom template engines without modifying the library:

```typescript
import nunjucks from 'nunjucks';

TemplateBuilder.registerEngine('nunjucks', {
  render: async (source, data) => nunjucks.renderString(source, data),
  renderFile: async (file, data) => nunjucks.render(file, data),
});

const builder = new TemplateBuilder('nunjucks');
const result = await builder.render('Hello {{ name }}', { name: 'World' });

// List all available engines
TemplateBuilder.getRegisteredEngines();
// => ['HANDLEBARS', 'EJS', 'PUG', 'nunjucks']
```

### Pipeline

Chain transformations on template output:

```typescript
import { Pipeline } from '@tiveor/scg';

const result = await new Pipeline()
  .fromTemplate('component.ejs', { name: 'Button' }, 'EJS')
  .transform((content) => content.toUpperCase())
  .transform(addLicenseHeader)
  .writeTo('src/components/Button.tsx');

// Other input methods
new Pipeline().fromString('raw content');
new Pipeline().fromFile('input.txt');
new Pipeline().fromTemplateString('<%= name %>', { name: 'World' }, 'EJS');
```

### Scaffold

Generate directory structures from manifests:

```typescript
import { Scaffold } from '@tiveor/scg';

const result = await Scaffold.from({
  engine: 'EJS',
  templateDir: './templates/react-component',
  outputDir: './src/components/{{name}}',
  variables: { name: 'UserProfile', style: 'module' },
  structure: [
    { template: 'component.ejs', output: '{{name}}.tsx' },
    { template: 'styles.ejs',    output: '{{name}}.module.css' },
    { template: 'test.ejs',      output: '{{name}}.test.tsx' },
    { template: 'index.ejs',     output: 'index.ts' },
  ]
});

console.log(result.files); // List of created file paths

// Preview without writing files
const preview = await Scaffold.from({ ...options, dryRun: true });
```

### Watcher

Watch templates and regenerate on changes:

```typescript
import { Watcher } from '@tiveor/scg';

const watcher = new Watcher({
  templateDir: './templates',
  outputDir: './generated',
  engine: 'EJS',
  variables: { project: 'MyApp' },
  onRebuild: (file) => console.log(`Rebuilt: ${file}`),
  onError: (err, file) => console.error(`Error in ${file}: ${err.message}`),
});

watcher.start();
// watcher.stop();
```

### StringHelper

Static methods for string manipulation.

```typescript
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

Static methods for file system operations (sync and async).

```typescript
// Sync
const content = FileHelper.readFileToString('config.txt');
const config = FileHelper.convertJsonFileToObject('config.json');
FileHelper.createFolder('output/components');
FileHelper.removeFolder('output/temp');
FileHelper.removeFile('output/old.txt');

// Async
const data = await FileHelper.readFileAsync('config.txt');
const json = await FileHelper.readJsonFileAsync('config.json');
await FileHelper.writeFileAsync('output/file.txt', 'content');
await FileHelper.createFolderAsync('output/components');
await FileHelper.removeFolderAsync('output/temp');
await FileHelper.removeFileAsync('output/old.txt');
const exists = await FileHelper.existsAsync('some/path');

// Generate file from template with variable replacement
await FileHelper.createFileFromFile({
  template: 'templates/component.txt',
  newFile: 'output/Button.tsx',
  variables: [
    { token: '{{name}}', value: 'Button' },
    { token: '{{style}}', value: 'primary' }
  ]
});
```

### CommandHelper

Execute shell commands as promises (with input sanitization).

```typescript
// Run a command
const output = await CommandHelper.run('.', 'echo hello');

// Chain multiple commands
const result = await CommandHelper.run('.', 'git add .', 'git status');

// Run and clean output (strips newlines)
const version = await CommandHelper.runClean('.', 'node --version');
```

### ParamHelper

Parse CLI parameters from `process.argv`.

```typescript
// Add custom parameters
ParamHelper.addCustomParam('--env=production');

// Get parameter by index
const script = ParamHelper.getCommandByIndex(1);

// Parse all --key=value parameters
// Example: node script.js --name=Alice --port=3000
const params = ParamHelper.getParams();
// => { name: "Alice", port: "3000" }
```

## CLI

SCG includes a command-line interface for scaffolding and template rendering.

```bash
# Initialize a scaffold manifest
npx @tiveor/scg init

# Generate files from a scaffold manifest
npx @tiveor/scg generate --manifest=scaffold.json --vars=name=Button

# Preview without writing files
npx @tiveor/scg generate --manifest=scaffold.json --vars=name=Button --dry-run

# Render a single template
npx @tiveor/scg render template.ejs --data='{"name":"World"}'

# Render and save to file
npx @tiveor/scg render template.ejs --data='{"name":"World"}' --output=output.html
```

## Running Examples

```bash
npm run build
node example/index.js
```

## Running Tests

```bash
npm test
```

## Development

```bash
npm run build        # Build CJS + ESM + .d.ts
npm run dev          # Build in watch mode
npm test             # Run tests
npm run test:watch   # Run tests in watch mode
npm run lint         # Lint source code
npm run typecheck    # Type check with tsc
npm run format       # Format with Prettier
```

## Template Engine Documentation

- [EJS](https://ejs.co/#docs)
- [Pug](https://pugjs.org/api/getting-started.html)
- [Handlebars](https://handlebarsjs.com/guide/)

## License

MIT - Alvaro Orellana - AlvaroTech.dev
