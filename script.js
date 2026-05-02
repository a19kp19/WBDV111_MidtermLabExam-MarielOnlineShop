/* =========================================================
   Mariel Store — STATIC version (no backend)
   ---------------------------------------------------------
   Sections (search the headers to jump):

     1.  HELPERS              $, $$, peso, uid, escapeHtml, setVisibleState
     2.  CONSTANTS & CONFIG   LS keys, shipping fees, labels, limits
     3.  LOCAL STORAGE        readJSON / writeJSON
     4.  AUTH HELPERS         getUsers, currentUser, signIn / signOut
     5.  PAGE & NAV           buildHeader / buildFooter / buildOverlays
     6.  TOAST                tiny notification
     7.  CART                 add / change / remove / render
     8.  PRODUCTS             DEFAULT_PRODUCTS, productCard, render*
     9.  PRODUCT DETAIL       renderProductDetail        — product.html
     10. REVEAL ON SCROLL     setupReveal
     11. AUTH FORMS           bindRegister / bindLogin   — login.html / register.html
     12. ACCOUNT              loadAccount / bindAccountEdit — account.html
     13. GLOBAL EVENT WIRING  wireEvents — single delegated listener
     14. ADDRESSES            bindAddresses (CRUD)       — account.html
     15. CHECKOUT             bindCheckout               — checkout.html
     16. ORDERS               bindOrders / render*       — orders.html
     17. INIT                 DOMContentLoaded → calls every binder

   Conventions:
   - All persistence goes through readJSON/writeJSON + LS.* keys.
   - All DOM lookups go through $ / $$ helpers.
   - User-controlled strings rendered into innerHTML go through
     escapeHtml() to prevent broken markup / XSS.
   - "Auth" is a local demo (passwords in localStorage)
     => fine for a school project, NOT real security.
   ========================================================= */

/* =========================================================
   1. HELPERS
   ========================================================= */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const onPagesPath = () => location.pathname.includes("/pages/");
const base = onPagesPath() ? "../" : "";
const _useExt = location.protocol === "file:" || /\.html?$/i.test(location.pathname);
const _ext    = (file) => _useExt ? file : file.replace(/\.html$/, "");
const pagePath = (file) => onPagesPath() ? _ext(file) : `pages/${_ext(file)}`;
const home     = () => onPagesPath() ? `../${_ext("index.html")}` : _ext("index.html");
const peso = (n) => "₱" + Number(n).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const uid  = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

/* Show exactly one of several "state" elements and hide the rest.
   Pass a map of { stateName: element-or-id } then call with the
   active state name. Missing/null entries are skipped. */
function setVisibleState(map, active) {
  for (const [name, target] of Object.entries(map)) {
    const el = typeof target === "string" ? document.getElementById(target) : target;
    el?.classList.toggle("hidden", name !== active);
  }
}

/* Empty / not-found state markup.
   Pass icon + optional title, text, button [label, href], and an
   optional extra wrapper attribute string. */
const emptyState = (icon, title, text, btn, attr = "") => `
    <div class="empty"${attr}>
      <div class="icon">${icon}</div>
      ${title ? `<h2>${title}</h2>` : ""}
      ${text  ? `<p${title ? ` class="muted"` : ""}>${text}</p>` : ""}
      ${btn   ? `<a class="btn" href="${btn[1]}">${btn[0]}</a>` : ""}
    </div>`;

/* Escape HTML for safe interpolation into innerHTML / attributes. */
function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}
const escapeAttr = escapeHtml; // alias kept for readability at call sites

/* Populate a <select> element with <option> nodes.
   Clears existing options first; optionally prepends a placeholder. */
function buildSelectOptions(sel, items, valueKey, labelKey, placeholder) {
  sel.innerHTML = placeholder ? `<option value="">${placeholder}</option>` : "";
  items.forEach(item => {
    const opt = document.createElement("option");
    opt.value       = item[valueKey];
    opt.textContent = item[labelKey];
    sel.appendChild(opt);
  });
}

/* =========================================================
   2. CONSTANTS & CONFIG
   ========================================================= */

/* LocalStorage key registry */
const LS = {
  USERS:    "mariel.users",
  SESSION:  "mariel.session",
  ADDR:     (uid) => `mariel.addresses.${uid}`,
  ORDERS:   (uid) => `mariel.orders.${uid}`,
  PRODUCTS: "mariel.products",
  CART:     "mariel.cart",
};

/* Shipping fee tiers keyed by region shipping-tier name */
const SHIPPING_FEES = { ncr: 100, luzon: 180, visayas: 220, mindanao: 250 };

/* Fallback region map used when ph-address.js is NOT loaded on a page
   (checkout.html loads ph-address.js; other pages that display region
   info — account, orders — rely on this smaller lookup table). */
const LEGACY_REGIONS = {
  ncr:      { label: "Metro Manila (NCR)",  shipping: "ncr"      },
  luzon:    { label: "Luzon (outside NCR)", shipping: "luzon"    },
  visayas:  { label: "Visayas",             shipping: "visayas"  },
  mindanao: { label: "Mindanao",            shipping: "mindanao" },
};

/* Human-readable payment method labels */
const PAYMENT_LABELS = {
  cod:         "Cash on Delivery",
  online:      "Online Payment",
  installment: "Installment",
};

/* Maximum saved addresses per user */
const ADDR_LIMIT = 3;

/* Human-readable order status labels */
const STATUS_LABELS = {
  pending:   "Pending",
  packed:    "Packed",
  shipped:   "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

/* =========================================================
   3. LOCAL STORAGE
   ========================================================= */
const readJSON  = (k, fb) => { try { return JSON.parse(localStorage.getItem(k)) ?? fb; } catch { return fb; } };
const writeJSON = (k, v)  => localStorage.setItem(k, JSON.stringify(v));

/* =========================================================
   4. AUTH HELPERS
   ========================================================= */
const getUsers      = () => readJSON(LS.USERS, []);
const setUsers      = (a) => writeJSON(LS.USERS, a);
const currentUserId = () => readJSON(LS.SESSION, null)?.userId || null;
const currentUser   = () => {
  const id = currentUserId();
  if (!id) return null;
  return getUsers().find(u => u.id === id) || null;
};
const signOut = () => localStorage.removeItem(LS.SESSION);
const signIn  = (id) => writeJSON(LS.SESSION, { userId: id });

/* =========================================================
   5. PAGE & NAV
   ========================================================= */
const PAGE_KEY = document.body.dataset.page || "home";

const NAV_ITEMS = [
  { key: "home",     label: "Home",     href: home() },
  { key: "products", label: "Products", href: pagePath("products.html") },
  { key: "services", label: "Services", href: pagePath("services.html") },
  { key: "about",    label: "About",    href: pagePath("about.html") },
  { key: "contact",  label: "Contact",  href: pagePath("contact.html") },
];

function buildHeader() {
  const slot = $("#site-header");
  if (!slot) return;
  const links = NAV_ITEMS.map(i =>
    `<a href="${i.href}" class="${i.key === PAGE_KEY ? "active" : ""}">${i.label}</a>`
  ).join("");

  slot.innerHTML = `
    <header class="site-header">
      <div class="container nav">
        <button class="menu-toggle" id="menu-open" aria-label="Open menu">☰</button>
        <a class="brand" href="${home()}">
          <img src="${base}images/logo.png" alt="Mariel Store">
          <span>Mariel Store</span>
        </a>
        <nav class="nav-links">${links}</nav>
        <div class="nav-actions">
          <button class="btn-icon" id="open-cart" aria-label="Open cart">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h2l2.4 12.3a2 2 0 0 0 2 1.7h7.6a2 2 0 0 0 2-1.5L21 8H6"/><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/></svg>
            <span class="badge" id="cart-count">0</span>
          </button>

          <span class="auth-text" id="auth-text">
            <a href="${pagePath("login.html")}">Login</a> /
            <a href="${pagePath("register.html")}">Register</a>
          </span>

          <div class="user-menu hidden" id="user-menu">
            <button class="user-trigger" id="user-toggle" aria-label="Account menu">
              <span class="avatar" id="user-avatar">A</span>
              <span id="user-name">Account</span>
            </button>
            <div class="user-dropdown" id="user-dropdown">
              <a href="${pagePath("account.html")}">My Account</a>
              <a href="${pagePath("orders.html")}">My Orders</a>
              <button id="logout-btn">Sign out</button>
            </div>
          </div>
        </div>
      </div>
    </header>
  `;
  $("#user-toggle")?.addEventListener("click", () => $("#user-dropdown")?.classList.toggle("open"));
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#user-menu")) $("#user-dropdown")?.classList.remove("open");
  });
}

function buildFooter() {
  const year = new Date().getFullYear();
  if (document.querySelector(".site-footer")) return;
  const f = document.createElement("footer");
  f.className = "site-footer";
  f.innerHTML = `
    <div class="container footer-grid">
      <div class="footer-col">
        <a class="brand" href="${home()}">
          <img src="${base}images/logo.png" alt="Mariel Store">
          <span>Mariel Store</span>
        </a>
        <p style="margin-top:10px">Affordable, reliable shopping across the Philippines.</p>
      </div>
      <div class="footer-col">
        <h4>Shop</h4>
        <ul>
          <li><a href="${pagePath("products.html")}">All Products</a></li>
          <li><a href="${pagePath("products.html")}?cat=gadgets">Gadgets</a></li>
          <li><a href="${pagePath("products.html")}?cat=furnitures">Furnitures</a></li>
          <li><a href="${pagePath("products.html")}?cat=foods">Foods</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h4>Company</h4>
        <ul>
          <li><a href="${pagePath("about.html")}">About</a></li>
          <li><a href="${pagePath("services.html")}">Services</a></li>
          <li><a href="${pagePath("contact.html")}">Contact</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h4>Help</h4>
        <ul>
          <li><a href="${pagePath("orders.html")}">My Orders</a></li>
          <li><a href="${pagePath("account.html")}">My Account</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom container">
      <span>© ${year} Mariel Store. All rights reserved.</span>
    </div>
  `;
  const slot = document.getElementById("site-footer");
  if (slot) slot.replaceWith(f);
  else document.body.appendChild(f);
}

function buildOverlays() {
  if ($("#scrim")) return;
  const div = document.createElement("div");
  div.innerHTML = `
    <div id="scrim" class="scrim"></div>
    <aside id="cart-drawer" class="drawer" aria-label="Cart">
      <div class="drawer-head">
        <h3>Your Cart</h3>
        <button id="close-cart" class="close" aria-label="Close">✕</button>
      </div>
      <div id="cart-items" class="drawer-body"></div>
      <div class="drawer-foot">
        <div class="total"><span>Total</span><strong id="cart-total" class="amt">₱0.00</strong></div>
        <button class="btn btn-block" id="checkout-btn">Checkout</button>
      </div>
    </aside>
    <nav id="mobile-nav" class="mobile-nav" aria-label="Mobile">
      <div class="top">
        <span class="brand-mini">Menu</span>
        <button id="menu-close" class="close" aria-label="Close menu">✕</button>
      </div>
      ${NAV_ITEMS.map(i => `<a href="${i.href}"${i.key === PAGE_KEY ? ' class="active"' : ""}>${i.label}</a>`).join("")}
      <div class="mobile-nav-auth">
        <div id="mobile-auth-text">
          <a href="${pagePath("login.html")}" class="btn btn-block">Login</a>
          <a href="${pagePath("register.html")}" class="btn btn-outline btn-block">Register</a>
        </div>
        <div id="mobile-user-menu" class="hidden">
          <a href="${pagePath("account.html")}">My Account</a>
          <a href="${pagePath("orders.html")}">My Orders</a>
          <button type="button" id="mobile-logout-btn" class="link-btn">Sign out</button>
        </div>
      </div>
    </nav>
    <div id="toast-stack" class="toast-stack"></div>
  `;
  document.body.appendChild(div);
}

/* =========================================================
   6. TOAST
   ========================================================= */
function toast(msg, type = "") {
  const stack = $("#toast-stack"); if (!stack) return alert(msg);
  const el = document.createElement("div");
  el.className = "toast " + type;
  el.textContent = msg;
  stack.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

/* =========================================================
   7. CART (localStorage)
   ========================================================= */
const getCart = () => readJSON(LS.CART, []);
const setCart = (c) => { writeJSON(LS.CART, c); renderCart(); };

function addToCart(item) {
  const cart    = getCart();
  const found   = cart.find(i => i.id === item.id);
  const product = PRODUCTS.find(p => p.id === item.id);
  const max     = product?.stock ?? Infinity;
  const have    = found?.qty || 0;
  if (have + 1 > max) { toast(`Only ${max} available`, "bad"); return false; }
  if (found) found.qty += 1;
  else cart.push({ ...item, qty: 1 });
  setCart(cart);
  toast("Added to cart", "ok");
  return true;
}

function changeQty(id, delta) {
  const cart    = getCart();
  const i       = cart.find(x => x.id === id); if (!i) return;
  const product = PRODUCTS.find(p => p.id === id);
  const max     = product?.stock ?? Infinity;
  i.qty = Math.max(1, Math.min(max, i.qty + delta));
  setCart(cart);
}

function removeFromCart(id) { setCart(getCart().filter(i => i.id !== id)); }

function renderCart() {
  const list  = $("#cart-items");
  const count = $("#cart-count");
  const total = $("#cart-total");
  const cart  = getCart();
  if (count) count.textContent = cart.reduce((s, i) => s + i.qty, 0);
  if (!list || !total) return;
  if (!cart.length) {
    list.innerHTML = emptyState("🛒", "", "Your cart is empty.");
    total.textContent = peso(0);
    return;
  }
  list.innerHTML = cart.map(i => `
    <div class="cart-item">
      <img src="${i.img}" alt="">
      <div>
        <div class="name">${escapeHtml(i.name)}</div>
        <div class="price">${peso(i.price)}</div>
        <div class="qty">
          <button data-act="dec" data-id="${i.id}">−</button>
          <span>${i.qty}</span>
          <button data-act="inc" data-id="${i.id}">+</button>
        </div>
        <button class="remove" data-act="rm" data-id="${i.id}">Remove</button>
      </div>
      <div class="line-total">${peso(i.price * i.qty)}</div>
    </div>
  `).join("");
  total.textContent = peso(cart.reduce((s, i) => s + i.price * i.qty, 0));
}

function openCart()  { $("#scrim")?.classList.add("open"); $("#cart-drawer")?.classList.add("open"); }
function closeCart() { $("#scrim")?.classList.remove("open"); $("#cart-drawer")?.classList.remove("open"); closeMenu(); }
function openMenu()  { $("#scrim")?.classList.add("open"); $("#mobile-nav")?.classList.add("open"); }
function closeMenu() { $("#mobile-nav")?.classList.remove("open"); }

/* =========================================================
   8. PRODUCTS (in-memory + localStorage stock updates)
   ========================================================= */
function resolveImg(src) {
  if (!src) return base + "images/logo.png";
  if (/^(https?:)?\/\//i.test(src) || src.startsWith("/")) return src;
  return base + src.replace(/^\.?\//, "");
}

const DEFAULT_PRODUCTS = [
  { id: "iphone14", name: "iPhone 14 Pro",             price: 50000, cat: "Gadgets",     img: "images/products/Iphone14.jpg",   tag: "Bestseller", desc: "128GB, factory unlocked, 1-year warranty.",                details: "6.1\" Super Retina XDR display, A16 Bionic chip, 48MP main camera, Face ID, 5G.",      stock: 3,  sort_order: 1 },
  { id: "iphone12", name: "iPhone 12",                 price: 28000, cat: "Gadgets",     img: "images/products/Iphone12.jpg",   tag: "",           desc: "256GB, factory unlocked, 1-year warranty.",                details: "6.1\" OLED display, A14 Bionic chip, dual 12MP cameras, 5G capable.",                  stock: 7,  sort_order: 2 },
  { id: "ipad",     name: "Apple iPad",                price: 22000, cat: "Gadgets",     img: "images/products/Ipad.jpg",       tag: "New",        desc: "128GB, 11th Gen(A16 Bionic) with Apple Pencil support.",   details: "10.9\" Liquid Retina display, A16 Bionic chip, Apple Pencil (2nd generation) support.", stock: 5,  sort_order: 3 },
  { id: "clock",    name: "Wall Clock",                price: 200,   cat: "Accessories", img: "images/products/Clock.jpg",      tag: "",           desc: "Affordable, modern, durable for any room.",                 details: "30cm diameter, silent quartz movement, AA battery powered.",                            stock: 1,  sort_order: 4 },
  { id: "snickers", name: "Mixed Chocolates Box",      price: 500,   cat: "Foods",       img: "images/products/Snickers.jpg",   tag: "Hot",        desc: "A Box of Mixed Chocolates, gift ready.",                    details: "A box with different kind of chocolates inside. All-time favorite!",                    stock: 13, sort_order: 5 },
  { id: "choco",    name: "Snickers, Dairy Milk Bars", price: 350,   cat: "Foods",       img: "images/products/Chocolates.jpg", tag: "",           desc: "Snickers and Dairy Milk Bars selling per box.",             details: "Classic combination, irresistible taste.",                                              stock: 22, sort_order: 6 },
  { id: "chair1",   name: "Set of Lounge Chairs",      price: 3000,  cat: "Furnitures",  img: "images/products/chair1.jpg",     tag: "New",        desc: "Comfortable, stylish, perfect for any living room.",        details: "3-seater, high-density foam cushions, durable fabric upholstery.",                      stock: 1,  sort_order: 7 },
];

let PRODUCTS = loadProductsFromStore();

function loadProductsFromStore() {
  const stored = readJSON(LS.PRODUCTS, null);
  const src    = stored && Array.isArray(stored) && stored.length ? stored : DEFAULT_PRODUCTS;
  return src
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map(p => ({ ...p, img: resolveImg(p.img) }));
}

function persistProducts(list) {
  /* Store raw image paths (no resolved base) so other pages can resolve correctly */
  writeJSON(LS.PRODUCTS, list.map(p => ({ ...p, img: stripBase(p.img) })));
  PRODUCTS = loadProductsFromStore();
}

function stripBase(src) {
  if (!src) return src;
  if (base && src.startsWith(base)) return src.slice(base.length);
  return src;
}

const CATEGORIES = [
  { key: "all",         label: "All" },
  { key: "gadgets",     label: "Gadgets" },
  { key: "furnitures",  label: "Furnitures" },
  { key: "accessories", label: "Accessories" },
  { key: "foods",       label: "Foods" },
];

function productCard(p) {
  const link = `${pagePath("product.html")}?id=${p.id}`;
  return `
    <article class="product">
      <a class="media" href="${link}">
        ${p.tag ? `<span class="tag">${p.tag}</span>` : ""}
        <img src="${p.img}" alt="${escapeHtml(p.name)}" loading="lazy">
      </a>
      <div class="info">
        <span class="cat-label">${escapeHtml(p.cat)}</span>
        <h3><a href="${link}">${escapeHtml(p.name)}</a></h3>
        <p class="muted" style="font-size:.85rem">${escapeHtml(p.desc)}</p>
        <div class="price">${peso(p.price)}</div>
      </div>
      <div class="actions">
        <a class="btn btn-outline" href="${link}">View</a>
      </div>
    </article>
  `;
}

/* products.html — renders the filterable grid and toolbar */
function renderProducts() {
  const grid = $("#products-grid");
  if (!grid) return;

  const toolbar = $("#products-toolbar");
  if (toolbar && !toolbar.dataset.ready) {
    toolbar.dataset.ready = "1";
    toolbar.innerHTML = `
      <div class="search"><input type="search" id="product-search" placeholder="Search products..."></div>
      <div class="chips" id="cat-chips">
        ${CATEGORIES.map(c => `<button class="chip" data-cat="${c.key}">${c.label}</button>`).join("")}
      </div>
    `;
  }

  const params     = new URLSearchParams(location.search);
  const initialCat = params.get("cat") || "all";
  if (!grid.dataset.cat) grid.dataset.cat = initialCat;
  const search = ($("#product-search")?.value || "").toLowerCase().trim();
  const cat    = grid.dataset.cat;

  $$(".chip", $("#cat-chips")).forEach(b => b.classList.toggle("active", b.dataset.cat === cat));

  const list = PRODUCTS.filter(p =>
    (cat === "all" || p.cat.toLowerCase() === cat) &&
    (!search || p.name.toLowerCase().includes(search) || (p.desc || "").toLowerCase().includes(search))
  );

  grid.innerHTML = list.length
    ? list.map(productCard).join("")
    : emptyState("🔍", "", "No products match your search.", null, ' style="grid-column:1/-1"');
}

/* index.html — renders the featured products strip */
function renderFeatured() {
  const grid = $("#featured-grid");
  if (!grid) return;
  grid.innerHTML = PRODUCTS.slice(0, 4).map(productCard).join("");
}

/* =========================================================
   9. PRODUCT DETAIL PAGE — product.html
   ========================================================= */
function renderProductDetail() {
  const host = $("#product-detail");
  if (!host) return;

  const id = new URLSearchParams(location.search).get("id");
  const p  = PRODUCTS.find(x => x.id === id);

  if (!p) {
    host.innerHTML = emptyState("😕", "Product not found",
      "It may have been removed or the link is invalid.",
      ["Back to Products", "products.html"]);
    return;
  }

  const stockText  = p.stock > 0 ? `${p.stock} in stock` : "Out of stock";
  const stockClass = p.stock > 0 ? "stock-pill in" : "stock-pill out";
  const stockLine  = `<span class="${stockClass}">${stockText}</span>`;

  host.innerHTML = `
    <p class="crumbs"><a href="${pagePath("products.html")}">Products</a> / <span>${escapeHtml(p.name)}</span></p>
    <div class="product-detail">
      <div class="pd-media">
        ${p.tag ? `<span class="tag">${p.tag}</span>` : ""}
        <img src="${p.img}" alt="${escapeHtml(p.name)}">
      </div>
      <div class="pd-info">
        <span class="eyebrow">${escapeHtml(p.cat)}</span>
        <h1>${escapeHtml(p.name)}</h1>
        <div class="pd-price">${peso(p.price)}${stockLine}</div>
        <p class="pd-desc">${escapeHtml(p.desc)}</p>
        ${p.details ? `<ul class="pd-meta"><li><strong>Details:</strong> ${escapeHtml(p.details)}</li></ul>` : ""}
        <div class="pd-qty">
          <label for="pd-qty-input">Quantity</label>
          <div class="qty-box">
            <button type="button" data-pd="dec" aria-label="Decrease">−</button>
            <input id="pd-qty-input" type="number" value="1" min="1" max="${p.stock || 1}">
            <button type="button" data-pd="inc" aria-label="Increase">+</button>
          </div>
        </div>
        <div class="pd-actions">
          <button class="btn add-cart" data-id="${p.id}" data-qty-from="#pd-qty-input" ${p.stock <= 0 ? "disabled" : ""}>
            ${p.stock <= 0 ? "Out of Stock" : "Add to Cart"}
          </button>
        </div>
      </div>
    </div>
  `;

  const relatedHost = $("#related-grid");
  if (relatedHost) {
    const related = PRODUCTS.filter(x => x.cat === p.cat && x.id !== p.id).slice(0, 4);
    if (related.length) relatedHost.innerHTML = related.map(productCard).join("");
    else relatedHost.closest("section")?.classList.add("hidden");
  }
}

/* =========================================================
   10. REVEAL ON SCROLL
   ========================================================= */
function setupReveal() {
  const els = $$(".reveal");
  if (!("IntersectionObserver" in window)) { els.forEach(e => e.classList.add("in")); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    });
  }, { threshold: 0.12 });
  els.forEach(e => io.observe(e));
}

/* =========================================================
   11. AUTH FORMS — login.html / register.html
   ========================================================= */
const isStrong        = (p) => p.length >= 6 && /[A-Z]/.test(p) && /[a-z]/.test(p) && /[0-9]/.test(p) && /[^A-Za-z0-9]/.test(p);
const isLettersOnly   = (s) => /^[A-Za-z]+$/.test(s);
const isLettersAndSpaces = (s) => /^[A-Za-z\s]+$/.test(s);

const setMsg = (id, msg, ok = false) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.classList.toggle("ok", ok);
};

const getDisplayName = (u) => u?.username || u?.full_name || (u?.email ? u.email.split("@")[0] : "Account");

function bindPasswordToggles(root) {
  const scope = root || document;
  const applyToggle = (btn, show) => {
    const input = document.getElementById(btn.dataset.toggle);
    if (!input) return;
    input.type       = show ? "text" : "password";
    btn.textContent  = show ? "Hide" : "Show";
    btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
  };
  scope.querySelectorAll(".password-toggle").forEach((btn) => {
    if (btn.dataset.bound === "1") return;
    btn.dataset.bound = "1";
    btn.addEventListener("click", () => {
      const input = document.getElementById(btn.dataset.toggle);
      if (!input) return;
      const show  = input.type !== "text";
      const group = btn.dataset.group;
      if (group) {
        document.querySelectorAll(`.password-toggle[data-group="${group}"]`)
          .forEach((sibling) => applyToggle(sibling, show));
      } else {
        applyToggle(btn, show);
      }
    });
  });
}

function bindPasswordHint(inputId, hintId) {
  const pw = $("#" + inputId);
  if (!pw) return;
  pw.addEventListener("input", () => {
    const v    = pw.value;
    const hint = $("#" + hintId);
    if (!hint) return;
    if (!v)            { hint.className = "hint";     hint.textContent = "Min. 6 characters with uppercase, lowercase, number, and special character."; return; }
    if (isStrong(v))   { hint.className = "hint ok";  hint.textContent = "Strong password ✓"; }
    else               { hint.className = "hint bad"; hint.textContent = "Add uppercase, lowercase, number, special character (min. 6 chars)."; }
  });
}

function hideGoogleButton(id, msgId) {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.addEventListener("click", () => setMsg(msgId, "Google sign-in is not available in the static demo."));
  /* Hide the social section since OAuth requires a backend */
  const wrap = btn.closest(".social-row, .social-buttons, .social-login, .social, .form-row, .auth-social");
  if (wrap) wrap.style.display = "none";
  else btn.style.display = "none";
  /* Also hide adjacent dividers */
  const divider = document.querySelector(".or-divider, .divider, .auth-divider");
  if (divider) divider.style.display = "none";
}

function updateAuthUI() {
  const u         = currentUser();
  const userMenu  = $("#user-menu");
  const authText  = $("#auth-text");
  const mAuthText = $("#mobile-auth-text");
  const mUserMenu = $("#mobile-user-menu");
  if (!u) {
    userMenu?.classList.add("hidden");
    authText?.classList.remove("hidden");
    mUserMenu?.classList.add("hidden");
    mAuthText?.classList.remove("hidden");
    return;
  }
  authText?.classList.add("hidden");
  userMenu?.classList.remove("hidden");
  mAuthText?.classList.add("hidden");
  mUserMenu?.classList.remove("hidden");
  const name = getDisplayName(u);
  $("#user-name").textContent   = name;
  $("#user-avatar").textContent = (name[0] || "A").toUpperCase();
  const signOutAndGoHome = () => { signOut(); location.href = home(); };
  $("#logout-btn").onclick = signOutAndGoHome;
  const mLogout = $("#mobile-logout-btn");
  if (mLogout) mLogout.onclick = signOutAndGoHome;

  /* Redirect already-logged-in users away from auth pages */
  if (PAGE_KEY === "login" || PAGE_KEY === "register") location.href = home();
}

/* register.html */
function bindRegister() {
  const f = $("#register-form"); if (!f) return;
  bindPasswordHint("password", "password-hint");
  hideGoogleButton("google-register", "form-message");

  /* Restrict username to letters only (real-time) */
  const usernameInput = $("#username");
  if (usernameInput) {
    usernameInput.addEventListener("input", () => {
      usernameInput.value = usernameInput.value.replace(/[^A-Za-z]/g, "");
    });
  }

  /* Restrict full name to letters and spaces only (real-time) */
  const fullNameInput = $("#full-name");
  if (fullNameInput) {
    fullNameInput.addEventListener("input", () => {
      fullNameInput.value = fullNameInput.value.replace(/[^A-Za-z ]/g, "");
    });
  }

  f.addEventListener("submit", (e) => {
    e.preventDefault();
    const username = $("#username").value.trim();
    const fullName = $("#full-name").value.trim();
    const email    = $("#email").value.trim().toLowerCase();
    const password = $("#password").value;
    const confirm  = $("#confirm-password").value;
    setMsg("form-message", "");
    if (!username || !fullName || !email) return setMsg("form-message", "Please fill in all required fields.");
    if (!isLettersOnly(username))         return setMsg("form-message", "Username must contain letters only.");
    if (!isLettersAndSpaces(fullName))    return setMsg("form-message", "Full name must contain letters only.");
    if (!isStrong(password))              return setMsg("form-message", "Password must be at least 6 characters.");
    if (password !== confirm)             return setMsg("form-message", "Passwords do not match.");

    const users = getUsers();
    if (users.some(u => u.email === email))       return setMsg("form-message", "An account with that email already exists.");
    if (users.some(u => u.username === username)) return setMsg("form-message", "That username is already taken.");

    const user = {
      id: uid(),
      username, full_name: fullName, email, phone: "", password,
      created_at: new Date().toISOString(),
    };
    users.push(user);
    setUsers(users);
    signIn(user.id);
    setMsg("form-message", "Account created. Redirecting...", true);
    setTimeout(() => location.href = home(), 900);
  });
}

/* login.html */
function bindLogin() {
  const f = $("#login-form"); if (!f) return;
  hideGoogleButton("google-login", "login-message");
  f.addEventListener("submit", (e) => {
    e.preventDefault();
    const email    = $("#login-email").value.trim().toLowerCase();
    const password = $("#login-password").value;
    setMsg("login-message", "");
    const u = getUsers().find(x => x.email === email);
    if (!u || u.password !== password) return setMsg("login-message", "Invalid email or password.");
    signIn(u.id);
    setMsg("login-message", "Login successful. Redirecting...", true);
    setTimeout(() => location.href = home(), 700);
  });
}

/* =========================================================
   12. ACCOUNT — account.html
   ========================================================= */
function loadAccount() {
  const u1 = $("#account-username"); if (!u1) return;
  const u  = currentUser();
  if (!u) { location.href = pagePath("login.html"); return; }
  u1.textContent                      = u.username  || "—";
  $("#account-full-name").textContent = u.full_name || "—";
  $("#account-email").textContent     = u.email     || "—";
  $("#account-phone").textContent     = u.phone     || "—";
  bindAccountEdit(u);
}

function bindAccountEdit(u) {
  const editBtn   = $("#edit-profile-btn");
  const cancelBtn = $("#cancel-edit-btn");
  const form      = $("#account-edit");
  const view      = $("#account-view");
  if (!editBtn || !form || !view) return;
  if (form.dataset.bound) return;
  form.dataset.bound = "1";

  $("#edit-phone").addEventListener("input", (e) => {
    e.target.value = e.target.value.replace(/[^0-9]/g, "").slice(0, 11);
  });

  const openEdit = () => {
    $("#edit-username").value  = u.username  || "";
    $("#edit-full-name").value = u.full_name || "";
    $("#edit-email").value     = u.email     || "";
    $("#edit-phone").value     = u.phone     || "";
    setMsg("edit-message", "");
    view.classList.add("hidden");
    form.classList.remove("hidden");
    editBtn.classList.add("hidden");
  };
  const closeEdit = () => {
    form.classList.add("hidden");
    view.classList.remove("hidden");
    editBtn.classList.remove("hidden");
  };

  editBtn.onclick  = openEdit;
  cancelBtn.onclick = closeEdit;

  form.onsubmit = (e) => {
    e.preventDefault();
    const username  = $("#edit-username").value.trim();
    const full_name = $("#edit-full-name").value.trim();
    const phone     = $("#edit-phone").value.trim();
    if (!username)  return setMsg("edit-message", "Username is required.");
    if (!full_name) return setMsg("edit-message", "Full name is required.");
    if (phone && !/^09[0-9]{9}$/.test(phone)) return setMsg("edit-message", "Phone must be 11 digits and start with 09.");

    const users = getUsers();
    if (users.some(x => x.id !== u.id && x.username === username))
      return setMsg("edit-message", "That username is already taken.");

    const target     = users.find(x => x.id === u.id);
    target.username  = username;
    target.full_name = full_name;
    target.phone     = phone;
    setUsers(users);

    Object.assign(u, { username, full_name, phone });
    $("#account-username").textContent  = username;
    $("#account-full-name").textContent = full_name;
    $("#account-phone").textContent     = phone || "—";
    setMsg("edit-message", "Profile updated.", true);
    updateAuthUI();
    setTimeout(closeEdit, 700);
  };
}

/* =========================================================
   13. GLOBAL EVENT WIRING
   ========================================================= */
function wireEvents() {
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-act], [data-id], [data-pd], #open-cart, #close-cart, #scrim, #menu-open, #menu-close, .add-cart, .chip, #checkout-btn");
    if (!t) return;

    if (t.id === "open-cart")                       return openCart();
    if (t.id === "close-cart" || t.id === "scrim")  return closeCart();
    if (t.id === "menu-open")                       return openMenu();
    if (t.id === "menu-close")                      return closeMenu();

    if (t.classList.contains("add-cart")) {
      const p = PRODUCTS.find(x => x.id === t.dataset.id);
      if (!p) return;
      let qty = 1;
      if (t.dataset.qtyFrom) {
        const inp = document.querySelector(t.dataset.qtyFrom);
        qty = Math.max(1, parseInt(inp?.value, 10) || 1);
      }
      for (let i = 0; i < qty; i++) {
        if (!addToCart({ id: p.id, name: p.name, price: p.price, img: p.img })) break;
      }
      return;
    }

    if (t.dataset.pd === "inc" || t.dataset.pd === "dec") {
      const inp = $("#pd-qty-input");
      if (!inp) return;
      const max = parseInt(inp.max, 10) || Infinity;
      let v = (parseInt(inp.value, 10) || 1) + (t.dataset.pd === "inc" ? 1 : -1);
      v = Math.max(1, Math.min(max, v));
      if (t.dataset.pd === "inc" && v === parseInt(inp.value, 10)) toast(`Only ${max} available`, "bad");
      inp.value = v;
      return;
    }

    if (t.classList.contains("chip")) {
      const grid = $("#products-grid");
      if (grid) { grid.dataset.cat = t.dataset.cat; renderProducts(); }
      return;
    }

    if (t.id === "checkout-btn") {
      if (getCart().length === 0) return toast("Your cart is empty", "bad");
      if (!currentUser()) {
        toast("Please log in to checkout", "bad");
        closeCart();
        setTimeout(() => location.href = pagePath("login.html"), 800);
        return;
      }
      closeCart();
      location.href = pagePath("checkout.html");
      return;
    }

    if (t.dataset.act === "inc") changeQty(t.dataset.id, +1);
    if (t.dataset.act === "dec") changeQty(t.dataset.id, -1);
    if (t.dataset.act === "rm")  removeFromCart(t.dataset.id);
  });

  document.addEventListener("input", (e) => {
    if (e.target.id === "product-search") renderProducts();
  });
}

/* =========================================================
   14. SAVED ADDRESSES — account.html
   ========================================================= */
function fetchUserAddresses() {
  const u = currentUser();
  if (!u) return [];
  return readJSON(LS.ADDR(u.id), []);
}
function saveUserAddresses(list) {
  const u = currentUser();
  if (!u) return;
  writeJSON(LS.ADDR(u.id), list);
}

function bindAddresses() {
  const list = $("#addresses-list");
  if (!list) return;

  const form      = $("#address-form");
  const addBtn    = $("#addr-add-btn");
  const cancelBtn = $("#addr-cancel-btn");
  const titleEl   = $("#addr-form-title");

  function fill(a) {
    $("#addr-id").value       = a?.id            || "";
    $("#addr-label").value    = a?.label          || "Home";
    $("#addr-name").value     = a?.full_name      || "";
    $("#addr-phone").value    = a?.phone          || "";
    $("#addr-line").value     = a?.address_line   || "";
    $("#addr-city").value     = a?.city           || "";
    $("#addr-province").value = a?.province       || "";
    $("#addr-region").value   = a?.region         || "";
    $("#addr-postal").value   = a?.postal_code    || "";
    $("#addr-default").checked = !!a?.is_default;
    titleEl.textContent = a ? "Edit Address" : "Add Address";
    setMsg("addr-message", "");
  }

  function showForm(a) {
    fill(a);
    form.classList.remove("hidden");
    addBtn.classList.add("hidden");
    form.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  function hideForm() {
    form.classList.add("hidden");
    addBtn.classList.remove("hidden");
  }

  function refresh() {
    const data = fetchUserAddresses().sort((a, b) => Number(b.is_default) - Number(a.is_default));
    addBtn.disabled = data.length >= ADDR_LIMIT;
    addBtn.title    = data.length >= ADDR_LIMIT ? "You can save up to 3 addresses." : "";

    if (!data.length) {
      list.innerHTML = `<p class="muted" style="margin:0">No saved addresses yet — click <strong>+ Add Address</strong> to add one.</p>`;
      return;
    }

    list.innerHTML = `<div class="addr-grid">${data.map(a => `
      <div class="addr-card${a.is_default ? " is-default" : ""}">
        <div class="addr-card-head">
          <span class="addr-label-pill">${escapeHtml(a.label)}</span>
          ${a.is_default ? `<span class="addr-default-pill">Default</span>` : ""}
        </div>
        <div class="addr-card-body">
          <strong>${escapeHtml(a.full_name)}</strong>
          <div class="muted" style="font-size:.88rem">${escapeHtml(a.phone)}</div>
          <div style="margin-top:6px">${escapeHtml(a.address_line)}</div>
          <div class="muted" style="font-size:.88rem">${escapeHtml(a.city)}, ${escapeHtml(a.province)}${a.postal_code ? " · " + escapeHtml(a.postal_code) : ""}</div>
          <div class="muted" style="font-size:.85rem">${escapeHtml(getRegionLabel(a.region))}</div>
        </div>
        <div class="addr-card-actions">
          ${a.is_default ? "" : `<button class="btn btn-outline btn-sm" data-addr="default" data-id="${a.id}">Set Default</button>`}
          <button class="btn btn-outline btn-sm" data-addr="edit" data-id="${a.id}">Edit</button>
          <button class="btn btn-sm btn-danger" data-addr="del" data-id="${a.id}">Delete</button>
        </div>
      </div>
    `).join("")}</div>`;

    list.querySelectorAll('[data-addr="edit"]').forEach(b => {
      b.onclick = () => { const a = data.find(x => x.id === b.dataset.id); if (a) showForm(a); };
    });
    list.querySelectorAll('[data-addr="del"]').forEach(b => {
      b.onclick = () => {
        if (!confirm("Delete this address?")) return;
        saveUserAddresses(fetchUserAddresses().filter(x => x.id !== b.dataset.id));
        toast("Address deleted", "ok");
        refresh();
      };
    });
    list.querySelectorAll('[data-addr="default"]').forEach(b => {
      b.onclick = () => {
        const all = fetchUserAddresses().map(x => ({ ...x, is_default: x.id === b.dataset.id }));
        saveUserAddresses(all);
        toast("Default address updated", "ok");
        refresh();
      };
    });
  }

  addBtn.onclick  = () => showForm(null);
  cancelBtn.onclick = hideForm;

  form.onsubmit = (e) => {
    e.preventDefault();
    setMsg("addr-message", "");
    const id      = $("#addr-id").value;
    const payload = {
      id:           id || uid(),
      label:        $("#addr-label").value,
      full_name:    $("#addr-name").value.trim(),
      phone:        $("#addr-phone").value.trim(),
      address_line: $("#addr-line").value.trim(),
      city:         $("#addr-city").value.trim(),
      province:     $("#addr-province").value.trim(),
      region:       $("#addr-region").value,
      postal_code:  $("#addr-postal").value.trim() || "",
      is_default:   $("#addr-default").checked,
      created_at:   new Date().toISOString(),
    };
    const required = ["full_name", "phone", "address_line", "city", "province", "region"];
    for (const k of required) if (!payload[k]) return setMsg("addr-message", "Please fill in all required fields.");

    let all = fetchUserAddresses();
    if (id) {
      const idx = all.findIndex(x => x.id === id);
      if (idx < 0) return setMsg("addr-message", "Address not found.");
      all[idx] = { ...all[idx], ...payload };
    } else {
      if (all.length >= ADDR_LIMIT) return setMsg("addr-message", "You can save up to 3 addresses only.");
      all.push(payload);
    }
    if (payload.is_default) all = all.map(a => ({ ...a, is_default: a.id === payload.id }));
    saveUserAddresses(all);

    toast(id ? "Address updated" : "Address saved", "ok");
    hideForm();
    refresh();
  };

  refresh();
}

/* =========================================================
   15. CHECKOUT — checkout.html
   ========================================================= */

/* Look up a region by key. Returns { label, shipping } or null.
   Single source of truth used by getRegionLabel + getShippingFee. */
function findRegion(key) {
  if (typeof PH_REGIONS !== "undefined") {
    const r = PH_REGIONS.find(x => x.key === key);
    if (r) return r;
  }
  return LEGACY_REGIONS[key] || null;
}

function getRegionLabel(key)    { return findRegion(key)?.label || key; }
function getShippingFee(regionKey) {
  const tier = findRegion(regionKey)?.shipping;
  return tier ? SHIPPING_FEES[tier] : null;
}

function bindCheckout() {
  const app = $("#checkout-app");
  if (!app) return;

  const checkoutStates = { loading: "checkout-loading", empty: "checkout-empty", ok: app };

  const u = currentUser();
  if (!u) { location.href = pagePath("login.html"); return; }

  const cart = getCart();
  if (!cart.length) { setVisibleState(checkoutStates, "empty"); return; }
  setVisibleState(checkoutStates, "ok");

  $("#co-name").value  = u.full_name || "";
  $("#co-phone").value = u.phone     || "";
  $("#co-email").value = u.email     || "";

  /* Restrict phone input to digits only, max 11 characters */
  const phoneInput = $("#co-phone");
  if (phoneInput) {
    phoneInput.addEventListener("input", () => {
      phoneInput.value = phoneInput.value.replace(/[^0-9]/g, "").slice(0, 11);
    });
  }

  const savedAddresses  = fetchUserAddresses();
  let activePickedAddrId = null;

  /* ---- Philippine cascading address helpers ---- */

  function buildRegionDropdown() {
    buildSelectOptions($("#co-region"), PH_REGIONS, "key", "label");
  }

  function buildProvinceDropdown(regionKey) {
    const sel       = $("#co-province");
    const provinces = PH_PROVINCES[regionKey] || [];
    buildSelectOptions(sel, provinces, "key", "label", "Select province…");
    sel.disabled = !provinces.length;
    /* Reset city when province changes */
    const citySel = $("#co-city");
    citySel.innerHTML = "<option value=\"\">Select city / municipality…</option>";
    citySel.disabled  = true;
    $("#co-postal").value = "";
  }

  function buildCityDropdown(provinceKey) {
    const sel    = $("#co-city");
    const cities = PH_CITIES[provinceKey] || [];
    buildSelectOptions(sel, cities, "name", "name", "Select city / municipality…");
    sel.disabled = !cities.length;
    $("#co-postal").value = "";
  }

  buildRegionDropdown();

  function fillFromAddress(a) {
    $("#co-name").value    = a.full_name;
    $("#co-phone").value   = a.phone;
    $("#co-address").value = a.address_line;
    /* Cascade: region → province → city → postal */
    const regionKey   = a.region   || "";
    const provinceKey = a.province || "";
    const cityName    = a.city     || "";
    $("#co-region").value = regionKey;
    buildProvinceDropdown(regionKey);
    if (provinceKey) {
      $("#co-province").value = provinceKey;
      buildCityDropdown(provinceKey);
      if (cityName) {
        $("#co-city").value = cityName;
        const cities    = PH_CITIES[provinceKey] || [];
        const cityData  = cities.find(c => c.name === cityName);
        $("#co-postal").value = cityData ? cityData.postal : (a.postal_code || "");
      }
    }
    activePickedAddrId = a.id;
    recomputeTotals();
    refreshSaveCheckbox();
  }

  function refreshSaveCheckbox() {
    const row  = $("#save-addr-row");
    const cb   = $("#co-save-address");
    const hide = !!activePickedAddrId || savedAddresses.length >= ADDR_LIMIT;
    row.classList.toggle("hidden", hide);
    if (hide) cb.checked = false;
  }

  if (savedAddresses.length) {
    const picker = $("#saved-addresses-picker");
    const cards  = $("#saved-addresses-cards");
    picker.classList.remove("hidden");
    cards.innerHTML = savedAddresses.map(a => `
      <button type="button" class="addr-pick-card" data-id="${a.id}">
        <div class="addr-pick-head">
          <span class="addr-label-pill">${escapeHtml(a.label)}</span>
          ${a.is_default ? `<span class="addr-default-pill">Default</span>` : ""}
        </div>
        <strong>${escapeHtml(a.full_name)}</strong>
        <div class="muted" style="font-size:.85rem">${escapeHtml(a.address_line)}</div>
        <div class="muted" style="font-size:.85rem">${escapeHtml(a.city)}, ${escapeHtml(a.province)}</div>
      </button>
    `).join("") + `
      <button type="button" class="addr-pick-card addr-pick-new" data-new="1">
        <div style="font-size:1.6rem">+</div>
        <strong>Use a new address</strong>
      </button>
    `;
    cards.querySelectorAll(".addr-pick-card").forEach(c => {
      c.onclick = () => {
        cards.querySelectorAll(".addr-pick-card").forEach(x => x.classList.remove("active"));
        c.classList.add("active");
        if (c.dataset.new) {
          activePickedAddrId = null;
          ["co-address", "co-region", "co-postal"].forEach(id => $("#" + id).value = "");
          buildProvinceDropdown("");
          buildCityDropdown("");
          refreshSaveCheckbox();
          recomputeTotals();
          return;
        }
        const a = savedAddresses.find(x => x.id === c.dataset.id);
        if (a) fillFromAddress(a);
      };
    });
    const defaultAddr = savedAddresses.find(a => a.is_default) || savedAddresses[0];
    fillFromAddress(defaultAddr);
    cards.querySelector(`.addr-pick-card[data-id="${defaultAddr.id}"]`)?.classList.add("active");
  }
  refreshSaveCheckbox();

  function renderItems() {
    const list = getCart();
    $("#co-items").innerHTML = list.map(i => `
      <div class="co-item">
        <img src="${i.img}" alt="">
        <div class="co-item-body">
          <div class="co-item-name">${escapeHtml(i.name)}</div>
          <div class="muted" style="font-size:.83rem">${i.qty} × ${peso(i.price)}</div>
        </div>
        <div class="co-item-total">${peso(i.price * i.qty)}</div>
      </div>
    `).join("");
  }

  function recomputeTotals() {
    const list     = getCart();
    const subtotal = list.reduce((s, i) => s + i.price * i.qty, 0);
    const regionKey = $("#co-region").value;
    const shipping  = getShippingFee(regionKey);
    $("#co-subtotal").textContent = peso(subtotal);
    $("#co-shipping").textContent = shipping == null ? "—" : peso(shipping);
    $("#co-total").textContent    = peso(subtotal + (shipping || 0));
  }

  renderItems();
  recomputeTotals();

  /* Cascading dropdown event listeners */
  $("#co-region").addEventListener("change", () => {
    buildProvinceDropdown($("#co-region").value);
    recomputeTotals();
  });
  $("#co-province").addEventListener("change", () => {
    buildCityDropdown($("#co-province").value);
  });
  $("#co-city").addEventListener("change", () => {
    const provinceKey = $("#co-province").value;
    const cityName    = $("#co-city").value;
    const cities      = PH_CITIES[provinceKey] || [];
    const cityData    = cities.find(c => c.name === cityName);
    $("#co-postal").value = cityData ? cityData.postal : "";
  });

  $("#checkout-form").addEventListener("submit", (e) => {
    e.preventDefault();
    setMsg("checkout-message", "");

    const list = getCart();
    if (!list.length) return setMsg("checkout-message", "Your cart is empty.");

    const region = $("#co-region").value;
    if (!region)                   return setMsg("checkout-message", "Please select your region.");
    if (!$("#co-province").value)  return setMsg("checkout-message", "Please select your province.");
    if (!$("#co-city").value)      return setMsg("checkout-message", "Please select your city / municipality.");

    const shipping_fee = getShippingFee(region);
    const subtotal     = list.reduce((s, i) => s + i.price * i.qty, 0);
    const total        = subtotal + shipping_fee;
    const payment_method = document.querySelector('input[name="co-pay"]:checked')?.value || "cod";

    const required = ["co-name", "co-phone", "co-address"];
    for (const id of required) {
      if (!$("#" + id).value.trim())
        return setMsg("checkout-message", "Please fill in all required fields.");
    }
    const phone = $("#co-phone").value.trim();
    if (!/^09[0-9]{9}$/.test(phone))
      return setMsg("checkout-message", "Phone number must be 11 digits and start with 09 (e.g. 09171234567).");

    /* Stock check before placing the order */
    for (const it of list) {
      const p = PRODUCTS.find(x => x.id === it.id);
      if (!p || p.stock < it.qty)
        return setMsg("checkout-message", "Sorry — one or more items just went out of stock. Please review your cart.");
    }

    const order = {
      id: uid(),
      created_at: new Date().toISOString(),
      status: "pending",
      subtotal, shipping_fee, total, payment_method,
      full_name:    $("#co-name").value.trim(),
      phone:        $("#co-phone").value.trim(),
      email:        $("#co-email").value.trim(),
      address_line: $("#co-address").value.trim(),
      city:         $("#co-city").value.trim(),
      province: (() => {
        const pKey = $("#co-province").value;
        const rKey = $("#co-region").value;
        const prov = (PH_PROVINCES[rKey] || []).find(p => p.key === pKey);
        return prov ? prov.label : pKey;
      })(),
      region,
      postal_code: $("#co-postal").value.trim(),
      notes:       $("#co-notes").value.trim(),
      items: list.map(i => ({
        product_id: i.id, name: i.name, img: stripBase(i.img),
        unit_price: i.price, qty: i.qty, line_total: i.price * i.qty,
      })),
    };

    /* Decrement product stock */
    const updated = PRODUCTS.map(p => ({ ...p, img: stripBase(p.img) }));
    for (const it of list) {
      const p = updated.find(x => x.id === it.id);
      if (p) p.stock = Math.max(0, p.stock - it.qty);
    }
    persistProducts(updated);

    /* Save order */
    const orders = readJSON(LS.ORDERS(u.id), []);
    orders.unshift(order);
    writeJSON(LS.ORDERS(u.id), orders);

    /* Optionally persist the delivery address */
    const wantsSave = $("#co-save-address")?.checked;
    if (wantsSave && !activePickedAddrId && savedAddresses.length < ADDR_LIMIT) {
      const all = fetchUserAddresses();
      all.push({
        id:           uid(),
        label:        all.length === 0 ? "Home" : "Other",
        full_name:    order.full_name,
        phone:        order.phone,
        address_line: order.address_line,
        city:         order.city,
        province:     $("#co-province").value,
        region:       order.region,
        postal_code:  order.postal_code || "",
        is_default:   all.length === 0,
        created_at:   new Date().toISOString(),
      });
      saveUserAddresses(all);
    }

    setCart([]);
    location.href = pagePath("orders.html") + `?id=${order.id}&new=1`;
  });
}

/* =========================================================
   16. ORDERS — orders.html
   ========================================================= */
function statusPill(status) {
  return `<span class="status-pill status-${status}">${STATUS_LABELS[status] || status}</span>`;
}

function bindOrders() {
  const host = $("#orders-content");
  if (!host) return;

  const u = currentUser();
  if (!u) { location.href = pagePath("login.html"); return; }

  setVisibleState({ loading: "orders-loading", ok: host }, "ok");

  const params  = new URLSearchParams(location.search);
  const orderId = params.get("id");
  const isNew   = params.get("new") === "1";

  if (orderId) return renderOrderDetail(host, orderId, isNew, u);
  return renderOrderList(host, u);
}

function renderOrderList(host, u) {
  const data = readJSON(LS.ORDERS(u.id), []);
  if (!data.length) {
    host.innerHTML = emptyState("📦", "No orders yet",
      "When you place your first order, it'll show up here.",
      ["Start Shopping", "products.html"]);
    return;
  }
  host.innerHTML = `
    <div class="orders-list">
      ${data.map(o => {
        const itemCount = (o.items || []).reduce((s, x) => s + (x.qty || 0), 0);
        const date      = new Date(o.created_at).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });
        return `
          <a class="order-card" href="orders.html?id=${o.id}">
            <div class="order-card-head">
              <div>
                <div class="order-id">Order #${o.id.slice(0, 8)}</div>
                <div class="muted" style="font-size:.83rem">${date}</div>
              </div>
              ${statusPill(o.status)}
            </div>
            <div class="order-card-body">
              <span>${itemCount} item${itemCount === 1 ? "" : "s"} · ${PAYMENT_LABELS[o.payment_method] || o.payment_method}</span>
              <strong>${peso(o.total)}</strong>
            </div>
          </a>
        `;
      }).join("")}
    </div>`;
}

function renderOrderDetail(host, orderId, isNew, u) {
  const order = readJSON(LS.ORDERS(u.id), []).find(o => o.id === orderId);
  if (!order) {
    host.innerHTML = emptyState("🔍", "Order not found",
      "We couldn't find that order on your account.",
      ["Back to My Orders", "orders.html"]);
    return;
  }
  const items  = order.items || [];
  const date   = new Date(order.created_at).toLocaleString("en-PH", { dateStyle: "long", timeStyle: "short" });
  const banner = isNew ? `
    <div class="thank-banner">
      <div class="icon">🎉</div>
      <div>
        <h2 style="margin:0">Thank you for your order!</h2>
        <p class="muted" style="margin:4px 0 0">We've received your order and will contact you shortly to confirm delivery.</p>
      </div>
    </div>` : "";

  host.innerHTML = `
    ${banner}
    <div class="order-detail">
      <div class="account-card">
        <div class="account-head">
          <div>
            <h2 style="margin:0">Order <em>#${order.id.slice(0, 8)}</em></h2>
            <div class="muted" style="font-size:.88rem">Placed ${date}</div>
          </div>
          ${statusPill(order.status)}
        </div>

        <div class="order-items">
          ${items.map(it => `
            <div class="co-item">
              <img src="${resolveImg(it.img)}" alt="">
              <div class="co-item-body">
                <div class="co-item-name">${escapeHtml(it.name)}</div>
                <div class="muted" style="font-size:.83rem">${it.qty} × ${peso(it.unit_price)}</div>
              </div>
              <div class="co-item-total">${peso(it.line_total)}</div>
            </div>
          `).join("")}
        </div>

        <hr style="border:0;border-top:1px solid var(--line,#eee);margin:14px 0">
        <div class="co-row"><span>Subtotal</span><span>${peso(order.subtotal)}</span></div>
        <div class="co-row"><span>Shipping</span><span>${peso(order.shipping_fee)}</span></div>
        <div class="co-row co-total"><span>Total</span><span>${peso(order.total)}</span></div>
      </div>

      <aside class="account-card">
        <h2>Delivery <em>Details</em></h2>
        <p style="margin:0">
          <strong>${escapeHtml(order.full_name)}</strong><br>
          ${escapeHtml(order.phone)}${order.email ? `<br>${escapeHtml(order.email)}` : ""}
        </p>
        <p class="muted" style="margin:10px 0 0">
          ${escapeHtml(order.address_line)}<br>
          ${escapeHtml(order.city)}, ${escapeHtml(order.province)}<br>
          ${escapeHtml(getRegionLabel(order.region))}${order.postal_code ? ` · ${escapeHtml(order.postal_code)}` : ""}
        </p>
        ${order.notes ? `<p class="muted" style="margin-top:10px"><strong>Notes:</strong> ${escapeHtml(order.notes)}</p>` : ""}

        <h2 style="margin-top:18px">Payment</h2>
        <p style="margin:0">${escapeHtml(PAYMENT_LABELS[order.payment_method] || order.payment_method)}</p>

        <a href="orders.html" class="btn btn-outline btn-block" style="margin-top:18px">All My Orders</a>
        <a href="products.html" class="btn btn-block" style="margin-top:10px">Continue Shopping</a>
      </aside>
    </div>
  `;
}

/* =========================================================
   17. INIT
   ========================================================= */
document.addEventListener("DOMContentLoaded", () => {
  buildHeader();
  buildFooter();
  buildOverlays();
  renderCart();
  renderFeatured();
  renderProducts();
  renderProductDetail();
  setupReveal();
  wireEvents();
  bindRegister();
  bindLogin();
  bindPasswordToggles();
  loadAccount();
  updateAuthUI();
  bindCheckout();
  bindOrders();
  bindAddresses();
});
