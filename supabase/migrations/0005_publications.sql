-- Anime Production Studio — migración 0005 (fase 6: publicación)
--
-- La 0001 ya creó `publications` en versión mínima (id, project_id,
-- episode_id, platform, url, status ('draft', 'scheduled',
-- 'published'), published_at), con su RLS y el trigger de updated_at
-- (el bucle de la 0001 cubre todas las tablas con esa columna, así
-- que no hace falta recrearlo). Esta migración añade las columnas que
-- la fase 6 necesita y que la 0001 no tenía, siguiendo el estilo de
-- la 0003/0004 (DO blocks con comprobación; idempotente), y crea la
-- tabla nueva `publication_title_versions` (versiones de
-- título/descripción por idioma y plataforma).
--
-- Cambios de contrato respecto a la 0001:
-- - publications.status pasa a los cuatro estados de la app
--   ('en-preparacion', 'listo', 'programado', 'publicado') en vez de
--   ('draft', 'scheduled', 'published').
-- - publications.url (0001) queda como columna heredada sin uso en la
--   app; el enlace publicado vive en published_url.
-- - publication_title_versions es tabla nueva: RLS activado y
--   políticas de proyecto como las de la 0001 (acceso si el usuario
--   es miembro de la organización del proyecto).
--
-- NOTA: el modo local (Dexie) es la fuente de verdad mientras Supabase
-- no esté configurado; esta migración solo se aplica cuando Stiven
-- conecte su proyecto de Supabase.

-- ---------------------------------------------------------------------------
-- 1. publications: título, descripción, etiquetas, miniatura, imagen
--    promocional, fechas, idioma y enlace publicado
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'publications' and column_name = 'title') then
    alter table public.publications add column title text not null default '';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'publications' and column_name = 'description') then
    alter table public.publications add column description text not null default '';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'publications' and column_name = 'tags') then
    alter table public.publications add column tags text[] not null default '{}';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'publications' and column_name = 'thumbnail_asset_id') then
    alter table public.publications add column thumbnail_asset_id uuid references public.assets (id) on delete set null;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'publications' and column_name = 'promo_image_asset_id') then
    alter table public.publications add column promo_image_asset_id uuid references public.assets (id) on delete set null;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'publications' and column_name = 'planned_date') then
    alter table public.publications add column planned_date date;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'publications' and column_name = 'published_date') then
    alter table public.publications add column published_date date;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'publications' and column_name = 'language') then
    alter table public.publications add column language text not null default 'español';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'publications' and column_name = 'published_url') then
    alter table public.publications add column published_url text;
  end if;
end $$;
-- Estados en español de la app: sustituir el check de la 0001. El
-- check inline de la 0001 genera la constraint
-- `publications_status_check`; si no existe con ese nombre, el bloque
-- DO la busca por su definición (mismo patrón que la 0004 con
-- recordings).
do $$
declare
  old_check text;
begin
  select conname into old_check
  from pg_constraint
  where conrelid = 'public.publications'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%draft%scheduled%published%'
  limit 1;
  if old_check is not null then
    execute format('alter table public.publications drop constraint %I', old_check);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'publications_status_es_check') then
    alter table public.publications
      add constraint publications_status_es_check
      check (status in ('en-preparacion', 'listo', 'programado', 'publicado'));
  end if;
end $$;
alter table public.publications alter column status set default 'en-preparacion';

-- ---------------------------------------------------------------------------
-- 2. publication_title_versions: versiones de título/descripción por
--    idioma y plataforma (tabla nueva)
-- ---------------------------------------------------------------------------
create table if not exists public.publication_title_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  publication_id uuid not null references public.publications (id) on delete cascade,
  language text not null,
  platform text not null,
  title text not null default '',
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
comment on table public.publication_title_versions is 'Versiones de título y descripción de una publicación, por idioma y plataforma.';

-- ---------------------------------------------------------------------------
-- 3. Índices
-- ---------------------------------------------------------------------------
create index if not exists idx_publications_episode_id on public.publications (episode_id);
create index if not exists idx_publications_platform on public.publications (platform);
create index if not exists idx_publications_status on public.publications (status);
create index if not exists idx_publications_thumbnail_asset_id on public.publications (thumbnail_asset_id);
create index if not exists idx_publications_promo_image_asset_id on public.publications (promo_image_asset_id);
create index if not exists idx_publication_title_versions_publication_id on public.publication_title_versions (publication_id);
create index if not exists idx_publication_title_versions_project_id on public.publication_title_versions (project_id);
create index if not exists idx_publication_title_versions_language on public.publication_title_versions (language);
create index if not exists idx_publication_title_versions_platform on public.publication_title_versions (platform);

-- ---------------------------------------------------------------------------
-- 4. RLS y políticas de `publication_title_versions` (mismo patrón de
--    proyecto que la 0001: acceso si el usuario es miembro de la
--    organización del proyecto; `publications` ya las tiene).
-- ---------------------------------------------------------------------------
alter table public.publication_title_versions enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'publication_title_versions' and policyname = 'publication_title_versions_select') then
    create policy publication_title_versions_select on public.publication_title_versions
      for select to authenticated using (
        exists (select 1 from public.projects p where p.id = publication_title_versions.project_id
          and (p.organization_id is null or public.is_org_member(p.organization_id))));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'publication_title_versions' and policyname = 'publication_title_versions_write') then
    create policy publication_title_versions_write on public.publication_title_versions
      for all to authenticated using (
        exists (select 1 from public.projects p where p.id = publication_title_versions.project_id
          and (p.organization_id is null or public.is_org_member(p.organization_id))))
      with check (
        exists (select 1 from public.projects p where p.id = publication_title_versions.project_id
          and (p.organization_id is null or public.is_org_member(p.organization_id))));
  end if;
end $$;
