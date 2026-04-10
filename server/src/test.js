/**
 * Server Test Suite — AI Banking Platform
 * Tests authentication, AI controller, and core API endpoints.
 */

const assert = require('assert');

// ─── Unit Tests ─────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}: ${e.message}`);
  }
}

// ─── JWT Token Tests ────────────────────────────────────────

console.log('\n── Auth Tests ──');

test('JWT_SECRET should be set', () => {
  // In test env, we set it ourselves
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
  assert.ok(process.env.JWT_SECRET.length > 0);
});

test('bcryptjs should be available', () => {
  const bcrypt = require('bcryptjs');
  assert.ok(typeof bcrypt.hash === 'function');
});

test('bcrypt should hash passwords correctly', async () => {
  const bcrypt = require('bcryptjs');
  const hash = bcrypt.hashSync('test123', 12);
  assert.ok(hash.length > 0);
  assert.ok(bcrypt.compareSync('test123', hash));
  assert.ok(!bcrypt.compareSync('wrong', hash));
});

test('JWT should sign and verify tokens', () => {
  const jwt = require('jsonwebtoken');
  const secret = 'test-secret';
  const token = jwt.sign({ userId: '12345' }, secret, { expiresIn: '7d' });
  assert.ok(token.length > 0);
  const decoded = jwt.verify(token, secret);
  assert.strictEqual(decoded.userId, '12345');
});

test('JWT should reject tampered tokens', () => {
  const jwt = require('jsonwebtoken');
  const token = jwt.sign({ userId: '12345' }, 'secret1');
  assert.throws(() => jwt.verify(token, 'wrong-secret'));
});

// ─── Model Schema Tests ─────────────────────────────────────

console.log('\n── Model Schema Tests ──');

test('User model should have required fields', () => {
  const User = require('./models/User');
  const schema = User.schema.obj;
  assert.ok('name' in schema);
  assert.ok('email' in schema);
  assert.ok('password' in schema);
  assert.ok('phone' in schema);
});

test('Account model should have required fields', () => {
  const Account = require('./models/Account');
  const schema = Account.schema.obj;
  assert.ok('userId' in schema);
  assert.ok('balance' in schema);
  assert.ok('accountNumber' in schema);
});

test('Transaction model should have required fields', () => {
  const Transaction = require('./models/Transaction');
  const schema = Transaction.schema.obj;
  assert.ok('userId' in schema);
  assert.ok('amount' in schema);
  assert.ok('type' in schema);
});

test('Loan model should exist', () => {
  const Loan = require('./models/Loan');
  assert.ok(Loan.schema);
});

test('Alert model should exist', () => {
  const Alert = require('./models/Alert');
  assert.ok(Alert.schema);
});

test('ChatHistory model should exist', () => {
  const ChatHistory = require('./models/ChatHistory');
  assert.ok(ChatHistory.schema);
});

// ─── Middleware Tests ────────────────────────────────────────

console.log('\n── Middleware Tests ──');

test('Auth middleware should reject requests without token', () => {
  const auth = require('./middleware/auth');
  const mockReq = { header: () => null };
  const mockRes = {
    _status: null,
    _json: null,
    status(code) { this._status = code; return this; },
    json(data) { this._json = data; return this; },
  };
  auth(mockReq, mockRes, () => {});
  assert.strictEqual(mockRes._status, 401);
});

test('Auth middleware should reject invalid tokens', () => {
  const auth = require('./middleware/auth');
  const mockReq = { header: (name) => name === 'Authorization' ? 'Bearer invalid-token' : null };
  const mockRes = {
    _status: null,
    _json: null,
    status(code) { this._status = code; return this; },
    json(data) { this._json = data; return this; },
  };
  auth(mockReq, mockRes, () => {});
  assert.strictEqual(mockRes._status, 401);
});

test('Admin middleware should be a function', () => {
  const admin = require('./middleware/admin');
  assert.ok(typeof admin === 'function');
});

// ─── Route Registration Tests ───────────────────────────────

console.log('\n── Route Tests ──');

test('AI routes should be defined', () => {
  const router = require('./routes/ai');
  assert.ok(router.stack || router._router);
});

test('Auth routes should be defined', () => {
  const router = require('./routes/auth');
  assert.ok(router.stack || router._router);
});

test('Transaction routes should be defined', () => {
  const router = require('./routes/transaction');
  assert.ok(router.stack || router._router);
});

// ─── AI Controller Fallback Tests ───────────────────────────

console.log('\n── AI Fallback Tests ──');

test('Should have fallback reply function', () => {
  // The aiController exports are functions
  const aiController = require('./controllers/aiController');
  assert.ok(typeof aiController.chat === 'function');
  assert.ok(typeof aiController.getInsights === 'function');
  assert.ok(typeof aiController.predictBalance === 'function');
  assert.ok(typeof aiController.getCashFlow === 'function');
});

// ─── Summary ────────────────────────────────────────────────

console.log(`\n═══════════════════════════════════════`);
console.log(`  Tests: ${passed} passed, ${failed} failed`);
console.log(`═══════════════════════════════════════\n`);

if (failed > 0) process.exit(1);
