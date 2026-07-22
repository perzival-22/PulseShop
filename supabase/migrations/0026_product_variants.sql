-- Product variants: colours alongside sizes, end to end.
--
-- Sizes already existed as a free-text `products.sizes` array that the merchant
-- typed by hand. Two problems with that, and one missing half:
--
--  1. NO COLOUR ANYWHERE. A shopper could buy a shirt without ever saying which
--     colour they wanted, and the seller received an order they could not fill
--     without a follow-up message. Colour has to travel the same whole path
--     size does — product -> filter -> cart -> order line -> WhatsApp message —
--     or it is decoration, not data.
--
--  2. FREE-TEXT SIZES DON'T AGGREGATE. "L", "l", "Large" and "large " are four
--     different sizes to a database, so a size FILTER over a shop's catalogue
--     was never going to work. The merchant form now offers a fixed preset
--     (SM/M/LG/XL/XXL/XXXL for clothing, numeric for footwear), which is what
--     makes the buyer-side facet meaningful. Existing free-text values are left
--     untouched and keep working — the column is unchanged, only the UI that
--     writes it is constrained.
--
-- Also fixes a live bug found while writing this: `products.summary` does not
-- exist in the database, but the frontend has been sending it on every product
-- insert/update since the "summary input type" commits. PostgREST rejects the
-- whole write, so ADDING OR EDITING ANY PRODUCT currently fails with "Couldn't
-- save product". The column is added here.

-- ---------------------------------------------------------------------------
-- products: the missing summary column, and colours
-- ---------------------------------------------------------------------------
alter table products
  add column if not exists summary text,
  add column if not exists colors  text[];

-- Mirrors the field constraints from 0021 (zod in the browser is advice; this
-- is enforcement) and the 160-char rule the product form already validates.
alter table products
  drop constraint if exists products_summary_len,
  drop constraint if exists products_colors_n,
  drop constraint if exists products_colors_len;

alter table products
  add constraint products_summary_len check (length(coalesce(summary, '')) <= 160),
  add constraint products_colors_n    check (coalesce(array_length(colors, 1), 0) <= 20),
  add constraint products_colors_len  check (text_array_len(colors) <= 400);

-- ---------------------------------------------------------------------------
-- cart_items: a colour is part of what identifies a cart line
-- ---------------------------------------------------------------------------
-- Red-M and Blue-M are two lines, not one, so colour belongs in the primary
-- key next to size. Same '' -> "not chosen" convention size uses: a nullable
-- column cannot participate in a composite PK.
alter table cart_items
  add column if not exists color text not null default '';

alter table cart_items drop constraint if exists cart_items_pkey;
alter table cart_items add primary key (user_id, product_id, size, color);

-- ---------------------------------------------------------------------------
-- order_items + the order_line composite place_order() builds rows with
-- ---------------------------------------------------------------------------
alter table order_items
  add column if not exists color text;

-- No IF NOT EXISTS for ADD ATTRIBUTE, and re-running a migration that errors
-- halfway is worse than a three-line guard.
do $$
begin
  if not exists (
    select 1
    from pg_attribute a
    join pg_type t on t.typrelid = a.attrelid
    where t.typname = 'order_line' and a.attname = 'color' and a.attnum > 0
  ) then
    alter type order_line add attribute color text;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- search_products: filter by size and colour
--
-- Arity changes (8 args -> 10), so this must be DROPped and recreated rather
-- than replaced — an added defaulted parameter would otherwise leave the 8-arg
-- version in place as an overload, and a call passing arguments by name would
-- match both and fail as ambiguous. Dropping resets the ACL to the default
-- (execute to public), so the revoke/grant at the bottom is load-bearing, not
-- ceremony. (Same trap 0023 hit with shop_directory.)
--
-- Both filters are array OVERLAP (&&), not containment: a shopper asking for
-- "M or L" wants every product available in either, not products that stock
-- both. A product with no sizes matches no size filter, which is correct — it
-- genuinely isn't available in size M.
-- ---------------------------------------------------------------------------
drop function if exists search_products(uuid, text, text, text, int, text, int, int);

create or replace function search_products(
  p_merchant_id uuid default null,   -- null = every shop (universal search)
  p_search      text default '',
  p_category    text default null,   -- null / 'All' = every category
  p_status      text default null,   -- null / 'all' | 'available' | 'low' | 'out' | 'in-stock'
  p_max_price   int  default null,   -- compared against the DISCOUNTED price
  p_sort        text default 'newest',  -- 'newest' | 'price-asc' | 'price-desc'
  p_limit       int  default 12,
  p_offset      int  default 0,
  p_sizes       text[] default null,  -- null / empty = any size
  p_colors      text[] default null   -- null / empty = any colour
)
returns table (
  id           uuid,
  merchant_id  uuid,
  name         text,
  sku          text,
  category     text,
  price_kes    integer,
  discount_pct integer,
  stock_qty    integer,
  status       stock_status,
  images       text[],
  sizes        text[],
  colors       text[],
  rating       numeric,
  review_count integer,
  summary      text,
  description  text,
  created_at   timestamptz,
  shop_handle  text,
  total_count  bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with bounds as (
    select least(greatest(coalesce(p_limit, 12), 1), 50) as lim,
           greatest(coalesce(p_offset, 0), 0)            as off
  ),
  q as (
    select nullif(btrim(coalesce(p_search, '')), '') as term
  ),
  -- What the shopper actually pays, and therefore the only price worth
  -- filtering or sorting on. discount_pct is an integer, so the /100 has to be
  -- /100.0 — integer division would silently floor every discount to 0%.
  priced as (
    select pr.*,
           round(pr.price_kes * (1 - coalesce(pr.discount_pct, 0) / 100.0))::int as eff_price
    from products pr
    where p_merchant_id is null or pr.merchant_id = p_merchant_id
  ),
  -- Referenced twice (paged rows + total), so Postgres materialises this once
  -- and both the count and the page come out of a single scan.
  matched as (
    select p.*
    from priced p, q
    where (
        q.term is null
        or p.name     ilike '%' || q.term || '%'
        or p.sku      ilike '%' || q.term || '%'
        or p.category ilike '%' || q.term || '%'
      )
      and (p_category is null or p_category = 'All' or p.category = p_category)
      and (
        p_status is null or p_status = 'all'
        or (p_status = 'in-stock' and p.status <> 'out')
        or (p_status in ('available', 'low', 'out') and p.status = p_status::stock_status)
      )
      and (p_max_price is null or p.eff_price <= p_max_price)
      and (coalesce(array_length(p_sizes,  1), 0) = 0 or p.sizes  && p_sizes)
      and (coalesce(array_length(p_colors, 1), 0) = 0 or p.colors && p_colors)
  )
  select
    m.id, m.merchant_id, m.name, m.sku, m.category,
    m.price_kes, m.discount_pct, m.stock_qty, m.status,
    m.images, m.sizes, m.colors, m.rating, m.review_count,
    m.summary, coalesce(m.description, ''), m.created_at,
    mer.handle,
    (select count(*) from matched)
  from matched m
  join merchants mer on mer.id = m.merchant_id
  order by
    case when p_sort = 'price-asc'  then m.eff_price end asc,
    case when p_sort = 'price-desc' then m.eff_price end desc,
    m.created_at desc,
    m.id
  limit  (select lim from bounds)
  offset (select off from bounds);
$$;

revoke execute on function search_products(uuid, text, text, text, int, text, int, int, text[], text[]) from public;
grant  execute on function search_products(uuid, text, text, text, int, text, int, int, text[], text[]) to anon, authenticated;

-- GIN indexes so the overlap filters don't force a seq scan once catalogues
-- grow. && is exactly what the array_ops GIN opclass is for.
create index if not exists products_sizes_gin  on products using gin (sizes);
create index if not exists products_colors_gin on products using gin (colors);

-- ---------------------------------------------------------------------------
-- shop_facets: the size and colour lists the filter UI renders
--
-- Aggregates over the WHOLE catalogue, which is the entire reason they can't be
-- derived in the browser from a page of it. Returned unsorted-by-meaning (plain
-- alphabetical) on purpose: "LG, M, SM, XL" is alphabetically correct and
-- semantically nonsense, so the client orders them against its own preset.
-- ---------------------------------------------------------------------------
create or replace function shop_facets(p_merchant_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'categories', coalesce((
      select jsonb_agg(distinct pr.category order by pr.category)
      from products pr where pr.merchant_id = p_merchant_id
    ), '[]'::jsonb),
    'sizes', coalesce((
      select jsonb_agg(distinct s order by s)
      from products pr, unnest(pr.sizes) as s
      where pr.merchant_id = p_merchant_id
    ), '[]'::jsonb),
    'colors', coalesce((
      select jsonb_agg(distinct c order by c)
      from products pr, unnest(pr.colors) as c
      where pr.merchant_id = p_merchant_id
    ), '[]'::jsonb),
    'priceCeiling', coalesce((
      select max(round(pr.price_kes * (1 - coalesce(pr.discount_pct, 0) / 100.0))::int)
      from products pr where pr.merchant_id = p_merchant_id
    ), 0),
    'total',     (select count(*) from products pr where pr.merchant_id = p_merchant_id),
    'available', (select count(*) from products pr where pr.merchant_id = p_merchant_id and pr.status = 'available'),
    'low',       (select count(*) from products pr where pr.merchant_id = p_merchant_id and pr.status = 'low'),
    'out',       (select count(*) from products pr where pr.merchant_id = p_merchant_id and pr.status = 'out')
  );
$$;

revoke execute on function shop_facets(uuid) from public;
grant  execute on function shop_facets(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- place_order: carry the chosen colour onto the order line
--
-- Signature and return type are unchanged (colour rides inside the existing
-- p_items jsonb), so create-or-replace is safe here and the 0024 grants — the
-- ones that keep this callable ONLY by service_role via the place-order Edge
-- Function — survive. They are restated at the bottom regardless, so this file
-- stands alone if replayed against a fresh database.
-- ---------------------------------------------------------------------------
create or replace function place_order(
  p_customer_name    text,
  p_customer_phone   text,
  p_customer_notes   text,
  p_channel          order_channel,
  p_payment_method   payment_method,
  -- [{ "product_id": uuid, "size": text|null, "color": text|null, "qty": int }, ...]
  p_items            jsonb,
  p_idempotency_key  uuid default null,
  -- Supplied by the Edge Function after it verifies the caller's JWT. Null for
  -- a genuine guest checkout.
  p_customer_id      uuid default null
)
returns table(order_id uuid, reference text, access_token text)
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_order_id    uuid := gen_random_uuid();
  v_reference   text;
  v_token       text := new_order_token();
  v_merchant_id uuid;
  v_subtotal    integer := 0;
  v_lines       order_line[] := '{}';
  v_line_json   jsonb;
  v_product     products%rowtype;
  v_unit        integer;
  v_qty         integer;
  v_attempts    integer := 0;
  v_existing    orders%rowtype;
begin
  -- Replay of an attempt we already completed: hand back the SAME order rather
  -- than placing a second one. Checked before any stock is touched.
  if p_idempotency_key is not null then
    select * into v_existing from orders o where o.idempotency_key = p_idempotency_key;
    if found then
      return query select v_existing.id, v_existing.reference, v_existing.access_token;
      return;
    end if;
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'order must have at least one item';
  end if;
  -- Bounds on the work one call can ask for. Nothing legitimate needs more, and
  -- without them a single request can loop over an unbounded item list.
  if jsonb_array_length(p_items) > 50 then
    raise exception 'too many items in one order';
  end if;
  if length(trim(coalesce(p_customer_name, ''))) = 0
     or length(trim(coalesce(p_customer_phone, ''))) = 0 then
    raise exception 'customer name and phone are required';
  end if;

  for v_line_json in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_line_json->>'qty')::integer;
    if v_qty is null or v_qty <= 0 then
      raise exception 'invalid quantity';
    end if;
    if v_qty > 100 then
      raise exception 'quantity too large';
    end if;

    -- FOR UPDATE: hold the row until commit so two buyers racing for the last
    -- unit cannot both pass the stock check below.
    select * into v_product from products
      where id = (v_line_json->>'product_id')::uuid
      for update;
    if not found then
      raise exception 'product not found: %', v_line_json->>'product_id';
    end if;

    if v_merchant_id is null then
      v_merchant_id := v_product.merchant_id;
    elsif v_product.merchant_id <> v_merchant_id then
      raise exception 'all items in an order must belong to the same shop';
    end if;

    if v_product.stock_qty < v_qty then
      raise exception 'insufficient stock for %', v_product.name;
    end if;

    -- The variant the buyer picked has to be one the SELLER actually offers.
    -- The client already enforces this, but the client is not a security
    -- boundary: without these two checks anyone reaching the Edge Function can
    -- order "Chartreuse" and the merchant gets an unfillable order.
    if coalesce(array_length(v_product.sizes, 1), 0) > 0
       and coalesce(v_line_json->>'size', '') <> ''
       and not (v_line_json->>'size' = any(v_product.sizes)) then
      raise exception 'size % is not available for %', v_line_json->>'size', v_product.name;
    end if;
    if coalesce(array_length(v_product.colors, 1), 0) > 0
       and coalesce(v_line_json->>'color', '') <> ''
       and not (v_line_json->>'color' = any(v_product.colors)) then
      raise exception 'color % is not available for %', v_line_json->>'color', v_product.name;
    end if;

    -- Price is recomputed from the DB, never taken from the cart the client
    -- sent. Mirrors lib/currency.ts discountedPrice() (and migration 0023).
    v_unit := case
      when v_product.discount_pct is not null
        then round(v_product.price_kes * (1 - v_product.discount_pct::numeric / 100))::integer
      else v_product.price_kes
    end;
    v_subtotal := v_subtotal + v_unit * v_qty;

    update products set stock_qty = stock_qty - v_qty where id = v_product.id;

    v_lines := v_lines || row(
      v_product.id, v_product.name, coalesce(v_product.images[1], ''),
      v_line_json->>'size', v_qty, v_unit, v_line_json->>'color'
    )::order_line;
  end loop;

  loop
    v_reference := 'PS-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 10));
    exit when not exists (select 1 from orders where orders.reference = v_reference);
    v_attempts := v_attempts + 1;
    if v_attempts > 10 then
      raise exception 'could not generate a unique order reference';
    end if;
  end loop;

  insert into orders (
    id, reference, access_token, merchant_id, customer_id, idempotency_key,
    customer_name, customer_phone, customer_notes,
    channel, payment_method, payment_status, subtotal_kes, total_kes
  ) values (
    v_order_id, v_reference, v_token, v_merchant_id, p_customer_id, p_idempotency_key,
    trim(p_customer_name), trim(p_customer_phone), coalesce(p_customer_notes, ''),
    p_channel, p_payment_method, 'pending', v_subtotal, v_subtotal
  );

  insert into order_items (order_id, product_id, product_name, image, size, color, qty, unit_price_kes)
  select v_order_id, l.product_id, l.product_name, l.image, l.size, l.color, l.qty, l.unit_price_kes
  from unnest(v_lines) as l;

  return query select v_order_id, v_reference, v_token;

exception
  -- Two genuinely simultaneous requests carrying the same key: both passed the
  -- replay check above, one won the unique index. The loser must return the
  -- winner's order, not an error — from the buyer's side this is still one tap.
  when unique_violation then
    select * into v_existing from orders o where o.idempotency_key = p_idempotency_key;
    if found then
      return query select v_existing.id, v_existing.reference, v_existing.access_token;
      return;
    end if;
    raise;
end;
$function$;

-- The browser must not be able to reach this. The Edge Function (service_role)
-- is the only caller, and it verifies a Turnstile token first.
revoke execute on function place_order(text, text, text, order_channel, payment_method, jsonb, uuid, uuid) from public, anon, authenticated;
grant  execute on function place_order(text, text, text, order_channel, payment_method, jsonb, uuid, uuid) to service_role;

-- get_order_by_token() needs no change: it projects order_items with
-- to_jsonb(oi), so the new colour column flows through on its own.
