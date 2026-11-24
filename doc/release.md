# Dashboard releases

Successful main checks trigger release planning for that exact source SHA. The planner uses the completed source run and its conclusion directly. Tagged releases query the newest exact-SHA main push check once; missing, incomplete or failed checks and API errors stop immediately.

The planner uses convco 0.7.2 and the conventional commit rules shared by the other components. Shipped changes determine the next stable version; the number of commits since the stable tag determines its `-rc.N` suffix. A release changes both package versions and their workspace lockfile entries only in the build checkout. A `vX.Y.Z` tag keeps its manifest-matching release path.

Publication builds both packages, packs and import-checks their tarballs, and calculates SHA-256 checksums. The release stays a draft until all four assets are uploaded. Published artifacts remain immutable. The workflow-provided GitHub token supplies `GH_TOKEN` for same-repository checks and publication.

After publication, the `dispatch-control-plane` step reads only `CONTROL_PLANE_DISPATCH_TOKEN` to dispatch `component-released` to control-plane. Its payload carries `component`, `repository`, `sha`, `tag` and the tarball and checksum `assets` URLs. An empty token logs a notice and skips successfully; dispatch never falls back to another token. Repository credentials are installed separately.

Dispatch supplies release provenance, not activation readiness. Downstream dependency updates must use reviewed bot pull requests with required gates. Downstream activation must ship clients before their API and wait for the online stage supervisors; readiness acknowledgements cover only Tumpel-run clients. Cached browsers rely on tolerant response decoding and the dashboard's update notice.

The dashboard pins protocol `v1.0.0-rc.39`, which keeps the APIs its views use. Later protocol releases remove provider APIs and require a separate view migration before this pin advances.
