import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import Database from "better-sqlite3";
import { env } from "@/lib/env";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Create the adapter for better-sqlite3
const databaseUrl = process.env.DATABASE_URL ?? env.DATABASE_URL;
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = databaseUrl;
}

const normalizedUrl = databaseUrl.startsWith("file:")
  ? databaseUrl
  : `file:${databaseUrl}`;

// Extract the file path from the DATABASE_URL (format: file:/path/to/db)
const dbPath = normalizedUrl.replace(/^file:/, "");

const db = new Database(dbPath);
const adapter = new PrismaBetterSqlite3(db);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
