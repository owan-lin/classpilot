# Contributing to ClassPilot

ClassPilot uses a single `main` branch for releases and short-lived branches for implementation work.

## Development checks

Run these checks before handing work to the integration controller:

```bash
npm run lint
npm test
npm run build
```

Do not commit real student names, contact information, exported workbooks, local databases, or ClassPilot backup files. Tests and screenshots must use fictional data.

## Ownership boundaries

- Domain and data work belongs under `src/domain`, `src/data`, and feature modules.
- Presentational work belongs under `src/ui` and `src/styles` where practical.
- Tests belong beside pure modules or under `tests` for end-to-end coverage.
- Integration files and release workflows are owned by the main controller.

## Commit handoff

Each task should commit its work on its own branch and report the commit SHA, changed areas, checks run, and known limitations. Do not merge or push directly to `main`.
