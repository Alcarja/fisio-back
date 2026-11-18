import "dotenv/config";
import { eq, inArray } from "drizzle-orm";
import { emptySiteContent, type SiteContent } from "../lib/site.js";
import { db, pool } from "./index.js";
import {
  clinicFeature,
  clinicLegal,
  clinicOnlineBooking,
  clinicOpeningHours,
  clinicSite,
  member,
  memberPublicProfile,
  organization,
  service,
  user,
} from "./schema.js";

// npm run sites:demo: a demo clinic with a complete, published website, to see
// the templates with realistic data (WEBS.md 3.9). Subdomain "demo":
// locally http://demo.localhost:3001. Its team members are users without a
// password (they can't log in). Running it again starts the demo from scratch.
// Only for test databases.

const ID = "demo-site-clinic";
const USERS = [
  { id: "demo-site-user-1", name: "Laura Martín", role: "owner", headline: "Fisioterapeuta · Fundadora", license: "CV-4521", bio: "Más de 12 años tratando lesiones deportivas y dolor de espalda. Especialista en terapia manual y ejercicio terapéutico." },
  { id: "demo-site-user-2", name: "Javier Ruiz", role: "physio", headline: "Fisioterapeuta · Suelo pélvico", license: "CV-6730", bio: "Acompaño a mujeres en el embarazo y el posparto, y trato la incontinencia y el dolor pélvico." },
  { id: "demo-site-user-3", name: "Marta Soler", role: "physio", headline: "Fisioterapeuta · Pilates terapéutico", license: "CV-7102", bio: "Clases reducidas de pilates para recuperar fuerza y movilidad después de una lesión." },
];

async function seed() {
  const host = process.env.DATABASE_URL ?? "";
  if (!/localhost|127\.0\.0\.1|neon\.tech/.test(host)) throw new Error("DATABASE_URL doesn't look like a database");

  // Start again: deleting the clinic deletes its site, services, members…
  await db.delete(organization).where(eq(organization.id, ID));
  await db.delete(user).where(inArray(user.id, USERS.map((u) => u.id)));

  const now = new Date();
  await db.insert(organization).values({ id: ID, name: "Fisio Demo Valencia", slug: "fisio-demo-valencia", createdAt: now });
  await db.insert(user).values(
    USERS.map((u) => ({ id: u.id, name: u.name, email: `${u.id}@demo.kineflow.invalid` })),
  );
  await db.insert(member).values(
    USERS.map((u, i) => ({ id: `${u.id}-member`, organizationId: ID, userId: u.id, role: u.role, createdAt: new Date(now.getTime() + i) })),
  );
  await db.insert(memberPublicProfile).values(
    USERS.map((u, i) => ({
      memberId: `${u.id}-member`,
      organizationId: ID,
      visible: true,
      headline: u.headline,
      bio: u.bio,
      licenseNumber: u.license,
      sortOrder: i,
    })),
  );

  await db.insert(clinicFeature).values([
    { organizationId: ID, feature: "website" },
    { organizationId: ID, feature: "online_booking" },
  ]);
  await db.insert(clinicOnlineBooking).values({ organizationId: ID, enabled: true });

  await db.insert(service).values([
    { organizationId: ID, name: "Fisioterapia", durationMinutes: 50, priceCents: 4500, publicDescription: "Valoración y tratamiento de lesiones, dolor de espalda, cuello o articulaciones. Terapia manual y ejercicio adaptado a ti." },
    { organizationId: ID, name: "Fisioterapia deportiva", durationMinutes: 50, priceCents: 5000, publicDescription: "Recuperación de lesiones deportivas y prevención para que vuelvas a entrenar cuanto antes." },
    { organizationId: ID, name: "Suelo pélvico", durationMinutes: 60, priceCents: 5500, publicDescription: "Embarazo, posparto, incontinencia y dolor pélvico, con total discreción." },
    { organizationId: ID, name: "Pilates terapéutico", durationMinutes: 55, priceCents: 1800, isGroup: true, maxPatients: 6, publicDescription: "Grupos de hasta 6 personas, guiados por una fisioterapeuta." },
    { organizationId: ID, name: "Revisión interna", durationMinutes: 15, priceCents: 0, showOnWeb: false },
  ]);

  // Monday to Friday 9–14 and 16–20, Saturday 9–13
  const hours = [1, 2, 3, 4, 5].flatMap((weekday) => [
    { organizationId: ID, weekday, startTime: "09:00", endTime: "14:00" },
    { organizationId: ID, weekday, startTime: "16:00", endTime: "20:00" },
  ]);
  hours.push({ organizationId: ID, weekday: 6, startTime: "09:00", endTime: "13:00" });
  await db.insert(clinicOpeningHours).values(hours);

  await db.insert(clinicLegal).values({
    organizationId: ID,
    legalName: "Fisio Demo Valencia SL",
    taxId: "B00000000",
    address: "Calle de Colón 1",
    postalCode: "46004",
    city: "Valencia",
    privacyContactEmail: "privacidad@demo.kineflow.invalid",
  });

  const content: SiteContent = {
    ...emptySiteContent("Fisio Demo Valencia"),
    hero: {
      title: "Fisioterapia en el centro de Valencia",
      subtitle: "Te ayudamos a recuperarte de lesiones, aliviar el dolor y volver a moverte sin miedo.",
    },
    contact: {
      phone: "963 00 00 00",
      whatsapp: "600 00 00 00",
      email: "hola@demo.kineflow.invalid",
      address: "Calle de Colón 1",
      postalCode: "46004",
      city: "Valencia",
      mapsUrl: "https://maps.google.com/?q=Calle+de+Colon+1+Valencia",
      instagram: "https://www.instagram.com/kineflow",
    },
    healthRegistry: "CS-12345",
  };
  await db.insert(clinicSite).values({
    organizationId: ID,
    subdomain: "demo",
    template: "clara",
    draft: content,
    published: content,
    publishedTemplate: "clara",
    status: "published",
    publishedAt: now,
  });

  console.log("Demo clinic ready: subdomain \"demo\" (locally http://demo.localhost:3001)");
}

seed()
  .catch((error) => {
    console.error("Demo seed failed:", error.message ?? error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
