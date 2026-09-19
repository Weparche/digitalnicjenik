-- Ops sketch: activate a self-serve Publisher tenant owner (replace placeholders).
-- Apply after migrations through0006_auth.sql` and after tenants/entitlements/publication_targets exist.
-- Do not commit real customer PII into the repository.

-- INSERT INTO auth_users (id, email, created_at, updated_at)
-- VALUES ('user-uuid', 'vlasnik@example.hr', datetime('now'), datetime('now'))
-- ON CONFLICT(email) DO NOTHING;
--
-- INSERT INTO tenant_members (id, tenant_id, user_id, role, created_at)
-- SELECT 'member-uuid', 'tenant-id', id, 'owner', datetime('now')
-- FROM auth_users WHERE email = 'vlasnik@example.hr'
-- ON CONFLICT(tenant_id, user_id) DO NOTHING;

SELECT 'See CLOUDFLARE.md — Activating a self-serve Publisher tenant' AS note;
