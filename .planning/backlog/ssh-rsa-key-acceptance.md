---
backlog_id: 999.1-ssh-rsa-acceptance
created: 2026-05-14
discovered_in: Phase 01 operator smoke-test (Plan 10 Task 3)
severity: medium
type: bug
phase_target: 1.1 or 5
---

# ssh-rsa public keys rejected by backend validator

## Symptom

Operator pasted a valid `ssh-rsa AAAA…` public key into
`/profile/ssh-keys` → "Add SSH key" form. Backend returned 422
"Invalid SSH public key: …" (frontend surface). The same operator's
freshly-generated ed25519 key was accepted without issue.

## Plan-vs-reality gap

Plan 01-05 declares ssh-rsa, ssh-ed25519, and ssh-ecdsa as supported
formats (RESEARCH.md §SSH key parse with fingerprint cites the
`cryptography.serialization.load_ssh_public_key` parser which DOES
support RSA). The actual rejection cause is unknown — possibilities:

1. RSA key uses SHA-1 internally and the installed `cryptography`
   version refuses it (post-CVE-2023-23931 hardening).
2. RSA key has options-prefix (`from="…" ssh-rsa AAAA…`) which the
   text-split based parser cannot handle.
3. RSA key has CRLF line endings or trailing whitespace that
   `text.strip()` doesn't fully sanitize.

## Reproducer needed

Capture the operator's actual key (it's public, no secret), test
directly:

    python -c "from app.ssh_keys.service import parse_ssh_pubkey; print(parse_ssh_pubkey(open('user.pub').read()))"

The exception detail will localize the cause.

## Resolution paths

- If (1): document in UI-SPEC §Add SSH key copy that RSA keys
  generated with `-t rsa` from older `ssh-keygen` may be rejected;
  recommend ed25519.
- If (2): extend `parse_ssh_pubkey` to strip options-prefixes
  before tokenizing.
- If (3): normalize line endings / whitespace before parsing.

## Severity

Medium — ed25519 is the modern default and works; ssh-rsa is legacy
but legitimately in use. Documented workaround available (generate
new ed25519). Not a security issue.

## Phase placement

Either a Phase 1.1 gap-closure plan (along with the dev-proxy and
cookie-secure documentation items), or fold into Phase 5 (polish &
operational hardening) where copy revision happens anyway.
