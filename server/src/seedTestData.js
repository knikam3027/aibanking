require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Account = require('./models/Account');
const Transaction = require('./models/Transaction');
const Alert = require('./models/Alert');

async function seedTestData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // ---- TEST USER 1: test@test.com ----
    let user1 = await User.findOne({ email: 'test@test.com' });
    if (!user1) {
      user1 = new User({ name: 'Rahul Sharma', email: 'test@test.com', password: 'test123', phone: '9876543210', role: 'user' });
      await user1.save();
      await Account.create({ userId: user1._id, accountNumber: '1000000001', balance: 45000, accountType: 'savings' });
      console.log('Created user1: test@test.com / test123');
    } else {
      console.log('User1 already exists: test@test.com');
    }

    // ---- TEST USER 2: test2@test.com ----
    let user2 = await User.findOne({ email: 'test2@test.com' });
    if (!user2) {
      user2 = new User({ name: 'Priya Patel', email: 'test2@test.com', password: 'test123', phone: '9876543211', role: 'user' });
      await user2.save();
      await Account.create({ userId: user2._id, accountNumber: '1000000002', balance: 28000, accountType: 'savings' });
      console.log('Created user2: test2@test.com / test123');
    } else {
      console.log('User2 already exists: test2@test.com');
    }

    // ---- TEST USER 3: test3@test.com ----
    let user3 = await User.findOne({ email: 'test3@test.com' });
    if (!user3) {
      user3 = new User({ name: 'Amit Kumar', email: 'test3@test.com', password: 'test123', phone: '9876543212', role: 'user' });
      await user3.save();
      await Account.create({ userId: user3._id, accountNumber: '1000000003', balance: 72000, accountType: 'savings' });
      console.log('Created user3: test3@test.com / test123');
    } else {
      console.log('User3 already exists: test3@test.com');
    }

    // ---- TRANSACTIONS FOR USER 1 (Rahul) ----
    const u1Txns = await Transaction.countDocuments({ userId: user1._id });
    if (u1Txns === 0) {
      const now = new Date();
      const txns = [
        // Salary credits
        { userId: user1._id, type: 'credit', amount: 35000, category: 'Salary', sender: 'TechCorp Ltd', description: 'March Salary', status: 'success', createdAt: new Date(now - 25 * 86400000) },
        { userId: user1._id, type: 'credit', amount: 35000, category: 'Salary', sender: 'TechCorp Ltd', description: 'February Salary', status: 'success', createdAt: new Date(now - 55 * 86400000) },
        
        // Food spending
        { userId: user1._id, type: 'debit', amount: 450, category: 'Food', receiver: 'Swiggy', description: 'Food delivery', status: 'success', createdAt: new Date(now - 1 * 86400000) },
        { userId: user1._id, type: 'debit', amount: 320, category: 'Food', receiver: 'Zomato', description: 'Lunch order', status: 'success', createdAt: new Date(now - 3 * 86400000) },
        { userId: user1._id, type: 'debit', amount: 180, category: 'Food', receiver: 'Tea Post', description: 'Snacks', status: 'success', createdAt: new Date(now - 5 * 86400000) },
        { userId: user1._id, type: 'debit', amount: 890, category: 'Food', receiver: 'Dominos', description: 'Pizza night', status: 'success', createdAt: new Date(now - 8 * 86400000) },
        { userId: user1._id, type: 'debit', amount: 550, category: 'Food', receiver: 'McDonald\'s', description: 'Dinner', status: 'success', createdAt: new Date(now - 12 * 86400000) },
        
        // Shopping
        { userId: user1._id, type: 'debit', amount: 2999, category: 'Shopping', receiver: 'Amazon', description: 'Wireless earbuds', status: 'success', createdAt: new Date(now - 2 * 86400000) },
        { userId: user1._id, type: 'debit', amount: 1599, category: 'Shopping', receiver: 'Flipkart', description: 'T-shirts', status: 'success', createdAt: new Date(now - 10 * 86400000) },
        { userId: user1._id, type: 'debit', amount: 499, category: 'Shopping', receiver: 'Myntra', description: 'Socks & accessories', status: 'success', createdAt: new Date(now - 18 * 86400000) },
        
        // Bills
        { userId: user1._id, type: 'debit', amount: 1200, category: 'Bills', receiver: 'Jio', description: 'Monthly recharge', status: 'success', createdAt: new Date(now - 4 * 86400000) },
        { userId: user1._id, type: 'debit', amount: 850, category: 'Bills', receiver: 'Electricity Board', description: 'Electricity bill', status: 'success', createdAt: new Date(now - 7 * 86400000) },
        { userId: user1._id, type: 'debit', amount: 499, category: 'Bills', receiver: 'Netflix', description: 'Netflix subscription', status: 'success', createdAt: new Date(now - 15 * 86400000) },
        { userId: user1._id, type: 'debit', amount: 199, category: 'Bills', receiver: 'Spotify', description: 'Spotify subscription', status: 'success', createdAt: new Date(now - 15 * 86400000) },
        
        // Rent
        { userId: user1._id, type: 'debit', amount: 8000, category: 'Rent', receiver: 'Landlord', description: 'March rent', status: 'success', createdAt: new Date(now - 6 * 86400000) },
        
        // Entertainment
        { userId: user1._id, type: 'debit', amount: 600, category: 'Entertainment', receiver: 'PVR Cinemas', description: 'Movie tickets', status: 'success', createdAt: new Date(now - 9 * 86400000) },
        { userId: user1._id, type: 'debit', amount: 350, category: 'Entertainment', receiver: 'BookMyShow', description: 'Comedy show', status: 'success', createdAt: new Date(now - 20 * 86400000) },
        
        // Transport
        { userId: user1._id, type: 'debit', amount: 250, category: 'Transport', receiver: 'Uber', description: 'Cab ride', status: 'success', createdAt: new Date(now - 2 * 86400000) },
        { userId: user1._id, type: 'debit', amount: 180, category: 'Transport', receiver: 'Ola', description: 'Auto ride', status: 'success', createdAt: new Date(now - 6 * 86400000) },
        { userId: user1._id, type: 'debit', amount: 2000, category: 'Transport', receiver: 'Petrol Pump', description: 'Fuel', status: 'success', createdAt: new Date(now - 14 * 86400000) },
        
        // Transfers
        { userId: user1._id, type: 'debit', amount: 5000, category: 'Transfer', receiver: 'Priya Patel', description: 'Money transfer', status: 'success', createdAt: new Date(now - 11 * 86400000) },
        { userId: user1._id, type: 'credit', amount: 2000, category: 'Transfer', sender: 'Amit Kumar', description: 'Received from Amit', status: 'success', createdAt: new Date(now - 13 * 86400000) },
        
        // Health
        { userId: user1._id, type: 'debit', amount: 750, category: 'Health', receiver: 'Apollo Pharmacy', description: 'Medicines', status: 'success', createdAt: new Date(now - 16 * 86400000) },
        
        // One blocked transaction
        { userId: user1._id, type: 'debit', amount: 25000, category: 'Transfer', receiver: 'Unknown', description: 'Large transfer - blocked', status: 'blocked', createdAt: new Date(now - 19 * 86400000) },
      ];
      await Transaction.insertMany(txns);
      console.log(`Created ${txns.length} transactions for user1`);
    }

    // ---- TRANSACTIONS FOR USER 2 (Priya) ----
    const u2Txns = await Transaction.countDocuments({ userId: user2._id });
    if (u2Txns === 0) {
      const now = new Date();
      const txns = [
        { userId: user2._id, type: 'credit', amount: 42000, category: 'Salary', sender: 'InfoSys', description: 'March Salary', status: 'success', createdAt: new Date(now - 25 * 86400000) },
        { userId: user2._id, type: 'credit', amount: 5000, category: 'Transfer', sender: 'Rahul Sharma', description: 'Received from Rahul', status: 'success', createdAt: new Date(now - 11 * 86400000) },
        { userId: user2._id, type: 'debit', amount: 12000, category: 'Rent', receiver: 'Landlord', description: 'March rent', status: 'success', createdAt: new Date(now - 5 * 86400000) },
        { userId: user2._id, type: 'debit', amount: 3500, category: 'Shopping', receiver: 'Nykaa', description: 'Skincare products', status: 'success', createdAt: new Date(now - 3 * 86400000) },
        { userId: user2._id, type: 'debit', amount: 1200, category: 'Food', receiver: 'Swiggy', description: 'Weekly food orders', status: 'success', createdAt: new Date(now - 2 * 86400000) },
        { userId: user2._id, type: 'debit', amount: 599, category: 'Bills', receiver: 'Amazon Prime', description: 'Prime subscription', status: 'success', createdAt: new Date(now - 15 * 86400000) },
        { userId: user2._id, type: 'debit', amount: 499, category: 'Bills', receiver: 'Netflix', description: 'Netflix subscription', status: 'success', createdAt: new Date(now - 15 * 86400000) },
        { userId: user2._id, type: 'debit', amount: 1500, category: 'Education', receiver: 'Udemy', description: 'Online course', status: 'success', createdAt: new Date(now - 8 * 86400000) },
        { userId: user2._id, type: 'debit', amount: 800, category: 'Transport', receiver: 'Metro Card', description: 'Metro recharge', status: 'success', createdAt: new Date(now - 4 * 86400000) },
        { userId: user2._id, type: 'debit', amount: 650, category: 'Food', receiver: 'Starbucks', description: 'Coffee', status: 'success', createdAt: new Date(now - 1 * 86400000) },
      ];
      await Transaction.insertMany(txns);
      console.log(`Created ${txns.length} transactions for user2`);
    }

    // ---- TRANSACTIONS FOR USER 3 (Amit) ----
    const u3Txns = await Transaction.countDocuments({ userId: user3._id });
    if (u3Txns === 0) {
      const now = new Date();
      const txns = [
        { userId: user3._id, type: 'credit', amount: 60000, category: 'Salary', sender: 'Wipro', description: 'March Salary', status: 'success', createdAt: new Date(now - 25 * 86400000) },
        { userId: user3._id, type: 'credit', amount: 60000, category: 'Salary', sender: 'Wipro', description: 'February Salary', status: 'success', createdAt: new Date(now - 55 * 86400000) },
        { userId: user3._id, type: 'debit', amount: 15000, category: 'Rent', receiver: 'Landlord', description: 'March rent', status: 'success', createdAt: new Date(now - 5 * 86400000) },
        { userId: user3._id, type: 'debit', amount: 8000, category: 'Shopping', receiver: 'Croma', description: 'Headphones', status: 'success', createdAt: new Date(now - 3 * 86400000) },
        { userId: user3._id, type: 'debit', amount: 2500, category: 'Food', receiver: 'Zomato', description: 'Dining out', status: 'success', createdAt: new Date(now - 1 * 86400000) },
        { userId: user3._id, type: 'debit', amount: 4000, category: 'Bills', receiver: 'Airtel', description: 'Broadband', status: 'success', createdAt: new Date(now - 7 * 86400000) },
        { userId: user3._id, type: 'debit', amount: 2000, category: 'Transfer', receiver: 'Rahul Sharma', description: 'Sent to Rahul', status: 'success', createdAt: new Date(now - 13 * 86400000) },
        { userId: user3._id, type: 'debit', amount: 5000, category: 'Health', receiver: 'Max Hospital', description: 'Health checkup', status: 'success', createdAt: new Date(now - 10 * 86400000) },
        { userId: user3._id, type: 'debit', amount: 3000, category: 'Entertainment', receiver: 'Steam', description: 'Gaming', status: 'success', createdAt: new Date(now - 14 * 86400000) },
        { userId: user3._id, type: 'debit', amount: 1200, category: 'Transport', receiver: 'Rapido', description: 'Bike rides', status: 'success', createdAt: new Date(now - 9 * 86400000) },
      ];
      await Transaction.insertMany(txns);
      console.log(`Created ${txns.length} transactions for user3`);
    }

    // ---- ALERTS FOR USER 1 ----
    const u1Alerts = await Alert.countDocuments({ userId: user1._id });
    if (u1Alerts === 0) {
      await Alert.insertMany([
        { userId: user1._id, type: 'fraud', message: 'Suspicious ₹25,000 transfer to unknown account was blocked.', severity: 'high' },
        { userId: user1._id, type: 'warning', message: 'Your spending on Food has increased by 30% this month.', severity: 'medium' },
        { userId: user1._id, type: 'info', message: 'Your Netflix subscription of ₹499 was charged.', severity: 'low' },
        { userId: user1._id, type: 'prediction', message: 'At current spending rate, balance may reach ₹10,000 in 15 days.', severity: 'medium' },
      ]);
      console.log('Created alerts for user1');
    }

    console.log('\n===== TEST DATA SUMMARY =====');
    console.log('User 1: test@test.com / test123 (Rahul Sharma) - Balance: ₹45,000');
    console.log('User 2: test2@test.com / test123 (Priya Patel) - Balance: ₹28,000');
    console.log('User 3: test3@test.com / test123 (Amit Kumar) - Balance: ₹72,000');
    console.log('Admin:  admin@bank.com / admin123 (Bank Admin) - Balance: ₹5,00,000');
    console.log('=============================\n');

    await mongoose.disconnect();
  } catch (error) {
    console.error('Seed error:', error.message);
    process.exit(1);
  }
}

seedTestData();
