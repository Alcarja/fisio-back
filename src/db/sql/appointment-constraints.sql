-- Restricciones que Drizzle no sabe declarar. Se aplican con `npm run db:constraints`
-- (después de `npm run db:push`). Se puede ejecutar varias veces.

-- Necesaria para combinar "=" (fisio) y "&&" (rango de fechas) en un índice GiST
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Un fisio no puede tener dos citas a la vez, en ninguna clínica.
-- '[)': una cita que acaba a las 10:00 y otra que empieza a las 10:00 no se solapan.
-- Las canceladas no ocupan el hueco.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'appointment_physio_no_overlap'
  ) THEN
    ALTER TABLE appointment
      ADD CONSTRAINT appointment_physio_no_overlap
      EXCLUDE USING gist (
        physio_id WITH =,
        tstzrange(starts_at, ends_at, '[)') WITH &&
      )
      WHERE (status <> 'cancelled');
  END IF;
END $$;
