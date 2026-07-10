ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shoppers manage own cart" ON cart_items FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Shoppers view own orders" ON orders FOR SELECT USING (auth.uid() = user_id);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view products" ON products FOR SELECT USING (true);