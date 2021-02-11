const pug = require('pug');

//https://github.com/pugjs/pug
//https://pugjs.org/api/getting-started.html
class PugHelper {
  static render(source, data, options) {
    return new Promise((resolve, reject) => {
      try {
        const template = pug.compile(source, options);
        resolve(template(data));
      } catch (error) {
        reject(error);
      }
    });
  }

  static renderFile(fileName, data, options) {
    return new Promise((resolve, reject) => {
      try {
        const template = pug.compileFile(fileName, options);
        resolve(template(data));
      } catch (error) {
        reject(error);
      }
    });
  }
}
exports.PugHelper = PugHelper;