const express = require('express');

const MonthlyCostService = require('./monthly-cost.service');

const router = express.Router();

router.get('/monthly-cost', (req, res) => {
  const validation = MonthlyCostService.parseMonthlyCostQuery(req.query);
  if (validation.errors.length) {
    return res.status(400).json({ errors: validation.errors });
  }

  return res.status(200).json(MonthlyCostService.calculateMonthlyCost(validation.values));
});

module.exports = router;
