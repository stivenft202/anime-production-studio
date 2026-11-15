-- ============================================================================
-- Anime Production Studio — Migración inicial (Fase 1)
-- Archivo: supabase/migrations/0001_init.sql
-- Ejecutar tal cual en el Editor SQL de Supabase (proyecto nuevo o existente).
-- Es idempotente en lo posible: CREATE TABLE IF NOT EXISTS, CREATE POLICY
-- con DROP previo, INSERT ... ON CONFLICT DO NOTHING para los buckets.
--
-- Modelo:
--   users -> organizations -> organization_members / invitations
--   organizations -> projects -> todo lo demás (seasons, episodes, scenes,
--   shots, dialogue_lines, characters, lore, timeline, locations, objects,
--   prompts, assets, tags, voice_actors, recordings, publications, backups)
--
-- Seguridad (RLS):
--   - RLS activado en TODAS las tablas.
--   - Un usuario autenticado solo ve / modifica datos de organizaciones a
--     las que pertenece (organization_members). La pertenencia se comprueba
--     con la función auxiliar public.is_org_member(uuid).
--   - service_role IGNORA el RLS por diseño de Supabase (bypass implícito);
--     esa clave NUNCA se usa en la app, solo en el servidor si hiciera falta.
--   - Buckets 'assets' y 'backups' privados; políticas de storage básicas
--     para usuarios autenticados.
-- ============================================================================

-- Extensión para gen_random_uuid() (normalmente ya activa en Supabase).
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Función + trigger genérico de updated_at
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================================
-- 1. USERS — perfil público espejo de auth.users (id = auth.users.id)
-- ============================================================================
create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
comment on table public.users is 'Perfiles de usuario (id = auth.users.id).';

-- ============================================================================
-- 2. ORGANIZATIONS — equipos / estudios
-- ============================================================================
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
comment on table public.organizations is 'Estudios / equipos que agrupan proyectos.';

-- ============================================================================
-- 3. ORGANIZATION_MEMBERS — pertenencia usuario <-> organización (M2M)
-- ============================================================================
create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  role text not null default 'editor' check (role in ('owner', 'admin', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  unique (organization_id, user_id)
);
comment on table public.organization_members is 'Miembros de cada organización con su rol.';

-- ---------------------------------------------------------------------------
-- Función auxiliar: ¿el usuario autenticado pertenece a esta organización?
-- SECURITY DEFINER para poder leer organization_members sin recursión de RLS.
-- Va DESPUÉS de crear `organization_members`: PostgreSQL valida el cuerpo
-- de una función SQL al crearla y la tabla debe existir ya (si va antes,
-- la creación falla con ERROR 42P01: relation "public.organization_members"
-- does not exist).
-- ---------------------------------------------------------------------------
create or replace function public.is_org_member(org_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = org_id
      and om.user_id = auth.uid()
  );
$$;

-- ============================================================================
-- 4. INVITATIONS — invitaciones por email a una organización
-- ============================================================================
create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email text not null,
  role text not null default 'editor' check (role in ('admin', 'editor', 'viewer')),
  token text not null unique default gen_random_uuid()::text,
  invited_by uuid references public.users (id) on delete set null,
  accepted_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
comment on table public.invitations is 'Invitaciones pendientes a organizaciones.';

-- ============================================================================
-- 5. PROJECTS — proyectos de anime
-- ============================================================================
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete set null,
  name text not null,
  description text,
  status text not null default 'active' check (status in ('active', 'archived', 'draft')),
  cover_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
comment on table public.projects is 'Proyectos de anime; todo el contenido cuelga de un proyecto.';

-- ============================================================================
-- 6. PROJECT_SETTINGS — ajustes por proyecto (1:1 con projects)
-- ============================================================================
create table if not exists public.project_settings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects (id) on delete cascade,
  default_language text not null default 'es',
  default_aspect_ratio text not null default '16:9',
  auto_backup_enabled boolean not null default false,
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
comment on table public.project_settings is 'Ajustes de cada proyecto (uno por proyecto).';

-- ============================================================================
-- 7. SEASONS — temporadas de un proyecto
-- ============================================================================
create table if not exists public.seasons (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  number integer not null,
  title text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  unique (project_id, number)
);
comment on table public.seasons is 'Temporadas de un proyecto.';

-- ============================================================================
-- 8. EPISODES — episodios (de una temporada o sueltos)
-- ============================================================================
create table if not exists public.episodes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  season_id uuid references public.seasons (id) on delete set null,
  number integer not null,
  title text not null,
  synopsis text,
  status text not null default 'draft' check (status in ('draft', 'in_progress', 'done', 'published')),
  duration_seconds integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  unique (project_id, season_id, number)
);
comment on table public.episodes is 'Episodios de un proyecto.';

-- ============================================================================
-- 9. SCENES — escenas de un episodio
-- ============================================================================
create table if not exists public.scenes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  episode_id uuid not null references public.episodes (id) on delete cascade,
  -- location_id sin FK aquí: locations se crea más abajo; la FK se añade
  -- con ALTER TABLE en la sección "FK diferidas" tras crear todas las tablas.
  location_id uuid,
  number integer not null,
  title text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  unique (episode_id, number)
);
comment on table public.scenes is 'Escenas de un episodio.';

-- ============================================================================
-- 10. SHOTS — planos de una escena
-- ============================================================================
create table if not exists public.shots (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  scene_id uuid not null references public.scenes (id) on delete cascade,
  number integer not null,
  description text,
  duration_seconds numeric,
  camera_angle text,
  status text not null default 'draft' check (status in ('draft', 'in_progress', 'done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  unique (scene_id, number)
);
comment on table public.shots is 'Planos (shots) de una escena.';

-- ============================================================================
-- 11. DIALOGUE_LINES — líneas de diálogo (guion)
-- ============================================================================
create table if not exists public.dialogue_lines (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  scene_id uuid references public.scenes (id) on delete cascade,
  shot_id uuid references public.shots (id) on delete set null,
  -- character_id sin FK aquí: characters se crea más abajo; la FK se añade
  -- con ALTER TABLE en la sección "FK diferidas" tras crear todas las tablas.
  character_id uuid,
  episode_id uuid references public.episodes (id) on delete cascade,
  text text not null,
  order_index integer not null default 0,
  start_time numeric,
  end_time numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
comment on table public.dialogue_lines is 'Líneas de diálogo del guion, con orden y tiempos opcionales.';

-- ============================================================================
-- 12. CHARACTERS — personajes del proyecto
-- ============================================================================
create table if not exists public.characters (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  age integer,
  description text,
  appearance jsonb not null default '{}'::jsonb,
  eye_color text,
  voice_notes text,
  is_main boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
comment on table public.characters is 'Personajes de un proyecto (apariencia en JSON).';

-- ============================================================================
-- 13. CHARACTER_OUTFITS — vestimentas de un personaje
-- ============================================================================
create table if not exists public.character_outfits (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  character_id uuid not null references public.characters (id) on delete cascade,
  name text not null,
  description text,
  image_url text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
comment on table public.character_outfits is 'Vestimentas / atuendos de cada personaje.';

-- ============================================================================
-- 14. CHARACTER_RELATIONSHIPS — relaciones entre personajes (M2M)
-- ============================================================================
create table if not exists public.character_relationships (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  character_a_id uuid not null references public.characters (id) on delete cascade,
  character_b_id uuid not null references public.characters (id) on delete cascade,
  relationship_type text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  unique (character_a_id, character_b_id, relationship_type),
  check (character_a_id <> character_b_id)
);
comment on table public.character_relationships is 'Relaciones entre dos personajes (amistad, rivalidad, familia...).';

-- ============================================================================
-- 15. LORE_ENTRIES — entradas del lore / universo
-- ============================================================================
create table if not exists public.lore_entries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null,
  content text,
  category text,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
comment on table public.lore_entries is 'Entradas del lore del universo del proyecto.';

-- ============================================================================
-- 16. TIMELINE_EVENTS — eventos de la cronología
-- ============================================================================
create table if not exists public.timeline_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  episode_id uuid references public.episodes (id) on delete set null,
  title text not null,
  description text,
  event_date date,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
comment on table public.timeline_events is 'Eventos de la cronología del universo.';

-- ============================================================================
-- 17. LOCATIONS — lugares del universo
-- ============================================================================
create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  description text,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
comment on table public.locations is 'Lugares / escenarios del proyecto.';

-- ============================================================================
-- 18. OBJECTS — objetos del universo
-- ============================================================================
create table if not exists public.objects (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  location_id uuid references public.locations (id) on delete set null,
  name text not null,
  description text,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
comment on table public.objects is 'Objetos relevantes del universo.';

-- ============================================================================
-- 19. PROMPTS — biblioteca de prompts de generación
-- ============================================================================
create table if not exists public.prompts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null,
  prompt_text text not null,
  category text,
  model text,
  is_favorite boolean not null default false,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
comment on table public.prompts is 'Prompts guardados para generación de imágenes / vídeo.';

-- ============================================================================
-- 20. ASSETS — archivos multimedia (referencias a Storage)
-- ============================================================================
create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  character_id uuid references public.characters (id) on delete set null,
  episode_id uuid references public.episodes (id) on delete set null,
  scene_id uuid references public.scenes (id) on delete set null,
  shot_id uuid references public.shots (id) on delete set null,
  prompt_id uuid references public.prompts (id) on delete set null,
  name text not null,
  file_name text,
  file_path text,
  file_type text,
  mime_type text,
  size_bytes bigint,
  storage_bucket text not null default 'assets',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
comment on table public.assets is 'Archivos multimedia; el binario vive en Storage (bucket assets).';

-- ============================================================================
-- 21. TAGS — etiquetas por proyecto
-- ============================================================================
create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  unique (project_id, name)
);
comment on table public.tags is 'Etiquetas reutilizables dentro de un proyecto.';

-- ============================================================================
-- 22. ASSET_TAGS — etiquetas de un asset (M2M)
-- ============================================================================
create table if not exists public.asset_tags (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  asset_id uuid not null references public.assets (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  unique (asset_id, tag_id)
);
comment on table public.asset_tags is 'Relación muchos-a-muchos entre assets y etiquetas.';

-- ============================================================================
-- 23. VOICE_ACTORS — actores de voz
-- ============================================================================
create table if not exists public.voice_actors (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  contact_email text,
  language text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
comment on table public.voice_actors is 'Actores de voz del proyecto.';

-- ============================================================================
-- 24. VOICE_ASSIGNMENTS — qué actor dobla a qué personaje (M2M)
-- ============================================================================
create table if not exists public.voice_assignments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  character_id uuid not null references public.characters (id) on delete cascade,
  voice_actor_id uuid not null references public.voice_actors (id) on delete cascade,
  role_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  unique (character_id, voice_actor_id)
);
comment on table public.voice_assignments is 'Asignación actor de voz <-> personaje.';

-- ============================================================================
-- 25. RECORDINGS — grabaciones de doblaje
-- ============================================================================
create table if not exists public.recordings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  voice_actor_id uuid references public.voice_actors (id) on delete set null,
  dialogue_line_id uuid references public.dialogue_lines (id) on delete set null,
  episode_id uuid references public.episodes (id) on delete set null,
  file_path text,
  duration_seconds numeric,
  status text not null default 'draft' check (status in ('draft', 'approved', 'rejected')),
  recorded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
comment on table public.recordings is 'Grabaciones de voz; el audio vive en Storage (bucket assets).';

-- ============================================================================
-- 26. PUBLICATIONS — publicaciones de episodios en plataformas
-- ============================================================================
create table if not exists public.publications (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  episode_id uuid references public.episodes (id) on delete set null,
  platform text not null,
  url text,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
comment on table public.publications is 'Publicaciones de episodios (YouTube, TikTok, etc.).';

-- ============================================================================
-- 27. BACKUPS — copias de seguridad (el ZIP vive en Storage, bucket backups)
-- ============================================================================
create table if not exists public.backups (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete set null,
  file_path text,
  size_bytes bigint,
  status text not null default 'done' check (status in ('pending', 'done', 'failed')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
comment on table public.backups is 'Registro de copias de seguridad del proyecto.';

-- ============================================================================
-- FK diferidas — referencias a tablas creadas más abajo en este archivo
-- (Postgres exige que la tabla referenciada exista al crear la FK).
-- ============================================================================
alter table public.scenes
  add constraint scenes_location_id_fkey
  foreign key (location_id) references public.locations (id) on delete set null;

alter table public.dialogue_lines
  add constraint dialogue_lines_character_id_fkey
  foreign key (character_id) references public.characters (id) on delete set null;

-- ============================================================================
-- ÍNDICES — project_id en todas las tablas de proyecto y FK de relaciones M2M
-- ============================================================================
create index if not exists idx_projects_organization_id on public.projects (organization_id);
create index if not exists idx_org_members_organization_id on public.organization_members (organization_id);
create index if not exists idx_org_members_user_id on public.organization_members (user_id);
create index if not exists idx_invitations_organization_id on public.invitations (organization_id);
create index if not exists idx_project_settings_project_id on public.project_settings (project_id);
create index if not exists idx_seasons_project_id on public.seasons (project_id);
create index if not exists idx_episodes_project_id on public.episodes (project_id);
create index if not exists idx_episodes_season_id on public.episodes (season_id);
create index if not exists idx_scenes_project_id on public.scenes (project_id);
create index if not exists idx_scenes_episode_id on public.scenes (episode_id);
create index if not exists idx_shots_project_id on public.shots (project_id);
create index if not exists idx_shots_scene_id on public.shots (scene_id);
create index if not exists idx_dialogue_lines_project_id on public.dialogue_lines (project_id);
create index if not exists idx_dialogue_lines_scene_id on public.dialogue_lines (scene_id);
create index if not exists idx_dialogue_lines_character_id on public.dialogue_lines (character_id);
create index if not exists idx_characters_project_id on public.characters (project_id);
create index if not exists idx_character_outfits_project_id on public.character_outfits (project_id);
create index if not exists idx_character_outfits_character_id on public.character_outfits (character_id);
create index if not exists idx_character_relationships_project_id on public.character_relationships (project_id);
create index if not exists idx_character_relationships_a on public.character_relationships (character_a_id);
create index if not exists idx_character_relationships_b on public.character_relationships (character_b_id);
create index if not exists idx_lore_entries_project_id on public.lore_entries (project_id);
create index if not exists idx_timeline_events_project_id on public.timeline_events (project_id);
create index if not exists idx_locations_project_id on public.locations (project_id);
create index if not exists idx_objects_project_id on public.objects (project_id);
create index if not exists idx_prompts_project_id on public.prompts (project_id);
create index if not exists idx_assets_project_id on public.assets (project_id);
create index if not exists idx_tags_project_id on public.tags (project_id);
create index if not exists idx_asset_tags_project_id on public.asset_tags (project_id);
create index if not exists idx_asset_tags_asset_id on public.asset_tags (asset_id);
create index if not exists idx_asset_tags_tag_id on public.asset_tags (tag_id);
create index if not exists idx_voice_actors_project_id on public.voice_actors (project_id);
create index if not exists idx_voice_assignments_project_id on public.voice_assignments (project_id);
create index if not exists idx_voice_assignments_character_id on public.voice_assignments (character_id);
create index if not exists idx_voice_assignments_actor_id on public.voice_assignments (voice_actor_id);
create index if not exists idx_recordings_project_id on public.recordings (project_id);
create index if not exists idx_recordings_actor_id on public.recordings (voice_actor_id);
create index if not exists idx_publications_project_id on public.publications (project_id);
create index if not exists idx_backups_project_id on public.backups (project_id);
create index if not exists idx_backups_organization_id on public.backups (organization_id);

-- ============================================================================
-- Trigger de updated_at en todas las tablas con esa columna
-- ============================================================================
do $$
declare
  t text;
begin
  for t in
    select table_name
    from information_schema.columns
    where table_schema = 'public'
      and column_name = 'updated_at'
  loop
    execute format(
      'drop trigger if exists trg_set_updated_at on public.%I; ' ||
      'create trigger trg_set_updated_at ' ||
      'before update on public.%I ' ||
      'for each row execute function public.set_updated_at();',
      t, t
    );
  end loop;
end $$;

-- ============================================================================
-- ROW LEVEL SECURITY
-- Regla base: solo miembros de la organización ven / tocan sus datos.
-- Lectura y escritura con políticas separadas. service_role no pasa por RLS.
-- ============================================================================

-- Activar RLS en todas las tablas
alter table public.users enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.invitations enable row level security;
alter table public.projects enable row level security;
alter table public.project_settings enable row level security;
alter table public.seasons enable row level security;
alter table public.episodes enable row level security;
alter table public.scenes enable row level security;
alter table public.shots enable row level security;
alter table public.dialogue_lines enable row level security;
alter table public.characters enable row level security;
alter table public.character_outfits enable row level security;
alter table public.character_relationships enable row level security;
alter table public.lore_entries enable row level security;
alter table public.timeline_events enable row level security;
alter table public.locations enable row level security;
alter table public.objects enable row level security;
alter table public.prompts enable row level security;
alter table public.assets enable row level security;
alter table public.tags enable row level security;
alter table public.asset_tags enable row level security;
alter table public.voice_actors enable row level security;
alter table public.voice_assignments enable row level security;
alter table public.recordings enable row level security;
alter table public.publications enable row level security;
alter table public.backups enable row level security;

-- --- users: cada uno ve y edita solo su propio perfil ---
drop policy if exists "users_select_own" on public.users;
create policy "users_select_own" on public.users
  for select to authenticated using (id = auth.uid());
drop policy if exists "users_update_own" on public.users;
create policy "users_update_own" on public.users
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists "users_insert_own" on public.users;
create policy "users_insert_own" on public.users
  for insert to authenticated with check (id = auth.uid());

-- --- organizations: lectura para miembros; creación para cualquier autenticado ---
drop policy if exists "organizations_select_member" on public.organizations;
create policy "organizations_select_member" on public.organizations
  for select to authenticated using (public.is_org_member(id));
drop policy if exists "organizations_insert_auth" on public.organizations;
create policy "organizations_insert_auth" on public.organizations
  for insert to authenticated with check (true);
drop policy if exists "organizations_update_member" on public.organizations;
create policy "organizations_update_member" on public.organizations
  for update to authenticated using (public.is_org_member(id)) with check (public.is_org_member(id));
drop policy if exists "organizations_delete_member" on public.organizations;
create policy "organizations_delete_member" on public.organizations
  for delete to authenticated using (public.is_org_member(id));

-- --- organization_members: visibles y gestionables por miembros de la org ---
drop policy if exists "org_members_select" on public.organization_members;
create policy "org_members_select" on public.organization_members
  for select to authenticated using (public.is_org_member(organization_id));
drop policy if exists "org_members_insert" on public.organization_members;
create policy "org_members_insert" on public.organization_members
  for insert to authenticated with check (public.is_org_member(organization_id));
drop policy if exists "org_members_update" on public.organization_members;
create policy "org_members_update" on public.organization_members
  for update to authenticated using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
drop policy if exists "org_members_delete" on public.organization_members;
create policy "org_members_delete" on public.organization_members
  for delete to authenticated using (public.is_org_member(organization_id));

-- --- invitations: solo miembros de la organización ---
drop policy if exists "invitations_select" on public.invitations;
create policy "invitations_select" on public.invitations
  for select to authenticated using (public.is_org_member(organization_id));
drop policy if exists "invitations_write" on public.invitations;
create policy "invitations_write" on public.invitations
  for all to authenticated using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));

-- --- projects: solo miembros de su organización ---
drop policy if exists "projects_select" on public.projects;
create policy "projects_select" on public.projects
  for select to authenticated using (
    organization_id is null or public.is_org_member(organization_id)
  );
drop policy if exists "projects_insert" on public.projects;
create policy "projects_insert" on public.projects
  for insert to authenticated with check (
    organization_id is null or public.is_org_member(organization_id)
  );
drop policy if exists "projects_update" on public.projects;
create policy "projects_update" on public.projects
  for update to authenticated using (
    organization_id is null or public.is_org_member(organization_id)
  ) with check (
    organization_id is null or public.is_org_member(organization_id)
  );
drop policy if exists "projects_delete" on public.projects;
create policy "projects_delete" on public.projects
  for delete to authenticated using (
    organization_id is null or public.is_org_member(organization_id)
  );

-- --- Tablas de proyecto: acceso si el usuario es miembro de la org del proyecto ---
-- (project_settings, seasons, episodes, scenes, shots, dialogue_lines,
--  characters, character_outfits, character_relationships, lore_entries,
--  timeline_events, locations, objects, prompts, assets, tags, asset_tags,
--  voice_actors, voice_assignments, recordings, publications, backups)
do $$
declare
  t text;
  tables text[] := array[
    'project_settings','seasons','episodes','scenes','shots','dialogue_lines',
    'characters','character_outfits','character_relationships','lore_entries',
    'timeline_events','locations','objects','prompts','assets','tags','asset_tags',
    'voice_actors','voice_assignments','recordings','publications','backups'
  ];
begin
  foreach t in array tables loop
    -- Lectura
    execute format(
      'drop policy if exists %I on public.%I; ' ||
      'create policy %I on public.%I for select to authenticated using (' ||
      ' exists (select 1 from public.projects p where p.id = %I.project_id' ||
      '   and (p.organization_id is null or public.is_org_member(p.organization_id))));',
      t || '_select', t, t || '_select', t, t
    );
    -- Escritura (insert / update / delete)
    execute format(
      'drop policy if exists %I on public.%I; ' ||
      'create policy %I on public.%I for all to authenticated using (' ||
      ' exists (select 1 from public.projects p where p.id = %I.project_id' ||
      '   and (p.organization_id is null or public.is_org_member(p.organization_id))))' ||
      ' with check (' ||
      ' exists (select 1 from public.projects p where p.id = %I.project_id' ||
      '   and (p.organization_id is null or public.is_org_member(p.organization_id))));',
      t || '_write', t, t || '_write', t, t, t
    );
  end loop;
end $$;

-- ============================================================================
-- STORAGE — buckets privados 'assets' y 'backups' + políticas básicas
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('assets', 'assets', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('backups', 'backups', false)
on conflict (id) do nothing;

-- Políticas de storage: usuarios autenticados pueden leer / subir / actualizar /
-- borrar objetos de los buckets de la app. (Fase 7: restringir por carpeta/org.)
drop policy if exists "storage_assets_select" on storage.objects;
create policy "storage_assets_select" on storage.objects
  for select to authenticated using (bucket_id in ('assets', 'backups'));
drop policy if exists "storage_assets_insert" on storage.objects;
create policy "storage_assets_insert" on storage.objects
  for insert to authenticated with check (bucket_id in ('assets', 'backups'));
drop policy if exists "storage_assets_update" on storage.objects;
create policy "storage_assets_update" on storage.objects
  for update to authenticated using (bucket_id in ('assets', 'backups')) with check (bucket_id in ('assets', 'backups'));
drop policy if exists "storage_assets_delete" on storage.objects;
create policy "storage_assets_delete" on storage.objects
  for delete to authenticated using (bucket_id in ('assets', 'backups'));

-- Fin de la migración 0001_init.sql
