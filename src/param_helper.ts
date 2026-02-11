export class ParamHelper {
  static addCustomParam(customParam: string): void {
    process.argv.push(customParam);
  }

  static getCommandByIndex(index: number): string {
    return process.argv.length > index ? process.argv[index] : '';
  }

  static getParams(): Record<string, string> {
    const paramsObj: Record<string, string> = {};
    process.argv.slice(2).forEach((element) => {
      const matches = element.match('--([a-zA-Z0-9]+)=(.*)');
      if (matches) {
        paramsObj[matches[1]] = matches[2]
          .replace(/^['"]/, '')
          .replace(/['"]$/, '');
      }
    });
    return paramsObj;
  }
}
