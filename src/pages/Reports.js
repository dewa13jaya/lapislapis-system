import { useState } from 'react';
import { fmtDate, today } from '../utils';

export default function Reports({ products, outlets, orders, stockIn, stockOut, returns }) {
  const [reportType, setReportType] = useState('stok');
  const [dateFrom, setDateFrom] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0,10));
  const [dateTo, setDateTo] = useState(today());

  const inRange = (d) => { const dt = (d||'').slice(0,10); return dt >= dateFrom && dt <= dateTo; };

  // ─── STOK REPORT ───────────────────────────────────────────────────────────
  const stokReport = products.map(p => {
    const masuk  = stockIn.filter(x => x.product_id === p.id && inRange(x.date)).reduce((s,x) => s+Number(x.qty),0);
    const keluar = stockOut.filter(x => x.product_id === p.id && inRange(x.date)).reduce((s,x) => s+Number(x.qty),0);
    const retur  = returns.filter(x => x.product_id === p.id && inRange(x.date) && x.return_type==='retur_outlet').reduce((s,x) => s+Number(x.qty),0);
    const defect = stockOut.filter(x => x.product_id === p.id && inRange(x.date)).reduce((s,x) => s+Number(x.qty),0);
    const orderKeluar = orders.filter(o => o.status==='delivered' || o.status==='partial_delivered')
      .flatMap(o => (o.order_items||[]).filter(i => i.product_id===p.id))
      .reduce((s,i) => s+Number(i.qty_delivered??i.qty),0);
    return { name: p.name, unit: p.unit, masuk, keluar_defect: defect, retur, order_keluar: orderKeluar, saldo: masuk + retur - defect - orderKeluar };
  });

  // ─── ORDER REPORT ──────────────────────────────────────────────────────────
  const orderReport = orders.filter(o => inRange(o.created_at)).map(o => {
    const outlet = outlets.find(x => x.id === o.outlet_id);
    const totalQty = (o.order_items||[]).reduce((s,i) => s+Number(i.qty),0);
    const totalRej = (o.order_items||[]).reduce((s,i) => s+Number(i.qty_rejected||0),0);
    return { order_no: o.order_no, outlet: outlet?.name||'-', tanggal: fmtDate(o.created_at), kirim: fmtDate(o.delivery_date), status: o.status, total_qty: totalQty, total_reject: totalRej, driver: o.driver_name||'-' };
  });

  // ─── RETUR REPORT ──────────────────────────────────────────────────────────
  const returReport = returns.filter(r => inRange(r.date)).map(r => {
    const p = products.find(x => x.id === r.product_id);
    const o = outlets.find(x => x.id === r.outlet_id);
    return { tanggal: fmtDate(r.date), outlet: o?.name||'-', produk: p?.name||'-', qty: r.qty, unit: p?.unit||'-', alasan: r.reason||'-', tipe: r.return_type==='reject_pengiriman' ? 'Reject Pengiriman' : 'Retur Outlet', oleh: r.created_by_name||'-' };
  });

  // ─── DEFECT REPORT ─────────────────────────────────────────────────────────
  const defectReport = stockOut.filter(x => inRange(x.date)).map(x => {
    const p = products.find(pp => pp.id === x.product_id);
    return { tanggal: fmtDate(x.date), produk: p?.name||'-', qty: x.qty, unit: p?.unit||'-', alasan: x.reason||'-', tipe: x.out_type||'-', oleh: x.created_by_name||'-' };
  });

  // ─── EXPORT EXCEL ──────────────────────────────────────────────────────────
  const exportExcel = async () => {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();

    if (reportType === 'stok' || reportType === 'all') {
      const ws = XLSX.utils.aoa_to_sheet([
        ['LAPORAN STOK', '', '', '', '', '', ''],
        ['Periode:', dateFrom + ' s/d ' + dateTo, '', '', '', '', ''],
        [''],
        ['Produk','Satuan','Stok Masuk','Retur dari Outlet','Keluar Defect','Keluar ke Outlet','Saldo'],
        ...stokReport.map(r => [r.name, r.unit, r.masuk, r.retur, r.keluar_defect, r.order_keluar, r.saldo])
      ]);
      XLSX.utils.book_append_sheet(wb, ws, 'Laporan Stok');
    }
    if (reportType === 'order' || reportType === 'all') {
      const ws = XLSX.utils.aoa_to_sheet([
        ['LAPORAN ORDER'],
        ['Periode:', dateFrom + ' s/d ' + dateTo],
        [''],
        ['No Order','Outlet','Tgl Order','Tgl Kirim','Status','Total Qty','Total Reject','Driver'],
        ...orderReport.map(r => [r.order_no, r.outlet, r.tanggal, r.kirim, r.status, r.total_qty, r.total_reject, r.driver])
      ]);
      XLSX.utils.book_append_sheet(wb, ws, 'Laporan Order');
    }
    if (reportType === 'retur' || reportType === 'all') {
      const ws = XLSX.utils.aoa_to_sheet([
        ['LAPORAN RETUR & REJECT'],
        ['Periode:', dateFrom + ' s/d ' + dateTo],
        [''],
        ['Tanggal','Outlet','Produk','Qty','Satuan','Alasan','Tipe','Oleh'],
        ...returReport.map(r => [r.tanggal, r.outlet, r.produk, r.qty, r.unit, r.alasan, r.tipe, r.oleh])
      ]);
      XLSX.utils.book_append_sheet(wb, ws, 'Laporan Retur');
    }
    if (reportType === 'defect' || reportType === 'all') {
      const ws = XLSX.utils.aoa_to_sheet([
        ['LAPORAN DEFECT/RUSAK GUDANG'],
        ['Periode:', dateFrom + ' s/d ' + dateTo],
        [''],
        ['Tanggal','Produk','Qty','Satuan','Alasan','Tipe','Oleh'],
        ...defectReport.map(r => [r.tanggal, r.produk, r.qty, r.unit, r.alasan, r.tipe, r.oleh])
      ]);
      XLSX.utils.book_append_sheet(wb, ws, 'Laporan Defect');
    }
    XLSX.writeFile(wb, `LapisLapis_Laporan_${dateFrom}_${dateTo}.xlsx`);
  };

  // ─── EXPORT PDF ────────────────────────────────────────────────────────────
  const exportPDF = async () => {
    const { default: jsPDF } = await import('jspdf');
    await import('jspdf-autotable');
    const doc = new jsPDF();
    const title = { stok:'Laporan Stok', order:'Laporan Order', retur:'Laporan Retur & Reject', defect:'Laporan Defect/Rusak', all:'Laporan Lengkap' };

    doc.setFontSize(16); doc.setFont('helvetica','bold');
    doc.text('LAPISLAPIS — ' + title[reportType], 14, 18);
    doc.setFontSize(10); doc.setFont('helvetica','normal');
    doc.text('Periode: ' + dateFrom + ' s/d ' + dateTo, 14, 26);
    doc.text('Dicetak: ' + fmtDate(new Date().toISOString()), 14, 32);

    let y = 40;

    if (reportType === 'stok' || reportType === 'all') {
      doc.setFontSize(12); doc.setFont('helvetica','bold'); doc.text('Ringkasan Stok', 14, y); y += 4;
      doc.autoTable({ startY: y, head:[['Produk','Satuan','Masuk','Retur','Defect','Ke Outlet','Saldo']], body: stokReport.map(r => [r.name, r.unit, r.masuk, r.retur, r.keluar_defect, r.order_keluar, r.saldo]), styles:{ fontSize:9 }, headStyles:{ fillColor:[26,26,46] } });
      y = doc.lastAutoTable.finalY + 12;
    }
    if ((reportType === 'order' || reportType === 'all') && y < 260) {
      doc.setFontSize(12); doc.setFont('helvetica','bold'); doc.text('Daftar Order', 14, y); y += 4;
      doc.autoTable({ startY: y, head:[['No Order','Outlet','Tgl Order','Status','Total Qty','Reject']], body: orderReport.map(r => [r.order_no, r.outlet, r.tanggal, r.status, r.total_qty, r.total_reject]), styles:{ fontSize:9 }, headStyles:{ fillColor:[26,26,46] } });
      y = doc.lastAutoTable.finalY + 12;
    }
    if (reportType === 'retur' || reportType === 'all') {
      if (y > 240) { doc.addPage(); y = 20; }
      doc.setFontSize(12); doc.setFont('helvetica','bold'); doc.text('Retur & Reject', 14, y); y += 4;
      doc.autoTable({ startY: y, head:[['Tanggal','Outlet','Produk','Qty','Alasan','Tipe']], body: returReport.map(r => [r.tanggal, r.outlet, r.produk, r.qty, r.alasan, r.tipe]), styles:{ fontSize:9 }, headStyles:{ fillColor:[26,26,46] } });
      y = doc.lastAutoTable.finalY + 12;
    }
    if (reportType === 'defect' || reportType === 'all') {
      if (y > 240) { doc.addPage(); y = 20; }
      doc.setFontSize(12); doc.setFont('helvetica','bold'); doc.text('Defect/Rusak Gudang', 14, y); y += 4;
      doc.autoTable({ startY: y, head:[['Tanggal','Produk','Qty','Alasan','Tipe']], body: defectReport.map(r => [r.tanggal, r.produk, r.qty, r.alasan, r.tipe]), styles:{ fontSize:9 }, headStyles:{ fillColor:[26,26,46] } });
    }
    doc.save(`LapisLapis_Laporan_${dateFrom}_${dateTo}.pdf`);
  };

  const REPORT_TYPES = [
    { id:'stok',   label:'📦 Stok' },
    { id:'order',  label:'🛒 Order' },
    { id:'retur',  label:'🔄 Retur & Reject' },
    { id:'defect', label:'⚠️ Defect/Rusak' },
    { id:'all',    label:'📋 Semua' },
  ];

  return (
    <div>
      <h2 style={{ margin:'0 0 20px', fontWeight:800, color:'#1a1a2e' }}>Laporan</h2>

      {/* Controls */}
      <div style={{ background:'#fff', borderRadius:12, padding:20, boxShadow:'0 1px 4px rgba(0,0,0,.07)', marginBottom:20 }}>
        <div style={{ display:'flex', gap:16, alignItems:'flex-end', flexWrap:'wrap' }}>
          <div>
            <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:4 }}>Jenis Laporan</label>
            <div style={{ display:'flex', gap:6 }}>
              {REPORT_TYPES.map(t => (
                <button key={t.id} onClick={() => setReportType(t.id)} style={{ padding:'8px 12px', fontSize:12, fontWeight:600, background: reportType===t.id ? '#1a1a2e' : '#f1f5f9', color: reportType===t.id ? '#fff' : '#64748b', border:'none', borderRadius:8, cursor:'pointer' }}>{t.label}</button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:4 }}>Dari</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ padding:'9px 12px', border:'1.5px solid #e2e8f0', borderRadius:8, fontSize:13, outline:'none' }} />
          </div>
          <div>
            <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:4 }}>Sampai</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ padding:'9px 12px', border:'1.5px solid #e2e8f0', borderRadius:8, fontSize:13, outline:'none' }} />
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={exportExcel} style={{ padding:'9px 16px', background:'#10b981', color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:600 }}>⬇️ Export Excel</button>
            <button onClick={exportPDF} style={{ padding:'9px 16px', background:'#ef4444', color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:600 }}>⬇️ Export PDF</button>
          </div>
        </div>
      </div>

      {/* Preview */}
      {(reportType === 'stok' || reportType === 'all') && (
        <div style={{ background:'#fff', borderRadius:12, padding:20, boxShadow:'0 1px 4px rgba(0,0,0,.07)', marginBottom:16 }}>
          <h3 style={{ margin:'0 0 14px', fontSize:14, fontWeight:700 }}>📦 Ringkasan Stok — {dateFrom} s/d {dateTo}</h3>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead><tr style={{ background:'#f8f7f4' }}>
                {['Produk','Satuan','Stok Masuk','Retur Masuk','Keluar Defect','Ke Outlet','Saldo'].map((h,i) => (
                  <th key={i} style={{ padding:'10px 12px', textAlign: i>1 ? 'right' : 'left', fontSize:11, color:'#64748b', fontWeight:700, borderBottom:'2px solid #e2e8f0' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {stokReport.map((r,i) => (
                  <tr key={i} style={{ borderBottom:'1px solid #f1f5f9' }}>
                    <td style={{ padding:'10px 12px', fontWeight:600 }}>{r.name}</td>
                    <td style={{ padding:'10px 12px', color:'#64748b' }}>{r.unit}</td>
                    <td style={{ padding:'10px 12px', textAlign:'right', color:'#10b981', fontWeight:600 }}>+{r.masuk}</td>
                    <td style={{ padding:'10px 12px', textAlign:'right', color:'#f59e0b', fontWeight:600 }}>+{r.retur}</td>
                    <td style={{ padding:'10px 12px', textAlign:'right', color:'#ef4444', fontWeight:600 }}>-{r.keluar_defect}</td>
                    <td style={{ padding:'10px 12px', textAlign:'right', color:'#8b5cf6', fontWeight:600 }}>-{r.order_keluar}</td>
                    <td style={{ padding:'10px 12px', textAlign:'right', fontWeight:800, fontSize:15, color: r.saldo <= 0 ? '#ef4444' : '#1a1a2e' }}>{r.saldo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(reportType === 'order' || reportType === 'all') && (
        <div style={{ background:'#fff', borderRadius:12, padding:20, boxShadow:'0 1px 4px rgba(0,0,0,.07)', marginBottom:16 }}>
          <h3 style={{ margin:'0 0 14px', fontSize:14, fontWeight:700 }}>🛒 Laporan Order ({orderReport.length})</h3>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead><tr style={{ background:'#f8f7f4' }}>
                {['No Order','Outlet','Tgl Order','Tgl Kirim','Status','Total Qty','Reject','Driver'].map((h,i) => (
                  <th key={i} style={{ padding:'10px 12px', fontSize:11, color:'#64748b', fontWeight:700, borderBottom:'2px solid #e2e8f0', textAlign:'left' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {orderReport.length === 0 ? <tr><td colSpan={8} style={{ textAlign:'center', padding:20, color:'#94a3b8' }}>Tidak ada data</td></tr>
                : orderReport.map((r,i) => (
                  <tr key={i} style={{ borderBottom:'1px solid #f1f5f9' }}>
                    <td style={{ padding:'10px 12px', fontWeight:600 }}>{r.order_no}</td>
                    <td style={{ padding:'10px 12px' }}>{r.outlet}</td>
                    <td style={{ padding:'10px 12px' }}>{r.tanggal}</td>
                    <td style={{ padding:'10px 12px' }}>{r.kirim}</td>
                    <td style={{ padding:'10px 12px' }}><span style={{ background: r.status==='delivered'?'#d1fae5':r.status==='partial_delivered'?'#fff7ed':'#f1f5f9', color: r.status==='delivered'?'#065f46':r.status==='partial_delivered'?'#9a3412':'#475569', padding:'2px 8px', borderRadius:99, fontSize:11, fontWeight:700 }}>{r.status}</span></td>
                    <td style={{ padding:'10px 12px', textAlign:'right', fontWeight:600 }}>{r.total_qty}</td>
                    <td style={{ padding:'10px 12px', textAlign:'right', color: r.total_reject>0?'#ef4444':'#94a3b8', fontWeight: r.total_reject>0?700:400 }}>{r.total_reject}</td>
                    <td style={{ padding:'10px 12px', color:'#64748b' }}>{r.driver}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(reportType === 'retur' || reportType === 'all') && (
        <div style={{ background:'#fff', borderRadius:12, padding:20, boxShadow:'0 1px 4px rgba(0,0,0,.07)', marginBottom:16 }}>
          <h3 style={{ margin:'0 0 14px', fontSize:14, fontWeight:700 }}>🔄 Laporan Retur & Reject ({returReport.length})</h3>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead><tr style={{ background:'#f8f7f4' }}>
                {['Tanggal','Outlet','Produk','Qty','Alasan','Tipe','Oleh'].map((h,i) => (
                  <th key={i} style={{ padding:'10px 12px', fontSize:11, color:'#64748b', fontWeight:700, borderBottom:'2px solid #e2e8f0', textAlign:'left' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {returReport.length === 0 ? <tr><td colSpan={7} style={{ textAlign:'center', padding:20, color:'#94a3b8' }}>Tidak ada data</td></tr>
                : returReport.map((r,i) => (
                  <tr key={i} style={{ borderBottom:'1px solid #f1f5f9' }}>
                    <td style={{ padding:'10px 12px' }}>{r.tanggal}</td>
                    <td style={{ padding:'10px 12px' }}>{r.outlet}</td>
                    <td style={{ padding:'10px 12px', fontWeight:600 }}>{r.produk}</td>
                    <td style={{ padding:'10px 12px', fontWeight:700, color:'#ef4444' }}>{r.qty} {r.unit}</td>
                    <td style={{ padding:'10px 12px', color:'#64748b' }}>{r.alasan}</td>
                    <td style={{ padding:'10px 12px' }}><span style={{ background:'#fee2e2', color:'#991b1b', padding:'2px 8px', borderRadius:99, fontSize:11, fontWeight:700 }}>{r.tipe}</span></td>
                    <td style={{ padding:'10px 12px', color:'#64748b' }}>{r.oleh}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(reportType === 'defect' || reportType === 'all') && (
        <div style={{ background:'#fff', borderRadius:12, padding:20, boxShadow:'0 1px 4px rgba(0,0,0,.07)' }}>
          <h3 style={{ margin:'0 0 14px', fontSize:14, fontWeight:700 }}>⚠️ Laporan Defect/Rusak Gudang ({defectReport.length})</h3>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead><tr style={{ background:'#f8f7f4' }}>
                {['Tanggal','Produk','Qty','Alasan','Tipe','Oleh'].map((h,i) => (
                  <th key={i} style={{ padding:'10px 12px', fontSize:11, color:'#64748b', fontWeight:700, borderBottom:'2px solid #e2e8f0', textAlign:'left' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {defectReport.length === 0 ? <tr><td colSpan={6} style={{ textAlign:'center', padding:20, color:'#94a3b8' }}>Tidak ada data</td></tr>
                : defectReport.map((r,i) => (
                  <tr key={i} style={{ borderBottom:'1px solid #f1f5f9' }}>
                    <td style={{ padding:'10px 12px' }}>{r.tanggal}</td>
                    <td style={{ padding:'10px 12px', fontWeight:600 }}>{r.produk}</td>
                    <td style={{ padding:'10px 12px', fontWeight:700, color:'#ef4444' }}>{r.qty} {r.unit}</td>
                    <td style={{ padding:'10px 12px', color:'#64748b' }}>{r.alasan}</td>
                    <td style={{ padding:'10px 12px', color:'#64748b', fontSize:12 }}>{r.tipe}</td>
                    <td style={{ padding:'10px 12px', color:'#64748b' }}>{r.oleh}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
