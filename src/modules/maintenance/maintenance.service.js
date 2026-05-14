const { ObjectId } = require('mongodb');

const { getDb } = require('../../db/mongo');
const { isValidObjectId } = require('../../utils/object-id');
const Maintenance = require('./maintenance.repository');
const MaintenanceDue = require('./maintenance-due.repository');

const serviceRules = [
  { key: 'oil_change', label: 'Cambio de aceite', interval_km: 5000, interval_months: 5 },
  { key: 'tire_rotation', label: 'Rotación de llantas', interval_km: 10000, interval_months: 6 },
  { key: 'brake_check', label: 'Revisión de frenos', interval_km: 15000, interval_months: 12 },
  { key: 'general_service', label: 'Servicio general', interval_km: 20000, interval_months: 12 },
];

const serviceTypeAliases = {
  'cambio de aceite': 'oil_change',
  'oil change': 'oil_change',
  afinacion: 'general_service',
  afinação: 'general_service',
  'servicio general': 'general_service',
  'general service': 'general_service',
  'rotacion de llantas': 'tire_rotation',
  'alineacion y balanceo': 'tire_rotation',
  frenos: 'brake_check',
  'revision de frenos': 'brake_check',
};

function normalizeServiceType(value) {
  const raw = String(value || '')
    .trim()
    .toLowerCase();
  return serviceTypeAliases[raw] || raw.replaceAll(' ', '_');
}

function safeParseDate(dateValue) {
  if (!dateValue) {
    return null;
  }

  const raw = String(dateValue);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return null;
  }

  const [year, month, day] = raw.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) {
    return null;
  }

  return parsed;
}

function formatDate(dateValue) {
  const year = dateValue.getFullYear();
  const month = String(dateValue.getMonth() + 1).padStart(2, '0');
  const day = String(dateValue.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addMonths(baseDate, months) {
  const year = baseDate.getFullYear() + Math.floor((baseDate.getMonth() + months) / 12);
  const month = (baseDate.getMonth() + months) % 12;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const day = Math.min(baseDate.getDate(), lastDay);
  return new Date(year, month, day);
}

function todayDate() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function differenceInDays(laterDate, earlierDate) {
  return Math.round((laterDate.getTime() - earlierDate.getTime()) / 86400000);
}

function toInteger(value) {
  if (typeof value === 'boolean') {
    return Number(value);
  }

  return Number.parseInt(value || 0, 10);
}

async function computeVehicleDue(currentUser, vehicle) {
  const userId = String(currentUser._id);
  const vehicleId = vehicle.id;
  const history = await Maintenance.findByVehicle(userId, vehicleId);
  const currentMileage = toInteger(vehicle.current_mileage);
  const acquisition = safeParseDate(vehicle.acquisition_date);
  const createdAt = safeParseDate(String(vehicle.created_at || '').slice(0, 10));
  const baseDateDefault = acquisition || createdAt || todayDate();

  const lastByType = {};
  for (const record of history) {
    const typeKey = normalizeServiceType(record.service_type);
    const serviceDate = safeParseDate(record.service_date);
    if (!serviceDate) {
      continue;
    }

    if (!lastByType[typeKey] || serviceDate > lastByType[typeKey].service_date) {
      lastByType[typeKey] = {
        service_date: serviceDate,
        mileage: toInteger(record.mileage),
      };
    }
  }

  const today = todayDate();
  const dueItems = [];

  for (const rule of serviceRules) {
    const last = lastByType[rule.key];
    const baseDate = last ? last.service_date : baseDateDefault;
    const baseKm = last ? last.mileage : 0;
    const dueDate = addMonths(baseDate, rule.interval_months);
    const dueKm = baseKm + rule.interval_km;
    const daysLeft = differenceInDays(dueDate, today);
    const kmLeft = dueKm - currentMileage;
    const isDue = daysLeft <= 0 || kmLeft <= 0;
    const isUpcoming = (daysLeft > 0 && daysLeft <= 30) || (kmLeft > 0 && kmLeft <= 1000);
    const status = isDue ? 'due' : isUpcoming ? 'upcoming' : 'ok';

    dueItems.push({
      service_key: rule.key,
      service_label: rule.label,
      due_date: formatDate(dueDate),
      due_km: dueKm,
      days_left: daysLeft,
      km_left: kmLeft,
      status,
      recommended: status === 'due' || status === 'upcoming',
    });
  }

  const hasDue = dueItems.some((item) => item.status === 'due');
  const hasUpcoming = dueItems.some((item) => item.status === 'upcoming');
  const payload = {
    vehicle_label: `${vehicle.make || ''} ${vehicle.model || ''}`.trim() || 'Vehículo',
    current_mileage: currentMileage,
    items: dueItems,
    has_due: hasDue,
    has_upcoming: hasUpcoming,
  };

  await MaintenanceDue.upsertForVehicle(userId, vehicleId, payload);
  return payload;
}

async function attachUserInfo(rows) {
  const userIds = rows.map((row) => row.user_id).filter((userId) => userId && isValidObjectId(userId));
  const users = await getDb()
    .collection('users')
    .find({ _id: { $in: userIds.map((userId) => new ObjectId(userId)) } })
    .toArray();
  const usersById = {};

  for (const user of users) {
    usersById[String(user._id)] = {
      email: user.email,
      name: user.name,
    };
  }

  return rows.map((row) => {
    const info = usersById[row.user_id] || {};
    row.user_email = info.email ?? null;
    row.user_name = info.name ?? null;
    return row;
  });
}

module.exports = {
  addMonths,
  attachUserInfo,
  computeVehicleDue,
  normalizeServiceType,
  safeParseDate,
};
