/* eslint-disable max-lines -- one PGlite boot shared by every DB scenario; splitting would re-apply 8 migrations per file */
/* Database integration test — runs ALL migrations (0001..0005) on a real PostgreSQL 16 (PGlite, in-process)
   with a stubbed Supabase `auth`/`storage` schema, then exercises the RPCs, RLS grants and the audit trigger.
   Run: npm run test:db   (needs devDependency @electric-sql/pglite; no Supabase project required) */
// Integration test of migrations 0001..0004 on real PostgreSQL 16 (PGlite), with a stubbed Supabase auth schema.
import { PGlite } from "@electric-sql/pglite";
import { uuid_ossp } from "@electric-sql/pglite/contrib/uuid_ossp";
process.on("unhandledRejection", (e) => {
  console.log("ABORT:", e.message);
  process.exit(1);
});
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const SQLDIR = fileURLToPath(new URL("../../supabase/", import.meta.url));
let failures = 0;
const db = new PGlite({ extensions: { uuid_ossp } });
const q = (sql, params) => db.query(sql, params);
const run = async (label, sql) => {
  try {
    await db.exec(sql);
    console.log("OK  ", label);
  } catch (e) {
    console.log("FAIL", label, "→", e.message);
    failures++;
    throw e;
  }
};
const expectError = async (label, sql, needle) => {
  try {
    await db.exec(sql);
    console.log("FAIL", label, "→ no error raised");
    failures++;
  } catch (e) {
    const bad = needle && !e.message.includes(needle);
    if (bad) failures++;
    console.log(bad ? "FAIL" : "OK  ", label, "→ error:", e.message.split("\n")[0]);
  }
};
const setJwt = (claims) =>
  q(
    `select set_config('request.jwt.claims', $1, false), set_config('request.jwt.claim.role', $2, false), set_config('request.jwt.claim.sub', $3, false)`,
    [JSON.stringify(claims || {}), claims?.role || "", claims?.sub || ""]
  );

// --- Supabase stubs: roles + auth schema -------------------------------------
await run(
  "stub roles/auth",
  `
  do $$ begin
    if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
    if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
    if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if;
  end $$;
  create schema if not exists auth;
  create schema if not exists storage;
  create table if not exists storage.buckets (id text primary key, name text, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
  create table if not exists storage.objects (id uuid default gen_random_uuid() primary key, bucket_id text, name text, owner uuid, metadata jsonb);
  alter table storage.objects enable row level security;
  create table if not exists auth.users (id uuid primary key, email text);
  create or replace function auth.jwt() returns jsonb language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb) $$;
  create or replace function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create or replace function auth.role() returns text language sql stable as $$
    select nullif(current_setting('request.jwt.claim.role', true), '') $$;
  -- same grants Supabase ships with: API roles may call auth.* helpers and use the public schema
  grant usage on schema auth, public to anon, authenticated, service_role;
  grant execute on all functions in schema auth to anon, authenticated, service_role;
`
);
for (const f of [
  "schema.sql",
  "migrations/0002_relational.sql",
  "migrations/0003_catalog_source_of_truth.sql",
  "migrations/0004_catalog_atomic.sql",
  "migrations/0005_fix_create_order_v2.sql",
  "migrations/0006_stock_bumps_catalog.sql",
  "migrations/0007_security_hardening.sql",
  "migrations/0008_restock_on_cancel.sql"
]) {
  await run(
    "apply " + f,
    readFileSync(SQLDIR + f, "utf8").replace(
      /create extension if not exists pgcrypto;/g,
      "-- pgcrypto not bundled in PGlite; gen_random_uuid() is core since PG13"
    )
  );
}

const STAFF = "11111111-1111-1111-1111-111111111111";
await q("insert into auth.users(id,email) values ($1,'owner@test')", [STAFF]);
// 0007: is_staff()/is_owner() also require an ACTIVE restore_staff row (JWT alone is no longer enough)
await q(
  "insert into public.restore_staff(auth_id, username, email, name, role, active) values ($1,'owner','owner@test','{}'::jsonb,'owner',true)",
  [STAFF]
);
// published settings the order RPC reads prices of delivery / payment discounts from (0007)
await q(
  `insert into public.restore_state(id, data) values ('main', '{"settings":{"freeShippingOver":20000,"cities":[{"id":"nouakchott","name":{"ar":"نواكشوط","fr":"Nouakchott"},"fee":0,"active":true},{"id":"rosso","name":{"ar":"روصو","fr":"Rosso"},"fee":600,"active":true}],"payments":[{"id":"cash","name":{"ar":"نقدا","fr":"Cash"},"active":true,"discount":0},{"id":"bankily","name":{"ar":"بنكيلي","fr":"Bankily"},"active":true,"discount":10}]}}'::jsonb) on conflict (id) do update set data = excluded.data`
);
await q(
  'insert into public.restore_collections(id,handle,title) values (\'iphone\',\'iphone\',\'{"ar":"آيفون","fr":"iPhone"}\'),(\'deals\',\'deals\',\'{"ar":"عروض","fr":"Promos"}\')'
);

const product = {
  row: {
    id: "iphone-13",
    handle: "iphone-13",
    title: { ar: "آيفون 13", fr: "iPhone 13" },
    price: 125000,
    stock: 4,
    images: ["a.jpg"],
    extra: { battery: 91 }
  },
  variants: [
    { sku: "IP13-BLK", color: "Noir", price_delta: 0, stock: 2 },
    { sku: "IP13-RED", color: "Rouge", price_delta: 5000, stock: 2 }
  ],
  collectionHandles: ["deals", "iphone"]
};

console.log("\n== Scenario 2/3: staff upsert via RPC, audit row with actor ==");
await setJwt({ sub: STAFF, role: "authenticated", app_metadata: { role: "owner" } });
const r = await q("select * from public.restore_upsert_product($1::jsonb)", [JSON.stringify(product)]);
console.log("OK   upsert returned", r.rows[0].handle, "price", r.rows[0].price);
console.log(
  "     variants:",
  (await q("select sku, price_delta from restore_product_variants where product_id='iphone-13' order by sku")).rows
);
console.log(
  "     links   :",
  (
    await q(
      "select collection_id, sort_order from restore_collection_products where product_id='iphone-13' order by sort_order"
    )
  ).rows
);
console.log(
  "     meta    :",
  (await q("select version>0 as bumped from restore_catalog_meta where id='main'")).rows[0]
);
console.log(
  "     audit   :",
  (await q("select table_name, action, actor, actor_role from restore_audit_log order by id")).rows
);

console.log("\n== Scenario 2b: second upsert replaces variants/links (no duplicates), diff-only audit ==");
product.variants = [{ sku: "IP13-BLK", color: "Noir", price_delta: 0, stock: 1 }];
product.collectionHandles = ["iphone"];
product.row.price = 120000;
await q("select public.restore_upsert_product($1::jsonb)", [JSON.stringify(product)]);
console.log(
  "     variants:",
  (await q("select count(*)::int n from restore_product_variants where product_id='iphone-13'")).rows[0]
);
console.log(
  "     links   :",
  (await q("select count(*)::int n from restore_collection_products where product_id='iphone-13'")).rows[0]
);
console.log(
  "     audit diff on products UPDATE:",
  (
    await q(
      "select diff from restore_audit_log where table_name='restore_products' and action='UPDATE' order by id desc limit 1"
    )
  ).rows[0]
);

console.log("\n== Scenario 4: SQL-editor style change (no JWT) still audited with actor null ==");
await setJwt(null);
await q("update restore_products set price = 99000 where id='iphone-13'");
console.log(
  "     ",
  (
    await q(
      "select action, actor, actor_role, diff->'price' as price from restore_audit_log where table_name='restore_products' order by id desc limit 1"
    )
  ).rows[0]
);

console.log("\n== Scenario 5: invalid input → error and NO partial writes ==");
await setJwt({ sub: STAFF, role: "authenticated", app_metadata: { role: "owner" } });
const before = (
  await q(
    "select (select count(*) from restore_products) p, (select count(*) from restore_product_variants) v, (select count(*) from restore_collection_products) l"
  )
).rows[0];
await expectError(
  "bad handle",
  `select public.restore_upsert_product('{"row":{"handle":"bad handle!","title":{"ar":"x","fr":"x"}}}')`,
  "invalid handle"
);
await expectError(
  "negative price",
  `select public.restore_upsert_product('{"row":{"handle":"neg","title":{"ar":"x","fr":"x"},"price":-5}}')`,
  ">= 0"
);
await expectError(
  "variant violates check → whole tx rolled back",
  `select public.restore_upsert_product('{"row":{"id":"rb","handle":"rb","title":{"ar":"x","fr":"x"},"price":10},"variants":[{"sku":"ok","stock":1},{"sku":null,"stock":1,"price_delta":"notanumber"}]}')`
);
const after = (
  await q(
    "select (select count(*) from restore_products) p, (select count(*) from restore_product_variants) v, (select count(*) from restore_collection_products) l"
  )
).rows[0];
console.log(
  "     counts before",
  before,
  "after",
  after,
  JSON.stringify(before) === JSON.stringify(after) ? "→ OK no partial rows" : "→ FAIL partial rows left"
);
console.log(
  "     product 'rb' exists?",
  (await q("select count(*)::int n from restore_products where id='rb'")).rows[0]
);

console.log("\n== Authorization: non-staff / anon cannot call the RPCs ==");
await setJwt({
  sub: "22222222-2222-2222-2222-222222222222",
  role: "authenticated",
  app_metadata: { role: "customer" }
});
await expectError("customer upsert", `select public.restore_upsert_product('${JSON.stringify(product)}')`, "forbidden");
await expectError("customer delete", `select public.restore_delete_product('iphone-13')`, "forbidden");
console.log(
  "     execute privilege for anon:",
  (await q("select has_function_privilege('anon','public.restore_upsert_product(jsonb)','execute') as anon_can"))
    .rows[0]
);
console.log(
  "     execute privilege for authenticated:",
  (
    await q(
      "select has_function_privilege('authenticated','public.restore_upsert_product(jsonb)','execute') as auth_can"
    )
  ).rows[0]
);
console.log(
  "     audit_log insert privilege for authenticated:",
  (await q("select has_table_privilege('authenticated','public.restore_audit_log','insert') as can_insert")).rows[0]
);

console.log("\n== Delete RPC: cascades + audit ==");
await setJwt({ sub: STAFF, role: "authenticated", app_metadata: { role: "owner" } });
console.log("     deleted:", (await q("select public.restore_delete_product('iphone-13') ok")).rows[0]);
console.log(
  "     leftovers:",
  (
    await q(
      "select (select count(*)::int from restore_product_variants where product_id='iphone-13') v, (select count(*)::int from restore_collection_products where product_id='iphone-13') l"
    )
  ).rows[0]
);
console.log(
  "     audit tail:",
  (await q("select table_name, action from restore_audit_log order by id desc limit 4")).rows
);

console.log("\n== Order RPC still works against the catalog (regression) ==");
await q("select public.restore_upsert_product($1::jsonb)", [JSON.stringify(product)]);
console.log(
  "     coupon public-read policy exists:",
  (
    await q(
      "select count(*)::int n from pg_policies where tablename='restore_coupons' and policyname='restore_coupons_public_read'"
    )
  ).rows[0]
);
console.log(
  "     indexes:",
  (
    await q(
      "select indexname from pg_indexes where indexname in ('restore_orders_created_status_idx','restore_products_active_sort_idx') order by 1"
    )
  ).rows.map((r) => r.indexname)
);
await setJwt({ sub: STAFF, role: "authenticated", app_metadata: { role: "owner" } });
await q(
  "insert into restore_coupons(code,type,value,min_total,active) values ('RESTORE10','percent',10,0,true) on conflict (code) do nothing"
);
await setJwt(null);
const order = await q("select public.restore_create_order_v2($1::jsonb) o", [
  JSON.stringify({
    items: [{ handle: "iphone-13", qty: 1 }],
    customer: { name: "Test", phone: "44444869" },
    payment: { id: "cash" },
    coupon: "RESTORE10"
  })
]);
console.log("     order_v2 result:", JSON.stringify(order.rows[0].o).slice(0, 200));
console.log("     stock after order:", (await q("select stock from restore_products where id='iphone-13'")).rows[0]);
console.log(
  "     order audited:",
  (
    await q(
      "select table_name, action from restore_audit_log where table_name='restore_orders' order by id desc limit 1"
    )
  ).rows
);
// order without coupon + mixed items (variant first, then plain) — the exact 0002 failure modes
await setJwt({ sub: STAFF, role: "authenticated", app_metadata: { role: "owner" } });
await q("select public.restore_upsert_product($1::jsonb)", [
  JSON.stringify({ row: { id: "plain", handle: "plain", title: { ar: "x", fr: "x" }, price: 1000, stock: 5 } })
]);
await setJwt(null);
const vid = (await q("select id from restore_product_variants where product_id='iphone-13' limit 1")).rows[0].id;
const o2 = await q("select public.restore_create_order_v2($1::jsonb) o", [
  JSON.stringify({
    items: [
      { handle: "iphone-13", qty: 1, variantId: vid },
      { handle: "plain", qty: 2 }
    ],
    customer: { name: "T", phone: "1" },
    payment: { id: "cash" }
  })
]);
console.log(
  "     mixed order total:",
  o2.rows[0].o.total,
  "items:",
  o2.rows[0].o.items.map((i) => [i.handle, i.variantId, i.unitPrice])
);
console.log(
  "     stocks:",
  (await q("select id, stock from restore_products where id in ('iphone-13','plain') order by id")).rows,
  (await q("select id, stock from restore_product_variants where id=$1", [vid])).rows
);
if (JSON.stringify(before) !== JSON.stringify(after)) failures++;
// A sale with a variant must decrement the VARIANT row (the parent row.stock is informational — the app sums variants)
{
  const vStock = Number((await q("select stock from restore_product_variants where id=$1", [vid])).rows[0].stock);
  if (vStock !== 0) throw new Error(`variant stock after selling its single unit should be 0, got ${vStock}`);
  const soldTitle = o2.rows[0].o.items[0].title;
  if (!soldTitle || typeof soldTitle !== "object" || !soldTitle.ar)
    throw new Error("order items carry the bilingual title object — the client must localise it (readableItems)");
  console.log("     variant decremented to 0 and item title is {ar,fr} as the client expects");
}

// ===================== RLS: real row-level security with `set role` (PGlite user is superuser; anon/authenticated are not) =====================
console.log("\n== Row Level Security ==");
const asRole = async (role, claims, fn) => {
  await setJwt(claims);
  await q(`set role ${role}`);
  try {
    return await fn();
  } finally {
    await q("reset role");
    await setJwt(null);
  }
};
// "permission denied" (no GRANT) and RLS-filtered (0 rows) are both "cannot read" — report 0 either way.
const count = async (sql) => {
  try {
    return Number((await q(sql)).rows[0].n);
  } catch (e) {
    if (/permission denied/.test(e.message)) return 0;
    throw e;
  }
};
const check = (label, ok, extra = "") => {
  console.log(ok ? "OK  " : "FAIL", label, extra);
  if (!ok) failures++;
};
const CUST_A = "0f1d3c88-1111-4a6d-9c5a-aaaaaaaaaaaa",
  CUST_B = "0f1d3c88-2222-4a6d-9c5a-bbbbbbbbbbbb";
await q("insert into auth.users(id, email) values ($1,'a@x.mr'),($2,'b@x.mr') on conflict do nothing", [
  CUST_A,
  CUST_B
]);
await q("insert into restore_customers(id, auth_id, name) values ($1,$1,'A'),($2,$2,'B') on conflict (id) do nothing", [
  CUST_A,
  CUST_B
]);
await q(
  "insert into restore_orders(id, data, status, customer_id, created_at, updated_at) values ('ORD-A','{}'::jsonb,'new',$1,now(),now()), ('ORD-B','{}'::jsonb,'new',$2,now(),now()) on conflict (id) do nothing",
  [CUST_A, CUST_B]
);
try {
  // anon
  await asRole("anon", null, async () => {
    check("anon reads active products", (await count("select count(*) n from restore_products")) >= 1);
    check("anon cannot read orders", (await count("select count(*) n from restore_orders")) === 0);
    check("anon cannot read customers", (await count("select count(*) n from restore_customers")) === 0);
    check("anon cannot read staff", (await count("select count(*) n from restore_staff")) === 0);
    check("anon cannot read audit log", (await count("select count(*) n from restore_audit_log")) === 0);
    let blocked = false;
    try {
      await q("update restore_products set price = 1 where id='iphone-13'");
    } catch {
      blocked = true;
    }
    const price = (await q("select price from restore_products where id='iphone-13'")).rows[0].price;
    check("anon cannot change prices", blocked || price !== 1, `price=${price}`);
    blocked = false;
    try {
      await q(
        "insert into restore_orders(id,data,status,created_at,updated_at) values ('ORD-X','{}','new',now(),now())"
      );
    } catch {
      blocked = true;
    }
    check("anon cannot insert orders directly (must go through create-order)", blocked);
    blocked = false;
    try {
      await q(
        "insert into restore_abandoned(id, data, created_at, updated_at) values ('ab1', '{\"x\":1}', now(), now())"
      );
    } catch (e) {
      blocked = e.message;
    }
    check("anon CAN save an abandoned cart (public insert policy)", blocked === false, String(blocked));
    blocked = false;
    try {
      await q("update restore_abandoned set data='{}' where id='ab1'");
    } catch {
      blocked = true;
    }
    check(
      "anon cannot update other carts",
      blocked || (await count("select count(*) n from restore_abandoned where data='{}'::jsonb")) === 0
    );
  });
  // customer A (authenticated, not staff)
  await asRole("authenticated", { sub: CUST_A, role: "authenticated", email: "a@x.mr" }, async () => {
    const mine = (await q("select id from restore_orders")).rows.map((r) => r.id);
    check("customer A sees only own orders", mine.includes("ORD-A") && !mine.includes("ORD-B"), JSON.stringify(mine));
    check("customer A cannot read staff table", (await count("select count(*) n from restore_staff")) === 0);
    check(
      "customer A cannot read other customers",
      (await count(`select count(*) n from restore_customers where id <> '${CUST_A}'`)) === 0
    );
    let blocked = false;
    try {
      await q("update restore_orders set status='delivered' where id='ORD-A'");
    } catch {
      blocked = true;
    }
    const st = (await q("select status from restore_orders where id='ORD-A'")).rows[0]?.status;
    check("customer cannot change own order status", blocked || st === "new", `status=${st}`);
  });
  // staff (owner)
  await asRole("authenticated", { sub: STAFF, role: "authenticated", app_metadata: { role: "owner" } }, async () => {
    check("staff sees all orders", (await count("select count(*) n from restore_orders")) >= 2);
    check("staff reads audit log", (await count("select count(*) n from restore_audit_log")) >= 1);
    await q("update restore_orders set status='confirmed' where id='ORD-B'");
    check(
      "staff can update orders",
      (await q("select status from restore_orders where id='ORD-B'")).rows[0].status === "confirmed"
    );
  });
  // ---- 0007 hardening ------------------------------------------------------------------------------------
  const MGR = "33333333-3333-3333-3333-333333333333";
  await q("insert into auth.users(id,email) values ($1,'mgr@test') on conflict do nothing", [MGR]);
  await q(
    "insert into public.restore_staff(auth_id, username, email, name, role, active) values ($1,'mgr','mgr@test','{}'::jsonb,'manager',true) on conflict (auth_id) do nothing",
    [MGR]
  );
  const mgrJwt = { sub: MGR, role: "authenticated", app_metadata: { role: "manager" } };
  await asRole("authenticated", mgrJwt, async () => {
    check("manager is staff", (await q("select public.is_staff() s")).rows[0].s === true);
    await q("update restore_staff set whatsapp='22246000000' where auth_id=$1", [MGR]);
    check(
      "manager may edit own profile fields",
      (await q("select whatsapp w from restore_staff where auth_id=$1", [MGR])).rows[0].w === "22246000000"
    );
    let blocked = "";
    try {
      await q("update restore_staff set role='owner' where auth_id=$1", [MGR]);
    } catch (e) {
      blocked = e.message;
    }
    const role = (await q("select role from restore_staff where auth_id=$1", [MGR])).rows[0].role;
    check(
      "manager CANNOT promote himself to owner (0007 guard)",
      /forbidden/.test(blocked) && role === "manager",
      `role=${role}`
    );
    blocked = "";
    try {
      await q("update restore_staff set active=true, username='root' where auth_id=$1", [MGR]);
    } catch (e) {
      blocked = e.message;
    }
    check("manager CANNOT change his login/active flags", /forbidden/.test(blocked));
  });
  // owner deactivates the manager → access ends immediately, even with a valid JWT
  await asRole("authenticated", { sub: STAFF, role: "authenticated", app_metadata: { role: "owner" } }, async () => {
    await q("update restore_staff set active=false where auth_id=$1", [MGR]);
    check(
      "owner can deactivate a manager",
      (await q("select active a from restore_staff where auth_id=$1", [MGR])).rows[0].a === false
    );
    let blocked = "";
    try {
      await q("update restore_staff set role='manager' where auth_id=$1", [STAFF]);
    } catch (e) {
      blocked = e.message;
    }
    check("the last owner cannot demote himself", /last owner/.test(blocked));
  });
  await asRole("authenticated", mgrJwt, async () => {
    check(
      "deactivated manager is NOT staff any more (JWT still says manager)",
      (await q("select public.is_staff() s")).rows[0].s === false
    );
    check("deactivated manager cannot read orders", (await count("select count(*) n from restore_orders")) === 0);
  });
  // JWT role without a staff row is not staff either
  await asRole("authenticated", { sub: CUST_B, role: "authenticated", app_metadata: { role: "owner" } }, async () => {
    check(
      "forged app_metadata.role without a restore_staff row is not staff",
      (await q("select public.is_staff() s")).rows[0].s === false
    );
  });
  // money: the client cannot pick its own discount, and delivery is charged by the server
  await setJwt(null);
  await q("update restore_products set stock = 50 where id='plain'");
  const tampered = (
    await q("select public.restore_create_order_v2($1::jsonb) o", [
      JSON.stringify({
        items: [{ handle: "plain", qty: 1 }],
        customer: { name: "T", phone: "44444869", cityId: "rosso", city: "روصو" },
        payment: { id: "cash", discount: 100 }
      })
    ])
  ).rows[0].o;
  check(
    "client-sent payment.discount is ignored (cash = 0 %)",
    tampered.discount === 0 && tampered.payment.discount === 0,
    `discount=${tampered.discount}`
  );
  check(
    "delivery fee of the chosen city is charged server-side (Rosso 600)",
    tampered.shipping === 600 && tampered.total === 1600,
    `total=${tampered.total}`
  );
  const bankily = (
    await q("select public.restore_create_order_v2($1::jsonb) o", [
      JSON.stringify({
        items: [{ handle: "plain", qty: 1 }],
        customer: { name: "T", phone: "44444869", cityId: "nouakchott" },
        payment: { id: "bankily" }
      })
    ])
  ).rows[0].o;
  check(
    "configured payment discount is applied (Bankily 10 % of 1000 = 100)",
    bankily.paymentDiscount === 100 && bankily.total === 900,
    `total=${bankily.total}`
  );
  const freeShip = (
    await q("select public.restore_create_order_v2($1::jsonb) o", [
      JSON.stringify({
        items: [
          { handle: "plain", qty: 20 },
          { handle: "plain", qty: 5 }
        ],
        customer: { name: "T", phone: "44444869", cityId: "rosso" },
        payment: { id: "cash" }
      })
    ])
  ).rows[0].o;
  check(
    "free delivery at/above settings.freeShippingOver (25000 >= 20000)",
    freeShip.shipping === 0,
    `shipping=${freeShip.shipping}`
  );
  let unknownPay = "";
  try {
    await q("select public.restore_create_order_v2($1::jsonb)", [
      JSON.stringify({
        items: [{ handle: "plain", qty: 1 }],
        customer: { name: "T", phone: "44444869" },
        payment: { id: "paypal" }
      })
    ]);
  } catch (e) {
    unknownPay = e.message;
  }
  check("unknown payment method is rejected", /Unknown payment method/.test(unknownPay));
  // ---- 0008: cancel / return gives the units back -------------------------------------------------------
  {
    const stock0 = Number((await q("select stock from restore_products where id='plain'")).rows[0].stock);
    const used0 = Number((await q("select used_count from restore_coupons where code='RESTORE10'")).rows[0].used_count);
    const o = (
      await q("select public.restore_create_order_v2($1::jsonb) o", [
        JSON.stringify({
          items: [{ handle: "plain", qty: 3 }],
          customer: { name: "T", phone: "44444869", cityId: "nouakchott" },
          payment: { id: "cash" },
          coupon: "RESTORE10"
        })
      ])
    ).rows[0].o;
    const stock1 = Number((await q("select stock from restore_products where id='plain'")).rows[0].stock);
    check("order of 3 decrements stock by 3", stock1 === stock0 - 3, `${stock0} -> ${stock1}`);
    await asRole("authenticated", { sub: STAFF, role: "authenticated", app_metadata: { role: "owner" } }, async () => {
      // the dashboard sends status + its own copy of data (without any flag)
      await q("update restore_orders set status='cancelled', data = data - 'stockRestored' where id=$1", [o.id]);
    });
    const stock2 = Number((await q("select stock from restore_products where id='plain'")).rows[0].stock);
    check("cancelled → 3 units back in stock (0008)", stock2 === stock0, `${stock2}`);
    const used1 = Number((await q("select used_count from restore_coupons where code='RESTORE10'")).rows[0].used_count);
    check("cancelled → coupon usage reversed", used1 === used0, `${used0} -> ${used1}`);
    await q("update restore_orders set status='cancelled', data = data || '{\"internalNote\":\"x\"}' where id=$1", [
      o.id
    ]);
    await q("update restore_orders set status='returned' where id=$1", [o.id]);
    const stock3 = Number((await q("select stock from restore_products where id='plain'")).rows[0].stock);
    check("repeated cancelled/returned updates do NOT restock twice", stock3 === stock0, `${stock3}`);
    const flag = (await q("select data->>'stockRestored' f from restore_orders where id=$1", [o.id])).rows[0].f;
    check("flag survives a data overwrite by the client", flag === "true");
    await q("update restore_orders set status='confirmed' where id=$1", [o.id]);
    const stock4 = Number((await q("select stock from restore_products where id='plain'")).rows[0].stock);
    check("re-opened by mistake → units taken again", stock4 === stock0 - 3, `${stock4}`);
    await q("update restore_orders set status='delivered' where id=$1", [o.id]);
    const stock5 = Number((await q("select stock from restore_products where id='plain'")).rows[0].stock);
    check("delivered does not touch stock", stock5 === stock0 - 3, `${stock5}`);
    const bumped = (await q("select version from restore_catalog_meta where id='main'")).rows[0].version;
    check("catalog version bumped so dashboards refresh stock", Number(bumped) > 0);
  }
  check(
    "SVG no longer accepted in the public media bucket",
    !(await q("select allowed_mime_types m from storage.buckets where id='restore-media'")).rows[0].m.includes(
      "image/svg+xml"
    )
  );
  // rate limiter used by the Edge Functions
  await setJwt(null);
  const hits = [];
  for (let i = 0; i < 4; i++) hits.push((await q("select public.restore_rate_hit('t:1', 3, 60) ok")).rows[0].ok);
  check(
    "restore_rate_hit allows 3 then blocks",
    JSON.stringify(hits) === "[true,true,true,false]",
    JSON.stringify(hits)
  );
  let rateAnon = false;
  try {
    await asRole("anon", null, () => q("select public.restore_rate_hit('t:2', 3, 60)"));
  } catch {
    rateAnon = true;
  }
  check("anon cannot call restore_rate_hit", rateAnon);
} catch (e) {
  console.log("FAIL RLS section crashed →", e.message.split("\n")[0]);
  failures++;
}

console.log(failures ? `\nDONE with ${failures} failure(s)` : "\nDONE — all database scenarios passed");
process.exit(failures ? 1 : 0);
