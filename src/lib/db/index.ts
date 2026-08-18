import { drizzle } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";

import { getRequiredEnv } from "@/lib/env";

import * as schema from "./schema";

export function createDatabase(
  databaseUrl = getRequiredEnv("DATABASE_URL"),
  poolConfig: Omit<PoolConfig, "connectionString"> = {},
) {
  const pool = new Pool({
    ...poolConfig,
    connectionString: databaseUrl,
  });

  return drizzle(pool, { schema });
}

let cachedDb: Database | undefined;

export function getDb() {
  cachedDb ??= createDatabase();

  return cachedDb;
}

export type Database = ReturnType<typeof createDatabase>;

export const db = new Proxy({} as Database, {
  get(_target, property, receiver) {
    const database = getDb();
    const value = Reflect.get(database, property, receiver);

    return typeof value === "function" ? value.bind(database) : value;
  },
});
