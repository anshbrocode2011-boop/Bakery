(function () {
  'use strict';

  const TOKEN_KEY = 'superbakery_jwt_v1';
  const USER_KEY = 'superbakery_user_v1';
  const CART_KEY = 'superbakery_cart_v1';
  const ADMIN_EMAIL = 'anshbrocode2011@gmail.com';
  const STATUS_STEPS = ['Placed', 'Confirmed', 'Out for Delivery', 'Delivered'];

  let authToken = localStorage.getItem(TOKEN_KEY) || null;
  let currentUser = null;
  try {
    currentUser = JSON.parse(localStorage.getItem(USER_KEY) || 'null');
  } catch (_) {
    currentUser = null;
  }

  let socket = null;
  let myOrders = [];
  let adminOrders = [];
  let adminFilter = 'ALL';

  // ---------------------------------------------------------------------------
  // 1. Inject Premium Animations & Ordering System Styles
  // ---------------------------------------------------------------------------
  const style = document.createElement('style');
  style.textContent = `
    /* Smooth Card & Section Micro-Interactions */
    .p-card {
      transition: transform 0.42s cubic-bezier(0.22, 1, 0.36, 1),
                  box-shadow 0.42s cubic-bezier(0.22, 1, 0.36, 1),
                  border-color 0.35s ease !important;
    }
    .p-card:hover {
      transform: translateY(-7px) scale(1.01) !important;
      box-shadow: 0 28px 56px -22px rgba(31, 18, 9, 0.24), 0 8px 20px -6px rgba(154, 112, 52, 0.16) !important;
    }
    @keyframes sbPulseGlow {
      0%, 100% { box-shadow: 0 0 0 0 rgba(154, 112, 52, 0.35); }
      50% { box-shadow: 0 0 0 8px rgba(154, 112, 52, 0); }
    }
    @keyframes sbSlideUp {
      from { opacity: 0; transform: translateY(18px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* Top Nav User & Order Controls */
    .sb-nav-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-left: 8px;
      flex-wrap: wrap;
    }
    .sb-pill-btn {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 8px 14px;
      border-radius: 999px;
      font-size: 11.5px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      border: 1px solid var(--line-strong, #DFC9A8);
      background: rgba(255, 251, 244, 0.92);
      color: var(--ink, #1F1209);
      cursor: pointer;
      transition: all 0.25s ease;
    }
    .sb-pill-btn:hover {
      border-color: var(--gold, #9A7034);
      background: var(--gold-soft, #F5E8CE);
      transform: translateY(-1px);
    }
    .sb-pill-btn.sb-primary {
      background: var(--espresso, #23130B);
      color: var(--gold-light, #DFC07A);
      border-color: var(--espresso, #23130B);
    }
    .sb-pill-btn.sb-primary:hover {
      background: var(--gold, #9A7034);
      color: #FFFBF4;
      border-color: var(--gold, #9A7034);
    }
    .sb-pill-btn.sb-admin-btn {
      background: linear-gradient(135deg, #2B170C, #4A2813);
      color: #DFC07A;
      border-color: #9A7034;
    }

    /* Modals (Auth, My Orders Tracking, Admin Dashboard) */
    .sb-modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 120;
      background: rgba(20, 11, 5, 0.68);
      backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 18px;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.28s ease;
    }
    .sb-modal-backdrop.open {
      opacity: 1;
      pointer-events: auto;
    }
    .sb-modal {
      width: 100%;
      max-width: 520px;
      max-height: 90vh;
      overflow-y: auto;
      background: var(--paper, #FFFBF4);
      border: 1px solid var(--line-strong, #DFC9A8);
      border-radius: 20px;
      box-shadow: 0 32px 72px -18px rgba(15, 8, 3, 0.45);
      padding: 28px;
      color: var(--ink, #1F1209);
      animation: sbSlideUp 0.32s cubic-bezier(0.22, 1, 0.36, 1);
    }
    .sb-modal.sb-modal-wide {
      max-width: 960px;
    }
    .sb-modal-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--line, #EDE0CC);
      margin-bottom: 20px;
    }
    .sb-modal-eyebrow {
      font-size: 10.5px;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: var(--gold, #9A7034);
      font-weight: 700;
      margin-bottom: 4px;
    }
    .sb-modal-title {
      font-family: var(--serif, 'Cormorant Garamond', Georgia, serif);
      font-size: 28px;
      font-weight: 600;
      line-height: 1.15;
      margin: 0;
    }
    .sb-close-btn {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      border: 1px solid var(--line-strong, #DFC9A8);
      background: var(--cream, #FBF4E8);
      color: var(--ink, #1F1209);
      font-size: 18px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    /* Tabs */
    .sb-tabs {
      display: grid;
      grid-template-columns: 1fr 1fr;
      background: var(--cream, #FBF4E8);
      padding: 4px;
      border-radius: 12px;
      border: 1px solid var(--line, #EDE0CC);
      margin-bottom: 18px;
    }
    .sb-tab {
      padding: 10px;
      border-radius: 9px;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      text-align: center;
      cursor: pointer;
      color: var(--muted, #87715F);
      transition: all 0.2s ease;
    }
    .sb-tab.active {
      background: var(--espresso, #23130B);
      color: var(--gold-light, #DFC07A);
    }

    /* Forms */
    .sb-form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .sb-field {
      display: flex;
      flex-direction: column;
      gap: 5px;
      margin-bottom: 12px;
    }
    .sb-field.full {
      grid-column: 1 / -1;
    }
    .sb-field label {
      font-size: 10.5px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--ink-soft, #594738);
    }
    .sb-field input,
    .sb-field textarea,
    .sb-field select {
      width: 100%;
      padding: 11px 13px;
      border-radius: 10px;
      border: 1px solid var(--line-strong, #DFC9A8);
      background: #FFFFFF;
      color: var(--ink, #1F1209);
      font-size: 13.5px;
      outline: none;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }
    .sb-field input:focus,
    .sb-field textarea:focus {
      border-color: var(--gold, #9A7034);
      box-shadow: 0 0 0 3px rgba(154, 112, 52, 0.15);
    }
    .sb-submit-btn {
      width: 100%;
      padding: 14px 20px;
      border-radius: 12px;
      background: var(--espresso, #23130B);
      color: var(--gold-light, #DFC07A);
      font-size: 12.5px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      border: 1px solid var(--gold, #9A7034);
      cursor: pointer;
      transition: all 0.25s ease;
    }
    .sb-submit-btn:hover:not(:disabled) {
      background: var(--gold, #9A7034);
      color: #FFFBF4;
    }
    .sb-submit-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .sb-alert {
      padding: 11px 14px;
      border-radius: 10px;
      font-size: 12.5px;
      margin-bottom: 14px;
      display: none;
    }
    .sb-alert.error {
      display: block;
      background: #FDF1F0;
      border: 1px solid #E6A8A3;
      color: #8C251E;
    }
    .sb-alert.success {
      display: block;
      background: #F1F8F3;
      border: 1px solid #A3D1B0;
      color: #1F5E34;
    }

    /* Order Tracking Cards & Live Progress Stepper */
    .sb-order-card {
      background: var(--cream, #FBF4E8);
      border: 1px solid var(--line-strong, #DFC9A8);
      border-radius: 16px;
      padding: 18px;
      margin-bottom: 16px;
      transition: border-color 0.3s ease, box-shadow 0.3s ease;
    }
    .sb-order-card.sb-flash {
      animation: sbPulseGlow 1.4s ease 2;
      border-color: var(--gold, #9A7034);
    }
    .sb-order-top {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      padding-bottom: 12px;
      border-bottom: 1px dashed var(--line-strong, #DFC9A8);
      margin-bottom: 14px;
    }
    .sb-order-code {
      font-family: var(--serif, Georgia, serif);
      font-size: 21px;
      font-weight: 700;
      color: var(--ink, #1F1209);
    }
    .sb-status-badge {
      padding: 5px 12px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }
    .sb-status-Placed { background: #F5E8CE; color: #785522; }
    .sb-status-Confirmed { background: #E3F0FB; color: #195685; }
    .sb-status-Out-for-Delivery { background: #FFF0D6; color: #9C5708; }
    .sb-status-Delivered { background: #E4F5E8; color: #1E6B35; }

    .sb-stepper {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin: 14px 0 16px;
    }
    .sb-step {
      position: relative;
      text-align: center;
      padding: 10px 6px;
      border-radius: 10px;
      background: rgba(255,255,255,0.65);
      border: 1px solid var(--line, #EDE0CC);
      font-size: 11px;
      color: var(--muted, #87715F);
      font-weight: 600;
      transition: all 0.3s ease;
    }
    .sb-step.done {
      background: var(--espresso, #23130B);
      color: var(--gold-light, #DFC07A);
      border-color: var(--gold, #9A7034);
    }
    .sb-step.current {
      background: var(--gold, #9A7034);
      color: #FFFBF4;
      border-color: var(--gold-deep, #785522);
      box-shadow: 0 6px 16px rgba(154, 112, 52, 0.28);
    }

    .sb-order-meta {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 10px;
      font-size: 12.5px;
      color: var(--ink-soft, #594738);
      background: rgba(255,255,255,0.7);
      padding: 12px;
      border-radius: 10px;
      margin-top: 10px;
    }

    /* Toast Notification */
    .sb-toast-wrap {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 200;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .sb-toast {
      background: var(--espresso, #23130B);
      color: var(--gold-light, #DFC07A);
      border: 1px solid var(--gold, #9A7034);
      padding: 14px 18px;
      border-radius: 14px;
      box-shadow: 0 18px 38px rgba(15, 8, 3, 0.38);
      font-size: 13px;
      max-width: 360px;
      animation: sbSlideUp 0.3s ease;
    }
    @media (max-width: 640px) {
      .sb-form-grid { grid-template-columns: 1fr; }
      .sb-stepper { grid-template-columns: 1fr 1fr; }
    }
  `;
  document.head.appendChild(style);

  // ---------------------------------------------------------------------------
  // 2. Helper Utilities (API Fetch, Toast, Sound Alert, Escape HTML)
  // ---------------------------------------------------------------------------
  function esc(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, (m) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[m]));
  }

  const toastWrap = document.createElement('div');
  toastWrap.className = 'sb-toast-wrap';
  document.body.appendChild(toastWrap);

  function showToast(title, body) {
    const t = document.createElement('div');
    t.className = 'sb-toast';
    t.innerHTML = `<strong style="display:block;margin-bottom:3px;color:#FFFBF4;">${esc(title)}</strong><span>${esc(body)}</span>`;
    toastWrap.appendChild(t);
    setTimeout(() => t.remove(), 5200);
  }

  function playNotificationChime() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [587.33, 880].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.14, ctx.currentTime + idx * 0.14);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.14 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.14);
        osc.stop(ctx.currentTime + idx * 0.14 + 0.36);
      });
    } catch (_) {}
  }

  async function api(url, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    const res = await fetch(url, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  function setSession(token, user) {
    authToken = token;
    currentUser = user;
    if (token && user) {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
    renderNavControls();
    connectSocket();
  }

  // ---------------------------------------------------------------------------
  // 3. Real-Time Socket.IO Connection
  // ---------------------------------------------------------------------------
  function connectSocket() {
    if (typeof io === 'undefined') return;
    if (socket) socket.disconnect();

    socket = io({
      auth: { token: authToken }
    });

    socket.on('order:status', (updatedOrder) => {
      // Update customer order list if open or cached
      const idx = myOrders.findIndex(o => o.id === updatedOrder.id);
      if (idx !== -1) myOrders[idx] = updatedOrder;
      else if (currentUser && updatedOrder.user_id === currentUser.id) myOrders.unshift(updatedOrder);

      // Update admin list if cached
      const aIdx = adminOrders.findIndex(o => o.id === updatedOrder.id);
      if (aIdx !== -1) adminOrders[aIdx] = updatedOrder;

      showToast(
        `Order ${updatedOrder.order_code} Updated`,
        `Current Status: ${updatedOrder.status}`
      );
      playNotificationChime();
      renderMyOrdersList(updatedOrder.id);
      renderAdminOrdersList(updatedOrder.id);
    });

    socket.on('order:new', (newOrder) => {
      if (currentUser && currentUser.role === 'admin') {
        adminOrders.unshift(newOrder);
        playNotificationChime();
        showToast(
          `New Live Order ${newOrder.order_code}!`,
          `₹${newOrder.subtotal} from ${newOrder.recipient_name} (${newOrder.city})`
        );
        renderAdminOrdersList(newOrder.id);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // 4. Inject Navigation Bar Controls & Footer Admin Trigger
  // ---------------------------------------------------------------------------
  const navInner = document.querySelector('.nav-inner');
  const navActions = document.createElement('div');
  navActions.className = 'sb-nav-actions';
  if (navInner) navInner.appendChild(navActions);

  function renderNavControls() {
    if (!navActions) return;
    if (!currentUser) {
      navActions.innerHTML = `
        <button type="button" class="sb-pill-btn sb-primary" id="sbOpenAuthBtn">
          Login / Create Account
        </button>
        <button type="button" class="sb-pill-btn" id="sbOpenAdminLoginBtn" title="Admin Portal">
          Admin
        </button>
      `;
      document.getElementById('sbOpenAuthBtn').onclick = () => openAuthModal('login');
      document.getElementById('sbOpenAdminLoginBtn').onclick = () => openAdminModal();
    } else if (currentUser.role === 'admin' && currentUser.otpVerified) {
      navActions.innerHTML = `
        <button type="button" class="sb-pill-btn sb-admin-btn" id="sbOpenAdminDashBtn">
          Live Admin Dashboard
        </button>
        <button type="button" class="sb-pill-btn" id="sbLogoutBtn">
          Logout
        </button>
      `;
      document.getElementById('sbOpenAdminDashBtn').onclick = () => openAdminDashboard();
      document.getElementById('sbLogoutBtn').onclick = () => {
        setSession(null, null);
        showToast('Signed Out', 'You have been logged out safely.');
      };
    } else {
      navActions.innerHTML = `
        <button type="button" class="sb-pill-btn sb-primary" id="sbMyOrdersBtn">
          Track Orders (${esc(currentUser.name.split(' ')[0])})
        </button>
        <button type="button" class="sb-pill-btn" id="sbLogoutBtn">
          Logout
        </button>
      `;
      document.getElementById('sbMyOrdersBtn').onclick = () => openMyOrdersModal();
      document.getElementById('sbLogoutBtn').onclick = () => {
        setSession(null, null);
        showToast('Signed Out', 'You have been logged out.');
      };
    }
  }

  // ---------------------------------------------------------------------------
  // 5. Upgrade Cart Drawer: Replace WhatsApp Checkout with Full Online Checkout
  // ---------------------------------------------------------------------------
  function upgradeCartDrawer() {
    const cartFoot = document.getElementById('cartFoot');
    if (!cartFoot) return;

    const waBtn = cartFoot.querySelector('[data-wa-order]');
    if (waBtn && !waBtn.dataset.upgraded) {
      waBtn.dataset.upgraded = '1';
      waBtn.removeAttribute('data-wa-order');
      waBtn.innerHTML = `
        <span>Proceed to Secure Checkout</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
          <path d="M5 12h14M13 5l7 7-7 7"/>
        </svg>
      `;
      waBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!currentUser) {
          showToast('Account Required', 'Please log in or create an account to place your delivery order.');
          openAuthModal('login', true);
          return;
        }
        openCheckoutModal();
      };
    }
  }

  const cartFootEl = document.getElementById('cartFoot');
  if (cartFootEl) {
    const observer = new MutationObserver(upgradeCartDrawer);
    observer.observe(cartFootEl, { childList: true, subtree: true });
    upgradeCartDrawer();
  }

  // ---------------------------------------------------------------------------
  // 6. Customer Login / Create Account Modal
  // ---------------------------------------------------------------------------
  const authBackdrop = document.createElement('div');
  authBackdrop.className = 'sb-modal-backdrop';
  authBackdrop.innerHTML = `
    <div class="sb-modal" role="dialog" aria-modal="true">
      <div class="sb-modal-head">
        <div>
          <div class="sb-modal-eyebrow">Super Bakery Member</div>
          <h3 class="sb-modal-title" id="sbAuthTitle">Welcome Back</h3>
        </div>
        <button type="button" class="sb-close-btn" id="sbAuthClose">&times;</button>
      </div>
      <div class="sb-tabs">
        <div class="sb-tab active" data-tab="login">Login</div>
        <div class="sb-tab" data-tab="register">Create Account</div>
      </div>
      <div id="sbAuthAlert" class="sb-alert"></div>
      <form id="sbAuthForm">
        <div class="sb-field" id="sbNameField" style="display:none;">
          <label for="sbAuthName">Full Name *</label>
          <input type="text" id="sbAuthName" placeholder="e.g., Aarav Sharma" autocomplete="name" />
        </div>
        <div class="sb-field">
          <label for="sbAuthEmail">Email Address *</label>
          <input type="email" id="sbAuthEmail" required placeholder="you@example.com" autocomplete="email" />
        </div>
        <div class="sb-field">
          <label for="sbAuthPassword">Password *</label>
          <input type="password" id="sbAuthPassword" required minlength="6" placeholder="Minimum 6 characters" autocomplete="current-password" />
        </div>
        <button type="submit" class="sb-submit-btn" id="sbAuthSubmit">Sign In to Super Bakery</button>
      </form>
    </div>
  `;
  document.body.appendChild(authBackdrop);

  let authMode = 'login';
  let openCheckoutAfterAuth = false;

  function openAuthModal(mode = 'login', resumeCheckout = false) {
    authMode = mode;
    openCheckoutAfterAuth = resumeCheckout;
    updateAuthTabs();
    authBackdrop.classList.add('open');
  }

  function updateAuthTabs() {
    const alertBox = document.getElementById('sbAuthAlert');
    alertBox.className = 'sb-alert';
    alertBox.textContent = '';
    authBackdrop.querySelectorAll('.sb-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === authMode);
    });
    document.getElementById('sbNameField').style.display = authMode === 'register' ? 'flex' : 'none';
    document.getElementById('sbAuthTitle').textContent = authMode === 'register' ? 'Create Your Account' : 'Welcome Back';
    document.getElementById('sbAuthSubmit').textContent = authMode === 'register' ? 'Create Account & Continue' : 'Sign In to Super Bakery';
  }

  authBackdrop.querySelectorAll('.sb-tab').forEach(tab => {
    tab.onclick = () => {
      authMode = tab.dataset.tab;
      updateAuthTabs();
    };
  });

  document.getElementById('sbAuthClose').onclick = () => authBackdrop.classList.remove('open');

  document.getElementById('sbAuthForm').onsubmit = async (e) => {
    e.preventDefault();
    const alertBox = document.getElementById('sbAuthAlert');
    const btn = document.getElementById('sbAuthSubmit');
    alertBox.className = 'sb-alert';

    const name = document.getElementById('sbAuthName').value.trim();
    const email = document.getElementById('sbAuthEmail').value.trim();
    const password = document.getElementById('sbAuthPassword').value;

    try {
      btn.disabled = true;
      btn.textContent = 'Please wait...';
      const endpoint = authMode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const payload = authMode === 'register' ? { name, email, password } : { email, password };
      const data = await api(endpoint, { method: 'POST', body: JSON.stringify(payload) });

      setSession(data.token, data.user);
      authBackdrop.classList.remove('open');
      showToast(`Welcome, ${data.user.name}!`, 'You are now signed in.');

      if (openCheckoutAfterAuth) {
        openCheckoutAfterAuth = false;
        openCheckoutModal();
      }
    } catch (err) {
      alertBox.className = 'sb-alert error';
      alertBox.textContent = err.message;
    } finally {
      btn.disabled = false;
      updateAuthTabs();
    }
  };

  // ---------------------------------------------------------------------------
  // 7. Complete Delivery Address & Checkout Modal
  // ---------------------------------------------------------------------------
  const checkoutBackdrop = document.createElement('div');
  checkoutBackdrop.className = 'sb-modal-backdrop';
  checkoutBackdrop.innerHTML = `
    <div class="sb-modal" role="dialog" aria-modal="true">
      <div class="sb-modal-head">
        <div>
          <div class="sb-modal-eyebrow">Freshly Baked To Order</div>
          <h3 class="sb-modal-title">Delivery Address & Checkout</h3>
        </div>
        <button type="button" class="sb-close-btn" id="sbCheckoutClose">&times;</button>
      </div>
      <div id="sbCheckoutAlert" class="sb-alert"></div>
      <div id="sbCheckoutSummary" style="background:var(--cream,#FBF4E8);padding:12px 14px;border-radius:12px;border:1px solid var(--line-strong,#DFC9A8);margin-bottom:16px;font-size:13px;"></div>
      <form id="sbCheckoutForm">
        <div class="sb-form-grid">
          <div class="sb-field">
            <label>Recipient Full Name *</label>
            <input type="text" id="sbRecName" required placeholder="Recipient Name" />
          </div>
          <div class="sb-field">
            <label>10-Digit Mobile Number *</label>
            <input type="tel" id="sbRecPhone" required placeholder="9876543210" />
          </div>
          <div class="sb-field full">
            <label>House / Flat No., Building & Street Address *</label>
            <input type="text" id="sbAddr1" required placeholder="e.g., 42 MG Road, Near Clock Tower" />
          </div>
          <div class="sb-field">
            <label>Landmark (Optional)</label>
            <input type="text" id="sbLandmark" placeholder="Opposite City Park" />
          </div>
          <div class="sb-field">
            <label>PIN Code (6 Digits) *</label>
            <input type="text" id="sbPincode" required pattern="\d{6}" maxlength="6" placeholder="248140" />
          </div>
          <div class="sb-field">
            <label>City / Town *</label>
            <input type="text" id="sbCity" required value="Doiwala" />
          </div>
          <div class="sb-field">
            <label>State *</label>
            <input type="text" id="sbState" required value="Uttarakhand" />
          </div>
          <div class="sb-field full">
            <label>Delivery Instructions / Notes (Optional)</label>
            <textarea id="sbNotes" rows="2" placeholder="Gate code, preferred delivery time window, etc."></textarea>
          </div>
        </div>
        <button type="submit" class="sb-submit-btn" id="sbPlaceOrderBtn">Place Live Order Now</button>
      </form>
    </div>
  `;
  document.body.appendChild(checkoutBackdrop);

  document.getElementById('sbCheckoutClose').onclick = () => checkoutBackdrop.classList.remove('open');

  function getLocalCart() {
    try {
      return JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    } catch (_) {
      return [];
    }
  }

  function openCheckoutModal() {
    const cart = getLocalCart();
    if (!cart.length) {
      showToast('Cart Empty', 'Add at least one cake or snack before checking out.');
      return;
    }

    if (currentUser && !document.getElementById('sbRecName').value) {
      document.getElementById('sbRecName').value = currentUser.name || '';
    }

    const totalEl = document.getElementById('cartTotal');
    const totalText = totalEl ? totalEl.textContent : '';
    const itemCount = cart.reduce((acc, i) => acc + (Number(i.qty) || 0), 0);

    document.getElementById('sbCheckoutSummary').innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span><strong>${itemCount} item(s)</strong> in your Super Bakery box</span>
        <strong style="font-size:16px;color:var(--espresso,#23130B);">${esc(totalText)}</strong>
      </div>
    `;

    const alertBox = document.getElementById('sbCheckoutAlert');
    alertBox.className = 'sb-alert';
    checkoutBackdrop.classList.add('open');
  }

  document.getElementById('sbCheckoutForm').onsubmit = async (e) => {
    e.preventDefault();
    const alertBox = document.getElementById('sbCheckoutAlert');
    const btn = document.getElementById('sbPlaceOrderBtn');
    alertBox.className = 'sb-alert';

    const cart = getLocalCart();
    if (!cart.length) {
      alertBox.className = 'sb-alert error';
      alertBox.textContent = 'Your cart is empty.';
      return;
    }

    const neededDateEl = document.getElementById('fDate');
    const cakeMsgEl = document.getElementById('fMsg');

    const payload = {
      items: cart,
      recipient_name: document.getElementById('sbRecName').value.trim(),
      phone: document.getElementById('sbRecPhone').value.trim(),
      address_line1: document.getElementById('sbAddr1').value.trim(),
      landmark: document.getElementById('sbLandmark').value.trim(),
      pincode: document.getElementById('sbPincode').value.trim(),
      city: document.getElementById('sbCity').value.trim(),
      state: document.getElementById('sbState').value.trim(),
      needed_date: neededDateEl ? neededDateEl.value : '',
      cake_message: cakeMsgEl ? cakeMsgEl.value.trim() : '',
      delivery_notes: document.getElementById('sbNotes').value.trim()
    };

    try {
      btn.disabled = true;
      btn.textContent = 'Submitting Your Order...';

      const data = await api('/api/orders', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      // Clear local cart & trigger existing UI refresh
      localStorage.setItem(CART_KEY, '[]');
      const clearBtn = document.querySelector('[data-clear-cart]');
      if (clearBtn) clearBtn.click();

      checkoutBackdrop.classList.remove('open');
      const closePanelBtn = document.querySelector('#drawer [data-close-panel]');
      if (closePanelBtn) closePanelBtn.click();

      showToast(`Order ${data.order.order_code} Placed!`, 'Tracking live status in real time.');
      openMyOrdersModal(data.order.id);
    } catch (err) {
      alertBox.className = 'sb-alert error';
      alertBox.textContent = err.message;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Place Live Order Now';
    }
  };

  // ---------------------------------------------------------------------------
  // 8. Customer Live Order Tracking Modal (WebSockets)
  // ---------------------------------------------------------------------------
  const myOrdersBackdrop = document.createElement('div');
  myOrdersBackdrop.className = 'sb-modal-backdrop';
  myOrdersBackdrop.innerHTML = `
    <div class="sb-modal sb-modal-wide" role="dialog" aria-modal="true">
      <div class="sb-modal-head">
        <div>
          <div class="sb-modal-eyebrow">Live WebSocket Updates</div>
          <h3 class="sb-modal-title">My Orders & Real-Time Tracking</h3>
        </div>
        <button type="button" class="sb-close-btn" id="sbMyOrdersClose">&times;</button>
      </div>
      <div id="sbMyOrdersContainer"></div>
    </div>
  `;
  document.body.appendChild(myOrdersBackdrop);
  document.getElementById('sbMyOrdersClose').onclick = () => myOrdersBackdrop.classList.remove('open');

  async function openMyOrdersModal(highlightId = null) {
    myOrdersBackdrop.classList.add('open');
    const container = document.getElementById('sbMyOrdersContainer');
    container.innerHTML = '<p style="font-size:13px;color:var(--muted);">Loading your orders...</p>';
    try {
      const data = await api('/api/orders/my');
      myOrders = data.orders || [];
      renderMyOrdersList(highlightId);
    } catch (err) {
      container.innerHTML = `<div class="sb-alert error">${esc(err.message)}</div>`;
    }
  }

  function renderMyOrdersList(highlightId = null) {
    const container = document.getElementById('sbMyOrdersContainer');
    if (!container) return;

    if (!myOrders.length) {
      container.innerHTML = `<p style="padding:24px;text-align:center;color:var(--muted);">You haven't placed any orders yet. Explore our fresh cakes and snacks!</p>`;
      return;
    }

    container.innerHTML = myOrders.map(order => {
      const currentIdx = STATUS_STEPS.indexOf(order.status);
      const statusSlug = order.status.replace(/\s+/g, '-');
      const stepperHtml = STATUS_STEPS.map((step, idx) => {
        const cls = idx < currentIdx ? 'done' : idx === currentIdx ? 'current' : '';
        return `<div class="sb-step ${cls}">${idx + 1}. ${esc(step)}</div>`;
      }).join('');

      const itemsHtml = (order.items || []).map(it =>
        `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;">
          <span><strong>${it.qty}x</strong> ${esc(it.product_name)} <em style="color:var(--muted);">(${esc(it.size_label)})</em></span>
          <strong>₹${it.line_total}</strong>
        </div>`
      ).join('');

      return `
        <div class="sb-order-card ${highlightId === order.id ? 'sb-flash' : ''}">
          <div class="sb-order-top">
            <div>
              <span class="sb-order-code">${esc(order.order_code)}</span>
              <span style="font-size:12px;color:var(--muted);margin-left:10px;">
                ${new Date(order.created_at).toLocaleString('en-IN')}
              </span>
            </div>
            <span class="sb-status-badge sb-status-${esc(statusSlug)}">${esc(order.status)}</span>
          </div>
          <div class="sb-stepper">${stepperHtml}</div>
          <div style="margin-bottom:10px;">${itemsHtml}</div>
          <div style="display:flex;justify-content:space-between;border-top:1px solid var(--line,#EDE0CC);padding-top:8px;font-size:14px;">
            <span>Total Amount</span>
            <strong style="font-size:16px;">₹${order.subtotal}</strong>
          </div>
          <div class="sb-order-meta">
            <div><strong>Deliver To:</strong> ${esc(order.recipient_name)} (${esc(order.phone)})</div>
            <div><strong>Address:</strong> ${esc(order.address_line1)}, ${esc(order.city)}, ${esc(order.state)} - ${esc(order.pincode)}</div>
            ${order.cake_message ? `<div><strong>Cake Message:</strong> "${esc(order.cake_message)}"</div>` : ''}
            ${order.needed_date ? `<div><strong>Requested Date:</strong> ${esc(order.needed_date)}</div>` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  // ---------------------------------------------------------------------------
  // 9. Admin 2-Step Verification (Password + 6-Digit Email OTP) & Live Dashboard
  // ---------------------------------------------------------------------------
  const adminBackdrop = document.createElement('div');
  adminBackdrop.className = 'sb-modal-backdrop';
  adminBackdrop.innerHTML = `
    <div class="sb-modal" id="sbAdminModalBox" role="dialog" aria-modal="true">
      <div class="sb-modal-head">
        <div>
          <div class="sb-modal-eyebrow">Restricted Access · ${ADMIN_EMAIL}</div>
          <h3 class="sb-modal-title" id="sbAdminModalTitle">Admin 2-Step Verification</h3>
        </div>
        <button type="button" class="sb-close-btn" id="sbAdminClose">&times;</button>
      </div>
      <div id="sbAdminAlert" class="sb-alert"></div>
      <div id="sbAdminBody"></div>
    </div>
  `;
  document.body.appendChild(adminBackdrop);
  document.getElementById('sbAdminClose').onclick = () => adminBackdrop.classList.remove('open');

  function openAdminModal() {
    if (currentUser && currentUser.role === 'admin' && currentUser.otpVerified) {
      openAdminDashboard();
      return;
    }
    const box = document.getElementById('sbAdminModalBox');
    box.classList.remove('sb-modal-wide');
    document.getElementById('sbAdminModalTitle').textContent = 'Admin 2-Step Sign In';
    const alertBox = document.getElementById('sbAdminAlert');
    alertBox.className = 'sb-alert';

    const body = document.getElementById('sbAdminBody');
    body.innerHTML = `
      <form id="sbAdminStep1Form">
        <div class="sb-field">
          <label>Locked Admin Email</label>
          <input type="email" id="sbAdminEmailInput" value="${ADMIN_EMAIL}" readonly style="background:#F5EFE4;font-weight:600;" />
        </div>
        <div class="sb-field">
          <label>Admin Password *</label>
          <input type="password" id="sbAdminPassInput" required placeholder="Enter admin password" />
        </div>
        <button type="submit" class="sb-submit-btn" id="sbAdminStep1Btn">Verify Password & Send 6-Digit Email OTP</button>
      </form>
    `;

    document.getElementById('sbAdminStep1Form').onsubmit = async (e) => {
      e.preventDefault();
      alertBox.className = 'sb-alert';
      const btn = document.getElementById('sbAdminStep1Btn');
      const password = document.getElementById('sbAdminPassInput').value;
      try {
        btn.disabled = true;
        btn.textContent = 'Sending 6-Digit OTP to Email...';
        const data = await api('/api/admin/request-otp', {
          method: 'POST',
          body: JSON.stringify({ email: ADMIN_EMAIL, password })
        });
        alertBox.className = 'sb-alert success';
        alertBox.textContent = data.message;
        renderAdminOtpStep();
      } catch (err) {
        alertBox.className = 'sb-alert error';
        alertBox.textContent = err.message;
      } finally {
        btn.disabled = false;
        btn.textContent = 'Verify Password & Send 6-Digit Email OTP';
      }
    };

    adminBackdrop.classList.add('open');
  }

  function renderAdminOtpStep() {
    const alertBox = document.getElementById('sbAdminAlert');
    const body = document.getElementById('sbAdminBody');
    body.innerHTML = `
      <form id="sbAdminStep2Form">
        <div class="sb-field">
          <label>Enter 6-Digit Email OTP sent to ${ADMIN_EMAIL}</label>
          <input type="text" id="sbAdminOtpInput" required pattern="\d{6}" maxlength="6" placeholder="6-digit OTP" style="font-size:22px;letter-spacing:8px;text-align:center;font-weight:700;" />
        </div>
        <button type="submit" class="sb-submit-btn" id="sbAdminStep2Btn">Verify OTP & Unlock Dashboard</button>
      </form>
    `;

    document.getElementById('sbAdminStep2Form').onsubmit = async (e) => {
      e.preventDefault();
      const btn = document.getElementById('sbAdminStep2Btn');
      const otp = document.getElementById('sbAdminOtpInput').value.trim();
      try {
        btn.disabled = true;
        btn.textContent = 'Verifying OTP...';
        const data = await api('/api/admin/verify-otp', {
          method: 'POST',
          body: JSON.stringify({ email: ADMIN_EMAIL, otp })
        });
        setSession(data.token, data.user);
        showToast('Admin Verified', 'Live Order Management Dashboard unlocked.');
        openAdminDashboard();
      } catch (err) {
        alertBox.className = 'sb-alert error';
        alertBox.textContent = err.message;
      } finally {
        btn.disabled = false;
        btn.textContent = 'Verify OTP & Unlock Dashboard';
      }
    };
  }

  async function openAdminDashboard() {
    const box = document.getElementById('sbAdminModalBox');
    box.classList.add('sb-modal-wide');
    document.getElementById('sbAdminModalTitle').textContent = 'Live Order Management Dashboard';
    const alertBox = document.getElementById('sbAdminAlert');
    alertBox.className = 'sb-alert';
    adminBackdrop.classList.add('open');

    const body = document.getElementById('sbAdminBody');
    body.innerHTML = '<p style="font-size:13px;color:var(--muted);">Loading live orders...</p>';

    try {
      const data = await api('/api/admin/orders');
      adminOrders = data.orders || [];
      renderAdminOrdersList();
    } catch (err) {
      alertBox.className = 'sb-alert error';
      alertBox.textContent = err.message;
    }
  }

  function renderAdminOrdersList(highlightId = null) {
    const body = document.getElementById('sbAdminBody');
    if (!body || !currentUser || currentUser.role !== 'admin') return;

    const counts = {
      ALL: adminOrders.length,
      Placed: adminOrders.filter(o => o.status === 'Placed').length,
      Confirmed: adminOrders.filter(o => o.status === 'Confirmed').length,
      'Out for Delivery': adminOrders.filter(o => o.status === 'Out for Delivery').length,
      Delivered: adminOrders.filter(o => o.status === 'Delivered').length
    };

    const filtered = adminFilter === 'ALL'
      ? adminOrders
      : adminOrders.filter(o => o.status === adminFilter);

    const filterBtns = ['ALL', ...STATUS_STEPS].map(st => `
      <button type="button" class="sb-pill-btn ${adminFilter === st ? 'sb-primary' : ''}" data-admin-filter="${esc(st)}">
        ${esc(st)} (${counts[st] || 0})
      </button>
    `).join('');

    const cardsHtml = filtered.length === 0
      ? `<p style="padding:28px;text-align:center;color:var(--muted);">No orders in "${esc(adminFilter)}" status.</p>`
      : filtered.map(order => {
          const statusSlug = order.status.replace(/\s+/g, '-');
          const itemsList = (order.items || []).map(it =>
            `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;">
              <span><strong>${it.qty}x</strong> ${esc(it.product_name)} (${esc(it.size_label)})</span>
              <strong>₹${it.line_total}</strong>
            </div>`
          ).join('');

          const statusBtns = STATUS_STEPS.map(st => `
            <button
              type="button"
              class="sb-pill-btn ${order.status === st ? 'sb-primary' : ''}"
              data-order-id="${order.id}"
              data-next-status="${esc(st)}"
              ${order.status === st ? 'disabled' : ''}
            >
              ${esc(st)}
            </button>
          `).join('');

          return `
            <div class="sb-order-card ${highlightId === order.id ? 'sb-flash' : ''}">
              <div class="sb-order-top">
                <div>
                  <span class="sb-order-code">${esc(order.order_code)}</span>
                  <span style="font-size:12px;color:var(--muted);margin-left:8px;">
                    ${new Date(order.created_at).toLocaleString('en-IN')}
                  </span>
                </div>
                <span class="sb-status-badge sb-status-${esc(statusSlug)}">${esc(order.status)}</span>
              </div>
              <div style="margin-bottom:10px;">${itemsList}</div>
              <div style="display:flex;justify-content:space-between;border-top:1px solid var(--line,#EDE0CC);padding-top:8px;font-size:14px;">
                <span>Customer Account: <strong>${esc(order.customer_name)}</strong> (${esc(order.customer_email)})</span>
                <strong style="font-size:16px;">Total: ₹${order.subtotal}</strong>
              </div>
              <div class="sb-order-meta">
                <div><strong>Recipient:</strong> ${esc(order.recipient_name)} · <a href="tel:${esc(order.phone)}" style="color:var(--gold-deep);font-weight:700;">${esc(order.phone)}</a></div>
                <div><strong>Delivery Address:</strong> ${esc(order.address_line1)}${order.landmark ? ', Near ' + esc(order.landmark) : ''}, ${esc(order.city)}, ${esc(order.state)} - ${esc(order.pincode)}</div>
                ${order.needed_date ? `<div><strong>Needed Date:</strong> ${esc(order.needed_date)}</div>` : ''}
                ${order.cake_message ? `<div><strong>Cake Message:</strong> "${esc(order.cake_message)}"</div>` : ''}
                ${order.delivery_notes ? `<div><strong>Notes:</strong> ${esc(order.delivery_notes)}</div>` : ''}
              </div>
              <div style="margin-top:14px;padding-top:12px;border-top:1px dashed var(--line-strong,#DFC9A8);display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;">
                <span style="font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:var(--ink-soft);">Update Live Status:</span>
                <div style="display:flex;flex-wrap:wrap;gap:6px;">${statusBtns}</div>
              </div>
            </div>
          `;
        }).join('');

    body.innerHTML = `
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:18px;">${filterBtns}</div>
      <div>${cardsHtml}</div>
    `;

    body.querySelectorAll('[data-admin-filter]').forEach(btn => {
      btn.onclick = () => {
        adminFilter = btn.dataset.adminFilter;
        renderAdminOrdersList();
      };
    });

    body.querySelectorAll('[data-next-status]').forEach(btn => {
      btn.onclick = async () => {
        const id = Number(btn.dataset.orderId);
        const status = btn.dataset.nextStatus;
        btn.disabled = true;
        try {
          await api(`/api/admin/orders/${id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status })
          });
        } catch (err) {
          showToast('Update Failed', err.message);
          btn.disabled = false;
        }
      };
    });
  }

  // Initialize UI & Socket
  renderNavControls();
  connectSocket();
})();
