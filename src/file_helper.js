const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { StringHelper } = require('./string_helper');

class FileHelper {
  static readFileToString(fileName) {
    return fs.readFileSync(fileName, 'utf8');
  }

  static convertJsonFileToObject(fileName) {
    const rawString = this.readFileToString(fileName);
    return JSON.parse(rawString);
  }

  static simpleReplace(line, replacement) {
    return StringHelper.replace(line, replacement.token, replacement.value);
  }

  static async dynamicReplace(replacement) {
    let res = '';
    for (let v in replacement.variables) {
      const properties = replacement.variables[v];
      await FileHelper.readLineByLine(replacement.template, (line) => {
        let newLine = line;
        for (let x in properties) {
          const property = properties[x];
          if (line.indexOf(property.token) >= 0) {
            if (property.value) {
              newLine = FileHelper.simpleReplace(newLine, property);
            }
          }
        }
        res += newLine;
      });
    }
    return res;
  }

  static async createFileFromFile({ template, newFile, variables }) {
    const writer = FileHelper.writer(newFile);

    await FileHelper.readLineByLine(template, async (line) => {
      let newLine = StringHelper.replace(
        line,
        '@date',
        new Date().toUTCString()
      );

      for (let v in variables) {
        const replacement = variables[v];

        if (newLine.indexOf(replacement.token) > 0) {
          if (replacement.template) {
            newLine = await FileHelper.dynamicReplace(replacement);
            break;
          } else if (replacement.value) {
            newLine = FileHelper.simpleReplace(newLine, replacement);
          }
        }
      }

      await FileHelper.writeLineByLine(writer, newLine);
    });
    writer.end();
  }

  static async createStringFromFile({ template, variables }) {
    let res = '';

    await FileHelper.readLineByLine(template, async (line) => {
      let newLine = StringHelper.replace(
        line,
        '@date',
        new Date().toUTCString()
      );

      for (let v in variables) {
        const replacement = variables[v];

        if (newLine.indexOf(replacement.token) > 0) {
          if (replacement.template) {
            newLine = await FileHelper.dynamicReplace(replacement);
            break;
          } else if (replacement.value) {
            newLine = FileHelper.simpleReplace(newLine, replacement);
          }
        }
      }
      res += newLine + '\n';
    });
    return res;
  }

  static async readLineByLine(fileName, callback) {
    const fileStream = fs.createReadStream(fileName);

    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      await callback(line);
    }
  }

  static writer(filename) {
    return fs.createWriteStream(filename, {
      flags: 'a'
    });
  }

  static async writeLineByLine(writer, newLine) {
    writer.write(`${newLine}\r\n`);
  }

  static createFolder(folderName) {
    const resolved = path.resolve(folderName);
    if (!fs.existsSync(resolved)) {
      fs.mkdirSync(resolved, { recursive: true });
    }
  }

  static removeFolder(folderName) {
    const resolved = path.resolve(folderName);
    if (fs.existsSync(resolved)) {
      fs.rmSync(resolved, { recursive: true, force: true });
    }
  }

  static removeFile(filename) {
    const resolved = path.resolve(filename);
    if (fs.existsSync(resolved)) {
      fs.rmSync(resolved, { force: true });
    }
  }
}

exports.FileHelper = FileHelper;
