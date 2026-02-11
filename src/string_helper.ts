/**
 * Utility class for common string manipulation operations.
 *
 * @example
 * ```typescript
 * StringHelper.replace('Hello {{name}}!', '{{name}}', 'World');
 * // => "Hello World!"
 *
 * StringHelper.capitalize('hello');
 * // => "Hello"
 * ```
 */
export class StringHelper {
  /**
   * Escapes all regex special characters in a string.
   *
   * @param string - The string to escape
   * @returns The escaped string safe for use in `new RegExp()`
   *
   * @example
   * ```typescript
   * StringHelper.escapeRegex('$100.00 (test)');
   * // => "\\$100\\.00 \\(test\\)"
   * ```
   */
  static escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Replaces all occurrences of a token in a string. The token is treated
   * as a literal string (regex special characters are escaped automatically).
   *
   * @param line - The source string to search in. Returns `''` if not a string.
   * @param token - The token to search for. Returns `line` unchanged if not a string.
   * @param value - The replacement value
   * @returns The string with all occurrences replaced
   *
   * @example
   * ```typescript
   * StringHelper.replace('Price: $10.00', '$10.00', '$20.00');
   * // => "Price: $20.00"
   * ```
   */
  static replace(line: unknown, token: unknown, value: string): string {
    if (typeof line !== 'string') return '';
    if (typeof token !== 'string') return line;
    return line.replace(
      new RegExp(StringHelper.escapeRegex(token), 'g'),
      value
    );
  }

  /**
   * Capitalizes the first character of a string.
   *
   * @param s - The string to capitalize. Returns `''` if not a string.
   * @returns The string with the first character uppercased
   *
   * @example
   * ```typescript
   * StringHelper.capitalize('hello world');
   * // => "Hello world"
   * ```
   */
  static capitalize(s: unknown): string {
    if (typeof s !== 'string') return '';
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
}
