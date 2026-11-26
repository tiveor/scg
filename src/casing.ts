/**
 * Case conversion helpers for code generation.
 *
 * Available in manifest paths as `{{name:pascal}}`, in EJS and Pug templates as
 * `h.pascal(name)`, and in Handlebars templates as `{{pascal name}}`.
 *
 * @example
 * ```typescript
 * Casing.pascal('user-profile'); // => 'UserProfile'
 * Casing.kebab('UserProfile');   // => 'user-profile'
 * Casing.plural('category');     // => 'categories'
 * ```
 */

/**
 * Splits a string into lower-case words. Understands camelCase, PascalCase,
 * kebab-case, snake_case, spaces and acronyms (`HTTPServer` → `http`, `server`).
 */
export function splitWords(input: string): string[] {
  return String(input)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((word) => word.toLowerCase());
}

const capitalize = (word: string): string =>
  word.charAt(0).toUpperCase() + word.slice(1);

/** `user-profile` → `userProfile` */
export function camel(input: string): string {
  const [first = '', ...rest] = splitWords(input);
  return first + rest.map(capitalize).join('');
}

/** `user-profile` → `UserProfile` */
export function pascal(input: string): string {
  return splitWords(input).map(capitalize).join('');
}

/** `UserProfile` → `user-profile` */
export function kebab(input: string): string {
  return splitWords(input).join('-');
}

/** `UserProfile` → `user_profile` */
export function snake(input: string): string {
  return splitWords(input).join('_');
}

/** `userProfile` → `USER_PROFILE` */
export function constant(input: string): string {
  return snake(input).toUpperCase();
}

/** `user_profile` → `User Profile` */
export function title(input: string): string {
  return splitWords(input).map(capitalize).join(' ');
}

/** `AbC` → `abc` */
export function lower(input: string): string {
  return String(input).toLowerCase();
}

/** `AbC` → `ABC` */
export function upper(input: string): string {
  return String(input).toUpperCase();
}

/**
 * Pluralizes the last word with simple English rules: consonant + `y` → `ies`;
 * `s`, `x`, `z`, `ch`, `sh` → `es`; otherwise `s`. It is not a linguistic
 * pluralizer (`person` → `persons`). Keeps the input's casing.
 */
export function plural(input: string): string {
  const text = String(input);
  if (!text) return text;
  const shout = text === text.toUpperCase() && /[A-Z]/.test(text);
  const suffix = (s: string) => (shout ? s.toUpperCase() : s);

  if (/[^aeiou]y$/i.test(text)) return text.slice(0, -1) + suffix('ies');
  if (/(s|x|z|ch|sh)$/i.test(text)) return text + suffix('es');
  return text + suffix('s');
}

/** All case helpers, keyed by the modifier name used in paths and templates. */
export const Casing = {
  camel,
  pascal,
  kebab,
  snake,
  constant,
  title,
  lower,
  upper,
  plural
} as const;

/** Name of a case modifier (`pascal`, `kebab`, ...). */
export type CaseModifier = keyof typeof Casing;

/** Every supported case modifier name. */
export const CASE_MODIFIERS = Object.keys(Casing) as CaseModifier[];

/** Returns `true` if `name` is a supported case modifier. */
export function isCaseModifier(name: string): name is CaseModifier {
  return Object.prototype.hasOwnProperty.call(Casing, name);
}
