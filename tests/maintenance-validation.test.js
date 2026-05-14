const { validateMaintenancePayload } = require('../src/utils/validators');

describe('maintenance validation compatibility', () => {
  it('requires Flask-compatible fields on create', () => {
    expect(validateMaintenancePayload({}, false)).toEqual([
      'vehicle_id is required',
      'service_type is required',
      'service_date is required',
    ]);
  });

  it('validates cost and mileage types like Flask', () => {
    expect(validateMaintenancePayload({ cost: '10', mileage: '1000' }, true)).toEqual([
      'cost must be numeric',
      'mileage must be integer',
    ]);

    expect(validateMaintenancePayload({ cost: 10.5, mileage: 1000 }, true)).toEqual([]);
  });
});
