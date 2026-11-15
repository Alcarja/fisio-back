import type { NextFunction, Request, Response } from "express";
import { and, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { clinicFeature } from "../db/schema.js";
import type { ClinicFeature } from "../lib/features.js";

// Use after requireActiveClinic, on every endpoint of an optional feature.
// The frontend hides the feature's pages; this stops calls made straight to
// the API when a super-admin hasn't switched it on for the active clinic.
export function requireFeature(feature: ClinicFeature) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const [enabled] = await db
        .select({ feature: clinicFeature.feature })
        .from(clinicFeature)
        .where(
          and(
            eq(clinicFeature.organizationId, req.clinicId!),
            eq(clinicFeature.feature, feature),
          ),
        )
        .limit(1);

      if (!enabled) {
        res.status(403).json({
          error: {
            code: "FEATURE_DISABLED",
            message: "Esta funcionalidad no está activada para tu clínica",
          },
        });
        return;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
