# Baltic Quota Builder

Separate Baltic quota-builder project for Estonia, Latvia, and Lithuania.

This repository is intentionally separate from the existing Estonia quota builder so changes here cannot affect the older Estonian app, API, or deployment.

## Scope

- Estonia data source: Statistics Estonia API / PxWeb API.
- Latvia data source: Official Statistics Portal of Latvia API / PxWeb API.
- Lithuania data source: Official Statistics Portal SDMX 2.1 REST API.

## Local Use

Open `index.html` in a browser. No build step is required.

## What It Does

- Fetches Estonia, Latvia, and Lithuania population data from local official statistics bureau APIs.
- Calculates sex, age, regional, type-of-settlement, nationality, education, and sex-by-age interlocked quotas, with separate show/hide controls for regional, settlement, and education tables.
- Uses the largest-remainder method so quota totals match the requested sample size.
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
- Estonia: Statistics Estonia table `RV0240`; regional quotas use Tallinn separately and counties, with Harju county calculated without Tallinn.
- Estonia type of settlement: Statistics Estonia table `RV0240`
- Estonia nationality: Statistics Estonia table `RV022U`
- Estonia education: Statistics Estonia table `RV0231U`
- Latvia: Central Statistics Bureau API v2 table `IRD041`
- Latvia type of settlement: Central Statistics Bureau table `IRD081`; uses official 5-year age groups that cover the selected age range.
- Latvia nationality: Central Statistics Bureau table `IRE010`
- Latvia education: Central Statistics Bureau table `IZT010`
- Lithuania: State Data Agency / Official Statistics Portal SDMX flow `S3R167_M3010202`
- Lithuania type of settlement: State Data Agency / Official Statistics Portal SDMX flows `S3R167_M3010206` and `S3R167_M3010210_1`; uses official age groups that cover the selected age range.
- Lithuania nationality: State Data Agency / Official Statistics Portal SDMX flow `S3R167_M3010215_1`
- Lithuania education: State Data Agency / Official Statistics Portal SDMX flow `S3R143_M3110116`

## Backend Proxy

GitHub Pages cannot reliably call Lithuania's SDMX XML endpoint directly from the browser. The Lithuania calculator uses a small serverless proxy:

`/api/lithuania-population?year=2024`

Deploy this same repository to Vercel to make the proxy available.

## Next Implementation Steps

1. Add citizenship and country-of-birth tables after mapping source category codes.
2. Add automated consistency tests for totals and regional splits.
3. Keep deployments separate from the older Estonian quota builder.
