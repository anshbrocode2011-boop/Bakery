require('dotenv').config();
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { Server } = require('socket.io');
const { pool, initDb, LOCKED_ADMIN_EMAIL } = require('./db');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true, credentials: true }
});

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'public')));

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 24) {
  console.error('FATAL: JWT_SECRET must be set in .env and be at least 24 characters long.');
  process.exit(1);
}

// Authoritative Server-Side Product Catalog (prevents client-side price tampering)
const CATALOG = {
  // Cakes (base price per pound, supports 1P, 2P, 3P)
  pineapple:    { name: 'Pineapple Cake',        type: 'cake', base: 150 },
  chocolate:    { name: 'Chocolate Cake',        type: 'cake', base: 180 },
  butterscotch: { name: 'Butterscotch Cake',     type: 'cake', base: 200 },
  strawberry:   { name: 'Strawberry Cake',       type: 'cake', base: 200 },
  oreo:         { name: 'Oreo Overload Cake',    type: 'cake', base: 200 },
  darkchoc:     { name: 'Dark Chocolate Cake',   type: 'cake', base: 200 },
  truffle:      { name: 'Chocolate Truffle Cake',type: 'cake', base: 250 },
  walnut:       { name: 'Chocolate Walnut Cake', type: 'cake', base: 220 },
  vanilla:      { name: 'Vanilla Glaze Cake',    type: 'cake', base: 220 },
  // Savoury & Sweet Snacks
  cheeseroll:   { name: 'Cheese Roll',           type: 'snack', price: 40, unit: 'Per piece' },
  burger:       { name: 'Veg Burger',            type: 'snack', price: 40, unit: 'Per piece' },
  hotdog:       { name: 'Veg Hot Dog',           type: 'snack', price: 25, unit: 'Per piece' },
  sandwich:     { name: 'Grilled Veg Sandwich',  type: 'snack', price: 20, unit: 'Per piece' },
  brownie:      { name: 'Fudge Brownie',         type: 'snack', price: 50, unit: 'Per piece' },
  chocsnack:    { name: 'Dark Chocolate Pastry', type: 'snack', price: 25, unit: 'Per piece' },
  creamroll:    { name: 'Classic Cream Roll',    type: 'snack', price: 15, unit: 'Per piece' }
};

const VALID_STATUSES = ['Placed', 'Confirmed', 'Out for Delivery', 'Delivered'];

// Real SMTP Transporter for Admin OTP & Notifications
const mailer = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT || 465),
  secure: process.env.SMTP_SECURE !== 'false',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Rate Limiters
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many authentication attempts. Please wait 15 minutes.' }
});

const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 8,
  message: { error: 'Too many OTP requests. Please wait 10 minutes.' }
});

// Auth Middleware
function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required. Please log in.' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Session expired or invalid. Please log in again.' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin' || req.user.email !== LOCKED_ADMIN_EMAIL || !req.user.otpVerified) {
    return res.status(403).json({ error: 'Forbidden: Verified Admin OTP session required.' });
  }
  next();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

// ============================================================================
// 1. CUSTOMER AUTHENTICATION (Create Account & Login)
// ============================================================================
app.post('/api/auth/register', authLimiter, async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').toLowerCase().trim();
    const password = String(req.body.password || '');

    if (name.length < 2 || name.length > 100) {
      return res.status(400).json({ error: 'Please enter your full name (2–100 characters).' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    if (email === LOCKED_ADMIN_EMAIL) {
      return res.status(403).json({ error: 'This email is reserved for administration. Use Admin Sign In.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    const exists = await pool.query('SELECT id FROM users WHERE LOWER(email) = $1', [email]);
    if (exists.rowCount > 0) {
      return res.status(409).json({ error: 'An account with this email already exists. Please log in.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, 'customer')
       RETURNING id, name, email, role`,
      [name, email, passwordHash]
    );

    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, name: user.name, email: user.email, role: 'customer' }, JWT_SECRET, {
      expiresIn: '7d'
    });

    return res.status(201).json({ token, user });
  } catch (err) {
    console.error('[REGISTER ERROR]', err);
    return res.status(500).json({ error: 'Could not create account. Please try again.' });
  }
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    const email = String(req.body.email || '').toLowerCase().trim();
    const password = String(req.body.password || '');

    if (!isValidEmail(email) || !password) {
      return res.status(400).json({ error: 'Please enter both email and password.' });
    }
    if (email === LOCKED_ADMIN_EMAIL) {
      return res.status(403).json({
        error: 'Admin account requires 2-step Email OTP verification. Please use the Admin Portal button.'
      });
    }

    const result = await pool.query(
      'SELECT id, name, email, password_hash, role FROM users WHERE LOWER(email) = $1',
      [email]
    );
    if (result.rowCount === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign({ id: user.id, name: user.name, email: user.email, role: 'customer' }, JWT_SECRET, {
      expiresIn: '7d'
    });

    return res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: 'customer' }
    });
  } catch (err) {
    console.error('[LOGIN ERROR]', err);
    return res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

app.get('/api/auth/me', authenticate, async (req, res) => {
  return res.json({ user: req.user });
});

// ============================================================================
// 2. ADMIN 2-STEP AUTHENTICATION (Password + Real 6-Digit Email OTP)
//    Strictly locked to anshbrocode2011@gmail.com
// ============================================================================
app.post('/api/admin/request-otp', otpLimiter, async (req, res) => {
  try {
    const email = String(req.body.email || '').toLowerCase().trim();
    const password = String(req.body.password || '');

    if (email !== LOCKED_ADMIN_EMAIL) {
      return res.status(403).json({ error: 'Access denied. Unauthorized administrator email.' });
    }

    const adminRes = await pool.query(
      `SELECT id, name, email, password_hash, role FROM users WHERE LOWER(email) = $1 AND role = 'admin'`,
      [LOCKED_ADMIN_EMAIL]
    );
    if (adminRes.rowCount === 0) {
      return res.status(403).json({ error: 'Admin account is not initialized.' });
    }

    const admin = adminRes.rows[0];
    const validPass = await bcrypt.compare(password, admin.password_hash);
    if (!validPass) {
      return res.status(401).json({ error: 'Invalid admin password.' });
    }

    // Generate cryptographically secure 6-digit OTP
    const otpCode = String(crypto.randomInt(100000, 1000000));
    const otpHash = await bcrypt.hash(otpCode, 10);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes validity

    // Invalidate previous unused OTPs
    await pool.query(`UPDATE admin_otps SET used = TRUE WHERE email = $1 AND used = FALSE`, [LOCKED_ADMIN_EMAIL]);
    await pool.query(
      `INSERT INTO admin_otps (email, otp_hash, expires_at) VALUES ($1, $2, $3)`,
      [LOCKED_ADMIN_EMAIL, otpHash, expiresAt]
    );

    // Send real email OTP via SMTP
    await mailer.sendMail({
      from: process.env.SMTP_FROM || `"Super Bakery Admin" <${LOCKED_ADMIN_EMAIL}>`,
      to: LOCKED_ADMIN_EMAIL,
      subject: `[Super Bakery] Your Admin Login OTP: ${otpCode}`,
      text: `Your Super Bakery Admin 6-digit verification code is: ${otpCode}

This code expires in 5 minutes. Do not share it with anyone.`,
      html: `
        <div style="font-family:Georgia,serif;max-width:480px;margin:0 auto;padding:28px;background:#FFFBF4;border:1px solid #E4D0B0;border-radius:14px;color:#1F1209;">
          <p style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#9A7034;margin:0 0 8px;">Super Bakery · Admin Security</p>
          <h2 style="margin:0 0 16px;font-weight:500;">Admin Verification Code</h2>
          <p style="font-size:14px;color:#594738;line-height:1.6;">Use the 6-digit OTP below to complete your sign-in to the Super Bakery Live Order Dashboard:</p>
          <div style="margin:22px 0;padding:18px;background:#23130B;color:#DFC07A;font-size:32px;letter-spacing:8px;text-align:center;font-weight:700;border-radius:10px;">
            ${otpCode}
          </div>
          <p style="font-size:12px;color:#87715F;margin:0;">Valid for 5 minutes · Requested at ${new Date().toLocaleString('en-IN')}</p>
        </div>
      `
    });

    return res.json({
      message: `A 6-digit OTP has been sent to ${LOCKED_ADMIN_EMAIL}.`
    });
  } catch (err) {
    console.error('[ADMIN OTP EMAIL ERROR]', err);
    return res.status(500).json({
      error: 'Failed to send verification email. Verify SMTP_USER and SMTP_PASS in your .env file.'
    });
  }
});

app.post('/api/admin/verify-otp', otpLimiter, async (req, res) => {
  try {
    const email = String(req.body.email || '').toLowerCase().trim();
    const otp = String(req.body.otp || '').trim();

    if (email !== LOCKED_ADMIN_EMAIL || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({ error: 'Please enter a valid 6-digit OTP.' });
    }

    const otpRes = await pool.query(
      `SELECT id, otp_hash, expires_at, attempts
       FROM admin_otps
       WHERE email = $1 AND used = FALSE
       ORDER BY created_at DESC
       LIMIT 1`,
      [LOCKED_ADMIN_EMAIL]
    );

    if (otpRes.rowCount === 0) {
      return res.status(400).json({ error: 'No active OTP found. Please request a new code.' });
    }

    const record = otpRes.rows[0];
    if (new Date() > new Date(record.expires_at)) {
      await pool.query('UPDATE admin_otps SET used = TRUE WHERE id = $1', [record.id]);
      return res.status(400).json({ error: 'OTP has expired. Please request a new 6-digit code.' });
    }

    if (record.attempts >= 5) {
      await pool.query('UPDATE admin_otps SET used = TRUE WHERE id = $1', [record.id]);
      return res.status(429).json({ error: 'Maximum verification attempts exceeded. Request a new OTP.' });
    }

    const validOtp = await bcrypt.compare(otp, record.otp_hash);
    if (!validOtp) {
      await pool.query('UPDATE admin_otps SET attempts = attempts + 1 WHERE id = $1', [record.id]);
      return res.status(401).json({ error: 'Incorrect 6-digit OTP code.' });
    }

    await pool.query('UPDATE admin_otps SET used = TRUE WHERE id = $1', [record.id]);

    const adminRes = await pool.query(
      `SELECT id, name, email FROM users WHERE LOWER(email) = $1 AND role = 'admin'`,
      [LOCKED_ADMIN_EMAIL]
    );
    const admin = adminRes.rows[0];

    const token = jwt.sign(
      { id: admin.id, name: admin.name, email: admin.email, role: 'admin', otpVerified: true },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    return res.json({
      token,
      user: { id: admin.id, name: admin.name, email: admin.email, role: 'admin', otpVerified: true }
    });
  } catch (err) {
    console.error('[VERIFY OTP ERROR]', err);
    return res.status(500).json({ error: 'OTP verification failed.' });
  }
});

// ============================================================================
// 3. ORDERS API (Create Order, Customer Order History, Admin Order Management)
// ============================================================================
async function fetchOrderWithItems(orderId) {
  const orderRes = await pool.query('SELECT * FROM orders WHERE id = $1', [orderId]);
  if (orderRes.rowCount === 0) return null;
  const itemsRes = await pool.query('SELECT * FROM order_items WHERE order_id = $1 ORDER BY id ASC', [orderId]);
  return { ...orderRes.rows[0], items: itemsRes.rows };
}

app.post('/api/orders', authenticate, async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      items,
      recipient_name,
      phone,
      address_line1,
      landmark,
      city,
      state,
      pincode,
      needed_date,
      cake_message,
      delivery_notes
    } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Your cart is empty.' });
    }

    const cleanRecipient = String(recipient_name || '').trim();
    const cleanPhone = String(phone || '').replace(/\s+/g, '');
    const cleanAddr1 = String(address_line1 || '').trim();
    const cleanLandmark = String(landmark || '').trim();
    const cleanCity = String(city || '').trim();
    const cleanState = String(state || '').trim();
    const cleanPin = String(pincode || '').trim();
    const cleanDate = String(needed_date || '').trim();
    const cleanCakeMsg = String(cake_message || '').trim().slice(0, 120);
    const cleanNotes = String(delivery_notes || '').trim().slice(0, 400);

    if (cleanRecipient.length < 2) {
      return res.status(400).json({ error: 'Recipient name is required.' });
    }
    if (!/^(\+91[-\s]?)?[6-9]\d{9}$/.test(cleanPhone)) {
      return res.status(400).json({ error: 'Please enter a valid 10-digit Indian mobile number.' });
    }
    if (cleanAddr1.length < 5) {
      return res.status(400).json({ error: 'Please enter a complete street/house delivery address.' });
    }
    if (cleanCity.length < 2 || cleanState.length < 2) {
      return res.status(400).json({ error: 'City and State are required.' });
    }
    if (!/^\d{6}$/.test(cleanPin)) {
      return res.status(400).json({ error: 'Please enter a valid 6-digit PIN code.' });
    }

    // Validate items & compute authoritative server-side totals
    const validatedItems = [];
    let subtotal = 0;

    for (const raw of items) {
      const product = CATALOG[raw.id];
      if (!product) {
        return res.status(400).json({ error: `Invalid product in cart: ${raw.id}` });
      }
      const qty = parseInt(raw.qty, 10);
      if (!Number.isInteger(qty) || qty < 1 || qty > 50) {
        return res.status(400).json({ error: `Invalid quantity for ${product.name}.` });
      }

      let unitPrice = 0;
      let sizeLabel = '';
      if (product.type === 'cake') {
        const pounds = [1, 2, 3].includes(Number(raw.size)) ? Number(raw.size) : 1;
        unitPrice = product.base * pounds;
        sizeLabel = `${pounds} Pound (${pounds}P)`;
      } else {
        unitPrice = product.price;
        sizeLabel = product.unit;
      }

      const lineTotal = unitPrice * qty;
      subtotal += lineTotal;

      validatedItems.push({
        product_id: raw.id,
        product_name: product.name,
        category: product.type,
        size_label: sizeLabel,
        unit_price: unitPrice,
        qty,
        line_total: lineTotal
      });
    }

    await client.query('BEGIN');

    const orderCode = 'SB-' + crypto.randomBytes(3).toString('hex').toUpperCase();
    const insertOrder = await client.query(
      `INSERT INTO orders (
        order_code, user_id, customer_name, customer_email,
        recipient_name, phone, address_line1, landmark, city, state, pincode,
        needed_date, cake_message, delivery_notes, subtotal, status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'Placed')
      RETURNING *`,
      [
        orderCode,
        req.user.id,
        req.user.name,
        req.user.email,
        cleanRecipient,
        cleanPhone,
        cleanAddr1,
        cleanLandmark,
        cleanCity,
        cleanState,
        cleanPin,
        cleanDate,
        cleanCakeMsg,
        cleanNotes,
        subtotal
      ]
    );

    const order = insertOrder.rows[0];
    const savedItems = [];

    for (const item of validatedItems) {
      const itemRes = await client.query(
        `INSERT INTO order_items (
          order_id, product_id, product_name, category, size_label, unit_price, qty, line_total
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        RETURNING *`,
        [
          order.id,
          item.product_id,
          item.product_name,
          item.category,
          item.size_label,
          item.unit_price,
          item.qty,
          item.line_total
        ]
      );
      savedItems.push(itemRes.rows[0]);
    }

    await client.query('COMMIT');

    const fullOrder = { ...order, items: savedItems };

    // Real-time WebSocket emission to Admin room & Customer room
    io.to('admin_room').emit('order:new', fullOrder);
    io.to(`user_${req.user.id}`).emit('order:created', fullOrder);

    return res.status(201).json({ order: fullOrder });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[CREATE ORDER ERROR]', err);
    return res.status(500).json({ error: 'Failed to place order. Please try again.' });
  } finally {
    client.release();
  }
});

// Get logged-in customer's orders
app.get('/api/orders/my', authenticate, async (req, res) => {
  try {
    const ordersRes = await pool.query(
      'SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    const orders = ordersRes.rows;
    if (orders.length === 0) return res.json({ orders: [] });

    const orderIds = orders.map(o => o.id);
    const itemsRes = await pool.query(
      'SELECT * FROM order_items WHERE order_id = ANY($1::int[]) ORDER BY id ASC',
      [orderIds]
    );

    const itemsByOrder = {};
    for (const item of itemsRes.rows) {
      if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = [];
      itemsByOrder[item.order_id].push(item);
    }

    const enriched = orders.map(o => ({ ...o, items: itemsByOrder[o.id] || [] }));
    return res.json({ orders: enriched });
  } catch (err) {
    console.error('[MY ORDERS ERROR]', err);
    return res.status(500).json({ error: 'Could not load your orders.' });
  }
});

// Admin: Get all orders with items
app.get('/api/admin/orders', authenticate, requireAdmin, async (req, res) => {
  try {
    const ordersRes = await pool.query('SELECT * FROM orders ORDER BY created_at DESC LIMIT 200');
    const orders = ordersRes.rows;
    if (orders.length === 0) return res.json({ orders: [] });

    const orderIds = orders.map(o => o.id);
    const itemsRes = await pool.query(
      'SELECT * FROM order_items WHERE order_id = ANY($1::int[]) ORDER BY id ASC',
      [orderIds]
    );

    const itemsByOrder = {};
    for (const item of itemsRes.rows) {
      if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = [];
      itemsByOrder[item.order_id].push(item);
    }

    const enriched = orders.map(o => ({ ...o, items: itemsByOrder[o.id] || [] }));
    return res.json({ orders: enriched });
  } catch (err) {
    console.error('[ADMIN ORDERS ERROR]', err);
    return res.status(500).json({ error: 'Could not load orders.' });
  }
});

// Admin: Update order status (Placed -> Confirmed -> Out for Delivery -> Delivered)
app.patch('/api/admin/orders/:id/status', authenticate, requireAdmin, async (req, res) => {
  try {
    const orderId = parseInt(req.params.id, 10);
    const { status } = req.body;

    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        error: `Invalid status. Allowed values: ${VALID_STATUSES.join(', ')}`
      });
    }

    const updateRes = await pool.query(
      `UPDATE orders
       SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [status, orderId]
    );

    if (updateRes.rowCount === 0) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    const fullOrder = await fetchOrderWithItems(orderId);

    // Broadcast live status update to both the customer and admin dashboard
    io.to(`user_${fullOrder.user_id}`).emit('order:status', fullOrder);
    io.to(`order_${fullOrder.id}`).emit('order:status', fullOrder);
    io.to('admin_room').emit('order:status', fullOrder);

    return res.json({ order: fullOrder });
  } catch (err) {
    console.error('[UPDATE STATUS ERROR]', err);
    return res.status(500).json({ error: 'Could not update order status.' });
  }
});

// ============================================================================
// 4. SOCKET.IO AUTHENTICATED REAL-TIME CHANNELS
// ============================================================================
io.use((socket, next) => {
  const token = socket.handshake.auth && socket.handshake.auth.token;
  if (!token) return next();
  try {
    socket.user = jwt.verify(token, JWT_SECRET);
  } catch (_) {
    // Allow connection as guest; authenticated rooms require valid socket.user
  }
  next();
});

io.on('connection', (socket) => {
  if (socket.user) {
    socket.join(`user_${socket.user.id}`);
    if (socket.user.role === 'admin' && socket.user.email === LOCKED_ADMIN_EMAIL && socket.user.otpVerified) {
      socket.join('admin_room');
    }
  }

  socket.on('track:order', (orderId) => {
    if (socket.user && orderId) {
      socket.join(`order_${Number(orderId)}`);
    }
  });
});

// Fallback to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

initDb()
  .then(() => {
    const port = Number(process.env.PORT || 3000);
    server.listen(port, () => {
      console.log(`[Super Bakery] Server running on http://localhost:${port}`);
    });
  })
  .catch((err) => {
    console.error('[FATAL DB INIT ERROR]', err);
    process.exit(1);
  });
