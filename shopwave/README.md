# 🛍️ ShopWave — Pure HTML / CSS / JavaScript E-Commerce

A complete 4-panel e-commerce platform. **Zero frameworks. Zero build tools.**  
Just open `login.html` and go.

---

## 📁 File Structure

```
shopwave/
├── login.html                  ← Unified login (Google + Guest)
├── firestore.rules             ← Security rules (deploy via CLI)
│
├── shared/
│   ├── css/
│   │   ├── global.css          ← Design tokens, buttons, forms, toasts, modals
│   │   ├── panel.css           ← Sidebar layout for seller/admin/delivery
│   │   └── user.css            ← Storefront & login styles
│   └── js/
│       └── config.js           ← Firebase init, ImgBB key, global helpers
│
├── user/
│   ├── index.html              ← Customer storefront shell
│   └── app.js                  ← SPA: home, search, product, cart, checkout, orders, profile
│
├── seller/
│   ├── index.html              ← Seller panel shell
│   └── app.js                  ← Dashboard, product CRUD, image upload, orders
│
├── admin/
│   ├── index.html              ← Admin panel shell
│   └── app.js                  ← All admin features
│
└── delivery/
    └── index.html              ← Delivery panel (HTML + JS in one file)
```

---

## ⚡ Quick Setup (5 minutes)

### 1. Firebase Project
1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. **Create project** → name it `shopwave`
3. **Authentication** → Sign-in method → Enable **Google**
4. **Firestore Database** → Create database → Start in **test mode**
5. **Project Settings** → Your apps → Add **Web app** → copy the config object

### 2. Paste Config
Open `shared/js/config.js` and replace:
```js
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSy...",
  authDomain:        "shopwave-xxx.firebaseapp.com",
  projectId:         "shopwave-xxx",
  storageBucket:     "shopwave-xxx.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123...:web:abc..."
};
const IMGBB_API_KEY = "your_imgbb_key"; // free at imgbb.com/api
```

### 3. Add Your Domain to Firebase
Firebase Console → Authentication → Settings → **Authorized domains**  
Add `localhost` (for local dev) or your hosting domain.

### 4. Run Locally
```bash
# Python
python3 -m http.server 8080

# Node.js
npx serve .

# VS Code — install "Live Server" extension → right-click login.html → Open with Live Server
```
Open: `http://localhost:8080/login.html`

> ⚠️ Must use an HTTP server — Firebase Google Sign-In blocks `file://` URLs.

---

## 🔐 Make Yourself Admin

1. Sign in with Google → you'll land on the **user storefront**
2. Go to Firebase Console → **Firestore** → `users` collection
3. Find your document → click the `role` field → change it to `"admin"`
4. Refresh → you'll be redirected to the **Admin Panel**

---

## 🌱 Seed Default Data

Once logged in as admin:  
**Admin Panel → App Settings → 🌱 Seed Now**

This creates:
- 10 default categories (Electronics, Fashion, Home, etc.)
- 4 payment methods (COD, UPI, Card, Net Banking)

---

## 🗃️ Firestore Collections

| Collection | Purpose |
|---|---|
| `users` | All user accounts + roles |
| `products` | Product listings |
| `orders` | Customer orders |
| `categories` | Product categories |
| `payments` | Payment method options |
| `sellers` | Seller applications |
| `deliveryPartners` | Delivery partner applications |
| `settings/app` | Global app settings |

---

## 👥 Role System

| Role | Panel | How |
|---|---|---|
| `user` | `/user/` | Default on sign-up |
| `seller` | `/seller/` | Apply → admin approves |
| `delivery` | `/delivery/` | Apply → admin approves |
| `admin` | `/admin/` | Set manually in Firestore |

---

## 🚀 Deploy to Firebase Hosting

```bash
npm install -g firebase-tools
firebase login
firebase init hosting    # choose existing project, public dir = "."
firebase deploy --only hosting,firestore:rules
```

Live URL: `https://your-project-id.web.app`

---

## 🖼️ ImgBB Image Upload

1. Register free at [imgbb.com](https://imgbb.com)
2. Get API key at [api.imgbb.com](https://api.imgbb.com)
3. Paste key in `shared/js/config.js`

Sellers can upload up to 6 images per product (5MB each, JPG/PNG/WEBP).

---

## ✨ Features at a Glance

**User Storefront** — Hero banner · Category strip · Live search dropdown · Product detail with image gallery · Size/color picker · Quantity control · Persistent cart · Checkout with address form · Dynamic payment options · Order tracking with step indicator · Order history · Dark mode

**Seller Panel** — Registration → admin approval flow · Multi-image upload via ImgBB · Tag-based size/color variants · Revenue bar chart · Product CRUD · Order status management

**Admin Panel** — Approve/reject sellers & delivery partners · Full user management with role changer · Product moderation · Order management + delivery assignment · Dynamic categories · Payment method toggles · App settings (feature flags + limits) · One-click seed data

**Delivery Panel** — Registration → approval flow · Active order cards with address & items · Out-for-delivery + delivered status updates · Delivery history table · Partner profile
