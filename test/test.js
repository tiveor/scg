var assert = require('assert');
const { StringHelper } = require("../src/string_helper");

describe("StringHelper", () => {
  describe("replace", () => {
    it('should search and replace the test param', function () {
      const replaced = StringHelper.replace("This is a {{test}}", "{{test}}", "joke");
      assert.strictEqual(replaced, "This is a joke");
    });
  })
});