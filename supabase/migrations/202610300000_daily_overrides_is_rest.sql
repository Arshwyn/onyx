-- Store per-date rest markers in daily_overrides.
-- A row is either a routine override (is_rest = false, routine_id set)
-- or a rest marker (is_rest = true, routine_id null).
-- RLS policies and grants are unchanged; the new column is covered by the
-- existing table-level privileges.

begin;

alter table public.daily_overrides
  add column if not exists is_rest boolean not null default false;

alter table public.daily_overrides
  alter column routine_id drop not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'daily_overrides_rest_xor_routine'
      and conrelid = 'public.daily_overrides'::regclass
  ) then
    alter table public.daily_overrides
      add constraint daily_overrides_rest_xor_routine
      check ((is_rest and routine_id is null) or (not is_rest and routine_id is not null));
  end if;
end
$$;

commit;
