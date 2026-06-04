# Demo screenshot harness

Regenerates the authenticated README screenshots (`docs/screenshot-inventory.png`,
`docs/screenshot-vm-detail.png`) **without touching any real Proxmox host**.

It runs the *real* FastAPI backend and SvelteKit UI, but swaps the live
Proxmox connection for an in-process `FakeProxmox` double seeded with an
entirely **fictional** inventory (see `VMS` in `demo_server.py`). Because the
backend still produces schema-correct JSON, the UI renders exactly as it would
in production — no real host, VM, IP, or cluster name ever appears, so the
output is safe to commit to a public repo.

## Run

Two processes + one capture, from the repo root:

```bash
# 1. Seeded fake backend on :8000  (admin / demo-admin)
cd backend && .venv/bin/python ../scripts/demo-screenshots/demo_server.py

# 2. Frontend dev server on :5173 (separate shell)
cd frontend && PROXMOX_GUI_BACKEND_URL=http://127.0.0.1:8000 pnpm dev --host 127.0.0.1 --port 5173

# 3. Log in + capture (separate shell, once both are up)
node scripts/demo-screenshots/shot.mjs http://127.0.0.1:5173 "$PWD/docs"
```

`shot.mjs` reuses a Playwright + chromium install under `/tmp/pwshot` if present,
otherwise the frontend's local `node_modules`.

## Notes

- Local-only demo posture: ephemeral SQLite at `/tmp/proxmox-gui-demo.db`, a
  fixed 32-byte master key at `/tmp/proxmox-gui-demo-master.key`, and
  `PROXMOX_GUI_COOKIE_SECURE=false` so cookies work over plain `http://localhost`.
  None of this is a deployment artifact — the demo admin password is hardcoded
  on purpose and only ever guards a throwaway local DB.
- Redis is not required; the job queue logs a warning and disables itself,
  which does not affect the inventory/detail views being captured.
- Re-running is idempotent: the seed step reuses the DB if an `admin` user
  already exists. Delete `/tmp/proxmox-gui-demo.db` for a clean reseed.
