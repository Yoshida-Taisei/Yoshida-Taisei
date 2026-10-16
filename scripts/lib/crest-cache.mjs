import { readFile, readdir } from "node:fs/promises";
import { extname, join } from "node:path";

const MIME_BY_EXTENSION = {
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

/**
 * Read the committed crest cache into a Map<teamId, dataUri>.
 *
 * A missing directory is not an error: every caller treats "no crest" as
 * "draw the colour dot instead", so a fresh clone without the cache still
 * renders a valid table.
 *
 * @param {string} dir
 * @returns {Promise<Map<number, string>>}
 */
export async function loadCrests(dir) {
  const crests = new Map();

  let entries;
  try {
    entries = await readdir(dir);
  } catch (error) {
    if (error.code === "ENOENT") return crests;
    throw error;
  }

  for (const entry of entries.sort()) {
    const mime = MIME_BY_EXTENSION[extname(entry).toLowerCase()];
    const id = Number.parseInt(entry, 10);
    if (!mime || !Number.isInteger(id)) continue;

    const bytes = await readFile(join(dir, entry));
    if (bytes.length === 0) continue;

    crests.set(id, `data:${mime};base64,${bytes.toString("base64")}`);
  }

  return crests;
}

/**
 * Build the lookup the renderer expects. Unknown teams resolve to null and
 * fall back to the colour dot.
 *
 * @param {Map<number, string>} crests
 * @returns {(team: { id?: number } | undefined) => string | null}
 */
export function crestLookup(crests) {
  return (team) => {
    const id = Number(team?.id);
    if (!Number.isInteger(id)) return null;
    return crests.get(id) ?? null;
  };
}
