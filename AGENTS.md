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
- `npm run pack` builds the release tarballs into `release/`. Successful checks on a shipped main commit publish an immutable release candidate. A `vX.Y.Z` tag still releases: its version must match both packages. Release scripts stamp candidates only in the build checkout; never bump versions by hand for a main release.
- Script tests run the real release planner with convco 0.7.2, the same version installed in CI.
- The types, schemas and clients come from the `tumpel/protocol` release tarballs. To change one, change the TypeSpec in `tumpel/protocol`, release it, and bump the tarball URLs here.

## Client compatibility

Ship clients before the back end that serves a change. Clients must keep working with the old API during rollout and tolerate unknown response enums, failure reasons, pause reasons and extra fields. Show a plain update message for unknown values, keep known work available and retain strict request validation. Readiness acknowledgements cover only Tumpel-run clients; cached browsers and externally installed clients rely on tolerant decoding.
