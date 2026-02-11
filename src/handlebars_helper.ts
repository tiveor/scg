import Handlebars from 'handlebars';
import { FileHelper } from './file_helper.js';

export class HandlebarsHelper {
  static render(
    source: string,
    data: Record<string, unknown>,
    options?: CompileOptions
  ): Promise<string> {
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

  static renderFile(
    fileName: string,
    data: Record<string, unknown>,
    options?: CompileOptions
  ): Promise<string> {
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
