import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

let db: NodePgDatabase;

// Your Render PostgreSQL connection
const connectionString = 'postgresql://money_postgresql_expense_user:PT0ABGRqPpUb2IcTHEb3QIJGv2qVCQjh@dpg-dbqn5n3bc2fs73dsskag-a.oregon-postgres.render.com/money_postgresql_expense';

export function setDatabase(database: NodePgDatabase): void {
  db = database;
}

export { db };

export async function connectDatabase(databaseUrl: string): Promise<NodePgDatabase> {
  const pool = new Pool({ connectionString: databaseUrl });
  const database = drizzle(pool);
  
  setDatabase(database);
  return database;
}

export function getDatabase(): NodePgDatabase {
  if (!db) {
    throw new Error('Database not initialized. Call connectDatabase() first.');
  }
  return db;
}