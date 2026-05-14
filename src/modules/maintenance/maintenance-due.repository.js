const { getDb } = require('../../db/mongo');

const COLLECTION = 'maintenance_due';

function maintenanceDueCollection() {
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

function serialize(row) {
  if (!row) {
    return null;
  }

  return {
    id: String(row._id),
    user_id: row.user_id,
    vehicle_id: row.vehicle_id,
    vehicle_label: nullable(row.vehicle_label),
    current_mileage: nullable(row.current_mileage),
    items: row.items || [],
    has_due: row.has_due || false,
    has_upcoming: row.has_upcoming || false,
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
  };
}

async function upsertForVehicle(userId, vehicleId, payload) {
  const now = new Date();
  await maintenanceDueCollection().updateOne(
    { user_id: userId, vehicle_id: vehicleId },
    {
      $set: {
        user_id: userId,
        vehicle_id: vehicleId,
        vehicle_label: payload.vehicle_label,
        current_mileage: payload.current_mileage,
        items: payload.items || [],
        has_due: payload.has_due || false,
        has_upcoming: payload.has_upcoming || false,
        updated_at: now,
      },
      $setOnInsert: {
        created_at: now,
      },
    },
    { upsert: true },
  );
}

async function listDueByUser(userId) {
  const rows = await maintenanceDueCollection().find({ user_id: userId }).sort({ updated_at: -1 }).toArray();
  return rows.map(serialize);
}

async function listAllDue() {
  const rows = await maintenanceDueCollection().find({}).sort({ updated_at: -1 }).toArray();
  return rows.map(serialize);
}

module.exports = {
  listAllDue,
  listDueByUser,
  serialize,
  upsertForVehicle,
};
