import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './lib/core/db/schema/index.ts',
  out: './lib/core/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    // biome-ignore lint/style/noNonNullAssertion: The DATABASE_URL is reqired.
    url: process.env.DATABASE_URL!,
  },
});
