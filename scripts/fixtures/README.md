# Test fixtures

`standings.sample.json` is a **synthetic** copy of a football-data.org
`/v4/competitions/PL/standings` response.

It is not real match data. It exists so that the SVG renderer can be developed
and visually checked without an API token:

```sh
node scripts/generate-standings.mjs --fixture scripts/fixtures/standings.sample.json
```

The payload shape (keys, nesting, column names) matches the live API, so if the
renderer works against this fixture it will work against the real response.
