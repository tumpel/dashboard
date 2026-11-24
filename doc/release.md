# Dashboard releases

Shipped changes determine the next version under the conventional commit rules. The `N` in `-rc.N` counts commits since the last stable tag, including commits that change only documentation. A candidate skips publication when no shipped files have changed since the nearest version tag.

The release publishes both package tarballs and their SHA-256 checksums. A rerun reuses a published release at the checked commit when it already contains all four files. After publication, dispatch reports the exact release to control-plane. An empty `CONTROL_PLANE_DISPATCH_TOKEN` skips dispatch with a notice. A rejected dispatch fails the run.
