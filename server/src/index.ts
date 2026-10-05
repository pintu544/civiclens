import { createApp } from './app';
import { getPool, getDbKind, ensurePostgresSchema } from './db';
import { runSeed } from './seed';
import { aiProviderActive } from './triage';

const PORT = Number(process.env.PORT) || 4000;

async function main(): Promise<void> {
  // Validate DATABASE_URL early (throws when missing and not pgmem://).
  getPool();
  // Real Postgres (e.g. Render): create tables if they don't exist yet.
  await ensurePostgresSchema();
  // Seed sample reports on first boot; skips silently when already seeded.
  try {
    const seed = await runSeed();
    if (seed.inserted > 0) {
      console.log(`[civiclens] seeded ${seed.inserted} sample reports`);
    }
  } catch (err) {
    console.warn(
      '[civiclens] seed skipped:',
      err instanceof Error ? err.message : err
    );
  }

  const app = createApp({ adminKey: process.env.ADMIN_KEY });
  app.listen(PORT, () => {
    console.log(
      `[civiclens] API listening on :${PORT} (db=${getDbKind()}, ai=${aiProviderActive()})`
    );
  });
}

main().catch((err) => {
  console.error(
    '[civiclens] fatal startup error:',
    err instanceof Error ? err.message : err
  );
  process.exit(1);
});
