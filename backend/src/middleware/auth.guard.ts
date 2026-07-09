import { Request, Response, NextFunction } from 'express';
import { supabase } from '../db/supabase';

export const requireMerchantAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.split(' ')[1];
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    res.status(401).json({ error: 'Unauthorized: Invalid token' });
    return;
  }

  // Attach authenticated user ID to locals for downstream controllers to use
  res.locals.userId = data.user.id;
  next();
};