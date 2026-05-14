const { ReturnDocument } = require('mongodb');

const { getDb } = require('../../db/mongo');
const { toObjectId } = require('../../utils/object-id');

const COLLECTION = 'vehicles';

const updatableFields = [
  'catalog_vehicle_id',
  'make',
  'model',
  'year',
  'vehicle_type',
  'fuel_type',
  'cylinders',
  'transmission',
  'vin',
  'license_plate',
  'color',
  'current_mileage',
  'average_mileage_daily',
  'average_mileage_weekly',
  'average_mileage_monthly',
  'engine_hours',
  'acquisition_date',
  'usage_type',
  'driving_conditions',
  'image_urls',
  'maintenance_history',
];

function vehiclesCollection() {
  return getDb().collection(COLLECTION);
}

function toIso(value) {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : value;
}

function nullable(value) {
  return value === undefined ? null : value;
}

function serialize(vehicle) {
  if (!vehicle) {
    return null;
  }

  return {
    id: String(vehicle._id),
    user_id: vehicle.user_id,
    catalog_vehicle_id: nullable(vehicle.catalog_vehicle_id),
    make: nullable(vehicle.make),
    model: nullable(vehicle.model),
    year: nullable(vehicle.year),
    vehicle_type: nullable(vehicle.vehicle_type),
    fuel_type: nullable(vehicle.fuel_type),
    cylinders: nullable(vehicle.cylinders),
    transmission: nullable(vehicle.transmission),
    vin: nullable(vehicle.vin),
    license_plate: nullable(vehicle.license_plate),
    color: nullable(vehicle.color),
    current_mileage: nullable(vehicle.current_mileage),
    mileage: nullable(vehicle.current_mileage),
    average_mileage_daily: nullable(vehicle.average_mileage_daily),
    average_mileage_weekly: nullable(vehicle.average_mileage_weekly),
    average_mileage_monthly: nullable(vehicle.average_mileage_monthly),
    engine_hours: nullable(vehicle.engine_hours),
    acquisition_date: nullable(vehicle.acquisition_date),
    usage_type: nullable(vehicle.usage_type),
    driving_conditions: nullable(vehicle.driving_conditions),
    image_urls: vehicle.image_urls || [],
    maintenance_history: vehicle.maintenance_history || {},
    created_at: toIso(vehicle.created_at),
    updated_at: toIso(vehicle.updated_at),
  };
}

async function create(userId, payload) {
  const now = new Date();
  const vehicle = {
    user_id: userId,
    catalog_vehicle_id: nullable(payload.catalog_vehicle_id),
    make: nullable(payload.make),
    model: nullable(payload.model),
    year: nullable(payload.year),
    vehicle_type: nullable(payload.vehicle_type),
    fuel_type: nullable(payload.fuel_type),
    cylinders: nullable(payload.cylinders),
    transmission: nullable(payload.transmission),
    vin: nullable(payload.vin),
    license_plate: nullable(payload.license_plate),
    color: nullable(payload.color),
    current_mileage: Object.hasOwn(payload, 'current_mileage')
      ? payload.current_mileage
      : Object.hasOwn(payload, 'mileage')
        ? payload.mileage
        : 0,
    average_mileage_daily: nullable(payload.average_mileage_daily),
    average_mileage_weekly: nullable(payload.average_mileage_weekly),
    average_mileage_monthly: nullable(payload.average_mileage_monthly),
    engine_hours: nullable(payload.engine_hours),
    acquisition_date: nullable(payload.acquisition_date),
    usage_type: nullable(payload.usage_type),
    driving_conditions: nullable(payload.driving_conditions),
    image_urls: payload.image_urls || [],
    maintenance_history: payload.maintenance_history || {},
    created_at: now,
    updated_at: now,
  };

  const inserted = await vehiclesCollection().insertOne(vehicle);
  vehicle._id = inserted.insertedId;
  return serialize(vehicle);
}

async function findAllByUser(userId) {
  const rows = await vehiclesCollection().find({ user_id: userId }).sort({ created_at: -1 }).toArray();
  return rows.map(serialize);
}

async function findByIdForUser(vehicleId, userId) {
  const row = await vehiclesCollection().findOne({ _id: toObjectId(vehicleId), user_id: userId });
  return serialize(row);
}

function getUpdates(payload) {
  const updates = {};

  for (const field of updatableFields) {
    if (Object.hasOwn(payload, field)) {
      updates[field] = payload[field];
    }
  }

  if (Object.hasOwn(payload, 'mileage') && !Object.hasOwn(payload, 'current_mileage')) {
    updates.current_mileage = payload.mileage;
  }

  return updates;
}

async function updateForUser(vehicleId, userId, payload) {
  const updates = getUpdates(payload);
  if (!Object.keys(updates).length) {
    return null;
  }

  updates.updated_at = new Date();

  const result = await vehiclesCollection().findOneAndUpdate(
    { _id: toObjectId(vehicleId), user_id: userId },
    { $set: updates },
    { returnDocument: ReturnDocument.AFTER },
  );

  return serialize(result);
}

async function deleteForUser(vehicleId, userId) {
  const result = await vehiclesCollection().deleteOne({ _id: toObjectId(vehicleId), user_id: userId });
  return result.deletedCount > 0;
}

module.exports = {
  create,
  deleteForUser,
  findAllByUser,
  findByIdForUser,
  getUpdates,
  serialize,
  updateForUser,
};
