import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { getEnv } from "@/lib/env";
import * as schema from "./schema";

const pool = new Pool({ connectionString: getEnv().DATABASE_URL, max: 5 });

export const db = drizzle({ client: pool, schema });
