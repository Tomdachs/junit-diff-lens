# Contributing

Please open an issue describing the workflow or bug before undertaking a large feature. Small fixes with a focused regression test are welcome. Treat other contributors respectfully and critique code, not people.

Use Node.js 24, `npm ci`, `npx playwright install --with-deps chromium`, then `npm run check`. Keep fixtures synthetic and small. Never commit real CI artifacts, tokens, private paths, or personal data.

Parser changes need fixtures covering the supported XML shape and failure cases. Compare behavior in a real browser as well as unit tests. Privacy promises must continue to hold: no report uploads, external runtime services, or persistent report storage. Keep English and Japanese UI copy consistent.

Pull requests should explain the observable change and validation. CI must pass before merging or releasing. Dependency versions and lockfile updates belong in the same PR. See [release procedure](docs/releasing.md).
