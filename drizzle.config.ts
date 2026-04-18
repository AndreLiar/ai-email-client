import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// force load .env.local
config({ path: '.env.local' });

const databaseUrl = process.env.DATABASE_URL ?? '';
console.log('[drizzle.config] DATABASE_URL:', databaseUrl);

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: databaseUrl,
  },
});
