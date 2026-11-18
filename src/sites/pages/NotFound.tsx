// What any address without a live site shows: unknown subdomain, unpublished
// or offline site, clinic deactivated. Neutral on purpose: it doesn't say
// whether the clinic exists. Standalone page (no template, no clinic data)
export function notFoundHtml(appUrl: string) {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Web no disponible</title>
<style>
body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif; background: #f6f6f4; color: #1d2422; padding: 1.25rem; }
main { max-width: 28rem; text-align: center; }
h1 { font-size: 1.75rem; margin: 0 0 .75rem; }
p { color: #5b6461; line-height: 1.6; margin: 0 0 1.5rem; }
a { color: #1f5144; }
</style>
</head>
<body>
<main>
<h1>Esta web no está disponible</h1>
<p>La dirección no existe o la web no está publicada ahora mismo.</p>
<p><a href="${appUrl}">Kineflow</a></p>
</main>
</body>
</html>`;
}
