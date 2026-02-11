import {
  StringHelper,
  FileHelper,
  CommandHelper,
  ParamHelper,
  TemplateBuilder,
  TEMPLATE_HANDLERS
} from '../dist/index.js';

const initTest = (title) => {
  console.log(`=================${title}=================`);
};

const endTest = () => {
  console.log('================================');
};

//Usage StringHelper
const testStringHelper = () => {
  initTest('STRING HELPER');
  const replaced = StringHelper.replace(
    'This is a {{test}}',
    '{{test}}',
    'joke'
  );
  console.log(replaced);
  endTest();
};

//Usage FileHelper
const testFileHelper = () => {
  initTest('FILE HELPER');
  const packageObject = FileHelper.convertJsonFileToObject('package.json');
  console.log(JSON.stringify(packageObject));
  endTest();
};

//Usage ParamHelper
const testParamHelper = () => {
  initTest('Param HELPER');
  ParamHelper.addCustomParam(`--config=123`);
  ParamHelper.addCustomParam(`--test="this is a test"`);
  const params = ParamHelper.getParams();
  console.log('params', params);
  const config = ParamHelper.getCommandByIndex(2);
  const test = ParamHelper.getCommandByIndex(3);
  console.log('config', config);
  console.log('test', test);
  endTest();
};

//Usage CommandHelper
const testCommandHelper = () => {
  initTest('Command HELPER');
  CommandHelper.runClean('.', 'pwd').then((res) => {
    console.log(res);
    endTest();
  });
};

//Usage TemplateBuilder with EJS
const testTemplateEJS = async () => {
  initTest('TemplateBuilder with EJS');
  const builder = new TemplateBuilder(TEMPLATE_HANDLERS.EJS);
  builder
    .renderFile(
      'example/ejs/hello.ejs',
      { title: 'Hello EJS world', body: 'this is the body' },
      {}
    )
    .then((html) => {
      console.log(html);
      endTest();
    });

  builder
    .renderFile(
      'example/ejs/conditional.ejs',
      { isDark: true, text: 'Hello Dark World' },
      {}
    )
    .then((html) => {
      console.log(html);
      endTest();
    });

  builder
    .renderFile(
      'example/ejs/conditional.ejs',
      { isDark: false, text: 'Hello Light World' },
      {}
    )
    .then((html) => {
      console.log(html);
      endTest();
    });
};

//Usage TemplateBuilder with handlebars
const testTemplateHandlebars = async () => {
  initTest('TemplateBuilder with handlebars');
  const builder = new TemplateBuilder(TEMPLATE_HANDLERS.HANDLEBARS);
  builder
    .renderFile(
      'example/handlebars/hello.handlebars',
      { title: 'Hello handlebars world', body: 'this is the body' },
      {}
    )
    .then((html) => {
      console.log(html);
      endTest();
    });

  builder
    .renderFile(
      'example/handlebars/conditional.handlebars',
      { isDark: true, text: 'Hello Dark World' },
      {}
    )
    .then((html) => {
      console.log(html);
      endTest();
    });

  builder
    .renderFile(
      'example/handlebars/conditional.handlebars',
      { isDark: false, text: 'Hello Light World' },
      {}
    )
    .then((html) => {
      console.log(html);
      endTest();
    });
};

//Usage TemplateBuilder with pug
const testTemplatePug = async () => {
  initTest('TemplateBuilder with pug');
  const builder = new TemplateBuilder(TEMPLATE_HANDLERS.PUG);
  builder
    .renderFile(
      'example/pug/hello.pug',
      { title: 'Hello pug world', body: 'this is the body' },
      {}
    )
    .then((html) => {
      console.log(html);
      endTest();
    });

  builder
    .renderFile(
      'example/pug/conditional.pug',
      { isDark: true, text: 'Hello Dark World' },
      {}
    )
    .then((html) => {
      console.log(html);
      endTest();
    });

  builder
    .renderFile(
      'example/pug/conditional.pug',
      { isDark: false, text: 'Hello Light World' },
      {}
    )
    .then((html) => {
      console.log(html);
      endTest();
    });
};

console.log('\nSCG Examples\n');
//testStringHelper();
//testFileHelper();
//testParamHelper();
//testCommandHelper();
//testTemplateEJS();
//testTemplatePug();
testTemplateHandlebars();
