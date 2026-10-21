# Maintenance scripts

Scripts are grouped by responsibility: `database`, `data`, `firebase`, `geospatial`, and `smoke`. Prefer the named npm commands in the root `package.json`; they resolve paths from the repository root and keep routine operations reproducible.

Use `npm run validate:uganda-support` before `npm run db:enrich:uganda-geodata`; the enrichment never guesses ambiguous location matches.

`maintenance/` contains repository-quality checks rather than runtime tasks. Run `npm.cmd run docs:validate` after changing documentation to verify maintained local links.
