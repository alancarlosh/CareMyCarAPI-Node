const { estimateNextMaintenanceCost } = require('../src/modules/predictions/prediction-fallback.service');
const ServiceOrdersService = require('../src/modules/service-orders/service-orders.service');
const { validateServiceOrderPayload } = require('../src/utils/validators');

function futureDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

describe('service orders compatibility helpers', () => {
  it('validates service order payload like Flask', () => {
    expect(validateServiceOrderPayload({}, false)).toEqual([
      'vehicle_id es obligatorio',
      'service_type es obligatorio',
      'scheduled_date es obligatorio',
    ]);

    expect(
      validateServiceOrderPayload(
        {
          vehicle_id: 'v',
          service_type: 'Servicio general',
          scheduled_date: futureDate(),
          estimated_cost: 1000,
          final_cost: 1200,
          status: 'FINALIZADO',
        },
        false,
      ),
    ).toEqual([]);
  });

  it('normalizes aliases and builds fallback quote totals', () => {
    const quote = ServiceOrdersService.buildQuote(
      {
        year: new Date().getUTCFullYear() - 5,
        current_mileage: 60000,
        usage_type: 'ciudad',
        driving_conditions: 'severas',
      },
      [{ cost: 3000 }],
      'servicio general',
    );

    expect(quote.service_key).toBe('major_service');
    expect(quote.prediction.model_used).toBe('rule_based_fallback');
    expect(quote.products_total_mxn).toBe(1600);
    expect(quote.suggested_total_mxn).toBeGreaterThanOrEqual(quote.products_total_mxn + quote.labor_total_mxn);
  });

  it('estimates maintenance cost with the rule-based fallback', () => {
    const prediction = estimateNextMaintenanceCost(
      {
        year: new Date().getUTCFullYear(),
        current_mileage: 0,
      },
      [],
      'oil_change',
    );

    expect(prediction).toEqual({
      estimated_cost_mxn: 1400,
      service_type: 'oil_change',
      model_used: 'rule_based_fallback',
    });
  });
});
