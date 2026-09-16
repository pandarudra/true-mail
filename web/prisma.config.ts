import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  // ponytail: prisma.config.ts's Datasource type (7.10.0) only supports
  // `url`/`shadowDatabaseUrl` — no `directUrl`, so DIRECT_URL is unused here.
  // If a pooled DATABASE_URL is introduced later, move the direct/pooled
  // split into schema.prisma's `datasource db { url; directUrl }` block,
  // which is where Prisma still supports it.
  datasource: {
    url: env("DATABASE_URL"),
  },
});
