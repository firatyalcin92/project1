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
