import { useAuth } from '../context/AuthContext';
import { RoleBadge } from './UI';

const TABS_BY_ROLE = {
  admin:    ['dashboard','stok','orders','suratjalan','laporan','activitylog','staff','products','outlets'],
  produksi: ['dashboard','stok','orders','suratjalan','products','outlets'],
  sales:    ['dashboard','orders','stok','outlets'],
};

const TAB_LABELS = {
  dashboard:   '📊 Dashboard',
  stok:        '📦 Stok',
  orders:      '🛒 Order',
  suratjalan:  '🚚 Surat Jalan',
  laporan:     '📈 Laporan',
  activitylog: '📝 Activity Log',
  staff:       '👥 Staff',
  products:    '🍰 Produk',
  outlets:     '🏪 Outlet',
};

export default function Header({ tab, setTab }) {
  const { user, logout } = useAuth();
  const tabs = TABS_BY_ROLE[user?.role] || [];

  return (
    <div style={{ background:'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)', color:'#fff', padding:'0 24px' }}>
      <div style={{ maxWidth:1280, margin:'0 auto' }}>
        {/* Top bar */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 0 0' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:38, height:38, background:'#f59e0b', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>🍰</div>
            <div>
              <div style={{ fontWeight:800, fontSize:16, letterSpacing:1 }}>LAPISLAPIS</div>
              <div style={{ fontSize:9, color:'#94a3b8', letterSpacing:2 }}>PRODUCTION & SALES SYSTEM v2</div>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:13, fontWeight:600 }}>{user?.name}</div>
              <div style={{ marginTop:2 }}><RoleBadge role={user?.role} /></div>
            </div>
            <button onClick={logout} style={{ padding:'6px 14px', background:'rgba(255,255,255,.1)', color:'#fff', border:'1px solid rgba(255,255,255,.2)', borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:600 }}>
              Logout
            </button>
          </div>
        </div>
        {/* Tabs */}
        <div style={{ display:'flex', gap:2, marginTop:12, overflowX:'auto', paddingBottom:0 }}>
          {tabs.map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding:'9px 14px', background: tab===t ? '#f59e0b' : 'transparent',
              color: tab===t ? '#1a1a2e' : '#94a3b8', border:'none', borderRadius:'8px 8px 0 0',
              cursor:'pointer', fontWeight: tab===t ? 700 : 500, fontSize:11, whiteSpace:'nowrap', transition:'all .15s'
            }}>{TAB_LABELS[t]}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
