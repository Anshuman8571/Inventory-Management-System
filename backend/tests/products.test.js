const request = require('supertest');
const app = require('../src/app');
const productsModel = require('../src/models/products.model');
const jwt = require('jsonwebtoken');
const env = require('../src/config/env');

jest.mock('../src/models/products.model');

// Mock auth token
const token = jwt.sign({ id: 1, email: 'test@example.com' }, env.jwtSecret, { expiresIn: '1h' });
const authHeader = { Authorization: `Bearer ${token}` };

describe('Products API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /products', () => {
    it('should return a list of products', async () => {
      const mockProducts = [
        { id: 1, name: 'Product A', category: 'Pipe', current_qty: 10 },
        { id: 2, name: 'Product B', category: 'Pipe', current_qty: 20 },
      ];
      productsModel.list.mockResolvedValue(mockProducts);

      const res = await request(app).get('/products').set(authHeader);
      
      expect(res.status).toBe(200);
      expect(res.body.products).toEqual(mockProducts);
      expect(productsModel.list).toHaveBeenCalledTimes(1);
    });
  });

  describe('PATCH /products/:id', () => {
    it('should update a product and return the updated product', async () => {
      const mockExisting = { id: 1, name: 'Old Name' };
      const mockUpdated = { id: 1, name: 'New Name' };
      
      productsModel.findById.mockResolvedValue(mockExisting);
      productsModel.update.mockResolvedValue(mockUpdated);

      const res = await request(app)
        .patch('/products/1')
        .set(authHeader)
        .send({ name: 'New Name' });

      expect(res.status).toBe(200);
      expect(res.body.product).toEqual(mockUpdated);
      expect(productsModel.update).toHaveBeenCalledWith(1, { name: 'New Name' });
    });

    it('should return 404 if product does not exist', async () => {
      productsModel.findById.mockResolvedValue(null);

      const res = await request(app)
        .patch('/products/999')
        .set(authHeader)
        .send({ name: 'New Name' });

      expect(res.status).toBe(404);
    });

    it('should return 400 if validation fails', async () => {
      const res = await request(app)
        .patch('/products/1')
        .set(authHeader)
        .send({ lowStockAt: -5 }); // Invalid negative value

      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /products/:id', () => {
    it('should soft delete a product', async () => {
      const mockExisting = { id: 1, name: 'Product A' };
      productsModel.findById.mockResolvedValue(mockExisting);
      productsModel.softDelete.mockResolvedValue(mockExisting);

      const res = await request(app).delete('/products/1').set(authHeader);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(productsModel.softDelete).toHaveBeenCalledWith(1);
    });
  });
});
