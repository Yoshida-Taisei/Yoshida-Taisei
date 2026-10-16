/**
 * How the two entry scripts report and bail.
 *
 * `warning` prints the GitHub Actions workflow-command prefix and also plain
 * text, so CI shows an annotation and a terminal still reads normally.
 */

export function info(message) {
  console.log(message);
}

export function warning(message) {
  console.log(`::warning::${message}`);
  console.warn(message);
}

/**
 * Warn and exit 0, leaving the committed SVGs untouched. Used when the payload
 * would produce a broken or empty card.
 *
 * @param {string} subject e.g. "SVG" or "fixtures SVG"
 * @param {string} message
 */
export function skip(subject, message) {
  warning(message);
  info(`Skipping ${subject} regeneration. ${message}`);
  process.exit(0);
}
