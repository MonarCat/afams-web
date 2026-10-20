/*!
 * pos-print.js — quick receipt printing for 58mm thermal POS (Sunmi V2 Pro)
 * Standalone, no dependencies. Drop into assets/js/ and include with:
 *   <script src="assets/js/pos-print.js"></script>
 *
 * USAGE
 *   PosPrint.print({
 *     id: 'AF-0001',                 // optional; auto-generated if omitted
 *     cashier: 'Monar',              // optional
 *     method: 'M-Pesa',              // 'Cash' | 'M-Pesa' | 'Card' ...
 *     items: [
 *       { name: 'GrowBag Starter', qty: 2, price: 1200 },
 *       { name: 'Seed Pack',       qty: 1, price: 150  }
 *     ],
 *     discount: 0,                   // optional, KES
 *     paid: 3000                     // optional; enables Change line (cash)
 *   });                              // default method: 'browser'
 *
 *   PosPrint.print(sale, { method: 'rawbt' });   // ESC/POS via RawBT app
 *
 * METHODS
 *   'browser' — 58mm-styled HTML via window.print() in a hidden iframe.
 *               Needs the Sunmi print service as the Android default printer.
 *   'rawbt'   — raw ESC/POS bytes handed to the free RawBT app, which
 *               prints straight to the built-in Sunmi printer (fastest,
 *               no print dialog, most reliable from a web page).
 */
(function (global) {
  'use strict';

  var CONFIG = {
    business: 'AFAMS LIMITED',
    tagline: 'Urban Agri-Lifestyle',
    phone: '0714 128 514',
    web: 'afams.co.ke',
    pin: '',                              // optional KRA PIN line
    footer: 'Thank you for shopping with us!',
    currency: 'KES',
    cols: 32,                             // 58mm @ Font A = 32 chars/line
    feedLinesAtEnd: 4                     // Sunmi V2 Pro has no cutter; feed to tear
  };

  // ---------- helpers ----------
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(n) {
    return Number(n || 0).toLocaleString('en-KE', { maximumFractionDigits: 2 });
  }
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function stamp(d) {
    d = d || new Date();
    return pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + '/' + d.getFullYear() +
      ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }
  function autoId() {
    var d = new Date();
    return 'R' + String(d.getFullYear()).slice(2) + pad2(d.getMonth() + 1) + pad2(d.getDate()) +
      '-' + pad2(d.getHours()) + pad2(d.getMinutes()) + pad2(d.getSeconds());
  }

  function totals(sale) {
    var sub = 0;
    (sale.items || []).forEach(function (it) { sub += (Number(it.qty) || 0) * (Number(it.price) || 0); });
    var discount = Number(sale.discount) || 0;
    var total = Math.max(0, sub - discount);
    var paid = sale.paid != null ? Number(sale.paid) : null;
    var change = paid != null ? Math.max(0, paid - total) : null;
    return { subtotal: sub, discount: discount, total: total, paid: paid, change: change };
  }

  // ---------- 1) Browser / HTML print ----------
  function buildHTML(sale) {
    var t = totals(sale);
    var rows = (sale.items || []).map(function (it) {
      var line = (Number(it.qty) || 0) * (Number(it.price) || 0);
      return '<div class="it"><div class="nm">' + esc(it.name) + '</div>' +
        '<div class="row"><span>' + esc(it.qty) + ' x ' + money(it.price) + '</span><span>' + money(line) + '</span></div></div>';
    }).join('');

    return '<!doctype html><html><head><meta charset="utf-8"><title>Receipt</title><style>' +
      '@page{size:58mm auto;margin:0}' +
      '*{box-sizing:border-box}' +
      'html,body{margin:0;padding:0;background:#fff}' +
      'body{width:48mm;margin:0 auto;padding:2mm 0 6mm;font:12px/1.35 "Courier New",monospace;color:#000}' +
      '.c{text-align:center}.b{font-weight:700}.big{font-size:15px}' +
      '.row{display:flex;justify-content:space-between;gap:4px}' +
      '.nm{word-break:break-word}.it{margin:2px 0}' +
      'hr{border:0;border-top:1px dashed #000;margin:4px 0}' +
      '.tot{font-size:14px;font-weight:700}' +
      '</style></head><body>' +
      '<div class="c b big">' + esc(CONFIG.business) + '</div>' +
      (CONFIG.tagline ? '<div class="c">' + esc(CONFIG.tagline) + '</div>' : '') +
      '<div class="c">' + esc(CONFIG.phone) + ' | ' + esc(CONFIG.web) + '</div>' +
      (CONFIG.pin ? '<div class="c">PIN: ' + esc(CONFIG.pin) + '</div>' : '') +
      '<hr>' +
      '<div class="row"><span>Rcpt: ' + esc(sale.id) + '</span></div>' +
      '<div>' + esc(stamp(sale.date ? new Date(sale.date) : new Date())) + '</div>' +
      (sale.cashier ? '<div>Served by: ' + esc(sale.cashier) + '</div>' : '') +
      '<hr>' + rows + '<hr>' +
      (t.discount ? '<div class="row"><span>Subtotal</span><span>' + money(t.subtotal) + '</span></div>' +
        '<div class="row"><span>Discount</span><span>-' + money(t.discount) + '</span></div>' : '') +
      '<div class="row tot"><span>TOTAL ' + esc(CONFIG.currency) + '</span><span>' + money(t.total) + '</span></div>' +
      '<div class="row"><span>Paid by</span><span>' + esc(sale.method || 'Cash') + '</span></div>' +
      (t.paid != null ? '<div class="row"><span>Tendered</span><span>' + money(t.paid) + '</span></div>' +
        '<div class="row"><span>Change</span><span>' + money(t.change) + '</span></div>' : '') +
      '<hr><div class="c">' + esc(CONFIG.footer) + '</div></body></html>';
  }

  function printBrowser(sale) {
    var iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    document.body.appendChild(iframe);
    var doc = iframe.contentWindow.document;
    doc.open(); doc.write(buildHTML(sale)); doc.close();

    var done = false;
    function cleanup() {
      if (done) return; done = true;
      setTimeout(function () { if (iframe.parentNode) iframe.parentNode.removeChild(iframe); }, 500);
    }
    function go() {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.onafterprint = cleanup;
        iframe.contentWindow.print();
      } finally { setTimeout(cleanup, 60000); }
    }
    // let layout settle before printing
    setTimeout(go, 250);
  }

  // ---------- 2) ESC/POS via RawBT ----------
  function ascii(s) {
    // thermal printers' default code page is not UTF-8; keep it plain ASCII
    return String(s == null ? '' : s)
      .replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2013\u2014]/g, '-').replace(/[^\x20-\x7E]/g, '?');
  }
  function twoCol(l, r, cols) {
    l = ascii(l); r = ascii(r);
    var gap = cols - l.length - r.length;
    if (gap < 1) { l = l.slice(0, Math.max(0, cols - r.length - 1)); gap = cols - l.length - r.length; }
    return l + new Array(gap + 1).join(' ') + r;
  }
  function wrap(s, cols) {
    s = ascii(s); var out = [];
    while (s.length > cols) {
      var cut = s.lastIndexOf(' ', cols);
      if (cut < 1) cut = cols;
      out.push(s.slice(0, cut)); s = s.slice(cut).replace(/^ /, '');
    }
    out.push(s); return out;
  }

  function buildEscPos(sale) {
    var C = CONFIG.cols, t = totals(sale), bytes = [];
    function raw() { for (var i = 0; i < arguments.length; i++) bytes.push(arguments[i]); }
    function text(s) { for (var i = 0; i < s.length; i++) bytes.push(s.charCodeAt(i) & 0xFF); }
    function line(s) { text(s); raw(0x0A); }
    function align(n) { raw(0x1B, 0x61, n); }     // 0 left, 1 center, 2 right
    function bold(on) { raw(0x1B, 0x45, on ? 1 : 0); }
    function size(n) { raw(0x1D, 0x21, n); }      // 0x00 normal, 0x11 double w+h
    var dash = new Array(C + 1).join('-');

    raw(0x1B, 0x40);                              // init
    align(1); bold(true); size(0x11);
    wrap(CONFIG.business, C / 2).forEach(line);
    size(0); bold(false);
    if (CONFIG.tagline) line(ascii(CONFIG.tagline));
    line(ascii(CONFIG.phone + ' | ' + CONFIG.web));
    if (CONFIG.pin) line('PIN: ' + ascii(CONFIG.pin));
    align(0); line(dash);
    line('Rcpt: ' + ascii(sale.id));
    line(stamp(sale.date ? new Date(sale.date) : new Date()));
    if (sale.cashier) line('Served by: ' + ascii(sale.cashier));
    line(dash);

    (sale.items || []).forEach(function (it) {
      wrap(it.name, C).forEach(line);
      var amt = (Number(it.qty) || 0) * (Number(it.price) || 0);
      line(twoCol('  ' + it.qty + ' x ' + money(it.price), money(amt), C));
    });

    line(dash);
    if (t.discount) {
      line(twoCol('Subtotal', money(t.subtotal), C));
      line(twoCol('Discount', '-' + money(t.discount), C));
    }
    bold(true); size(0x01);                       // double height only (keeps 32 cols)
    line(twoCol('TOTAL ' + CONFIG.currency, money(t.total), C));
    size(0); bold(false);
    line(twoCol('Paid by', sale.method || 'Cash', C));
    if (t.paid != null) {
      line(twoCol('Tendered', money(t.paid), C));
      line(twoCol('Change', money(t.change), C));
    }
    line(dash);
    align(1);
    wrap(CONFIG.footer, C).forEach(line);
    raw(0x1B, 0x64, CONFIG.feedLinesAtEnd);       // feed to tear bar
    return new Uint8Array(bytes);
  }

  function toBase64(u8) {
    var s = ''; for (var i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
    return btoa(s);
  }
  function printRawBT(sale) {
    // Opens the RawBT Android app, which sends the bytes to the built-in printer.
    window.location.href = 'rawbt:base64,' + toBase64(buildEscPos(sale));
  }

  // ---------- public API ----------
  function print(sale, opts) {
    if (!sale || !Array.isArray(sale.items) || !sale.items.length) {
      throw new Error('PosPrint: sale.items is required');
    }
    sale = Object.assign({}, sale, { id: sale.id || autoId() });
    var method = (opts && opts.method) || 'browser';
    if (method === 'rawbt') printRawBT(sale); else printBrowser(sale);
    return sale.id;
  }

  global.PosPrint = {
    config: CONFIG,            // tweak at runtime: PosPrint.config.pin = '...'
    print: print,
    buildHTML: buildHTML,      // for previews
    buildEscPos: buildEscPos   // raw bytes, if you later add Web Bluetooth/USB
  };
})(window);
