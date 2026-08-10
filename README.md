# Baltic Quota Builder

Separate Latvia and Lithuania quota-builder project.

This repository is intentionally separate from the existing Estonia quota builder so changes here cannot affect the Estonian app, API, or deployment.

## Scope

- Latvia data source: Official Statistics Portal of Latvia API / PxWeb API.
- Lithuania data source: Official Statistics Portal SDMX 2.1 REST API.
- Estonia is not included in this app.

## Local Use

Open `index.html` in a browser. No build step is required.

## GitHub Pages

After pushing this repo to GitHub, enable Pages from:

`Settings -> Pages -> Deploy from a branch -> main -> /root`

The app will then be available from:

`https://<github-user>.github.io/baltic-quota-builder/`

## Project Layout

- `index.html` - app shell
- `styles.css` - page styling
- `app.js` - UI controller
- `src/data-sources/latvia.js` - Latvia API adapter
- `src/data-sources/lithuania.js` - Lithuania API adapter

## Next Implementation Steps

1. Identify the exact Latvia and Lithuania source tables for age, gender, region, education, language, citizenship, and country of birth.
2. Map each table's native codes to shared quota dimensions.
3. Add consistency tests for totals and regional splits before publishing live calculations.
4. Keep deployments separate from the Estonian quota builder until Latvia/Lithuania are fully verified.
