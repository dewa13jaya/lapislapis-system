import { StatusBadge } from '../components/UI';
import { fmtDate, today } from '../utils';

export default function Dashboard({ products, currentStock, orders, stockIn, returns, outlets, stockOut }) {
  const pendingOrders = orders.filter(o => o.status === 'pending').length;
  const packedOrders  = orders.filter(o => o.status === 'packed').length;
  const todayOrders   = orders.filter(o => o.created_at?.slice(0,10) === today()).length;
  const totalRetur    = returns.reduce((s,x) => s + Number(x.qty), 0);
  const lowStock      = products.filter(p => (currentStock[p.id]||0) <= (p.stok_minimum||5) && (currentStock[p.id]||0) > 0).length;
  const emptyStock    = products.filter(p => (currentStock[p.id]||0) <= 0).length;

  const cards = [
    { label:'Order Pending',   value: pendingOrders, icon:'⏳', color:'#f59e0b' },
    { label:'Siap Kirim',      value: packedOrders,  icon:'📦', color:'#8b5cf6' },
    { label:'Order Hari Ini',  value: todayOrders,   icon:'📋', color:'#3b82f6' },
    { label:'Stok Hampir Habis', value: lowStock + emptyStock, icon:'⚠️', color:'#ef4444' },
  ];

  const recentOrders = orders.slice(0, 6);

  return (
    <div>
      <h2 style={{ margin:'0 0 20px', fontWeight:800, color:'#1a1a2e' }}>Dashboard</h2>

      {/* Alert stok habis */}
      {emptyStock > 0 && (
        <div style={{ background:'#fee2e2', border:'1px solid #fca5a5', borderRadius:10, padding:'12px 16px', marginBottom:20, display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:20 }}>🚨</span>
          <div>
            <div style={{ fontWeight:700, color:'#991b1b', fontSize:13 }}>Stok Habis!</div>
            <div style={{ fontSize:12, color:'#b91c1c' }}>{products.filter(p => (currentStock[p.id]||0) <= 0).map(p => p.name).join(', ')}</div>
          </div>
        </div>
      )}

      {/* Stat Cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:24 }}>
        {cards.map(c => (
          <div key={c.label} style={{ background:'#fff', borderRadius:12, padding:20, boxShadow:'0 1px 4px rgba(0,0,0,.07)', borderLeft:`4px solid ${c.color}` }}>
            <div style={{ fontSize:26 }}>{c.icon}</div>
            <div style={{ fontSize:30, fontWeight:800, color:c.color, margin:'4px 0' }}>{c.value}</div>
            <div style={{ fontSize:12, color:'#64748b' }}>{c.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        {/* Stock table */}
        <div style={{ background:'#fff', borderRadius:12, padding:20, boxShadow:'0 1px 4px rgba(0,0,0,.07)' }}>
          <h3 style={{ margin:'0 0 16px', fontSize:14, fontWeight:700 }}>📦 Stok Saat Ini</h3>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead><tr style={{ background:'#f8f7f4' }}>
              <th style={{ padding:'8px 10px', textAlign:'left', fontSize:11, color:'#64748b', fontWeight:700 }}>Produk</th>
              <th style={{ padding:'8px 10px', textAlign:'right', fontSize:11, color:'#64748b', fontWeight:700 }}>Stok</th>
              <th style={{ padding:'8px 10px', textAlign:'center', fontSize:11, color:'#64748b', fontWeight:700 }}>Status</th>
            </tr></thead>
            <tbody>
              {products.length === 0
                ? <tr><td colSpan={3} style={{ textAlign:'center', padding:20, color:'#94a3b8', fontSize:12 }}>Belum ada produk</td></tr>
                : products.map(p => {
                  const stock = currentStock[p.id] || 0;
                  const min   = p.stok_minimum || 5;
                  const sc    = stock <= 0 ? '#ef4444' : stock <= min ? '#f59e0b' : '#10b981';
                  const sl    = stock <= 0 ? 'Habis' : stock <= min ? 'Hampir Habis' : 'Tersedia';
                  return (
                    <tr key={p.id} style={{ borderBottom:'1px solid #f1f5f9' }}>
                      <td style={{ padding:'10px', fontSize:13 }}>{p.name}</td>
                      <td style={{ padding:'10px', textAlign:'right', fontWeight:700, fontSize:13 }}>{stock} <span style={{ fontSize:10, color:'#94a3b8' }}>{p.unit}</span></td>
                      <td style={{ padding:'10px', textAlign:'center' }}>
                        <span style={{ background: sc+'20', color:sc, padding:'2px 8px', borderRadius:99, fontSize:10, fontWeight:700 }}>{sl}</span>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {/* Recent orders */}
        <div style={{ background:'#fff', borderRadius:12, padding:20, boxShadow:'0 1px 4px rgba(0,0,0,.07)' }}>
          <h3 style={{ margin:'0 0 16px', fontSize:14, fontWeight:700 }}>🛒 Order Terbaru</h3>
          {recentOrders.length === 0
            ? <div style={{ color:'#94a3b8', fontSize:13, textAlign:'center', padding:20 }}>Belum ada order</div>
            : recentOrders.map(o => {
              const outlet = outlets.find(x => x.id === o.outlet_id);
              return (
                <div key={o.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 12px', background:'#f8f7f4', borderRadius:8, marginBottom:8 }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:600 }}>{o.order_no}</div>
                    <div style={{ fontSize:11, color:'#64748b' }}>{outlet?.name||'-'} · {fmtDate(o.created_at)}</div>
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
