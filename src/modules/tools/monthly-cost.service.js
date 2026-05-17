function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function parseNumberParam(query, field, { minExclusive, minInclusive }) {
  const raw = query[field];
  if (raw === undefined || String(raw).trim() === '') {
    return { error: `${field} es obligatorio` };
  }

  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return { error: `${field} debe ser numérico` };
  }

  if (minExclusive !== undefined && value <= minExclusive) {
    return { error: `${field} debe ser mayor que ${minExclusive}` };
  }

  if (minInclusive !== undefined && value < minInclusive) {
    return { error: `${field} debe ser mayor o igual que ${minInclusive}` };
  }

  return { value };
}

function parseMonthlyCostQuery(query) {
  const specs = {
    monthlyKm: { minExclusive: 0 },
    kmPerLiter: { minExclusive: 0 },
    fuelPrice: { minExclusive: 0 },
    maintenancePerKm: { minInclusive: 0 },
  };

  const errors = [];
  const values = {};

  for (const [field, rules] of Object.entries(specs)) {
    const parsed = parseNumberParam(query, field, rules);
    if (parsed.error) {
      errors.push(parsed.error);
    } else {
      values[field] = parsed.value;
    }
  }

  return { errors, values };
}

function calculateMonthlyCost({ monthlyKm, kmPerLiter, fuelPrice, maintenancePerKm }) {
  const litersNeeded = monthlyKm / kmPerLiter;
  const fuelCost = litersNeeded * fuelPrice;
  const maintenanceCost = monthlyKm * maintenancePerKm;
  const totalMonthlyCost = fuelCost + maintenanceCost;

  return {
    monthlyKm: round2(monthlyKm),
    litersNeeded: round2(litersNeeded),
    fuelCost: round2(fuelCost),
    maintenanceCost: round2(maintenanceCost),
    totalMonthlyCost: round2(totalMonthlyCost),
  };
}

module.exports = {
  calculateMonthlyCost,
  parseMonthlyCostQuery,
  round2,
};
