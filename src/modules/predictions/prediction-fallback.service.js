const defaultServiceCostsMxn = {
  oil_change: 1400,
  minor_service: 3200,
  major_service: 8500,
  brake_service: 4200,
  tire_service: 2600,
};

function safeFloat(value, defaultValue = 0.0) {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

function safeInt(value, defaultValue = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

function historyAvgCost(history) {
  const costs = history.map((item) => safeFloat(item.cost, null)).filter((cost) => cost !== null && cost > 0);
  if (!costs.length) {
    return 0.0;
  }
  return costs.reduce((sum, cost) => sum + cost, 0) / costs.length;
}

function buildCostFeatures(vehicle, history, serviceType) {
  const currentYear = new Date().getUTCFullYear();
  const vehicleYear = safeInt(vehicle.year, currentYear);
  const vehicleAge = Math.max(0, currentYear - vehicleYear);

  return {
    service_type: serviceType,
    make: vehicle.make || 'unknown',
    model: vehicle.model || 'unknown',
    fuel_type: vehicle.fuel_type || 'unknown',
    transmission: vehicle.transmission || 'unknown',
    vehicle_type: vehicle.vehicle_type || 'unknown',
    current_mileage: safeInt(vehicle.current_mileage ?? vehicle.mileage ?? 0),
    average_mileage_monthly: safeInt(vehicle.average_mileage_monthly ?? 0),
    cylinders: safeInt(vehicle.cylinders ?? 0),
    vehicle_age: vehicleAge,
    historical_avg_cost: historyAvgCost(history),
  };
}

function estimateNextMaintenanceCost(vehicle, history, serviceType = 'major_service') {
  const normalizedServiceType = serviceType || 'major_service';
  const features = buildCostFeatures(vehicle, history, normalizedServiceType);
  const baseCost = defaultServiceCostsMxn[normalizedServiceType] || defaultServiceCostsMxn.major_service;
  const mileageFactor = 1 + Math.min(features.current_mileage, 300000) / 300000;
  const ageFactor = 1 + Math.min(features.vehicle_age, 25) * 0.015;
  const usageFactor = vehicle.usage_type === 'ciudad' && vehicle.driving_conditions === 'severas' ? 1.12 : 1.0;
  const historical = features.historical_avg_cost;
  const blendedBase = historical <= 0 ? baseCost : 0.7 * baseCost + 0.3 * historical;
  const estimate = blendedBase * mileageFactor * ageFactor * usageFactor;

  return {
    estimated_cost_mxn: Math.round(estimate * 100) / 100,
    service_type: normalizedServiceType,
    model_used: 'rule_based_fallback',
  };
}

module.exports = {
  buildCostFeatures,
  defaultServiceCostsMxn,
  estimateNextMaintenanceCost,
  historyAvgCost,
};
