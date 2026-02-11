/**
 * Plugin Demo - Shows how to register custom template engines
 *
 * Run: npm run build && node example/plugin-demo.js
 */
import { TemplateBuilder } from '../dist/index.js';

// Register a simple custom engine that uses ${variable} syntax
TemplateBuilder.registerEngine('simple', {
  render: async (source, data) => {
    let result = source;
    for (const [key, value] of Object.entries(data)) {
      result = result.replaceAll(`\${${key}}`, String(value));
    }
    return result;
  },
  renderFile: async () => {
    throw new Error('renderFile not implemented for simple engine');
  }
});

async function main() {
  console.log('=== Plugin System Demo ===\n');

  // List all registered engines
  const engines = TemplateBuilder.getRegisteredEngines();
  console.log('Registered engines:', engines);

  // Use the custom engine
  const builder = new TemplateBuilder('simple');
  const result = await builder.render(
    'Hello ${name}! You are ${age} years old.',
    { name: 'Alice', age: 30 }
  );
  console.log('\nCustom engine output:', result);

  // Verify the engine was registered
  const engine = TemplateBuilder.getEngine('simple');
  console.log('Engine found:', !!engine);

  console.log('\n=== Done ===');
}

main().catch(console.error);
