-- Create an RPC function to handle guest checkout with multi-vendor support
CREATE OR REPLACE FUNCTION place_guest_order(
    p_customer_name TEXT,
    p_customer_phone TEXT,
    p_customer_notes TEXT,
    p_channel order_channel,
    p_payment_method payment_method,
    p_items JSONB -- Array of items: [{product_id, qty, size}]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with elevated permissions to bypass RLS checks during creation
AS $$
DECLARE
    v_item JSONB;
    v_product_id UUID;
    v_qty INT;
    v_size TEXT;
    
    v_product_record RECORD;
    v_merchant_id UUID;
    v_order_id UUID;
    v_reference TEXT;
    
    v_subtotal INT := 0;
    v_total INT := 0;
    
    v_created_order_ids JSONB := '[]'::jsonb;
BEGIN
    -- 1. STAGE ONE: Verify Stock and Lock Rows to Prevent Race Conditions
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_product_id := (v_item->>'product_id')::uuid;
        v_qty := (v_item->>'qty')::int;

        -- Row lock the product row immediately to prevent simultaneous double-selling
        SELECT id, merchant_id, name, price_kes, stock_qty, images 
        INTO v_product_record 
        FROM products 
        WHERE id = v_product_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Product with ID % not found', v_product_id;
        END IF;

        IF v_product_record.stock_qty < v_qty THEN
            RAISE EXCEPTION 'OUT_OF_STOCK: Product "%" only has % units left', v_product_record.name, v_product_record.stock_qty;
        END IF;
    END LOOP;

    -- 2. STAGE TWO: Group by Merchant and Create Orders
    -- We extract unique merchant IDs from the items sent to us
    FOR v_merchant_id IN 
        SELECT DISTINCT (p.merchant_id) 
        FROM jsonb_array_elements(p_items) AS i
        JOIN products p ON p.id = (i->>'product_id')::uuid
    LOOP
        -- Generate a unique order reference prefixing 'PS-' (PulseShop)
        v_reference := 'PS-' || upper(substring(md5(random()::text) from 1 for 8));

        -- Calculate financial totals for this specific merchant's items
        SELECT 
            coalesce(sum((p.price_kes * (i->>'qty')::int)), 0)
        INTO v_subtotal
        FROM jsonb_array_elements(p_items) AS i
        JOIN products p ON p.id = (i->>'product_id')::uuid
        WHERE p.merchant_id = v_merchant_id;

        v_total := v_subtotal; -- Expand here if you ever introduce tax, shipping or discount processing

        -- Insert the Order Header record
        INSERT INTO orders (
            reference, merchant_id, customer_name, customer_phone, 
            customer_notes, channel, payment_method, payment_status, 
            subtotal_kes, total_kes
        ) VALUES (
            v_reference, v_merchant_id, p_customer_name, p_customer_phone, 
            p_customer_notes, p_channel, p_payment_method, 'pending', 
            v_subtotal, v_total
        ) RETURNING id INTO v_order_id;

        -- Keep track of all generated Order references to return to frontend
        v_created_order_ids := v_created_order_ids || jsonb_build_object('merchant_id', v_merchant_id, 'reference', v_reference);

        -- Insert the individual lines into order_items and update inventory counts
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
            v_product_id := (v_item->>'product_id')::uuid;
            v_qty := (v_item->>'qty')::int;
            v_size := v_item->>'size';

            -- Re-fetch the product details safely matching this specific merchant loop iteration
            SELECT * INTO v_product_record FROM products WHERE id = v_product_id AND merchant_id = v_merchant_id;

            IF FOUND THEN
                -- Drop item row snapshot into line ledger
                INSERT INTO order_items (
                    order_id, product_id, product_name, image, size, qty, unit_price_kes
                ) VALUES (
                    v_order_id, v_product_id, v_product_record.name, 
                    coalesce(v_product_record.images[1], ''), -- store primary image snapshot
                    v_size, v_qty, v_product_record.price_kes
                );

                -- Deduct inventory count safely
                UPDATE products 
                SET stock_qty = stock_qty - v_qty 
                WHERE id = v_product_id;
            END IF;
        END LOOP;
    END LOOP;

    -- Return full receipt map cleanly back up to client caller
    RETURN jsonb_build_object(
        'success', true,
        'orders', v_created_order_ids
    );
END;
$$;