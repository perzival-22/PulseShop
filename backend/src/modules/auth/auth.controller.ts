import { Request, Response } from 'express';
import { supabase } from '../../db/supabase';

export const loginUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
      res.status(401).json({ error: error.message });
      return;
    }

    res.status(200).json({ session: data.session, user: data.user });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};