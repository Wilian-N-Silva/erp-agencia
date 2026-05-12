import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import { getRequiredEnv } from "@/lib/env";

import * as schema from "./schema";

const client = neon(getRequiredEnv("DATABASE_URL"));

export const db = drizzle(client, { schema });

export type Database = typeof db;
