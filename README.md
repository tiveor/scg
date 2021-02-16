SCG a Random Library for Generators<br/>
[![Build Status](https://img.shields.io/travis/mde/ejs/master.svg?style=flat)](https://travis-ci.org/mde/ejs)
[![npm version](https://badge.fury.io/js/%40tiveor%2Fscg.svg)](https://badge.fury.io/js/%40tiveor%2Fscg)
=============================

## Installation

```bash
npm install @tiveor/scg
```

## Basic usage

```javascript
const { StringHelper } = require('@tiveor/scg');
const replaced = StringHelper.replace('This is a {{test}}', '{{test}}', 'joke');
// replaced = "This is a joke"
```

## TemplateBuilder usage

```javascript
const { TemplateBuilder, TEMPLATE_HANDLERS } = require('@tiveor/scg');

const ejsBuilder = new TemplateBuilder(TEMPLATE_HANDLERS.EJS);
ejsBuilder
  .render('This is a <%= test %>', {
    test: 'joke'
  })
  .then((replaced) => {
    // replaced = "This is a joke"
  });

const pugBuilder = new TemplateBuilder(TEMPLATE_HANDLERS.PUG);
pugBuilder
  .render('This is a #{test}', {
    test: 'joke'
  })
  .then((replaced) => {
    // replaced = "This is a joke"
  });

const handlebarsBuilder = new TemplateBuilder(TEMPLATE_HANDLERS.HANDLEBARS);
handlebarsBuilder
  .render('This is a {{test}}', {
    test: 'joke'
  })
  .then((replaced) => {
    // replaced = "This is a joke"
  });
```

## Example
```bash
node examples/index.js
```