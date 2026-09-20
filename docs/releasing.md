# Release procedure

1. Update `package.json`, its lockfile, UI version, and release download name in README. Document behavior changes in the release notes.
2. Run `npm ci`, install Playwright Chromium, then `npm run check`. Review the diff and runtime dependency licenses.
3. Merge only after PR CI passes. The initial repository bootstrap is a directly pushed, locally validated main commit; subsequent work uses PRs.
4. Wait for the exact main commit's CI and Pages deployment to succeed. Smoke-test the published URL.
5. Tag that commit `vX.Y.Z` and push the tag. Tag CI repeats validation, packages the static app and license notices, calculates SHA-256, and creates a GitHub Release only after success. Never move a published tag.
6. Download the release ZIP, verify its checksum, serve it on localhost, and smoke-test the packaged app.

The same workflow validates pull requests and main pushes. Deployment runs only on main; release publication runs only on version tags. Neither runs for untrusted pull requests. GitHub Pages must use the GitHub Actions publishing source. To reproduce release packaging locally after a build, run `python3 scripts/package-release.py`.

The archive contains only built assets, licenses, and a short usage file. No reports, repository configuration, dependencies directory, or development artifacts are included. HTTPS hosting and localhost HTTP hosting are supported; opening `index.html` via `file://` is not supported.
