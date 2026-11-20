// YouTube links of Kineflow's base exercise bank (base-exercises.ts), loaded
// by `npm run db:seed-exercises`. Only the link: patients open it on YouTube.
//
// Chosen from Spanish-language channels of health institutions, therapeutic
// exercise libraries and physiotherapy clinics, matching each exercise's own
// variant. Next to each: the channel and the video's title (checked against
// YouTube on 2026-11-20). They must be reviewed by a physiotherapist before
// going to production: they reach the patients of every clinic.
//
// An exercise without a good enough video is left out: better no link than a
// wrong one. Clinics can add their own link in each table or program.

export const BASE_EXERCISE_VIDEOS: Record<string, string> = {
  // Hospital Clínico San Carlos · "Ejercicios Fisioterapia para recuperación patologia de la ATM" (several jaw exercises)
  "apertura-mandibular-controlada": "https://www.youtube.com/watch?v=UDgcS6IeEN8",
  // Clínicas Peñarrubia · "EJERCICIO: Retracción cervical sentado"
  "retraccion-cervical": "https://www.youtube.com/watch?v=kGKfzC6Lh5E",
  // Sociedad Española de Reumatología · "Ejercicio de rotación del cuello"
  "rotacion-cervical-activa": "https://www.youtube.com/watch?v=HKbeLfkdhec",
  // FREMAP · "FISIOTERAPIA EN CASA: Estiramiento de trapecio"
  "estiramiento-trapecio-superior": "https://www.youtube.com/watch?v=09fFZKzAkvw",
  // SaludMadrid (Hospital de Fuenlabrada) · "Ejercicios isométricos cervicales"
  "isometricos-cervicales": "https://www.youtube.com/watch?v=b3FifiLoTkc",
  // FREMAP · "FISIOTERAPIA EN CASA: Pendulares de hombro"
  "pendulo-codman": "https://www.youtube.com/watch?v=ul2NeLG3hrE",
  // FREMAP · "FISIOTERAPIA EN CASA: Elevación de brazo con apoyo en rulo pared" (a roller instead of a towel)
  "deslizamiento-en-pared": "https://www.youtube.com/watch?v=7uxJkVXnEmk",
  // FREMAP · "FISIOTERAPIA EN CASA: Ejercicio de rotación externa con theraband"
  "rotacion-externa-banda": "https://www.youtube.com/watch?v=uphJC12RvWQ",
  // Unidad de hombro MFyR · "Rotación interna de hombro con banda elástica"
  "rotacion-interna-banda": "https://www.youtube.com/watch?v=2OL22MgyzCw",
  // Proet Ejercicio Terapéutico · "807. Retracción escapular"
  "retraccion-escapular": "https://www.youtube.com/watch?v=KOn0vhH3v5s",
  // Fisiovalle Fisioterapia y Osteopatía · "Estiramiento cápsula posterior"
  "estiramiento-cruzado-hombro": "https://www.youtube.com/watch?v=JZ5XB8W_S2o",
  // Hombro y Codo Chile (Dr. Claudio Moraga) · "Fortalecimiento excéntrico de muñeca: el ejercicio clave para sanar el codo"
  "excentricos-extensores-muneca": "https://www.youtube.com/watch?v=icPOx_2hsow",
  // Clínica CEMTRO · "Estiramiento de los flexores de antebrazo"
  "estiramiento-flexores-muneca": "https://www.youtube.com/watch?v=96XSWcSXok4",
  // FREMAP · "FISIOTERAPIA EN CASA: Prono supinación con palo" (a stick instead of a hammer)
  "pronosupinacion-peso": "https://www.youtube.com/watch?v=P8FkYLcUldY",
  // Sociedad Española de Reumatología · "Dolor lumbar: Ejercicio del gato camello"
  "gato-camello": "https://www.youtube.com/watch?v=J99uL4J5khE",
  // Sociedad Española de Reumatología · "Dolor lumbar: Ejercicio de báscula pélvica tumbado en el suelo"
  "basculacion-pelvica": "https://www.youtube.com/watch?v=pD0ECeS_frM",
  // Sociedad Española de Reumatología · "Ejercicio del puente"
  "puente-gluteo": "https://www.youtube.com/watch?v=4AqRoIQwMQk",
  // Sociedad Española de Reumatología · "Dolor lumbar: Ejercicio de elevación simultánea de brazo y pierna en cuadrupedia"
  "bird-dog": "https://www.youtube.com/watch?v=PYgOG7i-XGk",
  // RecuperateBien · "Ejercicios de fisioterapia para la espalda: Dead Bug"
  "dead-bug": "https://www.youtube.com/watch?v=pmNW8eWQfbA",
  // FREMAP · "FISIOTERAPIA EN CASA: Plancha frontal"
  "plancha-frontal": "https://www.youtube.com/watch?v=csvIH3pnT1w",
  // Proet Ejercicio Terapéutico · "333. Estiramiento de psoas con zancada adelante"
  "estiramiento-flexores-cadera": "https://www.youtube.com/watch?v=2kfJTHITa4w",
  // FREMAP · "FISIOTERAPIA EN CASA: Ejercicios isométricos de cuadriceps"
  "isometrico-cuadriceps": "https://www.youtube.com/watch?v=dG6JA6zK0fI",
  // Traumatología Hellín · "Deslizamiento talones"
  "deslizamiento-talon": "https://www.youtube.com/watch?v=2Ttqg50LLx4",
  // FREMAP · "FISIOTERAPIA EN CASA: Sentadilla con silla"
  "sentadilla-a-silla": "https://www.youtube.com/watch?v=u6hh6vOgXNI",
  // Sociedad Española de Reumatología · "Dolor lumbar: Ejercicio de estiramiento de isquiotibiales tumbado en el suelo"
  "estiramiento-isquiotibiales": "https://www.youtube.com/watch?v=fk26DB44VNg",
  // Traumatología Hellín · "Elevación talones"
  "elevacion-talones": "https://www.youtube.com/watch?v=Cr8LyARMv3g",
  // FREMAP · "FISIOTERAPIA EN CASA: Ejercicios de tonificación del tobillo de eversión e inversión"
  "eversion-tobillo-banda": "https://www.youtube.com/watch?v=Hq0vpuV1bhs",
  // Higea Salud · "Estiramiento de gemelo en posición bípedo con apoyo en pared"
  "estiramiento-gemelo-pared": "https://www.youtube.com/watch?v=1-uPT7huss0",
  // FREMAP · "FISIOTERAPIA EN CASA: Propioceptivo de tobillo fase 1"
  "equilibrio-un-pie": "https://www.youtube.com/watch?v=Iko1VVDeNUI",
  // SaludMadrid (Hospital de Fuenlabrada) · "Ejercicios de fisioterapia para mejorar la respiración"
  "respiracion-diafragmatica": "https://www.youtube.com/watch?v=dQZk-rgqRkw",
};

// Without a video for now (nothing from a health institution, therapeutic
// exercise library or physio clinic that matches the exercise): remo-con-banda,
// deslizamientos-tendinosos-dedos, libro-abierto, extension-toracica-silla,
// rodillas-al-pecho, plancha-lateral, almeja, abduccion-cadera-lateral,
// estiramiento-gluteo-piriforme, elevacion-pierna-recta, subida-escalon,
// alfabeto-tobillo, marcha-tandem
