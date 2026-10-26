-- MESELE — Supabase tek seferlik kurulum (SQL Editor'e olduğu gibi yapıştırıp Run'a basın).
-- supabase/migrations klasöründeki dosyaların sırayla birleşimidir. Yalnızca BİR KEZ çalıştırın.

-- ===== supabase/migrations/20261013000000_mesele_init.sql =====
-- MESELE — ilk şema
--
-- Kırılmaz kurallar:
--  * Tüm tablolarda RLS açık ve anon/authenticated rollerine HİÇBİR politika
--    ya da tablo yetkisi verilmez. Tüm okuma/yazma sunucu fonksiyonlarında
--    service_role anahtarıyla yapılır.
--  * Ham üye token'ı asla saklanmaz; yalnızca SHA-256 hash'i (auth_token_hash).
--  * Çift kodu yalnızca eşleştirme tanıtıcısıdır, kimlik doğrulamada kullanılmaz.
--  * Tamamlanan meseleler otomatik silinmez.


-- ---------------------------------------------------------------------------
-- Tablolar
-- ---------------------------------------------------------------------------

create table public.couples (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  name        text not null check (char_length(name) between 1 and 60),
  created_at  timestamptz not null default now()
);

create table public.couple_members (
  id               uuid primary key default gen_random_uuid(),
  couple_id        uuid not null references public.couples(id) on delete cascade,
  role             text not null check (role in ('A', 'B')),
  display_name     text not null check (char_length(display_name) between 1 and 40),
  auth_token_hash  text not null unique check (auth_token_hash ~ '^[0-9a-f]{64}$'),
  joined_at        timestamptz not null default now(),
  unique (couple_id, role)
);
create index couple_members_couple_idx on public.couple_members (couple_id);

create table public.disputes (
  id                 uuid primary key default gen_random_uuid(),
  couple_id          uuid not null references public.couples(id) on delete cascade,
  created_by         uuid references public.couple_members(id) on delete set null,
  title              text not null check (char_length(title) between 1 and 80),
  status             text not null default 'draft' check (status in (
                       'draft',
                       'answers_in_progress',
                       'both_answers_completed',
                       'generating_perspectives',
                       'perspectives_ready',
                       'reconsideration_in_progress',
                       'reconsideration_completed',
                       'generating_reports',
                       'completed')),
  shared_report      jsonb,
  shared_approved_a  boolean not null default false,
  shared_approved_b  boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  completed_at       timestamptz,
  status_locked_at   timestamptz
);
create index disputes_couple_created_idx on public.disputes (couple_id, created_at desc);

-- Her partnerin "Olay ne idi?" anlatımı + o anlatımdan üretilen,
-- partnerine gösterilecek "…'nın Gözünden" metni.
create table public.dispute_entries (
  id                uuid primary key default gen_random_uuid(),
  dispute_id        uuid not null references public.disputes(id) on delete cascade,
  member_id         uuid not null references public.couple_members(id) on delete cascade,
  what_happened     text not null default '' check (char_length(what_happened) <= 4000),
  event_visibility  text not null default 'partner' check (event_visibility in ('private', 'partner')),
  perspective       jsonb,
  submitted_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (dispute_id, member_id)
);

create table public.answers (
  id             uuid primary key default gen_random_uuid(),
  dispute_id     uuid not null references public.disputes(id) on delete cascade,
  member_id      uuid not null references public.couple_members(id) on delete cascade,
  question_id    text not null check (question_id ~ '^[a-z_]{2,32}$'),
  text_answer    text not null default '' check (char_length(text_answer) <= 4000),
  selected_tags  text[] not null default '{}',
  visibility     text not null default 'partner' check (visibility in ('private', 'partner')),
  updated_at     timestamptz not null default now(),
  unique (dispute_id, member_id, question_id)
);

create table public.reconsiderations (
  id            uuid primary key default gen_random_uuid(),
  dispute_id    uuid not null references public.disputes(id) on delete cascade,
  member_id     uuid not null references public.couple_members(id) on delete cascade,
  reflections   jsonb not null default '{}'::jsonb,
  submitted_at  timestamptz,
  updated_at    timestamptz not null default now(),
  unique (dispute_id, member_id)
);

create table public.reports (
  id          uuid primary key default gen_random_uuid(),
  dispute_id  uuid not null references public.disputes(id) on delete cascade,
  member_id   uuid not null references public.couple_members(id) on delete cascade,
  my_report   jsonb not null,
  created_at  timestamptz not null default now(),
  unique (dispute_id, member_id)
);

-- 10 tamamlanmış meseleden sonra açılan kalıcı ilişki dinamiği raporu.
-- dispute_count: raporun kaç tamamlanmış meseleye dayanarak üretildiği.
create table public.relationship_reports (
  id                uuid primary key default gen_random_uuid(),
  couple_id         uuid not null references public.couples(id) on delete cascade,
  overall_analysis  jsonb,
  dispute_count     integer not null check (dispute_count >= 0),
  status            text not null default 'generating' check (status in ('generating', 'ready', 'failed')),
  status_locked_at  timestamptz,
  unlocked_at       timestamptz,
  created_at        timestamptz not null default now(),
  unique (couple_id, dispute_count)
);
create index relationship_reports_couple_idx on public.relationship_reports (couple_id, dispute_count desc);

-- ---------------------------------------------------------------------------
-- RLS: açık, politika yok. İstemci rolleri hiçbir satırı göremez.
-- ---------------------------------------------------------------------------

alter table public.couples              enable row level security;
alter table public.couple_members       enable row level security;
alter table public.disputes             enable row level security;
alter table public.dispute_entries      enable row level security;
alter table public.answers              enable row level security;
alter table public.reconsiderations     enable row level security;
alter table public.reports              enable row level security;
alter table public.relationship_reports enable row level security;

revoke all on table
  public.couples, public.couple_members, public.disputes, public.dispute_entries,
  public.answers, public.reconsiderations, public.reports, public.relationship_reports
from anon, authenticated;

grant all on table
  public.couples, public.couple_members, public.disputes, public.dispute_entries,
  public.answers, public.reconsiderations, public.reports, public.relationship_reports
to service_role;

-- ---------------------------------------------------------------------------
-- Atomik durum geçişleri (çift AI çağrısını önleme)
-- ---------------------------------------------------------------------------

-- p_from -> p_to geçişini atomik olarak talep eder. Başarılıysa kilit zaman
-- damgasını döner; başka bir istek zaten üretim yapıyorsa NULL döner.
-- p_to durumunda 4 dakikadan uzun süredir takılı kalmış bir kilit bayat
-- sayılır ve yeniden talep edilebilir.
create or replace function public.mesele_claim_status(
  p_dispute_id uuid,
  p_from text,
  p_to text,
  p_stale_after interval default interval '4 minutes'
) returns timestamptz
language sql
set search_path = public
as $$
  update public.disputes
     set status = p_to,
         status_locked_at = clock_timestamp(),
         updated_at = now()
   where id = p_dispute_id
     and (
       status = p_from
       or (status = p_to and (status_locked_at is null or status_locked_at < clock_timestamp() - p_stale_after))
     )
  returning status_locked_at;
$$;

-- Üretim başarısız olursa kilidi bırakır ve durumu geri alır.
-- Yalnızca kilidi hâlâ elinde tutan istek bunu yapabilir.
create or replace function public.mesele_release_status(
  p_dispute_id uuid,
  p_lock timestamptz,
  p_back_to text
) returns boolean
language sql
set search_path = public
as $$
  with released as (
    update public.disputes
       set status = p_back_to, status_locked_at = null, updated_at = now()
     where id = p_dispute_id and status_locked_at = p_lock
    returning id
  )
  select exists (select 1 from released);
$$;

-- "…'nın Gözünden" metinlerini ve perspectives_ready durumunu tek seferde yazar.
-- p_perspectives: { "<member_id>": { ...perspective json... }, ... }
create or replace function public.mesele_finish_perspectives(
  p_dispute_id uuid,
  p_lock timestamptz,
  p_perspectives jsonb
) returns boolean
language plpgsql
set search_path = public
as $$
begin
  perform 1 from public.disputes
   where id = p_dispute_id
     and status = 'generating_perspectives'
     and status_locked_at = p_lock
   for update;
  if not found then
    return false;
  end if;

  update public.dispute_entries e
     set perspective = p_perspectives -> e.member_id::text,
         updated_at = now()
   where e.dispute_id = p_dispute_id
     and p_perspectives ? e.member_id::text;

  update public.disputes
     set status = 'perspectives_ready', status_locked_at = null, updated_at = now()
   where id = p_dispute_id;
  return true;
end;
$$;

-- Ortak raporu, iki kişisel raporu ve completed durumunu tek seferde yazar.
-- p_reports: { "<member_id>": { ...my_report json... }, ... }
create or replace function public.mesele_finish_reports(
  p_dispute_id uuid,
  p_lock timestamptz,
  p_shared jsonb,
  p_reports jsonb
) returns boolean
language plpgsql
set search_path = public
as $$
declare
  v_member text;
begin
  perform 1 from public.disputes
   where id = p_dispute_id
     and status = 'generating_reports'
     and status_locked_at = p_lock
   for update;
  if not found then
    return false;
  end if;

  for v_member in select jsonb_object_keys(p_reports) loop
    insert into public.reports (dispute_id, member_id, my_report)
    values (p_dispute_id, v_member::uuid, p_reports -> v_member)
    on conflict (dispute_id, member_id)
    do update set my_report = excluded.my_report, created_at = now();
  end loop;

  update public.disputes
     set shared_report = p_shared,
         shared_approved_a = false,
         shared_approved_b = false,
         status = 'completed',
         completed_at = coalesce(completed_at, now()),
         status_locked_at = null,
         updated_at = now()
   where id = p_dispute_id;
  return true;
end;
$$;

-- Partnerlerin gönderimlerine bakarak durumu ileri taşır. Satır kilidi
-- sayesinde iki partner aynı anda "gönder"e bastığında da doğru sonuç çıkar.
create or replace function public.mesele_sync_progress(p_dispute_id uuid)
returns text
language plpgsql
set search_path = public
as $$
declare
  v_status text;
  v_next text;
  v_submitted integer;
  v_started integer;
begin
  select status into v_status from public.disputes where id = p_dispute_id for update;
  if v_status is null then
    return null;
  end if;
  v_next := v_status;

  if v_status in ('draft', 'answers_in_progress') then
    select count(*) filter (where submitted_at is not null), count(*)
      into v_submitted, v_started
      from public.dispute_entries where dispute_id = p_dispute_id;
    if v_submitted >= 2 then
      v_next := 'both_answers_completed';
    elsif v_started > 0 or exists (select 1 from public.answers where dispute_id = p_dispute_id) then
      v_next := 'answers_in_progress';
    end if;
  elsif v_status in ('perspectives_ready', 'reconsideration_in_progress') then
    select count(*) filter (where submitted_at is not null), count(*)
      into v_submitted, v_started
      from public.reconsiderations where dispute_id = p_dispute_id;
    if v_submitted >= 2 then
      v_next := 'reconsideration_completed';
    elsif v_started > 0 then
      v_next := 'reconsideration_in_progress';
    end if;
  end if;

  if v_next is distinct from v_status then
    update public.disputes set status = v_next, updated_at = now() where id = p_dispute_id;
  end if;
  return v_next;
end;
$$;

-- Genel Görüş raporunu üretme hakkını atomik olarak talep eder.
create or replace function public.mesele_claim_relationship_report(
  p_couple_id uuid,
  p_dispute_count integer,
  p_stale_after interval default interval '4 minutes'
) returns table (id uuid, status_locked_at timestamptz)
language sql
set search_path = public
as $$
  insert into public.relationship_reports as r (couple_id, dispute_count, status, status_locked_at)
  values (p_couple_id, p_dispute_count, 'generating', clock_timestamp())
  on conflict (couple_id, dispute_count) do update
     set status = 'generating', status_locked_at = clock_timestamp()
   where r.status = 'failed'
      or (r.status = 'generating' and (r.status_locked_at is null or r.status_locked_at < clock_timestamp() - p_stale_after))
  returning r.id, r.status_locked_at;
$$;

create or replace function public.mesele_finish_relationship_report(
  p_report_id uuid,
  p_lock timestamptz,
  p_analysis jsonb
) returns boolean
language sql
set search_path = public
as $$
  with done as (
    update public.relationship_reports
       set overall_analysis = p_analysis,
           status = 'ready',
           status_locked_at = null,
           unlocked_at = coalesce(unlocked_at, now())
     where id = p_report_id and status = 'generating' and status_locked_at = p_lock
    returning id
  )
  select exists (select 1 from done);
$$;

create or replace function public.mesele_fail_relationship_report(
  p_report_id uuid,
  p_lock timestamptz
) returns boolean
language sql
set search_path = public
as $$
  with failed as (
    update public.relationship_reports
       set status = 'failed', status_locked_at = null
     where id = p_report_id and status = 'generating' and status_locked_at = p_lock
    returning id
  )
  select exists (select 1 from failed);
$$;

-- Fonksiyonlar yalnızca sunucu (service_role) tarafından çağrılabilir.
revoke execute on function
  public.mesele_claim_status(uuid, text, text, interval),
  public.mesele_release_status(uuid, timestamptz, text),
  public.mesele_finish_perspectives(uuid, timestamptz, jsonb),
  public.mesele_finish_reports(uuid, timestamptz, jsonb, jsonb),
  public.mesele_sync_progress(uuid),
  public.mesele_claim_relationship_report(uuid, integer, interval),
  public.mesele_finish_relationship_report(uuid, timestamptz, jsonb),
  public.mesele_fail_relationship_report(uuid, timestamptz)
from public, anon, authenticated;

grant execute on function
  public.mesele_claim_status(uuid, text, text, interval),
  public.mesele_release_status(uuid, timestamptz, text),
  public.mesele_finish_perspectives(uuid, timestamptz, jsonb),
  public.mesele_finish_reports(uuid, timestamptz, jsonb, jsonb),
  public.mesele_sync_progress(uuid),
  public.mesele_claim_relationship_report(uuid, integer, interval),
  public.mesele_finish_relationship_report(uuid, timestamptz, jsonb),
  public.mesele_fail_relationship_report(uuid, timestamptz)
to service_role;

-- ===== supabase/migrations/20261014000000_mesele_solo_mode.sql =====
-- MESELE v2 — bireysel kullanım
--
-- mode = 'solo': Kişi, partneri uygulamayı kullanmadan, yaşadığı tartışma için
-- tek başına danışman görüşü alır. partner_name yalnızca kişiselleştirme içindir.
-- Solo meselede "Partnerinin Gözünden" ve "Yeniden Değerlendir" adımları yoktur:
-- anlatım gönderilince doğrudan rapor aşamasına (reconsideration_completed) geçilir.

alter table public.couples
  add column mode text not null default 'couple' check (mode in ('couple', 'solo')),
  add column partner_name text check (partner_name is null or char_length(partner_name) between 1 and 40);

create or replace function public.mesele_sync_progress(p_dispute_id uuid)
returns text
language plpgsql
set search_path = public
as $$
declare
  v_status text;
  v_mode text;
  v_next text;
  v_submitted integer;
  v_started integer;
begin
  select d.status, c.mode into v_status, v_mode
    from public.disputes d
    join public.couples c on c.id = d.couple_id
   where d.id = p_dispute_id
   for update of d;
  if v_status is null then
    return null;
  end if;
  v_next := v_status;

  if v_status in ('draft', 'answers_in_progress') then
    select count(*) filter (where submitted_at is not null), count(*)
      into v_submitted, v_started
      from public.dispute_entries where dispute_id = p_dispute_id;
    if v_mode = 'solo' and v_submitted >= 1 then
      v_next := 'reconsideration_completed';
    elsif v_submitted >= 2 then
      v_next := 'both_answers_completed';
    elsif v_started > 0 or exists (select 1 from public.answers where dispute_id = p_dispute_id) then
      v_next := 'answers_in_progress';
    end if;
  elsif v_status in ('perspectives_ready', 'reconsideration_in_progress') then
    select count(*) filter (where submitted_at is not null), count(*)
      into v_submitted, v_started
      from public.reconsiderations where dispute_id = p_dispute_id;
    if v_submitted >= 2 then
      v_next := 'reconsideration_completed';
    elsif v_started > 0 then
      v_next := 'reconsideration_in_progress';
    end if;
  end if;

  if v_next is distinct from v_status then
    update public.disputes set status = v_next, updated_at = now() where id = p_dispute_id;
  end if;
  return v_next;
end;
$$;

revoke execute on function public.mesele_sync_progress(uuid) from public, anon, authenticated;
grant execute on function public.mesele_sync_progress(uuid) to service_role;

-- ===== supabase/migrations/20261016000000_mesele_membership.sql =====
-- MESELE — üyelik, cihaz kurtarma ve silme talepleri
--
-- Bu dosya tekrar tekrar çalıştırılabilir (if not exists); mevcut verilere dokunmaz.
--  * subscriptions: çift düzeyinde üyelik. Çiftlerden birinin satın alması yeterlidir.
--    Çift silinse bile satır kalır (couple_id NULL olur); kalan süre bir aktarım
--    koduyla yeni bir çifte ya da bireysel hesaba taşınabilir.
--  * member_recovery: partnerin ürettiği tek kullanımlık "yeniden bağlanma" kodu
--    (yalnızca SHA-256 hash'i saklanır). Kötüye kullanıma karşı kod ancak bir bekleme
--    süresinden sonra (usable_after) çalışır; bu sürede hesap sahibi eski cihazından iptal edebilir.
--  * deletion_requests: "tüm verileri sil" talebi; çift modunda partnerin onayıyla uygulanır.
-- Kırılmaz kurallar burada da geçerlidir: RLS açık, politika yok, istemci rollerine yetki yok.

create table if not exists public.subscriptions (
  id                  uuid primary key default gen_random_uuid(),
  couple_id           uuid references public.couples(id) on delete set null,
  member_id           uuid references public.couple_members(id) on delete set null,
  period              text not null check (period in ('weekly', 'monthly', 'yearly')),
  provider            text not null check (char_length(provider) between 1 and 32),
  provider_ref        text check (provider_ref is null or char_length(provider_ref) <= 200),
  started_at          timestamptz not null default now(),
  expires_at          timestamptz not null,
  transfer_code_hash  text unique check (transfer_code_hash is null or transfer_code_hash ~ '^[0-9a-f]{64}$'),
  created_at          timestamptz not null default now()
);
create index if not exists subscriptions_couple_idx on public.subscriptions (couple_id, expires_at desc);

create table if not exists public.member_recovery (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references public.couple_members(id) on delete cascade,
  created_by  uuid not null references public.couple_members(id) on delete cascade,
  code_hash     text not null unique check (code_hash ~ '^[0-9a-f]{64}$'),
  usable_after  timestamptz not null,
  expires_at    timestamptz not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists member_recovery_member_idx on public.member_recovery (member_id);

create table if not exists public.deletion_requests (
  id            uuid primary key default gen_random_uuid(),
  couple_id     uuid not null unique references public.couples(id) on delete cascade,
  requested_by  uuid not null references public.couple_members(id) on delete cascade,
  created_at    timestamptz not null default now()
);

alter table public.subscriptions     enable row level security;
alter table public.member_recovery   enable row level security;
alter table public.deletion_requests enable row level security;

revoke all on table public.subscriptions, public.member_recovery, public.deletion_requests from anon, authenticated;
grant all on table public.subscriptions, public.member_recovery, public.deletion_requests to service_role;

-- ===== supabase/migrations/20261020000000_mesele_accounts.sql =====
-- MESELE — hesaplar (Apple / Google / e-posta kodu)
--
-- Bu dosya tekrar tekrar çalıştırılabilir; mevcut verilere dokunmaz.
--  * couple_members.auth_user_id: kaydedilmiş hesap (Supabase Auth kullanıcısı). Kullanıcı
--    uygulamaya hesapsız başlar; hesabını kaydedince bu sütun dolar ve başka bir cihazdan
--    aynı yöntemle (Apple / Google / e-posta) giriş yapabilir.
--  * subscriptions.owner_user_id: satın alanın hesabı. Veriler silinse bile üyelik bu hesapta
--    kalır ve aynı hesapla yeni bir çifte geçildiğinde kendiliğinden bağlanır.
--  * Kaldırılanlar: cihaz anahtarı yedeği yerine hesap geldiği için partnerle kurtarma
--    kodları (member_recovery) ve üyelik aktarım kodları (transfer_code_hash).
-- Kırılmaz kurallar burada da geçerlidir: RLS açık, politika yok, istemci rollerine yetki yok.

alter table public.couple_members add column if not exists auth_user_id uuid unique;
alter table public.couple_members add column if not exists email text
  check (email is null or char_length(email) <= 320);

alter table public.subscriptions add column if not exists owner_user_id uuid;
alter table public.subscriptions drop column if exists transfer_code_hash;
create index if not exists subscriptions_owner_idx on public.subscriptions (owner_user_id) where couple_id is null;

drop table if exists public.member_recovery;

-- ===== supabase/migrations/20261027000000_mesele_test_access.sql =====
-- MESELE — test sürümü: kullanım kayıtları, erişim kodları ve ücretli sürüm bekleme listesi
--
-- Bu dosya tekrar tekrar çalıştırılabilir (if not exists); mevcut verilere dokunmaz.
--  * beta_claims: ücretsiz test hakkının kullanıldığını gösteren kayıtlar. Çiftten bağımsızdır;
--    kişi çıkış yapsa ya da verilerini silse bile kayıt kalır. Cihaz kimliği ve IP adresi
--    yalnızca SHA-256 hash'iyle saklanır. kind = 'free' (ücretsiz mesele), 'code' (erişim
--    koduyla açılan mesele), 'device', 'ip'.
--  * access_codes: yöneticinin /yonetim'den ürettiği kodlar. Ham kod saklanmaz, yalnızca hash'i.
--    Kod ilk kullanan çifte bağlanır; uses_left kadar mesele açtırır.
--  * waitlist: "ücretli sürüme üye olmak isterim" diyenlerin e-postaları.
-- Kırılmaz kurallar burada da geçerlidir: RLS açık, politika yok, istemci rollerine yetki yok.

create table if not exists public.beta_claims (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('free', 'code', 'device', 'ip')),
  key_hash    text check (key_hash is null or key_hash ~ '^[0-9a-f]{64}$'),
  couple_id   uuid,
  created_at  timestamptz not null default now()
);
create index if not exists beta_claims_lookup_idx on public.beta_claims (kind, key_hash, created_at);
create index if not exists beta_claims_day_idx on public.beta_claims (kind, created_at);

create table if not exists public.access_codes (
  id           uuid primary key default gen_random_uuid(),
  code_hash    text not null unique check (code_hash ~ '^[0-9a-f]{64}$'),
  label        text not null default '' check (char_length(label) <= 80),
  uses_total   int not null check (uses_total between 1 and 100),
  uses_left    int not null check (uses_left >= 0),
  couple_id    uuid references public.couples(id) on delete set null,
  redeemed_at  timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists access_codes_couple_idx on public.access_codes (couple_id) where couple_id is not null;

create table if not exists public.waitlist (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique check (char_length(email) between 3 and 320),
  created_at  timestamptz not null default now()
);

alter table public.beta_claims  enable row level security;
alter table public.access_codes enable row level security;
alter table public.waitlist     enable row level security;
revoke all on table public.beta_claims, public.access_codes, public.waitlist from anon, authenticated;

-- Çiftin kodundan bir hak düşer; kalan hak sayısını, hak yoksa NULL döner. Eşzamanlı isteklerde
-- aynı hak iki kez kullanılamaz.
create or replace function public.mesele_consume_code(p_couple_id uuid)
returns int
language sql
set search_path = public
as $$
  update public.access_codes
     set uses_left = uses_left - 1
   where id = (
     select id from public.access_codes
      where couple_id = p_couple_id and uses_left > 0
      order by created_at
      limit 1
      for update
   )
     and uses_left > 0
  returning uses_left;
$$;

revoke execute on function public.mesele_consume_code(uuid) from public, anon, authenticated;
