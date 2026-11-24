# Dashboard releases

Successful checks on a push to main release shipped changes as one candidate. Conventional commits determine the next version. The `N` in `-rc.N` counts commits since the last stable tag. The plan compares shipped files with the nearest version tag below the checked commit. It excludes Markdown, docs, repository rules, workflows and package tests.

A pushed version tag releases the commit named by the tag. Both package versions must match the tag. A release publishes the dashboard and pages tarballs with their SHA-256 checksums. A rerun reuses the published release for its tag.

The release reports the tag, commit SHA and asset URLs to control-plane. An empty `CONTROL_PLANE_DISPATCH_TOKEN` emits a warning. A rejected dispatch fails the run.
