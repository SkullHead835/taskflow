/**
 * Input sanitization utility for preventing HTML/script injection attacks
 * while preserving legitimate user characters (punctuation, apostrophes, quotes, accents, numbers).
 */

/**
 * Strips HTML tags, script elements, and dangerous control characters from user text.
 *
 * @param {string|null|undefined} input
 * @returns {string|null}
 */
function sanitizeString(input) {
  if (input === null || input === undefined) return null;
  if (typeof input !== 'string') return String(input);

  // 1. Remove null bytes and non-printable ASCII control characters (keeping \t, \n, \r)
  let clean = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // 2. Strip HTML elements (<tag ...>, </tag>, and <!-- comments -->)
  // while preserving legitimate mathematical/comparison angle brackets (e.g. x < 5 && y > 10)
  clean = clean.replace(/<\/?([a-zA-Z][a-zA-Z0-9:-]*)\b[^>]*>|<!--[\s\S]*?-->/gi, '');

  return clean.trim();
}

module.exports = {
  sanitizeString
};
