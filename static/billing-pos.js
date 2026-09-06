/* Atom Bills — POS UX helpers (stock, cart, bill seq, void, share) */
(function (w) {
  'use strict';

  async function nextBillNo() {
    if (!w.db) await openDB();
    let row = await getById('settings', 'billSeq');
    let n = row && row.value != null ? +row.value : 0;
    n += 1;
    await put('settings', { key: 'billSeq', value: n });
    return 'AB' + String(n).padStart(4, '0');
  }

  async function getRoundMode() {
    try {
      const row = await getById('settings', 'roundMode');
      return (row && row.value) || 'none'; // none | 1 | 0.5
    } catch (e) {
      return 'none';
    }
  }

  async function setRoundMode(mode) {
    await put('settings', { key: 'roundMode', value: mode });
  }

  function applyRound(amount, mode) {
    const a = +amount || 0;
    if (mode === '1') return Math.round(a);
    if (mode === '0.5') return Math.round(a * 2) / 2;
    return Math.round(a * 100) / 100;
  }

  async function canAddToCart(product, addQty, cart) {
    if (!product || product.id == null) return { ok: true };
    if (String(product.id).startsWith('custom_')) return { ok: true };
    const stock = +(product.stock != null ? product.stock : 0);
    const inCart = (cart || []).filter((c) => +c.id === +product.id).reduce((s, c) => s + (+c.qty || 0), 0);
    const need = inCart + (+addQty || 1);
    if (stock <= 0) return { ok: false, reason: 'Out of stock', stock, need };
    if (need > stock) return { ok: false, reason: 'Only ' + stock + ' in stock', stock, need };
    return { ok: true, stock, need };
  }

  async function addProductToCart(product, cart, qty) {
    qty = +qty || 1;
    const check = await canAddToCart(product, qty, cart);
    if (!check.ok) {
      toast(check.reason || 'Insufficient stock');
      return false;
    }
    const line = cart.find((c) => +c.id === +product.id);
    if (line) line.qty += qty;
    else
      cart.push({
        id: product.id,
        name: product.name,
        price: +product.price || 0,
        qty: qty,
        tax: +product.tax || 0,
      });
    return true;
  }

  function cartLineHtml(c, i) {
    const line = (+c.qty || 0) * (+c.price || 0);
    return (
      '<div class="ti cart-line" data-i="' +
      i +
      '" style="display:flex;align-items:center;gap:10px;padding:12px 0;border-bottom:1px solid #f1f5f9">' +
      '<div style="flex:1;min-width:0"><div style="font-weight:700;font-size:14px">' +
      (c.name || '') +
      '</div>' +
      '<div style="font-size:12px;color:#64748b;margin-top:2px">' +
      fmt(c.price) +
      ' each</div></div>' +
      '<div class="qty-step" style="display:flex;align-items:center;gap:6px">' +
      '<button type="button" class="qbtn qminus" data-i="' +
      i +
      '" style="width:32px;height:32px;border:0;border-radius:8px;background:#f1f5f9;font-weight:800;font-size:16px;cursor:pointer">−</button>' +
      '<span style="min-width:24px;text-align:center;font-weight:800">' +
      c.qty +
      '</span>' +
      '<button type="button" class="qbtn qplus" data-i="' +
      i +
      '" style="width:32px;height:32px;border:0;border-radius:8px;background:#eef2ff;color:#4f46e5;font-weight:800;font-size:16px;cursor:pointer">+</button>' +
      '</div>' +
      '<em style="font-style:normal;font-weight:800;min-width:64px;text-align:right">' +
      fmt(line) +
      '</em></div>'
    );
  }

  async function voidSale(tx) {
    if (!tx || tx.status === 'void') {
      toast('Already void');
      return false;
    }
    const label = tx.billNo || tx.id || 'bill';
    if (!(await appConfirm('Void bill', 'Void ' + label + '? Stock, customer balance and shift totals will reverse.', 'Void', true)))
      return false;
    const prevStatus = tx.status;
    const amount = +tx.amount || 0;
    const received = tx.received != null ? +tx.received : (prevStatus === 'unpaid' ? 0 : amount);
    const balanceDue = tx.balanceDue != null ? +tx.balanceDue : (prevStatus === 'unpaid' || prevStatus === 'partial' ? amount - received : 0);
    tx.status = 'void';
    tx.voidAt = new Date().toISOString();
    tx.prevStatus = prevStatus;
    await put('transactions', tx);
    // Restore stock for every line
    if (Array.isArray(tx.items)) {
      for (const line of tx.items) {
        if (!line.id || String(line.id).startsWith('custom_')) continue;
        try {
          const p = await getById('products', +line.id);
          if (p) {
            p.stock = (p.stock || 0) + (+line.qty || 0);
            await put('products', p);
            await put('inventoryLogs', {
              productId: p.id,
              name: p.name,
              delta: +line.qty || 0,
              reason: 'Void ' + label,
              at: new Date().toISOString(),
            });
          }
        } catch (e) {}
      }
    }
    // Reverse customer udhaar / balance for unpaid or partial
    if (tx.partyId && balanceDue > 0) {
      try {
        const party = await getById('parties', tx.partyId);
        if (party) {
          party.balance = Math.max(0, (party.balance || 0) - balanceDue);
          await put('parties', party);
        }
      } catch (e) {}
    }
    // Reverse shift totals for money actually received
    if (received > 0) {
      try {
        const s = JSON.parse(localStorage.getItem('atom_shift_data') || 'null');
        if (s && s.open) {
          s.sales = Math.max(0, (s.sales || 0) - received);
          const m = (tx.payMethod || 'cash').toLowerCase();
          if (m === 'upi' || m === 'bank' || m === 'card') s.upi = Math.max(0, (s.upi || 0) - received);
          else s.cash = Math.max(0, (s.cash || 0) - received);
          localStorage.setItem('atom_shift_data', JSON.stringify(s));
        }
      } catch (e) {}
    }
    // Audit
    try {
      await put('auditLogs', {
        action: 'void_sale',
        ref: label,
        at: new Date().toISOString(),
        detail: { id: tx.id, amount, received, balanceDue, prevStatus },
      });
    } catch (e) {}
    toast('Voided ' + label);
    return true;
  }

  /** Canvas PNG -> simple single-page PDF (no external lib) */
  function pngDataUrlToPdfBlob(dataUrl, filename) {
    return fetch(dataUrl)
      .then((r) => r.blob())
      .then(
        (blob) =>
          new Promise((res, rej) => {
            const fr = new FileReader();
            fr.onload = () => {
              const u8 = new Uint8Array(fr.result);
              // Minimal PDF wrapping JPEG/PNG is complex; use print-friendly approach:
              // embed as image in a simple PDF using raw PDF with device dimensions
              const w = 400,
                h = 600;
              // Convert to base64 for PDF
              let binary = '';
              for (let i = 0; i < u8.length; i++) binary += String.fromCharCode(u8[i]);
              const b64 = btoa(binary);
              // Actually use image/png stream in PDF — simplified: download PNG renamed if PDF fails
              // Better: create PDF with image XObject
              const pdf = buildMinimalPdfFromPng(u8, w, h);
              res(new Blob([pdf], { type: 'application/pdf' }));
            };
            fr.onerror = rej;
            fr.readAsArrayBuffer(blob);
          })
      );
  }

  function buildMinimalPdfFromPng(pngBytes, pageW, pageH) {
    // Fallback simple PDF with text note if full embed is heavy — use jpeg-style not available
    // Ship a pragmatic PDF: one page, draw image via ASCII hex stream where possible
    // For reliability: create PDF that references external isn't allowed offline
    // Use a tiny valid PDF saying "see image" OR proper PNG embed
    const img = pngBytes;
    const objs = [];
    let pdf = '%PDF-1.4\n';
    const offsets = [0];
    function addObj(s) {
      offsets.push(pdf.length);
      pdf += s;
    }
    addObj('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
    addObj('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
    addObj(
      '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' +
        pageW +
        ' ' +
        pageH +
        '] /Contents 4 0 R /Resources << /XObject << /Im0 5 0 R >> >> >>\nendobj\n'
    );
    const content = 'q\n' + pageW + ' 0 0 ' + pageH + ' 0 0 cm\n/Im0 Do\nQ\n';
    addObj('4 0 obj\n<< /Length ' + content.length + ' >>\nstream\n' + content + 'endstream\nendobj\n');
    addObj(
      '5 0 obj\n<< /Type /XObject /Subtype /Image /Width ' +
        pageW +
        ' /Height ' +
        pageH +
        ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ' +
        img.length +
        ' >>\nstream\n'
    );
    // PNG filter wrong for raw — browsers may not render. Prefer download of PNG + share PDF via print.
    // Simpler reliable path used by shareInvoicePdf:
    return null;
  }

  async function shareInvoicePdf(dataUrl, billNo) {
    const name = (billNo || 'invoice') + '.pdf';
    // Build PDF via browser print pipeline alternative: canvas -> blob png inside html2pdf-less approach
    // Use multi-part: create blob from canvas as PNG and also offer PDF via jspdf-less minimal writer
    try {
      const res = await fetch(dataUrl);
      const pngBlob = await res.blob();
      // Create a simple PDF using embed of PNG as uncompressed is hard; use File of PNG with application/pdf only if we generate properly
      // Practical approach: open print window with the image for Save as PDF, AND share PNG+text via WhatsApp
      const img = await createImageBitmap(pngBlob).catch(() => null);
      const w = img ? img.width : 400;
      const h = img ? img.height : 600;
      // Write a minimal PDF with the image as an embedded file annotation is overkill
      // Generate PDF with pdf-lib style manual stream — use JPEG conversion via canvas
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (img) ctx.drawImage(img, 0, 0);
      else {
        const im = new Image();
        await new Promise((r, j) => {
          im.onload = r;
          im.onerror = j;
          im.src = dataUrl;
        });
        canvas.width = im.width;
        canvas.height = im.height;
        ctx.drawImage(im, 0, 0);
      }
      const jpeg = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.92));
      const jbuf = new Uint8Array(await jpeg.arrayBuffer());
      const pdfBytes = jpegToPdf(jbuf, canvas.width, canvas.height);
      const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
      const file = new File([pdfBlob], name, { type: 'application/pdf' });
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: billNo || 'Invoice' });
        return true;
      }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(pdfBlob);
      a.download = name;
      a.click();
      URL.revokeObjectURL(a.href);
      toast('PDF downloaded');
      return true;
    } catch (e) {
      console.warn(e);
      toast('PDF share failed — try PNG');
      return false;
    }
  }

  function jpegToPdf(jpeg, imgW, imgH) {
    // Scale to fit A4-ish width 595pt
    const pageW = 420;
    const pageH = Math.round((imgH / imgW) * pageW);
    const chunks = [];
    const enc = new TextEncoder();
    function str(s) {
      chunks.push(enc.encode(s));
    }
    function bin(u8) {
      chunks.push(u8);
    }
    str('%PDF-1.4\n');
    const offsets = [];
    function mark() {
      let o = 0;
      for (const c of chunks) o += c.length;
      offsets.push(o);
    }
    mark();
    str('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
    mark();
    str('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
    mark();
    str(
      '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' +
        pageW +
        ' ' +
        pageH +
        '] /Contents 4 0 R /Resources << /XObject << /Im0 5 0 R >> >> >>\nendobj\n'
    );
    mark();
    const content = 'q\n' + pageW + ' 0 0 ' + pageH + ' 0 0 cm\n/Im0 Do\nQ\n';
    str('4 0 obj\n<< /Length ' + content.length + ' >>\nstream\n' + content + 'endstream\nendobj\n');
    mark();
    str(
      '5 0 obj\n<< /Type /XObject /Subtype /Image /Width ' +
        imgW +
        ' /Height ' +
        imgH +
        ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' +
        jpeg.length +
        ' >>\nstream\n'
    );
    bin(jpeg);
    str('\nendstream\nendobj\n');
    const xrefStart = chunks.reduce((s, c) => s + c.length, 0);
    str('xref\n0 6\n0000000000 65535 f \n');
    for (let i = 0; i < 5; i++) {
      str(String(offsets[i]).padStart(10, '0') + ' 00000 n \n');
    }
    str('trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + xrefStart + '\n%%EOF');
    let total = 0;
    for (const c of chunks) total += c.length;
    const out = new Uint8Array(total);
    let p = 0;
    for (const c of chunks) {
      out.set(c, p);
      p += c.length;
    }
    return out;
  }

  function whatsappBillLink(tx) {
    const lines = [];
    lines.push('*' + (tx.billNo || tx.id || 'Bill') + '*');
    lines.push((tx.title || 'Sale') + ' · ' + (tx.date || '').slice(0, 16).replace('T', ' '));
    if (Array.isArray(tx.items)) {
      tx.items.forEach((it) => {
        lines.push((it.name || '') + ' x' + (it.qty || 0) + ' = ₹' + ((+it.qty || 0) * (+it.price || 0)).toFixed(2));
      });
    }
    lines.push('Total: *₹' + Number(tx.amount || 0).toLocaleString('en-IN') + '*');
    if (tx.status) lines.push('Status: ' + tx.status);
    const text = encodeURIComponent(lines.join('\n'));
    return 'https://wa.me/?text=' + text;
  }

  w.AtomPOS = {
    nextBillNo,
    getRoundMode,
    setRoundMode,
    applyRound,
    canAddToCart,
    addProductToCart,
    cartLineHtml,
    voidSale,
    shareInvoicePdf,
    whatsappBillLink,
  };
})(window);
