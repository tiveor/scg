export class StringHelper {
  static escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  static replace(line: unknown, token: unknown, value: string): string {
    if (typeof line !== 'string') return '';
    if (typeof token !== 'string') return line;
    return line.replace(
      new RegExp(StringHelper.escapeRegex(token), 'g'),
      value
    );
  }

  static capitalize(s: unknown): string {
    if (typeof s !== 'string') return '';
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
}
