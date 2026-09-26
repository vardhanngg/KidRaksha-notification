import "dotenv/config";
import fs from "node:fs/promises";
import pg from "pg";

const schema = await fs.readFile(new URL("../db/schema.sql", import.meta.url), "utf8");
const migrationDir = new URL("../db/migrations/", import.meta.url);
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  await pool.query(schema);
  const entries = await fs.readdir(migrationDir);
  for (const name of entries.filter(v => /^\d+_.+\.sql$/.test(v)).sort()) {
    await pool.query(await fs.readFile(new URL(name, migrationDir), "utf8"));
    console.log(`Applied migration ${name}`);
  }
  await pool.query(`UPDATE devices SET updated_at=COALESCE(updated_at,created_at,now()) WHERE updated_at IS NULL`);
  console.log("KidRaksha database initialized.");
} finally { await pool.end(); }
