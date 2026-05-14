const request = require('supertest');
const createApp = require('../src/app');

describe('auth compatibility basics', () => {
  it('rejects invalid email with the Flask-compatible payload', async () => {
    const app = createApp();

    const res = await request(app).post('/api/auth/register').send({
      email: 'bad-email',
      password: 'password123',
    });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid email' });
  });

  it('rejects missing bearer token on profile', async () => {
    const app = createApp();

    const res = await request(app).get('/api/auth/profile');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Missing or invalid token' });
  });
});
