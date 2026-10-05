import { Pool } from 'pg';
import { newDb } from 'pg-mem';
import fs from 'fs';
import path from 'path';

export type DbKind = 'postgres' | 'pgmem';

let pool: Pool | null = null;
let dbKind: DbKind = 'postgres';

function readSchemaSql(): string {
  // dist/schema.sql after `npm run build` (copied by the build script),
  // src/schema.sql when run via tsx / vitest.
  const candidates = [
    path.join(__dirname, 'schema.sql'),
    path.join(__dirname, '..', 'src', 'schema.sql'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8');
  }
  throw new Error('schema.sql not found (looked in dist and src)');
}

/** Build a fresh in-memory Postgres (pg-mem) pool with the schema applied. */
export function createInMemoryPool(): Pool {
  const db = newDb();
  db.public.none(readSchemaSql());
  const { Pool: MemPool } = db.adapters.createPg();
  return new MemPool() as unknown as Pool;
}

/**
 * Get the shared pool. `DATABASE_URL=pgmem://demo` selects demo mode:
 * an in-memory Postgres with the schema auto-applied (data resets on restart).
 * Any other value is treated as a real Postgres connection string.
 */
export function getPool(): Pool {
  if (pool) return pool;
  const url = process.env.DATABASE_URL || '';
  if (url === 'pgmem://demo' || url.startsWith('pgmem://')) {
    pool = createInMemoryPool();
    dbKind = 'pgmem';
  } else {
    if (!url) {
      throw new Error(
        'DATABASE_URL is not set. Use DATABASE_URL=pgmem://demo for zero-setup demo mode.'
      );
    }
    pool = new Pool({ connectionString: url });
    dbKind = 'postgres';
  }
  return pool;
}

export function getDbKind(): DbKind {
  return dbKind;
}

/** Test hook: replace the shared pool (e.g. with a fresh pg-mem pool per test). */
export function setPool(p: Pool, kind: DbKind = 'pgmem'): void {
  pool = p;
  dbKind = kind;
}

/** Test hook: drop the shared pool reference. */
export function resetPool(): void {
  pool = null;
  dbKind = 'postgres';
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/**
 * Apply schema.sql to a real Postgres database. Idempotent
 * (CREATE TABLE IF NOT EXISTS). No-op for the in-memory pg-mem pool,
 * which already has the schema applied at creation.
 */
export async function ensurePostgresSchema(): Promise<void> {
  const p = getPool();
  if (getDbKind() !== 'postgres') return;
  await p.query(readSchemaSql());
}
