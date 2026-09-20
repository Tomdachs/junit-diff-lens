JUnit Diff Lens compares two JUnit XML test reports locally in your browser.

- New failures, recoveries, persistent failures, added/removed tests, and status changes.
- Timing deltas and a passing-test slowdown filter.
- Search, pagination, literal failure details, and JSON/Markdown export.
- English and Japanese interfaces; no accounts, uploads, analytics, or stored reports.

**Try it:** https://tomdachs.github.io/junit-diff-lens/

**Offline/local:** download and extract the ZIP, then run `python3 -m http.server 8080 --bind 127.0.0.1` in the extracted directory. Open http://127.0.0.1:8080. Windows users can use `py` instead of `python3`. SHA256SUMS verifies the ZIP.

Limits: one UTF-8 XML per side, 5 MiB / 20,000 testcases each. Duplicate identities are rejected. Retries and suite-level errors produce warnings. Exports omit failure messages/logs but include test names and filenames; review them before sharing.

Validation: parser/comparison unit tests, TypeScript/build, and Chromium desktop/mobile browser journeys. See the CI run for this tag. This is an initial release; external adoption has not yet been established.
