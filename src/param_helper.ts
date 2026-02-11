/**
 * Utility class for parsing CLI parameters from `process.argv`.
 *
 * @example
 * ```typescript
 * // node script.js --name=Alice --port=3000
 * const params = ParamHelper.getParams();
 * // => { name: "Alice", port: "3000" }
 * ```
 */
export class ParamHelper {
  /**
   * Appends a custom parameter string to `process.argv`.
   *
   * @param customParam - The parameter to add (e.g., `'--env=production'`)
   */
  static addCustomParam(customParam: string): void {
    process.argv.push(customParam);
  }

  /**
   * Retrieves the command-line argument at the given index.
   *
   * @param index - Zero-based index into `process.argv`
   * @returns The argument at the given index, or `''` if out of bounds
   */
  static getCommandByIndex(index: number): string {
    return process.argv.length > index ? process.argv[index] : '';
  }

  /**
   * Parses all `--key=value` parameters from `process.argv` into an object.
   * Surrounding quotes on values are stripped automatically.
   *
   * @returns An object mapping parameter names to their string values
   *
   * @example
   * ```typescript
   * // node script.js --name=Alice --port=3000
   * ParamHelper.getParams();
   * // => { name: "Alice", port: "3000" }
   * ```
   */
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
