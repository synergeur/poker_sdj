-- The main account keeps every scope in the catalog, including scopes added later.

create or replace function public.has_scope(p_organization_id uuid, p_scope_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_platform_admin()
    or (
      public.is_organization_owner(p_organization_id)
      and exists (
        select 1
        from public.scopes
        where key = p_scope_key
      )
    )
    or exists (
      select 1
      from public.organization_members as member
      join public.role_scopes as granted on granted.role_id = member.role_id
      where member.organization_id = p_organization_id
        and member.user_id = auth.uid()
        and member.status = 'active'
        and granted.scope_key = p_scope_key
    )
    or exists (
      select 1
      from public.organization_members as member
      join public.member_scopes as extra
        on extra.organization_id = member.organization_id
       and extra.user_id = member.user_id
      where member.organization_id = p_organization_id
        and member.user_id = auth.uid()
        and member.status = 'active'
        and extra.scope_key = p_scope_key
    );
$$;
