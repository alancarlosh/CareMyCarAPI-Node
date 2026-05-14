const fs = require('fs/promises');
const path = require('path');

const Part = require('./part.repository');

const validPartCategories = new Set([
  'frenos',
  'suspension',
  'motor',
  'transmision',
  'electrico',
  'filtros',
  'aceites',
  'llantas',
  'carroceria',
  'otros',
]);

const csvPath = path.resolve(__dirname, '../../../data/maintenance_costs.csv');

async function loadMakeModelOptions() {
  let content;

  try {
    content = await fs.readFile(csvPath, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      return [];
    }
    throw err;
  }

  const lines = content.split(/\r?\n/).filter(Boolean);
  if (!lines.length) {
    return [];
  }

  const headers = lines[0].split(',');
  const makeIndex = headers.indexOf('make');
  const modelIndex = headers.indexOf('model');
  if (makeIndex < 0 || modelIndex < 0) {
    return [];
  }

  const options = [];
  for (const line of lines.slice(1)) {
    const cells = line.split(',');
    const make = String(cells[makeIndex] || '').trim();
    const model = String(cells[modelIndex] || '').trim();
    if (!make || !model) {
      continue;
    }
    options.push({ make, model });
  }

  return options;
}

function sortedUnique(values) {
  return [...new Set(values)].sort();
}

async function getOptions(makeQuery = '') {
  const make = String(makeQuery || '')
    .trim()
    .toLowerCase();
  let rows = await loadMakeModelOptions();
  const makes = sortedUnique(rows.map((row) => row.make));

  if (make) {
    rows = rows.filter((row) => row.make.trim().toLowerCase() === make);
  }

  const years = [];
  for (let year = new Date().getUTCFullYear() + 1; year >= 1980; year -= 1) {
    years.push(year);
  }

  return {
    categories: sortedUnique([...validPartCategories]),
    makes,
    years,
    models: sortedUnique(rows.map((row) => row.model)),
  };
}

async function hasValidMakeModel(make, model) {
  const validOptions = await loadMakeModelOptions();
  if (!validOptions.length) {
    return true;
  }

  return validOptions.some(
    (row) =>
      row.make.trim().toLowerCase() === String(make).trim().toLowerCase() &&
      row.model.trim().toLowerCase() === String(model).trim().toLowerCase(),
  );
}

function parseInteger(value) {
  if (typeof value === 'boolean') {
    return Number(value);
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return null;
    }
    return Math.trunc(value);
  }

  const raw = String(value).trim();
  if (!/^[+-]?\d+$/.test(raw)) {
    return null;
  }

  return Number.parseInt(raw, 10);
}

function parseFloatValue(value) {
  if (typeof value === 'boolean') {
    return Number(value);
  }

  if (typeof value === 'number') {
    return Number.isNaN(value) ? null : value;
  }

  const raw = String(value).trim();
  if (!raw) {
    return null;
  }

  const parsed = Number(raw);
  if (Number.isNaN(parsed)) {
    return null;
  }
  return parsed;
}

function parsePagination(query) {
  const page = parseInteger(query.page ?? 1);
  const limit = parseInteger(query.limit ?? 20);

  if (page === null || limit === null) {
    return { error: 'page/limit deben ser enteros' };
  }

  return {
    page: Math.max(1, page),
    limit: Math.max(1, Math.min(100, limit)),
  };
}

async function validateCreatePayload(payload) {
  const required = ['name', 'category', 'make', 'year', 'model', 'price', 'quantity'];
  const errors = required.filter((field) => !Object.hasOwn(payload, field)).map((field) => `${field} es obligatorio`);
  if (errors.length) {
    return { errors };
  }

  const category = String(payload.category || '')
    .trim()
    .toLowerCase();
  if (!validPartCategories.has(category)) {
    return { error: 'Categoría inválida' };
  }

  const make = String(payload.make || '').trim();
  if (!make) {
    return { error: 'make no debe estar vacío' };
  }

  const model = String(payload.model || '').trim();
  if (!(await hasValidMakeModel(make, model))) {
    return { error: 'make/model no disponible en el dataset maintenance_costs' };
  }

  const year = parseInteger(payload.year);
  const price = parseFloatValue(payload.price);
  const quantity = parseInteger(payload.quantity);
  if (year === null || price === null || quantity === null) {
    return { error: 'Los tipos de year/price/quantity son inválidos' };
  }

  if (quantity < 0 || price < 0) {
    return { error: 'quantity y price deben ser >= 0' };
  }

  const compatibility = payload.compatibility ?? [];
  if (compatibility !== null && !Array.isArray(compatibility)) {
    return { error: 'compatibility debe ser una lista' };
  }

  return {
    payload: {
      name: String(payload.name || '').trim(),
      category,
      make,
      year,
      model,
      compatibility: compatibility || [],
      price,
      quantity,
    },
  };
}

async function validateUpdatePayload(partId, userId, payload) {
  const updates = Part.allowedUpdates(payload);
  if (!Object.keys(updates).length) {
    return { error: 'Payload vacío' };
  }

  if (Object.hasOwn(updates, 'category')) {
    updates.category = String(updates.category).trim().toLowerCase();
    if (!validPartCategories.has(updates.category)) {
      return { error: 'Categoría inválida' };
    }
  }

  if (Object.hasOwn(updates, 'year')) {
    updates.year = parseInteger(updates.year);
    if (updates.year === null) {
      return { error: 'year debe ser entero' };
    }
  }

  if (Object.hasOwn(updates, 'make')) {
    updates.make = String(updates.make).trim();
    if (!updates.make) {
      return { error: 'make no debe estar vacío' };
    }
  }

  if (Object.hasOwn(updates, 'model')) {
    updates.model = String(updates.model).trim();
    if (!updates.model) {
      return { error: 'model no debe estar vacío' };
    }
  }

  if (Object.hasOwn(updates, 'make') || Object.hasOwn(updates, 'model')) {
    const current = await Part.findByIdForUser(partId, userId);
    if (!current) {
      return { error: 'Refacción no encontrada' };
    }

    const currentMake = updates.make ?? current.make;
    const currentModel = updates.model ?? current.model;
    if (!(await hasValidMakeModel(currentMake, currentModel))) {
      return { error: 'make/model no disponible en el dataset maintenance_costs' };
    }
  }

  if (Object.hasOwn(updates, 'price')) {
    updates.price = parseFloatValue(updates.price);
    if (updates.price === null) {
      return { error: 'price debe ser numérico' };
    }
  }

  if (Object.hasOwn(updates, 'quantity')) {
    updates.quantity = parseInteger(updates.quantity);
    if (updates.quantity === null) {
      return { error: 'quantity debe ser entero' };
    }
  }

  return { updates };
}

module.exports = {
  getOptions,
  hasValidMakeModel,
  loadMakeModelOptions,
  parsePagination,
  validateCreatePayload,
  validateUpdatePayload,
  validPartCategories,
};
