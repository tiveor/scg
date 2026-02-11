import pug from 'pug';

export class PugHelper {
  static render(
    source: string,
    data: Record<string, unknown>,
    options?: pug.Options
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        const template = pug.compile(source, options);
        resolve(template(data));
      } catch (error) {
        reject(error);
      }
    });
  }

  static renderFile(
    fileName: string,
    data: Record<string, unknown>,
    options?: pug.Options
  ): Promise<string> {
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
