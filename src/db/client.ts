import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

declare global {
  // eslint-disable-next-line no-var
  var __arcterm_pg: ReturnType<typeof postgres> | undefined;
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Add it to your .env file.");
}

// Singleton so dev hot-reload doesn't open a new pool per request.
const client = global.__arcterm_pg ?? postgres(connectionString, { max: 10 });
if (process.env.NODE_ENV !== "production") global.__arcterm_pg = client;

export const db = drizzle(client, { schema });
export { client as sql };
