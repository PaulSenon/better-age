---
"@better-age/cli": patch
---

`bage edit` no longer rejects payload text that is not `KEY=value` `.env` syntax. Any saved text is encrypted and stored as-is; the `PAYLOAD_ENV_INVALID` error and its "Reopen editor" recovery prompt are removed.
