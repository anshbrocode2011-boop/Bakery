# Super Bakery — Real-Time Online Ordering System

A complete, production-ready online ordering system built with **Node.js**, **Express**, **Socket.IO**, **PostgreSQL**, and **Nodemailer**. It preserves 100% of your original `Super_Bakery_Premium_Enhanced.html` design, products, prices, and embedded base64 product images while upgrading the storefront with customer authentication, full delivery-address checkout, real-time WebSocket order tracking, and a 2-step OTP-protected Admin Dashboard.

---

## Project Structure

```text
super-bakery-ordering-system/
├── package.json
├── .env.example
├── README.md
├── server.js                 # Express + Socket.IO + Auth + Real Email OTP + Order APIs
├── db/
│   ├── schema.sql            # PostgreSQL schema (users, admin_otps, orders, order_items)
│   └── index.js              # Database pool & automatic schema + admin initialization
└── public/
    ├── index.html            # Your Super_Bakery_Premium_Enhanced.html with Socket.IO + bakery-system.js linked
    └── bakery-system.js      # Frontend Auth, Delivery Checkout, Live Tracking & Admin Portal
```

---

## Local Setup & Run Instructions

### 1. Create the PostgreSQL Database
Make sure PostgreSQL is running locally (or use a cloud PostgreSQL URI from Neon, Supabase, Render, or Railway):
```bash
psql -U postgres -c "CREATE DATABASE super_bakery;"
```

### 2. Configure `.env`
Copy `.env.example` to `.env` and fill in your credentials:
```bash
cp .env.example .env
```
- **`ADMIN_EMAIL`**: Locked to `anshbrocode2011@gmail.com`.
- **`ADMIN_INITIAL_PASSWORD`**: Your admin password (automatically hashed and seeded on first startup).
- **`SMTP_USER` & `SMTP_PASS`**: To send real 6-digit OTP emails via Gmail, enable **2-Step Verification** on your Google Account (`anshbrocode2011@gmail.com`), visit **Google Account → Security → App Passwords**, generate a 16-character App Password, and paste it into `SMTP_PASS`.

### 3. Install Dependencies & Start Server
```bash
npm install
npm start
```
Open **`http://localhost:3000`** in your browser.
- On startup, `db/index.js` automatically creates all PostgreSQL tables (`users`, `admin_otps`, `orders`, `order_items`) and seeds the locked admin account for `anshbrocode2011@gmail.com`.

---

## Production Deployment (Render / Railway / VPS)

1. Push this project folder to a private GitHub repository.
2. Create a managed **PostgreSQL** instance and a **Node.js Web Service** on Render or Railway.
3. Set Build Command to `npm install` and Start Command to `npm start`.
4. Add all environment variables from `.env.example` (`DATABASE_URL`, `DATABASE_SSL=true`, `JWT_SECRET`, `ADMIN_EMAIL=anshbrocode2011@gmail.com`, `ADMIN_INITIAL_PASSWORD`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`).
