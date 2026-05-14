const { ReturnDocument } = require('mongodb');

const { getDb } = require('../../db/mongo');
const { toObjectId } = require('../../utils/object-id');

const COLLECTION = 'orders';
const updatableFields = new Set(['client_name', 'vin', 'make', 'year', 'model', 'status']);

function ordersCollection() {
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
    buyer_id: nullable(item.buyer_id),
    client_name: nullable(item.client_name),
    vin: nullable(item.vin),
    make: nullable(item.make),
    year: nullable(item.year),
    model: nullable(item.model),
    part_id: nullable(item.part_id),
    part_name: nullable(item.part_name),
    quantity: nullable(item.quantity),
    unit_price: nullable(item.unit_price),
    total_price: nullable(item.total_price),
    status: nullable(item.status),
    created_at: toIso(item.created_at),
    updated_at: toIso(item.updated_at),
  };
}

async function create(payload) {
  const now = new Date();
  const item = {
    user_id: payload.user_id,
    buyer_id: payload.buyer_id,
    client_name: payload.client_name,
    vin: payload.vin,
    make: payload.make,
    year: payload.year,
    model: payload.model,
    part_id: payload.part_id,
    part_name: payload.part_name,
    quantity: payload.quantity,
    unit_price: payload.unit_price,
    total_price: payload.total_price,
    status: payload.status || 'pending',
    created_at: now,
    updated_at: now,
  };

  const inserted = await ordersCollection().insertOne(item);
  item._id = inserted.insertedId;
  return serialize(item);
}

function buildSearchQuery(userId, q) {
  const query = { user_id: userId };
  if (q) {
    query.$or = [
      { client_name: { $regex: q, $options: 'i' } },
      { part_name: { $regex: q, $options: 'i' } },
      { vin: { $regex: q, $options: 'i' } },
      { make: { $regex: q, $options: 'i' } },
      { model: { $regex: q, $options: 'i' } },
    ];
  }
  return query;
}

async function findFiltered(userId, { q = '', status = '', page = 1, limit = 20 } = {}) {
  const queryBase = buildSearchQuery(userId, q);
  const query = { ...queryBase };

  if (status && status !== 'all') {
    query.status = status;
  }

  const total = await ordersCollection().countDocuments(query);
  const allCount = await ordersCollection().countDocuments(queryBase);
  const pendingCount = await ordersCollection().countDocuments({ ...queryBase, status: 'pending' });
  const rows = await ordersCollection()
    .find(query)
    .sort({ created_at: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .toArray();

  return {
    items: rows.map(serialize),
    total,
    all_count: allCount,
    pending_count: pendingCount,
  };
}

async function findByIdForUser(orderId, userId) {
  const row = await ordersCollection().findOne({ _id: toObjectId(orderId), user_id: userId });
  return serialize(row);
}

async function findPurchasesByBuyer(buyerId, { status = '', page = 1, limit = 20 } = {}) {
  const query = { buyer_id: buyerId };
  if (status && status !== 'all') {
    query.status = status;
  }

  const total = await ordersCollection().countDocuments(query);
  const rows = await ordersCollection()
    .find(query)
    .sort({ created_at: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .toArray();

  return { items: rows.map(serialize), total };
}

function allowedUpdates(payload) {
  const updates = {};

  for (const key of Object.keys(payload)) {
    if (updatableFields.has(key)) {
      updates[key] = payload[key];
    }
  }

  return updates;
}

async function updateForUser(orderId, userId, payload) {
  const updates = allowedUpdates(payload);
  if (!Object.keys(updates).length) {
    return null;
  }

  updates.updated_at = new Date();
  const row = await ordersCollection().findOneAndUpdate(
    { _id: toObjectId(orderId), user_id: userId },
    { $set: updates },
    { returnDocument: ReturnDocument.AFTER },
  );

  return serialize(row);
}

async function deleteForUser(orderId, userId) {
  const result = await ordersCollection().deleteOne({ _id: toObjectId(orderId), user_id: userId });
  return result.deletedCount > 0;
}

module.exports = {
  allowedUpdates,
  create,
  deleteForUser,
  findByIdForUser,
  findFiltered,
  findPurchasesByBuyer,
  serialize,
  updateForUser,
};
