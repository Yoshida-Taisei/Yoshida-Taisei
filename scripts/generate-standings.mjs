#!/usr/bin/env node
/**
 * Fetch the Premier League table from football-data.org and render it to SVG.
 *
 * Usage:
 *   FOOTBALL_DATA_API_TOKEN=xxx node scripts/generate-standings.mjs
 *   node scripts/generate-standings.mjs --fixture scripts/fixtures/standings.sample.json
 *
 * Options:
 *   --fixture <path>  Read a saved API response instead of calling the API.
 *   --out <dir>       Output directory for the SVGs (default: assets).
 *   --season <year>   Season start year to request (default: current season).
 *   --crests <dir>    Club crest cache (default: scripts/crests).
 *   --no-crests       Skip crests entirely and draw colour dots.
 *
 * Failure policy:
 *   Anything that would produce a broken or empty table (network error, API
 *   error, unexpected payload, missing team) exits with status 0 and prints a
 *   GitHub Actions warning, leaving the previously committed SVG untouched.
 *   Only misconfiguration (e.g. no API token) exits non-zero.
 */
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { colourForTla } from "./lib/team-colours.mjs";
import { hasJapanesePlayer } from "./lib/japanese-players.mjs";
import { buildThemedCards } from "./lib/build.mjs";
import { apiUrl, fetchFootballData } from "./lib/football-data.mjs";
import { info, skip } from "./lib/log.mjs";
import { renderStandings } from "./lib/render-standings.mjs";

const EXPECTED_TEAMS = 20;
const OUTPUT_FILES = {
  light: "premier-league-light.svg",
  dark: "premier-league-dark.svg",
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
      info("See the header of scripts/generate-standings.mjs for usage.");
      process.exit(0);
    } else {
      console.error(`Unknown option: ${arg}`);
      process.exit(2);
    }
  }
  return options;
}

const fetchStandings = (token, season) =>
  fetchFootballData(apiUrl("standings", season), token, "standings");

/**
 * Pull the TOTAL table out of a standings payload, rejecting anything that
 * looks like a partial or restructured response.
 */
function extractTable(payload) {
  const standings = payload?.standings;
  if (!Array.isArray(standings) || standings.length === 0) {
    throw new Error("Payload has no `standings` array.");
  }

  const total =
    standings.find((entry) => entry?.type === "TOTAL") ??
    standings.find((entry) => entry?.type === "HOME");
  if (!total || !Array.isArray(total.table)) {
    throw new Error("Payload has no TOTAL standings table.");
  }
  if (total.table.length !== EXPECTED_TEAMS) {
    throw new Error(
      `Expected ${EXPECTED_TEAMS} teams, got ${total.table.length}. Refusing to overwrite.`,
    );
  }

  const table = total.table.map((row, index) => {
    const position = Number(row?.position);
    const name = row?.team?.name;
    const points = Number(row?.points);
    if (!Number.isFinite(position) || !name || !Number.isFinite(points)) {
      throw new Error(`Row ${index + 1} is missing position/team/points.`);
    }
    return { ...row, position };
  });

  return { table, season: payload?.season ?? null };
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
    payload = await fetchStandings(token, options.season).catch((error) =>
      skip("SVG", `Could not fetch standings: ${error.message}`),
    );
  }

  let parsed;
  try {
    parsed = extractTable(payload);
  } catch (error) {
    skip("SVG", `Standings payload rejected: ${error.message}`);
  }

  const updatedAt = new Date();
  await buildThemedCards({
    outDir,
    files: OUTPUT_FILES,
    crestsDir: options.crests ? resolve(repoRoot, options.crests) : null,
    render: ({ theme, crestForTeam }) =>
      renderStandings({
        table: parsed.table,
        season: parsed.season,
        theme,
        updatedAt,
        colourForTla,
        crestForTeam,
        hasJapanesePlayer,
      }),
  });

  const leader = parsed.table[0];
  info(`Leader: ${leader?.team?.name} (${leader?.points} pts)`);
}

await main();
