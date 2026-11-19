-- Restore migration 0007: security hardening found by the 1.17 pre-sale review. Idempotent, safe on live data.
--
--  A. Privilege escalation (HIGH). `restore_staff_own_update` let a manager UPDATE his own row — including
--     `role = 'owner'` and `active`. `admin-create-staff` trusts `restore_staff.role`, so a manager could promote
--     himself, create a real owner login and take the store. Fix: a BEFORE UPDATE trigger that refuses changes to
--     role / active / auth_id / username / email unless the caller is an owner (or the service role).
--
--  B. Deactivated staff kept access (HIGH). `is_staff()` only read the JWT `app_metadata.role`; a manager switched
--     off by the owner stayed staff for as long as his refresh token lived. Fix: is_staff()/is_owner() now ALSO
--     require an `active = true` row in restore_staff (security definer, so no RLS recursion). An owner promoted
--     in the table is an owner immediately, without re-issuing the JWT.
--
--  C. Client-controlled money (HIGH). `restore_create_order_v2` took the payment-method discount from the
--     request body (`payment.discount`) and never charged delivery (`v_shipping := 0`). A visitor could post
--     `{"payment":{"discount":100}}` and get an order recorded at total 0. Fix: discount is looked up in
--     settings.payments by `payment.id`; delivery fee comes from settings.cities by `customer.cityId` (fallback:
--     city name) honouring settings.freeShippingOver. The client never decides a number any more.
--
--  D. Order item ids are now deterministic per (order, position) — the md5(clock_timestamp) id could collide for two
--     lines of the same product inside one order. Smaller items: no SVG uploads to the public media bucket (script-bearing images); one review per
--     customer per product + body length limits; size caps on customer-controlled jsonb (wishlist/addresses).

-- ---------------------------------------------------------------------------
-- B. role helpers (same names/signatures: every existing policy keeps working)
-- ---------------------------------------------------------------------------
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') in ('owner', 'manager')
    and exists (
      select 1 from public.restore_staff s
      where s.auth_id = auth.uid() and s.active = true and s.role in ('owner', 'manager')
    ),
    false
  );
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') in ('owner', 'manager')
    and exists (
      select 1 from public.restore_staff s
      where s.auth_id = auth.uid() and s.active = true and s.role = 'owner'
    ),
    false
  );
$$;

revoke all on function public.is_staff() from public;
revoke all on function public.is_owner() from public;
grant execute on function public.is_staff() to anon, authenticated, service_role;
grant execute on function public.is_owner() to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- A. staff row guard
-- ---------------------------------------------------------------------------
create or replace function public.restore_staff_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- service role (Edge Functions, SQL editor) and owners may change anything
  if coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role' or auth.uid() is null then
    return new;
  end if;
  if public.is_owner() then
    -- but never remove the last active owner
    if old.role = 'owner' and (new.role <> 'owner' or new.active = false)
       and (select count(*) from public.restore_staff where role = 'owner' and active = true and id <> old.id) = 0 then
      raise exception 'cannot remove the last owner' using errcode = '23514';
    end if;
    return new;
  end if;
  if new.role is distinct from old.role
     or new.active is distinct from old.active
     or new.auth_id is distinct from old.auth_id
     or new.username is distinct from old.username
     or new.email is distinct from old.email then
    raise exception 'forbidden: only an owner can change role/active/login fields' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists restore_staff_guard on public.restore_staff;
create trigger restore_staff_guard
  before update on public.restore_staff
  for each row execute function public.restore_staff_guard();

-- ---------------------------------------------------------------------------
-- C. server-side totals
-- ---------------------------------------------------------------------------
create or replace function public.restore_create_order_v2(p_order jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_id text := coalesce(nullif(left(btrim(coalesce(p_order->>'id','')),120),''), 'RS-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)));
  v_item jsonb; v_p public.restore_products; v_v public.restore_product_variants; v_qty int; v_unit int; v_line int; v_subtotal int := 0; v_shipping int := 0; v_discount int := 0; v_total int := 0;
  v_coupon public.restore_coupons; v_coupon_discount int := 0; v_payment_discount int := 0; v_pay jsonb; v_settings jsonb; v_items jsonb := '[]'::jsonb;
  v_pay_id text; v_pay_cfg jsonb; v_pay_rate numeric := 0; v_city jsonb; v_city_id text; v_city_name text; v_free_over int := 0;
begin
  select data->'settings' into v_settings from public.restore_state where id='main';
  if jsonb_typeof(p_order->'items') <> 'array' or jsonb_array_length(p_order->'items') < 1 then raise exception 'Order items are required'; end if;
  if jsonb_array_length(p_order->'items') > 50 then raise exception 'Too many items'; end if;
  for v_item in select * from jsonb_array_elements(p_order->'items') loop
    v_qty := greatest(1, least(20, coalesce((v_item->>'qty')::int,1)));
    v_v := null; -- reset: previous item's variant must never leak into this one
    select * into v_p from public.restore_products where handle = coalesce(v_item->>'handle','') and active = true for update;
    if not found then raise exception 'Unknown product: %', coalesce(v_item->>'handle',''); end if;
    v_unit := v_p.price;
    if nullif(coalesce(v_item->>'variantId',''),'') is not null then
      select * into v_v from public.restore_product_variants where id = v_item->>'variantId' and product_id = v_p.id for update;
      if found then v_unit := greatest(0, v_p.price + coalesce(v_v.price_delta,0)); end if;
    end if;
    if v_v.id is not null then
      if v_v.stock < v_qty then raise exception 'Insufficient stock: %', v_p.handle; end if;
      update public.restore_product_variants set stock = stock - v_qty, updated_at = v_now where id = v_v.id;
    else
      if v_p.stock < v_qty then raise exception 'Insufficient stock: %', v_p.handle; end if;
      update public.restore_products set stock = stock - v_qty, updated_at = v_now where id = v_p.id;
    end if;
    v_line := v_unit * v_qty; v_subtotal := v_subtotal + v_line;
    v_items := v_items || jsonb_build_array(jsonb_build_object('handle',v_p.handle,'productId',v_p.id,'variantId',v_v.id,'title',v_p.title,'unitPrice',v_unit,'qty',v_qty,'line',v_line));
  end loop;

  -- payment method: only the id is taken from the client; discount comes from the published settings
  v_pay_id := left(coalesce(p_order#>>'{payment,id}',''),60);
  select e into v_pay_cfg from jsonb_array_elements(coalesce(v_settings->'payments','[]'::jsonb)) e
    where e->>'id' = v_pay_id and coalesce((e->>'active')::boolean, true) limit 1;
  -- a store that has not published any payment list yet (fresh project) cannot be abused: no discount exists
  if v_pay_cfg is null and v_pay_id <> '' and jsonb_array_length(coalesce(v_settings->'payments','[]'::jsonb)) > 0 then
    raise exception 'Unknown payment method: %', v_pay_id;
  end if;
  v_pay_rate := greatest(0, least(100, coalesce((v_pay_cfg->>'discount')::numeric, 0)));
  v_pay := jsonb_build_object('id', v_pay_id,
                              'name', coalesce(case when left(coalesce(p_order->>'lang','ar'),2) = 'fr' then v_pay_cfg#>>'{name,fr}' end, v_pay_cfg#>>'{name,ar}', v_pay_cfg#>>'{name,fr}', v_pay_id),
                              'account', coalesce(v_pay_cfg->>'account',''), 'discount', v_pay_rate);
  v_payment_discount := round(v_subtotal * v_pay_rate / 100);

  -- delivery: fee of the chosen city (by id, else by name), free at or above settings.freeShippingOver
  v_city_id := coalesce(p_order#>>'{customer,cityId}','');
  v_city_name := coalesce(p_order#>>'{customer,city}','');
  select e into v_city from jsonb_array_elements(coalesce(v_settings->'cities','[]'::jsonb)) e
    where coalesce((e->>'active')::boolean, true)
      and (e->>'id' = v_city_id or (v_city_id = '' and (e#>>'{name,ar}' = v_city_name or e#>>'{name,fr}' = v_city_name)))
    limit 1;
  v_free_over := coalesce((v_settings->>'freeShippingOver')::int, 0);
  v_shipping := case when v_free_over > 0 and v_subtotal >= v_free_over then 0
                     else greatest(0, coalesce((v_city->>'fee')::int, 0)) end;

  if nullif(btrim(coalesce(p_order->>'coupon','')), '') is not null then
    select * into v_coupon from public.restore_coupons where upper(code)=upper(btrim(p_order->>'coupon')) and active=true for update;
    if found and (v_coupon.expires_at is null or v_coupon.expires_at >= v_now) and v_subtotal >= v_coupon.min_total and (v_coupon.usage_limit is null or v_coupon.used_count < v_coupon.usage_limit) then
      v_coupon_discount := case when v_coupon.type='percent' then round(v_subtotal * least(100, greatest(0, v_coupon.value)) / 100.0) else greatest(0, v_coupon.value) end;
      update public.restore_coupons set used_count = used_count + 1, updated_at = v_now where code = v_coupon.code;
    else v_coupon := null; end if;
  end if;
  v_discount := least(v_subtotal, v_payment_discount + v_coupon_discount);
  v_total := greatest(0, v_subtotal + v_shipping - v_discount);
  insert into public.restore_orders(id, data, status, customer_name, phone, city, address, payment_method, subtotal, shipping, discount, total, coupon_code, validated, created_at, updated_at)
  values (v_id, jsonb_build_object('id',v_id,'items',v_items,'customer',p_order->'customer','payment',v_pay,'subtotal',v_subtotal,'shipping',v_shipping,
            'paymentDiscount',v_payment_discount,'couponDiscount',v_coupon_discount,'coupon',case when v_coupon.code is null then '' else upper(v_coupon.code) end,
            'discount',v_discount,'total',v_total,'currency','MRU','lang',left(coalesce(p_order->>'lang','ar'),5),'source','secure-checkout-v2','serverValidated',true,'stockDecremented',true,'createdAt',v_now), 'new',
    left(coalesce(p_order#>>'{customer,name}',''),120), left(coalesce(p_order#>>'{customer,phone}',''),40), left(coalesce(v_city#>>'{name,ar}', v_city_name, ''),120), left(coalesce(p_order#>>'{customer,address}',''),300), v_pay_id, v_subtotal, v_shipping, v_discount, v_total, case when v_coupon.code is null then null else upper(v_coupon.code) end, true, v_now, v_now);
  insert into public.restore_order_items(id, order_id, product_id, variant_id, title_snapshot, unit_price, qty, line_total, created_at)
  select 'oi_'||substr(md5(v_id||':'||n::text),1,20), v_id, nullif(x->>'productId',''), nullif(x->>'variantId',''), left(coalesce(x#>>'{title,ar}', x#>>'{title,fr}', x->>'handle',''),200), (x->>'unitPrice')::int, (x->>'qty')::int, (x->>'line')::int, v_now
  from jsonb_array_elements(v_items) with ordinality as t(x, n);
  return (select data from public.restore_orders where id=v_id);
end;
$$;
revoke all on function public.restore_create_order_v2(jsonb) from public, anon, authenticated;
grant execute on function public.restore_create_order_v2(jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- D. smaller items
-- ---------------------------------------------------------------------------
update storage.buckets
  set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  where id = 'restore-media';

-- one review per customer per product; bounded text
create unique index if not exists restore_reviews_one_per_customer
  on public.restore_reviews (product_handle, customer_id) where customer_id is not null;
alter table public.restore_reviews drop constraint if exists restore_reviews_len;
alter table public.restore_reviews add constraint restore_reviews_len
  check (char_length(coalesce(title,'')) <= 120 and char_length(coalesce(body,'')) <= 2000 and char_length(coalesce(customer_name,'')) <= 80) not valid;

-- customer-owned jsonb cannot be used as free storage
alter table public.restore_customers drop constraint if exists restore_customers_size;
alter table public.restore_customers add constraint restore_customers_size
  check (pg_column_size(coalesce(wishlist,'[]'::jsonb)) <= 32768 and pg_column_size(coalesce(addresses,'[]'::jsonb)) <= 32768
         and char_length(coalesce(name,'')) <= 120 and char_length(coalesce(phone,'')) <= 40 and char_length(coalesce(email,'')) <= 254) not valid;
