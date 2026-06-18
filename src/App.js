import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase";

// ─── UTILITIES ────────────────────────────────────────────────────────────────
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6).toUpperCase();
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "-";
const fmtMoney = (n) => "Rp " + Number(n || 0).toLocaleString("id-ID");
const today = () => new Date().toISOString().slice(0, 10);

// ─── PRINT SURAT JALAN ────────────────────────────────────────────────────────
function printSuratJalan(order, products, outlets) {
  const outlet = outlets.find(o => o.id === order.outlet_id) || {};
  const rows = (order.order_items || []).map((item, idx) => {
    const p = products.find(x => x.id === item.product_id) || {};
    return `<tr>
      <td style="border:1px solid #ccc;padding:8px;text-align:center">${idx + 1}</td>
      <td style="border:1px solid #ccc;padding:8px">${p.name || "-"}</td>
      <td style="border:1px solid #ccc;padding:8px;text-align:center">${p.unit || "-"}</td>
      <td style="border:1px solid #ccc;padding:8px;text-align:center">${item.qty}</td>
      <td style="border:1px solid #ccc;padding:8px"></td>
    </tr>`;
  }).join("");
  const emptyRows = Array(Math.max(0, 5 - (order.order_items || []).length))
    .fill(`<tr><td style="border:1px solid #ccc;padding:12px">&nbsp;</td><td style="border:1px solid #ccc"></td><td style="border:1px solid #ccc"></td><td style="border:1px solid #ccc"></td><td style="border:1px solid #ccc"></td></tr>`)
    .join("");

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Surat Jalan ${order.order_no}</title>
<style>
  @page{margin:20mm} body{font-family:Arial,sans-serif;font-size:12px;color:#111}
  h1{font-size:20px;margin:0;letter-spacing:2px} .sub{font-size:11px;color:#555}
  table{width:100%;border-collapse:collapse;margin-top:12px}
  th{background:#1a1a2e;color:#fff;padding:8px;text-align:center;border:1px solid #ccc;font-size:11px}
  .ttd{display:flex;justify-content:space-between;margin-top:48px}
  .ttd-box{text-align:center;width:160px}
  .ttd-line{border-top:1px solid #333;margin-top:60px;padding-top:4px;font-size:11px}
  @media print{button{display:none}}
</style></head><body>
<div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1a1a2e;padding-bottom:12px;margin-bottom:12px">
  <div><h1>LAPISLAPIS</h1><div class="sub">Kemayoran, Jakarta Pusat</div></div>
  <div style="text-align:right">
    <div style="font-size:18px;font-weight:bold;color:#1a1a2e">SURAT JALAN</div>
    <div style="font-size:14px;font-weight:bold;margin-top:4px">${order.order_no}</div>
  </div>
</div>
<table style="border:none;margin-bottom:4px">
  <tr><td style="padding:3px 0;width:50%"><b>Tujuan</b> : ${outlet.name || "-"}</td><td style="padding:3px 0"><b>Tanggal</b> : ${fmtDate(order.delivery_date)}</td></tr>
  <tr><td style="padding:3px 0"><b>Alamat</b> : ${outlet.address || "-"}</td><td style="padding:3px 0"><b>No. Order</b> : ${order.order_no}</td></tr>
  <tr><td style="padding:3px 0"><b>Dikirim oleh</b> : ________________</td><td style="padding:3px 0"><b>Kendaraan</b> : ________________</td></tr>
</table>
<table><thead><tr>
  <th style="width:40px">No.</th><th>Nama Produk</th><th style="width:70px">Satuan</th><th style="width:70px">Qty</th><th style="width:80px">Keterangan</th>
</tr></thead><tbody>${rows}${emptyRows}</tbody></table>
<div style="margin-top:10px;font-size:11px;color:#555">Catatan: ${order.notes || "-"}</div>
<div class="ttd">
  <div class="ttd-box"><div class="ttd-line">Dibuat oleh<br>(Tim Produksi)</div></div>
  <div class="ttd-box"><div class="ttd-line">Pengirim</div></div>
  <div class="ttd-box"><div class="ttd-line">Diterima oleh<br>(${outlet.name || "Outlet"})</div></div>
</div>
<script>window.onload=()=>window.print();</script>
</body></html>`;
  const w = window.open("", "_blank");
  w.document.write(html);
  w.document.close();
}

// ─── STATUS BADGE ─────────────────────────────────────────────────────────────
const STATUS = {
  pending:   { bg: "#fef3c7", text: "#92400e", label: "Pending" },
  confirmed: { bg: "#dbeafe", text: "#1e40af", label: "Dikonfirmasi" },
  packed:    { bg: "#ede9fe", text: "#5b21b6", label: "Dipacking" },
  delivered: { bg: "#d1fae5", text: "#065f46", label: "Terkirim" },
  cancelled: { bg: "#fee2e2", text: "#991b1b", label: "Dibatalkan" },
};
const StatusBadge = ({ status }) => {
  const c = STATUS[status] || { bg: "#f3f4f6", text: "#374151", label: status };
  return <span style={{ background: c.bg, color: c.text, padding: "2px 10px", borderRadius: 99, fontSize: 11, fontWeight: 700 }}>{c.label}</span>;
};

// ─── TOAST ────────────────────────────────────────────────────────────────────
function Toast({ msg }) {
  if (!msg) return null;
  const isErr = msg.startsWith("❌");
  return (
    <div style={{ position: "fixed", top: 20, right: 20, zIndex: 9999, background: isErr ? "#fee2e2" : "#d1fae5", color: isErr ? "#991b1b" : "#065f46", padding: "12px 20px", borderRadius: 10, fontWeight: 600, fontSize: 13, boxShadow: "0 4px 12px rgba(0,0,0,.15)" }}>
      {msg}
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [products, setProducts] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [stockIn, setStockIn] = useState([]);
  const [stockOut, setStockOut] = useState([]);
  const [returns, setReturns] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(""), 3000); };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [p, o, si, so, r, ord] = await Promise.all([
      supabase.from("products").select("*").order("name"),
      supabase.from("outlets").select("*").order("name"),
      supabase.from("stock_in").select("*").order("created_at", { ascending: false }),
      supabase.from("stock_out").select("*").order("created_at", { ascending: false }),
      supabase.from("returns").select("*").order("created_at", { ascending: false }),
      supabase.from("orders").select("*, order_items(*)").order("created_at", { ascending: false }),
    ]);
    if (p.data) setProducts(p.data);
    if (o.data) setOutlets(o.data);
    if (si.data) setStockIn(si.data);
    if (so.data) setStockOut(so.data);
    if (r.data) setReturns(r.data);
    if (ord.data) setOrders(ord.data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Realtime subscription
  useEffect(() => {
    const channels = ["products", "outlets", "stock_in", "stock_out", "returns", "orders", "order_items"].map(table =>
      supabase.channel(`rt-${table}`).on("postgres_changes", { event: "*", schema: "public", table }, () => fetchAll()).subscribe()
    );
    return () => channels.forEach(c => supabase.removeChannel(c));
  }, [fetchAll]);

  // Computed stock
  const currentStock = products.reduce((acc, p) => {
    const totalIn = stockIn.filter(x => x.product_id === p.id).reduce((s, x) => s + Number(x.qty), 0);
    const totalOut = stockOut.filter(x => x.product_id === p.id).reduce((s, x) => s + Number(x.qty), 0);
    const totalRetur = returns.filter(x => x.product_id === p.id).reduce((s, x) => s + Number(x.qty), 0);
    const orderOut = orders.filter(o => o.status === "delivered")
      .flatMap(o => o.order_items || []).filter(i => i.product_id === p.id)
      .reduce((s, i) => s + Number(i.qty), 0);
    acc[p.id] = totalIn + totalRetur - totalOut - orderOut;
    return acc;
  }, {});

  const TABS = [
    { id: "dashboard", label: "📊 Dashboard" },
    { id: "stock", label: "📦 Stok" },
    { id: "orders", label: "🛒 Order Sales" },
    { id: "suratjalan", label: "🚚 Surat Jalan" },
    { id: "products", label: "🍰 Produk" },
    { id: "outlets", label: "🏪 Outlet" },
  ];

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#1a1a2e", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
      <div style={{ fontSize: 48 }}>🍰</div>
      <div style={{ color: "#fff", fontFamily: "Inter, sans-serif", fontSize: 18, fontWeight: 700, letterSpacing: 2 }}>LAPISLAPIS</div>
      <div style={{ color: "#94a3b8", fontFamily: "Inter, sans-serif", fontSize: 13 }}>Menghubungkan ke database...</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f8f7f4", fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
      <Toast msg={toast} />

      {/* HEADER */}
      <div style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)", color: "#fff", padding: "0 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 0 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, background: "#f59e0b", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🍰</div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: 1 }}>LAPISLAPIS</div>
                <div style={{ fontSize: 10, color: "#94a3b8", letterSpacing: 2 }}>PRODUCTION & SALES SYSTEM</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 8, height: 8, background: "#10b981", borderRadius: "50%" }}></div>
              <span style={{ fontSize: 11, color: "#94a3b8" }}>Live · {new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 4, marginTop: 16, overflowX: "auto" }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                padding: "10px 16px", background: tab === t.id ? "#f59e0b" : "transparent",
                color: tab === t.id ? "#1a1a2e" : "#94a3b8", border: "none", borderRadius: "8px 8px 0 0",
                cursor: "pointer", fontWeight: tab === t.id ? 700 : 500, fontSize: 12, whiteSpace: "nowrap"
              }}>{t.label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px" }}>
        {tab === "dashboard" && <Dashboard products={products} currentStock={currentStock} orders={orders} stockIn={stockIn} returns={returns} outlets={outlets} />}
        {tab === "stock" && <StockManager products={products} stockIn={stockIn} stockOut={stockOut} returns={returns} currentStock={currentStock} showToast={showToast} onRefresh={fetchAll} />}
        {tab === "orders" && <OrderManager products={products} outlets={outlets} orders={orders} currentStock={currentStock} showToast={showToast} onRefresh={fetchAll} />}
        {tab === "suratjalan" && <SuratJalanPanel orders={orders} products={products} outlets={outlets} showToast={showToast} onRefresh={fetchAll} />}
        {tab === "products" && <ProductManager products={products} showToast={showToast} onRefresh={fetchAll} />}
        {tab === "outlets" && <OutletManager outlets={outlets} showToast={showToast} onRefresh={fetchAll} />}
      </div>
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({ products, currentStock, orders, stockIn, returns, outlets }) {
  const pendingOrders = orders.filter(o => o.status === "pending").length;
  const packedOrders = orders.filter(o => o.status === "packed").length;
  const todayOrders = orders.filter(o => o.created_at?.slice(0, 10) === today()).length;
  const totalRetur = returns.reduce((s, x) => s + Number(x.qty), 0);

  const cards = [
    { label: "Order Pending", value: pendingOrders, icon: "⏳", color: "#f59e0b" },
    { label: "Siap Kirim", value: packedOrders, icon: "📦", color: "#8b5cf6" },
    { label: "Order Hari Ini", value: todayOrders, icon: "📋", color: "#3b82f6" },
    { label: "Total Retur", value: totalRetur, icon: "🔄", color: "#ef4444" },
  ];

  return (
    <div>
      <h2 style={{ margin: "0 0 20px", fontWeight: 800, color: "#1a1a2e" }}>Dashboard Overview</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        {cards.map(c => (
          <div key={c.label} style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,.07)", borderLeft: `4px solid ${c.color}` }}>
            <div style={{ fontSize: 28 }}>{c.icon}</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: c.color, margin: "4px 0" }}>{c.value}</div>
            <div style={{ fontSize: 12, color: "#64748b" }}>{c.label}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,.07)" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700 }}>📦 Stok Kue Saat Ini</h3>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ background: "#f8f7f4" }}>
              <th style={thS}>Produk</th><th style={{ ...thS, textAlign: "right" }}>Stok</th><th style={{ ...thS, textAlign: "center" }}>Status</th>
            </tr></thead>
            <tbody>
              {products.length === 0 ? <tr><td colSpan={3} style={{ textAlign: "center", padding: 20, color: "#94a3b8", fontSize: 12 }}>Belum ada produk</td></tr> :
                products.map(p => {
                  const stock = currentStock[p.id] || 0;
                  const sc = stock <= 0 ? "#ef4444" : stock <= 5 ? "#f59e0b" : "#10b981";
                  const sl = stock <= 0 ? "Habis" : stock <= 5 ? "Hampir Habis" : "Tersedia";
                  return (
                    <tr key={p.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={tdS}>{p.name}</td>
                      <td style={{ ...tdS, textAlign: "right", fontWeight: 700 }}>{stock} <span style={{ fontSize: 10, color: "#94a3b8" }}>{p.unit}</span></td>
                      <td style={{ ...tdS, textAlign: "center" }}><span style={{ background: sc + "20", color: sc, padding: "2px 8px", borderRadius: 99, fontSize: 10, fontWeight: 700 }}>{sl}</span></td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
        <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,.07)" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700 }}>🛒 Order Terbaru</h3>
          {orders.slice(0, 6).length === 0 ? <div style={{ color: "#94a3b8", fontSize: 13 }}>Belum ada order.</div> :
            orders.slice(0, 6).map(o => {
              const outlet = outlets.find(x => x.id === o.outlet_id);
              return (
                <div key={o.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "#f8f7f4", borderRadius: 8, marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{o.order_no}</div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>{outlet?.name || "-"} · {fmtDate(o.created_at)}</div>
                  </div>
                  <StatusBadge status={o.status} />
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}

// ─── STOCK MANAGER ────────────────────────────────────────────────────────────
function StockManager({ products, stockIn, stockOut, returns, currentStock, showToast, onRefresh }) {
  const [activeTab, setActiveTab] = useState("in");
  const [form, setForm] = useState({ product_id: "", qty: "", notes: "", date: today() });
  const [saving, setSaving] = useState(false);

  const tabColor = { in: "#10b981", out: "#ef4444", retur: "#f59e0b" };
  const tabLabel = { in: "Stok Masuk", out: "Stok Keluar", retur: "Retur Masuk" };
  const tableMap = { in: "stock_in", out: "stock_out", retur: "returns" };

  const handleAdd = async () => {
    if (!form.product_id || !form.qty) return showToast("❌ Produk & qty wajib diisi");
    if (activeTab === "out" && Number(form.qty) > (currentStock[form.product_id] || 0))
      return showToast("❌ Stok tidak cukup");
    setSaving(true);
    const { error } = await supabase.from(tableMap[activeTab]).insert({
      id: uid(), product_id: form.product_id, qty: Number(form.qty), notes: form.notes, date: form.date
    });
    setSaving(false);
    if (error) return showToast("❌ Gagal menyimpan: " + error.message);
    showToast("✅ " + tabLabel[activeTab] + " berhasil disimpan");
    setForm({ product_id: "", qty: "", notes: "", date: today() });
    onRefresh();
  };

  const activeData = activeTab === "in" ? stockIn : activeTab === "out" ? stockOut : returns;

  return (
    <div>
      <h2 style={{ margin: "0 0 20px", fontWeight: 800, color: "#1a1a2e" }}>Manajemen Stok</h2>
      <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 20 }}>
        <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,.07)", height: "fit-content" }}>
          <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
            {["in", "out", "retur"].map(t => (
              <button key={t} onClick={() => setActiveTab(t)} style={{
                flex: 1, padding: "8px 4px", fontSize: 11, fontWeight: 700,
                background: activeTab === t ? tabColor[t] : "#f1f5f9",
                color: activeTab === t ? "#fff" : "#64748b", border: "none", borderRadius: 8, cursor: "pointer"
              }}>{tabLabel[t]}</button>
            ))}
          </div>
          <label style={lbS}>Produk</label>
          <select value={form.product_id} onChange={e => setForm(f => ({ ...f, product_id: e.target.value }))} style={inS}>
            <option value="">-- Pilih Produk --</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name} (Stok: {currentStock[p.id] || 0} {p.unit})</option>)}
          </select>
          <label style={{ ...lbS, marginTop: 12 }}>Jumlah</label>
          <input type="number" min="1" value={form.qty} onChange={e => setForm(f => ({ ...f, qty: e.target.value }))} style={inS} placeholder="0" />
          <label style={{ ...lbS, marginTop: 12 }}>Tanggal</label>
          <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={inS} />
          <label style={{ ...lbS, marginTop: 12 }}>Keterangan</label>
          <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={inS} placeholder="Opsional..." />
          <button onClick={handleAdd} disabled={saving} style={{ ...btnS, background: tabColor[activeTab], marginTop: 16, width: "100%", opacity: saving ? .7 : 1 }}>
            {saving ? "Menyimpan..." : `+ Tambah ${tabLabel[activeTab]}`}
          </button>
        </div>
        <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,.07)" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700 }}>Riwayat {tabLabel[activeTab]} ({activeData.length})</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead><tr style={{ background: "#f8f7f4" }}>
                <th style={thS}>Tanggal</th><th style={thS}>Produk</th><th style={{ ...thS, textAlign: "right" }}>Qty</th><th style={thS}>Keterangan</th>
              </tr></thead>
              <tbody>
                {activeData.length === 0 ? <tr><td colSpan={4} style={{ textAlign: "center", padding: 32, color: "#94a3b8" }}>Belum ada data</td></tr> :
                  activeData.map(x => {
                    const p = products.find(pp => pp.id === x.product_id);
                    return (
                      <tr key={x.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={tdS}>{fmtDate(x.date)}</td>
                        <td style={tdS}>{p?.name || "-"}</td>
                        <td style={{ ...tdS, textAlign: "right", fontWeight: 700, color: tabColor[activeTab] }}>{x.qty} {p?.unit}</td>
                        <td style={{ ...tdS, color: "#64748b" }}>{x.notes || "-"}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ORDER MANAGER ────────────────────────────────────────────────────────────
function OrderManager({ products, outlets, orders, currentStock, showToast, onRefresh }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ outlet_id: "", delivery_date: today(), notes: "", items: [] });
  const [newItem, setNewItem] = useState({ product_id: "", qty: "" });
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("all");

  const addItem = () => {
    if (!newItem.product_id || !newItem.qty) return;
    const existing = form.items.findIndex(i => i.product_id === newItem.product_id);
    if (existing >= 0) {
      const items = [...form.items];
      items[existing].qty = Number(items[existing].qty) + Number(newItem.qty);
      setForm(f => ({ ...f, items }));
    } else {
      setForm(f => ({ ...f, items: [...f.items, { product_id: newItem.product_id, qty: Number(newItem.qty) }] }));
    }
    setNewItem({ product_id: "", qty: "" });
  };

  const submitOrder = async () => {
    if (!form.outlet_id) return showToast("❌ Pilih outlet tujuan");
    if (form.items.length === 0) return showToast("❌ Tambahkan minimal 1 produk");
    setSaving(true);
    const orderNo = "SJ-" + new Date().getFullYear() + "-" + String(orders.length + 1).padStart(4, "0");
    const orderId = uid();
    const { error: oErr } = await supabase.from("orders").insert({
      id: orderId, order_no: orderNo, outlet_id: form.outlet_id,
      delivery_date: form.delivery_date, notes: form.notes, status: "pending"
    });
    if (oErr) { setSaving(false); return showToast("❌ Gagal buat order: " + oErr.message); }
    const itemsToInsert = form.items.map((item, idx) => ({ id: uid(), order_id: orderId, product_id: item.product_id, qty: item.qty, no: idx + 1 }));
    const { error: iErr } = await supabase.from("order_items").insert(itemsToInsert);
    setSaving(false);
    if (iErr) return showToast("❌ Gagal simpan item: " + iErr.message);
    showToast("✅ Order " + orderNo + " berhasil dibuat!");
    setForm({ outlet_id: "", delivery_date: today(), notes: "", items: [] });
    setShowForm(false);
    onRefresh();
  };

  const updateStatus = async (id, status) => {
    const { error } = await supabase.from("orders").update({ status }).eq("id", id);
    if (error) return showToast("❌ Gagal update status");
    showToast("✅ Status diupdate: " + (STATUS[status]?.label || status));
    onRefresh();
  };

  const filteredOrders = filter === "all" ? orders : orders.filter(o => o.status === filter);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontWeight: 800, color: "#1a1a2e" }}>Order Sales</h2>
        <button onClick={() => setShowForm(!showForm)} style={{ ...btnS, background: "#1a1a2e" }}>
          {showForm ? "✕ Tutup" : "+ Buat Order Baru"}
        </button>
      </div>

      {showForm && (
        <div style={{ background: "#fff", borderRadius: 12, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,.07)", marginBottom: 20 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700 }}>🛒 Form Order Baru</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div>
              <label style={lbS}>Outlet Tujuan</label>
              <select value={form.outlet_id} onChange={e => setForm(f => ({ ...f, outlet_id: e.target.value }))} style={inS}>
                <option value="">-- Pilih Outlet --</option>
                {outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            <div>
              <label style={lbS}>Tanggal Kirim</label>
              <input type="date" value={form.delivery_date} onChange={e => setForm(f => ({ ...f, delivery_date: e.target.value }))} style={inS} />
            </div>
            <div>
              <label style={lbS}>Catatan</label>
              <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={inS} placeholder="Opsional..." />
            </div>
          </div>
          <div style={{ background: "#f8f7f4", borderRadius: 8, padding: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Tambah Item</div>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              <div style={{ flex: 2 }}>
                <select value={newItem.product_id} onChange={e => setNewItem(i => ({ ...i, product_id: e.target.value }))} style={inS}>
                  <option value="">-- Pilih Produk --</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} (Stok: {currentStock[p.id] || 0})</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <input type="number" min="1" value={newItem.qty} onChange={e => setNewItem(i => ({ ...i, qty: e.target.value }))} style={inS} placeholder="Qty" />
              </div>
              <button onClick={addItem} style={{ ...btnS, background: "#3b82f6" }}>+ Tambah</button>
            </div>
          </div>
          {form.items.length > 0 && (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 16 }}>
              <thead><tr style={{ background: "#f1f5f9" }}>
                <th style={thS}>No</th><th style={thS}>Produk</th><th style={{ ...thS, textAlign: "right" }}>Qty</th><th style={thS}></th>
              </tr></thead>
              <tbody>
                {form.items.map((item, idx) => {
                  const p = products.find(x => x.id === item.product_id);
                  return (
                    <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={tdS}>{idx + 1}</td>
                      <td style={tdS}>{p?.name}</td>
                      <td style={{ ...tdS, textAlign: "right", fontWeight: 700 }}>{item.qty} {p?.unit}</td>
                      <td style={tdS}><button onClick={() => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer" }}>✕</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <button onClick={submitOrder} disabled={saving} style={{ ...btnS, background: "#10b981", opacity: saving ? .7 : 1 }}>
            {saving ? "Menyimpan..." : "✅ Kirim Order ke Produksi"}
          </button>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {["all", "pending", "confirmed", "packed", "delivered", "cancelled"].map(s => (
          <button key={s} onClick={() => setFilter(s)} style={{
            padding: "6px 12px", fontSize: 11, fontWeight: 600, border: "none", borderRadius: 20, cursor: "pointer",
            background: filter === s ? "#1a1a2e" : "#e2e8f0", color: filter === s ? "#fff" : "#64748b"
          }}>{s === "all" ? "Semua" : STATUS[s]?.label || s}</button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {filteredOrders.length === 0 ? (
          <div style={{ background: "#fff", borderRadius: 12, padding: 40, textAlign: "center", color: "#94a3b8" }}>Tidak ada order</div>
        ) : filteredOrders.map(order => {
          const outlet = outlets.find(o => o.id === order.outlet_id);
          return (
            <div key={order.id} style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,.07)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontWeight: 800, fontSize: 15 }}>{order.order_no}</span>
                    <StatusBadge status={order.status} />
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                    🏪 {outlet?.name || "-"} · 📅 Kirim: {fmtDate(order.delivery_date)} · Dibuat: {fmtDate(order.created_at)}
                  </div>
                  {order.notes && <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>📝 {order.notes}</div>}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  {order.status === "pending" && <>
                    <button onClick={() => updateStatus(order.id, "confirmed")} style={{ ...btnSmS, background: "#3b82f6" }}>✓ Konfirmasi</button>
                    <button onClick={() => updateStatus(order.id, "cancelled")} style={{ ...btnSmS, background: "#ef4444" }}>✕ Batal</button>
                  </>}
                  {order.status === "confirmed" && <button onClick={() => updateStatus(order.id, "packed")} style={{ ...btnSmS, background: "#8b5cf6" }}>📦 Packing</button>}
                  {order.status === "packed" && <button onClick={() => updateStatus(order.id, "delivered")} style={{ ...btnSmS, background: "#10b981" }}>✅ Terkirim</button>}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {(order.order_items || []).map((item, i) => {
                  const p = products.find(x => x.id === item.product_id);
                  return <span key={i} style={{ background: "#f8f7f4", border: "1px solid #e2e8f0", padding: "4px 10px", borderRadius: 6, fontSize: 12 }}>{p?.name} × {item.qty}</span>;
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── SURAT JALAN ──────────────────────────────────────────────────────────────
function SuratJalanPanel({ orders, products, outlets, showToast, onRefresh }) {
  const readyOrders = orders.filter(o => ["confirmed", "packed"].includes(o.status));

  const handlePrint = (order) => {
    if (!order.order_items || order.order_items.length === 0) return showToast("❌ Order tidak memiliki item");
    printSuratJalan(order, products, outlets);
  };

  return (
    <div>
      <h2 style={{ margin: "0 0 8px", fontWeight: 800, color: "#1a1a2e" }}>Surat Jalan</h2>
      <p style={{ margin: "0 0 20px", fontSize: 13, color: "#64748b" }}>Order yang sudah dikonfirmasi atau dipacking siap cetak.</p>
      {readyOrders.length === 0 ? (
        <div style={{ background: "#fff", borderRadius: 12, padding: 48, textAlign: "center", color: "#94a3b8" }}>
          <div style={{ fontSize: 48 }}>📋</div>
          <div style={{ fontSize: 14, marginTop: 8 }}>Belum ada order yang siap cetak</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>Konfirmasi order di menu Order Sales terlebih dahulu</div>
        </div>
      ) : readyOrders.map(order => {
        const outlet = outlets.find(o => o.id === order.outlet_id);
        const totalItems = (order.order_items || []).reduce((s, i) => s + Number(i.qty), 0);
        return (
          <div key={order.id} style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,.07)", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <span style={{ fontWeight: 800, fontSize: 15 }}>{order.order_no}</span>
                <StatusBadge status={order.status} />
              </div>
              <div style={{ fontSize: 13 }}>🏪 {outlet?.name || "-"}</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>📅 Kirim: {fmtDate(order.delivery_date)} · {(order.order_items || []).length} jenis · {totalItems} unit</div>
            </div>
            <button onClick={() => handlePrint(order)} style={{ ...btnS, background: "#1a1a2e", display: "flex", alignItems: "center", gap: 6 }}>
              🖨️ Cetak Surat Jalan
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ─── PRODUCT MANAGER ──────────────────────────────────────────────────────────
function ProductManager({ products, showToast, onRefresh }) {
  const [form, setForm] = useState({ name: "", unit: "loyang", price: "" });
  const [saving, setSaving] = useState(false);

  const addProduct = async () => {
    if (!form.name) return showToast("❌ Nama produk wajib diisi");
    setSaving(true);
    const { error } = await supabase.from("products").insert({ id: "P" + uid().slice(0, 6).toUpperCase(), name: form.name, unit: form.unit, price: Number(form.price) });
    setSaving(false);
    if (error) return showToast("❌ Gagal: " + error.message);
    showToast("✅ Produk berhasil ditambahkan");
    setForm({ name: "", unit: "loyang", price: "" });
    onRefresh();
  };

  const deleteProduct = async (id) => {
    if (!window.confirm("Hapus produk ini?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) return showToast("❌ Gagal hapus produk");
    showToast("✅ Produk dihapus");
    onRefresh();
  };

  return (
    <div>
      <h2 style={{ margin: "0 0 20px", fontWeight: 800, color: "#1a1a2e" }}>Master Produk</h2>
      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 20 }}>
        <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,.07)", height: "fit-content" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700 }}>Tambah Produk Baru</h3>
          <label style={lbS}>Nama Produk</label>
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inS} placeholder="Contoh: Lapis Legit Original" />
          <label style={{ ...lbS, marginTop: 12 }}>Satuan</label>
          <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} style={inS}>
            <option value="loyang">loyang</option><option value="pcs">pcs</option><option value="box">box</option><option value="kg">kg</option>
          </select>
          <label style={{ ...lbS, marginTop: 12 }}>Harga (Rp)</label>
          <input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} style={inS} placeholder="0" />
          <button onClick={addProduct} disabled={saving} style={{ ...btnS, background: "#1a1a2e", marginTop: 16, width: "100%", opacity: saving ? .7 : 1 }}>
            {saving ? "Menyimpan..." : "+ Tambah Produk"}
          </button>
        </div>
        <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,.07)" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700 }}>Daftar Produk ({products.length})</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr style={{ background: "#f8f7f4" }}>
              <th style={thS}>Nama Produk</th><th style={thS}>Satuan</th><th style={{ ...thS, textAlign: "right" }}>Harga</th><th style={thS}></th>
            </tr></thead>
            <tbody>
              {products.length === 0 ? <tr><td colSpan={4} style={{ textAlign: "center", padding: 24, color: "#94a3b8" }}>Belum ada produk</td></tr> :
                products.map(p => (
                  <tr key={p.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ ...tdS, fontWeight: 600 }}>{p.name}</td>
                    <td style={tdS}>{p.unit}</td>
                    <td style={{ ...tdS, textAlign: "right" }}>{fmtMoney(p.price)}</td>
                    <td style={tdS}><button onClick={() => deleteProduct(p.id)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 13 }}>Hapus</button></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── OUTLET MANAGER ───────────────────────────────────────────────────────────
function OutletManager({ outlets, showToast, onRefresh }) {
  const [form, setForm] = useState({ name: "", address: "" });
  const [saving, setSaving] = useState(false);

  const addOutlet = async () => {
    if (!form.name) return showToast("❌ Nama outlet wajib diisi");
    setSaving(true);
    const { error } = await supabase.from("outlets").insert({ id: "O" + uid().slice(0, 6).toUpperCase(), name: form.name, address: form.address });
    setSaving(false);
    if (error) return showToast("❌ Gagal: " + error.message);
    showToast("✅ Outlet berhasil ditambahkan");
    setForm({ name: "", address: "" });
    onRefresh();
  };

  const deleteOutlet = async (id) => {
    if (!window.confirm("Hapus outlet ini?")) return;
    const { error } = await supabase.from("outlets").delete().eq("id", id);
    if (error) return showToast("❌ Gagal hapus outlet");
    showToast("✅ Outlet dihapus");
    onRefresh();
  };

  return (
    <div>
      <h2 style={{ margin: "0 0 20px", fontWeight: 800, color: "#1a1a2e" }}>Master Outlet</h2>
      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 20 }}>
        <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,.07)", height: "fit-content" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700 }}>Tambah Outlet</h3>
          <label style={lbS}>Nama Outlet</label>
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inS} placeholder="Contoh: Outlet MOI" />
          <label style={{ ...lbS, marginTop: 12 }}>Alamat</label>
          <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} style={inS} placeholder="Alamat lengkap..." />
          <button onClick={addOutlet} disabled={saving} style={{ ...btnS, background: "#1a1a2e", marginTop: 16, width: "100%", opacity: saving ? .7 : 1 }}>
            {saving ? "Menyimpan..." : "+ Tambah Outlet"}
          </button>
        </div>
        <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,.07)" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700 }}>Daftar Outlet ({outlets.length})</h3>
          {outlets.length === 0 ? <div style={{ color: "#94a3b8", fontSize: 13 }}>Belum ada outlet</div> :
            outlets.map(o => (
              <div key={o.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", background: "#f8f7f4", borderRadius: 8, marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{o.name}</div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{o.address || "-"}</div>
                </div>
                <button onClick={() => deleteOutlet(o.id)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer" }}>✕</button>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

// ─── SHARED STYLES ────────────────────────────────────────────────────────────
const inS = { width: "100%", padding: "9px 12px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box", background: "#fff", fontFamily: "inherit" };
const btnS = { padding: "9px 18px", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 };
const btnSmS = { padding: "6px 12px", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 600 };
const thS = { padding: "10px 12px", textAlign: "left", fontSize: 11, color: "#64748b", fontWeight: 700, borderBottom: "2px solid #e2e8f0" };
const tdS = { padding: "10px 12px", fontSize: 13 };
const lbS = { fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 };
