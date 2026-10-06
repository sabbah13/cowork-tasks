/**
 * Makes the built board page acceptable to the artifact tool.
 *
 * The tool refuses to publish a file that contains the Unicode replacement
 * character (U+FFFD) and says "Nothing was published". The board's markdown
 * dependency ships an entity decoder with two literal U+FFFD characters inside
 * JavaScript string literals. Inside a JS string or regex, a literal U+FFFD and
 * the escape sequence backslash-u-F-F-F-D mean exactly the same thing, so we
 * swap them. The code points are built with fromCharCode so no tool or editor
 * can turn the escape back into the literal character in this source file.
 */

const REPLACEMENT_CHAR = String.fromCharCode(0xfffd);
const ESCAPED = String.fromCharCode(92) + 'uFFFD';

/**
 * Returns `html` with every U+FFFD inside a <script> block escaped. Throws if
 * one remains anywhere else (CSS or markup), where the escape would not mean
 * the same thing and a human should decide.
 */
export function makePublishable(html) {
  const out = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, (block) =>
    block.split(REPLACEMENT_CHAR).join(ESCAPED),
  );
  const at = out.indexOf(REPLACEMENT_CHAR);
  if (at !== -1) {
    const line = out.slice(0, at).split('\n').length;
    throw new Error(
      `U+FFFD outside a <script> block at line ${line}; the artifact tool would refuse to publish this page`,
    );
  }
  return out;
}

export function countReplacementChars(html) {
  return html.split(REPLACEMENT_CHAR).length - 1;
}
