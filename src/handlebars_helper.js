const Handlebars = require("handlebars");
const { FileHelper } = require("./file_helper");

//https://handlebarsjs.com/
//https://github.com/handlebars-lang/handlebars.js
class HandlebarsHelper {
  static render(source, data, options) {
    return new Promise((resolve, reject) => {
      try {
        const template = Handlebars.compile(source, options);
        const res = template(data);
        resolve(res);
      } catch (error) {
        reject(error);
      }
    });
  }

  static renderFile(fileName, data, options) {
    return new Promise((resolve, reject) => {
      try {
        const source = FileHelper.readFileToString(fileName);
        const template = Handlebars.compile(source, options);
        const res = template(data);
        resolve(res);
      } catch (error) {
        reject(error);
      }
    });
  }
}
exports.HandlebarsHelper = HandlebarsHelper;