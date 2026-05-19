# Project Context

This is a typescript project using next-app with drizzle.

The database has 27 models. See .codesight/schema.md for the full schema with fields, types, and relations.
The UI has 9 components. See .codesight/components.md for the full list with props.
Middleware includes: custom, auth.

High-impact files (most imported, changes here affect many other files):
- src\lib\audit\types.ts (imported by 4 files)
- src\lib\rbac\permissions.ts (imported by 3 files)
- src\lib\audit\sanitize.ts (imported by 2 files)
- src\lib\rbac\errors.ts (imported by 2 files)
- src\lib\rbac\policy.ts (imported by 2 files)
- src\lib\audit\guards.ts (imported by 1 files)
- src\lib\audit\logger.ts (imported by 1 files)
- src\lib\audit\request.ts (imported by 1 files)

Required environment variables (no defaults):
- ALLOWED_EMAIL_DOMAIN (.env.example)
- BETTER_AUTH_SECRET (.env.example)
- DATABASE_DIRECT_URL (.env.example)
- DATABASE_URL (.env.example)
- GOOGLE_CLIENT_ID (.env.example)
- GOOGLE_CLIENT_SECRET (.env.example)
- INITIAL_ADMIN_EMAIL (.env.example)
- INITIAL_ADMIN_NAME (.env.example)
- STORAGE_ACCESS_KEY_ID (.env.example)
- STORAGE_BUCKET (.env.example)
- STORAGE_PROVIDER (.env.example)
- STORAGE_REGION (.env.example)
- STORAGE_SECRET_ACCESS_KEY (.env.example)
- TEST_OPTIONAL_ENV (src\tests\env.test.ts)
- TEST_REQUIRED_ENV (src\tests\env.test.ts)

Read .codesight/wiki/index.md for orientation (WHERE things live). Then read actual source files before implementing. Wiki articles are navigation aids, not implementation guides.
Read .codesight/CODESIGHT.md for the complete AI context map including all routes, schema, components, libraries, config, middleware, and dependency graph.
