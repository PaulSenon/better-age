# @better-age/core

New core package for the Better Age MVP reimplementation.

Responsibilities:

- artifact codecs and migrations
- identity and key lifecycle
- payload lifecycle
- core ports/adapters contracts
- typed semantic errors, notices, and success outcomes

Payload files use a human-readable `BETTER AGE PAYLOAD` wrapper around untouched
age armor. Core owns formatting, extraction, validation, and the explicit
overwrite/update behavior used by the CLI.

This package should not depend on the CLI or varlock packages.

Implementation plan source:

- `../../.llms/projects/4-cli-core-boundary-hardening/plans/better-age-mvp-reimplementation.md`
