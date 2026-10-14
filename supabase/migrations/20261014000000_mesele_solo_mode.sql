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
