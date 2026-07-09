import request from 'supertest';
import express from 'express';
import merchantRoutes from './merchant.routes';
import { supabase } from '../../db/supabase';

const app = express();
app.use(express.json());
app.use('/api/merchant', merchantRoutes);

jest.mock('../../db/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(),
  },
}));

describe('Merchant Controller', () => {
  const mockUserId = 'user-123';
  const mockToken = 'Bearer valid-jwt-token';
  let mockQuery: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Flattened the mock chain so ALL Supabase methods are tracked securely on this single object
    mockQuery = {
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      then: jest.fn(),
    };

    (supabase.from as jest.Mock).mockReturnValue(mockQuery);
  });

  describe('Auth Guard Middleware', () => {
    it('rejects requests without a token', async () => {
      const res = await request(app).get('/api/merchant/profile');
      expect(res.status).toBe(401);
    });

    it('rejects requests with an invalid token', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: null }, error: new Error('Bad token') });
      const res = await request(app).get('/api/merchant/profile').set('Authorization', 'Bearer bad-token');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/merchant/profile', () => {
    it('returns the merchant profile securely', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: mockUserId } }, error: null });
      
      const mockProfile = { id: 'shop-1', name: 'Test Shop', handle: 'testshop', avatarUrl: 'url' };
      mockQuery.then.mockImplementation((resolve: any) => resolve({ data: mockProfile, error: null }));

      const res = await request(app).get('/api/merchant/profile').set('Authorization', mockToken);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockProfile);
    });
  });

  describe('GET /api/merchant/inventory', () => {
    it('returns tenant-scoped products', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: mockUserId } }, error: null });
      
      mockQuery.then
        .mockImplementationOnce((resolve: any) => resolve({ data: { id: 'shop-1' }, error: null }))
        .mockImplementationOnce((resolve: any) => resolve({ data: [{ id: 'prod-1', name: 'Item 1' }], error: null }));

      const res = await request(app).get('/api/merchant/inventory').set('Authorization', mockToken);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });
  });

  describe('POST /api/merchant/products', () => {
    it('successfully adds a product to the merchant shop', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: mockUserId } }, error: null });
      
      const newProductPayload = { name: 'New Kicks', price: 150.00, stock: 10 };
      const createdProduct = { id: 'prod-123', shop_id: 'shop-1', ...newProductPayload };

      mockQuery.then
        .mockImplementationOnce((resolve: any) => resolve({ data: { id: 'shop-1' }, error: null }))
        .mockImplementationOnce((resolve: any) => resolve({ data: createdProduct, error: null }));

      const res = await request(app)
        .post('/api/merchant/products')
        .set('Authorization', mockToken)
        .send(newProductPayload);

      expect(res.status).toBe(201);
      expect(res.body).toEqual(createdProduct);
      
      // Now the tracking works perfectly
      expect(mockQuery.insert).toHaveBeenCalledWith(expect.objectContaining({
        shop_id: 'shop-1',
        name: 'New Kicks',
        price: 150,
        stock: 10
      }));
    });

    it('rejects missing or invalid numeric data', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: mockUserId } }, error: null });
      
      const res1 = await request(app).post('/api/merchant/products').set('Authorization', mockToken)
        .send({ name: 'Item', price: -5, stock: 10 });
      expect(res1.status).toBe(400);

      const res2 = await request(app).post('/api/merchant/products').set('Authorization', mockToken)
        .send({ price: 10, stock: 10 });
      expect(res2.status).toBe(400);
    });

    it('returns 404 if merchant has no shop profile configured', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: mockUserId } }, error: null });
      
      mockQuery.then.mockImplementationOnce((resolve: any) => resolve({ data: null, error: new Error('Not found') }));

      const res = await request(app)
        .post('/api/merchant/products')
        .set('Authorization', mockToken)
        .send({ name: 'Valid Item', price: 10, stock: 5 });

      expect(res.status).toBe(404);
      expect(mockQuery.insert).not.toHaveBeenCalled();
    });
  });
});