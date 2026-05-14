const fs = require('fs/promises');
const path = require('path');

const VehicleCatalog = require('./vehicle-catalog.repository');

const defaultCatalogPath = path.resolve(__dirname, '../../../data/vehicle_catalog.json');

async function loadDefaultCatalogItems() {
  let content;

  try {
    content = await fs.readFile(defaultCatalogPath, 'utf8');
  } catch (err) {
    if (err.code !== 'ENOENT') {
      throw err;
    }

    const error = new Error('No se recibió payload y no se encontró el archivo de catálogo por defecto');
    error.statusCode = 400;
    throw error;
  }

  return JSON.parse(content);
}

async function getSeedItems(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload && typeof payload === 'object' && Array.isArray(payload.items)) {
    return payload.items;
  }

  return loadDefaultCatalogItems();
}

async function seedVehicles(payload) {
  const items = await getSeedItems(payload);
  const upserted = await VehicleCatalog.upsertMany(items);

  return {
    status: 'ok',
    total_items: items.length,
    inserted_new: upserted,
  };
}

module.exports = {
  getSeedItems,
  seedVehicles,
};
