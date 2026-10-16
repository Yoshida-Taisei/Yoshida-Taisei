#!/usr/bin/env node
/**
 * Fetch the Premier League season's matches from football-data.org and render
 * the previous matchday's results plus the next matchday's fixtures to SVG.
 *
 * Usage:
 *   FOOTBALL_DATA_API_TOKEN=xxx node scripts/generate-fixtures.mjs
 *   node scripts/generate-fixtures.mjs --fixture scripts/fixtures/matches.sample.json
 *
 * Options:
 *   --fixture <path>  Read a saved API response instead of calling the API.
 *   --out <dir>       Output directory for the SVGs (default: assets).
 *   --season <year>   Season start year to request (default: current season).
 *   --crests <dir>    Club crest cache (default: scripts/crests).
 *   --no-crests       Skip crests entirely and draw colour dots.
 *
 * Failure policy mirrors generate-standings.mjs: anything that would produce a
 * broken or empty render exits 0 with a warning and leaves the committed SVGs
 * untouched. Only misconfiguration exits non-zero.
 */
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { colourForTla } from "./lib/team-colours.mjs";
import { hasJapanesePlayer } from "./lib/japanese-players.mjs";
import { buildThemedCards } from "./lib/build.mjs";
import { apiUrl, fetchFootballData } from "./lib/football-data.mjs";
import { info, skip } from "./lib/log.mjs";
import { renderFixtures } from "./lib/render-fixtures.mjs";

const OUTPUT_FILES = {
  light: "premier-league-fixtures-light.svg",
  dark: "premier-league-fixtures-dark.svg",
};

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");

function parseArgs(argv) {
  const options = { fixture: null, out: "assets", season: null, crests: "scripts/crests" };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--fixture") options.fixture = argv[(i += 1)];
    else if (arg === "--out") options.out = argv[(i += 1)];
    else if (arg === "--season") options.season = argv[(i += 1)];
    else if (arg === "--crests") options.crests = argv[(i += 1)];
    else if (arg === "--no-crests") options.crests = null;
    else if (arg === "--help" || arg === "-h") {
      info("See the header of scripts/generate-fixtures.mjs for usage.");
      process.exit(0);
    } else {
      console.error(`Unknown option: ${arg}`);
      process.exit(2);
    }
  }
  return options;
}

const fetchMatches = (token, season) =>
  fetchFootballData(apiUrl("matches", season), token, "matches");

const isFinished = (match) => match?.status === "FINISHED";

/**
 * Pick the previous matchday (the latest one whose matches are all finished)
 * and the next matchday: the first one after it that still has something to
 * play. Deriving from match status avoids the ambiguity of
 * `season.currentMatchday`, which keeps pointing at a matchday while it is
 * being played.
 */
function selectMatchdays(matches) {
  const byMatchday = new Map();
  for (const match of matches) {
    const matchday = Number(match?.matchday);
    if (!Number.isInteger(matchday)) continue;
    if (!byMatchday.has(matchday)) byMatchday.set(matchday, []);
    byMatchday.get(matchday).push(match);
  }

  const matchdays = [...byMatchday.keys()].sort((a, b) => a - b);

  let previous = null;
  for (const matchday of matchdays) {
    if (byMatchday.get(matchday).every(isFinished)) previous = matchday;
  }

  // Search after `previous` only: a postponed game in an earlier matchday would
  // otherwise make "next" point backwards, below "previous".
  let next = null;
  for (const matchday of matchdays) {
    if (previous !== null && matchday <= previous) continue;
    if (byMatchday.get(matchday).some((match) => !isFinished(match))) {
      next = matchday;
      break;
    }
  }

  const wrap = (matchday) =>
    matchday === null ? null : { matchday, matches: byMatchday.get(matchday) };

  return { previous: wrap(previous), next: wrap(next) };
}

function extractMatches(payload) {
  const matches = payload?.matches;
  if (!Array.isArray(matches) || matches.length === 0) {
    throw new Error("Payload has no `matches` array.");
  }
  for (const [index, match] of matches.entries()) {
    if (!match?.homeTeam?.id || !match?.awayTeam?.id) {
      throw new Error(`Match ${index + 1} is missing a home or away team.`);
    }
  }
  // The matches endpoint has no top-level `season`; it lives on each match.
  return { matches, season: payload?.season ?? matches[0]?.season ?? null };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const outDir = resolve(repoRoot, options.out);

  let payload;
  if (options.fixture) {
    const fixturePath = resolve(process.cwd(), options.fixture);
    payload = JSON.parse(await readFile(fixturePath, "utf8"));
    info(`Using fixture: ${fixturePath}`);
  } else {
    const token = process.env.FOOTBALL_DATA_API_TOKEN?.trim();
    if (!token) {
      console.error(
        "FOOTBALL_DATA_API_TOKEN is not set. Register at https://www.football-data.org/client/register",
      );
      process.exit(1);
    }
    payload = await fetchMatches(token, options.season).catch((error) =>
      skip("fixtures SVG", `Could not fetch matches: ${error.message}`),
    );
  }

  let parsed;
  try {
    parsed = extractMatches(payload);
  } catch (error) {
    skip("fixtures SVG", `Matches payload rejected: ${error.message}`);
  }

  const { previous, next } = selectMatchdays(parsed.matches);
  if (!previous && !next) {
    skip("fixtures SVG", "No playable matchday found in the payload.");
  }
  if (options.fixture && !previous) info("No fully-finished matchday in the payload; rendering next only.");

  const updatedAt = new Date();
  await buildThemedCards({
    outDir,
    files: OUTPUT_FILES,
    crestsDir: options.crests ? resolve(repoRoot, options.crests) : null,
    render: ({ theme, crestForTeam }) =>
      renderFixtures({
        previous,
        next,
        season: parsed.season,
        theme,
        updatedAt,
        colourForTla,
        crestForTeam,
        hasJapanesePlayer,
      }),
  });

  info(`Previous matchday: ${previous ? previous.matchday : "none"}`);
  info(`Next matchday: ${next ? next.matchday : "none"}`);
}

await main();
