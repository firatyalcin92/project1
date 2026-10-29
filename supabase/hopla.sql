-- =====================================================================================
-- Hopla (oyun) — sıralama tablosu ve fonksiyonları
--
-- Supabase → SQL Editor → New query → bu dosyanın tamamını yapıştırıp Run.
-- * MESELE tablolarına dokunmaz; yalnızca hopla_ önekli yeni nesneler ekler.
-- * Tekrar çalıştırmak zararsızdır (mevcut veriler silinmez).
-- * İstemciler (anon/authenticated) tabloya erişemez; tüm okuma/yazma sunucuda,
--   service role ile yapılır (MESELE ile aynı güvenlik modeli).
-- =====================================================================================

create table if not exists public.hopla_players (
  id uuid primary key default gen_random_uuid(),
  -- Görünen isim (3–16 karakter; birleştirici işaretler için pay bırakıldı)
  name text not null check (char_length(name) between 1 and 48),
  -- Benzersizlik anahtarı: büyük/küçük harf, aksan, ayraç ve benzer harfler yok sayılır
  name_key text not null unique check (char_length(name_key) between 1 and 64),
  country text not null check (country ~ '^[A-Z]{2}$'),
  -- Cihazdaki gizli anahtarın SHA-256 özeti (anahtarın kendisi saklanmaz)
  token_hash text not null unique check (char_length(token_hash) = 64),
  best_score integer not null default 0 check (best_score >= 0),
  best_at timestamptz,
  best_jumps integer not null default 0 check (best_jumps >= 0),
  best_perfects integer not null default 0 check (best_perfects >= 0),
  last_run_iat bigint not null default 0,
  -- Kayıt olunan IP adresinin tuzlu özeti (toplu isim almayı sınırlamak için; IP saklanmaz)
  created_ip_hash text,
  rename_count integer not null default 0,
  rename_window timestamptz,
  banned boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists hopla_players_board_idx
  on public.hopla_players (best_score desc, best_at asc) where not banned and best_score > 0;
create index if not exists hopla_players_country_idx
  on public.hopla_players (country, best_score desc, best_at asc) where not banned and best_score > 0;
create index if not exists hopla_players_ip_idx on public.hopla_players (created_ip_hash, created_at);
create index if not exists hopla_players_stale_idx on public.hopla_players (created_at) where best_score = 0;

alter table public.hopla_players enable row level security;
revoke all on table public.hopla_players from anon, authenticated;
grant select, insert, update, delete on table public.hopla_players to service_role;

-- Sıra: daha yüksek skor, eşitlikte o skora daha önce ulaşan önde. p_country null ise dünya.
create or replace function public.hopla_rank(p_score integer, p_best_at timestamptz, p_country text default null)
returns bigint
language sql
stable
set search_path = public
as $$
  select count(*) + 1
  from public.hopla_players p
  where not p.banned
    and p.best_score > 0
    and (p_country is null or p.country = p_country)
    and (p.best_score > p_score or (p.best_score = p_score and p.best_at < p_best_at))
$$;

-- Ülkeler sıralaması: her ülkenin en iyi 10 oyuncusunun rekorları toplamı.
create or replace function public.hopla_country_ranking(p_limit integer default 50)
returns table (country text, score bigint, players bigint)
language sql
stable
set search_path = public
as $$
  with ranked as (
    select p.country as c,
           p.best_score as s,
           row_number() over (partition by p.country order by p.best_score desc, p.best_at asc) as rn,
           count(*) over (partition by p.country) as n
    from public.hopla_players p
    where not p.banned and p.best_score > 0
  )
  select r.c, (sum(r.s) filter (where r.rn <= 10))::bigint, max(r.n)::bigint
  from ranked r
  group by r.c
  order by 2 desc, 3 desc, 1
  limit greatest(1, least(coalesce(p_limit, 50), 250))
$$;

revoke all on function public.hopla_rank(integer, timestamptz, text) from public, anon, authenticated;
revoke all on function public.hopla_country_ranking(integer) from public, anon, authenticated;
grant execute on function public.hopla_rank(integer, timestamptz, text) to service_role;
grant execute on function public.hopla_country_ranking(integer) to service_role;

-- ---------------------------------------------------------------- 2. ek (supabase/hopla-2.sql ile aynı)

-- 50 puanı geçen oyunların sayısı (sıralamada isim yanında gösterilir)
alter table public.hopla_players add column if not exists plays integer not null default 0;
-- Expo bildirim anahtarı ve bildirim dili (tr/en); bildirim istemeyen oyuncuda boş
alter table public.hopla_players add column if not exists push_token text;
alter table public.hopla_players add column if not exists push_lang text;
-- "Rekorun geçildi" bildirimi: günde en fazla bir, oyuna girmeden en fazla iki
alter table public.hopla_players add column if not exists notify_day date;
alter table public.hopla_players add column if not exists notify_unseen integer not null default 0;

create index if not exists hopla_players_push_idx
  on public.hopla_players (country) where push_token is not null and not banned;

-- Doğrulanmış bir oyunu tek işlemde kaydeder: aynı bilet ikinci kez sayılmaz, rekor yalnızca
-- yükseldiyse yazılır, p_count ise oyun sayısı 1 artar. Dönüş: rekor yükseldi mi (bilet eskiyse null).
create or replace function public.hopla_record_run(
  p_id uuid,
  p_score integer,
  p_jumps integer,
  p_perfects integer,
  p_iat bigint,
  p_at timestamptz,
  p_count boolean
)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  old_best integer;
begin
  select best_score into old_best
  from public.hopla_players
  where id = p_id and last_run_iat < p_iat
  for update;
  if not found then
    return null;
  end if;
  update public.hopla_players set
    plays = plays + (case when p_count then 1 else 0 end),
    last_run_iat = p_iat,
    best_score = greatest(best_score, p_score),
    best_at = case when p_score > old_best then p_at else best_at end,
    best_jumps = case when p_score > old_best then p_jumps else best_jumps end,
    best_perfects = case when p_score > old_best then p_perfects else best_perfects end
  where id = p_id;
  return p_score > old_best;
end
$$;

revoke all on function public.hopla_record_run(uuid, integer, integer, integer, bigint, timestamptz, boolean)
  from public, anon, authenticated;
grant execute on function public.hopla_record_run(uuid, integer, integer, integer, bigint, timestamptz, boolean)
  to service_role;


-- PostgREST şema önbelleğini yenile (yeni tablo/fonksiyon hemen görünsün)
notify pgrst, 'reload schema';
