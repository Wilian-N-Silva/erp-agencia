import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import { getRequiredEnv } from "@/lib/env";

import * as schema from "./schema";

function createDatabase() {
  const client = neon(getRequiredEnv("DATABASE_URL"));

  return drizzle(client, { schema });
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
