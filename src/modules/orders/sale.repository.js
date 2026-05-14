const { ObjectId } = require('mongodb');

const { getDb } = require('../../db/mongo');
const { isValidObjectId } = require('../../utils/object-id');

const COLLECTION = 'sales';

function salesCollection() {
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
    order_id: nullable(item.order_id),
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
    status: item.status || 'delivered',
    sold_at: toIso(item.sold_at),
    created_at: toIso(item.created_at),
    updated_at: toIso(item.updated_at),
  };
}

async function createFromOrder(order) {
  if (!order || !order.id || !isValidObjectId(order.id)) {
    return null;
  }

  const existing = await salesCollection().findOne({ order_id: order.id });
  if (existing) {
    return serialize(existing);
  }

  const soldAt = new Date();
  const item = {
    order_id: order.id,
    user_id: order.user_id,
    buyer_id: order.buyer_id,
    client_name: order.client_name,
    vin: order.vin,
    make: order.make,
    year: order.year,
    model: order.model,
    part_id: order.part_id,
    part_name: order.part_name,
    quantity: order.quantity,
    unit_price: order.unit_price,
    total_price: order.total_price,
    status: 'delivered',
    order_created_at: order.created_at,
    sold_at: soldAt,
    created_at: soldAt,
    updated_at: soldAt,
  };

  const inserted = await salesCollection().insertOne(item);
  item._id = inserted.insertedId;
  return serialize(item);
}

function dayBounds(reportDate) {
  const start = new Date(Date.UTC(reportDate.getFullYear(), reportDate.getMonth(), reportDate.getDate(), 0, 0, 0, 0));
  const end = new Date(Date.UTC(reportDate.getFullYear(), reportDate.getMonth(), reportDate.getDate(), 23, 59, 59, 999));
  return { start, end };
}

async function getDailyReportForSeller(sellerId, reportDate) {
  const { start, end } = dayBounds(reportDate);
  const salesRows = await salesCollection()
    .find({ user_id: sellerId, sold_at: { $gte: start, $lte: end } })
    .sort({ sold_at: -1 })
    .toArray();
  const items = salesRows.map(serialize);
  const totalSales = Math.round(items.reduce((sum, row) => sum + Number(row.total_price || 0), 0) * 100) / 100;
  const ordersRows = await getDb()
    .collection('orders')
    .find({ user_id: sellerId, created_at: { $gte: start, $lte: end } })
    .toArray();

  const pending = ordersRows.filter((row) => String(row.status || '').toLowerCase() === 'pending').length;
  const confirmed = ordersRows.filter((row) => String(row.status || '').toLowerCase() === 'confirmed').length;
  const canceled = ordersRows.filter((row) => String(row.status || '').toLowerCase() === 'canceled').length;

  return {
    date: `${reportDate.getFullYear()}-${String(reportDate.getMonth() + 1).padStart(2, '0')}-${String(
      reportDate.getDate(),
    ).padStart(2, '0')}`,
    total_orders: items.length,
    total_sales: totalSales,
    pending_count: pending,
    confirmed_count: confirmed,
    delivered_count: items.length,
    canceled_count: canceled,
    items,
  };
}

module.exports = {
  createFromOrder,
  getDailyReportForSeller,
  serialize,
  _dayBounds: dayBounds,
  _ObjectId: ObjectId,
};
