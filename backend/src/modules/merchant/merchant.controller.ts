import { Request, Response } from 'express';
import { supabase } from '../../db/supabase';

export const getMerchantProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = res.locals.userId;

    const { data, error } = await supabase
      .from('shops')
      .select('id, name, handle, avatarUrl:avatar_url')
      .eq('owner_id', userId)
      .single();

    if (error) throw error;

    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getMerchantInventory = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = res.locals.userId;

    // 1. Identify the merchant's specific shop
    const { data: shop, error: shopError } = await supabase
      .from('shops')
      .select('id')
      .eq('owner_id', userId)
      .single();

    if (shopError || !shop) {
      res.status(404).json({ error: 'Merchant shop profile not found' });
      return;
    }

    // 2. Fetch products strictly scoped to this specific shop
    const { data: products, error: productError } = await supabase
      .from('products')
      .select('*')
      .eq('shop_id', shop.id)
      .order('created_at', { ascending: false });

    if (productError) throw productError;

    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const onboardMerchant = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = res.locals.userId;
    const { shopName, socialLink } = req.body;

    if (!shopName || !socialLink) {
      res.status(400).json({ error: 'Shop name and social link are required' });
      return;
    }

    let baseHandle = extractSocialHandle(socialLink);
    if (!baseHandle) {
      baseHandle = 'shop'; // Fallback if parsing results in an empty string
    }

    let isUnique = false;
    let finalHandle = baseHandle;
    let attempt = 0;

    // Loop to ensure the handle is unique in the database
    while (!isUnique && attempt < 5) {
      const { data: existingShop } = await supabase
        .from('shops')
        .select('id')
        .eq('handle', finalHandle)
        .single();

      if (!existingShop) {
        isUnique = true;
      } else {
        // If taken, append a random 4-digit number and try again (e.g., my_store_8492)
        attempt++;
        finalHandle = `${baseHandle}_${Math.floor(1000 + Math.random() * 9000)}`;
      }
    }

    if (!isUnique) {
      res.status(409).json({ error: 'Could not generate a unique store handle. Please try a different link.' });
      return;
    }

    // Insert the new shop profile
    const { data: newShop, error: insertError } = await supabase
      .from('shops')
      .insert({
        owner_id: userId,
        name: shopName,
        handle: finalHandle,
      })
      .select('id, name, handle')
      .single();

    if (insertError) throw insertError;

    // Return the generated frontend URL to the client
    const storeUrl = `https://pulseshop.com/${newShop.handle}`;

    res.status(201).json({
      message: 'Store created successfully',
      shop: newShop,
      storeUrl: storeUrl
    });
  } catch (error) {
    console.error('Onboarding error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const addProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = res.locals.userId;
    const { name, price, stock, description } = req.body;

    // 1. Strict input validation
    if (!name || typeof price !== 'number' || price < 0 || typeof stock !== 'number' || stock < 0) {
      res.status(400).json({ error: 'Invalid product data: Name is required, price and stock must be non-negative numbers.' });
      return;
    }

    // 2. Fetch the merchant's specific shop ID
    const { data: shop, error: shopError } = await supabase
      .from('shops')
      .select('id')
      .eq('owner_id', userId)
      .single();

    if (shopError || !shop) {
      res.status(404).json({ error: 'Merchant shop profile not found. Please complete onboarding.' });
      return;
    }

    // 3. Insert the new product securely tied to their shop
    const { data: newProduct, error: insertError } = await supabase
      .from('products')
      .insert({
        shop_id: shop.id,
        name: name.trim(),
        price,
        stock,
        // Optional field handling
        ...(description && { description: description.trim() }) 
      })
      .select()
      .single();

    if (insertError) throw insertError;

    res.status(201).json(newProduct);
  } catch (error) {
    console.error('Error adding product:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};