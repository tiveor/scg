/**
 * Pipeline Demo - Shows how to use the Pipeline API
 *
 * Run: npm run build && node example/pipeline-demo.js
 */
import { Pipeline } from '../dist/index.js';

async function main() {
  console.log('=== Pipeline Demo ===\n');

  // 1. fromString + transform
  const upper = await new Pipeline()
    .fromString('hello world')
    .transform((s) => s.toUpperCase())
    .transform((s) => `-- ${s} --`)
    .execute();
  console.log('String transform:', upper);

  // 2. fromTemplateString with EJS
  const rendered = await new Pipeline()
    .fromTemplateString(
      '<h1><%= title %></h1><p><%= body %></p>',
      { title: 'Pipeline Demo', body: 'This was rendered with EJS' },
      'EJS'
    )
    .transform((html) => `<!DOCTYPE html>\n<html>\n<body>\n${html}\n</body>\n</html>`)
    .execute();
  console.log('\nTemplate + transform:\n', rendered);

  // 3. fromTemplate with auto-detected engine
  const fromFile = await new Pipeline()
    .fromTemplate('example/ejs/hello.ejs', {
      title: 'Pipeline File Demo',
      body: 'Loaded from file and transformed'
    })
    .transform((html) => html.trim())
    .execute();
  console.log('\nFrom file template:\n', fromFile);

  console.log('\n=== Done ===');
}

main().catch(console.error);
