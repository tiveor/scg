/**
 * Full Demo — Comprehensive SCG example showcasing ALL features
 *
 * Generates a complete, runnable CRUD API (Express + TypeScript + Zod)
 * from an entity name and its fields, using every SCG API in one script.
 *
 * Usage:
 *   node example/full-demo/generate.js --entity=Product --fields=name:string,price:number,active:boolean
 *   node example/full-demo/generate.js --entity=Order --fields=total:number,status:string,paid:boolean --watch
 *
 * Then run the generated project:
 *   ./generated/product-HHMMSS/run.sh
 *
 * Features demonstrated:
 *   1. ParamHelper    — CLI argument parsing
 *   2. StringHelper   — String transformations
 *   3. Plugin System  — Custom "sql" template engine
 *   4. Scaffold       — Bulk file generation from EJS templates
 *   5. Pipeline       — Handlebars + Pug with chained transforms
 *   6. TemplateBuilder — Custom engine rendering (SQL migration)
 *   7. FileHelper     — JSON config generation + barrel exports
 *   8. CommandHelper   — Shell command execution
 *   9. Watcher        — Optional --watch mode
 */
import {
  StringHelper,
  FileHelper,
  CommandHelper,
  ParamHelper,
  TemplateBuilder,
  Pipeline,
  Scaffold,
  Watcher,
} from '../../dist/index.js';

const DIVIDER = '-'.repeat(55);

async function main() {
  const startTime = performance.now();
  console.log('\n  SCG Full Demo - Entity CRUD Generator\n');
  console.log(DIVIDER);

  // -------------------------------------------------------
  // 1. PARAM HELPER — Parse CLI arguments
  // -------------------------------------------------------
  const params = ParamHelper.getParams();
  const entityRaw = params.entity || 'Product';
  const fieldsRaw = params.fields || 'name:string,price:number,active:boolean';
  const watchMode = process.argv.includes('--watch');

  console.log('\n[1/9] ParamHelper - Parsed CLI arguments');
  console.log(`      entity : ${entityRaw}`);
  console.log(`      fields : ${fieldsRaw}`);
  console.log(`      watch  : ${watchMode}`);

  // Parse fields into structured data
  const fields = fieldsRaw.split(',').map((f) => {
    const [name, type] = f.split(':');
    return { name: name.trim(), type: (type || 'string').trim() };
  });

  // -------------------------------------------------------
  // 2. STRING HELPER — Transform entity names
  // -------------------------------------------------------
  const typeMap = {
    zod: { string: 'z.string()', number: 'z.number()', boolean: 'z.boolean()' },
    sql: { string: 'VARCHAR(255)', number: 'NUMERIC', boolean: 'BOOLEAN' },
    html: { string: 'text', number: 'number', boolean: 'checkbox' },
  };

  const exampleValues = { string: '"example"', number: '0', boolean: 'true' };

  const Name = StringHelper.capitalize(entityRaw);
  const nameLower = entityRaw.toLowerCase();
  const nameUpper = entityRaw.toUpperCase();
  const namePlural = nameLower + 's';
  const namePluralCap = StringHelper.capitalize(namePlural);

  const enrichedFields = fields.map((f) => ({
    ...f,
    zodType: typeMap.zod[f.type] || 'z.string()',
    sqlType: typeMap.sql[f.type] || 'VARCHAR(255)',
    htmlType: typeMap.html[f.type] || 'text',
    capitalized: StringHelper.capitalize(f.name),
  }));

  // Build example JSON for README curl examples
  const exampleJson =
    '{ ' +
    enrichedFields.map((f) => `"${f.name}": ${exampleValues[f.type] || '"example"'}`).join(', ') +
    ' }';

  const variables = {
    name: Name,
    nameLower,
    nameUpper,
    namePlural,
    namePluralCap,
    fields: enrichedFields,
    exampleJson,
    timestamp: new Date().toISOString().split('T')[0],
  };

  console.log('\n[2/9] StringHelper - Name transformations');
  console.log(`      PascalCase : ${Name}`);
  console.log(`      lowercase  : ${nameLower}`);
  console.log(`      UPPERCASE  : ${nameUpper}`);
  console.log(`      plural     : ${namePlural}`);
  console.log(`      fields     : ${enrichedFields.map((f) => `${f.name}:${f.type}`).join(', ')}`);

  // -------------------------------------------------------
  // 3. PLUGIN SYSTEM — Register custom SQL template engine
  //    Uses <<variable>> syntax, distinct from EJS/HBS/Pug
  // -------------------------------------------------------
  TemplateBuilder.registerEngine('sql', {
    render: async (source, data) => {
      let result = source;
      // Replace <<key>> tokens with simple values
      for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'string') {
          result = StringHelper.replace(result, `<<${key}>>`, value);
        }
      }
      // Handle <<#fields>> ... <</fields>> iteration blocks
      result = result.replace(/<<#fields>>([\s\S]*?)<<\/fields>>/g, (_, block) => {
        return data.fields
          .map((f) => {
            let line = block.trim();
            line = StringHelper.replace(line, '<<field.name>>', f.name);
            line = StringHelper.replace(line, '<<field.sqlType>>', f.sqlType);
            return '  ' + line;
          })
          .join(',\n');
      });
      return result;
    },
    renderFile: async (file, data) => {
      const source = FileHelper.readFileToString(file);
      const engine = TemplateBuilder.getEngine('sql');
      return engine.render(source, data);
    },
  });

  const allEngines = TemplateBuilder.getRegisteredEngines();
  console.log('\n[3/9] Plugin System - Registered custom "sql" engine');
  console.log(`      Engines: [${allEngines.join(', ')}]`);

  // -------------------------------------------------------
  // 4. SCAFFOLD — Generate TypeScript CRUD files from EJS
  // -------------------------------------------------------
  const now = new Date();
  const timeStamp = [
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('');
  const outputDir = `./generated/${nameLower}-${timeStamp}`;

  console.log('\n[4/9] Scaffold - Generating CRUD module with EJS...');

  const scaffoldResult = await Scaffold.from({
    engine: 'EJS',
    templateDir: './example/full-demo/templates',
    outputDir,
    variables,
    structure: [
      { template: 'model.ejs', output: `${nameLower}.model.ts` },
      { template: 'store.ejs', output: `${nameLower}.store.ts` },
      { template: 'repository.ejs', output: `${nameLower}.repository.ts` },
      { template: 'service.ejs', output: `${nameLower}.service.ts` },
      { template: 'controller.ejs', output: `${nameLower}.controller.ts` },
      { template: 'routes.ejs', output: `${nameLower}.routes.ts` },
      { template: 'validation.ejs', output: `${nameLower}.validation.ts` },
      { template: 'test.ejs', output: `${nameLower}.test.ts` },
      { template: 'server.ejs', output: 'server.ts' },
    ],
  });

  for (const file of scaffoldResult.files) {
    console.log(`      + ${file}`);
  }

  // -------------------------------------------------------
  // 5. PIPELINE — README (Handlebars), API docs (Handlebars),
  //    Admin page (Pug), all with chained transforms
  // -------------------------------------------------------
  console.log('\n[5/9] Pipeline - Generating README, docs & admin page...');

  // README: Handlebars template -> add timestamp footer -> write
  await new Pipeline()
    .fromTemplate('example/full-demo/templates/readme.handlebars', variables)
    .transform((content) => content + `\n---\n\n*Generated by SCG on ${variables.timestamp}*\n`)
    .writeTo(`${outputDir}/README.md`);
  console.log(`      + ${outputDir}/README.md  (Handlebars + footer transform)`);

  // API docs: Handlebars template -> add generated header -> write
  await new Pipeline()
    .fromTemplate('example/full-demo/templates/docs.handlebars', variables)
    .transform((content) => `<!-- Generated by SCG on ${variables.timestamp} -->\n\n${content}`)
    .writeTo(`${outputDir}/${nameLower}.api.md`);
  console.log(`      + ${outputDir}/${nameLower}.api.md  (Handlebars + header transform)`);

  // Admin page: Pug template -> inject CSS framework -> write
  await new Pipeline()
    .fromTemplate('example/full-demo/templates/admin.pug', variables)
    .transform((html) =>
      StringHelper.replace(
        html,
        '</head>',
        '  <link rel="stylesheet" href="https://cdn.simplecss.org/simple.min.css">\n</head>'
      )
    )
    .writeTo(`${outputDir}/${nameLower}.admin.html`);
  console.log(`      + ${outputDir}/${nameLower}.admin.html  (Pug + CSS injection transform)`);

  // -------------------------------------------------------
  // 6. CUSTOM ENGINE — Generate SQL migration
  // -------------------------------------------------------
  console.log('\n[6/9] TemplateBuilder (custom "sql" engine) - SQL migration...');

  const sqlBuilder = new TemplateBuilder('sql');
  const migrationSql = await sqlBuilder.render(
    [
      '-- Migration: Create <<namePlural>> table',
      '-- Generated by SCG on <<timestamp>>',
      '',
      'CREATE TABLE <<namePlural>> (',
      '  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),',
      '<<#fields>><<field.name>> <<field.sqlType>> NOT NULL<</fields>>,',
      '  created_at TIMESTAMP DEFAULT NOW(),',
      '  updated_at TIMESTAMP DEFAULT NOW()',
      ');',
      '',
      'CREATE INDEX idx_<<namePlural>>_id ON <<namePlural>> (id);',
      '',
    ].join('\n'),
    variables
  );

  await FileHelper.writeFileAsync(`${outputDir}/${nameLower}.migration.sql`, migrationSql);
  console.log(`      + ${outputDir}/${nameLower}.migration.sql`);

  // -------------------------------------------------------
  // 7. FILE HELPER — package.json, tsconfig.json, barrel export
  // -------------------------------------------------------
  console.log('\n[7/9] FileHelper - Creating project config & barrel export...');

  // package.json
  const packageJson = {
    name: `${nameLower}-api`,
    version: '1.0.0',
    private: true,
    type: 'module',
    scripts: {
      dev: 'tsx server.ts',
      build: 'tsc',
      start: 'node dist/server.js',
      test: 'vitest run',
    },
    dependencies: {
      express: '^4.21.0',
      zod: '^3.23.0',
    },
    devDependencies: {
      '@types/express': '^5.0.0',
      '@types/node': '^22.0.0',
      tsx: '^4.19.0',
      typescript: '^5.6.0',
      vitest: '^2.1.0',
    },
  };

  await FileHelper.writeFileAsync(
    `${outputDir}/package.json`,
    JSON.stringify(packageJson, null, 2) + '\n'
  );
  console.log(`      + ${outputDir}/package.json`);

  // tsconfig.json
  const tsconfigJson = {
    compilerOptions: {
      target: 'ES2022',
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      esModuleInterop: true,
      strict: true,
      outDir: 'dist',
      declaration: true,
      skipLibCheck: true,
    },
    include: ['*.ts'],
  };

  await FileHelper.writeFileAsync(
    `${outputDir}/tsconfig.json`,
    JSON.stringify(tsconfigJson, null, 2) + '\n'
  );
  console.log(`      + ${outputDir}/tsconfig.json`);

  // vitest.config.ts
  const vitestConfig = [
    `import { defineConfig } from 'vitest/config';`,
    ``,
    `export default defineConfig({`,
    `  test: {`,
    `    include: ['*.test.ts'],`,
    `  },`,
    `});`,
    ``,
  ].join('\n');

  await FileHelper.writeFileAsync(`${outputDir}/vitest.config.ts`, vitestConfig);
  console.log(`      + ${outputDir}/vitest.config.ts`);

  // Barrel export (index.ts)
  const barrel = [
    `// ${Name} module - Generated by SCG`,
    `export type { ${Name}, Create${Name}Input, Update${Name}Input } from './${nameLower}.model';`,
    `export { ${Name}Repository } from './${nameLower}.repository';`,
    `export { ${Name}Service } from './${nameLower}.service';`,
    `export { ${nameLower}Router } from './${nameLower}.routes';`,
    `export { create${Name}Schema, update${Name}Schema } from './${nameLower}.validation';`,
    '',
  ].join('\n');

  await FileHelper.writeFileAsync(`${outputDir}/index.ts`, barrel);
  console.log(`      + ${outputDir}/index.ts`);

  // run.sh
  const runScript = [
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    '',
    'DIR="$(cd "$(dirname "$0")" && pwd)"',
    'cd "$DIR"',
    'PORT="${1:-3000}"',
    '',
    'echo ""',
    `echo "  ${Name} API — Install, Test & Run"`,
    'echo "  ─────────────────────────────────────────────"',
    'echo ""',
    'echo "  [1/3] Installing dependencies..."',
    'pnpm install --silent',
    '',
    'echo "  [2/3] Running tests..."',
    'pnpm test',
    '',
    'echo ""',
    'echo "  [3/3] Starting server on http://localhost:$PORT ..."',
    'echo "        Admin UI: http://localhost:$PORT/admin"',
    'echo "        Press Ctrl+C to stop"',
    'echo ""',
    '',
    'open "http://localhost:$PORT/admin"',
    'pnpm run dev',
    '',
  ].join('\n');

  await FileHelper.writeFileAsync(`${outputDir}/run.sh`, runScript);
  await CommandHelper.run('.', `chmod +x ${outputDir}/run.sh`);
  console.log(`      + ${outputDir}/run.sh`);

  // -------------------------------------------------------
  // 8. COMMAND HELPER — Show generated file listing
  // -------------------------------------------------------
  console.log('\n[8/9] CommandHelper - Generated files:');

  const listing = await CommandHelper.run('.', `ls -1 ${outputDir}`);
  const fileList = listing.trim().split('\n').filter(Boolean);
  for (const f of fileList) {
    console.log(`      ${f.trim()}`);
  }

  // -------------------------------------------------------
  // Summary
  // -------------------------------------------------------
  const totalFiles = fileList.length;
  const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
  console.log('\n' + DIVIDER);
  console.log(`  Done! Generated ${totalFiles} files in ${outputDir}/ (${elapsed}s)\n`);
  console.log('  Engines used:');
  console.log('    EJS          -> 9 TypeScript files (model, store, repo, service, ctrl, routes, validation, test, server)');
  console.log('    Handlebars   -> 2 files (README.md, API docs)');
  console.log('    Pug          -> 1 HTML file (admin page with interactive JS)');
  console.log('    sql (custom) -> 1 SQL file (migration)');
  console.log('    FileHelper   -> 5 files (package.json, tsconfig.json, vitest.config.ts, barrel index.ts, run.sh)\n');
  console.log('  To run the generated project:\n');
  console.log(`    ${outputDir}/run.sh`);
  console.log(DIVIDER);

  // -------------------------------------------------------
  // 9. WATCHER — Optional --watch mode
  // -------------------------------------------------------
  if (watchMode) {
    console.log('\n[9/9] Watcher - Watching templates for changes...');
    console.log('      Edit files in example/full-demo/templates/ to trigger rebuild');
    console.log('      Press Ctrl+C to stop\n');

    const watcher = new Watcher({
      templateDir: './example/full-demo/templates',
      outputDir,
      engine: 'EJS',
      variables,
      onRebuild: (file) => console.log(`      Rebuilt: ${file}`),
      onError: (err, file) => console.error(`      Error in ${file}: ${err.message}`),
    });
    watcher.start();
  } else {
    console.log('\n  Tip: Add --watch to re-generate on template changes\n');
  }
}

main().catch(console.error);
