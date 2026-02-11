export const TEMPLATE_HANDLERS = {
  HANDLEBARS: 'HANDLEBARS',
  EJS: 'EJS',
  PUG: 'PUG'
} as const;

export type TemplateHandler =
  (typeof TEMPLATE_HANDLERS)[keyof typeof TEMPLATE_HANDLERS];
