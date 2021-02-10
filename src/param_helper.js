class ParamHelper {
  static addCustomParam(customParam) {
    process.argv.push(customParam);
  }

  static getCommandByIndex(index) {
    return process.argv.length > index ? process.argv[index] : "";
  }

  static getParams() {
    const argv = (() => {
      let paramsObj = {};
      process.argv.slice(2).map((element) => {
        const matches = element.match('--([a-zA-Z0-9]+)=(.*)');
        if (matches) {
          paramsObj[matches[1]] = matches[2]
            .replace(/^['"]/, '').replace(/['"]$/, '');
        }
      });
      return paramsObj;
    })();
    return argv;
  }
}
exports.ParamHelper = ParamHelper;