import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL is required for migration.");
  process.exit(1);
}

const parsed = new URL(databaseUrl);
const database = decodeURIComponent(parsed.pathname.replace(/^\//, ""));

if (!database) {
  console.error("DATABASE_URL must include a database name.");
  process.exit(1);
}

const connectionOptions = {
  host: parsed.hostname,
  port: Number(parsed.port || 3306),
  user: decodeURIComponent(parsed.username),
  password: decodeURIComponent(parsed.password),
  multipleStatements: false,
};

const quoteIdentifier = (value) => `\`${String(value).replaceAll("`", "``")}\``;

const connection = await mysql.createConnection(connectionOptions);

try {
  await connection.query(
    `CREATE DATABASE IF NOT EXISTS ${quoteIdentifier(database)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );
  await connection.changeUser({ database });

  const migrationsDirectory = join(root, "database/migrations");
  const migrations = (await readdir(migrationsDirectory)).filter((file) => file.endsWith(".sql")).sort();
  for (const file of migrations) {
    const migration = await readFile(join(migrationsDirectory, file), "utf8");
    const statements = migration.split(/;\s*(?:\n|$)/).map((statement) => statement.trim()).filter(Boolean);
    for (const statement of statements) await connection.query(statement);
    console.log(`Migration applied: ${file}`);
  }
  console.log(`Migration complete: ${database}`);
} finally {
  await connection.end();
}
