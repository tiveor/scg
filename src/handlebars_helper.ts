import Handlebars from 'handlebars';
import { FileHelper } from './file_helper.js';
import { Casing } from './casing.js';

/**
 * @internal Case helpers for one render ({{pascal name}}). Handlebars resolves
 * helpers before data, so a helper is left out when the data has a key with the
 * same name; otherwise `{{title}}` would stop printing the `title` variable.
 */
function casingHelpers(
  data: Record<string, unknown>
): Record<string, Handlebars.HelperDelegate> {
  const helpers: Record<string, Handlebars.HelperDelegate> = {};
  for (const [name, fn] of Object.entries(Casing)) {
    if (data && name in data) continue;
    helpers[name] = (value: unknown) =>
      typeof value === 'string' || typeof value === 'number'
        ? fn(String(value))
        : '';
  }
  return helpers;
}

export class HandlebarsHelper {
  static render(
    source: string,
    data: Record<string, unknown>,
    options?: CompileOptions
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        const template = Handlebars.compile(source, options);
        const res = template(data, { helpers: casingHelpers(data) });
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
        const res = template(data, { helpers: casingHelpers(data) });
        resolve(res);
      } catch (error) {
        reject(error);
      }
    });
  }
}
