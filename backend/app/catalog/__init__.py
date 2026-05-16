"""Community-scripts catalog module — LXC-01/02/04 (Plan 04-06).

The catalog backend serves a curated shortlist (LXC-01) and a searchable full
catalog (LXC-02) from a commit-pinned snapshot, with an admin sync that re-pins
the ``catalog_pin`` row (D-05/D-06). Every entry surfaces its source GitHub
link, the pinned commit SHA, and the last-reviewed date (LXC-04).
"""
