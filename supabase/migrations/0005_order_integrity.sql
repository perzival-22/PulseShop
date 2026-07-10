-- Order integrity: atomic order creation, server-generated references,
-- stock decrement, single-shop enforcement, and locked-down direct writes.
--
-- Fixes (see AUDIT.md §1.3, §2):
--  - Anyone could INSERT an order directly with client-chosen payment_status
--    ('paid') and arbitrary totals. Direct client inserts on orders/order_items
--    are removed; the only way to create an order is via place_order(), which
--    always creates it 'pending' and recomputes prices server-side.
--  - Header + items were written as two separate inserts (partial-failure risk).
--    place_order() does both in one transaction.
--  - stock_qty was never decremented on order placement.
--  - makeRef() collisions were possible (Date.now + 2 random digits); the
--    reference is now generated and uniqueness-checked server-side.
--  - submitCartOrder trusted items[0].merchant_id without checking the rest of
--    the cart belonged to the same shop; place_order derives the merchant from
--    the first product row and rejects any item that belongs to another shop.

create type order_line as (
  product_id     uuid,
  product_name   text,
  image          text,
  size           text,
  qty            integer,
  unit_price_kes integer
);

create or replace function place_order(
  p_customer_name  text,
  p_customer_phone text,
  p_customer_notes text,
  p_channel        order_channel,
  p_payment_method payment_method,
  p_items          jsonb -- [{ "product_id": uuid, "size": text|null, "qty": int }, ...]
) returns table(order_id uuid, reference text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id   uuid := gen_random_uuid();
  v_reference  text;
  v_merchant_id uuid;
  v_subtotal   integer := 0;
  v_lines      order_line[] := '{}';
  v_line_json  jsonb;
  v_product    products%rowtype;
  v_unit       integer;
  v_qty        integer;
  v_attempts   integer := 0;
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
    exit when not exists (select 1 from orders where reference = v_reference);
    v_attempts := v_attempts + 1;
    if v_attempts > 10 then
      raise exception 'could not generate a unique order reference';
    end if;
  end loop;

  -- Orders are always created 'pending'. Only a server-side payment callback
  -- (future Daraja/PayPal webhook) or the owning merchant should ever flip
  -- payment_status to 'paid' — never the placing client.
  insert into orders (
    id, reference, merchant_id, customer_name, customer_phone, customer_notes,
    channel, payment_method, payment_status, subtotal_kes, total_kes
  ) values (
    v_order_id, v_reference, v_merchant_id, trim(p_customer_name), trim(p_customer_phone),
    coalesce(p_customer_notes, ''), p_channel, p_payment_method, 'pending', v_subtotal, v_subtotal
  );

  insert into order_items (order_id, product_id, product_name, image, size, qty, unit_price_kes)
  select v_order_id, l.product_id, l.product_name, l.image, l.size, l.qty, l.unit_price_kes
  from unnest(v_lines) as l;

  return query select v_order_id, v_reference;
end;
$$;

grant execute on function place_order(text, text, text, order_channel, payment_method, jsonb)
  to anon, authenticated;

-- Direct table writes are no longer how orders get created — place_order()
-- (security definer) is the only path, so drop the wide-open insert policies.
drop policy if exists "orders public insert" on orders;
drop policy if exists "order_items public insert" on order_items;

-- ---------------------------------------------------------------------------
-- Public order-count stat without exposing customer PII.
-- merchantStats() previously did a plain `select count(*) from orders where
-- merchant_id = X`, which RLS ("orders owner read") silently zeroes out for
-- anyone who isn't that merchant — the public storefront's Orders stat always
-- read 0. This returns just the count, bypassing RLS, leaking nothing else.
-- ---------------------------------------------------------------------------
create or replace function merchant_order_count(p_merchant_id uuid)
returns bigint
language sql
security definer
set search_path = public
as $$
  select count(*) from orders where merchant_id = p_merchant_id;
$$;

grant execute on function merchant_order_count(uuid) to anon, authenticated;
