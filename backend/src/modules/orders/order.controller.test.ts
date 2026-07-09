import request from 'supertest';
import express from 'express';
import { getOrders, updateOrderStatus } from './order.controller';
import { supabase } from '../../db/supabase';

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  res.locals.userId = 'user-123';
  next();
});
app.get('/api/orders', getOrders);
app.patch('/api/orders/:id/status', updateOrderStatus);

// 1. Clean top-level mock
jest.mock('../../db/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

describe('Orders Controller', () => {
  let mockQuery: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // 2. Initialize inside the test block
    mockQuery = {
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      then: jest.fn(),
    };

    // 3. Attach dynamically
    (supabase.from as jest.Mock).mockReturnValue(mockQuery);
  });

  describe('GET /api/orders', () => {
    it('fetches merchant orders securely', async () => {
      mockQuery.then
        .mockImplementationOnce((resolve: any) => resolve({ data: { id: 'shop-123' }, error: null }))
        .mockImplementationOnce((resolve: any) => resolve({ data: [{ id: 'order-1', status: 'pending' }], error: null }));

      const res = await request(app).get('/api/orders');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(mockQuery.eq).toHaveBeenCalledWith('products.shop_id', 'shop-123');
    });

    it('returns 404 if merchant has no shop profile', async () => {
      mockQuery.then.mockImplementationOnce((resolve: any) => resolve({ data: null, error: new Error('Not found') }));

      const res = await request(app).get('/api/orders');
      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/orders/:id/status', () => {
    it('updates status if merchant owns the order', async () => {
      mockQuery.then
        .mockImplementationOnce((resolve: any) => resolve({ data: { id: 'shop-123' }, error: null }))
        .mockImplementationOnce((resolve: any) => resolve({ data: { id: 'order-1', products: { shop_id: 'shop-123' } }, error: null }))
        .mockImplementationOnce((resolve: any) => resolve({ data: { id: 'order-1', status: 'shipped' }, error: null }));

      const res = await request(app).patch('/api/orders/order-1/status').send({ status: 'shipped' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('shipped');
      expect(mockQuery.update).toHaveBeenCalledWith({ status: 'shipped' });
    });

    it('rejects update if merchant does NOT own the order', async () => {
      mockQuery.then
        .mockImplementationOnce((resolve: any) => resolve({ data: { id: 'shop-123' }, error: null }))
        .mockImplementationOnce((resolve: any) => resolve({ data: { id: 'order-1', products: { shop_id: 'DIFFERENT-SHOP' } }, error: null }));

      const res = await request(app).patch('/api/orders/order-1/status').send({ status: 'shipped' });

      expect(res.status).toBe(403);
      expect(mockQuery.update).not.toHaveBeenCalled();
    });

    it('rejects invalid statuses', async () => {
      const res = await request(app).patch('/api/orders/order-1/status').send({ status: 'hacked-status' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid order status');
    });
  });
});