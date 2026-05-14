const { ReturnDocument } = require('mongodb');

const { getDb } = require('../../db/mongo');
const { toObjectId } = require('../../utils/object-id');

const COLLECTION = 'parts';
const updatableFields = new Set(['name', 'category', 'make', 'year', 'model', 'compatibility', 'price', 'quantity']);

function partsCollection() {
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
    name: nullable(item.name),
    category: nullable(item.category),
    make: nullable(item.make),
    year: nullable(item.year),
    model: nullable(item.model),
    compatibility: item.compatibility || [],
    price: nullable(item.price),
    quantity: nullable(item.quantity),
    created_at: toIso(item.created_at),
    updated_at: toIso(item.updated_at),
  };
}

function buildFilter({ userId, agencyUserIds, q = '', category = '', marketplace = false }) {
  const query = marketplace ? { quantity: { $gt: 0 } } : { user_id: userId };

  if (marketplace && agencyUserIds && agencyUserIds.length) {
    query.user_id = { $in: agencyUserIds };
  }

  if (q) {
    query.$or = [
      { name: { $regex: q, $options: 'i' } },
      { make: { $regex: q, $options: 'i' } },
      { model: { $regex: q, $options: 'i' } },
      { category: { $regex: q, $options: 'i' } },
      { compatibility: { $elemMatch: { $regex: q, $options: 'i' } } },
    ];
  }

  if (category && category !== 'all') {
    query.category = category;
  }

  return query;
}

async function create(userId, payload) {
  const now = new Date();
  const item = {
    user_id: userId,
    name: payload.name,
    category: payload.category,
    make: payload.make,
    year: payload.year,
    model: payload.model,
    compatibility: payload.compatibility || [],
    price: payload.price,
    quantity: payload.quantity,
    created_at: now,
    updated_at: now,
  };

  const inserted = await partsCollection().insertOne(item);
  item._id = inserted.insertedId;
  return serialize(item);
}

async function findFiltered(userId, { q = '', category = '', page = 1, limit = 20 } = {}) {
  const query = buildFilter({ userId, q, category });
  const total = await partsCollection().countDocuments(query);
  const rows = await partsCollection()
    .find(query)
    .sort({ created_at: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .toArray();

  return { items: rows.map(serialize), total };
}

async function findByIdForUser(partId, userId) {
  const row = await partsCollection().findOne({ _id: toObjectId(partId), user_id: userId });
  return serialize(row);
}

async function findRawByIdForUser(partId, userId) {
  return partsCollection().findOne({ _id: toObjectId(partId), user_id: userId });
}

async function findRawById(partId) {
  return partsCollection().findOne({ _id: toObjectId(partId) });
}

async function findMarketplaceFiltered({ agencyUserIds, q = '', category = '', page = 1, limit = 20 } = {}) {
  const query = buildFilter({ agencyUserIds, q, category, marketplace: true });
  const total = await partsCollection().countDocuments(query);
  const rows = await partsCollection()
    .find(query)
    .sort({ created_at: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .toArray();

  return { items: rows.map(serialize), total };
}

async function findForOrderOptions(userId, { make = '', model = '', year } = {}) {
  const query = { user_id: userId };
  if (make) {
    query.make = { $regex: `^${make}$`, $options: 'i' };
  }
  if (model) {
    query.$or = [
      { model: { $regex: `^${model}$`, $options: 'i' } },
      { compatibility: { $elemMatch: { $regex: `^${model}$`, $options: 'i' } } },
    ];
  }
  if (year !== undefined && year !== null) {
    query.year = year;
  }

  const rows = await partsCollection().find(query).sort({ created_at: -1 }).toArray();
  return rows.map(serialize);
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

async function updateForUser(partId, userId, payload) {
  const updates = allowedUpdates(payload);
  if (!Object.keys(updates).length) {
    return null;
  }

  updates.updated_at = new Date();
  const row = await partsCollection().findOneAndUpdate(
    { _id: toObjectId(partId), user_id: userId },
    { $set: updates },
    { returnDocument: ReturnDocument.AFTER },
  );

  return serialize(row);
}

async function reserveStock(partId, userId, quantity) {
  return partsCollection().findOneAndUpdate(
    { _id: toObjectId(partId), user_id: userId, quantity: { $gte: quantity } },
    { $inc: { quantity: -quantity }, $set: { updated_at: new Date() } },
    { returnDocument: ReturnDocument.AFTER },
  );
}

async function restoreStock(partId, userId, quantity) {
  await partsCollection().updateOne(
    { _id: toObjectId(partId), user_id: userId },
    { $inc: { quantity }, $set: { updated_at: new Date() } },
  );
}

async function deleteForUser(partId, userId) {
  const result = await partsCollection().deleteOne({ _id: toObjectId(partId), user_id: userId });
  return result.deletedCount > 0;
}

module.exports = {
  allowedUpdates,
  create,
  deleteForUser,
  findByIdForUser,
  findFiltered,
  findForOrderOptions,
  findMarketplaceFiltered,
  findRawById,
  findRawByIdForUser,
  reserveStock,
  restoreStock,
  serialize,
  updateForUser,
};
