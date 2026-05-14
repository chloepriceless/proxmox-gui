"""Test fixtures package — shared mocks and factories.

This module holds:

- :mod:`tests.fixtures.pve_responses` — canned Proxmox API responses + the
  ``FakeProxmox`` test double that replaces ``proxmoxer.ProxmoxAPI`` during
  unit tests.

proxmoxer 2.3 uses the synchronous ``requests`` library, which respx cannot
intercept (respx is for httpx). So instead of mocking the HTTP layer we mock
``proxmoxer.ProxmoxAPI`` itself with a recording fake — Plan 06's
``<important_constraints>`` explicitly calls for this shape.
"""
