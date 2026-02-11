import { HandlebarsHelper } from './handlebars_helper.js';
import { EjsHelper } from './ejs_helper.js';
import { PugHelper } from './pug_helper.js';
import { TEMPLATE_HANDLERS, type TemplateHandler } from './template_handlers.js';

/**
 * Interface that custom template engines must implement to be registered
 * with {@link TemplateBuilder.registerEngine}.
 */
export interface TemplateEngine {
  /** Renders a template from a source string with the given data. */
  render: (
    source: string,
    data: Record<string, unknown>,
    options?: Record<string, unknown>
  ) => Promise<string>;
  /** Renders a template from a file path with the given data. */
  renderFile: (
    fileName: string,
    data: Record<string, unknown>,
    options?: Record<string, unknown>
  ) => Promise<string>;
}

const builtInEngines: Record<string, TemplateEngine> = {
  [TEMPLATE_HANDLERS.HANDLEBARS]: HandlebarsHelper,
  [TEMPLATE_HANDLERS.EJS]: EjsHelper,
  [TEMPLATE_HANDLERS.PUG]: PugHelper
};

const customEngines: Record<string, TemplateEngine> = {};

/**
 * Unified interface to render templates with EJS, Handlebars, Pug, or any custom engine.
 *
 * Supports a plugin system for registering custom template engines at runtime.
 *
 * @example
 * ```typescript
 * // Built-in engines
 * const builder = new TemplateBuilder(TEMPLATE_HANDLERS.EJS);
 * const html = await builder.render('Hello <%= name %>', { name: 'World' });
 *
 * // Custom engine
 * TemplateBuilder.registerEngine('nunjucks', {
 *   render: async (source, data) => nunjucks.renderString(source, data),
 *   renderFile: async (file, data) => nunjucks.render(file, data),
 * });
 * const nj = new TemplateBuilder('nunjucks');
 * ```
 */
export class TemplateBuilder {
  private templateHandler: string;

  /**
   * Creates a new TemplateBuilder for the specified engine.
   *
   * @param templateHandler - The engine name (e.g., `'EJS'`, `'HANDLEBARS'`, `'PUG'`, or a custom name)
   */
  constructor(templateHandler: TemplateHandler | string) {
    this.templateHandler = templateHandler;
  }

  /**
   * Registers a custom template engine that can be used with `new TemplateBuilder(name)`.
   *
   * @param name - A unique name for the engine
   * @param engine - An object implementing the {@link TemplateEngine} interface
   * @throws If `name` is empty or `engine` doesn't implement `render()` and `renderFile()`
   *
   * @example
   * ```typescript
   * TemplateBuilder.registerEngine('nunjucks', {
   *   render: async (source, data) => nunjucks.renderString(source, data),
   *   renderFile: async (file, data) => nunjucks.render(file, data),
   * });
   * ```
   */
  static registerEngine(name: string, engine: TemplateEngine): void {
    if (!name || typeof name !== 'string') {
      throw new Error('engine name must be a non-empty string');
    }
    if (!engine || typeof engine.render !== 'function' || typeof engine.renderFile !== 'function') {
      throw new Error('engine must implement render() and renderFile() methods');
    }
    customEngines[name] = engine;
  }

  /**
   * Retrieves a registered engine by name (custom engines take precedence over built-in).
   *
   * @param name - The engine name to look up
   * @returns The engine implementation, or `undefined` if not found
   */
  static getEngine(name: string): TemplateEngine | undefined {
    return customEngines[name] ?? builtInEngines[name];
  }

  /**
   * Returns an array of all registered engine names (built-in + custom).
   *
   * @returns Array of engine name strings
   *
   * @example
   * ```typescript
   * TemplateBuilder.getRegisteredEngines();
   * // => ['HANDLEBARS', 'EJS', 'PUG']
   * ```
   */
  static getRegisteredEngines(): string[] {
    return [
      ...Object.keys(builtInEngines),
      ...Object.keys(customEngines)
    ];
  }

  private resolveEngine(): TemplateEngine {
    const engine =
      customEngines[this.templateHandler] ??
      builtInEngines[this.templateHandler] ??
      builtInEngines[TEMPLATE_HANDLERS.HANDLEBARS];
    return engine;
  }

  /**
   * Renders a template from a source string.
   *
   * @param source - The template source string
   * @param data - Data object to pass to the template
   * @param options - Optional engine-specific options
   * @returns A promise resolving to the rendered string
   */
  render(
    source: string,
    data: Record<string, unknown>,
    options?: Record<string, unknown>
  ): Promise<string> {
    return this.resolveEngine().render(source, data, options);
  }

  /**
   * Renders a template from a file path.
   *
   * @param fileName - Path to the template file
   * @param data - Data object to pass to the template
   * @param options - Optional engine-specific options
   * @returns A promise resolving to the rendered string
   */
  renderFile(
    fileName: string,
    data: Record<string, unknown>,
    options?: Record<string, unknown>
  ): Promise<string> {
    return this.resolveEngine().renderFile(fileName, data, options);
  }
}
