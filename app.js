/* ============================================================
   SHOPWAVE — User / Storefront SPA
   ============================================================ */
'use strict';

/* ── State ─────────────────────────────────────────────── */
let _user      = null;     // Firebase auth user + Firestore data
let _products  = [];       // cached product list
let _cats      = [];       // cached categories
let _page      = 'home';   // current page key
let _pageData  = null;     // page-specific payload (productId, orderId…)
let _isGuest   = sessionStorage.getItem('sw-guest') === '1';

/* ── Boot ───────────────────────────────────────────────── */
(async function boot() {
  applyTheme();
  showLoader(true);

  auth.onAuthStateChanged(async fireUser => {
    if (fireUser) {
      _isGuest = false;
      const snap = await db.collection('users').doc(fireUser.uid).get();
      _user = { uid: fireUser.uid, photoURL: fireUser.photoURL, ...(snap.data() || {}) };
      renderHeaderUser();
    } else if (_isGuest) {
      renderHeaderUser(); // guest — show sign-in button
    } else {
      renderHeaderUser(); // not logged in — still allow browsing
    }

    try {
      await Promise.all([loadCats(), loadProducts()]);
    } catch(e) { /* offline — use empty arrays */ }

    showLoader(false);
    go('home');
    setupHeaderSearch();
    updateCartBubble();
  });
})();

/* ── Theme ──────────────────────────────────────────────── */
function applyTheme() {
  document.documentElement.setAttribute('data-theme', localStorage.getItem('sw-theme') || 'light');
}
function toggleTheme() {
  const t = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('sw-theme', t);
}

/* ── Auth guard — shows inline prompt instead of redirecting ── */
function requireAuth(cb) {
  if (_user) { cb(); return; }
  /* Show inline sign-in prompt in the main area */
  const app = document.getElementById('app');
  app.innerHTML = `
  <div class="page" style="display:flex;align-items:center;justify-content:center;min-height:60dvh">
    <div style="text-align:center;background:var(--surface);border:1px solid var(--border);border-radius:var(--r-xl);padding:40px 28px;max-width:380px;width:100%">
      <div style="font-size:2.8rem;margin-bottom:16px">🔐</div>
      <h2 style="font-family:var(--f-display);font-size:1.25rem;margin-bottom:8px">Sign in required</h2>
      <p style="color:var(--txt-2);font-size:.88rem;margin-bottom:22px">Please sign in to access this section</p>
      <a href="../login.html" class="btn btn-primary btn-full" style="margin-bottom:10px">Sign In with Google</a>
      <button class="btn btn-ghost btn-full" onclick="go('home')">← Continue Browsing</button>
    </div>
  </div>`;
}

/* ── Data loaders ───────────────────────────────────────── */
async function loadCats() {
  const snap = await db.collection('categories').where('active', '==', true).get();
  _cats = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (!_cats.length) _cats = defaultCats();
}
async function loadProducts() {
  const snap = await db.collection('products').where('status', '==', 'active').orderBy('createdAt','desc').limit(60).get();
  _products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
function defaultCats() {
  return [
    {id:'electronics',name:'Electronics',icon:'📱'},{id:'fashion',name:'Fashion',icon:'👗'},
    {id:'home',name:'Home',icon:'🏠'},{id:'beauty',name:'Beauty',icon:'💄'},
    {id:'sports',name:'Sports',icon:'⚽'},{id:'books',name:'Books',icon:'📚'},
    {id:'food',name:'Food',icon:'🍕'},{id:'toys',name:'Toys',icon:'🧸'}
  ];
}

/* ── Render header user section ─────────────────────────── */
function renderHeaderUser() {
  const el = document.getElementById('hdr-user');
  if (!el) return;
  if (_user) {
    el.innerHTML = `
      <img class="user-pic" src="${_user.photoURL || avatarUrl(_user.name)}"
           alt="avatar" onclick="go('profile')"
           onerror="this.src='${avatarUrl(_user.name)}'">`;
  } else {
    el.innerHTML = `<button class="btn btn-primary btn-sm" onclick="window.location.href='../login.html'">Sign In</button>`;
  }
}
function avatarUrl(name) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name||'U')}&background=ff4d00&color=fff`;
}

/* ── Navigation ─────────────────────────────────────────── */
function go(page, data = null) {
  _page     = page;
  _pageData = data;
  window.scrollTo(0, 0);

  document.querySelectorAll('.bnav-item').forEach(b =>
    b.classList.toggle('active', b.dataset.page === page));

  switch (page) {
    case 'home':     renderHome();          break;
    case 'search':   renderSearch(data);    break;
    case 'category': renderCategory(data);  break;
    case 'product':  renderProduct(data);   break;
    case 'cart':     renderCart();          break;
    case 'checkout': requireAuth(() => renderCheckout()); break;
    case 'orders':   requireAuth(() => renderOrders());   break;
    case 'order':    requireAuth(() => renderOrder(data));break;
    case 'profile':  requireAuth(() => renderProfile());  break;
    default:         renderHome();
  }
}

/* ══════════════════════════════════════════════════════════
   PAGE RENDERERS
   ══════════════════════════════════════════════════════════ */

/* ── Home ────────────────────────────────────────────────── */
function renderHome() {
  const app = document.getElementById('app');
  app.innerHTML = `
  <div class="page">
    <!-- Hero -->
    <div class="hero">
      <div class="hero-content">
        <div class="hero-tag">🔥 Best Deals Today</div>
        <h1>Shop Everything<br>You <span>Love</span></h1>
        <p class="hero-sub">Millions of products · Amazing prices · Fast delivery</p>
        <button class="btn btn-primary btn-lg" onclick="go('search')">Explore Now →</button>
      </div>
      <div class="hero-bg"></div>
    </div>

    <!-- Categories -->
    <p class="sec-title">Shop by Category</p>
    <div class="cat-strip" id="cat-strip">
      ${_cats.map(c => `
        <div class="cat-chip" onclick="go('category','${c.id}')">
          <span class="cat-chip-ico">${c.icon || '📦'}</span>
          <span class="cat-chip-name">${c.name}</span>
        </div>`).join('') || '<span class="text-muted" style="padding:16px">No categories</span>'}
    </div>

    <!-- Products -->
    <p class="sec-title">Featured Products</p>
    <div class="prod-grid" id="prod-grid">
      ${_products.length
        ? _products.slice(0, 16).map(p => prodCard(p)).join('')
        : Array(8).fill(0).map(skeletonCard).join('')}
    </div>

    ${!_products.length ? `
    <div class="empty">
      <div class="empty-icon">🛍️</div>
      <h3>No products yet</h3>
      <p>Products from sellers will appear here once listed</p>
    </div>` : ''}
  </div>`;
}

/* ── Product card HTML ───────────────────────────────────── */
function prodCard(p) {
  const img = p.images?.[0];
  return `
  <div class="prod-card" onclick="go('product','${p.id}')">
    ${p.badge ? `<span class="prod-badge">${p.badge}</span>` : ''}
    <button class="prod-wish" onclick="event.stopPropagation();toast('Wishlist coming soon!','info')">♡</button>
    <div class="prod-card-img-wrap">
      ${img
        ? `<img class="prod-card-img" src="${img}" alt="${p.name}" loading="lazy" onerror="this.style.display='none'">`
        : `<span class="prod-card-placeholder">📦</span>`}
    </div>
    <div class="prod-card-body">
      <p class="prod-card-name">${p.name}</p>
      <p class="prod-card-price">${money(p.price)}</p>
      <div class="prod-card-row">
        <span class="prod-card-stars stars">${stars(p.rating || 0)}</span>
        <span class="prod-card-stock">${p.stock > 0 ? 'In stock' : '<span style="color:var(--red)">Out of stock</span>'}</span>
      </div>
    </div>
  </div>`;
}

/* ── Search ──────────────────────────────────────────────── */
function renderSearch(query = '') {
  const app = document.getElementById('app');
  app.innerHTML = `
  <div class="page">
    <div class="search-wrap" style="max-width:100%;margin-bottom:20px">
      <span class="search-ico">🔍</span>
      <input id="pg-search" class="search-bar" style="border-radius:var(--r-md)" value="${query||''}" placeholder="Search products…" autocomplete="off">
    </div>
    <div class="prod-grid" id="search-results">
      ${_products.map(p => prodCard(p)).join('') || `
      <div class="empty" style="grid-column:1/-1">
        <div class="empty-icon">🔍</div><h3>Start typing to search</h3>
      </div>`}
    </div>
  </div>`;

  const inp = document.getElementById('pg-search');
  inp.focus();
  inp.addEventListener('input', debounce(e => {
    const q   = e.target.value.toLowerCase().trim();
    const res = q
      ? _products.filter(p =>
          p.name.toLowerCase().includes(q) ||
          (p.description || '').toLowerCase().includes(q) ||
          (p.category    || '').toLowerCase().includes(q))
      : _products;
    document.getElementById('search-results').innerHTML =
      res.length
        ? res.map(p => prodCard(p)).join('')
        : `<div class="empty" style="grid-column:1/-1"><div class="empty-icon">😕</div><h3>No results for "${q}"</h3></div>`;
  }));
}

/* ── Category ────────────────────────────────────────────── */
function renderCategory(catId) {
  const cat  = _cats.find(c => c.id === catId);
  const list = _products.filter(p => p.category === catId);
  document.getElementById('app').innerHTML = `
  <div class="page">
    <div class="pg-head">
      <div style="display:flex;align-items:center;gap:10px">
        <button class="btn btn-ghost btn-sm" onclick="go('home')">← Back</button>
        <h2>${cat ? cat.icon + ' ' + cat.name : 'Products'}</h2>
      </div>
      <span class="text-muted" style="font-size:.84rem">${list.length} items</span>
    </div>
    <div class="prod-grid">
      ${list.length
        ? list.map(p => prodCard(p)).join('')
        : `<div class="empty" style="grid-column:1/-1"><div class="empty-icon">📦</div><h3>No products yet</h3></div>`}
    </div>
  </div>`;
}

/* ── Product detail ──────────────────────────────────────── */
async function renderProduct(id) {
  const app = document.getElementById('app');
  app.innerHTML = `<div class="page">${Array(2).fill(0).map(() => `<div class="skel-card"><div class="skel skel--img"></div><div class="skel skel--line"></div></div>`).join('')}</div>`;

  let p = _products.find(x => x.id === id);
  if (!p) {
    try {
      const doc = await db.collection('products').doc(id).get();
      if (!doc.exists) { toast('Product not found', 'error'); go('home'); return; }
      p = { id: doc.id, ...doc.data() };
    } catch(e) { toast('Error loading product', 'error'); go('home'); return; }
  }

  const imgs   = p.images || [];
  const sizes  = p.sizes  || [];
  const colors = p.colors || [];
  window._dp   = { ...p, selSize: sizes[0] || '', selColor: colors[0] || '', qty: 1 };

  app.innerHTML = `
  <div class="page">
    <button class="btn btn-ghost btn-sm" style="margin-bottom:14px" onclick="history.back()">← Back</button>
    <div class="prod-detail">
      <!-- Images -->
      <div>
        <div style="border-radius:var(--r-xl);overflow:hidden;height:400px;background:var(--bg);display:flex;align-items:center;justify-content:center">
          ${imgs[0]
            ? `<img id="main-img" src="${imgs[0]}" style="width:100%;height:100%;object-fit:cover" alt="${p.name}">`
            : `<span style="font-size:5rem;opacity:.2">📦</span>`}
        </div>
        ${imgs.length > 1 ? `
        <div class="prod-thumbs">
          ${imgs.map((u,i) => `<img class="prod-thumb ${i===0?'active':''}" src="${u}" onclick="switchImg('${u}',this)" alt="img">`).join('')}
        </div>` : ''}
      </div>

      <!-- Info -->
      <div class="prod-info">
        <h1 class="prod-title">${p.name}</h1>

        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
          <span class="stars" style="font-size:.95rem">${stars(p.rating||0)}</span>
          <span class="text-muted" style="font-size:.8rem">(${p.reviews||0} reviews)</span>
          <span class="badge ${p.stock>0?'badge--green':'badge--red'}">${p.stock>0?'In Stock':'Out of Stock'}</span>
        </div>

        <div style="display:flex;align-items:baseline;gap:10px;margin-bottom:18px">
          <span class="prod-price">${money(p.price)}</span>
          ${p.originalPrice ? `<span class="prod-orig">${money(p.originalPrice)}</span>
            <span class="prod-disc">${Math.round((1-p.price/p.originalPrice)*100)}% off</span>` : ''}
        </div>

        <p style="color:var(--txt-2);font-size:.9rem;line-height:1.7;margin-bottom:20px">${p.description || 'No description.'}</p>

        ${sizes.length ? `
        <p class="prod-opt-label">Size</p>
        <div class="opt-chips" id="size-chips">
          ${sizes.map(s=>`<div class="opt-chip ${s===window._dp.selSize?'active':''}" onclick="pickOpt('size','${s}',this)">${s}</div>`).join('')}
        </div>` : ''}

        ${colors.length ? `
        <p class="prod-opt-label">Color</p>
        <div class="opt-chips" id="color-chips">
          ${colors.map(c=>`<div class="opt-chip ${c===window._dp.selColor?'active':''}" onclick="pickOpt('color','${c}',this)">${c}</div>`).join('')}
        </div>` : ''}

        <p class="prod-opt-label">Quantity</p>
        <div class="qty-row">
          <button class="qty-btn" onclick="adjQty(-1)">−</button>
          <input  class="qty-val" id="qty-inp" type="number" value="1" min="1" max="${p.stock||99}" readonly>
          <button class="qty-btn" onclick="adjQty(1)">+</button>
        </div>

        <div class="prod-ctas">
          <button class="btn btn-primary btn-lg" style="flex:1" onclick="addToCart('${p.id}')">🛒 Add to Cart</button>
          <button class="btn btn-secondary btn-lg" onclick="addToCart('${p.id}');go('checkout')">Buy Now</button>
        </div>

        <div class="prod-info-strip">
          <span>🚚 Free delivery over ₹500</span>
          <span>↩️ 7-day returns</span>
          <span>🔒 Secure pay</span>
        </div>
      </div>
    </div>
  </div>`;
}

function switchImg(src, el) {
  const m = document.getElementById('main-img');
  if (m) m.src = src;
  document.querySelectorAll('.prod-thumb').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
}
function pickOpt(type, val, el) {
  if (type === 'size')  window._dp.selSize  = val;
  else                  window._dp.selColor = val;
  el.closest('.opt-chips').querySelectorAll('.opt-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
}
function adjQty(d) {
  const inp = document.getElementById('qty-inp');
  if (!inp) return;
  const v = Math.max(1, Math.min(parseInt(inp.max)||99, parseInt(inp.value)+d));
  inp.value = v;
  if (window._dp) window._dp.qty = v;
}

/* ── Add to cart ─────────────────────────────────────────── */
function addToCart(pid) {
  const p = window._dp || _products.find(x => x.id === pid);
  if (!p) { toast('Product not found','error'); return; }
  const qty   = parseInt(document.getElementById('qty-inp')?.value || 1);
  const item  = { productId: pid, name: p.name, price: p.price, image: p.images?.[0]||'', size: p.selSize||'', color: p.selColor||'', qty, sellerId: p.sellerId||'' };
  const cart  = getCart();
  const idx   = cart.findIndex(c => c.productId===pid && c.size===item.size && c.color===item.color);
  if (idx >= 0) cart[idx].qty += qty; else cart.push(item);
  saveCart(cart);
  toast('Added to cart 🛒', 'success');
}

/* ── Cart ────────────────────────────────────────────────── */
function renderCart() {
  const cart = getCart();
  const app  = document.getElementById('app');
  if (!cart.length) {
    app.innerHTML = `
    <div class="page">
      <h2 style="font-family:var(--f-display);font-weight:800;margin-bottom:22px">Your Cart</h2>
      <div class="empty">
        <div class="empty-icon">🛒</div>
        <h3>Your cart is empty</h3>
        <p>Add items from the store to get started</p>
        <button class="btn btn-primary" onclick="go('home')">Start Shopping</button>
      </div>
    </div>`;
    return;
  }

  const sub  = cart.reduce((s,i) => s + i.price*i.qty, 0);
  const del  = sub >= 500 ? 0 : 49;
  const total= sub + del;

  app.innerHTML = `
  <div class="page">
    <h2 style="font-family:var(--f-display);font-weight:800;margin-bottom:22px">Cart (${cart.length} item${cart.length>1?'s':''})</h2>
    <div class="cart-shell">
      <div>
        <div class="cart-items" id="cart-items">
          ${cart.map((item,i) => `
          <div class="cart-item">
            ${item.image
              ? `<img class="cart-img" src="${item.image}" alt="${item.name}" onerror="this.style.display='none'">`
              : `<div class="cart-img" style="display:flex;align-items:center;justify-content:center;font-size:2rem">📦</div>`}
            <div class="cart-info">
              <p class="cart-name">${item.name}</p>
              <p class="cart-var">${[item.size&&'Size: '+item.size, item.color&&'Color: '+item.color].filter(Boolean).join(' · ')||'No variant'}</p>
              <p class="cart-price">${money(item.price)}</p>
              <div class="cart-row">
                <div class="qty-row" style="height:32px">
                  <button class="qty-btn" style="width:32px;height:32px;font-size:1rem" onclick="cartQty(${i},-1)">−</button>
                  <span class="qty-val" style="height:32px;line-height:32px">${item.qty}</span>
                  <button class="qty-btn" style="width:32px;height:32px;font-size:1rem" onclick="cartQty(${i},1)">+</button>
                </div>
                <button class="btn btn-ghost btn-sm" style="color:var(--red)" onclick="cartRemove(${i})">Remove</button>
              </div>
            </div>
          </div>`).join('')}
        </div>
      </div>

      <div class="cart-summary">
        <h3>Order Summary</h3>
        <div class="sum-row"><span>Subtotal</span><span>${money(sub)}</span></div>
        <div class="sum-row"><span>Delivery</span><span>${del===0?`<span class="text-green fw-700">FREE</span>`:money(del)}</span></div>
        <div class="sum-row sum-total"><span>Total</span><span>${money(total)}</span></div>
        <button class="btn btn-primary btn-full" style="margin-top:16px" onclick="go('checkout')">Proceed to Checkout →</button>
        <p style="font-size:.72rem;color:var(--txt-3);text-align:center;margin-top:10px">🔒 Secure checkout · Free returns</p>
      </div>
    </div>
  </div>`;
}

function cartQty(i, d) {
  const cart = getCart();
  cart[i].qty = Math.max(1, cart[i].qty + d);
  saveCart(cart); renderCart();
}
function cartRemove(i) {
  const cart = getCart();
  cart.splice(i, 1);
  saveCart(cart); renderCart();
  toast('Item removed', 'info');
}

/* ── Checkout ────────────────────────────────────────────── */
async function renderCheckout() {
  const cart = getCart();
  if (!cart.length) { go('cart'); return; }

  showLoader(true);
  let methods = [];
  try {
    const snap = await db.collection('payments').where('active','==',true).get();
    methods = snap.docs.map(d => ({id:d.id,...d.data()}));
    if (!methods.length) methods = [{id:'cod',name:'Cash on Delivery',icon:'💵'},{id:'upi',name:'UPI',icon:'📱'},{id:'card',name:'Card',icon:'💳'}];
  } catch(e) { methods = [{id:'cod',name:'Cash on Delivery',icon:'💵'}]; }
  showLoader(false);

  const sub   = cart.reduce((s,i) => s+i.price*i.qty, 0);
  const del   = sub >= 500 ? 0 : 49;
  const total = sub + del;

  document.getElementById('app').innerHTML = `
  <div class="page">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:22px">
      <button class="btn btn-ghost btn-sm" onclick="go('cart')">← Cart</button>
      <h2 style="font-family:var(--f-display);font-weight:800">Checkout</h2>
    </div>
    <div class="cart-shell">
      <div>
        <!-- Address -->
        <div class="chk-section">
          <h3>Delivery Address</h3>
          <div class="grid-2">
            <div class="field"><label>Full Name *</label><input class="input" id="a-name"  value="${_user?.name||''}" placeholder="Your name"></div>
            <div class="field"><label>Phone *</label><input class="input" id="a-phone" type="tel" placeholder="+91 XXXXXXXXXX"></div>
          </div>
          <div class="field"><label>Street / Area *</label><textarea class="input" id="a-street" rows="2" placeholder="House no., Street, Area"></textarea></div>
          <div class="grid-2">
            <div class="field"><label>City *</label><input class="input" id="a-city"  placeholder="City"></div>
            <div class="field"><label>Pincode *</label><input class="input" id="a-pin"  placeholder="Pincode"></div>
          </div>
          <div class="field" style="margin-bottom:0"><label>State *</label><input class="input" id="a-state" placeholder="State"></div>
        </div>

        <!-- Payment -->
        <div class="chk-section">
          <h3>Payment Method</h3>
          ${methods.map((m,i) => `
          <div class="pay-opt ${i===0?'selected':''}" onclick="pickPayment(this)">
            <input type="radio" name="pay" value="${m.id}" ${i===0?'checked':''}>
            <span style="font-size:1.2rem">${m.icon||'💳'}</span>
            <span class="pay-opt-name">${m.name}</span>
          </div>`).join('')}
        </div>
      </div>

      <!-- Summary -->
      <div class="cart-summary">
        <h3>Summary</h3>
        ${cart.map(i=>`<div class="sum-row"><span>${i.name} ×${i.qty}</span><span>${money(i.price*i.qty)}</span></div>`).join('')}
        <div class="sum-row" style="margin-top:8px"><span>Subtotal</span><span>${money(sub)}</span></div>
        <div class="sum-row"><span>Delivery</span><span>${del===0?'<span class="text-green fw-700">FREE</span>':money(del)}</span></div>
        <div class="sum-row sum-total"><span>Total</span><span>${money(total)}</span></div>
        <button class="btn btn-primary btn-full" style="margin-top:16px" onclick="placeOrder(${total})">Place Order →</button>
      </div>
    </div>
  </div>`;
}

function pickPayment(el) {
  document.querySelectorAll('.pay-opt').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  el.querySelector('input').checked = true;
}

async function placeOrder(total) {
  const fields = ['a-name','a-phone','a-street','a-city','a-pin','a-state'];
  const vals   = {};
  for (const f of fields) {
    const v = document.getElementById(f)?.value.trim();
    if (!v) { toast('Fill all address fields', 'warning'); return; }
    vals[f] = v;
  }
  const payEl = document.querySelector('input[name=pay]:checked');
  if (!payEl) { toast('Select a payment method', 'warning'); return; }

  showLoader(true);
  try {
    const id    = Date.now().toString(36).toUpperCase();
    const order = {
      orderId:   id,
      userId:    _user.uid,
      userName:  _user.name,
      userEmail: _user.email,
      items:     getCart(),
      address:   { name:vals['a-name'], phone:vals['a-phone'], street:vals['a-street'], city:vals['a-city'], pincode:vals['a-pin'], state:vals['a-state'] },
      payment:   payEl.value,
      total,
      status:    'pending',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    await db.collection('orders').add(order);
    saveCart([]);
    showLoader(false);
    toast('Order placed! 🎉', 'success');
    setTimeout(() => go('orders'), 900);
  } catch(e) {
    showLoader(false);
    toast('Failed: ' + e.message, 'error');
  }
}

/* ── Orders ──────────────────────────────────────────────── */
async function renderOrders() {
  const app = document.getElementById('app');
  app.innerHTML = `<div class="page">${Array(3).fill(0).map(()=>`<div class="skel-card mb-16" style="height:90px;margin-bottom:14px"></div>`).join('')}</div>`;
  try {
    const snap = await db.collection('orders').where('userId','==',_user.uid).orderBy('createdAt','desc').get();
    const list = snap.docs.map(d => ({id:d.id,...d.data()}));
    app.innerHTML = `
    <div class="page">
      <h2 style="font-family:var(--f-display);font-weight:800;margin-bottom:22px">My Orders</h2>
      ${list.length ? list.map(o => `
      <div class="card" style="margin-bottom:14px;cursor:pointer" onclick="go('order','${o.id}')">
        <div class="card-head">
          <div>
            <span style="font-family:var(--f-display);font-weight:700;font-size:.85rem">#${o.orderId||o.id.slice(0,8).toUpperCase()}</span>
            <span class="text-muted" style="font-size:.78rem;margin-left:10px">${fmtDate(o.createdAt)}</span>
          </div>
          ${badge(o.status)}
        </div>
        <div class="card-body" style="display:flex;gap:10px;align-items:center;padding:12px 18px">
          ${(o.items||[]).slice(0,4).map(i=>i.image?`<img style="width:52px;height:52px;border-radius:8px;object-fit:cover" src="${i.image}" alt="${i.name}">`:``).join('')}
          <div style="margin-left:auto;font-family:var(--f-display);font-weight:800">${money(o.total)}</div>
        </div>
      </div>`).join('') : `
      <div class="empty">
        <div class="empty-icon">📦</div>
        <h3>No orders yet</h3>
        <p>Your orders will show up here</p>
        <button class="btn btn-primary" onclick="go('home')">Start Shopping</button>
      </div>`}
    </div>`;
  } catch(e) {
    app.innerHTML = `<div class="empty"><div class="empty-icon">⚠️</div><h3>Error loading orders</h3><p>${e.message}</p></div>`;
  }
}

/* ── Order detail / tracking ─────────────────────────────── */
async function renderOrder(id) {
  const app = document.getElementById('app');
  app.innerHTML = `<div class="page"><div class="skel-card"><div class="skel skel--img"></div></div></div>`;
  try {
    const doc = await db.collection('orders').doc(id).get();
    if (!doc.exists) { toast('Order not found','error'); go('orders'); return; }
    const o  = {id:doc.id,...doc.data()};
    const steps = ['pending','accepted','packed','shipped','delivered'];
    const cur   = steps.indexOf(o.status);

    app.innerHTML = `
    <div class="page">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:22px">
        <button class="btn btn-ghost btn-sm" onclick="go('orders')">← Orders</button>
        <h2 style="font-family:var(--f-display);font-weight:800">#${o.orderId||id.slice(0,8).toUpperCase()}</h2>
        ${badge(o.status)}
      </div>

      <div style="display:grid;grid-template-columns:1fr 300px;gap:20px">
        <div>
          <!-- Tracking -->
          <div class="card" style="margin-bottom:16px">
            <div class="card-head"><span style="font-family:var(--f-display);font-weight:700">Tracking</span></div>
            <div class="card-body">
              <div class="track-steps">
                ${steps.map((s,i)=>`
                <div class="track-step ${i<cur?'done':i===cur?'current':''}">
                  <div class="track-dot">${i<cur?'✓':i+1}</div>
                  <div class="track-info">
                    <h4>${s.charAt(0).toUpperCase()+s.slice(1)}</h4>
                    <p>${i<=cur?(i===0?fmtDate(o.createdAt):'Completed'):'Pending'}</p>
                  </div>
                </div>`).join('')}
              </div>
            </div>
          </div>
          <!-- Items -->
          <div class="card">
            <div class="card-head"><span style="font-family:var(--f-display);font-weight:700">Items</span></div>
            <div class="card-body" style="padding:0">
              ${(o.items||[]).map(it=>`
              <div style="display:flex;gap:12px;align-items:center;padding:12px 18px;border-bottom:1px solid var(--border)">
                ${it.image?`<img style="width:56px;height:56px;border-radius:8px;object-fit:cover" src="${it.image}">`:``}
                <div style="flex:1">
                  <p style="font-weight:700;font-family:var(--f-display);font-size:.88rem">${it.name}</p>
                  <p style="font-size:.76rem;color:var(--txt-2)">${[it.size&&'Size:'+it.size,it.color&&'Color:'+it.color].filter(Boolean).join(' · ')}</p>
                </div>
                <span style="font-family:var(--f-display);font-weight:800;color:var(--brand)">${money(it.price*it.qty)}</span>
              </div>`).join('')}
            </div>
          </div>
        </div>
        <!-- Address + Payment -->
        <div style="display:flex;flex-direction:column;gap:14px">
          <div class="card">
            <div class="card-head"><span style="font-family:var(--f-display);font-weight:700">Address</span></div>
            <div class="card-body">
              <p style="font-weight:700">${o.address?.name}</p>
              <p style="font-size:.84rem;color:var(--txt-2);line-height:1.6">${o.address?.street}, ${o.address?.city}, ${o.address?.state} — ${o.address?.pincode}</p>
              <p style="font-size:.8rem;color:var(--txt-3);margin-top:4px">📞 ${o.address?.phone}</p>
            </div>
          </div>
          <div class="card">
            <div class="card-head"><span style="font-family:var(--f-display);font-weight:700">Payment</span></div>
            <div class="card-body">
              <div class="sum-row"><span>Method</span><span style="text-transform:capitalize;font-weight:700">${o.payment}</span></div>
              <div class="sum-row sum-total"><span>Total</span><span>${money(o.total)}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>`;
  } catch(e) { toast('Error','error'); go('orders'); }
}

/* ── Profile ─────────────────────────────────────────────── */
async function renderProfile() {
  const app = document.getElementById('app');
  const snap = await db.collection('orders').where('userId','==',_user.uid).get();
  const spent = snap.docs.reduce((s,d)=>s+(d.data().total||0),0);

  app.innerHTML = `
  <div class="page">
    <h2 style="font-family:var(--f-display);font-weight:800;margin-bottom:22px">Profile</h2>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;max-width:700px">
      <div class="card" style="grid-column:1/-1">
        <div class="card-body" style="display:flex;align-items:center;gap:18px">
          <img src="${_user.photoURL||avatarUrl(_user.name)}" style="width:76px;height:76px;border-radius:50%;border:3px solid var(--brand);object-fit:cover">
          <div>
            <h2 style="font-family:var(--f-display);font-size:1.35rem">${_user.name||'User'}</h2>
            <p class="text-muted">${_user.email||''}</p>
            <span class="badge badge--green" style="margin-top:6px">✓ Verified Customer</span>
          </div>
        </div>
      </div>
      <div class="stat-card"><div class="stat-ico ico-orange">📦</div><div><div class="stat-val">${snap.size}</div><div class="stat-lbl">Total Orders</div></div></div>
      <div class="stat-card"><div class="stat-ico ico-green">💰</div><div><div class="stat-val">${money(spent)}</div><div class="stat-lbl">Total Spent</div></div></div>
    </div>
    <div style="display:flex;gap:12px;margin-top:20px;flex-wrap:wrap">
      <button class="btn btn-secondary" onclick="go('orders')">📦 My Orders</button>
      <button class="btn btn-red"       onclick="doSignOut()">Sign Out</button>
    </div>
  </div>`;
}

async function doSignOut() {
  await auth.signOut();
  sessionStorage.removeItem('sw-guest');
  window.location.href = '../login.html';
}

/* ── Header search (live dropdown) ──────────────────────── */
function setupHeaderSearch() {
  const inp  = document.getElementById('hdr-search');
  const drop = document.getElementById('search-drop');
  if (!inp) return;

  inp.addEventListener('input', debounce(e => {
    const q = e.target.value.toLowerCase().trim();
    if (!q) { drop.classList.remove('open'); return; }
    const res = _products.filter(p => p.name.toLowerCase().includes(q)).slice(0, 7);
    if (!res.length) { drop.classList.remove('open'); return; }
    drop.innerHTML = res.map(p=>`
      <div class="search-item" onclick="inp.value='';drop.classList.remove('open');go('product','${p.id}')">
        ${p.images?.[0]?`<img src="${p.images[0]}" alt="${p.name}">`:`<div style="width:42px;height:42px;border-radius:8px;background:var(--bg);display:flex;align-items:center;justify-content:center">📦</div>`}
        <div><p class="search-item-name">${p.name}</p><p class="search-item-price">${money(p.price)}</p></div>
      </div>`).join('');
    drop.classList.add('open');
  }));

  inp.addEventListener('keydown', e => {
    if (e.key==='Enter') { go('search', inp.value); drop.classList.remove('open'); }
  });
  document.addEventListener('click', e => {
    if (!inp.contains(e.target) && !drop.contains(e.target)) drop.classList.remove('open');
  });
}
