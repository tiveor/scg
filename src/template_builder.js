const { HandlebarsHelper } = require("./handlebars_helper");
const { EjsHelper } = require("./ejs_helper");
const { PugHelper } = require("./pug_helper");


class TemplateBuilder {

  constructor(templateHandler) {
    this.templateHandler = templateHandler;
  }

  render(source, data, options) {
    switch (this.templateHandler) {
      case TEMPLATE_HANDLERS.HANDLEBARS:
        return HandlebarsHelper.render(source, data, options);
      case TEMPLATE_HANDLERS.EJS:
        return EjsHelper.render(source, data, options);
      case TEMPLATE_HANDLERS.PUG:
        return PugHelper.render(fileName, data, options);
      default:
        return HandlebarsHelper.render(source, data, options);
    }
  }

  renderFile(fileName, data, options) {
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

const TEMPLATE_HANDLERS = {
  HANDLEBARS: "HANDLEBARS",
  EJS: "EJS",
  PUG: "PUG",
}

exports.TEMPLATE_HANDLERS = TEMPLATE_HANDLERS;
exports.TemplateBuilder = TemplateBuilder;