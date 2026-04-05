const Account = require('../models/Account');

exports.getDetails = async (req, res) => {
  try {
    const account = await Account.findOne({ userId: req.userId });
    if (!account) return res.status(404).json({ message: 'Account not found.' });
    res.json(account);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};
