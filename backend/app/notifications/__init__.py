"""Notification-bell backend — a derived view over the jobs table (Plan 04-14).

There is NO notification store (D-23). The feed is recent terminal job rows
read straight from the existing ``jobs`` table; the only persisted state is the
per-user ``NotificationSeen`` cursor that drives the unread count.
"""
