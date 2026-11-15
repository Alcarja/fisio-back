import "dotenv/config";
import { pool } from "./index.js";

// Optional: gives a ficha (patient) to every appointment patient that has only
// a name written on the appointment (all of them before fichas existed, and
// since then the ones booked without choosing a ficha).
//
// Per clinic, appointments with the same name and surname (ignoring capitals
// and spaces around) are taken as the same person and share one ficha. Two
// different people with the same name end up together: split them by hand.
//
// Run it only if the clinics want a ficha for everyone:
// `npm run db:backfill-patients`. Safe to run more than once.
async function backfillPatients() {
  const client = await pool.connect();
  try {
    await client.query("begin");

    // 1. Someone with that name already has a ficha in the clinic: use it
    //    (the oldest one if there are several)
    const linked = await client.query(`
      update appointment_patient ap
      set patient_id = (
        select p.id from patient p
        where p.organization_id = ap.organization_id
          and lower(trim(p.first_name)) = lower(trim(ap.first_name))
          and lower(trim(p.last_name)) = lower(trim(ap.last_name))
        order by p.created_at, p.id
        limit 1
      )
      where ap.patient_id is null
        and exists (
          select 1 from patient p
          where p.organization_id = ap.organization_id
            and lower(trim(p.first_name)) = lower(trim(ap.first_name))
            and lower(trim(p.last_name)) = lower(trim(ap.last_name))
        )
    `);

    // 2. Everyone else: one new ficha per name, spelled as in their first appointment
    const created = await client.query(`
      with names as (
        select distinct on (organization_id, lower(trim(first_name)), lower(trim(last_name)))
          organization_id, trim(first_name) as first_name, trim(last_name) as last_name
        from appointment_patient
        where patient_id is null
        order by organization_id, lower(trim(first_name)), lower(trim(last_name)), created_at
      ),
      created as (
        insert into patient (organization_id, first_name, last_name)
        select organization_id, first_name, last_name from names
        returning id, organization_id, first_name, last_name
      )
      update appointment_patient ap
      set patient_id = c.id
      from created c
      where ap.patient_id is null
        and ap.organization_id = c.organization_id
        and lower(trim(ap.first_name)) = lower(c.first_name)
        and lower(trim(ap.last_name)) = lower(c.last_name)
    `);

    await client.query("commit");
    console.log(
      `Fichas: ${linked.rowCount} appointment patients linked to existing fichas, ` +
        `${created.rowCount} linked to new ones.`,
    );
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

backfillPatients()
  .catch((error) => {
    console.error("Backfilling patients failed:", error.message ?? error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
