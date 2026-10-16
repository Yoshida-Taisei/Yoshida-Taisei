/**
 * Minimal client for football-data.org: build a Premier League resource URL and
 * GET it as JSON with the retry policy the scheduled job relies on.
 */

import { warning } from "./log.mjs";

const COMPETITION_BASE = "https://api.football-data.org/v4/competitions/PL";

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

/**
 * @param {string} resource e.g. "standings" or "matches"
 * @param {string|number} [season] season start year
 * @returns {URL}
 */
export function apiUrl(resource, season) {
  const url = new URL(`${COMPETITION_BASE}/${resource}`);
  if (season) url.searchParams.set("season", season);
  return url;
}

/**
 * GET `url` as JSON. Rate limits and transient errors are retried three times;
 * a final failure throws, so the caller can decide to skip the run.
 *
 * @param {URL} url
 * @param {string} token
 * @param {string} resource label for the "no access" error, e.g. "standings"
 * @returns {Promise<object>}
 */
export async function fetchFootballData(url, token, resource) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "X-Auth-Token": token },
        signal: AbortSignal.timeout(20_000),
      });

      const remaining = response.headers.get("X-Requests-Available-Minute");
      if (remaining != null) console.log(`API requests left this minute: ${remaining}`);

      if (response.status === 429) {
        warning("Rate limited by football-data.org (429). Retrying.");
        await sleep(attempt * 15_000);
        continue;
      }
      if (response.status === 403) {
        throw new Error(
          `403 from football-data.org. The token is invalid or has no access to the PL ${resource}.`,
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
