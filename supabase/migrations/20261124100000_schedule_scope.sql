-- Schedule page. The owner already keeps every catalog scope.

insert into public.scopes (key, description)
values ('schedule', 'See the employee schedule.')
on conflict (key) do update
set description = excluded.description;

drop policy if exists employee_weekdays_select on public.employee_weekdays;
create policy employee_weekdays_select
on public.employee_weekdays
for select
to authenticated
using (
  public.is_platform_admin()
  or user_id = auth.uid()
  or public.has_scope(organization_id, 'employees')
  or public.has_scope(organization_id, 'schedule')
);

drop policy if exists employee_exceptions_select on public.employee_exceptions;
create policy employee_exceptions_select
on public.employee_exceptions
for select
to authenticated
using (
  public.is_platform_admin()
  or user_id = auth.uid()
  or public.has_scope(organization_id, 'employees')
  or public.has_scope(organization_id, 'schedule')
);
