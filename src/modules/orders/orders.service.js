const fs = require('fs/promises');
const path = require('path');
const PDFDocument = require('pdfkit');

const { getDb } = require('../../db/mongo');
const { isValidObjectId } = require('../../utils/object-id');
const Part = require('../parts/part.repository');
const Order = require('./order.repository');
const Sale = require('./sale.repository');

const validOrderStatuses = new Set(['pending', 'confirmed', 'delivered', 'canceled']);
const orderAllowedTransitions = {
  pending: new Set(['confirmed', 'canceled']),
  confirmed: new Set(['delivered', 'canceled']),
  delivered: new Set(),
  canceled: new Set(),
};

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

  return lines
    .slice(1)
    .map((line) => {
      const cells = line.split(',');
      return {
        make: String(cells[makeIndex] || '').trim(),
        model: String(cells[modelIndex] || '').trim(),
      };
    })
    .filter((row) => row.make && row.model);
}

function sortedUnique(values) {
  return [...new Set(values)].sort();
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

function parsePagination(query) {
  const page = parseInteger(query.page ?? 1);
  const limit = parseInteger(query.limit ?? 20);
  if (page === null || limit === null) {
    return { error: 'page/limit must be integer' };
  }

  return {
    page: Math.max(1, page),
    limit: Math.max(1, Math.min(100, limit)),
  };
}

function currentLocalDate() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function parseReportDate(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return { date: currentLocalDate() };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return { error: 'date must use YYYY-MM-DD format' };
  }

  const [year, month, day] = raw.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) {
    return { error: 'date must use YYYY-MM-DD format' };
  }

  return { date: parsed };
}

function formatDate(dateValue) {
  return `${dateValue.getFullYear()}-${String(dateValue.getMonth() + 1).padStart(2, '0')}-${String(
    dateValue.getDate(),
  ).padStart(2, '0')}`;
}

async function hasValidMakeModel(make, model) {
  const options = await loadMakeModelOptions();
  if (!options.length) {
    return true;
  }

  return options.some(
    (row) =>
      row.make.trim().toLowerCase() === String(make).trim().toLowerCase() &&
      row.model.trim().toLowerCase() === String(model).trim().toLowerCase(),
  );
}

async function getOptions(userId, query) {
  const make = String(query.make || '')
    .trim()
    .toLowerCase();
  const model = String(query.model || '')
    .trim()
    .toLowerCase();
  const yearRaw = query.year;
  const options = await loadMakeModelOptions();
  const makes = sortedUnique(options.map((row) => row.make));
  let filteredOptions = options;
  if (make) {
    filteredOptions = filteredOptions.filter((row) => row.make.trim().toLowerCase() === make);
  }
  const models = sortedUnique(filteredOptions.map((row) => row.model));
  const years = [];
  for (let year = new Date().getUTCFullYear() + 1; year >= 1980; year -= 1) {
    years.push(year);
  }

  let filterYear;
  if (yearRaw) {
    filterYear = parseInteger(yearRaw);
    if (filterYear === null) {
      return { error: 'year must be integer' };
    }
  }

  const partRows = await Part.findForOrderOptions(userId, { make, model, year: filterYear });
  const parts = partRows.map((part) => ({
    id: part.id,
    name: part.name,
    category: part.category,
    make: part.make,
    model: part.model,
    year: part.year,
    price: part.price,
    available_quantity: part.quantity || 0,
  }));

  return { years, makes, models, parts };
}

async function getAgencyUserIds() {
  const rows = await getDb().collection('users').find({ role: 'admin' }, { projection: { _id: 1 } }).toArray();
  return rows.map((row) => String(row._id));
}

function buyVin() {
  const now = new Date();
  const stamp = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(
    now.getUTCDate(),
  ).padStart(2, '0')}${String(now.getUTCHours()).padStart(2, '0')}${String(now.getUTCMinutes()).padStart(
    2,
    '0',
  )}${String(now.getUTCSeconds()).padStart(2, '0')}`;
  return `BUY-${stamp}`;
}

async function purchaseMarketplaceProduct(currentUser, payload) {
  const partId = payload.part_id;
  if (!isValidObjectId(partId)) {
    return { status: 400, error: 'Invalid part id' };
  }

  const quantity = parseInteger(Object.hasOwn(payload, 'quantity') ? payload.quantity : 1);
  if (quantity === null) {
    return { status: 400, error: 'quantity must be integer' };
  }
  if (quantity <= 0) {
    return { status: 400, error: 'quantity must be > 0' };
  }

  const rawPart = await Part.findRawById(partId);
  if (!rawPart) {
    return { status: 404, error: 'Part not found' };
  }

  const sellerId = String(rawPart.user_id || '');
  if (sellerId === String(currentUser._id)) {
    return { status: 400, error: 'You can not buy your own product' };
  }

  const updatedPart = await Part.reserveStock(partId, sellerId, quantity);
  if (!updatedPart) {
    return { status: 400, error: 'insufficient stock' };
  }

  const make = String(updatedPart.make || 'N/A').trim() || 'N/A';
  const model = String(updatedPart.model || 'N/A').trim() || 'N/A';
  const year = parseInteger(updatedPart.year || new Date().getUTCFullYear());
  const unitPrice = Number(updatedPart.price || 0);
  const buyerName = String(currentUser.name || currentUser.email || 'Cliente').trim();
  const buyerVin = String(payload.vin || buyVin()).trim().toUpperCase();
  const order = await Order.create({
    user_id: sellerId,
    buyer_id: String(currentUser._id),
    client_name: buyerName,
    vin: buyerVin,
    make,
    year,
    model,
    part_id: partId,
    part_name: updatedPart.name,
    quantity,
    unit_price: unitPrice,
    total_price: Math.round(unitPrice * quantity * 100) / 100,
    status: 'pending',
  });

  return { order };
}

async function createSellerOrder(currentUser, payload) {
  const required = ['client_name', 'vin', 'make', 'year', 'model', 'part_id', 'quantity'];
  const errors = required.filter((field) => !Object.hasOwn(payload, field)).map((field) => `${field} is required`);
  if (errors.length) {
    return { errors };
  }

  const partId = payload.part_id;
  if (!isValidObjectId(partId)) {
    return { status: 400, error: 'Invalid part id' };
  }

  const quantity = parseInteger(payload.quantity);
  const year = parseInteger(payload.year);
  if (quantity === null || year === null) {
    return { status: 400, error: 'quantity/year types are invalid' };
  }
  if (quantity <= 0) {
    return { status: 400, error: 'quantity must be > 0' };
  }

  const make = String(payload.make || '').trim();
  if (!make) {
    return { status: 400, error: 'make must not be empty' };
  }

  const model = String(payload.model || '').trim();
  if (!model) {
    return { status: 400, error: 'model must not be empty' };
  }

  if (!(await hasValidMakeModel(make, model))) {
    return { status: 400, error: 'make/model not available in maintenance_costs dataset' };
  }

  const userId = String(currentUser._id);
  const part = await Part.findRawByIdForUser(partId, userId);
  if (!part) {
    return { status: 404, error: 'Part not found' };
  }

  if (String(part.make || '').trim().toLowerCase() !== make.toLowerCase() || String(part.model || '').trim().toLowerCase() !== model.toLowerCase()) {
    return { status: 400, error: 'selected part does not match make/model' };
  }

  const updatedPart = await Part.reserveStock(partId, userId, quantity);
  if (!updatedPart) {
    return { status: 400, error: 'insufficient stock' };
  }

  const unitPrice = Number(updatedPart.price || 0);
  const requestedStatus = String(payload.status || 'pending')
    .trim()
    .toLowerCase();
  if (requestedStatus !== 'pending') {
    return { status: 400, error: 'initial status must be pending' };
  }

  const order = await Order.create({
    user_id: userId,
    client_name: String(payload.client_name || '').trim(),
    vin: String(payload.vin || '').trim().toUpperCase(),
    make,
    year,
    model,
    part_id: partId,
    part_name: updatedPart.name,
    quantity,
    unit_price: unitPrice,
    total_price: Math.round(unitPrice * quantity * 100) / 100,
    status: 'pending',
  });

  return { order };
}

function transitionError(currentStatus, nextStatus) {
  if (nextStatus === currentStatus) {
    return null;
  }

  const allowedNext = orderAllowedTransitions[currentStatus] || new Set();
  if (!allowedNext.has(nextStatus)) {
    return `invalid status transition: ${currentStatus} -> ${nextStatus}`;
  }

  return null;
}

async function updateSellerOrder(orderId, userId, payload) {
  const current = await Order.findByIdForUser(orderId, userId);
  if (!current) {
    return { status: 404, error: 'Order not found' };
  }

  const updates = Order.allowedUpdates(payload);
  if (!Object.keys(updates).length) {
    return { status: 400, error: 'empty payload' };
  }

  let shouldRecordSale = false;
  if (Object.hasOwn(updates, 'status')) {
    updates.status = String(updates.status).trim().toLowerCase();
    if (!validOrderStatuses.has(updates.status)) {
      return { status: 400, error: 'invalid status' };
    }

    const currentStatus = String(current.status || 'pending').trim().toLowerCase();
    const nextStatus = updates.status;
    const invalidTransition = transitionError(currentStatus, nextStatus);
    if (invalidTransition) {
      return { status: 409, error: invalidTransition };
    }
    shouldRecordSale = nextStatus !== currentStatus && nextStatus === 'delivered';
  }

  if (Object.hasOwn(updates, 'year')) {
    updates.year = parseInteger(updates.year);
    if (updates.year === null) {
      return { status: 400, error: 'year must be integer' };
    }
  }

  if (Object.hasOwn(updates, 'vin')) {
    updates.vin = String(updates.vin).trim().toUpperCase();
  }

  if (Object.hasOwn(updates, 'make')) {
    updates.make = String(updates.make).trim();
    if (!updates.make) {
      return { status: 400, error: 'make must not be empty' };
    }
  }

  if (Object.hasOwn(updates, 'model')) {
    updates.model = String(updates.model).trim();
    if (!updates.model) {
      return { status: 400, error: 'model must not be empty' };
    }
  }

  if (Object.hasOwn(updates, 'make') || Object.hasOwn(updates, 'model')) {
    const currentMake = updates.make ?? current.make;
    const currentModel = updates.model ?? current.model;
    if (!(await hasValidMakeModel(currentMake, currentModel))) {
      return { status: 400, error: 'make/model not available in maintenance_costs dataset' };
    }
  }

  const order = await Order.updateForUser(orderId, userId, updates);
  if (!order) {
    return { status: 404, error: 'Order not found' };
  }

  if (shouldRecordSale) {
    await Sale.createFromOrder(order);
  }

  return { order };
}

async function deleteSellerOrder(orderId, userId) {
  const order = await Order.findByIdForUser(orderId, userId);
  if (!order) {
    return { status: 404, error: 'Order not found' };
  }

  const deleted = await Order.deleteForUser(orderId, userId);
  if (!deleted) {
    return { status: 404, error: 'Order not found' };
  }

  const quantity = parseInteger(order.quantity || 0);
  if (isValidObjectId(order.part_id) && quantity > 0) {
    await Part.restoreStock(order.part_id, userId, quantity);
  }

  return {};
}

function writeSalesPdfReport(report, writable) {
  const doc = new PDFDocument({ size: 'LETTER', margin: 40 });
  doc.pipe(writable);

  doc.font('Helvetica-Bold').fontSize(14).text('Reporte Diario de Ventas Concretadas');
  doc.moveDown(0.4);
  doc.font('Helvetica').fontSize(10).text(`Fecha: ${report.date || 'N/A'}`);
  doc.text(`Total ventas: $${report.total_sales || 0.0}`);
  doc.text(`Ventas concretadas: ${report.delivered_count || 0}`);
  doc.moveDown(1);

  const xs = [40, 110, 250, 460, 520];
  const headers = ['Hora', 'Cliente', 'Producto', 'Cantidad', 'Total'];
  doc.font('Helvetica-Bold').fontSize(9);
  headers.forEach((header, index) => doc.text(header, xs[index], doc.y, { continued: index < headers.length - 1 }));
  doc.text('');
  doc.moveTo(40, doc.y).lineTo(572, doc.y).stroke();
  doc.moveDown(0.5);
  doc.font('Helvetica').fontSize(8);

  for (const row of report.items || []) {
    if (doc.y > 730) {
      doc.addPage();
      doc.font('Helvetica').fontSize(8);
    }

    const soldAt = String(row.sold_at || '').slice(0, 19).replace('T', ' ');
    const cols = [
      soldAt.length >= 16 ? soldAt.slice(11, 16) : '',
      String(row.client_name || '').slice(0, 22),
      String(row.part_name || '').slice(0, 34),
      String(row.quantity || 0),
      String(row.total_price || 0.0),
    ];
    const y = doc.y;
    cols.forEach((value, index) => doc.text(value, xs[index], y));
    doc.y = y + 12;
  }

  doc.end();
}

module.exports = {
  createSellerOrder,
  deleteSellerOrder,
  formatDate,
  getAgencyUserIds,
  getOptions,
  hasValidMakeModel,
  loadMakeModelOptions,
  orderAllowedTransitions,
  parseInteger,
  parsePagination,
  parseReportDate,
  purchaseMarketplaceProduct,
  transitionError,
  updateSellerOrder,
  validOrderStatuses,
  writeSalesPdfReport,
};
