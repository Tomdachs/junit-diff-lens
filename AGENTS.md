# AGENTS.md

## Product boundaries

- Keep reports in tab memory. Do not introduce report uploads, external runtime assets, analytics, or persistent report storage.
- Match tests by the documented identity and reject ambiguity; skipped or missing tests must never count as recovered failures.
- Treat XML and failure messages as untrusted data. Preserve input bounds, DTD rejection, and plain-text rendering.
- Use synthetic fixtures only. Keep actual CI reports, private names, logs, and credentials out of the repository.
- The comparison contract and validation commands live in README; release gates and distribution live in docs/releasing.md.
