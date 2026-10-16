# Test fixtures

`standings.sample.json` is a **synthetic** copy of a football-data.org
`/v4/competitions/PL/standings` response.

`matches.sample.json` is a **trimmed capture** of a real
`/v4/competitions/PL/matches` response, keeping only matchdays 6 and 7 (all
20 matches) and the fields the fixtures renderer reads.

Neither is live match data. They exist so the SVG renderers can be developed
and visually checked without an API token:

```sh
node scripts/generate-standings.mjs --fixture scripts/fixtures/standings.sample.json
node scripts/generate-fixtures.mjs --fixture scripts/fixtures/matches.sample.json
```

The payload shape (keys, nesting, column names) matches the live API, so if the
renderers work against these fixtures they will work against the real response.
