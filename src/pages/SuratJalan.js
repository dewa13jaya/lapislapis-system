import { fmtDate } from '../utils';
import { StatusBadge } from '../components/UI';

function printSJ(order, products, outlets) {
  const outlet = outlets.find(o => o.id === order.outlet_id) || {};
  const rows = (order.order_items||[]).map((item,idx) => {
    const p = products.find(x => x.id === item.product_id) || {};
    const qtyDel = item.qty_delivered ?? item.qty;
    const qtyRej = item.qty_rejected || 0;
    return `<tr>
      <td style="border:1px solid #ccc;padding:8px;text-align:center">${idx+1}</td>
      <td style="border:1px solid #ccc;padding:8px">${p.name||'-'}</td>
      <td style="border:1px solid #ccc;padding:8px;text-align:center">${p.unit||'-'}</td>
      <td style="border:1px solid #ccc;padding:8px;text-align:center">${item.qty}</td>
      <td style="border:1px solid #ccc;padding:8px;text-align:center">${qtyDel}</td>
      <td style="border:1px solid #ccc;padding:8px;text-align:center;color:#ef4444">${qtyRej > 0 ? qtyRej : '-'}</td>
      <td style="border:1px solid #ccc;padding:8px">${qtyRej > 0 ? (item.reject_reason||'-') : ''}</td>
    </tr>`;
  }).join('');
  const emptyRows = Array(Math.max(0, 5-(order.order_items||[]).length)).fill(`<tr>${Array(7).fill('<td style="border:1px solid #ccc;padding:10px">&nbsp;</td>').join('')}</tr>`).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Surat Jalan ${order.order_no}</title>
<style>
  @page{margin:18mm} body{font-family:Arial,sans-serif;font-size:12px;color:#111}
  h1{font-size:20px;margin:0;letter-spacing:2px}
  table{width:100%;border-collapse:collapse;margin-top:10px}
  th{background:#1a1a2e;color:#fff;padding:8px;text-align:center;border:1px solid #ccc;font-size:11px}
  .ttd{display:flex;justify-content:space-between;margin-top:40px}
  .ttd-box{text-align:center;width:150px}
  .ttd-line{border-top:1px solid #333;margin-top:56px;padding-top:4px;font-size:11px}
  @media print{.no-print{display:none}}
</style></head><body>
<button class="no-print" onclick="window.print()" style="margin-bottom:12px;padding:8px 20px;background:#1a1a2e;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px">🖨️ Cetak</button>
<div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1a1a2e;padding-bottom:10px;margin-bottom:10px">
  <div><h1>LAPISLAPIS</h1><div style="font-size:11px;color:#555">Kemayoran, Jakarta Pusat</div></div>
  <div style="text-align:right">
    <div style="font-size:18px;font-weight:bold;color:#1a1a2e">SURAT JALAN</div>
    <div style="font-size:14px;font-weight:bold">${order.order_no}</div>
    <div style="font-size:11px;color:#555;margin-top:2px">Tgl: ${fmtDate(order.delivery_date)}</div>
  </div>
</div>
<table style="border:none;margin-bottom:4px">
  <tr>
    <td style="padding:3px 0;width:50%"><b>Tujuan</b> : ${outlet.name||'-'}</td>
    <td style="padding:3px 0"><b>Driver</b> : ${order.driver_name||'________________'}</td>
  </tr>
  <tr>
    <td style="padding:3px 0"><b>Alamat</b> : ${outlet.address||'-'}</td>
    <td style="padding:3px 0"><b>Kendaraan</b> : ${order.vehicle_no||'________________'}</td>
  </tr>
  <tr>
    <td style="padding:3px 0"><b>PIC Outlet</b> : ${outlet.pic_name||'________________'}</td>
    <td style="padding:3px 0"><b>No. HP PIC</b> : ${outlet.pic_phone||'________________'}</td>
  </tr>
</table>
<table>
  <thead><tr>
    <th style="width:35px">No.</th>
    <th>Nama Produk</th>
    <th style="width:60px">Satuan</th>
    <th style="width:65px">Qty Kirim</th>
    <th style="width:65px">Qty Terima</th>
    <th style="width:65px">Qty Reject</th>
    <th>Alasan Reject</th>
  </tr></thead>
  <tbody>${rows}${emptyRows}</tbody>
</table>
<div style="margin-top:8px;font-size:11px;color:#555">Catatan: ${order.notes||'-'}</div>
<div class="ttd">
  <div class="ttd-box"><div class="ttd-line">Dibuat oleh<br><small>(Tim Produksi)</small></div></div>
  <div class="ttd-box"><div class="ttd-line">Driver/Pengirim</div></div>
  <div class="ttd-box"><div class="ttd-line">Diterima oleh<br><small>(${outlet.name||'Outlet'})</small></div></div>
</div>
</body></html>`;
  const w = window.open('','_blank');
  w.document.write(html);
  w.document.close();
}

export default function SuratJalan({ orders, products, outlets, showToast }) {
  const readyOrders = orders.filter(o => ['confirmed','packed','delivered','partial_delivered'].includes(o.status));

  return (
    <div>
      <h2 style={{ margin:'0 0 8px', fontWeight:800, color:'#1a1a2e' }}>Surat Jalan</h2>
      <p style={{ margin:'0 0 20px', fontSize:13, color:'#64748b' }}>Order yang sudah dikonfirmasi atau dipacking siap cetak. Order yang sudah terkirim juga bisa dicetak ulang.</p>

      {readyOrders.length === 0
        ? <div style={{ background:'#fff', borderRadius:12, padding:48, textAlign:'center', color:'#94a3b8' }}>
            <div style={{ fontSize:48 }}>📋</div>
            <div style={{ fontSize:14, marginTop:8 }}>Belum ada order yang siap cetak</div>
            <div style={{ fontSize:12, marginTop:4 }}>Konfirmasi order di menu Order terlebih dahulu</div>
          </div>
        : readyOrders.map(order => {
          const outlet = outlets.find(o => o.id === order.outlet_id);
          const totalKirim    = (order.order_items||[]).reduce((s,i) => s + Number(i.qty), 0);
          const totalRejected = (order.order_items||[]).reduce((s,i) => s + Number(i.qty_rejected||0), 0);
          return (
            <div key={order.id} style={{ background:'#fff', borderRadius:12, padding:20, boxShadow:'0 1px 4px rgba(0,0,0,.07)', marginBottom:12 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
                    <span style={{ fontWeight:800, fontSize:15 }}>{order.order_no}</span>
                    <StatusBadge status={order.status} />
                  </div>
                  <div style={{ fontSize:13, color:'#374151' }}>🏪 {outlet?.name||'-'}</div>
                  <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>
                    📅 {fmtDate(order.delivery_date)} · 
                    🚗 {order.driver_name||'-'} {order.vehicle_no && `(${order.vehicle_no})`} · 
                    Kirim: {totalKirim} unit
                    {totalRejected > 0 && <span style={{ color:'#ef4444', marginLeft:4 }}>· Reject: {totalRejected} unit</span>}
                  </div>
                </div>
                <button onClick={() => printSJ(order, products, outlets)} style={{ padding:'10px 18px', background:'#1a1a2e', color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:600, display:'flex', alignItems:'center', gap:6 }}>
                  🖨️ Cetak Surat Jalan
                </button>
              </div>
            </div>
          );
        })}
    </div>
  );
}
