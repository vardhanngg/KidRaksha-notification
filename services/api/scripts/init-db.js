import "dotenv/config";
import fs from "node:fs/promises";
import pg from "pg";

const schema = await fs.readFile(new URL("../db/schema.sql", import.meta.url), "utf8");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try { await pool.query(schema); console.log("LittleWatch database initialized."); } finally { await pool.end(); }
