#!/usr/bin/env node
/**
 * Download club crests into scripts/crests/<teamId>.png.
 *
 * This is a manual, one-off tool, not part of the scheduled job. Run it when
 * the set of clubs changes (promotion / relegation) and commit the result:
 *
 *   FOOTBALL_DATA_API_TOKEN=xxx node scripts/fetch-crests.mjs
 *
 * The standings job never talks to the crest CDN. It reads the committed files
 * and inlines them as base64 `data:` URIs, so the scheduled build is offline
 * deterministic and cannot break when the CDN is slow or down. A team with no
 * cached file simply renders as a colour dot.
 *
 * Options:
 *   --season <year>  Season start year to request (default: current season).
 *   --out <dir>      Where to write the PNGs (default: scripts/crests).
 *   --force          Re-download files that are already cached.
 *
 * Exits non-zero on any failure a human needs to fix (no token, no team list).
 * Individual crest failures only warn: the renderer copes with the gap.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { warning } from "./lib/log.mjs";

const TEAMS_URL = "https://api.football-data.org/v4/competitions/PL/teams";
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");

function parseArgs(argv) {
  const options = { season: null, out: "scripts/crests", force: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--season") options.season = argv[(i += 1)];
    else if (arg === "--out") options.out = argv[(i += 1)];
    else if (arg === "--force") options.force = true;
    else if (arg === "--help" || arg === "-h") {
      console.log("See the header of scripts/fetch-crests.mjs for usage.");
      process.exit(0);
    } else {
      console.error(`Unknown option: ${arg}`);
      process.exit(2);
    }
  }
  return options;
}

async function download(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.subarray(0, 8).equals(PNG_MAGIC)) {
    throw new Error(`Not a PNG (${bytes.length} bytes)`);
  }
  return bytes;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const outDir = resolve(repoRoot, options.out);

  const token = process.env.FOOTBALL_DATA_API_TOKEN?.trim();
  if (!token) {
    console.error(
      "FOOTBALL_DATA_API_TOKEN is not set. Register at https://www.football-data.org/client/register",
    );
    process.exit(1);
  }

  const url = new URL(TEAMS_URL);
  if (options.season) url.searchParams.set("season", options.season);

  const response = await fetch(url, {
    headers: { "X-Auth-Token": token },
    signal: AbortSignal.timeout(20_000),
  });

  const remaining = response.headers.get("X-Requests-Available-Minute");
  if (remaining != null) console.log(`API requests left this minute: ${remaining}`);

  if (!response.ok) {
    const body = (await response.text()).slice(0, 200);
    console.error(`Could not list teams: HTTP ${response.status} ${response.statusText}: ${body}`);
    process.exit(1);
  }

  const teams = (await response.json())?.teams;
  if (!Array.isArray(teams) || teams.length === 0) {
    console.error("The teams endpoint returned no teams.");
    process.exit(1);
  }

  await mkdir(outDir, { recursive: true });

  let written = 0;
  let cached = 0;
  let failed = 0;

  for (const team of teams) {
    const id = Number(team?.id);
    if (!Number.isInteger(id)) {
      warning(`Skipping team without an id: ${team?.name ?? "unknown"}`);
      continue;
    }

    const target = join(outDir, `${id}.png`);
    if (!options.force) {
      try {
        await readFile(target);
        console.log(`Cached  ${team.name} (${id}.png)`);
        cached += 1;
        continue;
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }

    const crestUrl =
      typeof team.crest === "string" && team.crest
        ? team.crest
        : `https://crests.football-data.org/${id}.png`;

    try {
      const bytes = await download(crestUrl);
      await writeFile(target, bytes);
      console.log(`Fetched ${team.name} -> ${id}.png (${bytes.length} bytes)`);
      written += 1;
    } catch (error) {
      failed += 1;
      warning(`Could not fetch crest for ${team.name}: ${error.message}`);
    }
  }

  console.log(
    `Done. ${written} downloaded, ${cached} already cached, ${failed} failed.`,
  );
  if (failed > 0) {
    warning("Failed crests will fall back to colour dots until re-run.");
  }
}

await main();
