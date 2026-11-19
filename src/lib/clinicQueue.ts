import type { NextFunction, Request, Response } from "express";

// Writes that fill places in one clinic (online bookings and the calendar's
// own changes) run one after another in this server process: each checks the
// room and the class places and saves before the next one checks. Without it,
// reception and an online booking could both take the last place. They wait
// here, without holding a database connection
const queues = new Map<string, Promise<unknown>>();

export function oneAtATime<T>(clinicId: string, task: () => Promise<T>): Promise<T> {
  const previous = queues.get(clinicId) ?? Promise.resolve();
  const result = previous.then(task);
  // The queue goes on whether this one works or not
  const tail = result.catch(() => {});
  queues.set(clinicId, tail);
  void tail.then(() => {
    if (queues.get(clinicId) === tail) queues.delete(clinicId);
  });
  return result;
}

// Longest a request may keep the clinic's queue (a request that never ends
// must not block the clinic's bookings)
const MAX_HOLD_MS = 30_000;

// Middleware (after the one that sets req.clinicId): the rest of the request
// runs in the clinic's queue, until its response is sent
export const queuedPerClinic = (req: Request, res: Response, next: NextFunction) => {
  const clinicId = req.clinicId;
  if (!clinicId) return next();
  void oneAtATime(
    clinicId,
    () =>
      new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, MAX_HOLD_MS);
        const done = () => {
          clearTimeout(timer);
          resolve();
        };
        res.once("finish", done);
        res.once("close", done);
        next();
      }),
  );
};
