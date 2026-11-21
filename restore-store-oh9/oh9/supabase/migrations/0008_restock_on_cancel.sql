-- Restore migration 0008: cancelled / returned orders put their units back in stock. Idempotent.
--
-- The order RPC decrements restore_products / restore_product_variants inside the order transaction (good: no
-- double selling). But nothing reversed it: a merchant who cancelled a fake order, or took a phone back, had to edit
-- every product by hand. Now a row trigger on restore_orders.status does it:
--   * any status -> cancelled|returned  : stock += qty for every line (variant row when the line has one)
--   * cancelled|returned -> any status  : stock -= qty again (re-opened by mistake); refuses if stock ran out
--   * coupon used_count is reversed / re-applied the same way
-- Lines come from restore_order_items (relational, since 0002); orders older than that fall back to data->'items'.
-- The flag data.stockRestored makes the operation safe against repeated updates of the same status.

create or replace function public.restore_order_stock_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_was_closed boolean := old.status in ('cancelled','returned');
  v_is_closed  boolean := new.status in ('cancelled','returned');
  v_restored   boolean := coalesce((old.data->>'stockRestored')::boolean, false);
  v_sign int;
  v_line record;
  v_n int := 0;
begin
  -- the dashboard PATCHes the whole data object from its own copy: never let it drop the bookkeeping flag
  if v_restored and (new.data->>'stockRestored') is null then
    new.data := coalesce(new.data, '{}'::jsonb) || jsonb_build_object('stockRestored', true, 'stockSyncedAt', old.data->'stockSyncedAt');
  end if;
  if new.status is not distinct from old.status then return new; end if;
  if v_is_closed and not v_was_closed and not v_restored then
    v_sign := 1;            -- give back
  elsif v_was_closed and not v_is_closed and v_restored then
    v_sign := -1;           -- take again
  else
    return new;
  end if;

  -- relational lines first
  for v_line in
    select product_id, variant_id, qty from public.restore_order_items where order_id = old.id
  loop
    v_n := v_n + 1;
    if v_line.variant_id is not null then
      update public.restore_product_variants set stock = stock + v_sign * v_line.qty, updated_at = now()
        where id = v_line.variant_id and (v_sign = 1 or stock >= v_line.qty);
      if not found and v_sign = -1 then raise exception 'Insufficient stock to re-open order %', old.id using errcode = '23514'; end if;
    elsif v_line.product_id is not null then
      update public.restore_products set stock = stock + v_sign * v_line.qty, updated_at = now()
        where id = v_line.product_id and (v_sign = 1 or stock >= v_line.qty);
      if not found and v_sign = -1 then raise exception 'Insufficient stock to re-open order %', old.id using errcode = '23514'; end if;
    end if;
  end loop;

  -- legacy orders (before 0002): lines only inside data.items, and only if the server really decremented them
  if v_n = 0 and coalesce((old.data->>'stockDecremented')::boolean, false) then
    for v_line in
      select x->>'handle' as handle, nullif(x->>'variantId','') as variant_id, greatest(1, coalesce((x->>'qty')::int, 1)) as qty
      from jsonb_array_elements(coalesce(old.data->'items','[]'::jsonb)) x
    loop
      if v_line.variant_id is not null then
        update public.restore_product_variants set stock = greatest(0, stock + v_sign * v_line.qty), updated_at = now() where id = v_line.variant_id;
      else
        update public.restore_products set stock = greatest(0, stock + v_sign * v_line.qty), updated_at = now() where handle = v_line.handle;
      end if;
    end loop;
  end if;

  -- coupon usage follows the order
  if coalesce(old.coupon_code, old.data->>'coupon', '') <> '' then
    update public.restore_coupons
      set used_count = greatest(0, used_count - v_sign), updated_at = now()
      where upper(code) = upper(coalesce(old.coupon_code, old.data->>'coupon'));
  end if;

  new.data := coalesce(new.data, '{}'::jsonb) || jsonb_build_object('stockRestored', v_sign = 1, 'stockSyncedAt', now());
  return new;
end;
$$;

drop trigger if exists restore_orders_stock_sync on public.restore_orders;
create trigger restore_orders_stock_sync
  before update of status, data on public.restore_orders
  for each row execute function public.restore_order_stock_sync();
