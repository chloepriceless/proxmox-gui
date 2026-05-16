"""Phase 3 jobs module — the arq worker, enqueue contract, UPID poller,
orphan reaper, and the Redis pub/sub event channel.

The arq worker (``worker.py``) runs as a SEPARATE process
(``deploy/systemd/proxmox-gui-worker.service``); it is never imported by
``app.main``. The API process only imports the enqueue helper, the events
pump, and (Plan 02) the routes.
"""
