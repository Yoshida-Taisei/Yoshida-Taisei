# scripts

No dependencies and no lockfile - Node built-ins only.

| File | Role |
| --- | --- |
| `generate-standings.mjs` | Fetches the table, validates it, writes the SVGs. Entry point. |
| `generate-fixtures.mjs` | Fetches the season's matches, picks the previous and next matchday, writes the SVGs. |
| `fetch-crests.mjs` | Manual one-off: downloads club crests into `scripts/crests/`. |
| `lib/render-standings.mjs` | Pure SVG layout for the standings table. No network access. |
| `lib/render-fixtures.mjs` | Pure SVG layout for results / fixtures. No network access. |
| `lib/svg.mjs` | Shared card chrome, palettes, badge and text helpers. |
| `lib/build.mjs` | Loads the crest cache and writes both theme variants of a card. |
| `lib/football-data.mjs` | Builds the API URL and GETs it as JSON, with retries. |
| `lib/log.mjs` | How the entry scripts print progress, warn and bail. |
| `lib/crest-cache.mjs` | Reads the crest cache into base64 `data:` URIs. No network access. |
| `lib/team-colours.mjs` | Hand-maintained TLA → club colour map used for the dots. |
| `lib/japanese-players.mjs` | Hand-maintained set of club ids that have a Japanese player. |
| `lib/japan-flag.mjs` | Draws the inline Japan flag and estimates text width for placing it. |
| `fixtures/standings.sample.json` | Synthetic API response for offline development. |
| `fixtures/matches.sample.json` | Trimmed captured matches response for offline development. |

## Running locally

```sh
# Offline, against the fixtures
npm run generate:sample
npm run generate:fixtures:sample

# Against the live API
FOOTBALL_DATA_API_TOKEN=xxxxxxxx node scripts/generate-standings.mjs
FOOTBALL_DATA_API_TOKEN=xxxxxxxx node scripts/generate-fixtures.mjs

# Or keep the token in .env (gitignored) - see .env.example
cp .env.example .env
node --env-file=.env scripts/generate-standings.mjs
node --env-file=.env scripts/generate-fixtures.mjs
```

Output goes to `assets/premier-league-light.svg` and
`assets/premier-league-dark.svg` (standings), plus
`assets/premier-league-fixtures-light.svg` and `...-dark.svg` (results /
fixtures). Override with `--out <dir>`.

## Token

Register at <https://www.football-data.org/client/register> (free) and put the
token in the repository secret `FOOTBALL_DATA_API_TOKEN`. The free tier covers
the Premier League table and allows 10 requests/minute; this job makes one
request every three hours.

For local runs, copy `.env.example` to `.env` and fill in the same token. `.env`
is gitignored; only the empty template is committed.

## Failure behaviour

The job is designed to never publish a broken table:

- Network / API errors are retried three times, then the run **exits 0 with a
  warning** and the previous SVG stays in place.
- A payload that does not contain a 20-team `TOTAL` table is rejected the same
  way.
- `git diff --quiet` means an unchanged table produces no commit at all.

The only non-zero exit is missing configuration, e.g. an unset token.

## Crests

Club badges are read from the committed cache in `scripts/crests/<teamId>.png`,
never fetched at build time. The generator inlines them as base64 `data:` URIs,
so the scheduled build stays offline-deterministic and cannot break when the
crest CDN is slow or down.

The cache is populated by hand, only when the set of clubs changes (promotion /
relegation):

```sh
npm run fetch-crests            # skips files that are already cached
npm run fetch-crests -- --force # re-download everything
```

Then commit `scripts/crests/` together with the regenerated SVGs. Teams with no
cached file fall back to the colour dot, so a partial cache is never fatal.
The cache may contain clubs outside the current season; the generator ignores
them.

Size is the trade-off: 20 crests are ~250 KB of PNG, which becomes ~350 KB per
SVG once base64-encoded. The README loads one theme, so a profile view pulls
~350 KB instead of ~25 KB. If that matters, the fix is to downscale the PNGs
before caching (they are 200×200 but render at 16 px), which needs a small PNG
re-encoder in `fetch-crests.mjs`.

## Why the SVG is self-contained

GitHub renders README images as `<img>`. Browsers do not load external
resources (web fonts, `<image href>`) inside an SVG used that way, so club
crests and custom fonts would silently disappear. Everything here is therefore
inline: shapes, text, and a system font stack.

Crests get around this by being embedded as base64 `data:` URIs, which are part
of the document rather than an external request. That is why the cache is
committed instead of linked.

## Design decisions

- **Two themes.** `prefers-color-scheme` is resolved by the README's
  `<picture>` element, not inside the SVG, because SVG-as-image media query
  support is inconsistent.
- **Zone stripes** at the left edge mark Champions League (1–4), Europa League
  (5) and relegation (18–20). Adjust `ZONES` in `lib/render-standings.mjs`.
- **Club colours** live in `lib/team-colours.mjs` because the standings
  endpoint does not return them. Unknown codes fall back to grey, so
  promotion and relegation never break the render.
- **Crest over dot.** A cached crest wins; otherwise the colour dot is drawn.
  The two share a centre (`DOT_X`) and the crest box is 16 px, sized for the
  ~2.6× downscale a browser applies at README width.
- **No crest plate.** Crests are drawn straight onto the card in both themes,
  matching the fixtures card. Earlier the dark theme added an `#e6edf3` disc
  behind each crest, but the resulting white circles read as a mistake on the
  dark card, so the plate was dropped. The cost is that navy/black crests
  (Spurs, Everton) sit low-contrast on `#161b22` in both cards.
- **Japan flag.** Clubs with a Japanese player get a small flag after the name
  in the standings and beside the name in the fixtures. The flag is drawn as
  shapes, not the 🇯🇵 emoji: GitHub renders README images as `<img>`, and flag
  emoji degrade to bare `JP` letters where no colour flag font exists (Windows).
  The set of club ids in `lib/japanese-players.mjs` is hand-maintained — the API
  has no player nationality — and only needs a look after each transfer window.
  A club that is not listed simply renders without the flag, so promotion and
  relegation never break the render. Placement uses `estimateTextWidth`, since
  SVG cannot measure text; a wide empty column follows every name, so the
  approximation only ever drifts the flag into blank space.
