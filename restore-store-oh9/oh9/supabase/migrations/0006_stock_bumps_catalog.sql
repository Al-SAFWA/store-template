-- Restore migration 0006: a sale must be visible in the catalog.
--   restore_create_order_v2 decrements restore_products / restore_product_variants stock inside the order
--   transaction, but nothing bumped restore_catalog_meta.version, so the dashboard and every storefront tab
--   (which only re-read the catalog when that version changes) kept showing the old stock until a product was
--   edited by hand. Found on demo1: 10 units ordered from a phone, dashboard stock unchanged.
--   Fix: a statement-level trigger on both tables bumps the version after any insert/update/delete.
-- Idempotent.

create or replace function public.restore_bump_catalog_meta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- same marker style as restore_upsert_product (epoch ms), monotonic even inside one millisecond
  insert into public.restore_catalog_meta (id, version, updated_at)
  values ('main', (extract(epoch from clock_timestamp()) * 1000)::bigint, now())
  on conflict (id) do update
    set version = greatest(excluded.version, public.restore_catalog_meta.version + 1), updated_at = excluded.updated_at;
  return null;
end;
$$;

drop trigger if exists restore_products_bump_meta on public.restore_products;
create trigger restore_products_bump_meta
  after insert or update or delete on public.restore_products
  for each statement execute function public.restore_bump_catalog_meta();

drop trigger if exists restore_product_variants_bump_meta on public.restore_product_variants;
create trigger restore_product_variants_bump_meta
  after insert or update or delete on public.restore_product_variants
  for each statement execute function public.restore_bump_catalog_meta();
