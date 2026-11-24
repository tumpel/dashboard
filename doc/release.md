# Dashboard releases

Successful checks on a push to main release shipped changes as one candidate. Conventional commits determine the next version. The `N` in `-rc.N` counts commits since the last stable tag. The plan compares shipped files with the nearest version tag below the checked commit. It excludes Markdown, docs, the license, repository rules, GitHub configuration and package tests.

A pushed version tag releases the commit named by the tag. Both package versions must match the tag. A release publishes the dashboard and pages tarballs with their SHA-256 checksums. To build and verify the tarballs locally, run `npm run pack` and `npm run pack:check`.

The dispatch job sends the tag, commit SHA and asset URLs to control-plane. An empty `CONTROL_PLANE_DISPATCH_TOKEN` warns and passes, and a rejected post fails the job. Use **Re-run failed jobs** to resend the same release after a dispatch failure. Rerunning all jobs fails if the release already exists.
