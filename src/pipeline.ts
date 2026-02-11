import fs from 'fs';
import path from 'path';
import { TemplateBuilder } from './template_builder.js';
import { type TemplateHandler } from './template_handlers.js';

export type TransformFn = (content: string) => string | Promise<string>;

export class Pipeline {
  private content: string | null = null;
  private contentPromise: Promise<string> | null = null;
  private transforms: TransformFn[] = [];

  fromString(source: string): Pipeline {
    this.content = source;
    this.contentPromise = null;
    return this;
  }

  fromFile(filePath: string): Pipeline {
    this.content = fs.readFileSync(filePath, 'utf8');
    this.contentPromise = null;
    return this;
  }

  fromTemplate(
    templatePath: string,
    data: Record<string, unknown>,
    engine?: TemplateHandler | string,
    options?: Record<string, unknown>
  ): Pipeline {
    const ext = engine ?? extToEngine(templatePath);
    const builder = new TemplateBuilder(ext);
    this.contentPromise = builder.renderFile(templatePath, data, options);
    this.content = null;
    return this;
  }

  fromTemplateString(
    source: string,
    data: Record<string, unknown>,
    engine: TemplateHandler | string,
    options?: Record<string, unknown>
  ): Pipeline {
    const builder = new TemplateBuilder(engine);
    this.contentPromise = builder.render(source, data, options);
    this.content = null;
    return this;
  }

  transform(fn: TransformFn): Pipeline {
    this.transforms.push(fn);
    return this;
  }

  async execute(): Promise<string> {
    let result: string;

    if (this.contentPromise) {
      result = await this.contentPromise;
    } else if (this.content !== null) {
      result = this.content;
    } else {
      throw new Error(
        'Pipeline has no content. Call fromString(), fromFile(), or fromTemplate() first.'
      );
    }

    for (const fn of this.transforms) {
      result = await fn(result);
    }

    return result;
  }

  async writeTo(filePath: string): Promise<string> {
    const result = await this.execute();
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, result, 'utf8');
    return result;
  }
}

function extToEngine(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.ejs':
      return 'EJS';
    case '.hbs':
    case '.handlebars':
      return 'HANDLEBARS';
    case '.pug':
    case '.jade':
      return 'PUG';
    default:
      return 'HANDLEBARS';
  }
}
