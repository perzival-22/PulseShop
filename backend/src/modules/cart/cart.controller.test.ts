import request from 'supertest';
import express from 'express';
import { getCart, addToCart } from './cart.controller';
import { supabase } from '../../db/supabase';

const app = express();
app.use(express.json());
// Mock auth guard
app.use((req, res, next) => { res.locals.userId = 'user-123'; next(); });
app.get('/api/cart', getCart);
app.post('/api/cart', addToCart);

const mockQuery = {
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn().mockReturnThis(),
  then: jest.fn(),
};

jest.mock('../../db/supabase', () => ({ supabase: { from: jest.fn() } }));

describe('Cart Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (supabase.from as jest.Mock).mockReturnValue(mockQuery);
  });

  it('fetches multi-merchant cart items seamlessly', async () => {
    const mockCart = [{ id: 1, quantity: 2, products: { name: 'Shoes', shops: { name: 'Nike' } } }];
    mockQuery.then.mockImplementationOnce((res: any) => res({ data: mockCart, error: null }));

    const res = await request(app).get('/api/cart');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockCart);
  });

  it('creates a new cart item if it does not exist', async () => {
    // 1st query: check if exists (returns null). 2nd query: insert.
    mockQuery.then
      .mockImplementationOnce((res: any) => res({ data: null, error: null }))
      .mockImplementationOnce((res: any) => res({ data: { id: 1, quantity: 1 }, error: null }));

    const res = await request(app).post('/api/cart').send({ productId: 'prod-1', quantity: 1 });
    expect(res.status).toBe(201);
    expect(mockQuery.insert).toHaveBeenCalledWith({ user_id: 'user-123', product_id: 'prod-1', quantity: 1 });
  });

  it('upserts (adds to) quantity if item already exists in cart', async () => {
    // 1st query: check if exists (returns existing item with qty 2). 2nd query: update to qty 3.
    mockQuery.then
      .mockImplementationOnce((res: any) => res({ data: { id: 1, quantity: 2 }, error: null }))
      .mockImplementationOnce((res: any) => res({ data: { id: 1, quantity: 3 }, error: null }));

    const res = await request(app).post('/api/cart').send({ productId: 'prod-1', quantity: 1 });
    expect(res.status).toBe(200);
    expect(mockQuery.update).toHaveBeenCalledWith({ quantity: 3 });
  });
});