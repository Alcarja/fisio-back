-- Historial de profesionales (clinic_professional_log, db/plan-schema.ts).
-- Every change to who is a professional in a clinic (owner, admin or physio;
-- a member may have several roles, "admin,physio") writes a row, whatever made
-- it: our endpoints, Better Auth (invitations accepted, members added), a
-- deleted account, the super-admin… Applied by `npm run db:constraints`.
-- Safe to run more than once.
--
-- Statement-level, so the chain of counts stays exact in every case:
-- - one statement touching several members (a bulk update, a cascade) writes
--   ONE row per clinic with the total change, never rows with made-up counts
-- - two transactions changing the same clinic at once are serialized by an
--   advisory lock per clinic: the second one counts after the first commits
-- - changed_at is clock_timestamp(), not now(): several changes in one
--   transaction keep their order (now() would give them all the same instant)

create or replace function kineflow_is_professional(role text) returns boolean
language sql immutable as $$
  select coalesce(string_to_array(role, ',') && array['owner', 'admin', 'physio']::text[], false)
$$;

create or replace function kineflow_log_professionals() returns trigger
language plpgsql as $$
declare
  orgs text[];
  deltas integer[];
  after_count integer;
begin
  -- Each statement sees only its own transition tables: one query per event.
  -- Clinics in a fixed order, so concurrent statements lock them alike (no deadlocks)
  if tg_op = 'INSERT' then
    select array_agg(org order by org), array_agg(delta order by org) into orgs, deltas from (
      select organization_id as org, sum(kineflow_is_professional(role)::int)::int as delta
      from new_rows group by 1) x where delta <> 0;
  elsif tg_op = 'DELETE' then
    select array_agg(org order by org), array_agg(delta order by org) into orgs, deltas from (
      select organization_id as org, -sum(kineflow_is_professional(role)::int)::int as delta
      from old_rows group by 1) x where delta <> 0;
  else
    -- A member never moves between clinics; only the role can change
    select array_agg(org order by org), array_agg(delta order by org) into orgs, deltas from (
      select n.organization_id as org,
             sum(kineflow_is_professional(n.role)::int - kineflow_is_professional(o.role)::int)::int as delta
      from new_rows n join old_rows o on o.id = n.id group by 1) x where delta <> 0;
  end if;

  for i in 1 .. coalesce(array_length(orgs, 1), 0) loop
    -- The clinic itself is being deleted (its members go with it): nothing to log
    continue when not exists (select 1 from organization where id = orgs[i]);
    perform pg_advisory_xact_lock(hashtext('kineflow_professional_log:' || orgs[i]));
    select count(*) into after_count from member where organization_id = orgs[i] and kineflow_is_professional(role);
    insert into clinic_professional_log (organization_id, previous_count, new_count, changed_at)
    values (orgs[i], after_count - deltas[i], after_count, clock_timestamp());
  end loop;
  return null;
end;
$$;

-- Transition tables need one trigger per event
drop trigger if exists member_professional_log on member;
drop trigger if exists member_professional_log_insert on member;
drop trigger if exists member_professional_log_update on member;
drop trigger if exists member_professional_log_delete on member;
create trigger member_professional_log_insert
  after insert on member referencing new table as new_rows
  for each statement execute function kineflow_log_professionals();
create trigger member_professional_log_update
  after update on member referencing old table as old_rows new table as new_rows
  for each statement execute function kineflow_log_professionals();
create trigger member_professional_log_delete
  after delete on member referencing old table as old_rows
  for each statement execute function kineflow_log_professionals();
