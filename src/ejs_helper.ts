import ejs from 'ejs';

export class EjsHelper {
  static render(
    source: string,
    data: Record<string, unknown>,
    options?: ejs.Options
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        const template = ejs.render(source, data, options);
        resolve(template);
      } catch (error) {
        reject(error);
      }
    });
  }

  static renderFile(
    fileName: string,
    data: Record<string, unknown>,
    options?: ejs.Options
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      ejs.renderFile(fileName, data, options ?? {}, (err, str) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(str!);
      });
    });
  }
}
