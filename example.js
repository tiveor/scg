const { StringHelper } = require("./src/string_helper");
const { FileHelper } = require("./src/file_helper");
const { CommandHelper } = require("./src/command_helper");

console.log("\nSCG Examples\n");

//Usage StringHelper
console.log("================================");
console.log("STRING HELPER");
const replaced = StringHelper.replace("This is a {{test}}", "{{test}}", "joke");
console.log(replaced);
console.log("================================");

//Usage FileHelper
console.log("================================");
console.log("FILE HELPER");
const packageObject = FileHelper.convertJsonFileToObject("package.json");
console.log(JSON.stringify(packageObject));
console.log("================================");

//Usage CommandHelper
console.log("================================");
console.log("Command HELPER");
CommandHelper.runClean(".", "pwd").then((res) => {
  console.log(res);
  console.log("================================");
});
