/**
 * Scaffold Demo - Shows how to use the Scaffold engine
 *
 * Run: npm run build && node example/scaffold-demo.js
 */
import { Scaffold } from '../dist/index.js';

async function main() {
  console.log('=== Scaffold Demo (dry-run) ===\n');

  // React component scaffold (dry-run mode)
  const result = await Scaffold.from({
    engine: 'EJS',
    templateDir: './templates/react-component',
    outputDir: './generated/components/{{name}}',
    variables: { name: 'UserProfile', style: 'module' },
    structure: [
      { template: 'component.ejs', output: '{{name}}.tsx' },
      { template: 'test.ejs', output: '{{name}}.test.tsx' },
      { template: 'styles.ejs', output: '{{name}}.module.css' },
      { template: 'index.ejs', output: 'index.ts' }
    ],
    dryRun: true
  });

  console.log('Files that would be created:');
  for (const file of result.files) {
    console.log(`  ${file}`);
  }

  console.log(`\nDry run: ${result.dryRun}`);
  console.log('\n=== Done ===');
}

main().catch(console.error);
