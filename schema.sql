CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_otps (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  otp_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  order_code VARCHAR(24) UNIQUE NOT NULL,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  customer_name VARCHAR(120) NOT NULL,
  customer_email VARCHAR(255) NOT NULL,
  recipient_name VARCHAR(120) NOT NULL,
  phone VARCHAR(25) NOT NULL,
  address_line1 TEXT NOT NULL,
  landmark TEXT DEFAULT '',
  city VARCHAR(80) NOT NULL,
  state VARCHAR(80) NOT NULL,
  pincode VARCHAR(12) NOT NULL,
  needed_date VARCHAR(40) DEFAULT '',
  cake_message VARCHAR(120) DEFAULT '',
  delivery_notes TEXT DEFAULT '',
  subtotal INT NOT NULL CHECK (subtotal > 0),
  status VARCHAR(32) NOT NULL DEFAULT 'Placed'
    CHECK (status IN ('Placed', 'Confirmed', 'Out for Delivery', 'Delivered')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id VARCHAR(64) NOT NULL,
  product_name VARCHAR(140) NOT NULL,
  category VARCHAR(40) NOT NULL,
  size_label VARCHAR(40) NOT NULL,
  unit_price INT NOT NULL CHECK (unit_price > 0),
  qty INT NOT NULL CHECK (qty > 0),
  line_total INT NOT NULL CHECK (line_total > 0)
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
