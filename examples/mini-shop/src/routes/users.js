const express = require('express');
const userService = require('../services/userService');

const router = express.Router();

router.post('/login', async (req, res, next) => {
  try {
    const token = await userService.login(req.body.email, req.body.password);
    res.json({ token });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
