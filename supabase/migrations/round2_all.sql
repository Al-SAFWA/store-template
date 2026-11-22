-- Round 2 (oh9). Idempotent. User runs this on Laptop.
-- No DROP / TRUNCATE. RLS stays on. No secrets.
-- Products: run ../seed_products.sql separately.
-- Optional demo socials: run ../demo_accounts.sql (not defaults).

create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  is_visible boolean not null default true,
  updated_at timestamptz not null default now()
);

do $$
begin
  if exists (select 1 from pg_proc where proname = 'restore_set_updated_at') then
    drop trigger if exists site_settings_touch on public.site_settings;
    create trigger site_settings_touch before update on public.site_settings
      for each row execute function public.restore_set_updated_at();
  end if;
end $$;

alter table public.site_settings enable row level security;

drop policy if exists site_settings_public_read on public.site_settings;
create policy site_settings_public_read on public.site_settings
  for select to anon, authenticated
  using (is_visible = true);

drop policy if exists site_settings_staff_read on public.site_settings;
create policy site_settings_staff_read on public.site_settings
  for select to authenticated
  using (public.is_staff());

drop policy if exists site_settings_staff_write on public.site_settings;
create policy site_settings_staff_write on public.site_settings
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

grant select on public.site_settings to anon, authenticated;
grant select, insert, update, delete on public.site_settings to authenticated;

insert into public.site_settings (key, value, is_visible) values
  ('return_days', '10'::jsonb, true),
  ('no_risk', '{"ar":"بدون مخاطرة","fr":"Sans risque"}'::jsonb, true),
  ('no_risk_text', '{"ar":"{returnDays} أيام لإرجاع الجهاز عند وجود أي مشكلة","fr":"{returnDays} jours pour retourner l’appareil en cas de problème"}'::jsonb, true),
  ('refurbished_label', '{"ar":"مفحوص","fr":"contrôlé"}'::jsonb, false),
  ('offers_label', '{"ar":"عروض","fr":"Offres"}'::jsonb, true),
  ('trusted_by', '{"ar":"آلاف العملاء يثقون بنا","fr":"Des milliers de clients nous font confiance"}'::jsonb, false),
  ('announcement', '{"ar":"توصيل مجاني داخل نواكشوط • الدفع عند الاستلام أو عبر بنكيلي","fr":"Livraison gratuite à Nouakchott • Paiement à la livraison ou Bankily"}'::jsonb, true),
  ('categories_title', '{"ar":"تسوق الإلكترونيات","fr":"Électronique"}'::jsonb, true),
  ('service_title', '{"ar":"كل أجهزتنا أصلية ومفحوصة من طرف خبراء","fr":"Tous nos appareils sont originaux et vérifiés par des experts"}'::jsonb, true),
  ('warranty_label', '{"ar":"ضمان 12 شهرًا","fr":"Garantie 12 mois"}'::jsonb, true),
  ('free_delivery', '{"ar":"توصيل مجاني داخل نواكشوط","fr":"Livraison gratuite à Nouakchott"}'::jsonb, true),
  ('checked_experts', '{"ar":"فحص بواسطة خبراء","fr":"Vérifié par des experts"}'::jsonb, true)
on conflict (key) do nothing;

-- Replace leftover «مجدد» defaults only (do not overwrite a merchant’s custom copy).
update public.site_settings
set value = '{"ar":"تسوق الإلكترونيات","fr":"Électronique"}'::jsonb
where key = 'categories_title'
  and value::text like '%مجدد%';

update public.site_settings
set value = '{"ar":"مفحوص","fr":"contrôlé"}'::jsonb,
    is_visible = false
where key = 'refurbished_label'
  and value::text like '%مجدد%';

update public.site_settings
set is_visible = false
where key = 'trusted_by'
  and value::text like '%150000%';
