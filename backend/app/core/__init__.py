"""Foundational primitives shared across every domain module.

No package in ``app.core`` may import from a domain package (auth, users, teams,
clusters, etc.). Domain packages depend on ``app.core``, never the reverse.
"""
