import { useState } from 'react';
import { supabase } from '../supabase';
import { uid, fmtDate, fmtDateTime, S } from '../utils';
import { RoleBadge, Btn, FieldGroup } from '../components/UI';

// ─── STAFF MANAGER ────────────────────────────────────────────────────────────
export function StaffManager({ staff, onRefresh, showToast }) {
  const [form, setForm] = useState({ name:'', role:'produksi', pin:'' });
  const [editPin, setEditPin] = useState({}); // { id: newPin }
  const [saving, setSaving] = useState(false);

  const addStaff = async () => {
    if (!form.name || !form.pin) return showToast('❌ Nama & PIN wajib diisi');
    if (form.pin.length !== 4 || !/^\d+$/.test(form.pin)) return showToast('❌ PIN harus 4 angka');
    setSaving(true);
    const { error } = await supabase.from('users_profile').insert({ id: 'USR' + uid().slice(0,6), name: form.name, role: form.role, pin: form.pin, is_active: true });
    setSaving(false);
    if (error) return showToast('❌ ' + error.message);
    showToast('✅ Staff ' + form.name + ' berhasil ditambahkan');
    setForm({ name:'', role:'produksi', pin:'' });
    onRefresh();
  };

  const toggleActive = async (s) => {
    await supabase.from('users_profile').update({ is_active: !s.is_active }).eq('id', s.id);
    showToast(`✅ ${s.name} ${s.is_active ? 'dinonaktifkan' : 'diaktifkan'}`);
    onRefresh();
  };

  const resetPin = async (s) => {
    const newPin = editPin[s.id];
    if (!newPin || newPin.length !== 4 || !/^\d+$/.test(newPin)) return showToast('❌ PIN baru harus 4 angka');
    await supabase.from('users_profile').update({ pin: newPin }).eq('id', s.id);
    setEditPin(p => { const n = {...p}; delete n[s.id]; return n; });
    showToast('✅ PIN ' + s.name + ' berhasil direset');
    onRefresh();
  };

  const changeRole = async (s, role) => {
    await supabase.from('users_profile').update({ role }).eq('id', s.id);
    showToast('✅ Role ' + s.name + ' diubah ke ' + role);
    onRefresh();
  };

  return (
    <div>
      <h2 style={{ margin:'0 0 20px', fontWeight:800, color:'#1a1a2e' }}>Manajemen Staff</h2>
      <div style={{ display:'grid', gridTemplateColumns:'320px 1fr', gap:20 }}>
        {/* Add form */}
        <div style={{ background:'#fff', borderRadius:12, padding:20, boxShadow:'0 1px 4px rgba(0,0,0,.07)', height:'fit-content' }}>
          <h3 style={{ margin:'0 0 16px', fontSize:14, fontWeight:700 }}>+ Tambah Staff Baru</h3>
          <FieldGroup label="Nama Staff">
            <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} style={S.input} placeholder="Nama lengkap..." />
          </FieldGroup>
          <div style={{ marginTop:12 }}>
            <FieldGroup label="Role">
              <select value={form.role} onChange={e => setForm(f => ({...f, role: e.target.value}))} style={S.input}>
                <option value="produksi">Produksi</option>
                <option value="sales">Sales</option>
                <option value="admin">Admin</option>
              </select>
            </FieldGroup>
          </div>
          <div style={{ marginTop:12 }}>
            <FieldGroup label="PIN (4 angka)">
              <input type="text" maxLength={4} value={form.pin} onChange={e => setForm(f => ({...f, pin: e.target.value.replace(/\D/,'')}))} style={S.input} placeholder="Contoh: 1234" />
            </FieldGroup>
          </div>
          <Btn onClick={addStaff} disabled={saving} color="#1a1a2e" style={{ marginTop:16, width:'100%' }}>
            {saving ? 'Menyimpan...' : '+ Tambah Staff'}
          </Btn>
          <div style={{ marginTop:12, padding:10, background:'#fef3c7', borderRadius:8, fontSize:11, color:'#92400e' }}>
            💡 Sampaikan PIN ke staff secara langsung. Jangan share via chat.
          </div>
        </div>

        {/* Staff list */}
        <div style={{ background:'#fff', borderRadius:12, padding:20, boxShadow:'0 1px 4px rgba(0,0,0,.07)' }}>
          <h3 style={{ margin:'0 0 16px', fontSize:14, fontWeight:700 }}>Daftar Staff ({staff.length})</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {staff.length === 0
              ? <div style={{ textAlign:'center', padding:20, color:'#94a3b8' }}>Belum ada staff</div>
              : staff.map(s => (
                <div key={s.id} style={{ padding:'14px 16px', background: s.is_active ? '#f8f7f4' : '#f1f5f9', borderRadius:10, border: s.is_active ? 'none' : '1px dashed #cbd5e1' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                    <div>
                      <span style={{ fontWeight:700, fontSize:14, color: s.is_active ? '#1a1a2e' : '#94a3b8' }}>{s.name}</span>
                      <span style={{ marginLeft:8 }}><RoleBadge role={s.role} /></span>
                      {!s.is_active && <span style={{ marginLeft:8, fontSize:11, color:'#94a3b8' }}>— Nonaktif</span>}
                    </div>
                    <div style={{ display:'flex', gap:6 }}>
                      <select value={s.role} onChange={e => changeRole(s, e.target.value)} style={{ padding:'4px 8px', border:'1px solid #e2e8f0', borderRadius:6, fontSize:11, cursor:'pointer' }}>
                        <option value="produksi">Produksi</option>
                        <option value="sales">Sales</option>
                        <option value="admin">Admin</option>
                      </select>
                      <Btn small onClick={() => toggleActive(s)} color={s.is_active ? '#ef4444' : '#10b981'}>
                        {s.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                      </Btn>
                    </div>
                  </div>
                  {/* Reset PIN */}
                  <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                    <input type="text" maxLength={4} value={editPin[s.id]||''} onChange={e => setEditPin(p => ({...p, [s.id]: e.target.value.replace(/\D/,'')}))} style={{ ...S.input, width:100, padding:'6px 10px', fontSize:12 }} placeholder="PIN baru" />
                    <Btn small onClick={() => resetPin(s)} color="#f59e0b">Reset PIN</Btn>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ACTIVITY LOG ─────────────────────────────────────────────────────────────
export function ActivityLog({ activityLog, staff }) {
  const [filterUser, setFilterUser] = useState('all');
  const [filterAction, setFilterAction] = useState('all');

  const actions = [...new Set(activityLog.map(a => a.action))];
  const filtered = activityLog.filter(a =>
    (filterUser === 'all' || a.user_id === filterUser) &&
    (filterAction === 'all' || a.action === filterAction)
  );

  const actionIcon = { login:'🔐', stok_masuk:'📦', stok_keluar:'📤', retur:'🔄', order_buat:'🛒', order_status:'📋', reject:'⚠️' };

  return (
    <div>
      <h2 style={{ margin:'0 0 20px', fontWeight:800, color:'#1a1a2e' }}>Activity Log</h2>
      <div style={{ background:'#fff', borderRadius:12, padding:20, boxShadow:'0 1px 4px rgba(0,0,0,.07)' }}>
        <div style={{ display:'flex', gap:12, marginBottom:16, flexWrap:'wrap' }}>
          <select value={filterUser} onChange={e => setFilterUser(e.target.value)} style={{ ...S.input, width:'auto' }}>
            <option value='all'>Semua Staff</option>
            {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={filterAction} onChange={e => setFilterAction(e.target.value)} style={{ ...S.input, width:'auto' }}>
            <option value='all'>Semua Aksi</option>
            {actions.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <span style={{ fontSize:13, color:'#64748b', alignSelf:'center' }}>{filtered.length} entri</span>
        </div>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead><tr style={{ background:'#f8f7f4' }}>
              <th style={S.th}>Waktu</th>
              <th style={S.th}>Staff</th>
              <th style={S.th}>Aksi</th>
              <th style={S.th}>Keterangan</th>
            </tr></thead>
            <tbody>
              {filtered.length === 0
                ? <tr><td colSpan={4} style={{ textAlign:'center', padding:24, color:'#94a3b8' }}>Tidak ada data</td></tr>
                : filtered.map(a => (
                  <tr key={a.id} style={{ borderBottom:'1px solid #f1f5f9' }}>
                    <td style={{ ...S.td, color:'#64748b', fontSize:12 }}>{fmtDateTime(a.created_at)}</td>
                    <td style={{ ...S.td, fontWeight:600 }}>{a.user_name}</td>
                    <td style={{ S.td }}><span style={{ background:'#f1f5f9', padding:'2px 8px', borderRadius:6, fontSize:11, fontWeight:600 }}>{actionIcon[a.action]||'📌'} {a.action}</span></td>
                    <td style={{ ...S.td, color:'#374151' }}>{a.description}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── PRODUCT MANAGER ──────────────────────────────────────────────────────────
export function ProductManager({ products, onRefresh, showToast }) {
  const [form, setForm] = useState({ name:'', unit:'loyang', price:'', kategori:'', expired_duration:'', stok_minimum:'5' });
  const [saving, setSaving] = useState(false);

  const KATEGORI = ['Lapis Legit','Lapis Surabaya','Lapis Pepe','Brownies','Kue Kering','Lainnya'];

  const addProduct = async () => {
    if (!form.name) return showToast('❌ Nama produk wajib diisi');
    setSaving(true);
    const { error } = await supabase.from('products').insert({ id: 'PRD' + uid().slice(0,6).toUpperCase(), name: form.name, unit: form.unit, price: Number(form.price)||0, kategori: form.kategori, expired_duration: Number(form.expired_duration)||null, stok_minimum: Number(form.stok_minimum)||5 });
    setSaving(false);
    if (error) return showToast('❌ ' + error.message);
    showToast('✅ Produk berhasil ditambahkan');
    setForm({ name:'', unit:'loyang', price:'', kategori:'', expired_duration:'', stok_minimum:'5' });
    onRefresh();
  };

  const deleteProduct = async (id) => {
    if (!window.confirm('Hapus produk ini?')) return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) return showToast('❌ ' + error.message);
    showToast('✅ Produk dihapus');
    onRefresh();
  };

  return (
    <div>
      <h2 style={{ margin:'0 0 20px', fontWeight:800, color:'#1a1a2e' }}>Master Produk</h2>
      <div style={{ display:'grid', gridTemplateColumns:'340px 1fr', gap:20 }}>
        <div style={{ background:'#fff', borderRadius:12, padding:20, boxShadow:'0 1px 4px rgba(0,0,0,.07)', height:'fit-content' }}>
          <h3 style={{ margin:'0 0 16px', fontSize:14, fontWeight:700 }}>Tambah Produk Baru</h3>
          {[
            { label:'Nama Produk', key:'name', placeholder:'Lapis Legit Original' },
          ].map(f => (
            <div key={f.key} style={{ marginBottom:12 }}>
              <FieldGroup label={f.label}>
                <input value={form[f.key]} onChange={e => setForm(p => ({...p, [f.key]: e.target.value}))} style={S.input} placeholder={f.placeholder} />
              </FieldGroup>
            </div>
          ))}
          <div style={{ marginBottom:12 }}>
            <FieldGroup label="Kategori">
              <select value={form.kategori} onChange={e => setForm(f => ({...f, kategori: e.target.value}))} style={S.input}>
                <option value=''>-- Pilih --</option>
                {KATEGORI.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </FieldGroup>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12 }}>
            <FieldGroup label="Satuan">
              <select value={form.unit} onChange={e => setForm(f => ({...f, unit: e.target.value}))} style={S.input}>
                <option value="loyang">loyang</option><option value="pcs">pcs</option><option value="box">box</option><option value="kg">kg</option>
              </select>
            </FieldGroup>
            <FieldGroup label="Stok Minimum">
              <input type="number" value={form.stok_minimum} onChange={e => setForm(f => ({...f, stok_minimum: e.target.value}))} style={S.input} placeholder="5" />
            </FieldGroup>
          </div>
          <FieldGroup label="Expired Duration (hari)">
            <input type="number" value={form.expired_duration} onChange={e => setForm(f => ({...f, expired_duration: e.target.value}))} style={S.input} placeholder="Contoh: 7" />
          </FieldGroup>
          <Btn onClick={addProduct} disabled={saving} color="#1a1a2e" style={{ marginTop:16, width:'100%' }}>
            {saving ? 'Menyimpan...' : '+ Tambah Produk'}
          </Btn>
        </div>
        <div style={{ background:'#fff', borderRadius:12, padding:20, boxShadow:'0 1px 4px rgba(0,0,0,.07)' }}>
          <h3 style={{ margin:'0 0 16px', fontSize:14, fontWeight:700 }}>Daftar Produk ({products.length})</h3>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead><tr style={{ background:'#f8f7f4' }}>
              {['Nama','Kategori','Satuan','Min Stok','Expired (hari)',''].map((h,i) => <th key={i} style={S.th}>{h}</th>)}
            </tr></thead>
            <tbody>
              {products.length === 0 ? <tr><td colSpan={6} style={{ textAlign:'center', padding:24, color:'#94a3b8' }}>Belum ada produk</td></tr>
              : products.map(p => (
                <tr key={p.id} style={{ borderBottom:'1px solid #f1f5f9' }}>
                  <td style={{ ...S.td, fontWeight:600 }}>{p.name}</td>
                  <td style={{ ...S.td, fontSize:12, color:'#64748b' }}>{p.kategori||'-'}</td>
                  <td style={S.td}>{p.unit}</td>
                  <td style={{ ...S.td, textAlign:'center' }}>{p.stok_minimum||5}</td>
                  <td style={{ ...S.td, textAlign:'center', color:'#64748b' }}>{p.expired_duration ? p.expired_duration + ' hari' : '-'}</td>
                  <td style={S.td}><button onClick={() => deleteProduct(p.id)} style={{ background:'none', border:'none', color:'#ef4444', cursor:'pointer', fontSize:13 }}>Hapus</button></td>
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
export function OutletManager({ outlets, onRefresh, showToast }) {
  const [form, setForm] = useState({ name:'', address:'', pic_name:'', pic_phone:'', notes:'', jam_operasional:'' });
  const [saving, setSaving] = useState(false);

  const addOutlet = async () => {
    if (!form.name) return showToast('❌ Nama outlet wajib diisi');
    setSaving(true);
    const { error } = await supabase.from('outlets').insert({ id: 'OTL' + uid().slice(0,6).toUpperCase(), ...form });
    setSaving(false);
    if (error) return showToast('❌ ' + error.message);
    showToast('✅ Outlet berhasil ditambahkan');
    setForm({ name:'', address:'', pic_name:'', pic_phone:'', notes:'', jam_operasional:'' });
    onRefresh();
  };

  const deleteOutlet = async (id) => {
    if (!window.confirm('Hapus outlet ini?')) return;
    await supabase.from('outlets').delete().eq('id', id);
    showToast('✅ Outlet dihapus');
    onRefresh();
  };

  return (
    <div>
      <h2 style={{ margin:'0 0 20px', fontWeight:800, color:'#1a1a2e' }}>Master Outlet</h2>
      <div style={{ display:'grid', gridTemplateColumns:'340px 1fr', gap:20 }}>
        <div style={{ background:'#fff', borderRadius:12, padding:20, boxShadow:'0 1px 4px rgba(0,0,0,.07)', height:'fit-content' }}>
          <h3 style={{ margin:'0 0 16px', fontSize:14, fontWeight:700 }}>Tambah Outlet</h3>
          {[
            { label:'Nama Outlet *', key:'name', ph:'Outlet MOI' },
            { label:'Alamat', key:'address', ph:'Alamat lengkap...' },
            { label:'Nama PIC', key:'pic_name', ph:'Nama penanggung jawab outlet' },
            { label:'No HP PIC', key:'pic_phone', ph:'08xx...' },
            { label:'Jam Operasional', key:'jam_operasional', ph:'10:00 - 21:00' },
            { label:'Catatan Khusus', key:'notes', ph:'Misal: parkir di basement...' },
          ].map(f => (
            <div key={f.key} style={{ marginBottom:12 }}>
              <FieldGroup label={f.label}>
                <input value={form[f.key]} onChange={e => setForm(p => ({...p, [f.key]: e.target.value}))} style={S.input} placeholder={f.ph} />
              </FieldGroup>
            </div>
          ))}
          <Btn onClick={addOutlet} disabled={saving} color="#1a1a2e" style={{ marginTop:4, width:'100%' }}>
            {saving ? 'Menyimpan...' : '+ Tambah Outlet'}
          </Btn>
        </div>
        <div style={{ background:'#fff', borderRadius:12, padding:20, boxShadow:'0 1px 4px rgba(0,0,0,.07)' }}>
          <h3 style={{ margin:'0 0 16px', fontSize:14, fontWeight:700 }}>Daftar Outlet ({outlets.length})</h3>
          {outlets.length === 0 ? <div style={{ textAlign:'center', padding:20, color:'#94a3b8' }}>Belum ada outlet</div>
          : outlets.map(o => (
            <div key={o.id} style={{ padding:'14px 16px', background:'#f8f7f4', borderRadius:10, marginBottom:10 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:14 }}>{o.name}</div>
                  {o.address && <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>📍 {o.address}</div>}
                  {o.pic_name && <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>👤 {o.pic_name} {o.pic_phone && `· ${o.pic_phone}`}</div>}
                  {o.jam_operasional && <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>🕐 {o.jam_operasional}</div>}
                  {o.notes && <div style={{ fontSize:12, color:'#f59e0b', marginTop:2 }}>📝 {o.notes}</div>}
                </div>
                <button onClick={() => deleteOutlet(o.id)} style={{ background:'none', border:'none', color:'#ef4444', cursor:'pointer', fontSize:18 }}>✕</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
