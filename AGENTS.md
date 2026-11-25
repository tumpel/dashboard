# Agent rules

Always follow `rules/errors.md` and `rules/coding-standards.md`.

- When writing TypeScript, follow `rules/typescript.md`.
- When writing or changing a test, follow `rules/tests.md`.
- When committing or opening a pull request, follow `rules/commits-and-prs.md`.
- When writing text a user reads, docs, an issue or a PR body, follow `rules/writing.md`.

## Commands

- `npm install` installs dependencies.
- `npm run check` runs every check. `npm run fix` formats.
- `npm test` runs the TypeScript tests.
- `npm run build` builds the dashboard into `packages/dashboard/dist/`.
- `npm run build-storybook` builds the Storybook.
- `npm run pack` builds the release tarballs into `release/`. A `vX.Y.Z` tag releases: the version must match both `packages/*/package.json`.
- The types, schemas and clients come from the `tumpel/protocol` release tarballs. To change one, change the TypeSpec in `tumpel/protocol`, release it, and bump the tarball URLs here.

On `main`, checks publish a candidate from the tarball they packed for that commit when its diff from its parent includes a shipped change. Publication and the dashboard pin bump run in separate jobs. Re-run failed jobs to retry a failed pin bump against the same published candidate.
