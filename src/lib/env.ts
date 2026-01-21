import { z } from "zod";

const envSchema = z.object({
  MTGJSON_DB_PATH: z
    .string()
    .default("/data/mtgjson/AllPrintings.sqlite")
    .describe("Path to MTGJSON AllPrintings SQLite file"),
  MTGJSON_DIR: z
    .string()
    .default("/data/mtgjson")
    .describe("Directory for MTGJSON assets"),
  DATABASE_URL: z
    .string()
    .default("file:/data/app/app.sqlite")
    .describe("App SQLite connection string"),
});

export const env = envSchema.parse({
  MTGJSON_DB_PATH: process.env.MTGJSON_DB_PATH,
  MTGJSON_DIR: process.env.MTGJSON_DIR,
  DATABASE_URL: process.env.DATABASE_URL,
});
