const { validateVehiclePayload } = require('../src/utils/validators');

describe('vehicle validation compatibility', () => {
  it('requires Flask-compatible fields on create and accepts mileage as current_mileage alias', () => {
    expect(validateVehiclePayload({}, false)).toEqual([
      'make es obligatorio',
      'model es obligatorio',
      'year es obligatorio',
      'current_mileage es obligatorio',
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
      'vehicle_type debe ser uno de: sedan, suv, pickup, hatchback, coupe, van, wagon, other',
      'fuel_type debe ser uno de: gasolina, diesel, electrico, hibrido',
      'transmission debe ser uno de: manual, automatica',
      'usage_type debe ser uno de: ciudad, carretera, mixto',
      'driving_conditions debe ser uno de: severas, normales, suaves',
      'maintenance_history.last_oil_change_date debe usar formato YYYY-MM-DD',
      'maintenance_history.last_oil_change_mileage debe ser entero',
      'maintenance_history.filters.oil.date debe usar formato YYYY-MM-DD',
      'maintenance_history.filters.oil.km debe ser entero',
      'maintenance_history.tires.tread_depth_mm debe ser numérico',
      'maintenance_history.brakes.last_change_date debe usar formato YYYY-MM-DD',
    ]);
  });
});
