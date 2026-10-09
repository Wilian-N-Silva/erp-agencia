// DB-writing fixtures must never run against the user's normal local database.
export function isolatedE2eDatabaseUrl() {
  const direct = process.env.DATABASE_DIRECT_URL;
  const runtime = process.env.DATABASE_URL;
  if (!direct || !runtime) throw new Error("Missing isolated E2E database configuration.");
  const admin = new URL(direct), app = new URL(runtime);
  if (!["localhost", "127.0.0.1"].includes(admin.hostname)
    || !/^\/erp_hml_e2e(?:_[a-z0-9_]+)?$/.test(admin.pathname)
    || admin.hostname !== app.hostname || admin.port !== app.port || admin.pathname !== app.pathname) {
    throw new Error("DB fixtures require a dedicated local erp_hml_e2e database and matching runtime URL.");
  }
  return direct;
}
