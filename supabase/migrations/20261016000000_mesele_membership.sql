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
