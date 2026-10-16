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
 *
 * Failure policy:
 *   Anything that would produce a broken or empty table (network error, API
 *   error, unexpected payload, missing team) exits with status 0 and prints a
 *   GitHub Actions warning, leaving the previously committed SVG untouched.
 *   Only misconfiguration (e.g. no API token) exits non-zero.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { colourForTla } from "./lib/team-colours.mjs";
import { renderStandings } from "./lib/render-standings.mjs";

const API_URL = "https://api.football-data.org/v4/competitions/PL/standings";
const EXPECTED_TEAMS = 20;
const OUTPUT_FILES = {
  light: "premier-league-light.svg",
  dark: "premier-league-dark.svg",
};

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");

function warning(message) {
  // GitHub Actions renders this as an annotation; harmless in a plain terminal.
  console.log(`::warning::${message}`);
  console.warn(message);
}

function info(message) {
  console.log(message);
}

function skip(message) {
  warning(message);
  info(`Skipping SVG regeneration. ${message}`);
  process.exit(0);
}

function parseArgs(argv) {
  const options = { fixture: null, out: "assets", season: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--fixture") options.fixture = argv[(i += 1)];
    else if (arg === "--out") options.out = argv[(i += 1)];
    else if (arg === "--season") options.season = argv[(i += 1)];
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

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

async function fetchStandings(token, season) {
  const url = new URL(API_URL);
  if (season) url.searchParams.set("season", season);

  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "X-Auth-Token": token },
        signal: AbortSignal.timeout(20_000),
      });

      const remaining = response.headers.get("X-Requests-Available-Minute");
      if (remaining != null) info(`API requests left this minute: ${remaining}`);

      if (response.status === 429) {
        warning("Rate limited by football-data.org (429). Retrying.");
        await sleep(attempt * 15_000);
        continue;
      }
      if (response.status === 403) {
        throw new Error(
          "403 from football-data.org. The token is invalid or has no access to the PL standings.",
        );
      }
      if (!response.ok) {
        const body = (await response.text()).slice(0, 200);
        throw new Error(`HTTP ${response.status} ${response.statusText}: ${body}`);
      }
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        warning(`Attempt ${attempt} failed: ${error.message}`);
        await sleep(attempt * 5_000);
      }
    }
  }
  throw lastError;
}

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
      skip(`Could not fetch standings: ${error.message}`),
    );
  }

  let parsed;
  try {
    parsed = extractTable(payload);
  } catch (error) {
    skip(`Standings payload rejected: ${error.message}`);
  }

  const updatedAt = new Date();
  await mkdir(outDir, { recursive: true });

  for (const [theme, filename] of Object.entries(OUTPUT_FILES)) {
    const svg = renderStandings({
      table: parsed.table,
      season: parsed.season,
      theme,
      updatedAt,
      colourForTla,
    });
    const target = join(outDir, filename);
    await writeFile(target, svg, "utf8");
    info(`Wrote ${target} (${svg.length} bytes)`);
  }

  const leader = parsed.table[0];
  info(`Leader: ${leader?.team?.name} (${leader?.points} pts)`);
}

await main();
