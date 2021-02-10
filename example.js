const { StringHelper } = require("./src/string_helper");
const { FileHelper } = require("./src/file_helper");
const { CommandHelper } = require("./src/command_helper");
const { ParamHelper } = require("./src/param_helper");

console.log("\nSCG Examples\n");

//Usage StringHelper
const testStringHelper = () => {
  console.log("================================");
  console.log("STRING HELPER");
  const replaced = StringHelper.replace("This is a {{test}}", "{{test}}", "joke");
  console.log(replaced);
  console.log("================================");
}

//Usage FileHelper
const testFileHelper = () => {
  console.log("================================");
  console.log("FILE HELPER");
  const packageObject = FileHelper.convertJsonFileToObject("package.json");
  console.log(JSON.stringify(packageObject));
  console.log("================================");
}


//Usage ParamHelper
const testParamHelper = () => {
  console.log("================================");
  console.log("Param HELPER");
  ParamHelper.addCustomParam(`--config=123`);
  ParamHelper.addCustomParam(`--test="this is a test"`);
  const params = ParamHelper.getParams();
  console.log("params", params);
  const config = ParamHelper.getCommandByIndex(2);
  const test = ParamHelper.getCommandByIndex(3);
  console.log("config", config);
  console.log("test", test);
  console.log("================================");
}

//Usage CommandHelper
const testCommandHelper = () => {
  console.log("================================");
  console.log("Command HELPER");
  CommandHelper.runClean(".", "pwd").then((res) => {
    console.log(res);
    console.log("================================");
  });
}

testStringHelper();
testFileHelper();
testParamHelper();
testCommandHelper();