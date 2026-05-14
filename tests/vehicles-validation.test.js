const { validateVehiclePayload } = require('../src/utils/validators');

describe('vehicle validation compatibility', () => {
  it('requires Flask-compatible fields on create and accepts mileage as current_mileage alias', () => {
    expect(validateVehiclePayload({}, false)).toEqual([
      'make is required',
      'model is required',
      'year is required',
      'current_mileage is required',
    ]);

    expect(
      validateVehiclePayload(
        {
          make: 'Toyota',
          model: 'Corolla',
          year: 2024,
          mileage: 1000,
        },
        false,
      ),
    ).toEqual([]);
  });

  it('returns the same validation messages for enum and nested maintenance_history errors', () => {
    const errors = validateVehiclePayload(
      {
        vehicle_type: 'truck',
        fuel_type: 'gas',
        transmission: 'auto',
        usage_type: 'offroad',
        driving_conditions: 'hard',
        maintenance_history: {
          last_oil_change_date: '01-01-2024',
          last_oil_change_mileage: '1000',
          filters: {
            oil: {
              date: '2024/01/01',
              km: '1000',
            },
          },
          tires: {
            tread_depth_mm: 'deep',
          },
          brakes: {
            last_change_date: '2024/01/01',
          },
        },
      },
      true,
    );

    expect(errors).toEqual([
      'vehicle_type must be one of: sedan, suv, pickup, hatchback, coupe, van, wagon, other',
      'fuel_type must be one of: gasolina, diesel, electrico, hibrido',
      'transmission must be one of: manual, automatica',
      'usage_type must be one of: ciudad, carretera, mixto',
      'driving_conditions must be one of: severas, normales, suaves',
      'maintenance_history.last_oil_change_date must use YYYY-MM-DD format',
      'maintenance_history.last_oil_change_mileage must be integer',
      'maintenance_history.filters.oil.date must use YYYY-MM-DD format',
      'maintenance_history.filters.oil.km must be integer',
      'maintenance_history.tires.tread_depth_mm must be numeric',
      'maintenance_history.brakes.last_change_date must use YYYY-MM-DD format',
    ]);
  });
});
