const { ObjectId } = require('mongodb');
const PDFDocument = require('pdfkit');

const { getDb } = require('../../db/mongo');
const { isValidObjectId } = require('../../utils/object-id');
const { estimateNextMaintenanceCost } = require('../predictions/prediction-fallback.service');

const serviceTypeAliases = {
  'cambio de aceite': 'oil_change',
  'oil change': 'oil_change',
  afinacion: 'minor_service',
  afinação: 'minor_service',
  'servicio general': 'major_service',
  'general service': 'major_service',
  frenos: 'brake_service',
  'brake service': 'brake_service',
  llantas: 'tire_service',
  'tire service': 'tire_service',
};

const serviceProducts = {
  oil_change: [
    { sku: 'aceite_5w30', name: 'Aceite 5W30 (4L)', qty: 1, unit_price_mxn: 780 },
    { sku: 'filtro_aceite', name: 'Filtro de aceite', qty: 1, unit_price_mxn: 230 },
  ],
  minor_service: [
    { sku: 'aceite_5w30', name: 'Aceite 5W30 (4L)', qty: 1, unit_price_mxn: 780 },
    { sku: 'filtro_aceite', name: 'Filtro de aceite', qty: 1, unit_price_mxn: 230 },
    { sku: 'filtro_aire', name: 'Filtro de aire', qty: 1, unit_price_mxn: 310 },
  ],
  major_service: [
    { sku: 'aceite_5w30', name: 'Aceite 5W30 (4L)', qty: 1, unit_price_mxn: 780 },
    { sku: 'filtro_aceite', name: 'Filtro de aceite', qty: 1, unit_price_mxn: 230 },
    { sku: 'filtro_aire', name: 'Filtro de aire', qty: 1, unit_price_mxn: 310 },
    { sku: 'filtro_cabina', name: 'Filtro de cabina', qty: 1, unit_price_mxn: 280 },
  ],
  brake_service: [
    { sku: 'balatas_del', name: 'Juego de balatas delanteras', qty: 1, unit_price_mxn: 950 },
    { sku: 'liq_frenos', name: 'Líquido de frenos', qty: 1, unit_price_mxn: 270 },
  ],
  tire_service: [
    { sku: 'valvulas', name: 'Juego de válvulas', qty: 1, unit_price_mxn: 120 },
    { sku: 'balanceo', name: 'Plomos de balanceo', qty: 1, unit_price_mxn: 160 },
  ],
};

function isAdmin(user) {
  return String(user.role || 'user').toLowerCase() === 'admin';
}

function normalizeServiceType(raw) {
  const value = String(raw || '')
    .trim()
    .toLowerCase();
  return serviceTypeAliases[value] || value.replaceAll(' ', '_') || 'major_service';
}

function round2(value) {
  return Math.round(Number(value) * 100) / 100;
}

function buildQuote(vehicle, history, serviceTypeRaw) {
  const serviceKey = normalizeServiceType(serviceTypeRaw);
  const prediction = estimateNextMaintenanceCost(vehicle, history, serviceKey);
  const predictedTotal = Number(prediction.estimated_cost_mxn || 0);
  const products = serviceProducts[serviceKey] || [];
  const productsTotal = products.reduce((sum, line) => sum + Number(line.qty || 0) * Number(line.unit_price_mxn || 0), 0);
  const laborTotal = round2(Math.max(predictedTotal * 0.35, 350.0));
  const suggestedTotal = round2(Math.max(predictedTotal, productsTotal + laborTotal));

  return {
    service_key: serviceKey,
    prediction,
    products,
    products_total_mxn: round2(productsTotal),
    labor_total_mxn: laborTotal,
    suggested_total_mxn: suggestedTotal,
  };
}

function generateCompletionToken() {
  return String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
}

async function attachUserInfo(rows) {
  const userIds = rows.map((row) => row.user_id).filter((userId) => userId && isValidObjectId(userId));
  const users = await getDb()
    .collection('users')
    .find({ _id: { $in: userIds.map((userId) => new ObjectId(userId)) } })
    .toArray();
  const usersById = {};

  for (const user of users) {
    usersById[String(user._id)] = { email: user.email, name: user.name };
  }

  return rows.map((row) => {
    const info = usersById[row.user_id] || {};
    row.user_email = info.email ?? null;
    row.user_name = info.name ?? null;
    return row;
  });
}

function todayIsoDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function reportTimestamp() {
  const now = new Date();
  return `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(
    2,
    '0',
  )}_${String(now.getUTCHours()).padStart(2, '0')}${String(now.getUTCMinutes()).padStart(2, '0')}${String(
    now.getUTCSeconds(),
  ).padStart(2, '0')}`;
}

function writePdfReport(rows, dateFrom, dateTo, writable) {
  const doc = new PDFDocument({ size: 'LETTER', margin: 40 });
  doc.pipe(writable);

  doc.font('Helvetica-Bold').fontSize(14).text('Reporte de Vehiculos en Servicio');
  doc.moveDown(0.4);
  doc.font('Helvetica').fontSize(10).text(`Rango: ${dateFrom || 'N/A'} a ${dateTo || 'N/A'}`);
  doc.moveDown(1);

  const xs = [40, 110, 220, 330, 430, 500];
  const headers = ['Fecha', 'Cliente', 'Vehiculo', 'Servicio', 'Estado', 'Costo final'];
  doc.font('Helvetica-Bold').fontSize(9);
  const headerY = doc.y;
  headers.forEach((header, idx) => doc.text(header, xs[idx], headerY));
  doc.y = headerY + 12;
  doc.moveTo(40, doc.y).lineTo(572, doc.y).stroke();
  doc.moveDown(0.5);
  doc.font('Helvetica').fontSize(8);

  for (const row of rows) {
    if (doc.y > 730) {
      doc.addPage();
      doc.font('Helvetica').fontSize(8);
    }
    const snapshot = row.vehicle_snapshot || {};
    const vehicleLabel = `${snapshot.make || ''} ${snapshot.model || ''}`.trim() || row.vehicle_id || '';
    const customer = row.user_name || row.user_email || row.user_id;
    const cols = [
      row.scheduled_date || '',
      String(customer || '').slice(0, 20),
      String(vehicleLabel).slice(0, 22),
      String(row.service_type || '').slice(0, 20),
      String(row.status || ''),
      String(row.final_cost || row.estimated_cost || ''),
    ];
    const y = doc.y;
    cols.forEach((value, idx) => doc.text(value, xs[idx], y));
    doc.y = y + 12;
  }

  doc.end();
}

module.exports = {
  attachUserInfo,
  buildQuote,
  generateCompletionToken,
  isAdmin,
  normalizeServiceType,
  reportTimestamp,
  serviceProducts,
  serviceTypeAliases,
  todayIsoDate,
  writePdfReport,
};
