import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

// biome-ignore lint/style/noNonNullAssertion: Database URL is required.
const sql = neon(process.env.DATABASE_URL!);

export const db = drizzle(sql, { schema });
export { schema };
