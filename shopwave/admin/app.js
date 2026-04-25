/* ============================================================
   SHOPWAVE — Admin Panel SPA  (no auto-redirect, responsive)
   ============================================================ */
'use strict';

let _user = null;

/* ── Boot ── */
(async function boot() {
  applyTheme();
  showLoader(true);

  auth.onAuthStateChanged(async fireUser => {
    if (!fireUser) {
      showLoader(false);
      document.getElementById('panel-content').innerHTML = `
        <div class="empty" style="min-height:70dvh">
          <div class="empty-icon">🔐</div>
          <h3>Not signed in</h3>
          <p>Please sign in to access the admin panel</p>
          <a href="../login.html" class="btn btn-primary" style="margin-top:8px">Go to Login</a>
        </div>`;
      return;
    }

    const snap = await db.collection('users').doc(fireUser.uid).get();
    const data = snap.data() || {};

    if (data.role !== 'admin') {
      showLoader(false);
      document.getElementById('panel-content').innerHTML = `
        <div class="empty" style="min-height:70dvh">
          <div class="empty-icon">🚫</div>
          <h3>Access Denied</h3>
          <p>You need admin privileges. Ask an existing admin to set your role to "admin" in Firestore.</p>
          <button class="btn btn-secondary" style="margin-top:8px" onclick="doSignOut()">Sign Out</button>
        </div>`;
      return;
    }

    _user = { uid: fireUser.uid, photoURL: fireUser.photoURL, ...data };
    updateSidebar();
    await loadBadges();
    showLoader(false);
    go('dashboard');
  });
})();

/* ── Helpers ── */
function applyTheme() {
  document.documentElement.setAttribute('data-theme', localStorage.getItem('sw-theme') || 'light');
}
function toggleTheme() {
  const t = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('sw-theme', t);
}
function updateSidebar() {
  if (!_user) return;
  const av = document.getElementById('sb-avatar');
  const nm = document.getElementById('sb-name');
  const em = document.getElementById('sb-email');
  if (av) av.src = _user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(_user.name||'A')}&background=ff4d00&color=fff`;
  if (nm) nm.textContent = _user.name  || 'Admin';
  if (em) em.textContent = _user.email || '';
}
function openSidebar()  { document.getElementById('sidebar').classList.add('open'); document.getElementById('sb-veil').classList.add('open'); }
function closeSidebar() { document.getElementById('sidebar').classList.remove('open'); document.getElementById('sb-veil').classList.remove('open'); }
async function doSignOut() { await auth.signOut(); window.location.href = '../login.html'; }

async function loadBadges() {
  try {
    const [s, d] = await Promise.all([
      db.collection('sellers').where('status','==','pending').get(),
      db.collection('deliveryPartners').where('status','==','pending').get()
    ]);
    const bs = document.getElementById('b-sellers');
    const bd = document.getElementById('b-delivery');
    if (bs && s.size > 0) { bs.textContent = s.size; bs.classList.remove('hidden'); }
    if (bd && d.size > 0) { bd.textContent = d.size; bd.classList.remove('hidden'); }
  } catch (_) {}
}

/* ── Navigation ── */
const TITLES = {
  dashboard:'Dashboard', sellers:'Sellers', delivery:'Delivery Partners',
  users:'Users', products:'Products', orders:'Orders',
  categories:'Categories', payments:'Payment Methods',
  settings:'App Settings', 'upload-limits':'Upload Limits per User',
  'img-library':'Image Library'
};

function go(page, triggerEl = null) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const t = triggerEl || document.querySelector(`[data-page="${page}"]`);
  if (t) t.classList.add('active');
  document.getElementById('page-title').textContent = TITLES[page] || page;
  closeSidebar();
  document.getElementById('panel-content').className = 'panel-content page';

  switch (page) {
    case 'dashboard':     renderDashboard();    break;
    case 'sellers':       renderSellers();      break;
    case 'delivery':      renderDelivery();     break;
    case 'users':         renderUsers();        break;
    case 'products':      renderProducts();     break;
    case 'orders':        renderOrders();       break;
    case 'categories':    renderCategories();   break;
    case 'payments':      renderPayments();     break;
    case 'settings':      renderSettings();     break;
    case 'upload-limits': renderUploadLimits(); break;
    case 'img-library':   renderImgLibrary();   break;
  }
}

/* ══════════════════════════════════════════════════════════
   DASHBOARD
   ══════════════════════════════════════════════════════════ */
async function renderDashboard() {
  const el = document.getElementById('panel-content');
  el.innerHTML = `<div class="skel-card" style="height:110px;margin-bottom:16px"></div><div class="skel-card" style="height:340px"></div>`;
  try {
    const [usersSnap, ordersSnap, prodSnap, sellersSnap] = await Promise.all([
      db.collection('users').get(),
      db.collection('orders').orderBy('createdAt','desc').get(),
      db.collection('products').get(),
      db.collection('sellers').where('status','==','approved').get()
    ]);

    const orders  = ordersSnap.docs.map(d => ({id:d.id,...d.data()}));
    const revenue = orders.filter(o => o.status==='delivered').reduce((s,o) => s+(o.total||0), 0);
    const pending = orders.filter(o => o.status==='pending').length;

    el.innerHTML = `
    <div class="page">
      <div class="stats-row">
        <div class="stat-card"><div class="stat-ico ico-orange">💰</div><div><div class="stat-val">${money(revenue)}</div><div class="stat-lbl">Total Revenue</div></div></div>
        <div class="stat-card"><div class="stat-ico ico-blue">👥</div><div><div class="stat-val">${usersSnap.size}</div><div class="stat-lbl">Users</div></div></div>
        <div class="stat-card"><div class="stat-ico ico-green">📦</div><div><div class="stat-val">${ordersSnap.size}</div><div class="stat-lbl">Orders</div></div></div>
        <div class="stat-card"><div class="stat-ico ico-purple">🛍️</div><div><div class="stat-val">${sellersSnap.size}</div><div class="stat-lbl">Active Sellers</div></div></div>
      </div>

      <div style="display:grid;grid-template-columns:2fr 1fr;gap:16px">
        <div class="card">
          <div class="card-head"><span style="font-family:var(--f-display);font-weight:700">Recent Orders</span><button class="btn btn-ghost btn-sm" onclick="go('orders')">View all</button></div>
          <div class="tbl-wrap" style="border:none;border-radius:0">
            <table>
              <thead><tr><th>Order ID</th><th>Customer</th><th>Total</th><th>Status</th><th>Date</th></tr></thead>
              <tbody>
                ${orders.slice(0,8).map(o=>`
                <tr>
                  <td style="font-family:var(--f-display);font-weight:700;font-size:.8rem">#${(o.orderId||o.id.slice(0,8)).toUpperCase()}</td>
                  <td>${o.userName||'—'}</td>
                  <td style="font-weight:700;color:var(--brand)">${money(o.total)}</td>
                  <td>${badge(o.status)}</td>
                  <td style="font-size:.78rem;color:var(--txt-2)">${fmtDate(o.createdAt)}</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:12px">
          <div class="card"><div class="card-body" style="display:flex;flex-direction:column;gap:10px">
            <p style="font-family:var(--f-display);font-weight:700;margin-bottom:2px">Quick Stats</p>
            <div style="display:flex;justify-content:space-between;font-size:.84rem"><span class="text-muted">Pending orders</span><span style="font-weight:700;color:var(--yellow)">${pending}</span></div>
            <div style="display:flex;justify-content:space-between;font-size:.84rem"><span class="text-muted">Total products</span><span style="font-weight:700">${prodSnap.size}</span></div>
            <div style="display:flex;justify-content:space-between;font-size:.84rem"><span class="text-muted">Active sellers</span><span style="font-weight:700;color:var(--green)">${sellersSnap.size}</span></div>
          </div></div>
          <div class="card"><div class="card-body" style="display:flex;flex-direction:column;gap:7px">
            <p style="font-family:var(--f-display);font-weight:700;margin-bottom:2px">Quick Actions</p>
            <button class="btn btn-secondary btn-full" onclick="go('sellers')">👤 Review Sellers</button>
            <button class="btn btn-secondary btn-full" onclick="go('categories')">🏷️ Add Category</button>
            <button class="btn btn-secondary btn-full" onclick="go('img-library')">🖼️ Image Library</button>
            <button class="btn btn-secondary btn-full" onclick="seedData()">🌱 Seed Default Data</button>
          </div></div>
        </div>
      </div>
    </div>`;
  } catch (e) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">⚠️</div><h3>${e.message}</h3></div>`;
  }
}

/* ══════════════════════════════════════════════════════════
   IMAGE LIBRARY — Admin uploads images, gets shareable URLs
   ══════════════════════════════════════════════════════════ */
async function renderImgLibrary() {
  const el = document.getElementById('panel-content');
  // Load saved images from Firestore
  let images = [];
  try {
    const snap = await db.collection('adminImages').orderBy('createdAt','desc').get();
    images = snap.docs.map(d => ({id:d.id,...d.data()}));
  } catch(_) {}

  el.innerHTML = `
  <div class="page">
    <div class="pg-head">
      <h2>Image Library</h2>
      <button class="btn btn-primary" onclick="openModal('modal');showUploadModal()">+ Upload Images</button>
    </div>
    <p style="font-size:.84rem;color:var(--txt-2);margin-bottom:18px">Upload images here and use their URLs anywhere — product listings, banners, categories, etc.</p>

    <!-- URL from external link -->
    <div class="card" style="margin-bottom:20px">
      <div class="card-head"><span style="font-family:var(--f-display);font-weight:700">Add Image by URL</span></div>
      <div class="card-body">
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <input class="input" id="ext-url" placeholder="Paste image URL here…" style="flex:1;min-width:200px">
          <input class="input" id="ext-label" placeholder="Label (optional)" style="width:160px">
          <button class="btn btn-primary" onclick="saveExternalImage()">Save URL</button>
        </div>
      </div>
    </div>

    <!-- Gallery -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px" id="img-gallery">
      ${images.length ? images.map(img => imgLibCard(img)).join('') : `
      <div class="empty" style="grid-column:1/-1">
        <div class="empty-icon">🖼️</div>
        <h3>No images yet</h3>
        <p>Upload images or add URLs above</p>
      </div>`}
    </div>
  </div>`;
}

function imgLibCard(img) {
  return `
  <div class="card" style="overflow:hidden" id="imgcard-${img.id}">
    <div style="height:130px;overflow:hidden;background:var(--bg);display:flex;align-items:center;justify-content:center">
      <img src="${img.url}" alt="${img.label||'image'}" style="width:100%;height:100%;object-fit:cover" onerror="this.parentElement.innerHTML='<span style=font-size:2rem;opacity:.3>🖼️</span>'">
    </div>
    <div style="padding:9px 10px">
      <p style="font-family:var(--f-display);font-weight:700;font-size:.78rem;margin-bottom:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${img.label||'Untitled'}</p>
      <div style="display:flex;gap:5px;flex-wrap:wrap">
        <button class="btn btn-secondary btn-sm" style="flex:1;font-size:.68rem" onclick="copyImgUrl('${img.url}')">📋 Copy URL</button>
        <button class="btn btn-red btn-sm btn-icon" onclick="deleteAdminImg('${img.id}')">🗑️</button>
      </div>
    </div>
  </div>`;
}

function showUploadModal() {
  document.getElementById('modal-title').textContent = 'Upload Images to Library';
  document.getElementById('modal-body').innerHTML = `
    <div class="upload-zone" id="lib-upload-zone">
      <input type="file" id="lib-img-input" accept="image/*" multiple onchange="handleLibUpload(this)">
      <div class="upload-icon">📷</div>
      <p class="upload-label">Click or drag images here</p>
      <p class="upload-hint">Max 5 MB per image · JPG, PNG, WEBP · Multiple allowed</p>
    </div>
    <div class="upload-bar" id="lib-bar"><div class="upload-fill" id="lib-fill"></div></div>
    <div style="margin-top:12px">
      <div class="field"><label>Label / Description</label><input class="input" id="lib-label" placeholder="e.g. Banner image, Product photo…"></div>
    </div>
    <div id="lib-preview" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"></div>
    <p id="lib-status" style="font-size:.78rem;color:var(--txt-2);margin-top:8px"></p>`;
  document.getElementById('modal-foot').innerHTML = `
    <button class="btn btn-secondary" onclick="closeModal('modal')">Close</button>`;
}

async function handleLibUpload(input) {
  const files = Array.from(input.files);
  if (!files.length) return;
  const bar    = document.getElementById('lib-bar');
  const fill   = document.getElementById('lib-fill');
  const status = document.getElementById('lib-status');
  const prev   = document.getElementById('lib-preview');
  const label  = document.getElementById('lib-label')?.value.trim() || '';
  bar.style.display = 'block'; fill.style.width = '0';
  let done = 0, saved = 0;

  for (const f of files) {
    if (f.size > 5*1024*1024) { toast(`${f.name} too large (max 5MB)`, 'warning'); done++; continue; }
    try {
      status.textContent = `Uploading ${f.name}…`;
      const url = await imgbbUpload(f);
      const doc = await db.collection('adminImages').add({
        url, label: label || f.name.replace(/\.[^.]+$/,''),
        uploadedBy: _user.uid, createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      // preview
      const div = document.createElement('div');
      div.style.cssText = 'position:relative;width:68px;height:68px;border-radius:8px;overflow:hidden;border:1.5px solid var(--border)';
      div.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover">`;
      prev.appendChild(div);
      saved++;
    } catch(err) { toast('Upload failed: '+err.message, 'error'); }
    done++;
    fill.style.width = `${Math.round(done/files.length*100)}%`;
  }

  bar.style.display = 'none';
  status.textContent = `${saved} image(s) uploaded successfully!`;
  if (saved > 0) {
    toast(`${saved} image(s) saved to library!`, 'success');
    renderImgLibrary(); // refresh gallery
  }
  input.value = '';
}

async function saveExternalImage() {
  const url   = document.getElementById('ext-url')?.value.trim();
  const label = document.getElementById('ext-label')?.value.trim() || 'External image';
  if (!url) { toast('Enter a URL first','warning'); return; }
  try {
    await db.collection('adminImages').add({ url, label, uploadedBy: _user.uid, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    toast('Image URL saved!','success');
    document.getElementById('ext-url').value = '';
    document.getElementById('ext-label').value = '';
    renderImgLibrary();
  } catch(e) { toast('Failed: '+e.message,'error'); }
}

async function copyImgUrl(url) {
  try {
    await navigator.clipboard.writeText(url);
    toast('URL copied to clipboard!','success');
  } catch(_) {
    // fallback
    const inp = document.createElement('input');
    inp.value = url; document.body.appendChild(inp);
    inp.select(); document.execCommand('copy'); inp.remove();
    toast('URL copied!','success');
  }
}

async function deleteAdminImg(id) {
  if (!confirm('Remove this image from the library?')) return;
  try {
    await db.collection('adminImages').doc(id).delete();
    document.getElementById('imgcard-'+id)?.remove();
    toast('Image removed','info');
  } catch(e) { toast('Failed','error'); }
}

/* ══════════════════════════════════════════════════════════
   SELLERS
   ══════════════════════════════════════════════════════════ */
async function renderSellers() {
  const el = document.getElementById('panel-content');
  el.innerHTML = `<div class="skel-card" style="height:300px"></div>`;
  try {
    const snap    = await db.collection('sellers').orderBy('createdAt','desc').get();
    const sellers = snap.docs.map(d => ({id:d.id,...d.data()}));
    window._sellers = sellers;
    const counts = { all:sellers.length, pending:0, approved:0, rejected:0 };
    sellers.forEach(s => { if(counts[s.status]!==undefined) counts[s.status]++; });

    el.innerHTML = `
    <div class="page">
      <div class="pg-head"><h2>Sellers (${sellers.length})</h2></div>
      <div class="atabs">
        <button class="atab active" onclick="filterSellers('all',this)">All (${counts.all})</button>
        <button class="atab" onclick="filterSellers('pending',this)">Pending (${counts.pending})</button>
        <button class="atab" onclick="filterSellers('approved',this)">Approved (${counts.approved})</button>
        <button class="atab" onclick="filterSellers('rejected',this)">Rejected (${counts.rejected})</button>
      </div>
      <div id="sellers-list">${sellers.map(sellerCard).join('')}</div>
    </div>`;
  } catch(e) { el.innerHTML = errHtml(e); }
}

function sellerCard(s) {
  return `
  <div class="appr-card" data-status="${s.status}">
    <div class="appr-ava">${(s.storeName||s.name||'?')[0].toUpperCase()}</div>
    <div class="appr-info">
      <p class="appr-name">🏪 ${s.storeName||s.name}</p>
      <p class="appr-meta">${s.email} · ${s.businessType||''} · ${fmtDate(s.createdAt)}</p>
      <p style="font-size:.72rem;color:var(--txt-2)">📞 ${s.phone||'—'}</p>
    </div>
    ${badge(s.status)}
    <div class="appr-btns">
      ${s.status!=='approved' ? `<button class="btn btn-green btn-sm" onclick="approveSeller('${s.id}','${s.userId}')">✓ Approve</button>` : ''}
      ${s.status!=='rejected' ? `<button class="btn btn-red   btn-sm" onclick="rejectSeller('${s.id}','${s.userId}')">✕ Reject</button>`  : ''}
    </div>
  </div>`;
}

function filterSellers(status, el) {
  document.querySelectorAll('.atab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  const list = status==='all' ? window._sellers : window._sellers.filter(s=>s.status===status);
  document.getElementById('sellers-list').innerHTML = list.map(sellerCard).join('') || `<div class="empty"><div class="empty-icon">👤</div><h3>No ${status} sellers</h3></div>`;
}

async function approveSeller(docId, userId) {
  if (!confirm('Approve this seller?')) return;
  showLoader(true);
  try {
    await Promise.all([
      db.collection('sellers').doc(docId).update({ status:'approved', approvedAt:firebase.firestore.FieldValue.serverTimestamp() }),
      db.collection('users').doc(userId).update({ role:'seller' })
    ]);
    toast('Seller approved!','success'); renderSellers();
  } catch(e) { toast('Failed: '+e.message,'error'); }
  showLoader(false);
}

async function rejectSeller(docId, userId) {
  if (!confirm('Reject this seller?')) return;
  showLoader(true);
  try {
    await Promise.all([
      db.collection('sellers').doc(docId).update({ status:'rejected' }),
      db.collection('users').doc(userId).update({ role:'user' })
    ]);
    toast('Seller rejected','info'); renderSellers();
  } catch(e) { toast('Failed','error'); }
  showLoader(false);
}

/* ══════════════════════════════════════════════════════════
   DELIVERY PARTNERS
   ══════════════════════════════════════════════════════════ */
async function renderDelivery() {
  const el = document.getElementById('panel-content');
  el.innerHTML = `<div class="skel-card" style="height:300px"></div>`;
  try {
    const snap     = await db.collection('deliveryPartners').orderBy('createdAt','desc').get();
    const partners = snap.docs.map(d => ({id:d.id,...d.data()}));
    el.innerHTML = `
    <div class="page">
      <div class="pg-head"><h2>Delivery Partners (${partners.length})</h2></div>
      ${partners.map(p=>`
      <div class="appr-card">
        <div class="appr-ava">${(p.name||'?')[0].toUpperCase()}</div>
        <div class="appr-info">
          <p class="appr-name">🚚 ${p.name}</p>
          <p class="appr-meta">${p.email} · ${p.vehicle||'—'} · ${p.city||'—'} · ${fmtDate(p.createdAt)}</p>
          <p style="font-size:.72rem;color:var(--txt-2)">📞 ${p.phone||'—'} · License: ${p.license||'—'}</p>
        </div>
        ${badge(p.status)}
        <div class="appr-btns">
          ${p.status!=='approved'?`<button class="btn btn-green btn-sm" onclick="approveDelivery('${p.id}','${p.userId}')">✓ Approve</button>`:''}
          ${p.status!=='rejected'?`<button class="btn btn-red   btn-sm" onclick="rejectDelivery('${p.id}','${p.userId}')">✕ Reject</button>` :''}
        </div>
      </div>`).join('')||`<div class="empty"><div class="empty-icon">🚚</div><h3>No delivery partners yet</h3></div>`}
    </div>`;
  } catch(e) { el.innerHTML = errHtml(e); }
}

async function approveDelivery(docId, userId) {
  if (!confirm('Approve?')) return;
  showLoader(true);
  try {
    await Promise.all([
      db.collection('deliveryPartners').doc(docId).update({ status:'approved' }),
      db.collection('users').doc(userId).update({ role:'delivery' })
    ]);
    toast('Partner approved!','success'); renderDelivery();
  } catch(e) { toast('Failed','error'); }
  showLoader(false);
}

async function rejectDelivery(docId, userId) {
  if (!confirm('Reject?')) return;
  showLoader(true);
  try {
    await Promise.all([
      db.collection('deliveryPartners').doc(docId).update({ status:'rejected' }),
      db.collection('users').doc(userId).update({ role:'user' })
    ]);
    toast('Rejected','info'); renderDelivery();
  } catch(e) { toast('Failed','error'); }
  showLoader(false);
}

/* ══════════════════════════════════════════════════════════
   USERS
   ══════════════════════════════════════════════════════════ */
async function renderUsers() {
  const el = document.getElementById('panel-content');
  el.innerHTML = `<div class="skel-card" style="height:400px"></div>`;
  try {
    const snap  = await db.collection('users').orderBy('createdAt','desc').get();
    const users = snap.docs.map(d => ({id:d.id,...d.data()}));
    el.innerHTML = `
    <div class="page">
      <div class="pg-head"><h2>Users (${users.length})</h2></div>
      <div class="tbl-wrap">
        <table>
          <thead><tr><th>User</th><th>Email</th><th>Role</th><th>Joined</th><th>Change Role</th></tr></thead>
          <tbody>
            ${users.map(u=>`
            <tr>
              <td><div style="display:flex;align-items:center;gap:9px">
                <img src="${u.photo||`https://ui-avatars.com/api/?name=${encodeURIComponent(u.name||'U')}&background=ff4d00&color=fff`}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;flex-shrink:0">
                <span style="font-weight:600;font-size:.84rem">${u.name||'—'}</span>
              </div></td>
              <td style="font-size:.8rem;color:var(--txt-2)">${u.email||'—'}</td>
              <td>${badge(u.role||'user')}</td>
              <td style="font-size:.78rem;color:var(--txt-2)">${fmtDate(u.createdAt)}</td>
              <td>
                <select class="input" style="padding:5px 8px;font-size:.74rem;width:96px" onchange="changeRole('${u.id}',this.value)">
                  ${['user','seller','delivery','admin'].map(r=>`<option value="${r}" ${u.role===r?'selected':''}>${r}</option>`).join('')}
                </select>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
  } catch(e) { el.innerHTML = errHtml(e); }
}

async function changeRole(uid, role) {
  try {
    await db.collection('users').doc(uid).update({ role });
    toast(`Role set to ${role}`,'success');
  } catch(e) { toast('Failed','error'); }
}

/* ══════════════════════════════════════════════════════════
   PRODUCTS
   ══════════════════════════════════════════════════════════ */
async function renderProducts() {
  const el = document.getElementById('panel-content');
  el.innerHTML = `<div class="skel-card" style="height:400px"></div>`;
  try {
    const snap     = await db.collection('products').orderBy('createdAt','desc').get();
    const products = snap.docs.map(d => ({id:d.id,...d.data()}));
    el.innerHTML = `
    <div class="page">
      <div class="pg-head"><h2>All Products (${products.length})</h2></div>
      <div class="tbl-wrap">
        <table>
          <thead><tr><th>Image</th><th>Name</th><th>Seller</th><th>Price</th><th>Stock</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            ${products.map(p=>`
            <tr>
              <td>${p.images?.[0]?`<img src="${p.images[0]}" style="width:38px;height:38px;border-radius:7px;object-fit:cover">`:``}</td>
              <td style="font-weight:600;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.84rem">${p.name}</td>
              <td style="font-size:.78rem;color:var(--txt-2)">${p.sellerName||'—'}</td>
              <td style="font-weight:700;color:var(--brand)">${money(p.price)}</td>
              <td>${p.stock}</td>
              <td>${badge(p.status||'active')}</td>
              <td><div style="display:flex;gap:5px">
                <button class="btn btn-secondary btn-sm" onclick="toggleProd('${p.id}','${p.status||'active'}')">${p.status==='active'?'Deactivate':'Activate'}</button>
                <button class="btn btn-red btn-sm"       onclick="deleteProd('${p.id}')">🗑️</button>
              </div></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
  } catch(e) { el.innerHTML = errHtml(e); }
}

async function toggleProd(id, cur) {
  try {
    await db.collection('products').doc(id).update({ status:cur==='active'?'inactive':'active' });
    toast('Status updated','success'); renderProducts();
  } catch(e) { toast('Failed','error'); }
}
async function deleteProd(id) {
  if (!confirm('Delete this product?')) return;
  try { await db.collection('products').doc(id).delete(); toast('Deleted','success'); renderProducts(); }
  catch(e) { toast('Failed','error'); }
}

/* ══════════════════════════════════════════════════════════
   ORDERS
   ══════════════════════════════════════════════════════════ */
async function renderOrders() {
  const el = document.getElementById('panel-content');
  el.innerHTML = `<div class="skel-card" style="height:400px"></div>`;
  try {
    const snap   = await db.collection('orders').orderBy('createdAt','desc').get();
    const orders = snap.docs.map(d => ({id:d.id,...d.data()}));
    el.innerHTML = `
    <div class="page">
      <div class="pg-head"><h2>All Orders (${orders.length})</h2></div>
      <div class="tbl-wrap">
        <table>
          <thead><tr><th>Order ID</th><th>Customer</th><th>Total</th><th>Payment</th><th>Date</th><th>Status</th><th>Delivery</th></tr></thead>
          <tbody>
            ${orders.map(o=>`
            <tr>
              <td style="font-family:var(--f-display);font-weight:700;font-size:.8rem">#${(o.orderId||o.id.slice(0,8)).toUpperCase()}</td>
              <td style="font-size:.82rem">${o.userName||'—'}</td>
              <td style="font-weight:700;color:var(--brand)">${money(o.total)}</td>
              <td style="text-transform:capitalize;font-size:.8rem">${o.payment||'—'}</td>
              <td style="font-size:.78rem;color:var(--txt-2)">${fmtDate(o.createdAt)}</td>
              <td>
                <select class="input" style="padding:4px 7px;font-size:.74rem;width:110px" onchange="setOrderStatus('${o.id}',this.value)">
                  ${['pending','accepted','packed','shipped','delivered','cancelled'].map(s=>`<option value="${s}" ${o.status===s?'selected':''}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`).join('')}
                </select>
              </td>
              <td><button class="btn btn-secondary btn-sm" onclick="showAssign('${o.id}')">Assign</button></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
  } catch(e) { el.innerHTML = errHtml(e); }
}

async function setOrderStatus(id, status) {
  try {
    await db.collection('orders').doc(id).update({ status, updatedAt:firebase.firestore.FieldValue.serverTimestamp() });
    toast(`Status → ${status}`,'success');
  } catch(e) { toast('Failed','error'); }
}

async function showAssign(orderId) {
  const snap     = await db.collection('deliveryPartners').where('status','==','approved').get();
  const partners = snap.docs.map(d => ({id:d.id,...d.data()}));
  document.getElementById('modal-title').textContent = 'Assign Delivery Partner';
  document.getElementById('modal-body').innerHTML = `
    <div class="field"><label>Select Partner</label>
      <select class="input" id="assign-sel">
        <option value="">— select —</option>
        ${partners.map(p=>`<option value="${p.userId}">${p.name} (${p.vehicle||'?'})</option>`).join('')}
      </select>
    </div>`;
  document.getElementById('modal-foot').innerHTML = `
    <button class="btn btn-secondary" onclick="closeModal('modal')">Cancel</button>
    <button class="btn btn-primary"   onclick="doAssign('${orderId}')">Assign</button>`;
  openModal('modal');
}

async function doAssign(orderId) {
  const uid = document.getElementById('assign-sel')?.value;
  if (!uid) { toast('Select a partner','warning'); return; }
  try {
    await db.collection('orders').doc(orderId).update({ deliveryPartnerId:uid, status:'shipped', updatedAt:firebase.firestore.FieldValue.serverTimestamp() });
    toast('Partner assigned!','success'); closeModal('modal');
  } catch(e) { toast('Failed','error'); }
}

/* ══════════════════════════════════════════════════════════
   CATEGORIES
   ══════════════════════════════════════════════════════════ */
async function renderCategories() {
  const el = document.getElementById('panel-content');
  try {
    const snap = await db.collection('categories').get();
    const cats = snap.docs.map(d => ({id:d.id,...d.data()}));
    el.innerHTML = `
    <div class="page">
      <div class="pg-head">
        <h2>Categories (${cats.length})</h2>
        <button class="btn btn-primary" onclick="showAddCat()">+ Add Category</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:11px">
        ${cats.map(c=>`
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:15px;text-align:center;position:relative;transition:box-shadow var(--ease)" onmouseenter="this.style.boxShadow='var(--sh-md)'" onmouseleave="this.style.boxShadow=''">
          <button onclick="deleteCat('${c.id}')" style="position:absolute;top:6px;right:6px;width:19px;height:19px;border-radius:50%;background:var(--red);color:#fff;border:none;cursor:pointer;font-size:.6rem;font-weight:800;display:flex;align-items:center;justify-content:center;line-height:1">×</button>
          <div style="font-size:1.7rem;margin-bottom:7px">${c.icon||'📦'}</div>
          <p style="font-family:var(--f-display);font-weight:700;font-size:.82rem">${c.name}</p>
          <p style="font-size:.68rem;color:var(--txt-3);margin-top:3px">${c.active!==false?'Active':'Inactive'}</p>
        </div>`).join('')}
      </div>
    </div>`;
  } catch(e) { el.innerHTML = errHtml(e); }
}

function showAddCat() {
  document.getElementById('modal-title').textContent = 'Add Category';
  document.getElementById('modal-body').innerHTML = `
    <div class="field"><label>Name *</label><input class="input" id="c-name" placeholder="e.g. Electronics"></div>
    <div class="field"><label>Icon (emoji)</label><input class="input" id="c-icon" placeholder="📱" maxlength="4"></div>
    <div class="field" style="margin-bottom:0"><label>Status</label>
      <select class="input" id="c-active"><option value="true">Active</option><option value="false">Inactive</option></select>
    </div>`;
  document.getElementById('modal-foot').innerHTML = `
    <button class="btn btn-secondary" onclick="closeModal('modal')">Cancel</button>
    <button class="btn btn-primary"   onclick="addCat()">Add</button>`;
  openModal('modal');
}

async function addCat() {
  const name = document.getElementById('c-name')?.value.trim();
  if (!name) { toast('Enter a name','warning'); return; }
  try {
    await db.collection('categories').add({ name, icon:document.getElementById('c-icon')?.value.trim()||'📦', active:document.getElementById('c-active')?.value!=='false', createdAt:firebase.firestore.FieldValue.serverTimestamp() });
    toast('Category added!','success'); closeModal('modal'); renderCategories();
  } catch(e) { toast('Failed: '+e.message,'error'); }
}

async function deleteCat(id) {
  if (!confirm('Delete this category?')) return;
  try { await db.collection('categories').doc(id).delete(); toast('Deleted','success'); renderCategories(); }
  catch(e) { toast('Failed','error'); }
}

/* ══════════════════════════════════════════════════════════
   PAYMENTS
   ══════════════════════════════════════════════════════════ */
async function renderPayments() {
  const el = document.getElementById('panel-content');
  try {
    const snap    = await db.collection('payments').get();
    const methods = snap.docs.map(d => ({id:d.id,...d.data()}));
    el.innerHTML = `
    <div class="page">
      <div class="pg-head"><h2>Payment Methods</h2><button class="btn btn-primary" onclick="showAddPM()">+ Add</button></div>
      ${methods.map(m=>`
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:13px 16px;display:flex;align-items:center;gap:12px;margin-bottom:9px;flex-wrap:wrap">
        <span style="font-size:1.35rem;width:38px;text-align:center;flex-shrink:0">${m.icon||'💳'}</span>
        <div style="flex:1;min-width:100px">
          <p style="font-family:var(--f-display);font-weight:700;font-size:.9rem">${m.name}</p>
          <p style="font-size:.74rem;color:var(--txt-2)">${m.description||''}</p>
        </div>
        <label class="toggle"><input type="checkbox" ${m.active?'checked':''} onchange="togglePM('${m.id}',this.checked)"><span class="toggle-track"></span></label>
        <button class="btn btn-red btn-sm btn-icon" onclick="deletePM('${m.id}')">🗑️</button>
      </div>`).join('')||`<div class="empty"><div class="empty-icon">💳</div><h3>No payment methods yet</h3></div>`}
    </div>`;
  } catch(e) { el.innerHTML = errHtml(e); }
}

function showAddPM() {
  document.getElementById('modal-title').textContent = 'Add Payment Method';
  document.getElementById('modal-body').innerHTML = `
    <div class="field"><label>Name *</label><input class="input" id="pm-name" placeholder="e.g. UPI"></div>
    <div class="field"><label>Icon (emoji)</label><input class="input" id="pm-icon" placeholder="📱" maxlength="4"></div>
    <div class="field" style="margin-bottom:0"><label>Description</label><input class="input" id="pm-desc" placeholder="Short description"></div>`;
  document.getElementById('modal-foot').innerHTML = `
    <button class="btn btn-secondary" onclick="closeModal('modal')">Cancel</button>
    <button class="btn btn-primary"   onclick="addPM()">Add</button>`;
  openModal('modal');
}

async function addPM() {
  const name = document.getElementById('pm-name')?.value.trim();
  if (!name) { toast('Enter a name','warning'); return; }
  try {
    await db.collection('payments').add({ name, icon:document.getElementById('pm-icon')?.value.trim()||'💳', description:document.getElementById('pm-desc')?.value.trim()||'', active:true, createdAt:firebase.firestore.FieldValue.serverTimestamp() });
    toast('Payment method added!','success'); closeModal('modal'); renderPayments();
  } catch(e) { toast('Failed: '+e.message,'error'); }
}

async function togglePM(id, active) {
  try { await db.collection('payments').doc(id).update({ active }); toast(`${active?'Enabled':'Disabled'}`,'success'); }
  catch(e) { toast('Failed','error'); }
}
async function deletePM(id) {
  if (!confirm('Delete this payment method?')) return;
  try { await db.collection('payments').doc(id).delete(); toast('Deleted','success'); renderPayments(); }
  catch(e) { toast('Failed','error'); }
}

/* ══════════════════════════════════════════════════════════
   SETTINGS
   ══════════════════════════════════════════════════════════ */
async function renderSettings() {
  const el = document.getElementById('panel-content');
  let cfg = {};
  try { const d = await db.collection('settings').doc('app').get(); if(d.exists) cfg = d.data(); } catch(_) {}

  el.innerHTML = `
  <div class="page">
    <div class="pg-head"><h2>App Settings</h2></div>

    <div class="card" style="margin-bottom:16px">
      <div class="card-head"><span style="font-family:var(--f-display);font-weight:700">Features</span></div>
      ${[
        {key:'guestMode',            label:'Guest Browsing',        desc:'Allow browsing without signing in'},
        {key:'sellerRegistration',   label:'Seller Registration',   desc:'Accept new seller applications'},
        {key:'deliveryRegistration', label:'Delivery Registration', desc:'Accept delivery partner applications'},
        {key:'reviewsEnabled',       label:'Product Reviews',       desc:'Let customers leave reviews'},
      ].map(s=>`
      <div class="setting-row">
        <div class="setting-info"><h4>${s.label}</h4><p>${s.desc}</p></div>
        <label class="toggle">
          <input type="checkbox" ${cfg[s.key]!==false?'checked':''} onchange="saveSetting('${s.key}',this.checked)">
          <span class="toggle-track"></span>
        </label>
      </div>`).join('')}
    </div>

    <div class="card" style="margin-bottom:16px">
      <div class="card-head"><span style="font-family:var(--f-display);font-weight:700">Limits</span></div>
      <div class="setting-row">
        <div class="setting-info"><h4>Max Images per Product</h4><p>Maximum images a seller can upload per product</p></div>
        <input class="input" type="number" style="width:76px" value="${cfg.maxImages||6}" min="1" max="20" onchange="saveSetting('maxImages',+this.value)">
      </div>
      <div class="setting-row">
        <div class="setting-info"><h4>Free Delivery Above (₹)</h4><p>Cart value threshold for free shipping</p></div>
        <input class="input" type="number" style="width:96px" value="${cfg.freeDeliveryAbove||500}" min="0" onchange="saveSetting('freeDeliveryAbove',+this.value)">
      </div>
    </div>

    <div class="card">
      <div class="card-head"><span style="font-family:var(--f-display);font-weight:700">Setup Utilities</span></div>
      <div class="setting-row">
        <div class="setting-info"><h4>Seed Default Data</h4><p>Add 10 categories + 4 payment methods</p></div>
        <button class="btn btn-secondary btn-sm" onclick="seedData()">🌱 Seed Now</button>
      </div>
      <div class="setting-row">
        <div class="setting-info"><h4>Image Library</h4><p>Upload and manage images for the platform</p></div>
        <button class="btn btn-secondary btn-sm" onclick="go('img-library')">🖼️ Open Library</button>
      </div>
    </div>
  </div>`;
}

async function saveSetting(key, value) {
  try { await db.collection('settings').doc('app').set({[key]:value},{merge:true}); toast('Saved','success'); }
  catch(e) { toast('Failed','error'); }
}

async function seedData() {
  if (!confirm('Add default categories and payment methods?')) return;
  showLoader(true);
  try {
    const ts   = firebase.firestore.FieldValue.serverTimestamp();
    const cats = [{name:'Electronics',icon:'📱'},{name:'Fashion',icon:'👗'},{name:'Home',icon:'🏠'},{name:'Beauty',icon:'💄'},{name:'Sports',icon:'⚽'},{name:'Books',icon:'📚'},{name:'Food',icon:'🍕'},{name:'Toys',icon:'🧸'},{name:'Automotive',icon:'🚗'},{name:'Health',icon:'💊'}];
    const pms  = [{name:'Cash on Delivery',icon:'💵',description:'Pay when order arrives'},{name:'UPI',icon:'📱',description:'Google Pay, PhonePe, Paytm…'},{name:'Credit / Debit Card',icon:'💳',description:'Visa, Mastercard, RuPay'},{name:'Net Banking',icon:'🏦',description:'All major banks'}];
    const b1 = db.batch(); cats.forEach(c => b1.set(db.collection('categories').doc(),{...c,active:true,createdAt:ts}));
    await b1.commit();
    const b2 = db.batch(); pms.forEach(p => b2.set(db.collection('payments').doc(),{...p,active:true,createdAt:ts}));
    await b2.commit();
    toast('Default data seeded!','success');
  } catch(e) { toast('Failed: '+e.message,'error'); }
  showLoader(false);
}

/* ── Shared error HTML ── */
function errHtml(e) {
  return `<div class="empty"><div class="empty-icon">⚠️</div><h3>Error</h3><p>${e.message}</p></div>`;
}

/* ══════════════════════════════════════════════════════════
   UPLOAD LIMITS PER USER
   Admin can set how many images each seller can upload
   per product (globally or per individual seller).
   ══════════════════════════════════════════════════════════ */
async function renderUploadLimits() {
  const el = document.getElementById('panel-content');
  el.innerHTML = `<div class="skel-card" style="height:120px;margin-bottom:14px"></div><div class="skel-card" style="height:360px"></div>`;

  try {
    /* Load global limit from settings */
    const settingsDoc = await db.collection('settings').doc('app').get();
    const globalLimit = settingsDoc.exists ? (settingsDoc.data().maxImages || 6) : 6;

    /* Load all approved sellers */
    const selSnap  = await db.collection('sellers').where('status','==','approved').get();
    const sellers  = selSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    /* Load any custom per-seller limits */
    const limSnap  = await db.collection('uploadLimits').get();
    const limMap   = {};
    limSnap.docs.forEach(d => { limMap[d.id] = d.data().maxImages; });

    el.innerHTML = `
    <div class="page">

      <!-- Global Default Limit -->
      <div class="card" style="margin-bottom:20px">
        <div class="card-head">
          <div>
            <span style="font-family:var(--f-display);font-weight:700;font-size:1rem">🌐 Global Default Limit</span>
            <p style="font-size:.78rem;color:var(--txt-2);margin-top:2px">Applies to ALL sellers who don't have a custom limit</p>
          </div>
        </div>
        <div class="card-body">
          <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
            <div style="flex:1;min-width:220px">
              <p style="font-size:.84rem;color:var(--txt-2);margin-bottom:6px">Max images a seller can upload per product listing</p>
              <div style="display:flex;align-items:center;gap:10px">
                <input class="input" id="global-limit-val" type="number" min="1" max="30"
                  value="${globalLimit}" style="width:88px;font-family:var(--f-display);font-weight:700;font-size:1.1rem;text-align:center">
                <span style="font-size:.84rem;color:var(--txt-2)">images per product</span>
              </div>
            </div>
            <button class="btn btn-primary" onclick="saveGlobalLimit()">Save Global Limit</button>
          </div>

          <!-- Visual presets -->
          <div style="margin-top:16px">
            <p style="font-size:.76rem;color:var(--txt-2);font-family:var(--f-display);font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Quick Presets</p>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              ${[1,2,3,4,5,6,8,10,12,15,20].map(n => `
              <button onclick="document.getElementById('global-limit-val').value=${n}"
                style="padding:5px 13px;border-radius:var(--r-full);border:1.5px solid ${n===globalLimit?'var(--brand)':'var(--border)'};
                background:${n===globalLimit?'var(--brand-glow)':'transparent'};
                color:${n===globalLimit?'var(--brand)':'var(--txt-2)'};
                font-family:var(--f-display);font-weight:700;font-size:.8rem;cursor:pointer;
                transition:all var(--ease)">${n}</button>`).join('')}
            </div>
          </div>
        </div>
      </div>

      <!-- Per-Seller Custom Limits -->
      <div class="card">
        <div class="card-head" style="flex-wrap:wrap;gap:8px">
          <div>
            <span style="font-family:var(--f-display);font-weight:700;font-size:1rem">👤 Per-Seller Custom Limits</span>
            <p style="font-size:.78rem;color:var(--txt-2);margin-top:2px">Override the global limit for specific sellers</p>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="showAddCustomLimit()">+ Set Custom Limit</button>
        </div>

        ${sellers.length === 0
          ? `<div class="empty" style="padding:36px"><div class="empty-icon">🏪</div><h3>No approved sellers yet</h3><p>Approve sellers first to set custom limits</p></div>`
          : `<div class="tbl-wrap" style="border:none;border-radius:0">
          <table>
            <thead>
              <tr>
                <th>Seller / Store</th>
                <th>Email</th>
                <th style="text-align:center">Global Limit</th>
                <th style="text-align:center">Custom Limit</th>
                <th style="text-align:center">Effective Limit</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${sellers.map(s => {
                const custom    = limMap[s.userId];
                const effective = custom !== undefined ? custom : globalLimit;
                const hasCustom = custom !== undefined;
                return `
                <tr id="limrow-${s.userId}">
                  <td>
                    <div style="display:flex;align-items:center;gap:9px">
                      <div style="width:32px;height:32px;border-radius:50%;background:var(--brand-glow);display:flex;align-items:center;justify-content:center;font-family:var(--f-display);font-weight:800;font-size:.88rem;color:var(--brand);flex-shrink:0">
                        ${(s.storeName||s.name||'?')[0].toUpperCase()}
                      </div>
                      <div>
                        <p style="font-weight:700;font-family:var(--f-display);font-size:.84rem">🏪 ${s.storeName||s.name}</p>
                        <p style="font-size:.72rem;color:var(--txt-2)">${s.businessType||''}</p>
                      </div>
                    </div>
                  </td>
                  <td style="font-size:.8rem;color:var(--txt-2)">${s.email}</td>
                  <td style="text-align:center;font-family:var(--f-display);font-weight:700;color:var(--txt-2)">${globalLimit}</td>
                  <td style="text-align:center">
                    ${hasCustom
                      ? `<span style="font-family:var(--f-display);font-weight:800;color:var(--accent)">${custom}</span>`
                      : `<span style="font-size:.76rem;color:var(--txt-3);font-style:italic">none</span>`}
                  </td>
                  <td style="text-align:center">
                    <span style="display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:var(--r-full);
                      background:${hasCustom?'rgba(0,80,255,.1)':'rgba(0,179,126,.1)'};
                      color:${hasCustom?'var(--accent)':'var(--green)'};
                      font-family:var(--f-display);font-weight:800;font-size:.82rem">
                      ${effective} ${hasCustom?'🔵':'🟢'}
                    </span>
                  </td>
                  <td>
                    <div style="display:flex;gap:6px;flex-wrap:wrap">
                      <button class="btn btn-secondary btn-sm" onclick="editSellerLimit('${s.userId}','${s.storeName||s.name}',${effective})">
                        ${hasCustom?'✏️ Edit':'+ Set'}
                      </button>
                      ${hasCustom ? `<button class="btn btn-red btn-sm" onclick="removeSellerLimit('${s.userId}')">Reset</button>` : ''}
                    </div>
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>`}

        <!-- Legend -->
        <div class="card-foot" style="display:flex;gap:16px;flex-wrap:wrap;font-size:.76rem;color:var(--txt-2)">
          <span>🟢 Using global default</span>
          <span>🔵 Custom limit active</span>
          <span style="margin-left:auto;font-style:italic">Effective limit = custom limit if set, else global default</span>
        </div>
      </div>
    </div>`;

    /* store for reuse in modal */
    window._sellers_for_limit = sellers;
    window._limMap            = limMap;
    window._globalLimit       = globalLimit;

  } catch(e) {
    el.innerHTML = errHtml(e);
  }
}

async function saveGlobalLimit() {
  const val = parseInt(document.getElementById('global-limit-val')?.value);
  if (!val || val < 1 || val > 30) { toast('Enter a valid number (1–30)','warning'); return; }
  try {
    await db.collection('settings').doc('app').set({ maxImages: val }, { merge: true });
    toast(`Global limit set to ${val} images per product ✓`, 'success');
    renderUploadLimits(); // refresh table
  } catch(e) { toast('Failed: ' + e.message, 'error'); }
}

function showAddCustomLimit() {
  const sellers = window._sellers_for_limit || [];
  const limMap  = window._limMap || {};
  document.getElementById('modal-title').textContent = 'Set Custom Upload Limit';
  document.getElementById('modal-body').innerHTML = `
    <div class="field">
      <label>Select Seller *</label>
      <select class="input" id="cl-seller" onchange="prefillCustomLimit(this.value)">
        <option value="">— choose seller —</option>
        ${sellers.map(s => `<option value="${s.userId}">${s.storeName||s.name} (${s.email})</option>`).join('')}
      </select>
    </div>
    <div class="field">
      <label>Max Images per Product *</label>
      <input class="input" id="cl-limit" type="number" min="1" max="30" placeholder="e.g. 10"
        style="font-family:var(--f-display);font-weight:700;font-size:1.1rem">
      <span class="field-hint">Global default is ${window._globalLimit || 6}. Enter a different value to override.</span>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">
      ${[1,2,3,4,5,6,8,10,12,15,20].map(n =>
        `<button onclick="document.getElementById('cl-limit').value=${n}"
          style="padding:5px 11px;border-radius:var(--r-full);border:1.5px solid var(--border);background:transparent;
          font-family:var(--f-display);font-weight:700;font-size:.76rem;cursor:pointer;color:var(--txt-2);transition:all var(--ease)"
          onmouseover="this.style.borderColor='var(--brand)';this.style.color='var(--brand)'"
          onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--txt-2)'">${n}</button>`
      ).join('')}
    </div>`;
  document.getElementById('modal-foot').innerHTML = `
    <button class="btn btn-secondary" onclick="closeModal('modal')">Cancel</button>
    <button class="btn btn-primary"   onclick="saveCustomLimit()">Save Custom Limit</button>`;
  openModal('modal');
}

function prefillCustomLimit(uid) {
  if (!uid) return;
  const existing = (window._limMap || {})[uid];
  if (existing !== undefined) document.getElementById('cl-limit').value = existing;
}

async function saveCustomLimit() {
  const uid   = document.getElementById('cl-seller')?.value;
  const limit = parseInt(document.getElementById('cl-limit')?.value);
  if (!uid)                       { toast('Select a seller','warning');               return; }
  if (!limit || limit < 1 || limit > 30) { toast('Enter a valid limit (1–30)','warning'); return; }

  try {
    /* store in uploadLimits/{userId} so sellers can read their own limit */
    await db.collection('uploadLimits').doc(uid).set({
      userId:   uid,
      maxImages: limit,
      setBy:    _user.uid,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    toast(`Custom limit of ${limit} images saved!`, 'success');
    closeModal('modal');
    renderUploadLimits();
  } catch(e) { toast('Failed: ' + e.message, 'error'); }
}

function editSellerLimit(uid, name, current) {
  const sellers = window._sellers_for_limit || [];
  document.getElementById('modal-title').textContent = `Edit Limit — ${name}`;
  document.getElementById('modal-body').innerHTML = `
    <div class="field">
      <label>Max Images per Product for <strong>${name}</strong></label>
      <input class="input" id="el-limit" type="number" min="1" max="30" value="${current}"
        style="font-family:var(--f-display);font-weight:700;font-size:1.1rem">
      <span class="field-hint">Global default is ${window._globalLimit || 6}. Currently set to ${current}.</span>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">
      ${[1,2,3,4,5,6,8,10,12,15,20].map(n =>
        `<button onclick="document.getElementById('el-limit').value=${n}"
          style="padding:5px 11px;border-radius:var(--r-full);border:1.5px solid ${n===current?'var(--brand)':'var(--border)'};
          background:${n===current?'var(--brand-glow)':'transparent'};
          color:${n===current?'var(--brand)':'var(--txt-2)'};
          font-family:var(--f-display);font-weight:700;font-size:.76rem;cursor:pointer;transition:all var(--ease)">${n}</button>`
      ).join('')}
    </div>`;
  document.getElementById('modal-foot').innerHTML = `
    <button class="btn btn-secondary" onclick="closeModal('modal')">Cancel</button>
    <button class="btn btn-red btn-sm" onclick="removeSellerLimit('${uid}');closeModal('modal')" style="margin-right:auto">Reset to Global</button>
    <button class="btn btn-primary"   onclick="updateSellerLimit('${uid}')">Save</button>`;
  openModal('modal');
}

async function updateSellerLimit(uid) {
  const limit = parseInt(document.getElementById('el-limit')?.value);
  if (!limit || limit < 1 || limit > 30) { toast('Enter a valid limit (1–30)','warning'); return; }
  try {
    await db.collection('uploadLimits').doc(uid).set({
      userId: uid, maxImages: limit, setBy: _user.uid,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    toast(`Limit updated to ${limit} images ✓`, 'success');
    closeModal('modal');
    renderUploadLimits();
  } catch(e) { toast('Failed: ' + e.message, 'error'); }
}

async function removeSellerLimit(uid) {
  try {
    await db.collection('uploadLimits').doc(uid).delete();
    toast('Custom limit removed — seller now uses global default', 'info');
    renderUploadLimits();
  } catch(e) { toast('Failed','error'); }
}
