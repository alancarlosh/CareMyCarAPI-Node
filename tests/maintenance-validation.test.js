const { validateMaintenancePayload } = require('../src/utils/validators');

describe('maintenance validation compatibility', () => {
  it('requires Flask-compatible fields on create', () => {
    expect(validateMaintenancePayload({}, false)).toEqual([
      'vehicle_id es obligatorio',
      'service_type es obligatorio',
      'service_date es obligatorio',
    ]);
  });

  it('validates cost and mileage types like Flask', () => {
    expect(validateMaintenancePayload({ cost: '10', mileage: '1000' }, true)).toEqual([
      'cost debe ser numérico',
      'mileage debe ser entero',
    ]);

    expect(validateMaintenancePayload({ cost: 10.5, mileage: 1000 }, true)).toEqual([]);
  });
});
