const express = require('express');
const router = express.Router();
const Users = require('../models/Users');

// GET: Render confirmation page
router.get('/', async (req, res) => {
  if (!req.session.userId) return res.redirect('/');

  try {
    const user = await Users.findById(req.session.userId).lean();
    if (!user) return res.status(404).send('User not found');
    res.render('AccountDelete', { user }); // You can now use user._id or user.name
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// POST: Handle account deletion
router.post('/delete', async (req, res) => {
  if (!req.session.userId) return res.redirect('/');

  try {
    await Users.findByIdAndDelete(req.session.userId);
    req.session.destroy(() => {
      res.redirect('/');
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Failed to delete account');
  }
});


module.exports = router;
