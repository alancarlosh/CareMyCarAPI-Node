const express = require('express');

const { tokenRequired } = require('../../middleware/auth');
const asyncHandler = require('../../utils/async-handler');
const { isValidObjectId } = require('../../utils/object-id');
const { validateServiceOrderPayload } = require('../../utils/validators');
const Maintenance = require('../maintenance/maintenance.repository');
const Vehicle = require('../vehicles/vehicle.repository');
const ServiceOrder = require('./service-order.repository');
const ServiceOrdersService = require('./service-orders.service');

const router = express.Router();

router.use(tokenRequired);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const payload = req.body || {};
    const errors = validateServiceOrderPayload(payload, false);
    if (errors.length) {
      return res.status(400).json({ errors });
    }

    const vehicleId = payload.vehicle_id;
    if (!isValidObjectId(vehicleId)) {
      return res.status(400).json({ error: 'ID de vehículo inválido' });
    }

    const userId = String(req.currentUser._id);
    const vehicle = await Vehicle.findByIdForUser(vehicleId, userId);
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehículo no encontrado' });
    }

    const history = await Maintenance.findByVehicle(userId, vehicleId);
    const quote = ServiceOrdersService.buildQuote(vehicle, history, payload.service_type);
    const order = await ServiceOrder.create({
      user_id: userId,
      vehicle_id: vehicleId,
      vehicle_snapshot: {
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
      },
      service_type: payload.service_type,
      scheduled_date: payload.scheduled_date,
      status: 'PROGRAMADO',
      estimated_cost: quote.suggested_total_mxn,
      predicted_service_type: quote.service_key,
      cost_breakdown: {
        prediction: quote.prediction,
        products: quote.products,
        products_total_mxn: quote.products_total_mxn,
        labor_total_mxn: quote.labor_total_mxn,
      },
      user_notes: payload.user_notes,
      completion_token: ServiceOrdersService.generateCompletionToken(),
    });

    return res.status(201).json({ order, quote });
  }),
);

router.post(
  '/quote/:vehicleId',
  asyncHandler(async (req, res) => {
    const { vehicleId } = req.params;
    if (!isValidObjectId(vehicleId)) {
      return res.status(400).json({ error: 'ID de vehículo inválido' });
    }

    const userId = String(req.currentUser._id);
    const vehicle = await Vehicle.findByIdForUser(vehicleId, userId);
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehículo no encontrado' });
    }

    const payload = req.body || {};
    const serviceType = payload.service_type;
    if (!serviceType) {
      return res.status(400).json({ error: 'service_type es obligatorio' });
    }

    const history = await Maintenance.findByVehicle(userId, vehicleId);
    const quote = ServiceOrdersService.buildQuote(vehicle, history, serviceType);
    return res.status(200).json({ vehicle_id: vehicleId, service_type: serviceType, quote });
  }),
);

router.get(
  '/my',
  asyncHandler(async (req, res) => {
    const items = await ServiceOrder.findByUser(String(req.currentUser._id));
    return res.status(200).json({ items });
  }),
);

router.get(
  '/report',
  asyncHandler(async (req, res) => {
    if (!ServiceOrdersService.isAdmin(req.currentUser)) {
      return res.status(403).json({ error: 'Prohibido' });
    }

    const dateFrom = String(req.query.from || '').trim();
    const dateTo = String(req.query.to || '').trim();
    const status = String(req.query.status || 'FINALIZADO')
      .trim()
      .toUpperCase();
    const filters = status ? { status } : {};
    let rows = await ServiceOrder.findAll({ filters });
    rows = await ServiceOrdersService.attachUserInfo(rows);

    if (dateFrom) {
      rows = rows.filter((row) => String(row.scheduled_date || '') >= dateFrom);
    }
    if (dateTo) {
      rows = rows.filter((row) => String(row.scheduled_date || '') <= dateTo);
    }

    const filename = `service_orders_report_${ServiceOrdersService.reportTimestamp()}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return ServiceOrdersService.writePdfReport(rows, dateFrom, dateTo, res);
  }),
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    if (!ServiceOrdersService.isAdmin(req.currentUser)) {
      return res.status(403).json({ error: 'Prohibido' });
    }

    const status = String(req.query.status || '')
      .trim()
      .toUpperCase();
    const filters = {};
    if (status) {
      filters.status = status;
    }

    const items = await ServiceOrdersService.attachUserInfo(await ServiceOrder.findAll({ filters }));
    return res.status(200).json({ items });
  }),
);

router.patch(
  '/:orderId/start',
  asyncHandler(async (req, res) => {
    if (!ServiceOrdersService.isAdmin(req.currentUser)) {
      return res.status(403).json({ error: 'Prohibido' });
    }

    const { orderId } = req.params;
    if (!isValidObjectId(orderId)) {
      return res.status(400).json({ error: 'ID de orden inválido' });
    }

    const order = await ServiceOrder.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Orden no encontrada' });
    }
    if (order.status !== 'PROGRAMADO') {
      return res.status(409).json({ error: 'Solo órdenes PROGRAMADO pueden pasar a EN_PROCESO' });
    }

    const payload = req.body || {};
    const updated = await ServiceOrder.update(orderId, {
      status: 'EN_PROCESO',
      check_in_at: new Date(),
      agency_notes: payload.agency_notes,
    });
    return res.status(200).json({ order: updated });
  }),
);

router.patch(
  '/:orderId/complete',
  asyncHandler(async (req, res) => {
    if (!ServiceOrdersService.isAdmin(req.currentUser)) {
      return res.status(403).json({ error: 'Prohibido' });
    }

    const { orderId } = req.params;
    if (!isValidObjectId(orderId)) {
      return res.status(400).json({ error: 'ID de orden inválido' });
    }

    const payload = req.body || {};
    const errors = validateServiceOrderPayload(payload, true);
    if (errors.length) {
      return res.status(400).json({ errors });
    }

    const order = await ServiceOrder.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Orden no encontrada' });
    }
    if (order.status !== 'EN_PROCESO') {
      return res.status(409).json({ error: 'Solo órdenes EN_PROCESO pueden finalizarse' });
    }

    const providedToken = String(payload.completion_token || '').trim();
    if (!providedToken || providedToken !== String(order.completion_token || '')) {
      return res.status(400).json({ error: 'Token de finalización inválido' });
    }

    const updated = await ServiceOrder.update(orderId, {
      status: 'FINALIZADO',
      final_cost: payload.final_cost !== undefined && payload.final_cost !== null ? payload.final_cost : order.estimated_cost,
      agency_notes: payload.agency_notes,
      completed_at: new Date(),
    });

    await Maintenance.create(order.user_id, {
      vehicle_id: order.vehicle_id,
      service_type: order.service_type,
      service_date: ServiceOrdersService.todayIsoDate(),
      description: `Orden de servicio finalizada (${updated.id})`,
      cost: updated.final_cost,
      mileage: payload.mileage,
    });

    return res.status(200).json({ order: updated });
  }),
);

router.patch(
  '/:orderId/cancel',
  asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    if (!isValidObjectId(orderId)) {
      return res.status(400).json({ error: 'ID de orden inválido' });
    }

    const isAdmin = ServiceOrdersService.isAdmin(req.currentUser);
    const order = isAdmin
      ? await ServiceOrder.findById(orderId)
      : await ServiceOrder.findByIdForUser(orderId, String(req.currentUser._id));
    if (!order) {
      return res.status(404).json({ error: 'Orden no encontrada' });
    }
    if (order.status === 'FINALIZADO' || order.status === 'CANCELADO') {
      return res.status(409).json({ error: 'La orden no se puede cancelar en el estado actual' });
    }

    const payload = req.body || {};
    const updated = await ServiceOrder.update(orderId, {
      status: 'CANCELADO',
      agency_notes: payload.agency_notes,
    });
    return res.status(200).json({ order: updated });
  }),
);

module.exports = router;
