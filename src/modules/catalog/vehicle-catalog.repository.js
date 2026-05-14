const { getDb } = require('../../db/mongo');

const COLLECTION = 'vehicle_catalog';

function vehicleCatalogCollection() {
  return getDb().collection(COLLECTION);
}

function nullable(value) {
  return value === undefined ? null : value;
}

function serialize(row) {
  if (!row) {
    return null;
  }

  return {
    id: nullable(row.id),
    make: nullable(row.make),
    model: nullable(row.model),
    vehicle_type: nullable(row.vehicle_type),
    fuel_type: nullable(row.fuel_type),
    transmission: nullable(row.transmission),
    image_urls: row.image_urls || [],
  };
}

async function upsertMany(items) {
  const now = new Date();
  let upserted = 0;

  for (const item of items) {
    const catalogId = String(item.id || '')
      .trim()
      .toLowerCase();

    if (!catalogId) {
      continue;
    }

    const payload = {
      id: catalogId,
      make: item.make,
      model: item.model,
      vehicle_type: item.vehicle_type,
      fuel_type: item.fuel_type,
      transmission: item.transmission,
      image_urls: item.image_urls || [],
      updated_at: now,
    };

    const result = await vehicleCatalogCollection().updateOne(
      { id: catalogId },
      {
        $set: payload,
        $setOnInsert: { created_at: now },
      },
      { upsert: true },
    );

    if (result.upsertedCount > 0) {
      upserted += 1;
    }
  }

  return upserted;
}

async function findAll() {
  const rows = await vehicleCatalogCollection().find({}).sort({ make: 1 }).toArray();
  return rows.map(serialize);
}

async function findById(catalogId) {
  const row = await vehicleCatalogCollection().findOne({ id: catalogId });
  return serialize(row);
}

module.exports = {
  findAll,
  findById,
  serialize,
  upsertMany,
};
