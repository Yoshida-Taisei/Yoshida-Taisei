/**
 * The one build step both entry scripts share: load the crest cache, then write
 * every theme variant of a card.
 *
 * Crests are read from the committed cache and never fetched here, so the
 * scheduled build stays offline-deterministic and cannot break when the crest
 * CDN is slow or down.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { crestLookup, loadCrests } from "./crest-cache.mjs";
import { info } from "./log.mjs";

/**
 * @param {object} input
 * @param {string} input.outDir
 * @param {Record<string, string>} input.files theme name -> file name
 * @param {string | null} input.crestsDir
 * @param {(input: { theme: string, crestForTeam: (team: object) => string | null }) => string} input.render
 *   Returns the SVG for one theme.
 */
export async function buildThemedCards({ outDir, files, crestsDir, render }) {
  const crests = crestsDir ? await loadCrests(crestsDir) : new Map();
  if (crests.size > 0) {
    info(`Using ${crests.size} cached crests from ${crestsDir}`);
  } else if (crestsDir) {
    info(`No cached crests in ${crestsDir}; using colour dots. Run: npm run fetch-crests`);
  }
  const crestForTeam = crestLookup(crests);

  await mkdir(outDir, { recursive: true });
  for (const [theme, filename] of Object.entries(files)) {
    const svg = render({ theme, crestForTeam });
    const target = join(outDir, filename);
    await writeFile(target, svg, "utf8");
    info(`Wrote ${target} (${svg.length} bytes)`);
  }
}
