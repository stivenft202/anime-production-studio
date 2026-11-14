-- ============================================================================
-- Anime Production Studio — Migración 0002: Universo y lore ampliado (Fase 2)
-- Archivo: supabase/migrations/0002_lore_extended.sql
-- Ejecutar tal cual en el Editor SQL de Supabase, DESPUÉS de la 0001.
--
-- Las tablas `lore_entries` y `timeline_events` de la 0001 eran demasiado
-- simples (solo title/content/category). Esta migración añade las columnas
-- que faltan para igualar el contrato local (Dexie, versión 2) de la fase 2.
-- Es idempotente: `alter table ... add column if not exists`.
--
-- Correspondencias con el contrato local:
--   - `lore_entries.category` (0001) equivale al `type` local
--     (historia-mundo, reglas, faccion, ...). No se crea una columna `type`.
--   - `lore_entries.content` (0001) queda como texto libre heredado; el
--     contenido estructurado vive en description/history/features/rules.
--   - `timeline_events.event_date` (0001, tipo date) se mantiene; la fecha
--     ficticia libre del contrato local es `fictional_date` (text).
--   - `timeline_events.episode_id` (0001) se mantiene; los números de
--     episodio del guion (1-9) van en `episode_numbers` (int[]).
-- Las políticas RLS de la 0001 no cambian: siguen cubriendo estas tablas.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- lore_entries — campos del contrato local que faltaban
-- ---------------------------------------------------------------------------
alter table public.lore_entries add column if not exists description text;
comment on column public.lore_entries.description is 'Resumen corto: qué es y por qué importa en el mundo.';

alter table public.lore_entries add column if not exists history text;
comment on column public.lore_entries.history is 'Origen, evolución y momentos clave de la entrada.';

alter table public.lore_entries add column if not exists features text;
comment on column public.lore_entries.features is 'Características: rasgos distintivos, apariencia, comportamiento.';

alter table public.lore_entries add column if not exists rules text;
comment on column public.lore_entries.rules is 'Reglas: límites, costes y prohibiciones del elemento del lore.';

alter table public.lore_entries add column if not exists tags text[] not null default '{}';
comment on column public.lore_entries.tags is 'Etiquetas libres de la entrada.';

alter table public.lore_entries add column if not exists spoiler boolean not null default false;
comment on column public.lore_entries.spoiler is 'True si la entrada contiene spoilers de la historia.';

alter table public.lore_entries add column if not exists character_ids uuid[] not null default '{}';
comment on column public.lore_entries.character_ids is 'Personajes relacionados (ids de public.characters).';

alter table public.lore_entries add column if not exists location_names text[] not null default '{}';
comment on column public.lore_entries.location_names is 'Nombres de lugares relacionados (texto libre; los lugares detallados llegan en la fase 5).';

alter table public.lore_entries add column if not exists episode_numbers integer[] not null default '{}';
comment on column public.lore_entries.episode_numbers is 'Números de episodio del guion relacionados (1-9; el módulo de episodios llega en la fase 3).';

alter table public.lore_entries add column if not exists image_asset_ids uuid[] not null default '{}';
comment on column public.lore_entries.image_asset_ids is 'Imágenes asociadas (ids de public.assets).';

-- ---------------------------------------------------------------------------
-- timeline_events — campos del contrato local que faltaban
-- ---------------------------------------------------------------------------
alter table public.timeline_events add column if not exists fictional_date text;
comment on column public.timeline_events.fictional_date is 'Fecha ficticia del acontecimiento dentro del mundo (texto libre, p. ej. «Año 214 del Calendario Nuevo»).';

alter table public.timeline_events add column if not exists era text;
comment on column public.timeline_events.era is 'Era a la que pertenece el acontecimiento (agrupa la cronología).';

alter table public.timeline_events add column if not exists consequences text;
comment on column public.timeline_events.consequences is 'Qué cambió en el mundo a partir de este suceso.';

alter table public.timeline_events add column if not exists spoiler boolean not null default false;
comment on column public.timeline_events.spoiler is 'True si el acontecimiento contiene spoilers de la historia.';

alter table public.timeline_events add column if not exists character_ids uuid[] not null default '{}';
comment on column public.timeline_events.character_ids is 'Personajes relacionados (ids de public.characters).';

alter table public.timeline_events add column if not exists location_names text[] not null default '{}';
comment on column public.timeline_events.location_names is 'Nombres de lugares relacionados (texto libre; los lugares detallados llegan en la fase 5).';

alter table public.timeline_events add column if not exists image_asset_ids uuid[] not null default '{}';
comment on column public.timeline_events.image_asset_ids is 'Imágenes asociadas (ids de public.assets).';

-- Índices para los filtros habituales del módulo de lore.
create index if not exists idx_lore_entries_spoiler on public.lore_entries (spoiler);
create index if not exists idx_timeline_events_spoiler on public.timeline_events (spoiler);
create index if not exists idx_timeline_events_era on public.timeline_events (project_id, era);
