# Baltic Quota Builder

Separate Latvia and Lithuania quota-builder project.

This repository is intentionally separate from the existing Estonia quota builder so changes here cannot affect the Estonian app, API, or deployment.

## Scope

- Latvia data source: Official Statistics Portal of Latvia API / PxWeb API.
- Lithuania data source: Official Statistics Portal SDMX 2.1 REST API.
- Estonia is not included in this app.

## Local Use

Open `index.html` in a browser. No build step is required.

## What It Does

- Fetches Latvia and Lithuania population data from Eurostat demographic tables.
- Calculates sex, age, regional, and sex-by-age interlocked quotas.
- Uses the largest-remainder method so quota totals match the requested sample size.
- Suggests quick, standard, and robust sample sizes from the selected population base.
- Exports tables as copied TSV or downloaded CSV.

## GitHub Pages

After pushing this repo to GitHub, enable Pages from:

`Settings -> Pages -> Deploy from a branch -> main -> /root`

The app will then be available from:

`https://<github-user>.github.io/baltic-quota-builder/`

## Project Layout

- `index.html` - app shell
- `styles.css` - page styling
- `app.js` - UI controller
- `src/data-sources/latvia.js` - Latvia national API adapter scaffold
- `src/data-sources/lithuania.js` - Lithuania national API adapter scaffold

## Next Implementation Steps

1. Add education, citizenship, and country-of-birth tables after mapping source category codes.
2. Replace or supplement Eurostat with national API adapters where national tables provide better detail.
3. Add automated consistency tests for totals and regional splits.
4. Keep deployments separate from the Estonian quota builder until Latvia/Lithuania are fully verified.
