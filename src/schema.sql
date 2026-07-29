-- ============================================================================
-- ReplyFox — Supabase / PostgreSQL schema
-- Spec reference: SPEC.md §6 (Database Schema)
-- Run this in the Supabase SQL editor (or psql) to provision the database.
-- ============================================================================

-- Required for gen_random_uuid()
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- Businesses (the core entity)
-- ----------------------------------------------------------------------------
create table if not exists public.businesses (
  id                    uuid primary key default gen_random_uuid(),
  email                 text unique not null,
  business_name         text not null,
  business_key          text unique not null,        -- public key for widget embedding (UUID)
  plan                  text not null default 'free', -- free | pro | business
  stripe_customer_id    text,
  stripe_subscription_id text,
  messages_this_month   int  not null default 0,
  message_quota         int  not null default 50,    -- 50 free; null/very large for pro
  status                text not null default 'active', -- active | canceled | past_due
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Knowledge base (trained content per business)
-- ----------------------------------------------------------------------------
create table if not exists public.knowledge_base (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.businesses(id) on delete cascade,
  content       text not null,                  -- the full processed text
  source        text,                           -- url | text | file
  source_url    text,
  chunk_count   int  not null default 0,
  created_at    timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Widget configuration (one row per business)
-- ----------------------------------------------------------------------------
create table if not exists public.widget_config (
  business_id            uuid primary key references public.businesses(id) on delete cascade,
  color                  text not null default '#4F46E5',
  position               text not null default 'bottom-right', -- bottom-right | bottom-left
  greeting               text not null default 'Hi! How can I help you today?',
  avatar                 text not null default '🤖',
  business_hours         jsonb,                 -- { "mon": "9-17", "tue": "9-17", ... }
  outside_hours_message  text not null default 'We are currently closed. Leave your email and we will get back to you.'
);

-- ----------------------------------------------------------------------------
-- Conversations (visitor chat sessions)
-- ----------------------------------------------------------------------------
create table if not exists public.conversations (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.businesses(id) on delete cascade,
  session_id    text not null,                  -- visitor's session (from widget localStorage)
  visitor_email text,                           -- captured if bot asks for it
  started_at    timestamptz not null default now(),
  message_count int  not null default 0,
  escalated     boolean not null default false  -- true if bot couldn't answer → email captured
);

-- ----------------------------------------------------------------------------
-- Individual messages
-- ----------------------------------------------------------------------------
create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  business_id     uuid not null references public.businesses(id) on delete cascade,
  role            text not null,                -- visitor | bot
  content         text not null,
  satisfaction    text,                         -- up | down | null
  email_request   boolean not null default false,
  created_at      timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Usage tracking (for monthly reset + analytics)
-- ----------------------------------------------------------------------------
create table if not exists public.usage_log (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.businesses(id) on delete cascade,
  month_year    text not null,                  -- "2026-07" format
  message_count int  not null default 0,
  unique (business_id, month_year)
);

-- ----------------------------------------------------------------------------
-- Indexes (lookup performance)
-- ----------------------------------------------------------------------------
create index if not exists idx_businesses_business_key      on public.businesses (business_key);
create index if not exists idx_businesses_email             on public.businesses (email);
create index if not exists idx_businesses_stripe_customer   on public.businesses (stripe_customer_id);
create index if not exists idx_knowledge_base_business      on public.knowledge_base (business_id);
create index if not exists idx_widget_config_business       on public.widget_config (business_id);
create index if not exists idx_conversations_business       on public.conversations (business_id);
create index if not exists idx_conversations_session        on public.conversations (business_id, session_id);
create index if not exists idx_messages_conversation        on public.messages (conversation_id, created_at);
create index if not exists idx_messages_business_created    on public.messages (business_id, created_at);
create index if not exists idx_usage_business_month         on public.usage_log (business_id, month_year);

-- ----------------------------------------------------------------------------
-- Auto-maintain businesses.updated_at
-- ----------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_businesses_touch on public.businesses;
create trigger trg_businesses_touch
  before update on public.businesses
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- Convenience: get-or-create conversation for (business, session)
-- Returns the conversation id. Safe to call repeatedly.
-- ----------------------------------------------------------------------------
create or replace function public.get_or_create_conversation(
  p_business_id uuid,
  p_session_id  text
) returns uuid language plpgsql security definer as $$
declare
  v_id uuid;
begin
  select id into v_id
    from public.conversations
    where business_id = p_business_id and session_id = p_session_id
    limit 1;
  if v_id is null then
    insert into public.conversations (business_id, session_id)
      values (p_business_id, p_session_id)
      returning id into v_id;
  end if;
  return v_id;
end;
$$;

-- ============================================================================
-- Row Level Security (SPEC §6.2)
-- Businesses can only read/write their own data.
-- The /api/chat endpoint uses business_key (public, read-only access to
-- knowledge_base + widget_config). Analytics endpoints require a dashboard token
-- (enforced in the API layer, which uses the service-role key).
-- ============================================================================

alter table public.businesses    enable row level security;
alter table public.knowledge_base enable row level security;
alter table public.widget_config enable row level security;
alter table public.conversations enable row level security;
alter table public.messages      enable row level security;
alter table public.usage_log     enable row level security;

-- NOTE: The backend API connects with the SERVICE-ROLE key, which bypasses RLS
-- entirely and centralizes authorization in the application layer. If you prefer
-- anon-key access from the browser, add explicit policies here, e.g.:
--
-- create policy "public read widget config by key"
--   on public.widget_config for select using (true);
-- ============================================================================

-- End of schema.
