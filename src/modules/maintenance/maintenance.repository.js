const { ReturnDocument } = require('mongodb');

const { getDb } = require('../../db/mongo');
const { toObjectId } = require('../../utils/object-id');

const COLLECTION = 'maintenance';
const updatableFields = ['service_type', 'description', 'cost', 'mileage', 'service_date'];

function maintenanceCollection() {
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

function serialize(item) {
  if (!item) {
    return null;
  }

  return {
    id: String(item._id),
    user_id: item.user_id,
    vehicle_id: item.vehicle_id,
    service_type: nullable(item.service_type),
    description: nullable(item.description),
    cost: nullable(item.cost),
    mileage: nullable(item.mileage),
    service_date: nullable(item.service_date),
    created_at: toIso(item.created_at),
    updated_at: toIso(item.updated_at),
  };
}

async function create(userId, payload) {
  const now = new Date();
  const item = {
    user_id: userId,
    vehicle_id: payload.vehicle_id,
    service_type: nullable(payload.service_type),
    description: nullable(payload.description),
    cost: nullable(payload.cost),
    mileage: nullable(payload.mileage),
    service_date: nullable(payload.service_date),
    created_at: now,
    updated_at: now,
  };

  const inserted = await maintenanceCollection().insertOne(item);
  item._id = inserted.insertedId;
  return serialize(item);
}

async function findByVehicle(userId, vehicleId) {
  const items = await maintenanceCollection().find({ user_id: userId, vehicle_id: vehicleId }).sort({ service_date: -1 }).toArray();
  return items.map(serialize);
}

async function findByIdForUser(maintenanceId, userId) {
  const item = await maintenanceCollection().findOne({ _id: toObjectId(maintenanceId), user_id: userId });
  return serialize(item);
}

function getUpdates(payload) {
  const updates = {};

  for (const field of updatableFields) {
    if (Object.hasOwn(payload, field)) {
      updates[field] = payload[field];
    }
  }

  return updates;
}

async function updateForUser(maintenanceId, userId, payload) {
  const updates = getUpdates(payload);
  if (!Object.keys(updates).length) {
    return null;
  }

  updates.updated_at = new Date();

  const result = await maintenanceCollection().findOneAndUpdate(
    { _id: toObjectId(maintenanceId), user_id: userId },
    { $set: updates },
    { returnDocument: ReturnDocument.AFTER },
  );

  return serialize(result);
}

async function deleteForUser(maintenanceId, userId) {
  const result = await maintenanceCollection().deleteOne({ _id: toObjectId(maintenanceId), user_id: userId });
  return result.deletedCount > 0;
}

module.exports = {
  create,
  deleteForUser,
  findByIdForUser,
  findByVehicle,
  getUpdates,
  serialize,
  updateForUser,
};
