# Dashboard releases

Shipped changes determine the next version under the conventional commit rules. The `N` in `-rc.N` counts commits since the last stable tag, including commits that change only documentation. A candidate skips publication when no shipped files have changed since the nearest version tag.

The release publishes both package tarballs and their SHA-256 checksums. After publication, dispatch reports the exact release to control-plane. If dispatch fails because its token is missing, set `CONTROL_PLANE_DISPATCH_TOKEN`.

Clients ship before the API that serves them. Cached browsers keep working across that rollout through tolerant response decoding and show an update notice when the service sends an unknown value.
