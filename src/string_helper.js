class StringHelper {
  static replace(line, token, value) {
    return line.replace(new RegExp(token, "g"), value);
  }

  static capitalize(s) {
    if (typeof s !== "string") return "";
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
}

exports.StringHelper = StringHelper;
