import { Request, Response } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { logError } from "../lib/logError.js";

export const getRoot = (_req: Request, res: Response) => {
  res.json({ message: "Hello from Express + TypeScript" });
};

export const getHealth = async (_req: Request, res: Response) => {
  try {
    await db.execute(sql`select 1`);
    res.json({ status: "ok", db: "connected" });
  } catch (error) {
    logError("DB health check failed", error);
    res.status(503).json({ status: "error", db: "disconnected" });
  }
};
