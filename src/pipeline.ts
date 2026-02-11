import fs from 'fs';
import path from 'path';
import { TemplateBuilder } from './template_builder.js';
import { type TemplateHandler } from './template_handlers.js';

/** A function that transforms a string, optionally returning a promise. */
export type TransformFn = (content: string) => string | Promise<string>;

/**
 * Chainable pipeline for composing template rendering and string transformations.
 *
 * Supports multiple input sources (string, file, template) and sequential
 * transforms before writing the result to a file or returning it.
 *
 * @example
 * ```typescript
 * const result = await new Pipeline()
 *   .fromTemplate('component.ejs', { name: 'Button' }, 'EJS')
 *   .transform((content) => content.toUpperCase())
 *   .writeTo('src/components/Button.tsx');
 * ```
 */
export class Pipeline {
  private content: string | null = null;
  private contentPromise: Promise<string> | null = null;
  private transforms: TransformFn[] = [];

  /**
   * Sets the pipeline content from a raw string.
   *
   * @param source - The string content
   * @returns This pipeline instance for chaining
   */
  fromString(source: string): Pipeline {
    this.content = source;
    this.contentPromise = null;
    return this;
  }

  /**
   * Sets the pipeline content by reading a file synchronously.
   *
   * @param filePath - Path to the file to read
   * @returns This pipeline instance for chaining
   */
  fromFile(filePath: string): Pipeline {
    this.content = fs.readFileSync(filePath, 'utf8');
    this.contentPromise = null;
    return this;
  }

  /**
   * Sets the pipeline content by rendering a template file.
   * If no engine is specified, it is auto-detected from the file extension.
   *
   * @param templatePath - Path to the template file
   * @param data - Data to pass to the template
   * @param engine - Template engine name (auto-detected if omitted)
   * @param options - Optional engine-specific options
   * @returns This pipeline instance for chaining
   */
  fromTemplate(
    templatePath: string,
    data: Record<string, unknown>,
    engine?: TemplateHandler | string,
    options?: Record<string, unknown>
  ): Pipeline {
    const ext = engine ?? extToEngine(templatePath);
    const builder = new TemplateBuilder(ext);
    this.contentPromise = builder.renderFile(templatePath, data, options);
    this.content = null;
    return this;
  }

  /**
   * Sets the pipeline content by rendering a template from a source string.
   *
   * @param source - The template source string
   * @param data - Data to pass to the template
   * @param engine - The template engine name
   * @param options - Optional engine-specific options
   * @returns This pipeline instance for chaining
   */
  fromTemplateString(
    source: string,
    data: Record<string, unknown>,
    engine: TemplateHandler | string,
    options?: Record<string, unknown>
  ): Pipeline {
    const builder = new TemplateBuilder(engine);
    this.contentPromise = builder.render(source, data, options);
    this.content = null;
    return this;
  }

  /**
   * Adds a transformation function to the pipeline.
   * Transforms are executed sequentially in the order they are added.
   *
   * @param fn - A sync or async function that receives and returns a string
   * @returns This pipeline instance for chaining
   */
  transform(fn: TransformFn): Pipeline {
    this.transforms.push(fn);
    return this;
  }

  /**
   * Executes the pipeline: resolves the content and applies all transforms.
   *
   * @returns A promise resolving to the final transformed string
   * @throws If no content source has been set
   */
  async execute(): Promise<string> {
    let result: string;

    if (this.contentPromise) {
      result = await this.contentPromise;
    } else if (this.content !== null) {
      result = this.content;
    } else {
      throw new Error(
        'Pipeline has no content. Call fromString(), fromFile(), or fromTemplate() first.'
      );
    }

    for (const fn of this.transforms) {
      result = await fn(result);
    }

    return result;
  }

  /**
   * Executes the pipeline and writes the result to a file.
   * Creates parent directories automatically if they don't exist.
   *
   * @param filePath - Path to the output file
   * @returns A promise resolving to the written content
   */
  async writeTo(filePath: string): Promise<string> {
    const result = await this.execute();
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, result, 'utf8');
    return result;
  }
}

/** @internal Maps file extensions to engine names. */
function extToEngine(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.ejs':
      return 'EJS';
    case '.hbs':
    case '.handlebars':
      return 'HANDLEBARS';
    case '.pug':
    case '.jade':
      return 'PUG';
    default:
      return 'HANDLEBARS';
  }
}
