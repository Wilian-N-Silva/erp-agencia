INSERT INTO permissions (key, description)
VALUES ('graphics.finance_read', 'Visualizar resumo financeiro dos trabalhos da Grafica')
ON CONFLICT (key) DO UPDATE SET description = excluded.description;
--> statement-breakpoint
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.key IN ('technical_admin', 'director') AND p.key = 'graphics.finance_read'
ON CONFLICT DO NOTHING;
