/**
 * SVG renderer for "previous matchday results" + "next matchday fixtures":
 * the next matchday on top, the previous one below, full-width rows.
 *
 * Same constraints as render-standings.mjs: GitHub renders README images as
 * `<img>`, so nothing here may reference external fonts or images. Crests are
 * inlined as base64 `data:` URIs by the caller, and every API string goes
 * through escapeXml().
 */

import { FLAG_H, FLAG_W, japanFlag } from "./japan-flag.mjs";
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
const BLOCK_H = 34;
const FOOTER_H = 40;
const BLOCK_GAP = 8;

const TIME_RIGHT = WIDTH - PAD_X;

const MAX_NAME = 20;

const ROW_H = 32;
const HOME_NAME_RIGHT = 384;
const HOME_CREST_CX = 400;
const SCORE_CX = 500;
const AWAY_CREST_CX = 600;
const AWAY_NAME_X = 616;

/** Nothing is shown as a score until the match is over. */
const FINISHED = "FINISHED";
const NO_TIME_STATUS = new Set(["POSTPONED", "CANCELLED", "SUSPENDED", "AWARDED"]);

const KICKOFF_FMT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Tokyo",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** ISO UTC -> "MM/DD HH:mm" in Japan Standard Time, or "TBC". */
function formatKickoff(iso) {
  if (!iso) return "TBC";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "TBC";
  const parts = {};
  for (const part of KICKOFF_FMT.formatToParts(date)) parts[part.type] = part.value;
  return `${parts.month}/${parts.day} ${parts.hour}:${parts.minute}`;
}

const teamName = (team) => truncate(team?.shortName ?? team?.name ?? "Unknown", MAX_NAME);

const scoreLabel = (match) => {
  if (match?.status !== FINISHED) return "vs";
  const fullTime = match?.score?.fullTime ?? {};
  return `${fullTime.home ?? 0} \u2013 ${fullTime.away ?? 0}`;
};

const timeLabel = (match) =>
  NO_TIME_STATUS.has(match?.status)
    ? String(match.status).toLowerCase()
    : formatKickoff(match?.utcDate);

function cardFooter({ theme, footerY }) {
  const out = [];
  out.push(
    `<line x1="0" y1="${footerY}" x2="${WIDTH}" y2="${footerY}" stroke="${theme.rule}" stroke-width="1" />`,
  );
  out.push(
    `<text x="${PAD_X}" y="${footerY + 24.5}" font-size="11" fill="${
      theme.muted
    }">Kick-off times shown in JST</text>`,
  );
  out.push(
    `<text x="${TIME_RIGHT}" y="${footerY + 24.5}" font-size="11" fill="${
      theme.muted
    }" text-anchor="end">Data: football-data.org</text>`,
  );
  return out;
}

/**
 * @param {object} input
 * @param {{ matchday: number, matches: Array<object> } | null} input.previous
 * @param {{ matchday: number, matches: Array<object> } | null} input.next
 * @param {object} input.season
 * @param {string} input.theme            "light" | "dark"
 * @param {Date}   input.updatedAt
 * @param {(tla: string) => string} [input.colourForTla]
 * @param {(team: object) => string | null} [input.crestForTeam]
 * @param {(team: object) => boolean} [input.hasJapanesePlayer]
 *   When true, a small Japan flag is drawn next to the club name.
 */
export function renderFixtures({ previous, next, season, theme: themeName, updatedAt, colourForTla, crestForTeam, hasJapanesePlayer }) {
  const theme = createTheme(themeName, colourForTla);

  const blocks = [];
  if (next) {
    blocks.push({
      colour: theme.accent,
      label: `Next \u00b7 Matchday ${next.matchday}`,
      note: "Kick-off (JST)",
      matches: next.matches,
    });
  }
  if (previous) {
    blocks.push({
      colour: theme.muted,
      label: `Previous \u00b7 Matchday ${previous.matchday}`,
      note: "Full time",
      matches: previous.matches,
    });
  }

  const rows = blocks.reduce((total, block) => total + block.matches.length, 0);
  const height =
    TITLE_H + blocks.length * BLOCK_H + rows * ROW_H + Math.max(0, blocks.length - 1) * BLOCK_GAP + FOOTER_H;
  const footerY = height - FOOTER_H;

  const out = cardOpen({
    theme,
    height,
    clipId: "card-clip",
    ariaLabel: `Premier League ${seasonLabel(season)} results and fixtures`,
    subtitle: [seasonLabel(season), `Updated ${formatUpdatedAt(updatedAt)}`].join(" \u00b7 "),
  });
  out.push(`<g clip-path="url(#card-clip)">`);

  let y = TITLE_H;
  blocks.forEach((block, index) => {
    if (index > 0) y += BLOCK_GAP;

    out.push(
      `<rect x="${PAD_X}" y="${y + 12}" width="${BAR_W}" height="14" rx="2" fill="${block.colour}" />`,
    );
    out.push(
      `<text x="${PAD_X + 14}" y="${y + 24}" font-size="11" font-weight="600" letter-spacing="0.6" fill="${
        theme.text
      }">${escapeXml(block.label.toUpperCase())}</text>`,
    );
    out.push(
      `<text x="${TIME_RIGHT}" y="${y + 24}" font-size="11" fill="${theme.muted}" text-anchor="end">${escapeXml(
        block.note,
      )}</text>`,
    );
    y += BLOCK_H;
    out.push(
      `<line x1="0" y1="${y}" x2="${WIDTH}" y2="${y}" stroke="${theme.border}" stroke-width="1" />`,
    );

    block.matches.forEach((match, rowIndex) => {
      const top = y + rowIndex * ROW_H;
      const baseline = top + 20.5;
      const centre = top + 16;
      const home = match?.homeTeam ?? {};
      const away = match?.awayTeam ?? {};
      const finished = match?.status === FINISHED;

      if (rowIndex < block.matches.length - 1) {
        out.push(
          `<line x1="0" y1="${top + ROW_H}" x2="${WIDTH}" y2="${top + ROW_H}" stroke="${
            theme.rule
          }" stroke-width="1" />`,
        );
      }

      out.push(crestOrDot(theme, crestForTeam, home, HOME_CREST_CX, centre));
      out.push(crestOrDot(theme, crestForTeam, away, AWAY_CREST_CX, centre));

      const homeName = teamName(home);
      const awayName = teamName(away);
      out.push(
        `<text x="${HOME_NAME_RIGHT}" y="${baseline}" font-size="14" fill="${theme.text}" text-anchor="end">${escapeXml(
          homeName,
        )}</text>`,
      );
      out.push(
        `<text x="${AWAY_NAME_X}" y="${baseline}" font-size="14" fill="${theme.text}">${escapeXml(
          awayName,
        )}</text>`,
      );
      if (hasJapanesePlayer?.(home)) {
        const flagX = HOME_NAME_RIGHT - estimateTextWidth(homeName, 14) - 6 - FLAG_W;
        out.push(japanFlag(flagX, baseline - FLAG_H + 0.5, theme.border));
      }
      if (hasJapanesePlayer?.(away)) {
        const flagX = AWAY_NAME_X + estimateTextWidth(awayName, 14) + 6;
        out.push(japanFlag(flagX, baseline - FLAG_H + 0.5, theme.border));
      }

      const score = scoreLabel(match);
      out.push(
        `<text x="${SCORE_CX}" y="${baseline}" font-size="14" font-weight="${finished ? 700 : 400}" fill="${
          finished ? theme.text : theme.muted
        }" text-anchor="middle">${escapeXml(score)}</text>`,
      );
      out.push(
        `<text x="${TIME_RIGHT}" y="${baseline}" font-size="11.5" fill="${theme.muted}" text-anchor="end">${escapeXml(
          timeLabel(match),
        )}</text>`,
      );
    });
    y += block.matches.length * ROW_H;
  });

  out.push(`</g>`);
  out.push(...cardFooter({ theme, footerY }));
  out.push(`</svg>`);
  return `${out.join("\n")}\n`;
}
