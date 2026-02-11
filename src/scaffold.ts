import fs from 'fs';
import path from 'path';
import { TemplateBuilder } from './template_builder.js';
import { StringHelper } from './string_helper.js';

export interface ScaffoldFile {
  template: string;
  output: string;
}

export interface ScaffoldOptions {
  engine: string;
  templateDir: string;
  outputDir: string;
  variables: Record<string, string>;
  structure: ScaffoldFile[];
  dryRun?: boolean;
}

export interface ScaffoldResult {
  files: string[];
  dryRun: boolean;
}

export class Scaffold {
  static async from(options: ScaffoldOptions): Promise<ScaffoldResult> {
    const {
      engine,
      templateDir,
      outputDir,
      variables,
      structure,
      dryRun = false
    } = options;

    const builder = new TemplateBuilder(engine);
    const resolvedOutputDir = resolveVariables(outputDir, variables);
    const createdFiles: string[] = [];

    for (const file of structure) {
      const templatePath = path.join(templateDir, file.template);
      const outputFileName = resolveVariables(file.output, variables);
      const outputPath = path.join(resolvedOutputDir, outputFileName);

      if (dryRun) {
        createdFiles.push(outputPath);
        continue;
      }

      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const content = await builder.renderFile(
        templatePath,
        variables as unknown as Record<string, unknown>,
        {}
      );
      fs.writeFileSync(outputPath, content, 'utf8');
      createdFiles.push(outputPath);
    }

    return { files: createdFiles, dryRun };
  }
}

function resolveVariables(
  template: string,
  variables: Record<string, string>
): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = StringHelper.replace(result, `{{${key}}}`, value);
  }
  return result;
}
