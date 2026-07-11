-- Secure per-order access keys + buyer↔order linkage.
--
-- Audit (2026-07-11): orders were fully anonymous. Nothing linked an order to
-- the shopper who placed it (no customer_id), and RLS let ONLY the receiving
-- merchant read an order — a signed-in shopper could never see their own
-- orders, and there was no safe way for a guest to look one up either. The
-- customer-facing "order history" lived only in the browser's localStorage.
--
-- This gives every order two things:
--   * customer_id  — the auth uid of the shopper who placed it (NULL for guest
--                    checkouts). Signed-in shoppers can now read exactly their
--                    own orders via RLS, and no one else's.
--   * access_token — a high-entropy unguessable secret minted per order. It is
--                    the "key" the buyer holds. get_order_by_token() returns an
--                    order only to a caller who presents the matching token, so
--                    a guest can track their order without an account and
--                    WITHOUT any other user (guest or signed-in) being able to
--                    reach it. The order reference alone is never enough.

-- ---------------------------------------------------------------------------
-- Token generator. Two UUIDs (~244 bits of entropy) hex-joined — core-only, no
-- pgcrypto/search_path dependency. Kept out of the public RPC surface: it is a
-- default-expression + place_order helper, not something clients should call.
-- ---------------------------------------------------------------------------
create or replace function new_order_token()
returns text
language sql
volatile
set search_path = public
as $$
  select replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
$$;

revoke execute on function new_order_token() from anon, authenticated, public;

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------
alter table orders
  add column if not exists customer_id  uuid references auth.users(id) on delete set null,
  add column if not exists access_token text;

-- Mint a key for every pre-existing order, then lock the column down.
update orders set access_token = new_order_token() where access_token is null;

alter table orders
  alter column access_token set default new_order_token(),
  alter column access_token set not null;

-- The token is the security boundary for guest lookups — enforce uniqueness.
create unique index if not exists orders_access_token_idx on orders(access_token);
create index if not exists orders_customer_idx on orders(customer_id);

-- ---------------------------------------------------------------------------
-- place_order: stamp the placing buyer + mint the key, and return the key.
-- The return type gains access_token, so the old function must be dropped
-- first (CREATE OR REPLACE cannot change a function's return type).
-- ---------------------------------------------------------------------------
drop function if exists place_order(text, text, text, order_channel, payment_method, jsonb);

create or replace function place_order(
  p_customer_name  text,
  p_customer_phone text,
  p_customer_notes text,
  p_channel        order_channel,
  p_payment_method payment_method,
  p_items          jsonb -- [{ "product_id": uuid, "size": text|null, "qty": int }, ...]
) returns table(order_id uuid, reference text, access_token text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id    uuid := gen_random_uuid();
  v_reference   text;
  v_token       text := new_order_token();
  v_customer_id uuid := auth.uid();  -- the signed-in shopper, or NULL for guests
  v_merchant_id uuid;
  v_subtotal    integer := 0;
  v_lines       order_line[] := '{}';
  v_line_json   jsonb;
  v_product     products%rowtype;
  v_unit        integer;
  v_qty         integer;
  v_attempts    integer := 0;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'order must have at least one item';
  end if;
  if length(trim(coalesce(p_customer_name, ''))) = 0
     or length(trim(coalesce(p_customer_phone, ''))) = 0 then
    raise exception 'customer name and phone are required';
  end if;

  -- Validate every line, lock + decrement stock, and collect snapshot rows.
  -- All items must resolve to the same merchant (the first item's shop wins).
  for v_line_json in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_line_json->>'qty')::integer;
    if v_qty is null or v_qty <= 0 then
      raise exception 'invalid quantity';
    end if;

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

    v_unit := case
      when v_product.discount_pct is not null
        then round(v_product.price_kes * (1 - v_product.discount_pct::numeric / 100))::integer
      else v_product.price_kes
    end;
    v_subtotal := v_subtotal + v_unit * v_qty;

    update products set stock_qty = stock_qty - v_qty where id = v_product.id;

    v_lines := v_lines || row(
      v_product.id, v_product.name, coalesce(v_product.images[1], ''),
      v_line_json->>'size', v_qty, v_unit
    )::order_line;
  end loop;

  -- Collision-safe reference (checked against live data, not just entropy).
  loop
    v_reference := 'PS-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 10));
    exit when not exists (select 1 from orders where orders.reference = v_reference);
    v_attempts := v_attempts + 1;
    if v_attempts > 10 then
      raise exception 'could not generate a unique order reference';
    end if;
  end loop;

  -- Orders are always created 'pending'. Only a server-side payment callback
  -- (future Daraja/PayPal webhook) or the owning merchant should ever flip
  -- payment_status to 'paid' — never the placing client.
  insert into orders (
    id, reference, access_token, merchant_id, customer_id,
    customer_name, customer_phone, customer_notes,
    channel, payment_method, payment_status, subtotal_kes, total_kes
  ) values (
    v_order_id, v_reference, v_token, v_merchant_id, v_customer_id,
    trim(p_customer_name), trim(p_customer_phone), coalesce(p_customer_notes, ''),
    p_channel, p_payment_method, 'pending', v_subtotal, v_subtotal
  );

  insert into order_items (order_id, product_id, product_name, image, size, qty, unit_price_kes)
  select v_order_id, l.product_id, l.product_name, l.image, l.size, l.qty, l.unit_price_kes
  from unnest(v_lines) as l;

  return query select v_order_id, v_reference, v_token;
end;
$$;

grant execute on function place_order(text, text, text, order_channel, payment_method, jsonb)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row-level security: a signed-in shopper reads exactly their OWN orders.
-- These are additional (permissive) SELECT policies alongside the merchant's
-- "owner read" — a user who is neither the buyer nor the seller reads nothing.
-- ---------------------------------------------------------------------------
drop policy if exists "orders customer read" on orders;
create policy "orders customer read" on orders for select
  using (customer_id is not null and customer_id = (select auth.uid()));

drop policy if exists "order_items customer read" on order_items;
create policy "order_items customer read" on order_items for select
  using (exists (
    select 1 from orders o
    where o.id = order_items.order_id
      and o.customer_id is not null
      and o.customer_id = (select auth.uid())
  ));

-- ---------------------------------------------------------------------------
-- Guest order lookup by secret key. Returns an order (minus its internal ids
-- and the secret itself) ONLY when BOTH the reference and the access token
-- match — the reference alone is never enough, so orders can't be enumerated.
-- security definer so it can read past RLS, but it only ever exposes the one
-- order whose token the caller already holds.
-- ---------------------------------------------------------------------------
create or replace function get_order_by_token(p_reference text, p_access_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  -- Cheap guards: a too-short token can't be a real 64-char key.
  if p_reference is null or p_access_token is null or length(p_access_token) < 32 then
    return null;
  end if;

  select (to_jsonb(o) - 'access_token' - 'merchant_id' - 'customer_id')
         || jsonb_build_object('items', coalesce(li.arr, '[]'::jsonb))
    into v_result
  from orders o
  left join lateral (
    select jsonb_agg(to_jsonb(oi) - 'id' - 'order_id' - 'product_id' order by oi.id) as arr
    from order_items oi
    where oi.order_id = o.id
  ) li on true
  where o.reference = p_reference
    and o.access_token = p_access_token;

  return v_result;  -- NULL when reference/token don't match a real order
end;
$$;

grant execute on function get_order_by_token(text, text) to anon, authenticated;
