import "dotenv/config";
import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth.js";
import { assertEncryptionKey } from "./lib/encryption.js";
import { logError, safePath } from "./lib/logError.js";
import routes from "./routes/index.js";

// The clinical texts are encrypted with it: don't start without it
assertEncryptionKey();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
// Only reachable from this machine (nginx proxies /api/ to it). Set HOST=0.0.0.0
// only if something outside the server must call the API directly
const HOST = process.env.HOST || "127.0.0.1";

// Don't advertise the framework in every response
app.disable("x-powered-by");

// The API only listens on 127.0.0.1, behind nginx: trust the visitor IP that
// nginx sends in X-Forwarded-For (used by the contact form's limit per IP)
app.set("trust proxy", "loopback");

app.use(
  cors({
    origin: process.env.FRONTEND_URL ?? "http://localhost:5173",
    credentials: true, // allow auth cookies
  }),
);

// Better Auth must be mounted before express.json()
app.all("/api/auth/*splat", toNodeHandler(auth));

app.use(express.json());
app.use("/api", routes);

// Anything that throws ends here: what's needed to find the bug in the server
// log (never the data being saved or searched: lib/logError.ts), a generic
// message to the browser (never a stack trace or a database error)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((error: unknown, req: Request, res: Response, _next: NextFunction) => {
  // Malformed JSON body: the client's fault, not ours
  if ((error as { type?: string })?.type === "entity.parse.failed") {
    res.status(400).json({ error: { code: "INVALID_JSON", message: "El cuerpo no es JSON válido" } });
    return;
  }
  // An uploaded file over the route's limit
  if ((error as { type?: string })?.type === "entity.too.large") {
    res.status(413).json({ error: { code: "FILE_TOO_LARGE", message: "El archivo pesa demasiado" } });
    return;
  }
  logError(`${req.method} ${safePath(req.originalUrl)} failed`, error);
  if (res.headersSent) return;
  res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "Algo ha fallado. Inténtalo de nuevo." },
  });
});

app.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
});
