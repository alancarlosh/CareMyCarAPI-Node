const emailRe = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const dateRe = /^\d{4}-\d{2}-\d{2}$/;

const validVehicleTypes = new Set(['sedan', 'suv', 'pickup', 'hatchback', 'coupe', 'van', 'wagon', 'other']);
const validFuelTypes = new Set(['gasolina', 'diesel', 'electrico', 'hibrido']);
const validTransmission = new Set(['manual', 'automatica']);
const validUsageTypes = new Set(['ciudad', 'carretera', 'mixto']);
const validDrivingConditions = new Set(['severas', 'normales', 'suaves']);
const validServiceOrderStatus = new Set(['PROGRAMADO', 'EN_PROCESO', 'FINALIZADO', 'CANCELADO']);

function validateEmail(email) {
  return Boolean(email && emailRe.test(email));
}

function validatePassword(password) {
  return Boolean(password && password.length >= 8);
}

function isPythonInteger(value) {
  return Number.isInteger(value) || typeof value === 'boolean';
}

function isPythonNumeric(value) {
  return (typeof value === 'number' && Number.isFinite(value)) || typeof value === 'boolean';
}

function hasOwn(payload, field) {
  return Object.hasOwn(payload, field);
}

function validateVehiclePayload(payload, partial = false) {
  const errors = [];
  const required = ['make', 'model', 'year', 'current_mileage'];

  if (!partial) {
    for (const field of required) {
      if (!hasOwn(payload, field) && !(field === 'current_mileage' && hasOwn(payload, 'mileage'))) {
        errors.push(`${field} is required`);
      }
    }
  }

  if (hasOwn(payload, 'year') && !isPythonInteger(payload.year)) {
    errors.push('year must be integer');
  }

  if (hasOwn(payload, 'current_mileage') && !isPythonInteger(payload.current_mileage)) {
    errors.push('current_mileage must be integer');
  }

  if (hasOwn(payload, 'mileage') && !isPythonInteger(payload.mileage)) {
    errors.push('mileage must be integer (deprecated, use current_mileage)');
  }

  if (hasOwn(payload, 'vehicle_type') && !validVehicleTypes.has(String(payload.vehicle_type).toLowerCase())) {
    errors.push('vehicle_type must be one of: sedan, suv, pickup, hatchback, coupe, van, wagon, other');
  }

  if (hasOwn(payload, 'fuel_type') && !validFuelTypes.has(String(payload.fuel_type).toLowerCase())) {
    errors.push('fuel_type must be one of: gasolina, diesel, electrico, hibrido');
  }

  if (hasOwn(payload, 'transmission') && !validTransmission.has(String(payload.transmission).toLowerCase())) {
    errors.push('transmission must be one of: manual, automatica');
  }

  if (hasOwn(payload, 'usage_type') && !validUsageTypes.has(String(payload.usage_type).toLowerCase())) {
    errors.push('usage_type must be one of: ciudad, carretera, mixto');
  }

  if (
    hasOwn(payload, 'driving_conditions') &&
    !validDrivingConditions.has(String(payload.driving_conditions).toLowerCase())
  ) {
    errors.push('driving_conditions must be one of: severas, normales, suaves');
  }

  const integerFields = [
    'cylinders',
    'average_mileage_daily',
    'average_mileage_weekly',
    'average_mileage_monthly',
    'engine_hours',
  ];

  for (const field of integerFields) {
    if (hasOwn(payload, field) && !isPythonInteger(payload[field])) {
      errors.push(`${field} must be integer`);
    }
  }

  if (hasOwn(payload, 'acquisition_date') && !dateRe.test(String(payload.acquisition_date))) {
    errors.push('acquisition_date must use YYYY-MM-DD format');
  }

  if (
    hasOwn(payload, 'maintenance_history') &&
    (payload.maintenance_history === null || typeof payload.maintenance_history !== 'object' || Array.isArray(payload.maintenance_history))
  ) {
    errors.push('maintenance_history must be an object');
  }

  if (
    payload.maintenance_history &&
    typeof payload.maintenance_history === 'object' &&
    !Array.isArray(payload.maintenance_history)
  ) {
    validateMaintenanceHistory(payload.maintenance_history, errors);
  }

  return errors;
}

function validateMaintenanceHistory(history, errors) {
  if (hasOwn(history, 'last_oil_change_date') && !dateRe.test(String(history.last_oil_change_date))) {
    errors.push('maintenance_history.last_oil_change_date must use YYYY-MM-DD format');
  }

  if (hasOwn(history, 'last_oil_change_mileage') && !isPythonInteger(history.last_oil_change_mileage)) {
    errors.push('maintenance_history.last_oil_change_mileage must be integer');
  }

  if (hasOwn(history, 'oil_change_interval_km') && !isPythonInteger(history.oil_change_interval_km)) {
    errors.push('maintenance_history.oil_change_interval_km must be integer');
  }

  const filters = history.filters || {};
  for (const field of ['oil', 'air', 'fuel', 'cabin']) {
    if (!hasOwn(filters, field)) {
      continue;
    }

    const entry = filters[field];
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      errors.push(`maintenance_history.filters.${field} must be an object`);
      continue;
    }

    if (hasOwn(entry, 'date') && !dateRe.test(String(entry.date))) {
      errors.push(`maintenance_history.filters.${field}.date must use YYYY-MM-DD format`);
    }

    if (hasOwn(entry, 'km') && !isPythonInteger(entry.km)) {
      errors.push(`maintenance_history.filters.${field}.km must be integer`);
    }
  }

  validateTires(history, errors);
  validateBrakes(history, errors);
}

function validateTires(history, errors) {
  const tires = history.tires;
  if (tires === undefined || tires === null) {
    return;
  }

  if (typeof tires !== 'object' || Array.isArray(tires)) {
    errors.push('maintenance_history.tires must be an object');
    return;
  }

  for (const field of ['last_rotation_date', 'last_balancing_date', 'last_alignment_date', 'purchase_date']) {
    if (hasOwn(tires, field) && !dateRe.test(String(tires[field]))) {
      errors.push(`maintenance_history.tires.${field} must use YYYY-MM-DD format`);
    }
  }

  for (const field of ['tread_depth_mm', 'tire_pressure_psi']) {
    if (hasOwn(tires, field) && !isPythonNumeric(tires[field])) {
      errors.push(`maintenance_history.tires.${field} must be numeric`);
    }
  }
}

function validateBrakes(history, errors) {
  const brakes = history.brakes;
  if (brakes === undefined || brakes === null) {
    return;
  }

  if (typeof brakes !== 'object' || Array.isArray(brakes)) {
    errors.push('maintenance_history.brakes must be an object');
    return;
  }

  for (const field of ['last_change_date', 'fluid_bleed_date']) {
    if (hasOwn(brakes, field) && !dateRe.test(String(brakes[field]))) {
      errors.push(`maintenance_history.brakes.${field} must use YYYY-MM-DD format`);
    }
  }

  for (const field of ['front_pad_thickness_mm', 'rear_pad_thickness_mm', 'brake_fluid_level_percent']) {
    if (hasOwn(brakes, field) && !isPythonNumeric(brakes[field])) {
      errors.push(`maintenance_history.brakes.${field} must be numeric`);
    }
  }
}

function validateMaintenancePayload(payload, partial = false) {
  const errors = [];
  const required = ['vehicle_id', 'service_type', 'service_date'];

  if (!partial) {
    for (const field of required) {
      if (!hasOwn(payload, field)) {
        errors.push(`${field} is required`);
      }
    }
  }

  if (hasOwn(payload, 'cost') && !isPythonNumeric(payload.cost)) {
    errors.push('cost must be numeric');
  }

  if (hasOwn(payload, 'mileage') && !isPythonInteger(payload.mileage)) {
    errors.push('mileage must be integer');
  }

  return errors;
}

function parseDateOnly(value) {
  const raw = String(value);
  if (!dateRe.test(raw)) {
    return null;
  }

  const [year, month, day] = raw.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) {
    return null;
  }

  return parsed;
}

function todayDateOnly() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function validateServiceOrderPayload(payload, partial = false) {
  const errors = [];
  const required = ['vehicle_id', 'service_type', 'scheduled_date'];

  if (!partial) {
    for (const field of required) {
      if (!hasOwn(payload, field)) {
        errors.push(`${field} is required`);
      }
    }
  }

  if (hasOwn(payload, 'scheduled_date')) {
    const parsed = parseDateOnly(payload.scheduled_date);
    if (!parsed) {
      errors.push('scheduled_date must use YYYY-MM-DD format');
    } else if (parsed < todayDateOnly()) {
      errors.push('scheduled_date must be today or a future date');
    }
  }

  if (hasOwn(payload, 'estimated_cost') && !isPythonNumeric(payload.estimated_cost)) {
    errors.push('estimated_cost must be numeric');
  }

  if (hasOwn(payload, 'final_cost') && !isPythonNumeric(payload.final_cost)) {
    errors.push('final_cost must be numeric');
  }

  if (hasOwn(payload, 'status') && !validServiceOrderStatus.has(String(payload.status).toUpperCase())) {
    errors.push('status must be one of: PROGRAMADO, EN_PROCESO, FINALIZADO, CANCELADO');
  }

  return errors;
}

module.exports = {
  validateEmail,
  validateMaintenancePayload,
  validatePassword,
  validateServiceOrderPayload,
  validateVehiclePayload,
};
