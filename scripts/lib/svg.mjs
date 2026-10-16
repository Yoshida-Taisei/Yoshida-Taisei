/**
 * Shared pieces of both SVG cards: the card width, the light/dark palettes and
 * the small text helpers each renderer needs. They live here so neither
 * renderer depends on the other.
 */

export const WIDTH = 1000;
export const PAD_X = 28;
export const BAR_W = 4; // zone stripe on the left edge, and the title bar
const DOT_R = 5.5; // colour dot radius, when a club has no crest
const CREST_SIZE = 16; // crest box; the dot keeps the same centre

const THEMES = {
  light: {
    background: "#ffffff",
    border: "#d0d7de",
    text: "#1f2328",
    muted: "#59636e",
    rule: "#e4e8ed",
    accent: "#38003c", // Premier League purple reads well on white
    cl: "#1f6feb",
    el: "#2da44e",
    rel: "#cf222e",
    fallbackDot: "#8b949e",
  },
  dark: {
    background: "#161b22",
    border: "#30363d",
    text: "#e6edf3",
    muted: "#8b949e",
    rule: "#21262d",
    accent: "#00ff85", // Premier League green reads well on near-black
    cl: "#4493f8",
    el: "#3fb950",
    rel: "#f85149",
    fallbackDot: "#8b949e",
  },
};

export function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * @param {string} name
 * @param {number} max
 */
export function truncate(name, max) {
  const text = String(name ?? "");
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}\u2026`;
}

export function formatUpdatedAt(date) {
  const iso = date.toISOString().replace("T", " ");
  return `${iso.slice(0, 16)} UTC`;
}

export function seasonLabel(season) {
  const startDate = season?.startDate;
  if (!startDate) return "Premier League";
  const year = Number(String(startDate).slice(0, 4));
  if (!Number.isFinite(year)) return "Premier League";
  return `${year}/${String((year + 1) % 100).padStart(2, "0")}`;
}

/**
 * Resolve a theme name and hand back the same palette plus a `dotColour(tla)`
 * helper, so both cards render club dots identically.
 *
 * @param {string} themeName
 * @param {(tla: string) => string} [colourForTla]
 */
export function createTheme(themeName, colourForTla) {
  const theme = THEMES[themeName];
  if (!theme) throw new Error(`Unknown theme: ${themeName}`);

  const dotColour = (tla) => {
    if (!tla || !colourForTla) return theme.fallbackDot;
    return colourForTla(tla) || theme.fallbackDot;
  };

  return { ...theme, dotColour };
}

/**
 * The club badge: the crest when the cache has one, otherwise the colour dot.
 *
 * @param {object} theme from createTheme
 * @param {(team: object) => string | null} [crestForTeam]
 * @param {object} team
 * @param {number} cx centre x
 * @param {number} cy centre y
 */
export function crestOrDot(theme, crestForTeam, team, cx, cy) {
  const crest = crestForTeam?.(team) ?? null;
  if (crest) {
    const x = cx - CREST_SIZE / 2;
    const y = cy - CREST_SIZE / 2;
    return `<image x="${x}" y="${y}" width="${CREST_SIZE}" height="${CREST_SIZE}" xlink:href="${crest}" preserveAspectRatio="xMidYMid meet" />`;
  }
  return `<circle cx="${cx}" cy="${cy}" r="${DOT_R}" fill="${theme.dotColour(
    team?.tla,
  )}" stroke="${theme.border}" stroke-width="1" />`;
}

/**
 * Everything above the rows: the card, the title bar and the subtitle. Shared
 * so both cards keep identical chrome.
 *
 * @returns {string[]} SVG lines
 */
export function cardOpen({ theme, height, clipId, ariaLabel, subtitle }) {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}" role="img" aria-label="${escapeXml(
      ariaLabel,
    )}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif">`,
    `<title>${escapeXml(ariaLabel)}</title>`,
    `<defs><clipPath id="${clipId}"><rect x="0.5" y="0.5" width="${WIDTH - 1}" height="${
      height - 1
    }" rx="12" /></clipPath></defs>`,
    `<rect x="0.5" y="0.5" width="${WIDTH - 1}" height="${height - 1}" rx="12" fill="${
      theme.background
    }" stroke="${theme.border}" />`,
    `<rect x="${PAD_X}" y="24" width="${BAR_W}" height="18" rx="2" fill="${theme.accent}" />`,
    `<text x="${PAD_X + 14}" y="38" font-size="19" font-weight="700" fill="${theme.text}">Premier League</text>`,
    `<text x="${WIDTH - PAD_X}" y="38" font-size="12" fill="${theme.muted}" text-anchor="end">${escapeXml(
      subtitle,
    )}</text>`,
  ];
}

/**
 * Rough advance width of `text` at `fontSize` for the renderers' font stack.
 *
 * SVG cannot measure text, and a flag only has to land *near* the end of a name
 * (a wide empty column follows every name), so an over-estimate is fine: the
 * flag drifts a few pixels into blank space instead of overlapping the text.
 *
 * @param {string} text
 * @param {number} fontSize
 * @returns {number}
 */
export function estimateTextWidth(text, fontSize) {
  let units = 0;
  for (const ch of String(text)) {
    if (ch === " ") units += 0.3;
    else if (".:;,'!|iljtfrI()[]".includes(ch)) units += 0.35;
    else if ("mwMW@".includes(ch)) units += 0.95;
    else if (ch >= "A" && ch <= "Z") units += 0.72;
    else if (ch >= "0" && ch <= "9") units += 0.6;
    else units += 0.58;
  }
  return units * fontSize * 1.03; // small safety margin against overlap
}
