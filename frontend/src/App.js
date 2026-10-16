import { useEffect, useMemo, useState } from "react";
import "@/App.css";
import "@/product-settings.css";
import axios from "axios";
import { Check, ChevronDown, ClipboardList, Coffee, Download, LayoutGrid, Lock, LogOut, Plus, RefreshCw, Settings, ShoppingBag, Store, Trash2, X } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const api = axios.create({ baseURL: API, withCredentials: true });
const money = (value) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value || 0);
const types = [
  { id: "dine in", label: "Dine in" },
  { id: "take away", label: "Take away" },
  { id: "shopeefood", label: "ShopeeFood" },
  { id: "gofood", label: "GoFood" },
  { id: "grabfood", label: "GrabFood" },
  { id: "voucher", label: "Voucher" },
];
const ONLINE = ["shopeefood", "gofood", "grabfood"];
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem("housebakery_token")}` });

function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post("/auth/login", { username, password });
      localStorage.setItem("housebakery_token", data.token);
      onLogin(data);
    } catch (err) { setError(err.response?.data?.detail || "Login gagal"); }
  };
  return (
    <main className="login-page">
      <div className="login-panel">
        <div className="brand-mark">hb</div>
        <p className="eyebrow">HOUSEBAKERY POS</p>
        <h1>Selamat datang<br /><em>kembali.</em></h1>
        <p className="muted">Masuk untuk mengelola pesanan dan penjualan hari ini.</p>
        <form onSubmit={submit}>
          <label>Username<input data-testid="login-username-input" value={username} onChange={e => setUsername(e.target.value)} placeholder="admin" /></label>
          <label>Password<input data-testid="login-password-input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••" /></label>
          {error && <div className="error" data-testid="login-error">{error}</div>}
          <button data-testid="login-submit-button" className="primary wide">Masuk ke POS <span>→</span></button>
        </form>
        <small>Username dan password awal: admin</small>
      </div>
      <div className="login-art">
        <div className="art-copy"><span>Freshly baked</span><strong>Every day<br />starts here.</strong></div>
        <div className="bread-shape">⌁</div>
      </div>
    </main>
  );
}

function App() {
  const [user, setUser] = useState(null);
  useEffect(() => {
    const token = localStorage.getItem("housebakery_token");
    if (token) api.get("/auth/me", { headers: { Authorization: `Bearer ${token}` } }).then(r => setUser(r.data)).catch(() => localStorage.removeItem("housebakery_token"));
  }, []);
  const logout = () => { localStorage.removeItem("housebakery_token"); api.post("/auth/logout"); setUser(null); };
  return user ? <POS user={user} onLogout={logout} /> : <Login onLogin={setUser} />;
}

function POS({ onLogout }) {
  const [page, setPage] = useState("pos");
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [channel, setChannel] = useState("dine in");
  const [cart, setCart] = useState([]);
  const [customer, setCustomer] = useState("");
  const [showPayment, setShowPayment] = useState(false);
  const [success, setSuccess] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: "", price: "" });
  const [report, setReport] = useState(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [settingsUnlocked, setSettingsUnlocked] = useState(false);

  const load = () => {
    api.get("/products", { headers: authHeaders() }).then(r => setProducts(r.data));
    api.get("/orders", { headers: authHeaders() }).then(r => setOrders(r.data));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const total = useMemo(() => cart.reduce((s, p) => s + p.price * p.qty, 0), [cart]);
  const add = p => setCart(c => c.find(x => x.id === p.id) ? c.map(x => x.id === p.id ? { ...x, qty: x.qty + 1 } : x) : [...c, { ...p, qty: 1 }]);

  const submitOrder = async (payload) => {
    try {
      await api.post("/orders", {
        customer_name: customer || "Walk-in",
        order_type: channel,
        items: cart.map(({ id: product_id, name, price, qty }) => ({ product_id, name, price, qty })),
        ...payload,
      }, { headers: authHeaders() });
      setCart([]); setCustomer(""); setShowPayment(false); setSuccess(true); load();
    } catch (e) { alert(e.response?.data?.detail || "Pembayaran belum valid"); }
  };

  useEffect(() => {
    if (page === "report") api.get(`/reports?date=${date}`, { headers: authHeaders() }).then(r => setReport(r.data));
  }, [page, date]);

  useEffect(() => { if (page !== "settings") setSettingsUnlocked(false); }, [page]);

  const openSettings = () => setPage("settings");
  const completedOrders = orders.filter(o => o.status === "done");
  const pendingCount = orders.filter(o => o.status === "new").length;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="logo"><span>hb</span><b>housebakery</b><small>point of sale</small></div>
        <nav>
          <button className={page === "pos" ? "active" : ""} onClick={() => setPage("pos")} data-testid="nav-pos"><LayoutGrid /> POS</button>
          <button className={page === "kds" ? "active" : ""} onClick={() => setPage("kds")} data-testid="nav-kds"><ClipboardList /> KDS <i>{pendingCount}</i></button>
          <button className={page === "transactions" ? "active" : ""} onClick={() => setPage("transactions")} data-testid="nav-transactions"><ShoppingBag /> Transactions</button>
          <button className={page === "report" ? "active" : ""} onClick={() => setPage("report")} data-testid="nav-report"><Store /> Report</button>
          <button className={page === "settings" ? "active" : ""} onClick={openSettings} data-testid="nav-settings"><Settings /> Settings</button>
        </nav>
        <button className="logout" onClick={onLogout} data-testid="logout-button"><LogOut /> Keluar</button>
      </aside>
      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">{page === "pos" ? "ORDER DESK" : page.toUpperCase()}</p>
            <h2>{page === "pos" ? "Buat pesanan baru" : page === "kds" ? "Kitchen display" : page === "settings" ? "Pengaturan" : page === "report" ? "Ringkasan penjualan" : "Riwayat transaksi"}</h2>
          </div>
          <div className="top-date"><span className="status-dot" /> Toko buka <strong>{new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}</strong></div>
        </header>

        {page === "pos" && (
          <div className="pos-grid">
            <section className="order-side">
              <div className="section-heading">
                <div><p className="eyebrow">PESANAN</p><h3>Detail order</h3></div>
                <span className="order-number">#{String(orders.length).padStart(4, "0")}</span>
              </div>
              <input className="customer-input" data-testid="customer-name-input" placeholder="Nama customer (opsional)" value={customer} onChange={e => setCustomer(e.target.value)} />
              <div className="channel-list">
                {types.map(t => (
                  <button key={t.id} className={channel === t.id ? "selected" : ""} onClick={() => setChannel(t.id)} data-testid={`order-type-${t.id.replaceAll(" ", "-")}`}>
                    {t.label}<ChevronDown size={15} />
                  </button>
                ))}
              </div>
              <div className="cart-list">
                {cart.length ? cart.map(p => (
                  <div className="cart-row" key={p.id}>
                    <div><strong>{p.name}</strong><small>{money(p.price)} × {p.qty}</small></div>
                    <div className="qty">
                      <button onClick={() => setCart(c => c.map(x => x.id === p.id ? { ...x, qty: Math.max(0, x.qty - 1) } : x).filter(x => x.qty))} data-testid={`decrease-${p.id}`}>−</button>
                      <b>{p.qty}</b>
                      <button onClick={() => add(p)} data-testid={`increase-${p.id}`}>+</button>
                    </div>
                    <strong>{money(p.price * p.qty)}</strong>
                  </div>
                )) : (
                  <div className="empty-cart"><Coffee size={30} /><p>Belum ada produk</p><small>Pilih menu di sebelah kanan untuk memulai order</small></div>
                )}
              </div>
              <div className="order-total">
                <span>Total order <small>{cart.reduce((s, p) => s + p.qty, 0)} item</small></span>
                <strong>{money(total)}</strong>
              </div>
              <button className="primary wide submit-order" disabled={!cart.length} onClick={() => setShowPayment(true)} data-testid="submit-order-button">Lanjut ke pembayaran <span>→</span></button>
            </section>
            <section className="product-side">
              <div className="section-heading">
                <div><p className="eyebrow">MENU HARI INI</p><h3>Pilih produk</h3></div>
                <button className="icon-btn" onClick={load} data-testid="sync-products-button"><RefreshCw size={17} /></button>
              </div>
              <div className="product-grid">
                {products.map(p => (
                  <button className="product-card" key={p.id} onClick={() => add(p)} data-testid={`product-${p.id}`}>
                    <span className="product-icon">✦</span>
                    <strong>{p.name}</strong>
                    <small>{money(p.price)}</small>
                    <span className="add-product"><Plus size={16} /></span>
                  </button>
                ))}
              </div>
            </section>
          </div>
        )}

        {page === "kds" && <KDS orders={orders} complete={async id => { await api.patch(`/orders/${id}/done`, {}, { headers: authHeaders() }); load(); }} />}
        {page === "transactions" && <Transactions orders={completedOrders} reload={load} />}
        {page === "report" && <Report report={report} date={date} setDate={setDate} />}
        {page === "settings" && (settingsUnlocked
          ? <SettingsPage product={newProduct} setProduct={setNewProduct} save={async e => { e.preventDefault(); await api.post("/products", { name: newProduct.name, price: Number(newProduct.price) }, { headers: authHeaders() }); setNewProduct({ name: "", price: "" }); load(); }} products={products} sync={load} />
          : <PinGate title="Buka Pengaturan" description="Masukkan PIN untuk mengelola produk." onUnlocked={() => setSettingsUnlocked(true)} testIdPrefix="settings" />
        )}
      </main>

      {showPayment && <Payment channel={channel} total={total} close={() => setShowPayment(false)} submit={submitOrder} />}
      {success && (
        <div className="success-overlay">
          <div className="success-box">
            <div className="check"><Check /></div>
            <h2>Pesanan telah dibuat</h2>
            <p>Order berhasil dicatat dan masuk ke dapur.</p>
            <button className="primary" onClick={() => setSuccess(false)} data-testid="success-close-button">Buat pesanan baru</button>
          </div>
        </div>
      )}
    </div>
  );
}

const KDS = ({ orders, complete }) => (
  <div className="content-grid">
    {orders.filter(o => o.status === "new").map(o => (
      <article className="ticket" key={o.id}>
        <div className="ticket-top"><span>ORDER #{o.id}</span><b>{o.order_type}</b></div>
        <h3>{o.customer_name}</h3>
        {o.items.map(i => <div className="ticket-item" key={i.product_id}><b>{i.qty}×</b> {i.name}</div>)}
        <button className="done-btn" onClick={() => complete(o.id)} data-testid={`kds-done-${o.id}`}><Check size={16} /> Tandai selesai</button>
      </article>
    ))}
    {!orders.some(o => o.status === "new") && <Empty title="Semua order sudah selesai" text="Pesanan baru dari kasir akan muncul di sini." />}
  </div>
);

function Transactions({ orders, reload }) {
  const [selected, setSelected] = useState(new Set());
  const [pinModal, setPinModal] = useState(null); // null | "all" | "selected"

  const toggle = id => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const toggleAll = () => setSelected(selected.size === orders.length ? new Set() : new Set(orders.map(o => o.id)));

  const download = () => api.get("/orders.csv", { headers: authHeaders(), responseType: "blob" }).then(r => {
    const url = URL.createObjectURL(r.data);
    const a = document.createElement("a");
    a.href = url; a.download = "housebakery-transactions.csv"; a.click();
  });

  const confirmDelete = async (pin) => {
    const body = pinModal === "all" ? { pin, ids: null } : { pin, ids: Array.from(selected) };
    await api.post("/orders/delete", body, { headers: authHeaders() });
    setSelected(new Set());
    setPinModal(null);
    reload();
  };

  const paymentLabel = o => o.payment_method === "split" ? `split (cash ${money(o.cash_amount)} + qris ${money(o.qris_amount)})` : o.payment_method;

  return (
    <div className="table-wrap">
      <div className="toolbar">
        <p>{orders.length} transaksi selesai</p>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="outline-btn" disabled={!selected.size} onClick={() => setPinModal("selected")} data-testid="remove-selected-button"><Trash2 size={15} /> Hapus terpilih ({selected.size})</button>
          <button className="outline-btn danger" disabled={!orders.length} onClick={() => setPinModal("all")} data-testid="remove-all-button"><Trash2 size={15} /> Hapus semua</button>
          <button className="outline-btn" onClick={download} data-testid="download-csv-button"><Download size={16} /> Unduh CSV</button>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th style={{ width: 36 }}><input type="checkbox" checked={orders.length > 0 && selected.size === orders.length} onChange={toggleAll} data-testid="transactions-select-all" /></th>
            <th>ID Order</th><th>Customer</th><th>Pembayaran</th><th>Produk</th><th>Total</th><th>Status</th>
          </tr>
        </thead>
        <tbody>
          {orders.map(o => (
            <tr key={o.id} data-testid={`transaction-row-${o.id}`}>
              <td><input type="checkbox" checked={selected.has(o.id)} onChange={() => toggle(o.id)} data-testid={`select-order-${o.id}`} /></td>
              <td><b>#{o.id}</b></td>
              <td>{o.customer_name}</td>
              <td>{paymentLabel(o)}</td>
              <td>{o.items.map(i => `${i.name} ×${i.qty}`).join(", ")}</td>
              <td><b>{money(o.total)}</b></td>
              <td><span className="pill">{o.status}</span></td>
            </tr>
          ))}
          {!orders.length && (
            <tr><td colSpan={7} style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>Belum ada transaksi selesai. Order akan muncul setelah ditandai selesai di KDS.</td></tr>
          )}
        </tbody>
      </table>
      {pinModal && (
        <PinModal
          title={pinModal === "all" ? "Konfirmasi hapus semua" : `Hapus ${selected.size} transaksi`}
          description="Masukkan PIN untuk menghapus. Transaksi yang dihapus tidak akan muncul di CSV."
          onCancel={() => setPinModal(null)}
          onSubmit={confirmDelete}
          testIdPrefix="transactions"
        />
      )}
    </div>
  );
}

const Report = ({ report, date, setDate }) => (
  <div className="report-page">
    <div className="report-filter">
      <label>Pilih tanggal<input type="date" value={date} onChange={e => setDate(e.target.value)} data-testid="report-date-input" /></label>
    </div>
    <div className="stats">
      <div><small>ORDER SELESAI</small><strong>{report?.orders || 0}</strong></div>
      <div><small>PENDAPATAN</small><strong>{money(report?.total)}</strong></div>
    </div>
    <div className="table-wrap">
      <div className="toolbar"><h3>Produk terjual</h3><span>{date}</span></div>
      <table>
        <thead><tr><th>Produk</th><th>Qty terjual</th></tr></thead>
        <tbody>{report?.products?.map(p => <tr key={p.name}><td>{p.name}</td><td><b>{p.qty}</b></td></tr>)}</tbody>
      </table>
    </div>
  </div>
);

function SettingsPage({ product, setProduct, save, products, sync }) {
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState({ name: "", price: "" });
  const startEdit = p => { setEditing(p.id); setDraft({ name: p.name, price: p.price }); };
  const update = async e => {
    e.preventDefault();
    await api.put(`/products/${editing}`, { name: draft.name, price: Number(draft.price) }, { headers: authHeaders() });
    setEditing(null); sync();
  };
  const remove = async p => {
    if (window.confirm(`Hapus ${p.name} dari menu aktif?`)) {
      await api.delete(`/products/${p.id}`, { headers: authHeaders() });
      sync();
    }
  };
  return (
    <div className="settings-page">
      <section className="settings-form">
        <div className="section-heading">
          <div><p className="eyebrow">CATALOG</p><h3>New product</h3></div>
          <button className="outline-btn" onClick={sync} data-testid="settings-sync-button"><RefreshCw size={16} /> Sync menu</button>
        </div>
        <p className="muted">Tambah produk baru agar langsung tersedia di order desk.</p>
        <form onSubmit={save}>
          <label>Nama produk<input required value={product.name} onChange={e => setProduct({ ...product, name: e.target.value })} placeholder="Butter croissant" data-testid="new-product-name-input" /></label>
          <label>Harga jual<input required type="number" min="0" value={product.price} onChange={e => setProduct({ ...product, price: e.target.value })} placeholder="25000" data-testid="new-product-price-input" /></label>
          <button className="primary" data-testid="save-product-button"><Plus size={17} /> Simpan produk</button>
        </form>
      </section>
      <section className="catalog-list">
        <div className="section-heading"><div><p className="eyebrow">ACTIVE MENU</p><h3>{products.length} produk aktif</h3></div></div>
        {products.map(p => editing === p.id ? (
          <form className="catalog-edit" key={p.id} onSubmit={update}>
            <input required value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} data-testid={`edit-product-name-${p.id}`} />
            <input required type="number" min="0" value={draft.price} onChange={e => setDraft({ ...draft, price: e.target.value })} data-testid={`edit-product-price-${p.id}`} />
            <button className="save-mini" data-testid={`save-edit-product-${p.id}`}><Check size={15} /></button>
            <button type="button" className="cancel-mini" onClick={() => setEditing(null)} data-testid={`cancel-edit-product-${p.id}`}><X size={15} /></button>
          </form>
        ) : (
          <div className="catalog-row" key={p.id}>
            <span>✦</span>
            <b>{p.name}</b>
            <strong>{money(p.price)}</strong>
            <button className="edit-mini" onClick={() => startEdit(p)} data-testid={`edit-product-${p.id}`}>Edit</button>
            <button className="remove-mini" onClick={() => remove(p)} data-testid={`remove-product-${p.id}`}><X size={15} /></button>
          </div>
        ))}
      </section>
    </div>
  );
}

function Payment({ channel, total, close, submit }) {
  const online = ONLINE.includes(channel);
  const voucher = channel === "voucher";
  const [mode, setMode] = useState("cash"); // cash | qris | split
  const [paid, setPaid] = useState("");
  const [cashAmount, setCashAmount] = useState("");
  const [qrisAmount, setQrisAmount] = useState("");

  const splitSum = (Number(cashAmount) || 0) + (Number(qrisAmount) || 0);
  const paidNum = Number(paid) || 0;

  let canConfirm, payload;
  if (online) {
    canConfirm = paidNum >= total;
    payload = { payment_method: channel, paid_amount: paidNum };
  } else if (voucher) {
    canConfirm = paidNum >= total;
    payload = { payment_method: "voucher", paid_amount: paidNum };
  } else if (mode === "split") {
    canConfirm = (Number(cashAmount) > 0) && (Number(qrisAmount) > 0) && splitSum >= total;
    payload = { payment_method: "split", paid_amount: splitSum, cash_amount: Number(cashAmount), qris_amount: Number(qrisAmount) };
  } else {
    canConfirm = paidNum >= total;
    payload = { payment_method: mode, paid_amount: paidNum };
  }

  const change = online || voucher || mode !== "split" ? paidNum - total : splitSum - total;

  return (
    <div className="modal-backdrop">
      <div className="payment-modal">
        <button className="close" onClick={close} data-testid="close-payment-button"><X /></button>
        <p className="eyebrow">CHECKOUT</p>
        <h2>Selesaikan pembayaran</h2>
        <div className="payment-summary"><span>Total yang harus dibayar</span><strong>{money(total)}</strong></div>

        {online ? (
          <>
            <div className="payment-choice fixed"><span>●</span><b>{channel}</b><small>Pembayaran melalui order aplikasi</small></div>
            <label>Nominal {channel}<input autoFocus type="number" value={paid} onChange={e => setPaid(e.target.value)} placeholder={String(total)} data-testid="payment-amount-input" /></label>
          </>
        ) : voucher ? (
          <>
            <div className="payment-choice fixed"><span>●</span><b>voucher</b><small>Pembayaran menggunakan voucher</small></div>
            <label>Nominal voucher<input autoFocus type="number" value={paid} onChange={e => setPaid(e.target.value)} placeholder={String(total)} data-testid="payment-amount-input" /></label>
          </>
        ) : (
          <>
            <div className="payment-options three">
              {[
                { k: "cash", icon: "Rp", label: "CASH" },
                { k: "qris", icon: "▦", label: "QRIS" },
                { k: "split", icon: "⇄", label: "SPLIT" },
              ].map(m => (
                <button className={mode === m.k ? "chosen" : ""} key={m.k} onClick={() => setMode(m.k)} data-testid={`payment-${m.k}-option`}>
                  <span>{m.icon}</span><b>{m.label}</b>
                </button>
              ))}
            </div>
            {mode === "split" ? (
              <>
                <label>Nominal cash<input autoFocus type="number" value={cashAmount} onChange={e => setCashAmount(e.target.value)} placeholder="5000" data-testid="payment-cash-amount-input" /></label>
                <label>Nominal QRIS<input type="number" value={qrisAmount} onChange={e => setQrisAmount(e.target.value)} placeholder="15000" data-testid="payment-qris-amount-input" /></label>
                <div className="split-sum" data-testid="payment-split-sum">Total diterima <b>{money(splitSum)}</b></div>
              </>
            ) : (
              <label>Nominal diterima<input autoFocus type="number" value={paid} onChange={e => setPaid(e.target.value)} placeholder={String(total)} data-testid="payment-amount-input" /></label>
            )}
          </>
        )}

        {canConfirm && change > 0 && <div className="change">Kembalian <b>{money(change)}</b></div>}
        <button className="primary wide" disabled={!canConfirm} onClick={() => submit(payload)} data-testid="confirm-payment-button">Konfirmasi pembayaran <span>→</span></button>
      </div>
    </div>
  );
}

function PinModal({ title, description, onCancel, onSubmit, testIdPrefix = "pin" }) {
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    try { await onSubmit(pin); } catch (e2) { setErr(e2.response?.data?.detail || "PIN salah"); }
  };
  return (
    <div className="modal-backdrop">
      <form className="payment-modal pin-modal" onSubmit={submit}>
        <button type="button" className="close" onClick={onCancel} data-testid={`${testIdPrefix}-pin-cancel`}><X /></button>
        <p className="eyebrow">AUTENTIKASI</p>
        <h2>{title}</h2>
        <p className="muted" style={{ marginTop: -8 }}>{description}</p>
        <label>PIN
          <input autoFocus type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={e => { setPin(e.target.value); setErr(""); }} placeholder="••••" data-testid={`${testIdPrefix}-pin-input`} />
        </label>
        {err && <div className="error" data-testid={`${testIdPrefix}-pin-error`}>{err}</div>}
        <button className="primary wide" data-testid={`${testIdPrefix}-pin-submit`}><Lock size={15} /> Konfirmasi</button>
      </form>
    </div>
  );
}

function PinGate({ title, description, onUnlocked, testIdPrefix }) {
  const [err, setErr] = useState("");
  const submit = async (pin) => {
    try {
      await api.post("/auth/verify-pin", { pin }, { headers: authHeaders() });
      onUnlocked();
    } catch (e) {
      setErr(e.response?.data?.detail || "PIN salah");
      throw e;
    }
  };
  return (
    <div className="pin-gate">
      <div className="pin-gate-box">
        <div className="pin-lock"><Lock size={22} /></div>
        <h2>{title}</h2>
        <p className="muted">{description}</p>
        <PinInline onSubmit={submit} testIdPrefix={testIdPrefix} />
        {err && <div className="error" data-testid={`${testIdPrefix}-pin-error`}>{err}</div>}
      </div>
    </div>
  );
}

function PinInline({ onSubmit, testIdPrefix }) {
  const [pin, setPin] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    try { await onSubmit(pin); } catch { setPin(""); }
  };
  return (
    <form onSubmit={submit} className="pin-inline">
      <input autoFocus type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={e => setPin(e.target.value)} placeholder="••••" data-testid={`${testIdPrefix}-pin-input`} />
      <button className="primary" data-testid={`${testIdPrefix}-pin-submit`}>Buka</button>
    </form>
  );
}

const Empty = ({ title, text }) => <div className="empty-state"><ClipboardList size={32} /><h3>{title}</h3><p>{text}</p></div>;
export default App;
