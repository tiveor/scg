import path from 'path';

/**
 * Enum-like object defining the built-in template engine identifiers.
 *
 * @example
 * ```typescript
 * const builder = new TemplateBuilder(TEMPLATE_HANDLERS.EJS);
 * ```
 */
export const TEMPLATE_HANDLERS = {
  HANDLEBARS: 'HANDLEBARS',
  EJS: 'EJS',
  PUG: 'PUG'
} as const;

/**
 * Union type of all valid built-in template handler names.
 */
export type TemplateHandler =
  (typeof TEMPLATE_HANDLERS)[keyof typeof TEMPLATE_HANDLERS];

const EXTENSION_TO_ENGINE: Record<string, TemplateHandler> = {
  '.ejs': TEMPLATE_HANDLERS.EJS,
  '.hbs': TEMPLATE_HANDLERS.HANDLEBARS,
  '.handlebars': TEMPLATE_HANDLERS.HANDLEBARS,
  '.pug': TEMPLATE_HANDLERS.PUG,
  '.jade': TEMPLATE_HANDLERS.PUG
};

/**
 * Infers the built-in template engine from a file's extension.
 *
 * @param filePath - Path (or name) of the template file
 * @returns The engine name, or `undefined` if the extension is not recognized
 *
 * @example
 * ```typescript
 * engineFromExtension('component.ejs'); // => 'EJS'
 * engineFromExtension('notes.txt');     // => undefined
 * ```
 */
export function engineFromExtension(
  filePath: string
): TemplateHandler | undefined {
  return EXTENSION_TO_ENGINE[path.extname(filePath).toLowerCase()];
}

/**
 * Returns the file extensions recognized by {@link engineFromExtension}.
 */
export function knownTemplateExtensions(): string[] {
  return Object.keys(EXTENSION_TO_ENGINE);
}
