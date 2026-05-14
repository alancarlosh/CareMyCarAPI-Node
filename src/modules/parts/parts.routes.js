const express = require('express');

const { tokenRequired } = require('../../middleware/auth');
const asyncHandler = require('../../utils/async-handler');
const { isValidObjectId } = require('../../utils/object-id');
const Part = require('./part.repository');
const PartsService = require('./parts.service');

const router = express.Router();

router.use(tokenRequired);

router.get(
  '/options',
  asyncHandler(async (req, res) => {
    const options = await PartsService.getOptions(req.query.make);
    return res.status(200).json(options);
  }),
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const validation = await PartsService.validateCreatePayload(req.body || {});
    if (validation.errors) {
      return res.status(400).json({ errors: validation.errors });
    }
    if (validation.error) {
      return res.status(400).json({ error: validation.error });
    }

    const part = await Part.create(String(req.currentUser._id), validation.payload);
    return res.status(201).json({ part });
  }),
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = PartsService.parsePagination(req.query);
    if (parsed.error) {
      return res.status(400).json({ error: parsed.error });
    }

    const category = String(req.query.category || '')
      .trim()
      .toLowerCase();
    const q = String(req.query.q || '').trim();
    const result = await Part.findFiltered(String(req.currentUser._id), {
      q,
      category,
      page: parsed.page,
      limit: parsed.limit,
    });

    return res.status(200).json({
      items: result.items,
      page: parsed.page,
      limit: parsed.limit,
      total: result.total,
    });
  }),
);

router.get(
  '/:partId',
  asyncHandler(async (req, res) => {
    const { partId } = req.params;
    if (!isValidObjectId(partId)) {
      return res.status(400).json({ error: 'ID de refacción inválido' });
    }

    const part = await Part.findByIdForUser(partId, String(req.currentUser._id));
    if (!part) {
      return res.status(404).json({ error: 'Refacción no encontrada' });
    }

    return res.status(200).json({ part });
  }),
);

router.put(
  '/:partId',
  asyncHandler(async (req, res) => {
    const { partId } = req.params;
    if (!isValidObjectId(partId)) {
      return res.status(400).json({ error: 'ID de refacción inválido' });
    }

    const validation = await PartsService.validateUpdatePayload(partId, String(req.currentUser._id), req.body || {});
    if (validation.error) {
      const status = validation.error === 'Refacción no encontrada' ? 404 : 400;
      return res.status(status).json({ error: validation.error });
    }

    const part = await Part.updateForUser(partId, String(req.currentUser._id), validation.updates);
    if (!part) {
      return res.status(404).json({ error: 'Refacción no encontrada' });
    }

    return res.status(200).json({ part });
  }),
);

router.delete(
  '/:partId',
  asyncHandler(async (req, res) => {
    const { partId } = req.params;
    if (!isValidObjectId(partId)) {
      return res.status(400).json({ error: 'ID de refacción inválido' });
    }

    const deleted = await Part.deleteForUser(partId, String(req.currentUser._id));
    if (!deleted) {
      return res.status(404).json({ error: 'Refacción no encontrada' });
    }

    return res.status(200).json({ status: 'deleted' });
  }),
);

module.exports = router;
