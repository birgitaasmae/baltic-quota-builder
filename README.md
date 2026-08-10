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

- Fetches Latvia and Lithuania population data from local official statistics bureau APIs.
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
- `api/lithuania-population.js` - serverless proxy for Lithuania OSP SDMX data
- Latvia: Central Statistics Bureau API v2 table `IRD041`
- Lithuania: State Data Agency / Official Statistics Portal SDMX flow `S3R167_M3010222`

## Backend Proxy

GitHub Pages cannot reliably call Lithuania's SDMX XML endpoint directly from the browser. The Lithuania calculator uses a small serverless proxy:

`/api/lithuania-population?year=2024`

Deploy this same repository to Vercel to make the proxy available.

## Next Implementation Steps

1. Add education, citizenship, and country-of-birth tables after mapping source category codes.
2. Map the Lithuanian territorial matrix for regional quotas.
3. Add automated consistency tests for totals and regional splits.
4. Keep deployments separate from the Estonian quota builder until Latvia/Lithuania are fully verified.
