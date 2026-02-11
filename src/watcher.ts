import fs from 'fs';
import path from 'path';
import { TemplateBuilder } from './template_builder.js';

export interface WatcherOptions {
  templateDir: string;
  outputDir: string;
  engine: string;
  variables: Record<string, unknown>;
  extensions?: string[];
  onRebuild?: (file: string) => void;
  onError?: (error: Error, file: string) => void;
}

export class Watcher {
  private options: WatcherOptions;
  private abortController: AbortController | null = null;

  constructor(options: WatcherOptions) {
    this.options = {
      extensions: ['.ejs', '.hbs', '.handlebars', '.pug'],
      ...options
    };
  }

  start(): void {
    if (this.abortController) {
      return;
    }

    this.abortController = new AbortController();
    const { signal } = this.abortController;

    if (!fs.existsSync(this.options.outputDir)) {
      fs.mkdirSync(this.options.outputDir, { recursive: true });
    }

    try {
      const watcher = fs.watch(this.options.templateDir, {
        recursive: true,
        signal
      });

      watcher.on('change', (_eventType, filename) => {
        if (!filename) return;
        const filePath = path.join(
          this.options.templateDir,
          filename.toString()
        );
        this.handleChange(filePath);
      });

      watcher.on('error', (err) => {
        if ((err as NodeJS.ErrnoException).code !== 'ABORT_ERR') {
          this.options.onError?.(err, '');
        }
      });
    } catch {
      // fs.watch not available
    }
  }

  stop(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  get isRunning(): boolean {
    return this.abortController !== null;
  }

  private async handleChange(filePath: string): Promise<void> {
    const ext = path.extname(filePath).toLowerCase();
    if (!this.options.extensions!.includes(ext)) {
      return;
    }

    if (!fs.existsSync(filePath)) {
      return;
    }

    try {
      const builder = new TemplateBuilder(this.options.engine);
      const content = await builder.renderFile(
        filePath,
        this.options.variables,
        {}
      );

      const relativePath = path.relative(this.options.templateDir, filePath);
      const outputName = relativePath.replace(ext, '.html');
      const outputPath = path.join(this.options.outputDir, outputName);

      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      fs.writeFileSync(outputPath, content, 'utf8');
      this.options.onRebuild?.(outputPath);
    } catch (error) {
      this.options.onError?.(error as Error, filePath);
    }
  }
}
