-- 0007 — Corregir la recursión infinita de RLS en `project_members`
-- (error 42P17: infinite recursion detected in policy for relation
-- "project_members") al registrarse como primer owner del equipo.
--
-- Causa (migración 0006): la política `project_members_insert_bootstrap`
-- comprobaba «el proyecto aún no tiene miembros» con una consulta
-- DIRECTA sobre la misma tabla que protege:
--   not exists (select 1 from public.project_members pm
--                where pm.project_id = project_members.project_id)
-- PostgreSQL no permite que una política consulte su propia tabla:
-- al evaluarla vuelve a aplicar la política y lanza 42P17. Por eso
-- pulsar «Registrarme como propietario» en la app fallaba siempre,
-- aunque el proyecto no tuviera miembros.
--
-- Corrección (mismo patrón que el resto de la 0006): la comprobación
-- pasa por una función SECURITY DEFINER, que lee `project_members`
-- sin aplicarle RLS, igual que `is_project_member` y
-- `project_member_role`. La política queda con la misma semántica:
-- solo uno mismo, solo como owner, solo si el proyecto aún no tiene
-- miembros, solo si el proyecto existe y no tiene organización (o
-- perteneces a su organización).
--
-- Verificado contra PostgreSQL 16 real (2026-11-15): con la política
-- vieja el INSERT de arranque falla con 42P17; con esta, inserta al
-- owner; un segundo usuario que intenta arrancar recibe una denegación
-- limpia 42501 (sin recursión); el owner sigue pudiendo añadir a
-- otros por UUID y el UPDATE de proyectos no recursiona.
-- Prueba: supabase/tests/rls_bootstrap_test.sql
--
-- Cómo aplicarla: pega este archivo en el SQL Editor de Supabase
-- (New query) y pulsa Run. No toca datos: solo añade la función y
-- reescribe la política. Idempotente: se puede correr dos veces.

-- 1. Helper SECURITY DEFINER: ¿tiene ya miembros este proyecto?
--    (bypass RLS, como los demás helpers de la 0006).
create or replace function public.project_has_members(p_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1
    from public.project_members pm
    where pm.project_id = p_id
  );
$$;

-- 2. Reescribir la política de arranque con el helper.
drop policy if exists "project_members_insert_bootstrap" on public.project_members;
create policy "project_members_insert_bootstrap" on public.project_members
  for insert to authenticated with check (
    user_id = auth.uid()
    and role = 'owner'
    and not public.project_has_members(project_members.project_id)
    and exists (select 1 from public.projects p where p.id = project_members.project_id
      and (p.organization_id is null or public.is_org_member(p.organization_id)))
  );
