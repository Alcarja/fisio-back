// Shared look of every email. Plain tables and inline styles: email clients
// (Outlook especially) ignore most modern CSS.

const PLATFORM_NAME = process.env.EMAIL_FROM_NAME || "Kineflow";

// Clinic and people names are typed by users: always escape them in HTML
export const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!,
  );

type LayoutOptions = {
  // Preview line shown next to the subject in the inbox
  preheader: string;
  heading: string;
  // Already-escaped HTML paragraphs
  paragraphs: string[];
  // Optional: some emails have nothing to open (an appointment reminder for
  // an appointment given by phone)
  button?: { label: string; url: string };
  // Small print under the button, e.g. when the link expires
  note?: string;
};

export function renderLayout({ preheader, heading, paragraphs, button, note }: LayoutOptions) {
  const url = button ? escapeHtml(button.url) : "";

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(heading)}</title>
</head>
<body style="margin:0;padding:0;background:#f6f3ee;">
<div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f3ee;padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2a27;">
      <tr><td style="padding:36px 36px 8px;">
        <h1 style="margin:0 0 20px;font-size:24px;line-height:1.3;font-weight:600;">${escapeHtml(heading)}</h1>
        ${paragraphs.map((p) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;">${p}</p>`).join("\n        ")}
      </td></tr>
      ${
        button
          ? `<tr><td style="padding:8px 36px 28px;">
        <a href="${url}" style="display:inline-block;background:#1d4f45;color:#ffffff;text-decoration:none;font-size:16px;font-weight:600;padding:14px 28px;border-radius:999px;">${escapeHtml(button.label)}</a>
        ${note ? `<p style="margin:20px 0 0;font-size:13px;line-height:1.5;color:#6b7572;">${escapeHtml(note)}</p>` : ""}
      </td></tr>
      <tr><td style="padding:0 36px 32px;font-size:13px;line-height:1.5;color:#6b7572;">
        Si el botón no funciona, copia este enlace en tu navegador:<br>
        <a href="${url}" style="color:#1d4f45;word-break:break-all;">${url}</a>
      </td></tr>`
          : `<tr><td style="padding:0 36px 20px;"></td></tr>`
      }
    </table>
    <p style="margin:20px 0 0;font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#8a938f;">
      Enviado con ${escapeHtml(PLATFORM_NAME)}
    </p>
  </td></tr>
</table>
</body>
</html>`;
}

// Plain-text version: some clients and spam filters rely on it
export function renderText(lines: string[], button?: { label: string; url: string }) {
  return [
    ...lines,
    ...(button ? ["", `${button.label}: ${button.url}`] : []),
    "",
    `Enviado con ${PLATFORM_NAME}`,
  ].join("\n");
}
