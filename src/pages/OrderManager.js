import { useState } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../context/AuthContext';
import { uid, today, fmtDate, S, REJECT_REASONS, STATUS_CFG } from '../utils';
import { StatusBadge, Btn, FieldGroup } from '../components/UI';

const logActivity = async (user, action, description) => {
  await supabase.from('activity_log').insert({ id: uid(), user_id: user.id, user_name: user.name, action, description });
};

export default function OrderManager({ products, outlets, orders, currentStock, onRefresh, showToast }) {
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(null); // order id
  const [form, setForm] = useState({ outlet_id:'', delivery_date: today(), notes:'', driver_name:'', vehicle_no:'', items:[] });
  const [newItem, setNewItem] = useState({ product_id:'', qty:'' });
  const [rejectData, setRejectData] = useState({});
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('all');

  const canCreate  = user?.role === 'admin' || user?.role === 'sales';
  const canStatus  = user?.role === 'admin' || user?.role === 'produksi';

  const addItem = () => {
    if (!newItem.product_id || !newItem.qty) return;
    const existing = form.items.findIndex(i => i.product_id === newItem.product_id);
    if (existing >= 0) {
      const items = [...form.items]; items[existing].qty = Number(items[existing].qty) + Number(newItem.qty);
      setForm(f => ({...f, items}));
    } else {
      setForm(f => ({...f, items:[...f.items, { product_id: newItem.product_id, qty: Number(newItem.qty) }]}));
    }
    setNewItem({ product_id:'', qty:'' });
  };

  const submitOrder = async () => {
    if (!form.outlet_id) return showToast('❌ Pilih outlet tujuan');
    if (form.items.length === 0) return showToast('❌ Tambahkan minimal 1 produk');
    setSaving(true);
    const orderNo  = 'ORD-' + new Date().getFullYear() + '-' + String(orders.length+1).padStart(4,'0');
    const orderId  = uid();
    const { error: oErr } = await supabase.from('orders').insert({ id: orderId, order_no: orderNo, outlet_id: form.outlet_id, delivery_date: form.delivery_date, notes: form.notes, driver_name: form.driver_name, vehicle_no: form.vehicle_no, status:'pending', created_by: user.id, created_by_name: user.name });
    if (oErr) { setSaving(false); return showToast('❌ ' + oErr.message); }
    await supabase.from('order_items').insert(form.items.map((item,idx) => ({ id: uid(), order_id: orderId, product_id: item.product_id, qty: item.qty, qty_delivered: item.qty, qty_rejected: 0, no: idx+1 })));
    await logActivity(user, 'order_buat', `Order ${orderNo} dibuat untuk ${outlets.find(o=>o.id===form.outlet_id)?.name}`);
    setSaving(false);
    showToast('✅ Order ' + orderNo + ' berhasil dibuat!');
    setForm({ outlet_id:'', delivery_date: today(), notes:'', driver_name:'', vehicle_no:'', items:[] });
    setShowForm(false);
    onRefresh();
  };

  const updateStatus = async (order, status) => {
    if (status === 'packed' && (!order.driver_name)) {
      const driver = window.prompt('Nama driver/kurir:');
      if (!driver) return;
      const vehicle = window.prompt('Nomor kendaraan:');
      await supabase.from('orders').update({ status, driver_name: driver, vehicle_no: vehicle||'' }).eq('id', order.id);
    } else {
      await supabase.from('orders').update({ status }).eq('id', order.id);
    }
    await logActivity(user, 'order_status', `Order ${order.order_no} → ${STATUS_CFG[status]?.label}`);
    showToast('✅ Status diupdate');
    onRefresh();
  };

  const submitReject = async (order) => {
    const items = order.order_items || [];
    let hasReject = false;
    let allRejected = true;
    setSaving(true);
    for (const item of items) {
      const rd = rejectData[item.id] || {};
      const rejQty = Number(rd.qty || 0);
      if (rejQty > 0) {
        hasReject = true;
        await supabase.from('order_items').update({ qty_rejected: rejQty, qty_delivered: item.qty - rejQty, reject_reason: rd.reason||'' }).eq('id', item.id);
        // Return stock
        await supabase.from('returns').insert({ id: uid(), product_id: item.product_id, qty: rejQty, date: today(), outlet_id: order.outlet_id, order_id: order.id, reason: rd.reason||'Reject pengiriman', return_type: 'reject_pengiriman', created_by: user.id, created_by_name: user.name });
        const p = products.find(x => x.id === item.product_id);
        await logActivity(user, 'reject', `Reject ${rejQty} ${p?.unit||''} ${p?.name||''} dari order ${order.order_no} — ${rd.reason||''}`);
      }
      if (item.qty - Number(rd.qty||0) > 0) allRejected = false;
    }
    const newStatus = !hasReject ? 'delivered' : allRejected ? 'rejected' : 'partial_delivered';
    await supabase.from('orders').update({ status: newStatus }).eq('id', order.id);
    setSaving(false);
    setShowRejectForm(null);
    setRejectData({});
    showToast('✅ Konfirmasi penerimaan tersimpan');
    onRefresh();
  };

  const filteredOrders = filter === 'all' ? orders : orders.filter(o => o.status === filter);

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <h2 style={{ margin:0, fontWeight:800, color:'#1a1a2e' }}>Order Sales</h2>
        {canCreate && <Btn onClick={() => setShowForm(!showForm)} color="#1a1a2e">{showForm ? '✕ Tutup' : '+ Buat Order Baru'}</Btn>}
      </div>

      {/* New Order Form */}
      {showForm && canCreate && (
        <div style={{ background:'#fff', borderRadius:12, padding:24, boxShadow:'0 1px 4px rgba(0,0,0,.07)', marginBottom:20 }}>
          <h3 style={{ margin:'0 0 16px', fontSize:15, fontWeight:700 }}>🛒 Form Order Baru</h3>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:12, marginBottom:16 }}>
            <FieldGroup label="Outlet Tujuan">
              <select value={form.outlet_id} onChange={e => setForm(f => ({...f, outlet_id: e.target.value}))} style={S.input}>
                <option value=''>-- Pilih --</option>
                {outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </FieldGroup>
            <FieldGroup label="Tanggal Kirim">
              <input type="date" value={form.delivery_date} onChange={e => setForm(f => ({...f, delivery_date: e.target.value}))} style={S.input} />
            </FieldGroup>
            <FieldGroup label="Driver (opsional)">
              <input value={form.driver_name} onChange={e => setForm(f => ({...f, driver_name: e.target.value}))} style={S.input} placeholder="Nama driver..." />
            </FieldGroup>
            <FieldGroup label="Catatan">
              <input value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} style={S.input} placeholder="Opsional..." />
            </FieldGroup>
          </div>

          {/* Add items */}
          <div style={{ background:'#f8f7f4', borderRadius:8, padding:12, marginBottom:12 }}>
            <div style={{ fontSize:12, fontWeight:700, marginBottom:8 }}>Tambah Produk</div>
            <div style={{ display:'flex', gap:8, alignItems:'flex-end' }}>
              <div style={{ flex:2 }}>
                <select value={newItem.product_id} onChange={e => setNewItem(i => ({...i, product_id: e.target.value}))} style={S.input}>
                  <option value=''>-- Pilih Produk --</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} (Stok: {currentStock[p.id]||0})</option>)}
                </select>
              </div>
              <div style={{ flex:1 }}>
                <input type="number" min="1" value={newItem.qty} onChange={e => setNewItem(i => ({...i, qty: e.target.value}))} style={S.input} placeholder="Qty" />
              </div>
              <Btn onClick={addItem} color="#3b82f6">+ Tambah</Btn>
            </div>
          </div>

          {form.items.length > 0 && (
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, marginBottom:16 }}>
              <thead><tr style={{ background:'#f1f5f9' }}>
                <th style={S.th}>No</th><th style={S.th}>Produk</th><th style={{...S.th, textAlign:'right'}}>Qty</th><th style={S.th}></th>
              </tr></thead>
              <tbody>
                {form.items.map((item,idx) => {
                  const p = products.find(x => x.id === item.product_id);
                  return (
                    <tr key={idx} style={{ borderBottom:'1px solid #f1f5f9' }}>
                      <td style={S.td}>{idx+1}</td>
                      <td style={S.td}>{p?.name}</td>
                      <td style={{...S.td, textAlign:'right', fontWeight:700}}>{item.qty} {p?.unit}</td>
                      <td style={S.td}><button onClick={() => setForm(f => ({...f, items: f.items.filter((_,i) => i!==idx)}))} style={{ background:'none', border:'none', color:'#ef4444', cursor:'pointer' }}>✕</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <Btn onClick={submitOrder} disabled={saving} color="#10b981">{saving ? 'Menyimpan...' : '✅ Kirim Order ke Produksi'}</Btn>
        </div>
      )}

      {/* Filter */}
      <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
        {['all','pending','confirmed','packed','delivered','partial_delivered','rejected','cancelled'].map(s => (
          <button key={s} onClick={() => setFilter(s)} style={{ padding:'6px 12px', fontSize:11, fontWeight:600, border:'none', borderRadius:20, cursor:'pointer', background: filter===s ? '#1a1a2e' : '#e2e8f0', color: filter===s ? '#fff' : '#64748b' }}>
            {s === 'all' ? 'Semua' : STATUS_CFG[s]?.label||s}
          </button>
        ))}
      </div>

      {/* Order List */}
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {filteredOrders.length === 0
          ? <div style={{ background:'#fff', borderRadius:12, padding:40, textAlign:'center', color:'#94a3b8' }}>Tidak ada order</div>
          : filteredOrders.map(order => {
          const outlet = outlets.find(o => o.id === order.outlet_id);
          return (
            <div key={order.id} style={{ background:'#fff', borderRadius:12, padding:20, boxShadow:'0 1px 4px rgba(0,0,0,.07)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                <div>
                  <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                    <span style={{ fontWeight:800, fontSize:15 }}>{order.order_no}</span>
                    <StatusBadge status={order.status} />
                    {order.driver_name && <span style={{ fontSize:11, color:'#64748b' }}>🚗 {order.driver_name} {order.vehicle_no && `· ${order.vehicle_no}`}</span>}
                  </div>
                  <div style={{ fontSize:12, color:'#64748b', marginTop:4 }}>
                    🏪 {outlet?.name||'-'} · 📅 Kirim: {fmtDate(order.delivery_date)} · Oleh: {order.created_by_name||'-'}
                  </div>
                  {order.notes && <div style={{ fontSize:12, color:'#94a3b8', marginTop:2 }}>📝 {order.notes}</div>}
                </div>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap', justifyContent:'flex-end' }}>
                  {canStatus && order.status === 'pending' && <>
                    <Btn small onClick={() => updateStatus(order,'confirmed')} color="#3b82f6">✓ Konfirmasi</Btn>
                    <Btn small onClick={() => updateStatus(order,'cancelled')} color="#ef4444">✕ Batal</Btn>
                  </>}
                  {canStatus && order.status === 'confirmed' && <Btn small onClick={() => updateStatus(order,'packed')} color="#8b5cf6">📦 Packing</Btn>}
                  {canStatus && order.status === 'packed' && <Btn small onClick={() => setShowRejectForm(order.id)} color="#10b981">✅ Konfirmasi Terima</Btn>}
                </div>
              </div>

              {/* Items */}
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom: showRejectForm === order.id ? 16 : 0 }}>
                {(order.order_items||[]).map((item,i) => {
                  const p = products.find(x => x.id === item.product_id);
                  return (
                    <span key={i} style={{ background:'#f8f7f4', border:'1px solid #e2e8f0', padding:'4px 10px', borderRadius:6, fontSize:12 }}>
                      {p?.name} × {item.qty}
                      {item.qty_rejected > 0 && <span style={{ color:'#ef4444', marginLeft:4 }}>(-{item.qty_rejected} reject)</span>}
                    </span>
                  );
                })}
              </div>

              {/* Reject Form */}
              {showRejectForm === order.id && (
                <div style={{ background:'#f8f7f4', borderRadius:8, padding:16, marginTop:8 }}>
                  <div style={{ fontSize:13, fontWeight:700, marginBottom:12, color:'#1a1a2e' }}>Konfirmasi Penerimaan — {order.order_no}</div>
                  <div style={{ fontSize:12, color:'#64748b', marginBottom:12 }}>Isi qty reject jika ada barang yang ditolak. Kosongkan jika semua diterima.</div>
                  {(order.order_items||[]).map(item => {
                    const p = products.find(x => x.id === item.product_id);
                    return (
                      <div key={item.id} style={{ display:'grid', gridTemplateColumns:'2fr 1fr 2fr', gap:8, marginBottom:8, alignItems:'center' }}>
                        <div style={{ fontSize:13, fontWeight:600 }}>{p?.name} <span style={{ color:'#64748b', fontWeight:400 }}>(kirim: {item.qty})</span></div>
                        <input type="number" min="0" max={item.qty} placeholder="Qty reject" value={rejectData[item.id]?.qty||''} onChange={e => setRejectData(d => ({...d, [item.id]: {...(d[item.id]||{}), qty: e.target.value}}))} style={{...S.input, textAlign:'center'}} />
                        <select value={rejectData[item.id]?.reason||''} onChange={e => setRejectData(d => ({...d, [item.id]: {...(d[item.id]||{}), reason: e.target.value}}))} style={S.input}>
                          <option value=''>-- Alasan reject --</option>
                          {REJECT_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </div>
                    );
                  })}
                  <div style={{ display:'flex', gap:8, marginTop:12 }}>
                    <Btn onClick={() => submitReject(order)} disabled={saving} color="#10b981">{saving ? 'Menyimpan...' : '✅ Simpan Konfirmasi'}</Btn>
                    <Btn onClick={() => { setShowRejectForm(null); setRejectData({}); }} color="#64748b">Batal</Btn>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
