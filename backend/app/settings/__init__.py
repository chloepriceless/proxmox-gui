"""DB-backed runtime settings (D-01).

The ``settings`` package owns the single-row :class:`app.models.AppSetting`
config table and the admin ``GET/PATCH /api/v1/admin/settings`` surface. It is
the canonical home for the idle-session-timeout value (D-02) and the
audit-log retention value (D-06); changes take effect without a restart.
"""
