-- Restore migration 0009: site_settings (key / value / is_visible).
-- Idempotent. Does not DROP or TRUNCATE. Does not disable RLS.
-- Public (anon) may read visible rows only. Staff (is_staff) may read all and write.
-- Default rows are inserted only when the key is missing.

create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  is_visible boolean not null default true,
  updated_at timestamptz not null default now()
);

drop trigger if exists site_settings_touch on public.site_settings;
create trigger site_settings_touch before update on public.site_settings
  for each row execute function public.restore_set_updated_at();

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
  ('refurbished_label', '{"ar":"مجدد","fr":"reconditionné"}'::jsonb, true),
  ('offers_label', '{"ar":"عروض","fr":"Offres"}'::jsonb, true),
  ('trusted_by', '{"ar":"آلاف العملاء يثقون بنا","fr":"Des milliers de clients nous font confiance"}'::jsonb, false),
  ('announcement', '{"ar":"توصيل مجاني داخل نواكشوط • الدفع عند الاستلام أو عبر بنكيلي","fr":"Livraison gratuite à Nouakchott • Paiement à la livraison ou Bankily"}'::jsonb, true),
  ('categories_title', '{"ar":"تسوق الإلكترونيات المجددة","fr":"Électronique reconditionnée"}'::jsonb, true),
  ('service_title', '{"ar":"كل أجهزتنا أصلية ومفحوصة من طرف خبراء","fr":"Tous nos appareils sont originaux et vérifiés par des experts"}'::jsonb, true),
  ('warranty_label', '{"ar":"ضمان 12 شهرًا","fr":"Garantie 12 mois"}'::jsonb, true),
  ('free_delivery', '{"ar":"توصيل مجاني داخل نواكشوط","fr":"Livraison gratuite à Nouakchott"}'::jsonb, true),
  ('checked_experts', '{"ar":"فحص بواسطة خبراء","fr":"Vérifié par des experts"}'::jsonb, true)
on conflict (key) do nothing;
