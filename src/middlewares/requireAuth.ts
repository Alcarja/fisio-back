import type { NextFunction, Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../auth.js";

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const result = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });

  if (!result) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not logged in" } });
    return;
  }

  req.user = result.user;
  req.session = result.session;
  next();
}
