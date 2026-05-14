const express = require('express');

const { tokenRequired } = require('../../middleware/auth');
const asyncHandler = require('../../utils/async-handler');
const { isValidObjectId } = require('../../utils/object-id');
const Part = require('../parts/part.repository');
const Order = require('./order.repository');
const OrdersService = require('./orders.service');
const Sale = require('./sale.repository');

const router = express.Router();

router.use(tokenRequired);

router.get(
  '/options',
  asyncHandler(async (req, res) => {
    const options = await OrdersService.getOptions(String(req.currentUser._id), req.query);
    if (options.error) {
      return res.status(400).json({ error: options.error });
    }

    return res.status(200).json(options);
  }),
);

router.get(
  '/marketplace/products',
  asyncHandler(async (req, res) => {
    const parsed = OrdersService.parsePagination(req.query);
    if (parsed.error) {
      return res.status(400).json({ error: parsed.error });
    }

    const agencyUserIds = await OrdersService.getAgencyUserIds();
    const result = await Part.findMarketplaceFiltered({
      agencyUserIds,
      q: String(req.query.q || '').trim(),
      category: String(req.query.category || '').trim(),
      page: parsed.page,
      limit: parsed.limit,
    });

    return res.status(200).json({ items: result.items, total: result.total, page: parsed.page, limit: parsed.limit });
  }),
);

router.post(
  '/marketplace/purchase',
  asyncHandler(async (req, res) => {
    const result = await OrdersService.purchaseMarketplaceProduct(req.currentUser, req.body || {});
    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    return res.status(201).json({ order: result.order });
  }),
);

router.get(
  '/purchases/my',
  asyncHandler(async (req, res) => {
    const parsed = OrdersService.parsePagination(req.query);
    if (parsed.error) {
      return res.status(400).json({ error: parsed.error });
    }

    const status = String(req.query.status || '')
      .trim()
      .toLowerCase();
    if (status && status !== 'all' && !OrdersService.validOrderStatuses.has(status)) {
      return res.status(400).json({ error: 'invalid status' });
    }

    const result = await Order.findPurchasesByBuyer(String(req.currentUser._id), {
      status,
      page: parsed.page,
      limit: parsed.limit,
    });

    return res.status(200).json({ items: result.items, total: result.total, page: parsed.page, limit: parsed.limit });
  }),
);

router.get(
  '/sales/daily-report',
  asyncHandler(async (req, res) => {
    const parsed = OrdersService.parseReportDate(req.query.date);
    if (parsed.error) {
      return res.status(400).json({ error: parsed.error });
    }

    const report = await Sale.getDailyReportForSeller(String(req.currentUser._id), parsed.date);
    return res.status(200).json({ report });
  }),
);

router.get(
  '/sales/daily-report/pdf',
  asyncHandler(async (req, res) => {
    const parsed = OrdersService.parseReportDate(req.query.date);
    if (parsed.error) {
      return res.status(400).json({ error: parsed.error });
    }

    const report = await Sale.getDailyReportForSeller(String(req.currentUser._id), parsed.date);
    const filename = `sales_daily_report_${OrdersService.formatDate(parsed.date)}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return OrdersService.writeSalesPdfReport(report, res);
  }),
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const result = await OrdersService.createSellerOrder(req.currentUser, req.body || {});
    if (result.errors) {
      return res.status(400).json({ errors: result.errors });
    }
    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    return res.status(201).json({ order: result.order });
  }),
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = OrdersService.parsePagination(req.query);
    if (parsed.error) {
      return res.status(400).json({ error: parsed.error });
    }

    const status = String(req.query.status || '')
      .trim()
      .toLowerCase();
    if (status && status !== 'all' && !OrdersService.validOrderStatuses.has(status)) {
      return res.status(400).json({ error: 'invalid status' });
    }

    const result = await Order.findFiltered(String(req.currentUser._id), {
      q: String(req.query.q || '').trim(),
      status,
      page: parsed.page,
      limit: parsed.limit,
    });

    return res.status(200).json({
      items: result.items,
      page: parsed.page,
      limit: parsed.limit,
      total: result.total,
      all_count: result.all_count,
      pending_count: result.pending_count,
    });
  }),
);

router.get(
  '/:orderId',
  asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    if (!isValidObjectId(orderId)) {
      return res.status(400).json({ error: 'Invalid order id' });
    }

    const order = await Order.findByIdForUser(orderId, String(req.currentUser._id));
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    return res.status(200).json({ order });
  }),
);

router.put(
  '/:orderId',
  asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    if (!isValidObjectId(orderId)) {
      return res.status(400).json({ error: 'Invalid order id' });
    }

    const result = await OrdersService.updateSellerOrder(orderId, String(req.currentUser._id), req.body || {});
    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    return res.status(200).json({ order: result.order });
  }),
);

router.delete(
  '/:orderId',
  asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    if (!isValidObjectId(orderId)) {
      return res.status(400).json({ error: 'Invalid order id' });
    }

    const result = await OrdersService.deleteSellerOrder(orderId, String(req.currentUser._id));
    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    return res.status(200).json({ status: 'deleted' });
  }),
);

module.exports = router;
