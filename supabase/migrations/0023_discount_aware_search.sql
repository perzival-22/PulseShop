-- Two changes, one file, because both rewrite search_products().
--
-- 1. DISCOUNTS WERE INVISIBLE TO THE FILTER AND THE SORT.
--
--    Every surface that shows a price to a shopper shows the DISCOUNTED price
--    (lib/currency.ts discountedPrice, on the card, the detail page, the cart
--    and the order line). Search did not: `p_max_price` compared against the
--    pre-discount `price_kes`, and 'price-asc'/'price-desc' ordered by it too.
--
--    So a KES 5,000 jacket at -50% displays as KES 2,500, and then a
--    "under KES 3,000" filter hides it — the shopper is filtering on a number
--    the app never showed them. Same for the sort: the grid claimed to be
--    ordered by price while visibly not being.
--
--    The effective price is now computed once per row and is what the filter
--    and both price sorts use. The expression mirrors discountedPrice()
--    exactly, including the rounding: round() and Math.round() agree on
--    positive halves, so the number the shopper filters on is the number they
--    were shown, to the shilling.
--
-- 2. PLATFORM-WIDE PRODUCT SEARCH.
--
--    p_merchant_id becomes optional. Null = search every shop's catalogue,
--    which is what the universal search on /shops needs; passing an id keeps
--    the existing shop-scoped behaviour byte for byte. Still security invoker,
--    so `products public read` (using (true)) is what authorises the rows —
--    a null merchant id widens the search, it does not bypass RLS.

create or replace function search_products(
  p_merchant_id uuid default null,   -- null = every shop (universal search)
  p_search      text default '',
  p_category    text default null,   -- null / 'All' = every category
  p_status      text default null,   -- null / 'all' | 'available' | 'low' | 'out' | 'in-stock'
  p_max_price   int  default null,   -- compared against the DISCOUNTED price
  p_sort        text default 'newest',  -- 'newest' | 'price-asc' | 'price-desc'
  p_limit       int  default 12,
  p_offset      int  default 0
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
  rating       numeric,
  review_count integer,
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
  )
  select
    m.id, m.merchant_id, m.name, m.sku, m.category,
    m.price_kes, m.discount_pct, m.stock_qty, m.status,
    m.images, m.sizes, m.rating, m.review_count,
    coalesce(m.description, ''), m.created_at,
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

-- Signature is unchanged (create or replace preserves the 0022 grants), but
-- restate them so this file stands alone if replayed against a fresh database.
revoke execute on function search_products(uuid, text, text, text, int, text, int, int) from public;
grant  execute on function search_products(uuid, text, text, text, int, text, int, int) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- The price ceiling drives the storefront's "up to KES X" slider, whose value
-- is fed straight back in as p_max_price. It has to be measured in the same
-- currency the filter compares against — the discounted one — or the top of the
-- slider silently excludes the shop's most expensive item.
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
-- Searchable shop directory.
--
-- /shops gains a universal search: one field that looks for shops AND products
-- across the whole platform. Products come from search_products() with a null
-- merchant id (above); shops come from here.
--
-- Arity changes (2 args -> 3), so this has to be dropped and recreated rather
-- than replaced — an added defaulted parameter would otherwise leave the old
-- 2-arg function in place as an overload, and a call passing p_limit/p_offset
-- by name would match both and fail as ambiguous. Dropping resets the ACL to
-- the default (execute to public), so the revoke/grant below is load-bearing,
-- not ceremony.
-- ---------------------------------------------------------------------------
drop function if exists shop_directory(int, int);

create or replace function shop_directory(
  p_limit  int  default 20,
  p_offset int  default 0,
  p_search text default ''   -- '' / null = the whole directory, unfiltered
)
returns table (
  id             uuid,
  name           text,
  handle         text,
  bio            text,
  location       text,
  avatar_url     text,
  banner_url     text,
  is_online      boolean,
  whatsapp       text,
  instagram      text,
  facebook       text,
  product_count  bigint,
  order_count    bigint,
  follower_count bigint,
  avg_rating     numeric,
  previews       jsonb,
  total_count    bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with bounds as (
    -- Clamp so a caller can't ask for the whole table with shop_directory(999999).
    select least(greatest(coalesce(p_limit, 20), 1), 50) as lim,
           greatest(coalesce(p_offset, 0), 0)            as off
  ),
  q as (
    select nullif(btrim(coalesce(p_search, '')), '') as term
  ),
  -- Bound parameter, never string-concatenated into a filter expression — same
  -- reasoning as search_products (see 0022): the term is data, not syntax.
  matched as (
    select m.*
    from merchants m, q
    where q.term is null
      or m.name     ilike '%' || q.term || '%'
      or m.handle   ilike '%' || q.term || '%'
      or m.bio      ilike '%' || q.term || '%'
      or m.location ilike '%' || q.term || '%'
  ),
  page as (
    select mt.*
    from matched mt
    order by mt.created_at desc, mt.id
    limit  (select lim from bounds)
    offset (select off from bounds)
  )
  select
    p.id,
    p.name,
    p.handle,
    coalesce(p.bio, ''),
    coalesce(p.location, ''),
    coalesce(p.avatar_url, ''),
    coalesce(p.banner_url, ''),
    p.is_online,
    coalesce(p.whatsapp, ''),
    coalesce(p.instagram, ''),
    coalesce(p.facebook, ''),
    coalesce(pc.cnt, 0),
    coalesce(oc.cnt, 0),
    coalesce(fc.cnt, 0),
    coalesce(pc.avg_rating, 0),
    coalesce(pv.previews, '[]'::jsonb),
    -- The size of the FILTERED set: it drives "load more", which would keep
    -- offering another page forever if it counted the whole merchants table.
    (select count(*) from matched)
  from page p
  -- Product count and the review-count-weighted rating average in one pass.
  left join lateral (
    select count(*) as cnt,
           round(sum(pr.rating * pr.review_count) / nullif(sum(pr.review_count), 0), 1) as avg_rating
    from products pr
    where pr.merchant_id = p.id
  ) pc on true
  left join lateral (
    select count(*) as cnt from orders o where o.merchant_id = p.id
  ) oc on true
  left join lateral (
    select count(*) as cnt from follows f where f.merchant_id = p.id
  ) fc on true
  -- The 3 newest products that actually have an image, as [{id, name, image}].
  left join lateral (
    select jsonb_agg(
             jsonb_build_object('id', t.id, 'name', t.name, 'image', t.image)
             order by t.created_at desc
           ) as previews
    from (
      select pr.id, pr.name, pr.images[1] as image, pr.created_at
      from products pr
      where pr.merchant_id = p.id
        and coalesce(array_length(pr.images, 1), 0) > 0
      order by pr.created_at desc
      limit 3
    ) t
  ) pv on true
  order by p.created_at desc, p.id;
$$;

revoke execute on function shop_directory(int, int, text) from public;
grant  execute on function shop_directory(int, int, text) to anon, authenticated;
