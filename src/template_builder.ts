import { HandlebarsHelper } from './handlebars_helper.js';
import { EjsHelper } from './ejs_helper.js';
import { PugHelper } from './pug_helper.js';
import { TEMPLATE_HANDLERS, type TemplateHandler } from './template_handlers.js';

export interface TemplateEngine {
  render: (
    source: string,
    data: Record<string, unknown>,
    options?: Record<string, unknown>
  ) => Promise<string>;
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

export class TemplateBuilder {
  private templateHandler: string;

  constructor(templateHandler: TemplateHandler | string) {
    this.templateHandler = templateHandler;
  }

  static registerEngine(name: string, engine: TemplateEngine): void {
    if (!name || typeof name !== 'string') {
      throw new Error('engine name must be a non-empty string');
    }
    if (!engine || typeof engine.render !== 'function' || typeof engine.renderFile !== 'function') {
      throw new Error('engine must implement render() and renderFile() methods');
    }
    customEngines[name] = engine;
  }

  static getEngine(name: string): TemplateEngine | undefined {
    return customEngines[name] ?? builtInEngines[name];
  }

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

  render(
    source: string,
    data: Record<string, unknown>,
    options?: Record<string, unknown>
  ): Promise<string> {
    return this.resolveEngine().render(source, data, options);
  }

  renderFile(
    fileName: string,
    data: Record<string, unknown>,
    options?: Record<string, unknown>
  ): Promise<string> {
    return this.resolveEngine().renderFile(fileName, data, options);
  }
}
