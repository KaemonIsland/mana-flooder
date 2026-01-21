import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import Database from "better-sqlite3";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Create the adapter for better-sqlite3
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is not set");
}

// Extract the file path from the DATABASE_URL (format: file:/path/to/db)
const dbPath = databaseUrl.startsWith("file:")
  ? databaseUrl.slice(5) // Remove "file:" prefix
  : databaseUrl;

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
