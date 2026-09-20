# Security policy

Security fixes are supported on the latest release. This is a static browser app: it never executes test code, fetches report URLs, or sends file contents to a backend. Report files are untrusted input. DTD/entity declarations are rejected, inputs are bounded, and message text must never become executable HTML.

Please report vulnerabilities privately through [GitHub private vulnerability reporting](https://github.com/Tomdachs/junit-diff-lens/security/advisories/new). Include a synthetic reproduction and affected browser/version. Do not include real secrets or private test reports. If that form is unavailable, open an issue requesting a private channel without disclosing exploit details or sensitive content.

Do not assume test names or exported summaries are anonymous. The tool is not a secret scrubber, a security scanner, or a sandbox for running test code.
