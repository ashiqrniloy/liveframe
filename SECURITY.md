# Security policy

## Reporting a vulnerability

Report suspected vulnerabilities privately through GitHub's private vulnerability reporting on this repository: **Security → Report a vulnerability** (<https://github.com/ashiqrniloy/liveframe/security/advisories/new>). Do not open a public issue for a vulnerability, and do not include exploit details in a pull request.

Please include the version, a minimal reproduction, and what you expected instead. Reports are acknowledged on the advisory thread; a fix and a coordinated disclosure follow once the impact is understood.

## What the library does and does not guarantee

The trust model is documented in [`docs/security.md`](docs/security.md). In short: widget code is untrusted input, every tree is validated before it is rendered, and the reference runners (`inProcessRunner()`, `workerRunner()`) are not sandboxes — an app that runs hostile widgets supplies its own isolated `Runner`.
