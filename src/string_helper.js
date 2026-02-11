class StringHelper {
  static escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  static replace(line, token, value) {
    if (typeof line !== 'string') return '';
    if (typeof token !== 'string') return line;
    return line.replace(new RegExp(StringHelper.escapeRegex(token), 'g'), value);
  }

  static capitalize(s) {
    if (typeof s !== 'string') return '';
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
}

exports.StringHelper = StringHelper;
