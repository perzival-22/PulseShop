-- Colour -> photo matching: when a buyer picks a colour, show the photo the
-- seller took of THAT colour, instead of always starting the gallery at
-- image 1 regardless of which variant is selected.
--
-- Stored as a jsonb map from colour name to one of the product's own `images`
-- URLs, same convention as size_price_adj/color_price_adj (0027): keyed by the
-- name in products.colors, a missing key just means "not matched" and costs
-- nothing extra to store. No colour picked = no entry = the gallery falls
-- back to its normal first-image order.
--
-- Deliberately no foreign-key-style check that the URL is one of `images` —
-- jsonb has no way to express that as a CHECK, and the seller-side UI only
-- ever offers photos already in the product's own gallery, so this is a UI
-- invariant, not a data-integrity one worth enforcing twice.

alter table products
  add column if not exists color_images jsonb not null default '{}'::jsonb;

-- Shape guard mirroring jsonb_int_map_ok (0027): an object of colour name ->
-- URL string, capped the same way size/colour lists themselves are (0026).
create or replace function jsonb_text_map_ok(
  p_map jsonb, p_max_len int, p_max_entries int
) returns boolean
language sql immutable
set search_path = public
as $$
  select p_map is null or (
    jsonb_typeof(p_map) = 'object'
    and (select count(*) from jsonb_object_keys(p_map)) <= p_max_entries
    and not exists (
      select 1
      from jsonb_each_text(p_map) e
      where length(e.value) > p_max_len
    )
  );
$$;

alter table products drop constraint if exists products_color_images_ok;

alter table products
  add constraint products_color_images_ok
    check (jsonb_text_map_ok(color_images, 2048, 20));

-- ---------------------------------------------------------------------------
-- search_products: carry color_images through so the merchant's own product
-- list (InventoryPage, via listProducts) still has it when a product is
-- reopened for editing — without this the edit form would load with the
-- mapping missing and silently wipe it on the next save.
--
-- Return type changes, so DROP + CREATE (same trap as 0026/0027) — the
-- revoke/grant below is load-bearing, not ceremony.
-- ---------------------------------------------------------------------------
drop function if exists search_products(uuid, text, text, text, int, text, int, int, text[], text[]);

create or replace function search_products(
  p_merchant_id uuid default null,   -- null = every shop (universal search)
  p_search      text default '',
  p_category    text default null,   -- null / 'All' = every category
  p_status      text default null,   -- null / 'all' | 'available' | 'low' | 'out' | 'in-stock'
  p_max_price   int  default null,   -- compared against the LOWEST variant price
  p_sort        text default 'newest',  -- 'newest' | 'price-asc' | 'price-desc'
  p_limit       int  default 12,
  p_offset      int  default 0,
  p_sizes       text[] default null,  -- null / empty = any size
  p_colors      text[] default null   -- null / empty = any colour
)
returns table (
  id              uuid,
  merchant_id     uuid,
  name            text,
  sku             text,
  category        text,
  price_kes       integer,
  discount_pct    integer,
  stock_qty       integer,
  status          stock_status,
  images          text[],
  sizes           text[],
  colors          text[],
  size_price_adj  jsonb,
  color_price_adj jsonb,
  color_images    jsonb,
  rating          numeric,
  review_count    integer,
  summary         text,
  description     text,
  created_at      timestamptz,
  shop_handle     text,
  total_count     bigint
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
  priced as (
    select pr.*,
           effective_price(
             pr.price_kes,
             pr.discount_pct,
             variant_min_adj(pr.size_price_adj,  pr.sizes)
           + variant_min_adj(pr.color_price_adj, pr.colors)
           ) as eff_price
    from products pr
    where p_merchant_id is null or pr.merchant_id = p_merchant_id
  ),
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
    m.images, m.sizes, m.colors, m.size_price_adj, m.color_price_adj, m.color_images,
    m.rating, m.review_count,
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
