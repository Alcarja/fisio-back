// Configuration of the sites service (WEBS.md 3.8). Its variables come from its
// own env file (/etc/kineflow/sites.env on the server, .env.sites locally),
// never from the API's .env: no dotenv here.

// The main secrets must never reach this process: if they're set, refuse to
// start (it means it was started with the API's environment by mistake)
if (process.env.DATABASE_URL || process.env.DATA_ENCRYPTION_KEY || process.env.BETTER_AUTH_SECRET) {
  throw new Error("The sites service must not get the main secrets (DATABASE_URL, DATA_ENCRYPTION_KEY, BETTER_AUTH_SECRET)");
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export const env = {
  port: Number(process.env.SITES_PORT) || 3001,
  host: process.env.SITES_HOST || "127.0.0.1",
  // <subdomain>.<base> are the clinic sites; <base> itself is the preview
  // host and the CNAME target for own domains. Locally: "localhost"
  baseDomain: (process.env.SITES_BASE_DOMAIN || "sites.kineflow.es").toLowerCase(),
  // Read-only database user (WEBS.md 3.2)
  databaseUrl: required("SITES_DATABASE_URL"),
  // The app: booking frame, links back. Locally: http://localhost:5173
  appUrl: (process.env.APP_URL || "https://kineflow.es").replace(/\/$/, ""),
  // https in production; http locally (http://<sub>.localhost:3001)
  publicProtocol: process.env.NODE_ENV === "production" ? "https" : "http",
  // Port to add to public URLs when developing locally (":3001"), empty in production
  publicPort: process.env.NODE_ENV === "production" ? "" : `:${Number(process.env.SITES_PORT) || 3001}`,
};

export const appOrigin = new URL(env.appUrl).origin;
