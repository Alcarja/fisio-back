import type { NextFunction, Request, Response } from "express";

// Use after requireAuth
export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== "superadmin") {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "Super-admin only" } });
    return;
  }
  next();
}
