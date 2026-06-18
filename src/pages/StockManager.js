import { useState } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../context/AuthContext';
import { uid, today, fmtDate, S, DEFECT_REASONS, RETUR_REASONS } from '../utils';
import { Btn, FieldGroup, DataTable, EmptyState } from '../components/UI';

const logActivity = async (user, action, description) => {
  await supabase.from('activity_log').insert({ id: uid(), user_id: user.id, user_name: user.name, action, description });
};

export default function StockManager({ products, outlets, stockIn, stockOut, returns, currentStock, onRefresh, showToast }) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('in');
  const [form, setForm] = useState({ product_id:'', qty:'', notes:'', date: today(), batch_code:'', expired_date:'', reason:'', out_type:'manual_defect', outlet_id:'', order_id:'', return_type:'retur_outlet' });
  const [saving, setSaving] = useState(false);
  const canEdit = user?.role === 'admin' || user?.role === 'produksi';

  const tabColor = { in:'#10b981', out:'#ef4444', retur:'#f59e0b' };
  const tabLabel = { in:'Stok Masuk', out:'Keluar/Defect', retur:'Retur dari Outlet' };

  const resetForm = () => setForm({ product_id:'', qty:'', notes:'', date: today(), batch_code:'', expired_date:'', reason:'', out_type:'manual_defect', outlet_id:'', order_id:'', return_type:'retur_outlet' });

  const handleAdd = async () => {
    if (!form.product_id || !form.qty) return showToast('❌ Produk & qty wajib diisi');
    if (activeTab === 'in' && !form.batch_code) return showToast('❌ Kode batch wajib diisi');
    if (activeTab === 'out' && !form.reason) return showToast('❌ Alasan wajib diisi');
    if (activeTab === 'retur' && !form.reason) return showToast('❌ Alasan wajib diisi');
    if (activeTab === 'out' && Number(form.qty) > (currentStock[form.product_id]||0)) return showToast('❌ Stok tidak cukup');
    setSaving(true);
    const p = products.find(x => x.id === form.product_id);
    let error;
    if (activeTab === 'in') {
      ({ error } = await supabase.from('stock_in').insert({ id: uid(), product_id: form.product_id, qty: Number(form.qty), notes: form.notes, date: form.date, batch_code: form.batch_code, expired_date: form.expired_date || null, created_by: user.id, created_by_name: user.name }));
      if (!error) {
        await supabase.from('batches').insert({ id: uid(), batch_code: form.batch_code, product_id: form.product_id, qty_initial: Number(form.qty), expired_date: form.expired_date || null, notes: form.notes, created_by: user.id, created_by_name: user.name });
        await logActivity(user, 'stok_masuk', `Stok masuk ${form.qty} ${p?.unit} ${p?.name} — Batch: ${form.batch_code}`);
      }
    } else if (activeTab === 'out') {
      ({ error } = await supabase.from('stock_out').insert({ id: uid(), product_id: form.product_id, qty: Number(form.qty), notes: form.notes, date: form.date, reason: form.reason, out_type: form.out_type, created_by: user.id, created_by_name: user.name }));
      if (!error) await logActivity(user, 'stok_keluar', `Stok keluar ${form.qty} ${p?.unit} ${p?.name} — ${form.reason}`);
    } else {
      ({ error } = await supabase.from('returns').insert({ id: uid(), product_id: form.product_id, qty: Number(form.qty), notes: form.notes, date: form.date, outlet_id: form.outlet_id || null, reason: form.reason, return_type: 'retur_outlet', created_by: user.id, created_by_name: user.name }));
      if (!error) await logActivity(user, 'retur', `Retur ${form.qty} ${p?.unit} ${p?.name} dari ${outlets.find(o=>o.id===form.outlet_id)?.name||'outlet'} — ${form.reason}`);
    }
    setSaving(false);
    if (error) return showToast('❌ Gagal: ' + error.message);
    showToast('✅ ' + tabLabel[activeTab] + ' berhasil disimpan');
    resetForm();
    onRefresh();
  };

  const activeData = activeTab === 'in' ? stockIn : activeTab === 'out' ? stockOut : returns;

  // Stock summary per product
  const stockSummary = products.map(p => {
    const totalIn    = stockIn.filter(x => x.product_id === p.id).reduce((s,x) => s + Number(x.qty), 0);
    const totalOut   = stockOut.filter(x => x.product_id === p.id).reduce((s,x) => s + Number(x.qty), 0);
    const totalRetur = returns.filter(x => x.product_id === p.id).reduce((s,x) => s + Number(x.qty), 0);
    const orderOut   = 0; // handled in currentStock
    return { ...p, totalIn, totalOut, totalRetur, saldo: currentStock[p.id] || 0 };
  });

  return (
    <div>
      <h2 style={{ margin:'0 0 20px', fontWeight:800, color:'#1a1a2e' }}>Manajemen Stok</h2>

      {/* Stock Summary */}
      <div style={{ background:'#fff', borderRadius:12, padding:20, boxShadow:'0 1px 4px rgba(0,0,0,.07)', marginBottom:20 }}>
        <h3 style={{ margin:'0 0 14px', fontSize:14, fontWeight:700 }}>📊 Ringkasan Stok</h3>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead><tr style={{ background:'#f8f7f4' }}>
              {['Produk','Kategori','Stok Masuk','Retur Masuk','Stok Keluar','Keluar ke Outlet','SALDO','Min'].map((h,i) => (
                <th key={i} style={{ padding:'10px 12px', textAlign: i > 1 ? 'right' : 'left', fontSize:11, color:'#64748b', fontWeight:700, borderBottom:'2px solid #e2e8f0' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {stockSummary.map(p => {
                const orderOut = products.length > 0 ? (currentStock[p.id] !== undefined ? (p.totalIn + p.totalRetur - currentStock[p.id] - p.totalOut) : 0) : 0;
                const isLow = p.saldo <= (p.stok_minimum||5) && p.saldo > 0;
                const isEmpty = p.saldo <= 0;
                return (
                  <tr key={p.id} style={{ borderBottom:'1px solid #f1f5f9', background: isEmpty ? '#fff5f5' : isLow ? '#fffbeb' : '#fff' }}>
                    <td style={{ padding:'10px 12px', fontWeight:600 }}>{p.name}</td>
                    <td style={{ padding:'10px 12px', color:'#64748b', fontSize:12 }}>{p.kategori||'-'}</td>
                    <td style={{ padding:'10px 12px', textAlign:'right', color:'#10b981', fontWeight:600 }}>+{p.totalIn}</td>
                    <td style={{ padding:'10px 12px', textAlign:'right', color:'#f59e0b', fontWeight:600 }}>+{p.totalRetur}</td>
                    <td style={{ padding:'10px 12px', textAlign:'right', color:'#ef4444', fontWeight:600 }}>-{p.totalOut}</td>
                    <td style={{ padding:'10px 12px', textAlign:'right', color:'#8b5cf6', fontWeight:600 }}>-{Math.max(0,orderOut)}</td>
                    <td style={{ padding:'10px 12px', textAlign:'right', fontWeight:800, fontSize:15, color: isEmpty ? '#ef4444' : isLow ? '#f59e0b' : '#1a1a2e' }}>{p.saldo}</td>
                    <td style={{ padding:'10px 12px', textAlign:'right', fontSize:12, color:'#94a3b8' }}>{p.stok_minimum||5}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'360px 1fr', gap:20 }}>
        {/* Form */}
        {canEdit && (
          <div style={{ background:'#fff', borderRadius:12, padding:20, boxShadow:'0 1px 4px rgba(0,0,0,.07)', height:'fit-content' }}>
            <div style={{ display:'flex', gap:4, marginBottom:20 }}>
              {['in','out','retur'].map(t => (
                <button key={t} onClick={() => { setActiveTab(t); resetForm(); }} style={{ flex:1, padding:'8px 4px', fontSize:11, fontWeight:700, background: activeTab===t ? tabColor[t] : '#f1f5f9', color: activeTab===t ? '#fff' : '#64748b', border:'none', borderRadius:8, cursor:'pointer' }}>{tabLabel[t]}</button>
              ))}
            </div>

            <FieldGroup label="Produk">
              <select value={form.product_id} onChange={e => setForm(f => ({...f, product_id: e.target.value}))} style={S.input}>
                <option value=''>-- Pilih Produk --</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name} (Stok: {currentStock[p.id]||0} {p.unit})</option>)}
              </select>
            </FieldGroup>

            {activeTab === 'in' && <>
              <div style={{ marginTop:12 }}>
                <FieldGroup label="Kode Batch *">
                  <input value={form.batch_code} onChange={e => setForm(f => ({...f, batch_code: e.target.value}))} style={S.input} placeholder="Contoh: LP-001, PANDAN-18JUNI" />
                </FieldGroup>
              </div>
              <div style={{ marginTop:12 }}>
                <FieldGroup label="Tanggal Expired (opsional)">
                  <input type="date" value={form.expired_date} onChange={e => setForm(f => ({...f, expired_date: e.target.value}))} style={S.input} />
                </FieldGroup>
              </div>
            </>}

            {activeTab === 'out' && <>
              <div style={{ marginTop:12 }}>
                <FieldGroup label="Jenis Keluar">
                  <select value={form.out_type} onChange={e => setForm(f => ({...f, out_type: e.target.value}))} style={S.input}>
                    <option value="manual_defect">Rusak/Defect di Gudang</option>
                    <option value="sample">Sample/Tester</option>
                    <option value="other">Lainnya</option>
                  </select>
                </FieldGroup>
              </div>
              <div style={{ marginTop:12 }}>
                <FieldGroup label="Alasan *">
                  <select value={form.reason} onChange={e => setForm(f => ({...f, reason: e.target.value}))} style={S.input}>
                    <option value=''>-- Pilih alasan --</option>
                    {DEFECT_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </FieldGroup>
              </div>
            </>}

            {activeTab === 'retur' && <>
              <div style={{ marginTop:12 }}>
                <FieldGroup label="Dari Outlet">
                  <select value={form.outlet_id} onChange={e => setForm(f => ({...f, outlet_id: e.target.value}))} style={S.input}>
                    <option value=''>-- Pilih Outlet --</option>
                    {outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </FieldGroup>
              </div>
              <div style={{ marginTop:12 }}>
                <FieldGroup label="Alasan Retur *">
                  <select value={form.reason} onChange={e => setForm(f => ({...f, reason: e.target.value}))} style={S.input}>
                    <option value=''>-- Pilih alasan --</option>
                    {RETUR_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </FieldGroup>
              </div>
            </>}

            <div style={{ marginTop:12 }}>
              <FieldGroup label="Jumlah">
                <input type="number" min="1" value={form.qty} onChange={e => setForm(f => ({...f, qty: e.target.value}))} style={S.input} placeholder="0" />
              </FieldGroup>
            </div>
            <div style={{ marginTop:12 }}>
              <FieldGroup label="Tanggal">
                <input type="date" value={form.date} onChange={e => setForm(f => ({...f, date: e.target.value}))} style={S.input} />
              </FieldGroup>
            </div>
            <div style={{ marginTop:12 }}>
              <FieldGroup label="Catatan">
                <input value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} style={S.input} placeholder="Opsional..." />
              </FieldGroup>
            </div>

            <Btn onClick={handleAdd} disabled={saving} color={tabColor[activeTab]} style={{ marginTop:16, width:'100%' }}>
              {saving ? 'Menyimpan...' : `+ Tambah ${tabLabel[activeTab]}`}
            </Btn>
          </div>
        )}

        {/* History */}
        <div style={{ background:'#fff', borderRadius:12, padding:20, boxShadow:'0 1px 4px rgba(0,0,0,.07)' }}>
          <div style={{ display:'flex', gap:4, marginBottom:16 }}>
            {['in','out','retur'].map(t => (
              <button key={t} onClick={() => setActiveTab(t)} style={{ padding:'7px 14px', fontSize:11, fontWeight:700, background: activeTab===t ? tabColor[t] : '#f1f5f9', color: activeTab===t ? '#fff' : '#64748b', border:'none', borderRadius:8, cursor:'pointer' }}>{tabLabel[t]} ({(t==='in'?stockIn:t==='out'?stockOut:returns).length})</button>
            ))}
          </div>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead><tr style={{ background:'#f8f7f4' }}>
                <th style={{ padding:'10px 12px', textAlign:'left', fontSize:11, color:'#64748b', fontWeight:700, borderBottom:'2px solid #e2e8f0' }}>Tanggal</th>
                <th style={{ padding:'10px 12px', textAlign:'left', fontSize:11, color:'#64748b', fontWeight:700, borderBottom:'2px solid #e2e8f0' }}>Produk</th>
                {activeTab === 'in' && <th style={{ padding:'10px 12px', textAlign:'left', fontSize:11, color:'#64748b', fontWeight:700, borderBottom:'2px solid #e2e8f0' }}>Batch</th>}
                {activeTab === 'out' && <th style={{ padding:'10px 12px', textAlign:'left', fontSize:11, color:'#64748b', fontWeight:700, borderBottom:'2px solid #e2e8f0' }}>Alasan</th>}
                {activeTab === 'retur' && <th style={{ padding:'10px 12px', textAlign:'left', fontSize:11, color:'#64748b', fontWeight:700, borderBottom:'2px solid #e2e8f0' }}>Alasan</th>}
                <th style={{ padding:'10px 12px', textAlign:'right', fontSize:11, color:'#64748b', fontWeight:700, borderBottom:'2px solid #e2e8f0' }}>Qty</th>
                <th style={{ padding:'10px 12px', textAlign:'left', fontSize:11, color:'#64748b', fontWeight:700, borderBottom:'2px solid #e2e8f0' }}>Oleh</th>
              </tr></thead>
              <tbody>
                {activeData.length === 0
                  ? <tr><td colSpan={6} style={{ textAlign:'center', padding:32, color:'#94a3b8' }}>Belum ada data</td></tr>
                  : activeData.map(x => {
                    const p = products.find(pp => pp.id === x.product_id);
                    return (
                      <tr key={x.id} style={{ borderBottom:'1px solid #f1f5f9' }}>
                        <td style={{ padding:'10px 12px', fontSize:13 }}>{fmtDate(x.date)}</td>
                        <td style={{ padding:'10px 12px', fontSize:13 }}>{p?.name||'-'}</td>
                        {activeTab === 'in' && <td style={{ padding:'10px 12px', fontSize:12 }}><span style={{ background:'#dbeafe', color:'#1e40af', padding:'2px 8px', borderRadius:6, fontWeight:600 }}>{x.batch_code||'-'}</span></td>}
                        {activeTab !== 'in' && <td style={{ padding:'10px 12px', fontSize:12, color:'#64748b' }}>{x.reason||'-'}</td>}
                        <td style={{ padding:'10px 12px', textAlign:'right', fontWeight:700, color: tabColor[activeTab] }}>{x.qty} {p?.unit}</td>
                        <td style={{ padding:'10px 12px', fontSize:12, color:'#64748b' }}>{x.created_by_name||'-'}</td>
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
