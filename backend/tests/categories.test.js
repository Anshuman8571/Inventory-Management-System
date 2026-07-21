const request = require('supertest');
const app = require('../src/app');
const categoriesModel = require('../src/models/categories.model');
const jwt = require('jsonwebtoken');
const env = require('../src/config/env');

jest.mock('../src/models/categories.model');

// Mock auth token
const token = jwt.sign({ id: 1, email: 'test@example.com' }, env.jwtSecret, { expiresIn: '1h' });
const authHeader = { Authorization: `Bearer ${token}` };

describe('Categories API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /categories', () => {
    it('should return a list of categories with paths', async () => {
      const mockCategories = [
        { name: 'Pipe', parent_name: null },
        { name: 'Fittings', parent_name: 'Pipe' },
      ];
      categoriesModel.list.mockResolvedValue(mockCategories);

      const res = await request(app).get('/categories').set(authHeader);
      
      expect(res.status).toBe(200);
      expect(res.body.categories).toEqual([
        { name: 'Pipe', path: 'Pipe' },
        { name: 'Fittings', path: 'Pipe > Fittings' }
      ]);
      expect(categoriesModel.list).toHaveBeenCalledTimes(1);
    });
  });

  describe('POST /categories', () => {
    it('should create a new category', async () => {
      categoriesModel.findByNameCaseInsensitive.mockResolvedValue(null);
      const mockNewCategory = { name: 'Pumps', parent_name: null };
      categoriesModel.create.mockResolvedValue(mockNewCategory);
      categoriesModel.list.mockResolvedValue([mockNewCategory]);

      const res = await request(app)
        .post('/categories')
        .set(authHeader)
        .send({ name: 'Pumps' });

      expect(res.status).toBe(201);
      expect(res.body.category).toEqual({ name: 'Pumps', path: 'Pumps' });
      expect(categoriesModel.create).toHaveBeenCalledWith('Pumps', null);
    });

    it('should return 400 if name is too short', async () => {
      const res = await request(app)
        .post('/categories')
        .set(authHeader)
        .send({ name: '' });

      expect(res.status).toBe(400);
    });
  });
});
