-- Anime Production Studio — migración 0003 (fases 3 y 4)
--
-- La 0001 ya creó episodes, scenes, shots, dialogue_lines, prompts y
-- assets. Esta migración añade lo que las fases 3 y 4 necesitan y la
-- 0001 no tenía: variantes de prompt, enlaces de archivos a varios
-- elementos, y columnas extra (guion del episodio, detalles de escena
-- y plano). Idempotente: IF NOT EXISTS / DO blocks con comprobación.
--
-- NOTA: el modo local (Dexie) es la fuente de verdad mientras Supabase
-- no esté configurado; esta migración solo se aplica cuando Stiven
-- conecte su proyecto de Supabase.

-- ---------------------------------------------------------------------------
-- 1. Variantes de prompt (registros independientes relacionados)
-- ---------------------------------------------------------------------------
create table if not exists public.prompt_variants (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  prompt_id uuid not null references public.prompts (id) on delete cascade,
  name text not null,
  content text not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
comment on table public.prompt_variants is 'Variantes de un prompt: registros independientes relacionados con su original.';

-- ---------------------------------------------------------------------------
-- 2. Enlaces de archivos (un asset enlazado a varios elementos)
-- ---------------------------------------------------------------------------
create table if not exists public.asset_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  asset_id uuid not null references public.assets (id) on delete cascade,
  target_type text not null check (target_type in ('personaje', 'episodio', 'escena', 'plano', 'lugar', 'objeto', 'prompt', 'lore')),
  target_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (asset_id, target_type, target_id)
);
comment on table public.asset_links is 'Un mismo archivo enlazado a varios elementos del proyecto.';

-- ---------------------------------------------------------------------------
-- 3. Columnas extra en episodes (guion y portada)
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'episodes' and column_name = 'season_number') then
    alter table public.episodes add column season_number integer;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'episodes' and column_name = 'language') then
    alter table public.episodes add column language text not null default 'español';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'episodes' and column_name = 'cover_asset_id') then
    alter table public.episodes add column cover_asset_id uuid references public.assets (id) on delete set null;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'episodes' and column_name = 'script_text') then
    alter table public.episodes add column script_text text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'episodes' and column_name = 'script_json') then
    alter table public.episodes add column script_json jsonb;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Columnas extra en scenes
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'scenes' and column_name = 'location_name') then
    alter table public.scenes add column location_name text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'scenes' and column_name = 'time_of_day') then
    alter table public.scenes add column time_of_day text;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Columnas extra en shots
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'shots' and column_name = 'action') then
    alter table public.shots add column action text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'shots' and column_name = 'framing') then
    alter table public.shots add column framing text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'shots' and column_name = 'ai_model') then
    alter table public.shots add column ai_model text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'shots' and column_name = 'prompt_id') then
    alter table public.shots add column prompt_id uuid references public.prompts (id) on delete set null;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'shots' and column_name = 'generated_video_asset_id') then
    alter table public.shots add column generated_video_asset_id uuid references public.assets (id) on delete set null;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 6. Columnas extra en dialogue_lines y prompts
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'dialogue_lines' and column_name = 'performance_notes') then
    alter table public.dialogue_lines add column performance_notes text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'dialogue_lines' and column_name = 'emotion') then
    alter table public.dialogue_lines add column emotion text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'dialogue_lines' and column_name = 'language') then
    alter table public.dialogue_lines add column language text not null default 'español';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'dialogue_lines' and column_name = 'voice_actor_name') then
    alter table public.dialogue_lines add column voice_actor_name text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'dialogue_lines' and column_name = 'audio_asset_id') then
    alter table public.dialogue_lines add column audio_asset_id uuid references public.assets (id) on delete set null;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'prompts' and column_name = 'generation_type') then
    alter table public.prompts add column generation_type text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'prompts' and column_name = 'platform') then
    alter table public.prompts add column platform text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'prompts' and column_name = 'language') then
    alter table public.prompts add column language text not null default 'español';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'prompts' and column_name = 'description') then
    alter table public.prompts add column description text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'prompts' and column_name = 'negative_prompt') then
    alter table public.prompts add column negative_prompt text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'prompts' and column_name = 'technical_params') then
    alter table public.prompts add column technical_params text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'prompts' and column_name = 'duration_seconds') then
    alter table public.prompts add column duration_seconds numeric;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'prompts' and column_name = 'aspect_ratio') then
    alter table public.prompts add column aspect_ratio text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'prompts' and column_name = 'resolution') then
    alter table public.prompts add column resolution text;
  end if;
end $$;

-- RLS base para las tablas nuevas (mismo patrón que la 0001: solo el
-- propietario/miembro del proyecto; sin políticas no hay acceso).
alter table public.prompt_variants enable row level security;
alter table public.asset_links enable row level security;
