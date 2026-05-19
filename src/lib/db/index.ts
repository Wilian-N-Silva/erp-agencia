import { neon } from "@neondatabase/serverless";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/neon-http";
import { drizzle as drizzleNodePostgres } from "drizzle-orm/node-postgres";

import { getRequiredEnv } from "@/lib/env";

import * as schema from "./schema";

function createDatabase() {
  const databaseUrl = getRequiredEnv("DATABASE_URL");

  if (isLocalPostgresUrl(databaseUrl)) {
    return drizzleNodePostgres(new Pool({ connectionString: databaseUrl }), {
      schema,
    });
  }

  const client = neon(databaseUrl);

  return drizzle(client, { schema });
}

function isLocalPostgresUrl(value: string) {
  try {
    const { hostname } = new URL(value);

    return ["127.0.0.1", "::1", "localhost"].includes(hostname);
  } catch {
    return false;
  }
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
