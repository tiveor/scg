import { HandlebarsHelper } from './handlebars_helper.js';
import { EjsHelper } from './ejs_helper.js';
import { PugHelper } from './pug_helper.js';
import { TEMPLATE_HANDLERS, type TemplateHandler } from './template_handlers.js';

export class TemplateBuilder {
  private templateHandler: string;

  constructor(templateHandler: TemplateHandler | string) {
    this.templateHandler = templateHandler;
  }

  render(
    source: string,
    data: Record<string, unknown>,
    options?: Record<string, unknown>
  ): Promise<string> {
    switch (this.templateHandler) {
      case TEMPLATE_HANDLERS.HANDLEBARS:
        return HandlebarsHelper.render(source, data, options);
      case TEMPLATE_HANDLERS.EJS:
        return EjsHelper.render(source, data, options);
      case TEMPLATE_HANDLERS.PUG:
        return PugHelper.render(source, data, options);
      default:
        return HandlebarsHelper.render(source, data, options);
    }
  }

  renderFile(
    fileName: string,
    data: Record<string, unknown>,
    options?: Record<string, unknown>
  ): Promise<string> {
    switch (this.templateHandler) {
      case TEMPLATE_HANDLERS.HANDLEBARS:
        return HandlebarsHelper.renderFile(fileName, data, options);
      case TEMPLATE_HANDLERS.EJS:
        return EjsHelper.renderFile(fileName, data, options);
      case TEMPLATE_HANDLERS.PUG:
        return PugHelper.renderFile(fileName, data, options);
      default:
        return HandlebarsHelper.renderFile(fileName, data, options);
    }
  }
}
