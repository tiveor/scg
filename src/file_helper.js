const fs = require("fs");
const readline = require("readline");
const { exec } = require("child_process");
const { StringHelper } = require("./string_helper");

class FileHelper {
  static convertJsonFileToObject(fileName) {
    let rawdata = fs.readFileSync(fileName);
    return JSON.parse(rawdata);
  }

  static simpleReplace(line, replacement) {
    return StringHelper.replace(line, replacement.token, replacement.value);
  }

  static async dynamicReplace(replacement) {
    let res = "";
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
        "@date",
        new Date().toUTCString()
      );

      for (let v in variables) {
        const replacement = variables[v];

        if (newLine.indexOf(replacement.token) > 0) {
          if (replacement.template) {
            //dynamic since there is no value
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
    let res = "";

    await FileHelper.readLineByLine(template, async (line) => {
      let newLine = StringHelper.replace(
        line,
        "@date",
        new Date().toUTCString()
      );

      for (let v in variables) {
        const replacement = variables[v];

        if (newLine.indexOf(replacement.token) > 0) {
          if (replacement.template) {
            //dynamic since there is no value
            newLine = await FileHelper.dynamicReplace(replacement);
            break;
          } else if (replacement.value) {
            newLine = FileHelper.simpleReplace(newLine, replacement);
          }
        }
      }
      res += newLine + "\n";
    });
    return res;
  }

  static async readLineByLine(fileName, newLine) {
    const fileStream = fs.createReadStream(fileName);

    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    let index = 0;

    for await (const line of rl) {
      index++;
      //console.log(index);
      await newLine(line);
    }
  }

  static writer(filename) {
    return fs.createWriteStream(filename, {
      flags: "a",
    });
  }

  static async writeLineByLine(writer, newLine) {
    writer.write(`${newLine}\r\n`);
  }

  static createFolder(folderName) {
    !fs.existsSync(`./${folderName}/`) &&
      fs.mkdirSync(`./${folderName}/`, { recursive: true });
  }

  static removeFolder(folderName, callback) {
    exec(`rm -Rf '${folderName}'`, function (err, stdout, stderr) {
      if (err || stderr) {
        console.log("err:", err);
        console.log("stderr:", stderr);
      } else {
        callback();
      }
    });
  }
}

exports.FileHelper = FileHelper;
