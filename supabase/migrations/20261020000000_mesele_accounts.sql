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
