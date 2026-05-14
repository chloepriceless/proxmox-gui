# Phase 01 — Deferred items (out-of-scope discoveries)

This file collects pre-existing issues discovered during plan execution that
were OUT of scope for the current task (deviation-rule scope boundary). They
should be addressed in a focused follow-up — not silently fixed by an
unrelated plan.

## From Plan 06 (clusters-tenant-bootstrap) — 2026-05-14

### 1. Flaky `tests/test_jwt.py::test_decode_tampered_signature_raises`

- **Owner:** Plan 01-01 / 01-05 (JWT primitives)
- **Symptom:** `pytest tests/test_jwt.py::test_decode_tampered_signature_raises`
  fails intermittently with `Failed: DID NOT RAISE pyjwt.InvalidTokenError`.
  Pass rate: ~3/5 across local runs.
- **Cause:** The test flips the LAST character of the base64url signature
  segment between `"A"` and `"B"`. Both decode to similar 6-bit boundary
  bytes; depending on the original signature length and padding the
  resulting bytes can yield a still-valid HMAC verification (this is a
  base64 length-alignment / padding artifact, not a crypto break).
- **Fix sketch:** Either flip a MIDDLE byte of the signature segment, or
  XOR-flip the decoded signature bytes and re-encode. Track in a follow-up
  Plan 5 polish item or as an inline fix in the next auth-touching plan.
- **Not blocking** Plan 06: this is a pre-existing issue, unrelated to any
  Plan-06 code path.
