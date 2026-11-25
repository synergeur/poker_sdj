-- An employee can read their own shifts without the schedule scope.

drop policy if exists schedule_shifts_select on public.schedule_shifts;
create policy schedule_shifts_select
on public.schedule_shifts
for select
to authenticated
using (
  public.has_scope(organization_id, 'schedule')
  or user_id = auth.uid()
);
