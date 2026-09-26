import "dotenv/config";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const { Pool } = pg;
const LOCK_KEY_1 = 0x4b4452; // "KDR"
const LOCK_KEY_2 = 0x4d4947; // "MIG"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
  connectionTimeoutMillis: 5_000,
  idleTimeoutMillis: 30_000,
});

async function sha256File(contents) {
  return crypto.createHash("sha256").update(contents).digest("hex");
}

async function main() {
  const schemaPath = new URL("../db/schema.sql", import.meta.url);
  const migrationDir = new URL("../db/migrations/", import.meta.url);
  const schema = await fs.readFile(schemaPath, "utf8");
  const entries = (await fs.readdir(migrationDir))
    .filter(name => /^\d+_.+\.sql$/.test(name))
    .sort((a, b) => Number(a.split("_", 1)[0]) - Number(b.split("_", 1)[0]));

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1, $2)", [LOCK_KEY_1, LOCK_KEY_2]);
    await client.query(schema);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        checksum TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const { rows: applied } = await client.query(
      "SELECT version, checksum FROM schema_migrations ORDER BY version"
    );
    const known = new Map(applied.map(row => [row.version, row.checksum]));

    for (const name of entries) {
      const migration = await fs.readFile(new URL(name, migrationDir), "utf8");
      const checksum = await sha256File(migration);
      const previous = known.get(name);
      if (previous) {
        if (previous !== checksum) {
          throw new Error(`Migration checksum mismatch for ${name}. The applied migration file was modified.`);
        }
        continue;
      }
      await client.query(migration);
      await client.query(
        "INSERT INTO schema_migrations(version, checksum) VALUES($1,$2)",
        [name, checksum]
      );
      console.log(`Applied migration ${name}`);
    }

    await client.query("COMMIT");
    console.log(`Database schema ready; ${entries.length} migration file(s) tracked.`);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
