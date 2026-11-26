import fs from 'fs';
import path from 'path';
import { TemplateBuilder } from './template_builder.js';
import { StringHelper } from './string_helper.js';
import { loadManifest, type GeneratorManifest } from './manifest.js';

/** Defines a single file in a scaffold structure. */
export interface ScaffoldFile {
  /** Relative path to the template file (within `templateDir`). */
  template: string;
  /** Output filename pattern (supports `{{variable}}` and `{{variable:modifier}}`). */
  output: string;
  /**
   * Generate this file only when the variable is truthy (`"withTest"`)
   * or falsy (`"!withTest"`).
   */
  when?: string;
}

/** Configuration options for scaffold generation. */
export interface ScaffoldOptions {
  /** Template engine to use (e.g., `'EJS'`, `'HANDLEBARS'`, `'PUG'`). */
  engine: string;
  /** Base directory containing the template files. */
  templateDir: string;
  /** Output directory pattern (supports `{{variable}}` interpolation). */
  outputDir: string;
  /**
   * Variables for template rendering and path interpolation.
   * Any value can be passed to templates; only strings, numbers and booleans
   * can be interpolated into paths.
   */
  variables: Record<string, unknown>;
  /** List of files to generate. */
  structure: ScaffoldFile[];
  /** If `true`, returns the file list without writing files. */
  dryRun?: boolean;
  /**
   * If `true`, existing files whose content differs from the rendered output
   * are overwritten. Defaults to `false`: such files are left untouched and
   * reported in {@link ScaffoldResult.skipped}.
   */
  overwrite?: boolean;
}

/** Result of a scaffold generation operation. */
export interface ScaffoldResult {
  /** File paths that were written (or would be written in dry-run mode). */
  files: string[];
  /**
   * Existing files left untouched because their content differs from the
   * rendered output and `overwrite` was not set.
   */
  skipped: string[];
  /** Existing files whose content already matches the rendered output. */
  unchanged: string[];
  /** Whether this was a dry-run execution. */
  dryRun: boolean;
}

/**
 * Generates directory structures from a manifest configuration.
 *
 * Reads template files, renders them with the specified engine, and writes
 * the output to a directory structure with variable-interpolated paths.
 * Existing files are never overwritten unless `overwrite: true` is passed.
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
 * console.log(result.files);   // Files written
 * console.log(result.skipped); // Existing files that were not overwritten
 * ```
 */
export class Scaffold {
  /**
   * Generates files from a scaffold manifest.
   *
   * @param options - The scaffold configuration
   * @returns A promise resolving to a {@link ScaffoldResult}
   * @throws If a variable used in a path is not a primitive, contains a `..`
   *   segment or is an absolute path, or if an output path would land outside
   *   the output directory
   */
  static async from(options: ScaffoldOptions): Promise<ScaffoldResult> {
    const {
      engine,
      templateDir,
      outputDir,
      variables,
      structure,
      dryRun = false,
      overwrite = false
    } = options;

    const builder = new TemplateBuilder(engine);
    const interpolatedOutputDir = resolvePathVariables(outputDir, variables);
    const resolvedOutputDir = path.resolve(interpolatedOutputDir);
    const result: ScaffoldResult = {
      files: [],
      skipped: [],
      unchanged: [],
      dryRun
    };

    // Render everything first so a template error never leaves a half-written scaffold
    const planned: { outputPath: string; content: string }[] = [];
    for (const file of structure) {
      const templatePath = path.join(templateDir, file.template);
      const outputFileName = resolvePathVariables(file.output, variables);
      const outputPath = path.join(interpolatedOutputDir, outputFileName);
      assertInside(resolvedOutputDir, path.resolve(outputPath), file.output);

      const content = await builder.renderFile(templatePath, variables, {});
      planned.push({ outputPath, content });
    }

    for (const { outputPath, content } of planned) {
      if (fs.existsSync(outputPath)) {
        const existing = fs.readFileSync(outputPath, 'utf8');
        if (existing === content) {
          result.unchanged.push(outputPath);
          continue;
        }
        if (!overwrite) {
          result.skipped.push(outputPath);
          continue;
        }
      }

      if (!dryRun) {
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.writeFileSync(outputPath, content, 'utf8');
      }
      result.files.push(outputPath);
    }

    return result;
  }

  /**
   * Reads a scaffold manifest (JSON) from disk.
   *
   * A relative `templateDir` is resolved against the manifest's own folder, so
   * a manifest works no matter which directory the command is run from.
   * `outputDir` stays relative to the current working directory, which is
   * where the user wants the files.
   *
   * @param manifestPath - Path to the manifest file (e.g. `scaffold.json`)
   * @returns The parsed manifest options
   * @throws If the file does not exist, is not valid JSON, or fails validation
   *
   * @example
   * ```typescript
   * const manifest = Scaffold.loadManifest('templates/react-component/scaffold.json');
   * await Scaffold.from({ ...manifest, variables: { ...manifest.variables, name: 'Button' } });
   * ```
   */
  static loadManifest(manifestPath: string): GeneratorManifest {
    return loadManifest(manifestPath);
  }

}

/** @internal Replaces `{{key}}` tokens in a path with safe variable values. */
function resolvePathVariables(
  template: string,
  variables: Record<string, unknown>
): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    const token = `{{${key}}}`;
    if (!result.includes(token)) continue;

    if (
      typeof value !== 'string' &&
      typeof value !== 'number' &&
      typeof value !== 'boolean'
    ) {
      throw new Error(
        `Variable "${key}" is used in a path but is not a string, number or boolean`
      );
    }
    const text = String(value);
    if (path.isAbsolute(text) || text.split(/[\\/]/).includes('..')) {
      throw new Error(
        `Variable "${key}" cannot be used in a path: "${text}" is absolute or contains ".."`
      );
    }
    result = StringHelper.replace(result, token, text);
  }
  return result;
}

/** @internal Throws if `target` is not inside `root`. */
function assertInside(root: string, target: string, pattern: string): void {
  const relative = path.relative(root, target);
  if (
    relative === '' ||
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error(
      `Output "${pattern}" resolves outside the output directory (${target})`
    );
  }
}
