
## Flaky test: test_jwt.py::test_decode_tampered_signature_raises (found during 04-16)
- The test flips the last base64 char of a JWT signature segment expecting decode to fail.
- The last base64 char only encodes a few significant bits; flipping it sometimes yields
  an equivalent decoded signature → the token still validates → the test fails ~1/3 runs.
- Pre-existing; unrelated to plan 04-16 (node-fit data route). Not fixed here (scope boundary).
- Fix: tamper a byte that materially changes the signature (e.g. flip a mid-segment char,
  or decode→mutate→re-encode the signature bytes).
