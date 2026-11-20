// The body zones of Zona's hero ("¿Dónde te duele?"). Fixed copy of the
// template, the same for every clinic: general physiotherapy, no promises a
// given clinic might not keep (no named specialists, no insurers)

export type Zone = { id: string; short: string; name: string; tag: string; conditions: string[]; text: string };

export const ZONES: Zone[] = [
  {
    id: "cuello",
    short: "Cuello",
    name: "Cuello y cervicales",
    tag: "Terapia manual",
    conditions: ["Cervicalgia", "Tortícolis", "Cefalea tensional", "Latigazo cervical"],
    text: "Combinamos terapia manual con ejercicios de control postural para que el alivio dure más allá de la camilla.",
  },
  {
    id: "hombro",
    short: "Hombro",
    name: "Hombro",
    tag: "Ejercicio terapéutico",
    conditions: ["Manguito rotador", "Hombro congelado", "Luxación", "Postquirúrgico"],
    text: "Recuperamos movilidad y fuerza por fases, con ejercicios que puedes seguir en casa entre sesiones.",
  },
  {
    id: "espalda",
    short: "Espalda",
    name: "Espalda",
    tag: "Enfoque activo",
    conditions: ["Lumbalgia", "Ciática", "Hernia discal", "Dolor dorsal"],
    text: "Te explicamos qué está pasando y te ayudamos a volver a moverte con confianza, sin miedo al dolor.",
  },
  {
    id: "cadera",
    short: "Cadera",
    name: "Cadera",
    tag: "Traumatología",
    conditions: ["Artrosis", "Prótesis de cadera", "Bursitis", "Pubalgia"],
    text: "Antes o después de una cirugía, trabajamos fuerza y marcha para que ganes estabilidad cuanto antes.",
  },
  {
    id: "pelvico",
    short: "Suelo pélvico",
    name: "Suelo pélvico",
    tag: "Consulta privada",
    conditions: ["Incontinencia", "Posparto", "Dolor pélvico", "Diástasis abdominal"],
    text: "Una valoración tranquila y en privado, con tiempo para escucharte y explicarte cada paso.",
  },
  {
    id: "rodilla",
    short: "Rodilla",
    name: "Rodilla",
    tag: "Fisio deportiva",
    conditions: ["Ligamento cruzado", "Menisco", "Condromalacia", "Prótesis de rodilla"],
    text: "Desde la primera semana tras la lesión o cirugía hasta que vuelves a correr, saltar o subir escaleras sin pensar.",
  },
  {
    id: "tobillo",
    short: "Tobillo y pie",
    name: "Tobillo y pie",
    tag: "Readaptación",
    conditions: ["Esguince", "Fascitis plantar", "Tendón de Aquiles", "Fracturas"],
    text: "Un esguince mal recuperado vuelve. Trabajamos fuerza y equilibrio para que no te pase dos veces.",
  },
];

// Selected when the page loads
export const DEFAULT_ZONE = "rodilla";

// The ticker under the hero
export const CONDITIONS = [
  "Lumbalgia",
  "Esguince de tobillo",
  "Tendinopatía",
  "Posparto",
  "Ciática",
  "Rotura fibrilar",
  "Artrosis",
  "Cervicalgia",
  "Ligamento cruzado",
  "Fascitis plantar",
  "Hombro congelado",
  "Vértigo",
];
