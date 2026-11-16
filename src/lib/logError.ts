// Errors for the server log, without the data that was being saved.
//
// A failed query throws Drizzle's error, whose message is the SQL followed by
// every value sent with it (a patient's name, a diagnosis…), and Postgres adds
// more of them in `detail`. The log keeps what's needed to find the bug: the
// SQL with its $1, $2 placeholders and Postgres' error code.

type PgError = {
  code?: unknown;
  severity?: unknown;
  constraint?: unknown;
  table?: unknown;
  column?: unknown;
  routine?: unknown;
};

function describe(error: unknown, depth = 0): string {
  if (!(error instanceof Error)) return typeof error === "string" ? error : "Unknown error";

  // Drizzle: "Failed query: <sql>\nparams: <values>"
  const query = (error as { query?: unknown }).query;
  if (typeof query === "string" && "params" in error) {
    const cause = (error as { cause?: unknown }).cause;
    return `Failed query: ${query}${cause ? `\n  caused by: ${describe(cause, depth + 1)}` : ""}`;
  }

  // Postgres: its message and detail can quote the values ("Key (email)=(…)")
  const pg = error as PgError;
  if (typeof pg.code === "string" && typeof pg.severity === "string") {
    const parts = [`Postgres error ${pg.code}`];
    for (const key of ["constraint", "table", "column", "routine"] as const) {
      if (typeof pg[key] === "string") parts.push(`${key}=${pg[key]}`);
    }
    return parts.join(" ");
  }

  const cause = (error as { cause?: unknown }).cause;
  return (
    (error.stack ?? `${error.name}: ${error.message}`) +
    (cause && depth < 3 ? `\n  caused by: ${describe(cause, depth + 1)}` : "")
  );
}

export function logError(context: string, error: unknown) {
  console.error(`${context}: ${describe(error)}`);
}

// A request's path for the log: without the query string (a patient search has
// the name in it) and without long random keys (a patient's booking link)
export const safePath = (originalUrl: string) =>
  originalUrl
    .split("?")[0]!
    .split("/")
    .map((part) => (/^[\w-]{24,}$/.test(part) && !/^[0-9a-f-]{36}$/i.test(part) ? ":key" : part))
    .join("/");

// "ana.garcia@gmail.com" -> "a***@gmail.com": enough to follow an email in the
// log without writing down whose it is
export const maskEmail = (email: string) => {
  const at = email.lastIndexOf("@");
  return at < 1 ? "***" : `${email[0]}***${email.slice(at)}`;
};
