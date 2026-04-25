/* ============================================================
   SHOPWAVE — Seller Panel SPA
   ============================================================ */
'use strict';

/* ── State ── */
let _user       = null;
let _seller     = null;   // sellers/{id} doc
let _cats       = [];
let _imgURLs    = [];     // uploaded product images
let _editId     = null;   // product being edited
let _tags       = { sizes: [], colors: [] };

/* ── Boot ── */
(async function boot() {
  applyTheme();
  showLoader(true);

  auth.onAuthStateChanged(async fireUser => {
    if (!fireUser) {
      showLoader(false);
      document.getElementById('panel-content').innerHTML = `
        <div class="status-screen">
          <div class="status-card">
            <div class="status-icon">🔐</div>
            <h2>Not Signed In</h2>
            <p>Sign in with your Google account to access the Seller Panel.</p>
            <a href="../login.html" class="btn btn-primary" style="display:inline-flex">Sign In with Google</a>
          </div>
        </div>`;
      return;
    }
    const snap = await db.collection('users').doc(fireUser.uid).get();
    const data = snap.data() || {};
    _user = { uid: fireUser.uid, photoURL: fireUser.photoURL, ...data };

    /* check seller application */
    const selSnap = await db.collection('sellers').where('userId', '==', fireUser.uid).limit(1).get();

    if (data.role !== 'seller' && data.role !== 'admin') {
      if (selSnap.empty) {
        // never applied
        updateSidebar();
        showLoader(false);
        renderRegister();
        return;
      }
      const sd = selSnap.docs[0].data();
      if (sd.status !== 'approved') {
        updateSidebar();
        showLoader(false);
        renderPending(sd.status);
        return;
      }
    }

    _seller = selSnap.empty ? null : { id: selSnap.docs[0].id, ...selSnap.docs[0].data() };
    updateSidebar();
    await loadCats();
    await loadOrderBadge();
    showLoader(false);
    go('dashboard');
  });
})();

/* ── Theme ── */
function applyTheme() {
  document.documentElement.setAttribute('data-theme', localStorage.getItem('sw-theme') || 'light');
}
function toggleTheme() {
  const t = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('sw-theme', t);
}

/* ── Sidebar helpers ── */
function updateSidebar() {
  if (!_user) return;
  const av = document.getElementById('sb-avatar');
  const nm = document.getElementById('sb-name');
  const em = document.getElementById('sb-email');
  if (av) av.src = _user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(_user.name||'S')}&background=ff4d00&color=fff`;
  if (nm) nm.textContent  = _user.name  || 'Seller';
  if (em) em.textContent  = _user.email || '';
}
function openSidebar()  { document.getElementById('sidebar').classList.add('open'); document.getElementById('sb-veil').classList.add('open'); }
function closeSidebar() { document.getElementById('sidebar').classList.remove('open'); document.getElementById('sb-veil').classList.remove('open'); }

/* ── Navigation ── */
const PAGE_TITLES = { dashboard:'Dashboard', products:'My Products', 'add-product':'Add Product', orders:'Orders', profile:'Profile' };

function go(page, triggerEl = null) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const t = triggerEl || document.querySelector(`[data-page="${page}"]`);
  if (t) t.classList.add('active');
  document.getElementById('page-title').textContent = PAGE_TITLES[page] || page;
  closeSidebar();
  const content = document.getElementById('panel-content');
  content.className = 'panel-content page';

  switch (page) {
    case 'dashboard':   renderDashboard();  break;
    case 'products':    renderProducts();   break;
    case 'add-product': renderAddProduct(); break;
    case 'orders':      renderOrders();     break;
    case 'profile':     renderProfile();    break;
  }
}

async function loadCats() {
  try {
    const snap = await db.collection('categories').get();
    _cats = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (_) {
    _cats = [
      {id:'electronics',name:'Electronics'},{id:'fashion',name:'Fashion'},
      {id:'home',name:'Home'},{id:'beauty',name:'Beauty'},
      {id:'sports',name:'Sports'},{id:'books',name:'Books'}
    ];
  }
}

async function loadOrderBadge() {
  try {
    const snap = await db.collection('orders').where('status','==','pending').get();
    const count = snap.docs.filter(d => (d.data().items||[]).some(i => i.sellerId === _user.uid)).length;
    const b = document.getElementById('order-badge');
    if (b && count > 0) { b.textContent = count; b.classList.remove('hidden'); }
  } catch(_) {}
}

/* ── Sign out ── */
async function doSignOut() {
  await auth.signOut();
  window.location.href = '../login.html';
}

/* ══════════════════════════════════════════════════════════
   REGISTRATION
   ══════════════════════════════════════════════════════════ */
function renderRegister() {
  document.getElementById('panel-content').innerHTML = `
  <div class="page" style="max-width:540px;margin:36px auto">
    <h2 style="font-family:var(--f-display);font-size:1.5rem;font-weight:800;margin-bottom:6px">Become a Seller 🛍️</h2>
    <p class="text-muted" style="margin-bottom:24px">Fill in your details. Admin will review within 24–48 hours.</p>
    <div class="card"><div class="card-body">
      <div class="field"><label>Store Name *</label><input class="input" id="r-store" placeholder="Your store name"></div>
      <div class="field"><label>Business Type *</label>
        <select class="input" id="r-type">
          <option value="">Select…</option>
          <option>Individual / Freelancer</option>
          <option>Registered Business</option>
          <option>Brand / Manufacturer</option>
        </select>
      </div>
      <div class="grid-2">
        <div class="field"><label>Phone *</label><input class="input" id="r-phone" type="tel" placeholder="+91 XXXXXXXXXX"></div>
        <div class="field"><label>GST Number</label><input class="input" id="r-gst" placeholder="Optional"></div>
      </div>
      <div class="field"><label>Business Address *</label><textarea class="input" id="r-addr" rows="2" placeholder="Full address"></textarea></div>
      <div class="field"><label>Why sell on ShopWave?</label><textarea class="input" id="r-reason" rows="2" placeholder="Brief description…"></textarea></div>
      <button class="btn btn-primary btn-full" onclick="submitRegister()">Submit Application →</button>
      <p style="font-size:.74rem;color:var(--txt-3);text-align:center;margin-top:10px">Approval usually takes 24–48 hrs</p>
    </div></div>
  </div>`;
}

async function submitRegister() {
  const store  = document.getElementById('r-store')?.value.trim();
  const type   = document.getElementById('r-type')?.value;
  const phone  = document.getElementById('r-phone')?.value.trim();
  const addr   = document.getElementById('r-addr')?.value.trim();
  if (!store || !type || !phone || !addr) { toast('Fill all required fields','warning'); return; }

  showLoader(true);
  try {
    await db.collection('sellers').add({
      userId:       _user.uid,
      name:         _user.name,
      email:        _user.email,
      storeName:    store,
      businessType: type,
      phone,
      address:      addr,
      gst:          document.getElementById('r-gst')?.value.trim() || '',
      reason:       document.getElementById('r-reason')?.value.trim() || '',
      status:       'pending',
      createdAt:    firebase.firestore.FieldValue.serverTimestamp()
    });
    await db.collection('users').doc(_user.uid).update({ role: 'seller_pending' });
    showLoader(false);
    toast('Application submitted!', 'success');
    renderPending('pending');
  } catch (e) {
    showLoader(false);
    toast('Failed: ' + e.message, 'error');
  }
}

function renderPending(status) {
  document.getElementById('panel-content').innerHTML = `
  <div class="status-screen">
    <div class="status-card">
      <div class="status-icon">${status === 'rejected' ? '❌' : '⏳'}</div>
      <h2>${status === 'rejected' ? 'Application Rejected' : 'Under Review'}</h2>
      <p>${status === 'rejected'
        ? 'Your application was not approved. Please contact support.'
        : 'Your seller application is being reviewed. You\'ll be notified once approved.'}</p>
      <button class="btn btn-secondary" onclick="doSignOut()">Sign Out</button>
    </div>
  </div>`;
}

/* ══════════════════════════════════════════════════════════
   DASHBOARD
   ══════════════════════════════════════════════════════════ */
async function renderDashboard() {
  const el = document.getElementById('panel-content');
  el.innerHTML = `<div class="skel-card" style="height:110px;margin-bottom:16px"></div><div class="skel-card" style="height:320px"></div>`;

  try {
    const [prodSnap, orderSnap] = await Promise.all([
      db.collection('products').where('sellerId','==',_user.uid).get(),
      db.collection('orders').orderBy('createdAt','desc').get()
    ]);

    const products  = prodSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const allOrders = orderSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const myOrders  = allOrders.filter(o => (o.items||[]).some(i => i.sellerId === _user.uid));

    const revenue = myOrders
      .filter(o => o.status === 'delivered')
      .reduce((s, o) => s + (o.items||[]).filter(i => i.sellerId === _user.uid).reduce((ss,i) => ss+i.price*i.qty, 0), 0);

    const pending = myOrders.filter(o => o.status === 'pending').length;
    const active  = products.filter(p => p.status === 'active').length;

    /* Monthly chart – last 6 months */
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(); d.setMonth(d.getMonth() - 5 + i);
      return { lbl: d.toLocaleString('en',{month:'short'}), val: 0 };
    });
    myOrders.filter(o => o.status === 'delivered').forEach(o => {
      const d = o.createdAt?.toDate?.() || new Date();
      const lbl = d.toLocaleString('en',{month:'short'});
      const m   = months.find(m => m.lbl === lbl);
      if (m) m.val += (o.items||[]).filter(i=>i.sellerId===_user.uid).reduce((s,i)=>s+i.price*i.qty,0);
    });
    const maxVal = Math.max(...months.map(m => m.val), 1);

    el.innerHTML = `
    <div class="page">
      <div class="stats-row">
        <div class="stat-card"><div class="stat-ico ico-orange">💰</div><div><div class="stat-val">${money(revenue)}</div><div class="stat-lbl">Total Revenue</div></div></div>
        <div class="stat-card"><div class="stat-ico ico-blue">📦</div><div><div class="stat-val">${myOrders.length}</div><div class="stat-lbl">Total Orders</div></div></div>
        <div class="stat-card"><div class="stat-ico ico-green">🛍️</div><div><div class="stat-val">${active}</div><div class="stat-lbl">Active Products</div></div></div>
        <div class="stat-card"><div class="stat-ico ico-yellow">⏳</div><div><div class="stat-val">${pending}</div><div class="stat-lbl">Pending Orders</div></div></div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 320px;gap:18px">
        <!-- Revenue chart -->
        <div class="card">
          <div class="card-head">
            <span style="font-family:var(--f-display);font-weight:700">Revenue — Last 6 Months</span>
          </div>
          <div class="card-body">
            <div class="bar-chart">
              ${months.map(m => `
              <div class="bar-col">
                <div class="bar-fill" style="height:${Math.max(4,Math.round(m.val/maxVal*130))}px" title="${money(m.val)}"></div>
                <span class="bar-lbl">${m.lbl}</span>
              </div>`).join('')}
            </div>
          </div>
        </div>

        <!-- Recent orders -->
        <div class="card">
          <div class="card-head">
            <span style="font-family:var(--f-display);font-weight:700">Recent Orders</span>
            <button class="btn btn-ghost btn-sm" onclick="go('orders')">View all</button>
          </div>
          <div style="padding:0">
            ${myOrders.slice(0,6).map(o => `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 18px;border-bottom:1px solid var(--border)">
              <div>
                <p style="font-family:var(--f-display);font-weight:700;font-size:.82rem">#${(o.orderId||o.id.slice(0,8)).toUpperCase()}</p>
                <p style="font-size:.73rem;color:var(--txt-2)">${fmtDate(o.createdAt)}</p>
              </div>
              ${badge(o.status)}
            </div>`).join('') || `<div class="empty" style="padding:30px"><div class="empty-icon">📦</div><h3>No orders yet</h3></div>`}
          </div>
        </div>
      </div>

      <!-- Products table preview -->
      <div class="card" style="margin-top:18px">
        <div class="card-head">
          <span style="font-family:var(--f-display);font-weight:700">Products</span>
          <button class="btn btn-primary btn-sm" onclick="go('add-product')">+ Add</button>
        </div>
        <div class="tbl-wrap" style="border:none;border-radius:0">
          <table>
            <thead><tr><th>Product</th><th>Price</th><th>Stock</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              ${products.slice(0,6).map(p => prodRow(p)).join('') || `
              <tr><td colspan="5"><div class="empty" style="padding:30px">
                <div class="empty-icon">🛍️</div><h3>No products yet</h3>
                <button class="btn btn-primary btn-sm" onclick="go('add-product')">Add First Product</button>
              </div></td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
  } catch (e) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">⚠️</div><h3>${e.message}</h3></div>`;
  }
}

function prodRow(p) {
  return `
  <tr>
    <td>
      <div style="display:flex;align-items:center;gap:10px">
        ${p.images?.[0]
          ? `<img src="${p.images[0]}" style="width:44px;height:44px;border-radius:8px;object-fit:cover" alt="${p.name}">`
          : `<div style="width:44px;height:44px;border-radius:8px;background:var(--bg);display:flex;align-items:center;justify-content:center;font-size:1.3rem">📦</div>`}
        <span style="font-weight:600;font-family:var(--f-display);font-size:.85rem;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.name}</span>
      </div>
    </td>
    <td style="font-weight:700;color:var(--brand)">${money(p.price)}</td>
    <td><span style="color:${p.stock<5?'var(--red)':'inherit'}">${p.stock}</span></td>
    <td>${badge(p.status||'active')}</td>
    <td>
      <div style="display:flex;gap:6px">
        <button class="btn btn-secondary btn-sm" onclick="editProduct('${p.id}')">✏️ Edit</button>
        <button class="btn btn-red btn-sm"       onclick="deleteProduct('${p.id}')">🗑️</button>
      </div>
    </td>
  </tr>`;
}

/* ══════════════════════════════════════════════════════════
   PRODUCTS
   ══════════════════════════════════════════════════════════ */
async function renderProducts() {
  const el = document.getElementById('panel-content');
  el.innerHTML = `<div class="skel-card" style="height:400px"></div>`;
  try {
    const snap     = await db.collection('products').where('sellerId','==',_user.uid).orderBy('createdAt','desc').get();
    const products = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    el.innerHTML = `
    <div class="page">
      <div class="pg-head">
        <h2>Products (${products.length})</h2>
        <button class="btn btn-primary" onclick="go('add-product')">+ Add Product</button>
      </div>
      <div class="tbl-wrap">
        <table>
          <thead><tr><th>Image</th><th>Name</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            ${products.map(p => `
            <tr>
              <td>${p.images?.[0]?`<img src="${p.images[0]}" style="width:44px;height:44px;border-radius:8px;object-fit:cover">`:`<div style="width:44px;height:44px;border-radius:8px;background:var(--bg);display:flex;align-items:center;justify-content:center;font-size:1.3rem">📦</div>`}</td>
              <td style="font-weight:600;max-width:180px">${p.name}</td>
              <td style="color:var(--txt-2)">${p.category||'—'}</td>
              <td style="font-weight:700;color:var(--brand)">${money(p.price)}</td>
              <td><span style="color:${p.stock<5?'var(--red)':'inherit'}">${p.stock}</span></td>
              <td>${badge(p.status||'active')}</td>
              <td>
                <div style="display:flex;gap:6px">
                  <button class="btn btn-secondary btn-sm" onclick="editProduct('${p.id}')">✏️ Edit</button>
                  <button class="btn btn-red btn-sm"       onclick="deleteProduct('${p.id}')">🗑️</button>
                </div>
              </td>
            </tr>`).join('') || `
            <tr><td colspan="7">
              <div class="empty" style="padding:40px">
                <div class="empty-icon">📦</div><h3>No products yet</h3>
                <button class="btn btn-primary btn-sm" onclick="go('add-product')">Add First Product</button>
              </div>
            </td></tr>`}
          </tbody>
        </table>
      </div>
    </div>`;
  } catch (e) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">⚠️</div><h3>${e.message}</h3></div>`;
  }
}

/* ── Add / Edit product form ── */
function renderAddProduct(product = null) {
  _editId  = product?.id || null;
  _imgURLs = product?.images  || [];
  _tags    = { sizes: [...(product?.sizes||[])], colors: [...(product?.colors||[])] };

  const el = document.getElementById('panel-content');  el.innerHTML = `
  <div class="page">
    <div class="pg-head">
      <h2>${product ? 'Edit Product' : 'Add New Product'}</h2>
      <button class="btn btn-ghost btn-sm" onclick="go('products')">← Back</button>
    </div>

    <div class="grid-2" style="align-items:start">
      <!-- Left: info -->
      <div class="card"><div class="card-body">
        <div class="field"><label>Product Name *</label><input class="input" id="p-name" value="${product?.name||''}" placeholder="Enter product name"></div>
        <div class="grid-2">
          <div class="field"><label>Price (₹) *</label><input class="input" id="p-price" type="number" min="0" step="0.01" value="${product?.price||''}" placeholder="0.00"></div>
          <div class="field"><label>MRP / Original</label><input class="input" id="p-orig"  type="number" min="0" step="0.01" value="${product?.originalPrice||''}" placeholder="MRP"></div>
        </div>
        <div class="grid-2">
          <div class="field"><label>Stock Qty *</label><input class="input" id="p-stock" type="number" min="0" value="${product?.stock||''}" placeholder="0"></div>
          <div class="field"><label>Category *</label>
            <select class="input" id="p-cat">
              <option value="">Select…</option>
              ${_cats.map(c=>`<option value="${c.id}" ${product?.category===c.id?'selected':''}>${c.name}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="field"><label>Description *</label><textarea class="input" id="p-desc" rows="4" placeholder="Describe your product…">${product?.description||''}</textarea></div>
        <div class="field" style="margin-bottom:0"><label>Status</label>
          <select class="input" id="p-status">
            <option value="active"   ${product?.status!=='inactive'?'selected':''}>Active</option>
            <option value="inactive" ${product?.status==='inactive' ?'selected':''}>Inactive</option>
          </select>
        </div>
      </div></div>

      <!-- Right: images + variants -->
      <div style="display:flex;flex-direction:column;gap:16px">
        <!-- Images -->
        <div class="card"><div class="card-body">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">
            <p style="font-family:var(--f-display);font-weight:700">Product Images</p>
            <span id="img-limit-badge" style="font-size:.74rem;color:var(--txt-2);background:var(--bg);padding:3px 10px;border-radius:var(--r-full);border:1px solid var(--border)">Loading limit…</span>
          </div>
          <div class="upload-zone" id="upload-zone">
            <input type="file" id="img-file" accept="image/*" multiple onchange="handleImgUpload(this)">
            <div class="upload-icon">📷</div>
            <p class="upload-label">Click or drag images here</p>
            <p class="upload-hint" id="upload-hint-text">Max 5 MB per image · JPG, PNG, WEBP</p>
          </div>
          <div class="upload-bar" id="upload-bar"><div class="upload-fill" id="upload-fill"></div></div>
          <div class="img-thumbs" id="img-thumbs">
            ${_imgURLs.map((u,i) => thumbHTML(u,i)).join('')}
          </div>
        </div></div>

        <!-- Variants -->
        <div class="card"><div class="card-body">
          <p style="font-family:var(--f-display);font-weight:700;margin-bottom:14px">Variants</p>
          <div class="field">
            <label>Sizes <span style="font-weight:400;text-transform:none;font-size:.72rem">(press Enter after each)</span></label>
            <div class="tag-wrap" id="sizes-wrap" onclick="document.getElementById('size-inp').focus()">
              ${_tags.sizes.map(s=>chipHTML(s,'sizes')).join('')}
              <input class="tag-inp" id="size-inp" placeholder="S, M, L, XL…" onkeydown="addTag(event,'sizes','size-inp')">
            </div>
          </div>
          <div class="field" style="margin-bottom:0">
            <label>Colors <span style="font-weight:400;text-transform:none;font-size:.72rem">(press Enter after each)</span></label>
            <div class="tag-wrap" id="colors-wrap" onclick="document.getElementById('color-inp').focus()">
              ${_tags.colors.map(c=>chipHTML(c,'colors')).join('')}
              <input class="tag-inp" id="color-inp" placeholder="Red, Blue, Black…" onkeydown="addTag(event,'colors','color-inp')">
            </div>
          </div>
        </div></div>

        <button class="btn btn-primary btn-full btn-lg" onclick="saveProduct()">
          ${product ? '💾 Save Changes' : '🚀 Publish Product'}
        </button>
      </div>
    </div>
  </div>`;

  /* Load the seller's image limit and show it in the badge */
  loadImgLimitBadge();
}

function thumbHTML(url, i) {
  return `<div class="img-thumb" id="th-${i}">
    <img src="${url}" alt="img ${i}">
    <button class="img-thumb-del" onclick="removeImg(${i})">×</button>
  </div>`;
}
function chipHTML(val, arr) {
  return `<span class="tag-chip">${val}<span class="tag-chip-x" onclick="removeTag('${arr}','${val}')">×</span></span>`;
}
function addTag(e, arr, inputId) {
  if (e.key !== 'Enter' && e.key !== ',') return;
  e.preventDefault();
  const val = e.target.value.trim();
  if (!val || _tags[arr].includes(val)) { e.target.value = ''; return; }
  _tags[arr].push(val);
  const wrap = e.target.parentElement;
  const chip = document.createElement('span');
  chip.className = 'tag-chip';
  chip.innerHTML = `${val}<span class="tag-chip-x" onclick="removeTag('${arr}','${val}')">×</span>`;
  wrap.insertBefore(chip, e.target);
  e.target.value = '';
}
function removeTag(arr, val) {
  _tags[arr] = _tags[arr].filter(v => v !== val);
  const wrap = document.getElementById(arr + '-wrap');
  const inp  = document.getElementById(arr === 'sizes' ? 'size-inp' : 'color-inp');
  if (!wrap || !inp) return;
  wrap.querySelectorAll('.tag-chip').forEach(c => c.remove());
  _tags[arr].forEach(v => {
    const chip = document.createElement('span');
    chip.className = 'tag-chip';
    chip.innerHTML = `${v}<span class="tag-chip-x" onclick="removeTag('${arr}','${v}')">×</span>`;
    wrap.insertBefore(chip, inp);
  });
}
function removeImg(i) {
  _imgURLs.splice(i, 1);
  document.getElementById('img-thumbs').innerHTML = _imgURLs.map(thumbHTML).join('');
}

async function handleImgUpload(input) {
  /* ── Fetch effective upload limit for this seller ── */
  let maxAllowed = 6; // safe default
  try {
    // 1. Check for a custom per-seller limit
    const customDoc = await db.collection('uploadLimits').doc(_user.uid).get();
    if (customDoc.exists) {
      maxAllowed = customDoc.data().maxImages || 6;
    } else {
      // 2. Fall back to global setting
      const settingsDoc = await db.collection('settings').doc('app').get();
      if (settingsDoc.exists) maxAllowed = settingsDoc.data().maxImages || 6;
    }
  } catch(_) { /* keep default */ }

  const remaining = maxAllowed - _imgURLs.length;
  if (remaining <= 0) {
    toast(`You have reached your upload limit (${maxAllowed} images per product).`, 'warning');
    input.value = '';
    return;
  }

  const files = Array.from(input.files).slice(0, remaining);
  if (Array.from(input.files).length > remaining) {
    toast(`Only ${remaining} more image(s) allowed (limit: ${maxAllowed}). Extra files skipped.`, 'warning');
  }

  const bar  = document.getElementById('upload-bar');
  const fill = document.getElementById('upload-fill');
  bar.style.display = 'block'; fill.style.width = '0';
  let done = 0;

  for (const f of files) {
    if (f.size > 5 * 1024 * 1024) { toast(`${f.name} too large (max 5MB)`, 'warning'); done++; continue; }
    try {
      const url = await imgbbUpload(f);
      _imgURLs.push(url);
    } catch (err) { toast('Upload failed: ' + err.message, 'error'); }
    done++;
    fill.style.width = `${Math.round(done / files.length * 100)}%`;
    document.getElementById('img-thumbs').innerHTML = _imgURLs.map((u,i) => thumbHTML(u,i)).join('');
  }

  bar.style.display = 'none';
  if (done > 0) toast(`${done} image(s) uploaded! (${_imgURLs.length}/${maxAllowed} used)`, 'success');
  input.value = '';
}

async function saveProduct() {
  const name  = document.getElementById('p-name')?.value.trim();
  const price = parseFloat(document.getElementById('p-price')?.value);
  const stock = parseInt(document.getElementById('p-stock')?.value);
  const cat   = document.getElementById('p-cat')?.value;
  const desc  = document.getElementById('p-desc')?.value.trim();

  if (!name || !price || isNaN(stock) || !cat || !desc) {
    toast('Fill all required fields *', 'warning'); return;
  }

  /* collect any un-committed tag inputs */
  const si = document.getElementById('size-inp')?.value.trim();
  const ci = document.getElementById('color-inp')?.value.trim();
  if (si && !_tags.sizes.includes(si))  _tags.sizes.push(si);
  if (ci && !_tags.colors.includes(ci)) _tags.colors.push(ci);

  const orig   = parseFloat(document.getElementById('p-orig')?.value) || null;
  const status = document.getElementById('p-status')?.value || 'active';

  const data = {
    name, price, stock, category: cat, description: desc, status,
    images:       _imgURLs,
    sizes:        _tags.sizes,
    colors:       _tags.colors,
    sellerId:     _user.uid,
    sellerName:   _seller?.storeName || _user.name,
    updatedAt:    firebase.firestore.FieldValue.serverTimestamp(),
    ...(orig ? { originalPrice: orig } : {})
  };

  showLoader(true);
  try {
    if (_editId) {
      await db.collection('products').doc(_editId).update(data);
      toast('Product updated!', 'success');
    } else {
      await db.collection('products').add({ ...data, rating: 0, reviews: 0, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
      toast('Product published!', 'success');
    }
    showLoader(false);
    _editId = null; _imgURLs = []; _tags = { sizes: [], colors: [] };
    go('products');
  } catch (e) {
    showLoader(false);
    toast('Failed: ' + e.message, 'error');
  }
}

async function editProduct(id) {
  showLoader(true);
  const doc = await db.collection('products').doc(id).get();
  showLoader(false);
  if (!doc.exists) { toast('Product not found', 'error'); return; }
  const p = { id: doc.id, ...doc.data() };
  _imgURLs = p.images || [];
  _tags    = { sizes: p.sizes||[], colors: p.colors||[] };
  _editId  = id;
  renderAddProduct(p);
}

async function deleteProduct(id) {
  if (!confirm('Delete this product permanently?')) return;
  showLoader(true);
  try {
    await db.collection('products').doc(id).delete();
    toast('Product deleted', 'success');
    renderProducts();
  } catch (e) { toast('Failed: ' + e.message, 'error'); }
  showLoader(false);
}

/* ══════════════════════════════════════════════════════════
   ORDERS
   ══════════════════════════════════════════════════════════ */
async function renderOrders() {
  const el = document.getElementById('panel-content');
  el.innerHTML = `<div class="skel-card" style="height:380px"></div>`;
  try {
    const snap  = await db.collection('orders').orderBy('createdAt','desc').get();
    const orders = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(o => (o.items||[]).some(i => i.sellerId === _user.uid));

    el.innerHTML = `
    <div class="page">
      <div class="pg-head"><h2>Orders (${orders.length})</h2></div>
      <div class="tbl-wrap">
        <table>
          <thead><tr><th>Order ID</th><th>Customer</th><th>Items</th><th>Total</th><th>Date</th><th>Status</th><th>Update</th></tr></thead>
          <tbody>
            ${orders.map(o => {
              const myItems = (o.items||[]).filter(i => i.sellerId === _user.uid);
              const myTotal = myItems.reduce((s,i) => s+i.price*i.qty, 0);
              return `
              <tr>
                <td style="font-family:var(--f-display);font-weight:700;font-size:.82rem">#${(o.orderId||o.id.slice(0,8)).toUpperCase()}</td>
                <td>${o.userName||'—'}</td>
                <td>${myItems.length} item(s)</td>
                <td style="font-weight:700;color:var(--brand)">${money(myTotal)}</td>
                <td style="font-size:.8rem;color:var(--txt-2)">${fmtDate(o.createdAt)}</td>
                <td>${badge(o.status)}</td>
                <td>
                  <select class="input" style="padding:5px 8px;font-size:.78rem;width:120px" onchange="updateStatus('${o.id}',this.value)">
                    ${['pending','accepted','packed'].map(s=>
                      `<option value="${s}" ${o.status===s?'selected':''}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`
                    ).join('')}
                  </select>
                </td>
              </tr>`;
            }).join('') || `<tr><td colspan="7"><div class="empty" style="padding:40px"><div class="empty-icon">📦</div><h3>No orders yet</h3></div></td></tr>`}
          </tbody>
        </table>
      </div>
    </div>`;
  } catch (e) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">⚠️</div><h3>${e.message}</h3></div>`;
  }
}

async function updateStatus(orderId, status) {
  try {
    await db.collection('orders').doc(orderId).update({ status, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    toast(`Marked as ${status}`, 'success');
  } catch (e) { toast('Failed', 'error'); }
}

/* ══════════════════════════════════════════════════════════
   PROFILE
   ══════════════════════════════════════════════════════════ */
function renderProfile() {
  const el = document.getElementById('panel-content');
  el.innerHTML = `
  <div class="page">
    <div class="pg-head"><h2>Profile</h2></div>
    <div style="max-width:640px;display:flex;flex-direction:column;gap:16px">
      <div class="card"><div class="card-body" style="display:flex;align-items:center;gap:18px">
        <img src="${_user.photoURL||`https://ui-avatars.com/api/?name=${encodeURIComponent(_user.name||'S')}&background=ff4d00&color=fff`}"
             style="width:76px;height:76px;border-radius:50%;border:3px solid var(--brand);object-fit:cover">
        <div>
          <h2 style="font-family:var(--f-display);font-size:1.3rem">${_user.name||'Seller'}</h2>
          <p class="text-muted">${_user.email}</p>
          ${_seller ? `<p style="font-size:.82rem;color:var(--txt-2);margin-top:4px">🏪 ${_seller.storeName}</p>` : ''}
        </div>
      </div></div>

      ${_seller ? `
      <div class="card"><div class="card-body">
        <h3 style="font-family:var(--f-display);margin-bottom:14px">Store Details</h3>
        <div class="grid-2" style="font-size:.88rem;gap:10px">
          <div><span class="text-muted">Store Name</span><p style="font-weight:700">${_seller.storeName}</p></div>
          <div><span class="text-muted">Business Type</span><p style="font-weight:700">${_seller.businessType}</p></div>
          <div><span class="text-muted">Phone</span><p style="font-weight:700">${_seller.phone}</p></div>
          <div><span class="text-muted">GST</span><p style="font-weight:700">${_seller.gst||'—'}</p></div>
        </div>
        <p style="font-size:.84rem;color:var(--txt-2);margin-top:10px">${_seller.address}</p>
      </div></div>` : ''}

      <button class="btn btn-red" style="align-self:flex-start" onclick="doSignOut()">Sign Out</button>
    </div>
  </div>`;
}

/* ── Load & display the seller's effective upload limit ── */
async function loadImgLimitBadge() {
  const badge   = document.getElementById('img-limit-badge');
  const hint    = document.getElementById('upload-hint-text');
  if (!badge) return;

  let maxAllowed = 6;
  try {
    const customDoc = await db.collection('uploadLimits').doc(_user.uid).get();
    if (customDoc.exists) {
      maxAllowed = customDoc.data().maxImages || 6;
    } else {
      const settingsDoc = await db.collection('settings').doc('app').get();
      if (settingsDoc.exists) maxAllowed = settingsDoc.data().maxImages || 6;
    }
  } catch(_) {}

  const used      = _imgURLs.length;
  const remaining = maxAllowed - used;
  const pct       = Math.round(used / maxAllowed * 100);

  badge.textContent = `${used} / ${maxAllowed} images used`;
  badge.style.background    = remaining <= 1 ? 'rgba(239,68,68,.1)'  : remaining <= 2 ? 'rgba(245,158,11,.1)' : 'var(--bg)';
  badge.style.borderColor   = remaining <= 1 ? 'rgba(239,68,68,.3)'  : remaining <= 2 ? 'rgba(245,158,11,.3)' : 'var(--border)';
  badge.style.color         = remaining <= 1 ? 'var(--red)'          : remaining <= 2 ? 'var(--yellow)'       : 'var(--txt-2)';

  if (hint) {
    hint.textContent = remaining > 0
      ? `Max 5 MB · JPG, PNG, WEBP · ${remaining} slot(s) remaining of your ${maxAllowed}-image limit`
      : `Upload limit reached (${maxAllowed} images). Remove an image to add another.`;
    if (remaining === 0) hint.style.color = 'var(--red)';
  }

  /* disable the file input if at limit */
  const fileInput = document.getElementById('img-file');
  if (fileInput) fileInput.disabled = remaining <= 0;
}
