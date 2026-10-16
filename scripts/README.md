# scripts

Two small files and a fixture. No dependencies, no lockfile.

| File | Role |
| --- | --- |
| `generate-standings.mjs` | Fetches the table, validates it, writes the SVGs. Entry point. |
| `lib/render-standings.mjs` | Pure SVG layout + theme palettes. No network access. |
| `lib/team-colours.mjs` | Hand-maintained TLA → club colour map used for the dots. |
| `fixtures/standings.sample.json` | Synthetic API response for offline development. |

## Running locally

```sh
# Offline, against the fixture
npm run generate:sample

# Against the live API
FOOTBALL_DATA_API_TOKEN=xxxxxxxx node scripts/generate-standings.mjs
```

Output goes to `assets/premier-league-light.svg` and
`assets/premier-league-dark.svg`. Override with `--out <dir>`.

## Token

Register at <https://www.football-data.org/client/register> (free) and put the
token in the repository secret `FOOTBALL_DATA_API_TOKEN`. The free tier covers
the Premier League table and allows 10 requests/minute; this job makes one
request every three hours.

## Failure behaviour

The job is designed to never publish a broken table:

- Network / API errors are retried three times, then the run **exits 0 with a
  warning** and the previous SVG stays in place.
- A payload that does not contain a 20-team `TOTAL` table is rejected the same
  way.
- `git diff --quiet` means an unchanged table produces no commit at all.

The only non-zero exit is missing configuration, e.g. an unset token.

## Why the SVG is self-contained

GitHub renders README images as `<img>`. Browsers do not load external
resources (web fonts, `<image href>`) inside an SVG used that way, so club
crests and custom fonts would silently disappear. Everything here is therefore
inline: shapes, text, and a system font stack.

If crests are wanted later, they must be fetched and embedded as base64
`data:` URIs by the generator — expect the file to grow to a few hundred KB.

## Design decisions

- **Two themes.** `prefers-color-scheme` is resolved by the README's
  `<picture>` element, not inside the SVG, because SVG-as-image media query
  support is inconsistent.
- **Zone stripes** at the left edge mark Champions League (1–4), Europa League
  (5) and relegation (18–20). Adjust `ZONES` in `lib/render-standings.mjs`.
- **Club colours** live in `lib/team-colours.mjs` because the standings
  endpoint does not return them. Unknown codes fall back to grey, so
  promotion and relegation never break the render.
