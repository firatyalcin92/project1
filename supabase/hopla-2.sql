-- =====================================================================================
-- Hopdog (Hopla) — 2. ek: oyun sayısı ve bildirimler
--
-- Supabase → SQL Editor → New query → bu dosyanın tamamını yapıştırıp Run.
-- * Yalnızca hopla_players tablosuna yeni sütunlar ve bir fonksiyon ekler; mevcut veriler
--   silinmez, MESELE tablolarına dokunulmaz. Tekrar çalıştırmak zararsızdır.
-- * Bu dosya çalıştırılana kadar oyun ve sıralama eskisi gibi çalışır; yalnızca oyun sayısı
--   ve bildirimler kapalı kalır.
-- =====================================================================================

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

notify pgrst, 'reload schema';
