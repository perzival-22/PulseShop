import { Request, Response } from 'express';
import { supabase } from '../../db/supabase';

// Helper to reliably get the merchant's shop ID
async function getMerchantShopId(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('shops')
    .select('id')
    .eq('owner_id', userId)
    .single();
  return error || !data ? null : data.id;
}

export const getOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = res.locals.userId;
    const shopId = await getMerchantShopId(userId);

    if (!shopId) {
      res.status(404).json({ error: 'Merchant shop profile not found' });
      return;
    }

    // Use PostgREST inner join to filter orders by the nested product's shop_id
    const { data, error } = await supabase
      .from('orders')
      .select('id, quantity, status, created_at, products!inner(id, name, price, shop_id)')
      .eq('products.shop_id', shopId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const updateOrderStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = res.locals.userId;
    const { id: orderId } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({ error: 'Invalid order status' });
      return;
    }

    const shopId = await getMerchantShopId(userId);
    if (!shopId) {
      res.status(404).json({ error: 'Merchant shop profile not found' });
      return;
    }

    // 1. Verify the order actually belongs to this merchant's shop
    const { data: orderMeta, error: verifyError } = await supabase
      .from('orders')
      .select('id, products!inner(shop_id)')
      .eq('id', orderId)
      .single();

    if (verifyError || !orderMeta) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    // @ts-ignore - Supabase types for nested arrays/objects can be strict, we bypass for the manual check
    const orderShopId = Array.isArray(orderMeta.products) ? orderMeta.products[0].shop_id : orderMeta.products.shop_id;
    
    if (orderShopId !== shopId) {
      res.status(403).json({ error: 'Forbidden: Order does not belong to your shop' });
      return;
    }

    // 2. Perform the update
    const { data, error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', orderId)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};