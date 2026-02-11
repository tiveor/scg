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
