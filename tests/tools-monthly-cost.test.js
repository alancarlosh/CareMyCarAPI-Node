const request = require('supertest');
const createApp = require('../src/app');

describe('tools monthly cost', () => {
  it('calculates the expected monthly vehicle cost', async () => {
    const app = createApp();

    const res = await request(app).get(
      '/api/tools/monthly-cost?monthlyKm=1200&kmPerLiter=13&fuelPrice=24.5&maintenancePerKm=0.8',
    );

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      monthlyKm: 1200,
      litersNeeded: 92.31,
      fuelCost: 2261.54,
      maintenanceCost: 960,
      totalMonthlyCost: 3221.54,
    });
  });

  it('rejects missing or invalid numeric params', async () => {
    const app = createApp();

    const res = await request(app).get(
      '/api/tools/monthly-cost?monthlyKm=0&kmPerLiter=x&fuelPrice=&maintenancePerKm=-1',
    );

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      errors: [
        'monthlyKm debe ser mayor que 0',
        'kmPerLiter debe ser numérico',
        'fuelPrice es obligatorio',
        'maintenancePerKm debe ser mayor o igual que 0',
      ],
    });
  });
});
