# Agent rules

Always follow `rules/errors.md` and `rules/coding-standards.md`.

- When writing TypeScript, follow `rules/typescript.md`.
- When writing or changing a test, follow `rules/tests.md`.
- When committing or opening a pull request, follow `rules/commits-and-prs.md`.
- When writing text a user reads, docs, an issue or a PR body, follow `rules/writing.md`.

## Unknown values

The dashboard reads API responses with the protocol's `decode`, keeps the known fields, and tells users to update when the result lists unrecognised wire values, naming those values. An extra field alone gives no update signal. An unknown value never makes the dashboard crash or throw.

## Commands

- `npm install` installs dependencies.
- `npm run check` runs every check. `npm run fix` formats.
- `npm test` runs the TypeScript tests.
- `npm run build` builds the dashboard into `packages/dashboard/dist/`.
- `npm run build-storybook` builds the Storybook.
- `npm run pack` builds the release tarballs into `release/`. A `vX.Y.Z` tag releases: the version must match both `packages/*/package.json`.
- The types, schemas and clients come from the `tumpel/protocol` release tarballs. To change one, change the TypeSpec in `tumpel/protocol`, release it, and bump the tarball URLs here.
