const ejs = require("ejs");

//https://ejs.co/
//https://github.com/mde/ejs
class EjsHelper {
  static render(source, data, options) {
    return new Promise((resolve, reject) => {
      try {
        const template = ejs.render(source, data, options);
        resolve(template);
      } catch (error) {
        reject(error);
      }
    });
  }

  static renderFile(fileName, data, options) {
    return new Promise((resolve, reject) => {
      ejs.renderFile(fileName, data, options, function (err, str) {
        if (err) {
          reject(err)
          return;
        }

        resolve(str);
      });
    });
  }
}
exports.EjsHelper = EjsHelper;