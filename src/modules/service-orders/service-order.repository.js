const { ReturnDocument } = require('mongodb');

const { getDb } = require('../../db/mongo');
const { toObjectId } = require('../../utils/object-id');

const COLLECTION = 'service_orders';

function collection() {
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
    user_id: nullable(item.user_id),
    vehicle_id: nullable(item.vehicle_id),
    vehicle_snapshot: item.vehicle_snapshot || {},
    service_type: nullable(item.service_type),
    scheduled_date: nullable(item.scheduled_date),
    status: nullable(item.status),
    estimated_cost: nullable(item.estimated_cost),
    final_cost: nullable(item.final_cost),
    predicted_service_type: nullable(item.predicted_service_type),
    cost_breakdown: nullable(item.cost_breakdown),
    user_notes: nullable(item.user_notes),
    agency_notes: nullable(item.agency_notes),
    completion_token: nullable(item.completion_token),
    check_in_at: toIso(item.check_in_at),
    completed_at: toIso(item.completed_at),
    created_at: toIso(item.created_at),
    updated_at: toIso(item.updated_at),
  };
}

async function create(payload) {
  const now = new Date();
  const item = {
    user_id: payload.user_id,
    vehicle_id: payload.vehicle_id,
    vehicle_snapshot: payload.vehicle_snapshot || {},
    service_type: payload.service_type,
    scheduled_date: payload.scheduled_date,
    status: payload.status || 'PROGRAMADO',
    estimated_cost: payload.estimated_cost,
    final_cost: payload.final_cost,
    predicted_service_type: payload.predicted_service_type,
    cost_breakdown: payload.cost_breakdown,
    user_notes: payload.user_notes,
    agency_notes: payload.agency_notes,
    completion_token: payload.completion_token,
    check_in_at: payload.check_in_at,
    completed_at: payload.completed_at,
    created_at: now,
    updated_at: now,
  };

  const inserted = await collection().insertOne(item);
  item._id = inserted.insertedId;
  return serialize(item);
}

async function findById(orderId) {
  const item = await collection().findOne({ _id: toObjectId(orderId) });
  return serialize(item);
}

async function findByIdForUser(orderId, userId) {
  const item = await collection().findOne({ _id: toObjectId(orderId), user_id: userId });
  return serialize(item);
}

async function findByUser(userId) {
  const rows = await collection().find({ user_id: userId }).sort({ created_at: -1 }).toArray();
  return rows.map(serialize);
}

async function findAll({ filters = {} } = {}) {
  const rows = await collection().find(filters).sort({ created_at: -1 }).toArray();
  return rows.map(serialize);
}

async function update(orderId, updates) {
  if (!updates || !Object.keys(updates).length) {
    return null;
  }

  updates.updated_at = new Date();
  const row = await collection().findOneAndUpdate(
    { _id: toObjectId(orderId) },
    { $set: updates },
    { returnDocument: ReturnDocument.AFTER },
  );
  return serialize(row);
}

module.exports = {
  create,
  findAll,
  findById,
  findByIdForUser,
  findByUser,
  serialize,
  update,
};
