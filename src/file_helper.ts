import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { StringHelper } from './string_helper.js';

export interface Replacement {
  token: string;
  value?: string;
  template?: string;
  variables?: Record<string, Replacement[]>;
}

export interface CreateFileOptions {
  template: string;
  newFile: string;
  variables: Replacement[];
}

export interface CreateStringOptions {
  template: string;
  variables: Replacement[];
}

export class FileHelper {
  // --- Sync methods ---

  static readFileToString(fileName: string): string {
    return fs.readFileSync(fileName, 'utf8');
  }

  static convertJsonFileToObject<T = unknown>(fileName: string): T {
    const rawString = FileHelper.readFileToString(fileName);
    return JSON.parse(rawString) as T;
  }

  static createFolder(folderName: string): void {
    const resolved = path.resolve(folderName);
    if (!fs.existsSync(resolved)) {
      fs.mkdirSync(resolved, { recursive: true });
    }
  }

  static removeFolder(folderName: string): void {
    const resolved = path.resolve(folderName);
    if (fs.existsSync(resolved)) {
      fs.rmSync(resolved, { recursive: true, force: true });
    }
  }

  static removeFile(filename: string): void {
    const resolved = path.resolve(filename);
    if (fs.existsSync(resolved)) {
      fs.rmSync(resolved, { force: true });
    }
  }

  // --- Async methods ---

  static async readFileAsync(fileName: string): Promise<string> {
    return fs.promises.readFile(fileName, 'utf8');
  }

  static async readJsonFileAsync<T = unknown>(fileName: string): Promise<T> {
    const raw = await fs.promises.readFile(fileName, 'utf8');
    return JSON.parse(raw) as T;
  }

  static async writeFileAsync(
    fileName: string,
    content: string
  ): Promise<void> {
    const dir = path.dirname(fileName);
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(fileName, content, 'utf8');
  }

  static async createFolderAsync(folderName: string): Promise<void> {
    const resolved = path.resolve(folderName);
    await fs.promises.mkdir(resolved, { recursive: true });
  }

  static async removeFolderAsync(folderName: string): Promise<void> {
    const resolved = path.resolve(folderName);
    await fs.promises.rm(resolved, { recursive: true, force: true });
  }

  static async removeFileAsync(filename: string): Promise<void> {
    const resolved = path.resolve(filename);
    await fs.promises.rm(resolved, { force: true });
  }

  static async existsAsync(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  // --- Template processing methods ---

  static simpleReplace(line: string, replacement: Replacement): string {
    return StringHelper.replace(line, replacement.token, replacement.value!);
  }

  static async dynamicReplace(replacement: Replacement): Promise<string> {
    let res = '';
    for (const v in replacement.variables) {
      const properties = replacement.variables[v];
      await FileHelper.readLineByLine(
        replacement.template!,
        (line: string) => {
          let newLine = line;
          for (const x in properties) {
            const property = properties[x];
            if (line.indexOf(property.token) >= 0) {
              if (property.value) {
                newLine = FileHelper.simpleReplace(newLine, property);
              }
            }
          }
          res += newLine;
        }
      );
    }
    return res;
  }

  static async createFileFromFile({
    template,
    newFile,
    variables
  }: CreateFileOptions): Promise<void> {
    const writer = FileHelper.writer(newFile);

    await FileHelper.readLineByLine(template, async (line: string) => {
      let newLine = StringHelper.replace(
        line,
        '@date',
        new Date().toUTCString()
      );

      for (const v in variables) {
        const replacement = variables[v];

        if (newLine.indexOf(replacement.token) > 0) {
          if (replacement.template) {
            newLine = await FileHelper.dynamicReplace(replacement);
            break;
          } else if (replacement.value) {
            newLine = FileHelper.simpleReplace(newLine, replacement);
          }
        }
      }

      await FileHelper.writeLineByLine(writer, newLine);
    });
    writer.end();
  }

  static async createStringFromFile({
    template,
    variables
  }: CreateStringOptions): Promise<string> {
    let res = '';

    await FileHelper.readLineByLine(template, async (line: string) => {
      let newLine = StringHelper.replace(
        line,
        '@date',
        new Date().toUTCString()
      );

      for (const v in variables) {
        const replacement = variables[v];

        if (newLine.indexOf(replacement.token) > 0) {
          if (replacement.template) {
            newLine = await FileHelper.dynamicReplace(replacement);
            break;
          } else if (replacement.value) {
            newLine = FileHelper.simpleReplace(newLine, replacement);
          }
        }
      }
      res += newLine + '\n';
    });
    return res;
  }

  static async readLineByLine(
    fileName: string,
    callback: (line: string) => void | Promise<void>
  ): Promise<void> {
    const fileStream = fs.createReadStream(fileName);

    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      await callback(line);
    }
  }

  static writer(filename: string): fs.WriteStream {
    return fs.createWriteStream(filename, {
      flags: 'a'
    });
  }

  static async writeLineByLine(
    writer: fs.WriteStream,
    newLine: string
  ): Promise<void> {
    writer.write(`${newLine}\r\n`);
  }
}
