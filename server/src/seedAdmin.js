require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Account = require('./models/Account');

const ADMIN_EMAIL = 'admin@bank.com';
const ADMIN_PASSWORD = 'admin123';
const ADMIN_NAME = 'Bank Admin';
const BANK_BALANCE = 500000; // ₹5,00,000

async function seedAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const existing = await User.findOne({ email: ADMIN_EMAIL });
    if (existing) {
      console.log('Admin already exists:', ADMIN_EMAIL);
      // Ensure role is admin
      if (existing.role !== 'admin') {
        existing.role = 'admin';
        await existing.save();
        console.log('Updated role to admin');
      }
      await mongoose.disconnect();
      return;
    }

    const admin = new User({
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      role: 'admin',
    });
    await admin.save();

    const account = new Account({
      userId: admin._id,
      accountNumber: '0000000001',
      balance: BANK_BALANCE,
      accountType: 'current',
    });
    await account.save();

    console.log('Admin created successfully!');
    console.log('Email:', ADMIN_EMAIL);
    console.log('Password:', ADMIN_PASSWORD);
    console.log('Bank Balance: ₹' + BANK_BALANCE.toLocaleString('en-IN'));

    await mongoose.disconnect();
  } catch (error) {
    console.error('Seed error:', error.message);
    process.exit(1);
  }
}

seedAdmin();
