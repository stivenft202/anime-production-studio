-- ============================================================================
-- Anime Production Studio — Migración 0006 (Fase 7: equipos, roles y sync)
-- Archivo: supabase/migrations/0006_teams_roles.sql
-- Ejecutar tal cual en el Editor SQL de Supabase, DESPUÉS de la 0005.
-- Es idempotente en lo posible: CREATE TABLE IF NOT EXISTS, DO blocks con
-- comprobación de columnas, DROP POLICY IF EXISTS antes de crear.
--
-- Qué cambia respecto a la 0001 (leer antes de ejecutar):
--
-- 1. EQUIPOS POR PROYECTO (nuevo modelo, convive con el de la 0001).
--    La 0001 organizaba el acceso por ORGANIZACIÓN (organization_members):
--    cualquier miembro de la org veía y tocaba todo. La 0006 añade
--    `project_members`: pertenencia por PROYECTO con rol propio
--    ('owner' | 'editor' | 'viewer'), independiente de la organización.
--    Un proyecto puede tener miembros aunque no tenga organización.
--    El `owner` del proyecto es quien gestiona el equipo; el último
--    owner no se puede quitar ni degradar (trigger).
--
-- 2. POLÍTICAS RLS POR ROL (sustituyen a las de la 0001).
--    La 0001 daba el mismo acceso a todos los miembros de la org
--    (lectura y escritura con una sola política `_write`). La 0006
--    sustituye esas políticas en `projects` y en todas las tablas de
--    entidades por cuatro políticas por tabla (select / insert /
--    update / delete) con esta regla:
--      - Leer: miembro de la organización (cualquier rol) O miembro
--        del proyecto (cualquier rol) O proyecto sin organización
--        (comportamiento heredado de la 0001).
--      - Escribir (insert/update/delete de entidades): miembro de la
--        org con rol owner/admin/editor, O miembro del proyecto con
--        rol owner/editor, O proyecto sin organización y SIN miembros
--        (caso local: el proyecto recién sincronizado aún no tiene
--        equipo; en cuanto se registra el primer miembro, esta vía
--        se cierra y solo escriben owner/editor).
--      - Borrar el PROYECTO: solo owner (del proyecto o de la org),
--        o proyecto sin organización y sin miembros.
--    Los borrados de entidades (personajes, episodios, ...) los puede
--    hacer editor/owner; solo el borrado del proyecto es owner-only.
--    Funciones auxiliares SECURITY DEFINER (mismo patrón que
--    `is_org_member` de la 0001): `is_project_member`,
--    `project_member_role`, `is_org_editor`, `is_org_owner`.
--
-- 3. TABLA NUEVA `character_images`.
--    Dexie tiene `characterImages` (imágenes de personaje por categoría)
--    y la 0001 no creó su equivalente remoto. Se crea aquí para que el
--    sync la cubra; `project_id` se deriva del personaje.
--
-- 4. COLUMNAS QUE FALTABAN para igualar el contrato local (Dexie).
--    La 0002/0003/0004/0005 ya cubrieron lore, guiones, lugares, voces
--    y publicación. Aquí se añaden las restantes (estilo DO blocks con
--    comprobación, como la 0003/0004): datos del proyecto (genre,
--    synopsis, language, logo/cover por id, tags, team, social_links),
--    personajes (internal_id, main_image_id), vestimentas (image_ids),
--    relaciones (label), episodios (character_ids, place_names),
--    escenas y planos (character_ids, image_asset_ids, prompt_ids,
--    order_index), prompts (character_ids, episode/scene/shot,
--    image_asset_ids, generated_result_asset_id), actores (notes) y
--    assets (blob_id, category).
--    Los estados pasan a los valores en español de la app (mismo
--    patrón que la 0004 con recordings y la 0005 con publications):
--      - projects.status: ('idea','en-produccion','pausado',
--        'completado','archivado') en vez de
--        ('active','archived','draft').
--      - episodes.status: ('borrador','en-escritura','terminado',
--        'publicado') en vez de ('draft','in_progress','done',
--        'published').
--      - shots.status: ('borrador','en-progreso','terminado',
--        'descartado') en vez de ('draft','in_progress','done').
--    Al leer, la app traduce los valores antiguos en inglés a los
--    nuevos en español (ver src/lib/sync.ts).
--
-- 5. STORAGE: el bucket `assets` se restringe por carpeta de proyecto.
--    La 0001 permitía a cualquier usuario autenticado leer/escribir en
--    `assets` y `backups`. La 0006 sustituye esas políticas: los objetos
--    de `assets` deben vivir bajo `<projectId>/...` y solo los
--    miembros del proyecto pueden leerlos (cualquier rol) o
--    escribirlos (owner/editor). El bucket `backups` conserva la
--    política de la 0001 (cualquier autenticado) porque los backups
--    los gestiona otro módulo (ver src/lib/backups.ts).
--
-- 6. SIN SESIÓN NO HAY SYNC.
--    Todas las políticas exigen `authenticated` (rol con sesión de
--    Supabase Auth). La anon key sola NO basta: identifica el proyecto,
--    no al usuario. La app exige iniciar sesión (email + contraseña)
--    antes de sincronizar; sin sesión, `syncNow()` devuelve
--    `not-authenticated` en vez de fingir éxito.
--
-- NOTA: el modo local (Dexie) sigue siendo la fuente de verdad
-- mientras Supabase no esté configurado; esta migración solo se
-- aplica cuando Stiven conecte su proyecto de Supabase.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. project_members — equipo de cada proyecto con su rol
-- ---------------------------------------------------------------------------
create table if not exists public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null,
  role text not null default 'viewer' check (role in ('owner', 'editor', 'viewer')),
  invited_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  unique (project_id, user_id)
);
comment on table public.project_members is 'Miembros de cada proyecto con su rol (owner: gestiona el equipo y puede borrar el proyecto; editor: lee y escribe; viewer: solo lee). user_id es el id del usuario en Supabase Auth (auth.users.id); no hay FK a auth.users porque la tabla vive en otro esquema y Supabase no lo recomienda en migraciones.';

create index if not exists idx_project_members_project_id on public.project_members (project_id);
create index if not exists idx_project_members_user_id on public.project_members (user_id);

-- ---------------------------------------------------------------------------
-- Funciones auxiliares de pertenencia y rol (SECURITY DEFINER, como
-- `is_org_member` de la 0001: leen las tablas de miembros sin
-- recursión de RLS). Van DESPUÉS de crear `project_members`:
-- PostgreSQL valida el cuerpo de una función SQL al crearla y la
-- tabla debe existir ya.
-- ---------------------------------------------------------------------------
create or replace function public.is_project_member(p_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1
    from public.project_members pm
    where pm.project_id = p_id
      and pm.user_id = auth.uid()
  );
$$;

create or replace function public.project_member_role(p_id uuid)
returns text
language sql
security definer
stable
as $$
  select pm.role
  from public.project_members pm
  where pm.project_id = p_id
    and pm.user_id = auth.uid()
  limit 1;
$$;

create or replace function public.is_org_editor(org_id uuid)
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
      and om.role in ('owner', 'admin', 'editor')
  );
$$;

create or replace function public.is_org_owner(org_id uuid)
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
      and om.role = 'owner'
  );
$$;

-- Trigger de updated_at (la 0001 solo lo puso en las tablas que ya
-- existían entonces).
drop trigger if exists trg_set_updated_at on public.project_members;
create trigger trg_set_updated_at
  before update on public.project_members
  for each row execute function public.set_updated_at();

-- El último owner no se puede quitar ni degradar: sin owner el
-- proyecto quedaría sin nadie que gestione el equipo.
create or replace function public.prevent_last_project_owner_loss()
returns trigger
language plpgsql
as $$
declare
  remaining_owners integer;
begin
  if TG_OP = 'DELETE' then
    if OLD.role = 'owner' then
      select count(*) into remaining_owners
      from public.project_members
      where project_id = OLD.project_id
        and role = 'owner'
        and id <> OLD.id;
      if remaining_owners = 0 then
        raise exception 'No se puede quitar al último owner del proyecto';
      end if;
    end if;
    return OLD;
  end if;
  -- UPDATE OF role: degradar a un owner.
  if OLD.role = 'owner' and NEW.role <> 'owner' then
    select count(*) into remaining_owners
    from public.project_members
    where project_id = OLD.project_id
      and role = 'owner'
      and id <> OLD.id;
    if remaining_owners = 0 then
      raise exception 'No se puede degradar al último owner del proyecto';
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_prevent_last_owner_loss on public.project_members;
create trigger trg_prevent_last_owner_loss
  before delete or update of role on public.project_members
  for each row execute function public.prevent_last_project_owner_loss();

-- ---------------------------------------------------------------------------
-- 2. character_images — imágenes de personaje por categoría (nueva;
--    Dexie ya la tenía, el remoto no)
-- ---------------------------------------------------------------------------
create table if not exists public.character_images (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  character_id uuid not null references public.characters (id) on delete cascade,
  asset_id uuid not null references public.assets (id) on delete cascade,
  category text not null default 'otro' check (category in ('rostro', 'cuerpo', 'vestimenta', 'expresiones', 'poses', 'alternativos', 'otro')),
  is_main boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
comment on table public.character_images is 'Imágenes asociadas a un personaje (rostro, cuerpo, vestimenta, expresiones, poses...). project_id se deriva del personaje al sincronizar.';

create index if not exists idx_character_images_project_id on public.character_images (project_id);
create index if not exists idx_character_images_character_id on public.character_images (character_id);
create index if not exists idx_character_images_asset_id on public.character_images (asset_id);

drop trigger if exists trg_set_updated_at on public.character_images;
create trigger trg_set_updated_at
  before update on public.character_images
  for each row execute function public.set_updated_at();

-- Trigger de updated_at para las tablas de la 0003 y la 0005, que la
-- 0001 no pudo cubrir (se crearon después de su bucle).
do $$
declare
  t text;
begin
  for t in select unnest(array['prompt_variants', 'asset_links', 'publication_title_versions']) loop
    execute format(
      'drop trigger if exists trg_set_updated_at on public.%I; ' ||
      'create trigger trg_set_updated_at ' ||
      'before update on public.%I ' ||
      'for each row execute function public.set_updated_at();',
      t, t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Columnas que faltaban para igualar el contrato local (Dexie)
--    Estilo 0003/0004: DO blocks con comprobación; idempotente.
-- ---------------------------------------------------------------------------
do $$
begin
  -- projects: género, sinopsis, idioma, logos por id, etiquetas, equipo y redes.
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'projects' and column_name = 'genre') then
    alter table public.projects add column genre text not null default '';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'projects' and column_name = 'synopsis') then
    alter table public.projects add column synopsis text not null default '';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'projects' and column_name = 'language') then
    alter table public.projects add column language text not null default 'español';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'projects' and column_name = 'logo_asset_id') then
    alter table public.projects add column logo_asset_id uuid references public.assets (id) on delete set null;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'projects' and column_name = 'cover_asset_id') then
    alter table public.projects add column cover_asset_id uuid references public.assets (id) on delete set null;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'projects' and column_name = 'tags') then
    alter table public.projects add column tags text[] not null default '{}';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'projects' and column_name = 'team') then
    alter table public.projects add column team text[] not null default '{}';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'projects' and column_name = 'social_links') then
    alter table public.projects add column social_links jsonb not null default '[]'::jsonb;
  end if;

  -- characters: id interno y retrato principal por id de asset.
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'characters' and column_name = 'internal_id') then
    alter table public.characters add column internal_id text not null default '';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'characters' and column_name = 'main_image_id') then
    alter table public.characters add column main_image_id uuid references public.assets (id) on delete set null;
  end if;

  -- character_outfits: ids de las imágenes de la vestimenta.
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'character_outfits' and column_name = 'image_ids') then
    alter table public.character_outfits add column image_ids uuid[] not null default '{}';
  end if;

  -- character_relationships: etiqueta libre de la relación.
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'character_relationships' and column_name = 'label') then
    alter table public.character_relationships add column label text;
  end if;

  -- episodes: personajes y lugares (por nombre) del episodio.
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'episodes' and column_name = 'character_ids') then
    alter table public.episodes add column character_ids uuid[] not null default '{}';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'episodes' and column_name = 'place_names') then
    alter table public.episodes add column place_names text[] not null default '{}';
  end if;

  -- scenes: personajes, imágenes, prompts y orden.
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'scenes' and column_name = 'character_ids') then
    alter table public.scenes add column character_ids uuid[] not null default '{}';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'scenes' and column_name = 'image_asset_ids') then
    alter table public.scenes add column image_asset_ids uuid[] not null default '{}';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'scenes' and column_name = 'prompt_ids') then
    alter table public.scenes add column prompt_ids uuid[] not null default '{}';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'scenes' and column_name = 'order_index') then
    alter table public.scenes add column order_index integer not null default 0;
  end if;

  -- shots: personajes, imágenes y orden.
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'shots' and column_name = 'character_ids') then
    alter table public.shots add column character_ids uuid[] not null default '{}';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'shots' and column_name = 'image_asset_ids') then
    alter table public.shots add column image_asset_ids uuid[] not null default '{}';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'shots' and column_name = 'order_index') then
    alter table public.shots add column order_index integer not null default 0;
  end if;

  -- prompts: personajes, episodio/escena/plano, imágenes y resultado.
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'prompts' and column_name = 'character_ids') then
    alter table public.prompts add column character_ids uuid[] not null default '{}';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'prompts' and column_name = 'episode_id') then
    alter table public.prompts add column episode_id uuid references public.episodes (id) on delete set null;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'prompts' and column_name = 'scene_id') then
    alter table public.prompts add column scene_id uuid references public.scenes (id) on delete set null;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'prompts' and column_name = 'shot_id') then
    alter table public.prompts add column shot_id uuid references public.shots (id) on delete set null;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'prompts' and column_name = 'image_asset_ids') then
    alter table public.prompts add column image_asset_ids uuid[] not null default '{}';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'prompts' and column_name = 'generated_result_asset_id') then
    alter table public.prompts add column generated_result_asset_id uuid references public.assets (id) on delete set null;
  end if;

  -- voice_actors: notas libres.
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'voice_actors' and column_name = 'notes') then
    alter table public.voice_actors add column notes text not null default '';
  end if;

  -- assets: id del blob local (para localizar el binario) y categoría.
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'assets' and column_name = 'blob_id') then
    alter table public.assets add column blob_id text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'assets' and column_name = 'category') then
    alter table public.assets add column category text;
  end if;
end $$;

create index if not exists idx_prompts_episode_id on public.prompts (episode_id);
create index if not exists idx_prompts_scene_id on public.prompts (scene_id);
create index if not exists idx_prompts_shot_id on public.prompts (shot_id);
create index if not exists idx_projects_logo_asset_id on public.projects (logo_asset_id);
create index if not exists idx_projects_cover_asset_id on public.projects (cover_asset_id);
create index if not exists idx_characters_main_image_id on public.characters (main_image_id);

-- ---------------------------------------------------------------------------
-- 4. Estados en español (mismo patrón que la 0004/0005: se busca el
--    check antiguo por su definición, se elimina y se crea el nuevo).
-- ---------------------------------------------------------------------------
-- projects.status: ('idea','en-produccion','pausado','completado','archivado')
do $$
declare
  old_check text;
begin
  select conname into old_check
  from pg_constraint
  where conrelid = 'public.projects'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%active%archived%draft%'
  limit 1;
  if old_check is not null then
    execute format('alter table public.projects drop constraint %I', old_check);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'projects_status_es_check') then
    alter table public.projects
      add constraint projects_status_es_check
      check (status in ('idea', 'en-produccion', 'pausado', 'completado', 'archivado'));
  end if;
end $$;
alter table public.projects alter column status set default 'idea';

-- episodes.status: ('borrador','en-escritura','terminado','publicado')
do $$
declare
  old_check text;
begin
  select conname into old_check
  from pg_constraint
  where conrelid = 'public.episodes'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%draft%in_progress%done%published%'
  limit 1;
  if old_check is not null then
    execute format('alter table public.episodes drop constraint %I', old_check);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'episodes_status_es_check') then
    alter table public.episodes
      add constraint episodes_status_es_check
      check (status in ('borrador', 'en-escritura', 'terminado', 'publicado'));
  end if;
end $$;
alter table public.episodes alter column status set default 'borrador';

-- shots.status: ('borrador','en-progreso','terminado','descartado')
do $$
declare
  old_check text;
begin
  select conname into old_check
  from pg_constraint
  where conrelid = 'public.shots'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%draft%in_progress%done%'
  limit 1;
  if old_check is not null then
    execute format('alter table public.shots drop constraint %I', old_check);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'shots_status_es_check') then
    alter table public.shots
      add constraint shots_status_es_check
      check (status in ('borrador', 'en-progreso', 'terminado', 'descartado'));
  end if;
end $$;
alter table public.shots alter column status set default 'borrador';

-- ---------------------------------------------------------------------------
-- 5. RLS — project_members y character_images
-- ---------------------------------------------------------------------------
alter table public.project_members enable row level security;
alter table public.character_images enable row level security;

-- project_members: los miembros del proyecto (o de su organización)
-- ven el equipo. Solo el owner gestiona miembros. Además, cualquier
-- usuario puede apuntarse a sí mismo como owner cuando el proyecto
-- aún no tiene ningún miembro y pertenece a su organización (o no
-- tiene organización): es el arranque del equipo para proyectos que
-- se sincronizaron desde local sin equipo.
drop policy if exists "project_members_select" on public.project_members;
create policy "project_members_select" on public.project_members
  for select to authenticated using (
    exists (select 1 from public.projects p where p.id = project_members.project_id
      and (p.organization_id is null
        or public.is_org_member(p.organization_id)
        or public.is_project_member(p.id)))
  );

drop policy if exists "project_members_insert_bootstrap" on public.project_members;
create policy "project_members_insert_bootstrap" on public.project_members
  for insert to authenticated with check (
    user_id = auth.uid()
    and role = 'owner'
    and not exists (select 1 from public.project_members pm where pm.project_id = project_members.project_id)
    and exists (select 1 from public.projects p where p.id = project_members.project_id
      and (p.organization_id is null or public.is_org_member(p.organization_id)))
  );

drop policy if exists "project_members_insert_owner" on public.project_members;
create policy "project_members_insert_owner" on public.project_members
  for insert to authenticated with check (
    public.project_member_role(project_id) = 'owner'
  );

drop policy if exists "project_members_update" on public.project_members;
create policy "project_members_update" on public.project_members
  for update to authenticated using (
    public.project_member_role(project_id) = 'owner'
  ) with check (
    public.project_member_role(project_id) = 'owner'
  );

drop policy if exists "project_members_delete" on public.project_members;
create policy "project_members_delete" on public.project_members
  for delete to authenticated using (
    public.project_member_role(project_id) = 'owner'
  );

-- ---------------------------------------------------------------------------
-- 6. RLS — políticas por rol en `projects` (sustituyen a las de la 0001)
-- ---------------------------------------------------------------------------
drop policy if exists "projects_select" on public.projects;
create policy "projects_select" on public.projects
  for select to authenticated using (
    organization_id is null
    or public.is_org_member(organization_id)
    or public.is_project_member(id)
  );

-- Insertar proyectos: como en la 0001 (sin organización, o miembro de
-- la organización). Quien crea el proyecto se apunta luego como owner
-- con la política project_members_insert_bootstrap.
drop policy if exists "projects_insert" on public.projects;
create policy "projects_insert" on public.projects
  for insert to authenticated with check (
    organization_id is null or public.is_org_member(organization_id)
  );

drop policy if exists "projects_update" on public.projects;
create policy "projects_update" on public.projects
  for update to authenticated using (
    (organization_id is not null and public.is_org_editor(organization_id))
    or public.project_member_role(id) in ('owner', 'editor')
    or (organization_id is null and not exists (select 1 from public.project_members pm where pm.project_id = id))
  ) with check (
    (organization_id is not null and public.is_org_editor(organization_id))
    or public.project_member_role(id) in ('owner', 'editor')
    or (organization_id is null and not exists (select 1 from public.project_members pm where pm.project_id = id))
  );

-- Borrar el proyecto: solo owner (del proyecto o de la organización),
-- o proyecto sin organización y sin miembros (aún sin equipo).
drop policy if exists "projects_delete" on public.projects;
create policy "projects_delete" on public.projects
  for delete to authenticated using (
    (organization_id is not null and public.is_org_owner(organization_id))
    or public.project_member_role(id) = 'owner'
    or (organization_id is null and not exists (select 1 from public.project_members pm where pm.project_id = id))
  );

-- ---------------------------------------------------------------------------
-- 7. RLS — políticas por rol en TODAS las tablas de entidades
--    (sustituyen a `<tabla>_select` y `<tabla>_write` de la 0001, y
--    cubren por fin prompt_variants y asset_links, que la 0003 creó
--    con RLS activado pero sin políticas: hasta ahora nadie podía
--    leerlas ni escribirlas).
--    Regla: leer = org (cualquier rol) / miembro del proyecto
--    (cualquier rol) / proyecto sin organización. Escribir y borrar
--    filas = org editor o superior / miembro owner-editor /
--    proyecto sin organización y sin miembros.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  tables text[] := array[
    'project_settings','seasons','episodes','scenes','shots','dialogue_lines',
    'characters','character_images','character_outfits','character_relationships',
    'lore_entries','timeline_events','locations','objects','prompts','assets',
    'tags','asset_tags','voice_actors','voice_assignments','recordings',
    'publications','backups','prompt_variants','asset_links',
    'publication_title_versions'
  ];
  read_clause text;
  write_clause text;
begin
  -- La condición de lectura y la de escritura son las mismas para
  -- todas las tablas de entidades; solo cambia el nombre de la tabla.
  read_clause :=
    ' exists (select 1 from public.projects p where p.id = %I.project_id' ||
    '   and (p.organization_id is null' ||
    '     or public.is_org_member(p.organization_id)' ||
    '     or public.is_project_member(p.id)))';
  write_clause :=
    ' exists (select 1 from public.projects p where p.id = %I.project_id' ||
    '   and ((p.organization_id is not null and public.is_org_editor(p.organization_id))' ||
    '     or public.project_member_role(p.id) in (''owner'',''editor'')' ||
    '     or (p.organization_id is null and not exists (select 1 from public.project_members pm where pm.project_id = p.id))))';

  foreach t in array tables loop
    -- La política `_write` de la 0001 ya no existe: se sustituye por
    -- insert / update / delete separadas.
    execute format('drop policy if exists %I on public.%I;', t || '_write', t);

    execute format(
      'drop policy if exists %I on public.%I; ' ||
      'create policy %I on public.%I for select to authenticated using (' ||
      read_clause || ');',
      t || '_select', t, t || '_select', t, t
    );
    execute format(
      'drop policy if exists %I on public.%I; ' ||
      'create policy %I on public.%I for insert to authenticated with check (' ||
      write_clause || ');',
      t || '_insert', t, t || '_insert', t, t
    );
    execute format(
      'drop policy if exists %I on public.%I; ' ||
      'create policy %I on public.%I for update to authenticated using (' ||
      write_clause || ') with check (' ||
      write_clause || ');',
      t || '_update', t, t || '_update', t, t, t
    );
    execute format(
      'drop policy if exists %I on public.%I; ' ||
      'create policy %I on public.%I for delete to authenticated using (' ||
      write_clause || ');',
      t || '_delete', t, t || '_delete', t, t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 8. STORAGE — bucket `assets` restringido por carpeta de proyecto
--    La 0001 permitía a cualquier autenticado leer/escribir en ambos
--    buckets. Se sustituyen esas cuatro políticas: `backups` conserva
--    el acceso de cualquier autenticado (lo gestiona el módulo de
--    backups); `assets` exige que el objeto viva bajo
--    `<projectId>/...` y que quien lo pide sea miembro de ese proyecto
--    (leer: cualquier rol; escribir/borrar: owner/editor).
-- ---------------------------------------------------------------------------
drop policy if exists "storage_assets_select" on storage.objects;
drop policy if exists "storage_assets_insert" on storage.objects;
drop policy if exists "storage_assets_update" on storage.objects;
drop policy if exists "storage_assets_delete" on storage.objects;

create policy "storage_backups_select" on storage.objects
  for select to authenticated using (bucket_id = 'backups');
create policy "storage_backups_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'backups');
create policy "storage_backups_update" on storage.objects
  for update to authenticated using (bucket_id = 'backups') with check (bucket_id = 'backups');
create policy "storage_backups_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'backups');

create policy "storage_assets_select" on storage.objects
  for select to authenticated using (
    bucket_id = 'assets'
    and exists (select 1 from public.project_members pm
      where pm.project_id::text = split_part(name, '/', 1)
        and pm.user_id = auth.uid())
  );
create policy "storage_assets_insert" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'assets'
    and exists (select 1 from public.project_members pm
      where pm.project_id::text = split_part(name, '/', 1)
        and pm.user_id = auth.uid()
        and pm.role in ('owner', 'editor'))
  );
create policy "storage_assets_update" on storage.objects
  for update to authenticated using (
    bucket_id = 'assets'
    and exists (select 1 from public.project_members pm
      where pm.project_id::text = split_part(name, '/', 1)
        and pm.user_id = auth.uid()
        and pm.role in ('owner', 'editor'))
  ) with check (
    bucket_id = 'assets'
    and exists (select 1 from public.project_members pm
      where pm.project_id::text = split_part(name, '/', 1)
        and pm.user_id = auth.uid()
        and pm.role in ('owner', 'editor'))
  );
create policy "storage_assets_delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'assets'
    and exists (select 1 from public.project_members pm
      where pm.project_id::text = split_part(name, '/', 1)
        and pm.user_id = auth.uid()
        and pm.role in ('owner', 'editor'))
  );

-- Fin de la migración 0006_teams_roles.sql
