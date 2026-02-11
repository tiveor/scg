import fs from 'fs';
import path from 'path';
import { TemplateBuilder } from './template_builder.js';
import { StringHelper } from './string_helper.js';

/** Defines a single file in a scaffold structure. */
export interface ScaffoldFile {
  /** Relative path to the template file (within `templateDir`). */
  template: string;
  /** Output filename pattern (supports `{{variable}}` interpolation). */
  output: string;
}

/** Configuration options for scaffold generation. */
export interface ScaffoldOptions {
  /** Template engine to use (e.g., `'EJS'`, `'HANDLEBARS'`, `'PUG'`). */
  engine: string;
  /** Base directory containing the template files. */
  templateDir: string;
  /** Output directory pattern (supports `{{variable}}` interpolation). */
  outputDir: string;
  /** Variables for template rendering and path interpolation. */
  variables: Record<string, string>;
  /** List of files to generate. */
  structure: ScaffoldFile[];
  /** If `true`, returns the file list without writing files. */
  dryRun?: boolean;
}

/** Result of a scaffold generation operation. */
export interface ScaffoldResult {
  /** List of file paths that were created (or would be created in dry-run mode). */
  files: string[];
  /** Whether this was a dry-run execution. */
  dryRun: boolean;
}

/**
 * Generates directory structures from a manifest configuration.
 *
 * Reads template files, renders them with the specified engine, and writes
 * the output to a directory structure with variable-interpolated paths.
 *
 * @example
 * ```typescript
 * const result = await Scaffold.from({
 *   engine: 'EJS',
 *   templateDir: './templates/react-component',
 *   outputDir: './src/components/{{name}}',
 *   variables: { name: 'UserProfile', style: 'module' },
 *   structure: [
 *     { template: 'component.ejs', output: '{{name}}.tsx' },
 *     { template: 'styles.ejs', output: '{{name}}.module.css' },
 *     { template: 'test.ejs', output: '{{name}}.test.tsx' },
 *   ]
 * });
 *
 * console.log(result.files); // List of created file paths
 * ```
 */
export class Scaffold {
  /**
   * Generates files from a scaffold manifest.
   *
   * @param options - The scaffold configuration
   * @returns A promise resolving to a {@link ScaffoldResult} with the list of created files
   */
  static async from(options: ScaffoldOptions): Promise<ScaffoldResult> {
    const {
      engine,
      templateDir,
      outputDir,
      variables,
      structure,
      dryRun = false
    } = options;

    const builder = new TemplateBuilder(engine);
    const resolvedOutputDir = resolveVariables(outputDir, variables);
    const createdFiles: string[] = [];

    for (const file of structure) {
      const templatePath = path.join(templateDir, file.template);
      const outputFileName = resolveVariables(file.output, variables);
      const outputPath = path.join(resolvedOutputDir, outputFileName);

      if (dryRun) {
        createdFiles.push(outputPath);
        continue;
      }

      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const content = await builder.renderFile(
        templatePath,
        variables as unknown as Record<string, unknown>,
        {}
      );
      fs.writeFileSync(outputPath, content, 'utf8');
      createdFiles.push(outputPath);
    }

    return { files: createdFiles, dryRun };
  }
}

/** @internal Replaces `{{key}}` tokens in a string with variable values. */
function resolveVariables(
  template: string,
  variables: Record<string, string>
): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = StringHelper.replace(result, `{{${key}}}`, value);
  }
  return result;
}
