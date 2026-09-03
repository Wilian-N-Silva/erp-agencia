INSERT INTO "permissions" ("key", "description")
VALUES
  ('graphics.read', 'Visualizar trabalhos da Grafica'),
  ('graphics.write', 'Criar e alterar trabalhos da Grafica')
ON CONFLICT ("key") DO UPDATE SET "description" = excluded."description";
--> statement-breakpoint
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT role."id", permission."id"
FROM "roles" AS role
CROSS JOIN "permissions" AS permission
WHERE (
    role."key" IN ('technical_admin', 'director')
    AND permission."key" IN ('graphics.read', 'graphics.write')
  ) OR (
    role."key" = 'finance'
    AND permission."key" = 'graphics.read'
  )
ON CONFLICT DO NOTHING;
