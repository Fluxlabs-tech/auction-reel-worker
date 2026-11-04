import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../src/app';
import { env } from '../../src/config/env';

describe('Admin API Endpoints', () => {
  const app = createApp();
  const validToken = jwt.sign({ role: 'admin' }, env.ADMIN_JWT_SECRET);

  describe('GET /health', () => {
    it('should return 200 or 503 with healthy status structure', async () => {
      const res = await request(app).get('/health');
      expect([200, 503]).toContain(res.status);
      expect(res.body).toHaveProperty('status');
      expect(res.body).toHaveProperty('timestamp');
    });
  });

  describe('GET /streams/:id', () => {
    it('should return 401 without JWT auth header', async () => {
      const res = await request(app).get('/streams/70278');
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });

    it('should return 400 for invalid stream id', async () => {
      const res = await request(app)
        .get('/streams/invalid_id')
        .set('Authorization', `Bearer ${validToken}`);
      expect(res.status).toBe(400);
    });
  });

  describe('POST /enqueue', () => {
    it('should return 401 without JWT auth header', async () => {
      const res = await request(app).post('/enqueue').send({ stream_id: 70278 });
      expect(res.status).toBe(401);
    });

    it('should return 400 for missing stream_id', async () => {
      const res = await request(app)
        .post('/enqueue')
        .set('Authorization', `Bearer ${validToken}`)
        .send({});
      expect(res.status).toBe(400);
    });
  });

  describe('POST /auction/fetch', () => {
    it('should return 401 without JWT auth header', async () => {
      const res = await request(app).post('/auction/fetch').send({ stream_id: 70316 });
      expect(res.status).toBe(401);
    });

    it('should return 400 for missing stream_id', async () => {
      const res = await request(app)
        .post('/auction/fetch')
        .set('Authorization', `Bearer ${validToken}`)
        .send({});
      expect(res.status).toBe(400);
    });
  });

  describe('POST /streams/:id/auctions', () => {
    it('should return 401 without JWT auth header', async () => {
      const res = await request(app).post('/streams/70316/auctions');
      expect(res.status).toBe(401);
    });

    it('should return 400 for invalid stream id', async () => {
      const res = await request(app)
        .post('/streams/invalid_id/auctions')
        .set('Authorization', `Bearer ${validToken}`);
      expect(res.status).toBe(400);
    });
  });

  describe('POST /cron/discovery', () => {
    it('should return 401 without JWT auth header', async () => {
      const res = await request(app).post('/cron/discovery');
      expect(res.status).toBe(401);
    });
  });
});
