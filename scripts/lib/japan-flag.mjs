/**
 * Small inline Japan flag drawn next to the team rows.
 *
 * Drawn as shapes rather than the 🇯🇵 emoji on purpose: GitHub renders README
 * images as `<img>`, and flag emoji fall back to bare "JP" letters on platforms
 * without a colour flag font (notably Windows), which would look broken. Shapes
 * render identically everywhere and need no external font.
 */

export const FLAG_W = 16;
export const FLAG_H = 11; // 3:2 - the official flag ratio
const RED = "#bc002d";

/**
 * @param {number} x left edge
 * @param {number} y top edge
 * @param {string} border stroke colour, so the white field stays visible on a
 *   white card as well as on the dark one
 * @returns {string} SVG for the flag
 */
export function japanFlag(x, y, border) {
  const cx = x + FLAG_W / 2;
  const cy = y + FLAG_H / 2;
  return [
    `<rect x="${x}" y="${y}" width="${FLAG_W}" height="${FLAG_H}" rx="1.5" fill="#ffffff" stroke="${border}" stroke-width="0.8" />`,
    `<circle cx="${cx}" cy="${cy}" r="${FLAG_H * 0.3}" fill="${RED}" />`,
  ].join("");
}
