import { randomBytes } from "crypto";

process.env.ENCRYPTION_KEY = randomBytes(32).toString("base64");
