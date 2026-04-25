/* ============================================================
   SHOPWAVE — Firebase Config + Global Utilities
   Replace ALL placeholder values before deploying
   ============================================================ */

const firebaseConfig = {
  apiKey: "AIzaSyCz1RrqPg47qT4oTGa9jZ26E_LICzIXC3I",
  authDomain: "any-name-cbf7a.firebaseapp.com",
  databaseURL: "https://any-name-cbf7a-default-rtdb.firebaseio.com",
  projectId: "any-name-cbf7a",
  storageBucket: "any-name-cbf7a.firebasestorage.app",
  messagingSenderId: "1058241604652",
  appId: "1:1058241604652:web:00d8d3b010adba4b1e7589",
  measurementId: "G-99RKGK70B9"
};
const IMGBB_KEY = "255727ed9cb6df2949755773d660d671"; // https://api.imgbb.com

/* ---------- Firebase init (compat SDK via CDN) ---------- */
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.firestore();
const googleProvider = new firebase.auth.GoogleAuthProvider();

/* ============================================================
   GLOBAL HELPERS
   ============================================================ */

/** Show/hide the full-screen loader */
function showLoader(visible = true) {
  const el = document.getElementById("sw-loader");
  if (el) el.style.display = visible ? "flex" : "none";
}

/** Toast notification  type: success | error | warning | info */
function toast(msg, type = "info", duration = 3500) {
  const wrap = document.getElementById("sw-toasts");
  if (!wrap) return;
  const icons = { success: "✓", error: "✕", warning: "⚠", info: "ℹ" };
  const el = document.createElement("div");
  el.className = `sw-toast sw-toast--${type}`;
  el.innerHTML = `<span class="sw-toast__icon">${icons[type]}</span><span>${msg}</span>`;
  wrap.appendChild(el);
  requestAnimationFrame(() => el.classList.add("sw-toast--show"));
  setTimeout(() => {
    el.classList.remove("sw-toast--show");
    setTimeout(() => el.remove(), 350);
  }, duration);
}

/** Format INR currency */
function money(n) {
  return "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });
}

/** Format Firestore timestamp → readable date */
function fmtDate(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

/** Upload one File to ImgBB → returns URL string */
async function imgbbUpload(file) {
  const fd = new FormData();
  fd.append("image", file);
  const res  = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: "POST", body: fd });
  const json = await res.json();
  if (!json.success) throw new Error("ImgBB upload failed");
  return json.data.url;
}

/** Render 1–5 star string */
function stars(rating = 0) {
  const full = Math.floor(rating);
  return "★".repeat(full) + "☆".repeat(5 - full);
}

/** Simple badge HTML */
function badge(status) {
  const map = {
    pending:          "badge--yellow",
    accepted:         "badge--blue",
    packed:           "badge--blue",
    shipped:          "badge--purple",
    out_for_delivery: "badge--purple",
    delivered:        "badge--green",
    cancelled:        "badge--red",
    approved:         "badge--green",
    rejected:         "badge--red",
    active:           "badge--green",
    inactive:         "badge--grey",
  };
  return `<span class="badge ${map[status] || "badge--grey"}">${status.replace(/_/g, " ")}</span>`;
}

/** Debounce */
function debounce(fn, ms = 300) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

/** Open / close any modal by id */
function openModal(id)  { const m = document.getElementById(id); if (m) m.classList.add("modal--open"); }
function closeModal(id) { const m = document.getElementById(id); if (m) m.classList.remove("modal--open"); }

/** Redirect after login based on Firestore role */
function redirectByRole(role) {
  const base  = window.location.pathname.replace(/\/[^/]*$/, "");
  const paths = { admin: "/admin/", seller: "/seller/", delivery: "/delivery/", user: "/user/" };
  window.location.href = (paths[role] || paths.user);
}

/** Skeleton card HTML */
function skeletonCard() {
  return `<div class="skel-card"><div class="skel skel--img"></div><div class="skel skel--line" style="width:80%"></div><div class="skel skel--line" style="width:50%"></div></div>`;
}

/** Get/set cart from localStorage */
function getCart()        { return JSON.parse(localStorage.getItem("sw_cart") || "[]"); }
function saveCart(items)  { localStorage.setItem("sw_cart", JSON.stringify(items)); updateCartBubble(); }
function updateCartBubble() {
  const cart   = getCart();
  const qty    = cart.reduce((s, i) => s + i.qty, 0);
  document.querySelectorAll(".js-cart-count").forEach(el => {
    el.textContent  = qty;
    el.style.display = qty ? "flex" : "none";
  });
}
