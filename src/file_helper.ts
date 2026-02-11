import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { StringHelper } from './string_helper.js';

/** Defines a single token replacement with optional template-based dynamic replacement. */
export interface Replacement {
  /** The token string to search for in the template (e.g., `'{{name}}'`). */
  token: string;
  /** The static value to replace the token with. */
  value?: string;
  /** Path to a sub-template for dynamic replacement. */
  template?: string;
  /** Variables for dynamic replacement keyed by identifier. */
  variables?: Record<string, Replacement[]>;
}

/** Options for creating a file from a template with variable replacements. */
export interface CreateFileOptions {
  /** Path to the template file. */
  template: string;
  /** Path for the output file. */
  newFile: string;
  /** Array of token replacements to apply. */
  variables: Replacement[];
}

/** Options for creating a string from a template with variable replacements. */
export interface CreateStringOptions {
  /** Path to the template file. */
  template: string;
  /** Array of token replacements to apply. */
  variables: Replacement[];
}

/**
 * Utility class for file system operations, both synchronous and asynchronous.
 *
 * Provides methods for reading, writing, creating, and removing files and directories,
 * as well as template-based file generation with variable replacement.
 *
 * @example
 * ```typescript
 * // Sync
 * const content = FileHelper.readFileToString('config.txt');
 * const config = FileHelper.convertJsonFileToObject('config.json');
 *
 * // Async
 * const data = await FileHelper.readFileAsync('config.txt');
 * await FileHelper.writeFileAsync('output.txt', 'content');
 * ```
 */
export class FileHelper {
  // --- Sync methods ---

  /**
   * Reads a file synchronously and returns its content as a UTF-8 string.
   *
   * @param fileName - Path to the file to read
   * @returns The file content as a string
   */
  static readFileToString(fileName: string): string {
    return fs.readFileSync(fileName, 'utf8');
  }

  /**
   * Reads a JSON file synchronously and parses it into an object.
   *
   * @typeParam T - The expected type of the parsed object
   * @param fileName - Path to the JSON file
   * @returns The parsed object
   */
  static convertJsonFileToObject<T = unknown>(fileName: string): T {
    const rawString = FileHelper.readFileToString(fileName);
    return JSON.parse(rawString) as T;
  }

  /**
   * Creates a directory (and any parent directories) if it doesn't exist.
   *
   * @param folderName - Path to the directory to create
   */
  static createFolder(folderName: string): void {
    const resolved = path.resolve(folderName);
    if (!fs.existsSync(resolved)) {
      fs.mkdirSync(resolved, { recursive: true });
    }
  }

  /**
   * Removes a directory and all its contents recursively.
   *
   * @param folderName - Path to the directory to remove
   */
  static removeFolder(folderName: string): void {
    const resolved = path.resolve(folderName);
    if (fs.existsSync(resolved)) {
      fs.rmSync(resolved, { recursive: true, force: true });
    }
  }

  /**
   * Removes a file if it exists.
   *
   * @param filename - Path to the file to remove
   */
  static removeFile(filename: string): void {
    const resolved = path.resolve(filename);
    if (fs.existsSync(resolved)) {
      fs.rmSync(resolved, { force: true });
    }
  }

  // --- Async methods ---

  /**
   * Reads a file asynchronously and returns its content as a UTF-8 string.
   *
   * @param fileName - Path to the file to read
   * @returns A promise resolving to the file content
   */
  static async readFileAsync(fileName: string): Promise<string> {
    return fs.promises.readFile(fileName, 'utf8');
  }

  /**
   * Reads a JSON file asynchronously and parses it into an object.
   *
   * @typeParam T - The expected type of the parsed object
   * @param fileName - Path to the JSON file
   * @returns A promise resolving to the parsed object
   */
  static async readJsonFileAsync<T = unknown>(fileName: string): Promise<T> {
    const raw = await fs.promises.readFile(fileName, 'utf8');
    return JSON.parse(raw) as T;
  }

  /**
   * Writes content to a file asynchronously, creating parent directories as needed.
   *
   * @param fileName - Path to the file to write
   * @param content - The string content to write
   */
  static async writeFileAsync(
    fileName: string,
    content: string
  ): Promise<void> {
    const dir = path.dirname(fileName);
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(fileName, content, 'utf8');
  }

  /**
   * Creates a directory asynchronously (with recursive parent creation).
   *
   * @param folderName - Path to the directory to create
   */
  static async createFolderAsync(folderName: string): Promise<void> {
    const resolved = path.resolve(folderName);
    await fs.promises.mkdir(resolved, { recursive: true });
  }

  /**
   * Removes a directory and its contents recursively (async).
   *
   * @param folderName - Path to the directory to remove
   */
  static async removeFolderAsync(folderName: string): Promise<void> {
    const resolved = path.resolve(folderName);
    await fs.promises.rm(resolved, { recursive: true, force: true });
  }

  /**
   * Removes a file asynchronously.
   *
   * @param filename - Path to the file to remove
   */
  static async removeFileAsync(filename: string): Promise<void> {
    const resolved = path.resolve(filename);
    await fs.promises.rm(resolved, { force: true });
  }

  /**
   * Checks whether a file or directory exists asynchronously.
   *
   * @param filePath - Path to check
   * @returns `true` if the path exists, `false` otherwise
   */
  static async existsAsync(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  // --- Template processing methods ---

  /**
   * Performs a simple token replacement on a single line.
   *
   * @param line - The source line
   * @param replacement - The replacement definition (uses `token` and `value`)
   * @returns The line with the token replaced
   */
  static simpleReplace(line: string, replacement: Replacement): string {
    return StringHelper.replace(line, replacement.token, replacement.value!);
  }

  /**
   * Performs dynamic replacement using a sub-template and variables.
   * Reads the sub-template line by line and applies all variable replacements.
   *
   * @param replacement - The replacement definition with `template` and `variables`
   * @returns A promise resolving to the processed string
   */
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

  /**
   * Creates a new file from a template file, applying variable replacements line by line.
   * The special token `@date` is automatically replaced with the current UTC date.
   *
   * @param options - The template path, output path, and variables to apply
   *
   * @example
   * ```typescript
   * await FileHelper.createFileFromFile({
   *   template: 'templates/component.txt',
   *   newFile: 'output/Button.tsx',
   *   variables: [
   *     { token: '{{name}}', value: 'Button' },
   *     { token: '{{style}}', value: 'primary' }
   *   ]
   * });
   * ```
   */
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

  /**
   * Creates a string from a template file, applying variable replacements line by line.
   * The special token `@date` is automatically replaced with the current UTC date.
   *
   * @param options - The template path and variables to apply
   * @returns A promise resolving to the processed string
   */
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

  /**
   * Reads a file line by line and invokes a callback for each line.
   *
   * @param fileName - Path to the file to read
   * @param callback - Function called for each line
   */
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

  /**
   * Creates a writable stream for appending to a file.
   *
   * @param filename - Path to the file
   * @returns A writable stream in append mode
   */
  static writer(filename: string): fs.WriteStream {
    return fs.createWriteStream(filename, {
      flags: 'a'
    });
  }

  /**
   * Writes a single line to a writable stream with CRLF line ending.
   *
   * @param writer - The writable stream
   * @param newLine - The line content to write
   */
  static async writeLineByLine(
    writer: fs.WriteStream,
    newLine: string
  ): Promise<void> {
    writer.write(`${newLine}\r\n`);
  }
}
