import { Request, Response } from 'express';
import { supabase } from '../../db/supabase';

export const getCart = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = res.locals.userId;
    
    // Fetch cart items and automatically join the product and shop details
    const { data, error } = await supabase
      .from('cart_items')
      .select(`
        id, quantity,
        products ( id, name, price, stock, shops ( id, name ) )
      `)
      .eq('user_id', userId);

    if (error) throw error;
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const addToCart = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = res.locals.userId;
    const { productId, quantity } = req.body;

    if (!productId || quantity <= 0) {
      res.status(400).json({ error: 'Invalid product or quantity' }); return;
    }

    // 1. Upsert logic: If item exists in cart, add to quantity. Otherwise, create new cart item.
    const { data: existingItem } = await supabase
      .from('cart_items')
      .select('id, quantity')
      .eq('user_id', userId)
      .eq('product_id', productId)
      .single();

    if (existingItem) {
      const { data, error } = await supabase
        .from('cart_items')
        .update({ quantity: existingItem.quantity + quantity })
        .eq('id', existingItem.id)
        .select()
        .single();
      
      if (error) throw error;
      res.status(200).json(data);
    } else {
      const { data, error } = await supabase
        .from('cart_items')
        .insert({ user_id: userId, product_id: productId, quantity })
        .select()
        .single();
      
      if (error) throw error;
      res.status(201).json(data);
    }
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};