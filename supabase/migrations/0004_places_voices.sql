-- Anime Production Studio — migración 0004 (fase 5: lugares, objetos y voces)
--
-- La 0001 ya creó locations, objects, voice_actors, voice_assignments y
-- recordings en versión mínima, con sus políticas RLS y el trigger de
-- updated_at (el bucle de la 0001 cubre todas las tablas con esa
-- columna, así que no hace falta recrearlo). Esta migración añade las
-- columnas que la fase 5 necesita y que la 0001 no tenía, siguiendo el
-- estilo de la 0003 (DO blocks con comprobación; idempotente).
--
-- Cambios de contrato respecto a la 0001:
-- - voice_assignments: la unicidad pasa a ser (character_id, language):
--   un personaje puede tener distintos actores por idioma. Se elimina
--   la unique antigua (character_id, voice_actor_id).
-- - recordings: el estado pasa a los valores en español de la app
--   ('Pendiente', 'Grabado', 'En revisión', 'Aprobado',
--   'Requiere retoma') en vez de ('draft', 'approved', 'rejected').
--   Se conservan file_path / duration_seconds / recorded_at de la 0001.
-- - voice_actors.contact es un DATO RESTRINGIDO (teléfono, correo,
--   redes): se guarda, pero la app lo muestra enmascarado y nunca lo
--   expone en listados ni exportaciones (ver `maskContact` en
--   src/lib/voices.ts). La columna contact_restricted lo marca.
--
-- NOTA: el modo local (Dexie) es la fuente de verdad mientras Supabase
-- no esté configurado; esta migración solo se aplica cuando Stiven
-- conecte su proyecto de Supabase.

-- ---------------------------------------------------------------------------
-- 1. locations: tipo, región, universo, clima, arquitectura, historia,
--    características, relaciones por ids y galería
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'locations' and column_name = 'type') then
    alter table public.locations add column type text not null default 'otro' check (type in ('mundo', 'region', 'monolito', 'poblado', 'casa', 'edificio', 'instalacion', 'naturaleza', 'otro'));
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'locations' and column_name = 'region') then
    alter table public.locations add column region text not null default '';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'locations' and column_name = 'location_in_universe') then
    alter table public.locations add column location_in_universe text not null default '';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'locations' and column_name = 'climate') then
    alter table public.locations add column climate text not null default '';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'locations' and column_name = 'architecture') then
    alter table public.locations add column architecture text not null default '';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'locations' and column_name = 'history') then
    alter table public.locations add column history text not null default '';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'locations' and column_name = 'characteristics') then
    alter table public.locations add column characteristics text[] not null default '{}';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'locations' and column_name = 'related_character_ids') then
    alter table public.locations add column related_character_ids uuid[] not null default '{}';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'locations' and column_name = 'related_episode_ids') then
    alter table public.locations add column related_episode_ids uuid[] not null default '{}';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'locations' and column_name = 'related_scene_ids') then
    alter table public.locations add column related_scene_ids uuid[] not null default '{}';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'locations' and column_name = 'gallery_asset_ids') then
    alter table public.locations add column gallery_asset_ids uuid[] not null default '{}';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'locations' and column_name = 'category') then
    alter table public.locations add column category text not null default '';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'locations' and column_name = 'tags') then
    alter table public.locations add column tags text[] not null default '{}';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. objects: tipo, características, materiales, propiedades especiales,
--    historia, dueño, relaciones por ids y galería
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'objects' and column_name = 'type') then
    alter table public.objects add column type text not null default 'otro' check (type in ('vehiculo', 'arma', 'cristal', 'tecnologia', 'artefacto', 'moneda', 'herramienta', 'otro'));
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'objects' and column_name = 'characteristics') then
    alter table public.objects add column characteristics text[] not null default '{}';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'objects' and column_name = 'materials') then
    alter table public.objects add column materials text[] not null default '{}';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'objects' and column_name = 'special_properties') then
    alter table public.objects add column special_properties text not null default '';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'objects' and column_name = 'history') then
    alter table public.objects add column history text not null default '';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'objects' and column_name = 'owner_character_id') then
    alter table public.objects add column owner_character_id uuid references public.characters (id) on delete set null;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'objects' and column_name = 'related_character_ids') then
    alter table public.objects add column related_character_ids uuid[] not null default '{}';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'objects' and column_name = 'related_scene_ids') then
    alter table public.objects add column related_scene_ids uuid[] not null default '{}';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'objects' and column_name = 'gallery_asset_ids') then
    alter table public.objects add column gallery_asset_ids uuid[] not null default '{}';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'objects' and column_name = 'category') then
    alter table public.objects add column category text not null default '';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'objects' and column_name = 'tags') then
    alter table public.objects add column tags text[] not null default '{}';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. voice_actors: alias, país, idiomas, tipo de voz, contacto
--    restringido y muestras de audio
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'voice_actors' and column_name = 'alias') then
    alter table public.voice_actors add column alias text not null default '';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'voice_actors' and column_name = 'country') then
    alter table public.voice_actors add column country text not null default '';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'voice_actors' and column_name = 'languages') then
    alter table public.voice_actors add column languages text[] not null default '{}';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'voice_actors' and column_name = 'voice_type') then
    alter table public.voice_actors add column voice_type text not null default '';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'voice_actors' and column_name = 'contact') then
    alter table public.voice_actors add column contact text not null default '';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'voice_actors' and column_name = 'contact_restricted') then
    alter table public.voice_actors add column contact_restricted boolean not null default false;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'voice_actors' and column_name = 'sample_audio_asset_ids') then
    alter table public.voice_actors add column sample_audio_asset_ids uuid[] not null default '{}';
  end if;
end $$;
comment on column public.voice_actors.contact is 'Dato restringido (teléfono, correo, redes): la app lo muestra enmascarado y nunca lo expone en listados ni exportaciones.';
-- Marcar como restringidos los contactos que ya existan (contact_email de la 0001).
update public.voice_actors set contact_restricted = true where contact <> '' or contact_email is not null;

-- ---------------------------------------------------------------------------
-- 4. voice_assignments: idioma + unicidad por (character_id, language)
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'voice_assignments' and column_name = 'language') then
    alter table public.voice_assignments add column language text not null default 'español';
  end if;
end $$;
-- La unique antigua (character_id, voice_actor_id) impedía el contrato
-- de la fase 5 (un actor por idioma y personaje); se sustituye por
-- (character_id, language). Si ya hay duplicados por idioma, la
-- creación de la unique fallará: habrá que resolverlos a mano.
alter table public.voice_assignments
  drop constraint if exists voice_assignments_character_id_voice_actor_id_key;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'voice_assignments_character_language_key') then
    alter table public.voice_assignments
      add constraint voice_assignments_character_language_key unique (character_id, language);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 5. recordings: idioma, audio en assets, notas y estados en español
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'recordings' and column_name = 'language') then
    alter table public.recordings add column language text not null default 'español';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'recordings' and column_name = 'audio_asset_id') then
    alter table public.recordings add column audio_asset_id uuid references public.assets (id) on delete set null;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'recordings' and column_name = 'notes') then
    alter table public.recordings add column notes text not null default '';
  end if;
end $$;
-- Estados en español: sustituir el check de la 0001. El check inline de
-- la 0001 genera la constraint `recordings_status_check`; si no existe
-- con ese nombre, el bloque DO la busca por su definición.
do $$
declare
  old_check text;
begin
  select conname into old_check
  from pg_constraint
  where conrelid = 'public.recordings'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%draft%approved%rejected%'
  limit 1;
  if old_check is not null then
    execute format('alter table public.recordings drop constraint %I', old_check);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'recordings_status_es_check') then
    alter table public.recordings
      add constraint recordings_status_es_check
      check (status in ('Pendiente', 'Grabado', 'En revisión', 'Aprobado', 'Requiere retoma'));
  end if;
end $$;
alter table public.recordings alter column status set default 'Pendiente';

-- ---------------------------------------------------------------------------
-- 6. Índices
-- ---------------------------------------------------------------------------
create index if not exists idx_locations_project_id on public.locations (project_id);
create index if not exists idx_locations_type on public.locations (type);
create index if not exists idx_locations_category on public.locations (category);
create index if not exists idx_locations_region on public.locations (region);
create index if not exists idx_objects_project_id on public.objects (project_id);
create index if not exists idx_objects_location_id on public.objects (location_id);
create index if not exists idx_objects_owner_character_id on public.objects (owner_character_id);
create index if not exists idx_objects_type on public.objects (type);
create index if not exists idx_voice_actors_project_id on public.voice_actors (project_id);
create index if not exists idx_voice_assignments_project_id on public.voice_assignments (project_id);
create index if not exists idx_voice_assignments_character_id on public.voice_assignments (character_id);
create index if not exists idx_voice_assignments_actor_id on public.voice_assignments (voice_actor_id);
create index if not exists idx_recordings_dialogue_line_id on public.recordings (dialogue_line_id);
create index if not exists idx_recordings_status on public.recordings (status);
create index if not exists idx_recordings_language on public.recordings (language);

-- ---------------------------------------------------------------------------
-- 7. RLS: las cinco tablas ya tienen RLS activado y políticas de
--    proyecto en la 0001 (bucle de "Tablas de proyecto"); no hace falta
--    crear políticas nuevas. Se reafirma aquí por si la 0001 no se
--    aplicó completa.
-- ---------------------------------------------------------------------------
alter table public.locations enable row level security;
alter table public.objects enable row level security;
alter table public.voice_actors enable row level security;
alter table public.voice_assignments enable row level security;
alter table public.recordings enable row level security;
