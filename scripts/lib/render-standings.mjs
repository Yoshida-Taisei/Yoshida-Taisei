/**
 * SVG renderer for the Premier League standings table.
 *
 * Constraints that shaped this file:
 *  - GitHub renders README images as `<img>`, and browsers do NOT load external
 *    resources (fonts, images) inside an SVG used as an image. So: no external
 *    fonts, no <image href>, everything self-contained.
 *  - Team names come from an API and may contain `&`, `<`, `>`, quotes, so every
 *    interpolated text node goes through escapeXml().
 *  - Light and dark variants are produced from the same layout, because the
 *    README picks between them with <picture> + prefers-color-scheme.
 */

import { FLAG_H, japanFlag } from "./japan-flag.mjs";
import {
  BAR_W,
  PAD_X,
  WIDTH,
  cardOpen,
  createTheme,
  crestOrDot,
  escapeXml,
  estimateTextWidth,
  formatUpdatedAt,
  seasonLabel,
  truncate,
} from "./svg.mjs";

const TITLE_H = 56;
const HEADER_H = 30;
const ROW_H = 33;
const FOOTER_H = 40;

const POS_X = 42; // rank, centred
const DOT_X = 74; // club badge / colour dot, centred
const NAME_X = 90;

// Right edge of each numeric column.
const COLUMNS = [
  { key: "playedGames", label: "P", x: 572 },
  { key: "won", label: "W", x: 620 },
  { key: "draw", label: "D", x: 668 },
  { key: "lost", label: "L", x: 716 },
  { key: "goalsFor", label: "GF", x: 776 },
  { key: "goalsAgainst", label: "GA", x: 828 },
  { key: "goalDifference", label: "GD", x: 900 },
  { key: "points", label: "PTS", x: 972 },
];

const MAX_NAME_LENGTH = 30;

/**
 * Competition zones. `from`/`to` are inclusive 1-based positions.
 * Order matters: the first matching zone wins.
 */
const ZONES = [
  { from: 1, to: 4, label: "Champions League", colour: "cl" },
  { from: 5, to: 5, label: "Europa League", colour: "el" },
  { from: 18, to: 20, label: "Relegation", colour: "rel" },
];

function formatGoalDifference(value) {
  const n = Number(value) || 0;
  return n > 0 ? `+${n}` : String(n);
}

function zoneFor(position) {
  return ZONES.find((zone) => position >= zone.from && position <= zone.to) ?? null;
}

/**
 * @param {object} input
 * @param {Array<object>} input.table      rows from standings[TOTAL].table
 * @param {object} input.season           season object from the API
 * @param {string} input.theme            "light" | "dark"
 * @param {Date}   input.updatedAt
 * @param {(tla: string) => string} [input.colourForTla]
 * @param {(team: object) => string | null} [input.crestForTeam]
 *   Returns a `data:` URI for the club crest, or null to draw the colour dot.
 * @param {(team: object) => boolean} [input.hasJapanesePlayer]
 *   When true, a small Japan flag is drawn after the club name.
 */
export function renderStandings({
  table,
  season,
  theme: themeName,
  updatedAt,
  colourForTla,
  crestForTeam,
  hasJapanesePlayer,
}) {
  const theme = createTheme(themeName, colourForTla);

  const height = TITLE_H + HEADER_H + table.length * ROW_H + FOOTER_H;
  const headerY = TITLE_H;
  const rowsTop = headerY + HEADER_H;
  const footerY = rowsTop + table.length * ROW_H;

  const matchday = season?.currentMatchday;
  const subtitleParts = [seasonLabel(season)];
  if (matchday) subtitleParts.push(`Matchday ${matchday}`);
  subtitleParts.push(`Updated ${formatUpdatedAt(updatedAt)}`);

  const out = cardOpen({
    theme,
    height,
    clipId: "card-clip",
    ariaLabel: `Premier League ${seasonLabel(season)} standings`,
    subtitle: subtitleParts.join(" \u00b7 "),
  });

  // ---- header ------------------------------------------------------------
  out.push(
    `<text x="${NAME_X}" y="${headerY + 20}" font-size="11" font-weight="600" letter-spacing="0.6" fill="${
      theme.muted
    }">TEAM</text>`,
  );
  for (const col of COLUMNS) {
    out.push(
      `<text x="${col.x}" y="${headerY + 20}" font-size="11" font-weight="600" letter-spacing="0.6" fill="${
        theme.muted
      }" text-anchor="end">${col.label}</text>`,
    );
  }
  out.push(
    `<line x1="0" y1="${rowsTop}" x2="${WIDTH}" y2="${rowsTop}" stroke="${theme.border}" stroke-width="1" />`,
  );

  // ---- rows --------------------------------------------------------------
  out.push(`<g clip-path="url(#card-clip)">`);
  table.forEach((row, index) => {
    const position = Number(row.position ?? index + 1);
    const top = rowsTop + index * ROW_H;
    const baseline = top + 21.5;
    const zone = zoneFor(position);

    if (zone) {
      out.push(
        `<rect x="0" y="${top}" width="${BAR_W}" height="${ROW_H}" fill="${theme[zone.colour]}" />`,
      );
    }
    if (index < table.length - 1) {
      out.push(
        `<line x1="0" y1="${top + ROW_H}" x2="${WIDTH}" y2="${top + ROW_H}" stroke="${
          theme.rule
        }" stroke-width="1" />`,
      );
    }

    out.push(
      `<text x="${POS_X}" y="${baseline}" font-size="13" fill="${
        zone ? theme.text : theme.muted
      }" text-anchor="middle">${position}</text>`,
    );
    out.push(crestOrDot(theme, crestForTeam, row?.team, DOT_X, top + 16.5));
    const name = truncate(row?.team?.name ?? "Unknown", MAX_NAME_LENGTH);
    out.push(
      `<text x="${NAME_X}" y="${baseline}" font-size="14" fill="${theme.text}">${escapeXml(
        name,
      )}</text>`,
    );
    if (hasJapanesePlayer?.(row?.team)) {
      const flagX = NAME_X + estimateTextWidth(name, 14) + 6;
      out.push(japanFlag(flagX, baseline - FLAG_H + 0.5, theme.border));
    }

    for (const col of COLUMNS) {
      const raw = row[col.key];
      const text =
        col.key === "goalDifference" ? formatGoalDifference(raw) : String(Number(raw) || 0);
      const isPoints = col.key === "points";
      out.push(
        `<text x="${col.x}" y="${baseline}" font-size="13" fill="${
          isPoints ? theme.text : theme.muted
        }" font-weight="${isPoints ? 700 : 400}" text-anchor="end">${escapeXml(text)}</text>`,
      );
    }
  });
  out.push(`</g>`);

  // ---- footer ------------------------------------------------------------
  out.push(
    `<line x1="0" y1="${footerY}" x2="${WIDTH}" y2="${footerY}" stroke="${theme.rule}" stroke-width="1" />`,
  );
  let legendX = PAD_X;
  for (const zone of ZONES) {
    out.push(`<rect x="${legendX}" y="${footerY + 16}" width="9" height="9" rx="2" fill="${theme[zone.colour]}" />`);
    out.push(
      `<text x="${legendX + 15}" y="${footerY + 24.5}" font-size="11.5" fill="${
        theme.muted
      }">${escapeXml(zone.label)}</text>`,
    );
    legendX += 15 + zone.label.length * 6.6 + 22;
  }
  out.push(
    `<text x="${WIDTH - PAD_X}" y="${footerY + 24.5}" font-size="11" fill="${
      theme.muted
    }" text-anchor="end">Data: football-data.org</text>`,
  );

  out.push(`</svg>`);
  return `${out.join("\n")}\n`;
}
