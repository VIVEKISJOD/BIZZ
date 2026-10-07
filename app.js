import { qrSvg } from './qr-generator.js';

const K = 'orderdesk.v1';
const def = { settings: { shop: 'My Shop', upi: '', pinOn: false, pin: '', theme: 'light' }, partners: [], rates: [], orders: [] };
let db;
try { db = { ...def, ...JSON.parse(localStorage.getItem(K) || '{}') }; } catch { db = structuredClone(def); }
db.settings = { ...def.settings, ...db.settings };
const save = () => localStorage.setItem(K, JSON.stringify(db));
const $ = s => document.querySelector(s);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const inr = n => '₹' + (Number(n) || 0).toLocaleString('en-IN');
const today = () => new Date().toISOString().slice(0, 10);
const toast = m => { const t = $('#toast'); t.textContent = m; t.classList.add('on'); setTimeout(() => t.classList.remove('on'), 2200); };
const STAT = ['Picked', 'Sent', 'Received', 'Delivered'];
const TABS = [['orders', '📦', 'Orders'], ['vendors', '🧑‍🔧', 'Vendors'], ['rates', '💰', 'Rates'], ['cats', '📊', 'Categories'], ['settings', '⚙️', 'Settings']];
let tab = 'orders', filter = 'All', selCat = null, selVendor = null;
const due = o => (+o.total || 0) - (+o.advance || 0);
const allCats = () => [...new Set([...db.partners, ...db.rates, ...db.orders].map(x => (x.category || '').trim()).filter(Boolean))].sort();
const pname = id => (db.partners.find(p => p.id === id) || {}).name || '—';

/* ---------- generic form sheet ---------- */
function form(title, fields, cb, extra = '', after) {
  const m = $('#modal'); m.hidden = false;
  m.innerHTML = `<div class="sheet"><h3>${title}</h3><form id="f">${fields.map(([k, l, t, v, o]) => {
    if (t === 'select') return `<label>${l}<select name="${k}">${o.map(x => { x = Array.isArray(x) ? x : [x, x]; return `<option value="${esc(x[0])}" ${x[0] == v ? 'selected' : ''}>${esc(x[1])}</option>`; }).join('')}</select></label>`;
    return `<label>${l}<input name="${k}" type="${t}" value="${esc(v)}" ${o ? `list="dl-${k}"` : ''} ${t === 'number' ? 'step="any" inputmode="decimal"' : ''}>${o ? `<datalist id="dl-${k}">${o.map(x => `<option value="${esc(x)}">`).join('')}</datalist>` : ''}</label>`;
  }).join('')}<div class="row"><button class="btn" id="save" type="submit">Save</button>${extra}<button class="btn ghost" type="button" id="x">Cancel</button></div></form></div>`;
  $('#x').onclick = closeModal;
  $('#f').onsubmit = e => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    if (cb(d, e.submitter && e.submitter.id) !== false) closeModal();
  };
  if (after) after($('#f'));
}
const closeModal = () => { $('#modal').hidden = true; $('#modal').innerHTML = ''; };

/* ---------- WhatsApp & bill ---------- */
function wa(o) {
  const s = db.settings;
  const t = [`*${s.shop}* - Bill`, `Customer: ${o.name}`, o.address ? `Address: ${o.address}` : '',
    `Item: ${o.item}${o.service ? ' (' + o.service + ')' : ''}`, `Picked up: ${o.pickup || '-'}`,
    `Return/Delivery: ${o.returned || o.expected || '-'}`, `Total: ${inr(o.total)}`, `Advance: ${inr(o.advance)}`,
    `*Balance due: ${inr(due(o))}*`, o.paid ? `Paid on: ${o.paid} (${o.mode})` : `Payment mode: ${o.mode}`,
    s.upi ? `UPI: ${s.upi}` : '', 'Thank you!'].filter(Boolean).join('\n');
  let p = (o.phone || '').replace(/\D/g, ''); if (p.length === 10) p = '91' + p;
  window.open(`https://wa.me/${p}?text=${encodeURIComponent(t)}`, '_blank');
}
function bill(o) {
  const s = db.settings, amt = due(o) > 0 ? due(o) : +o.total || 0;
  let qr = '<p class="mu">Add your UPI ID in Settings to show a QR.</p>';
  if (s.upi && amt > 0) {
    try { qr = `<div class="qr">${qrSvg(`upi://pay?pa=${s.upi}&pn=${encodeURIComponent(s.shop.slice(0, 20))}&am=${amt.toFixed(2)}&cu=INR&tn=${encodeURIComponent('Bill ' + o.item.slice(0, 15))}`)}<div class="mu">Scan to pay ${inr(amt)}</div></div>`; }
    catch { qr = '<p class="mu">QR failed (text too long). Shorten shop name / item.</p>'; }
  }
  const next = STAT[STAT.indexOf(o.status) + 1];
  const m = $('#modal'); m.hidden = false;
  m.innerHTML = `<div class="sheet"><h3>${esc(o.name)} · ${esc(o.item)}</h3>
  <p class="mu">${esc(o.phone)} ${esc(o.address)}<br>Picked ${o.pickup || '-'} · Expected ${o.expected || '-'} · Returned ${o.returned || '-'} · Paid ${o.paid || '-'}</p>
  <table><tr><td>Total</td><td>${inr(o.total)}</td></tr><tr><td>Advance (${esc(o.mode)})</td><td>${inr(o.advance)}</td></tr><tr><td><b>Balance due</b></td><td class="due">${inr(due(o))}</td></tr>
  <tr><td>Outsource: ${esc(pname(o.partnerId))}</td><td>${inr(o.outCost)} (profit ${inr(o.total - o.outCost)})</td></tr></table>${qr}
  <div class="row">${next ? `<button class="btn" id="nx">Mark ${next}</button>` : ''}<button class="btn alt" id="w">WhatsApp</button><button class="btn ghost" id="ed">Edit</button><button class="btn danger" id="dl">Delete</button><button class="btn ghost" id="x">Close</button></div></div>`;
  $('#x').onclick = closeModal; $('#w').onclick = () => wa(o);
  $('#ed').onclick = () => orderForm(o);
  $('#dl').onclick = () => { if (confirm('Delete this order?')) { db.orders = db.orders.filter(x => x.id !== o.id); save(); closeModal(); render(); } };
  if (next) $('#nx').onclick = () => {
    o.status = next; if (next === 'Delivered' && !o.returned) o.returned = today();
    save(); render(); bill(o);
  };
}

/* ---------- forms ---------- */
function orderForm(o = {}) {
  form(o.id ? 'Edit order' : 'New order', [
    ['name', 'Customer name', 'text', o.name || ''], ['phone', 'Phone', 'tel', o.phone || ''], ['address', 'Delivery address', 'text', o.address || ''],
    ['item', 'Item', 'text', o.item || ''], ['service', 'Service (standard rates)', 'text', o.service || '', db.rates.map(r => r.service)],
    ['category', 'Category', 'text', o.category || '', allCats()],
    ['partnerId', 'Outsource partner', 'select', o.partnerId || '', [['', '— none —'], ...db.partners.map(p => [p.id, p.name])]],
    ['outCost', 'Outsource cost ₹', 'number', o.outCost ?? ''], ['total', 'Total bill ₹', 'number', o.total ?? ''], ['advance', 'Advance received ₹', 'number', o.advance ?? ''],
    ['mode', 'Payment mode', 'select', o.mode || 'Cash', ['Cash', 'UPI']],
    ['pickup', 'Pickup date', 'date', o.pickup || today()], ['expected', 'Expected return date', 'date', o.expected || ''],
    ['returned', 'Actual return/delivery date', 'date', o.returned || ''], ['paid', 'Payment date', 'date', o.paid || ''],
    ['status', 'Status', 'select', o.status || 'Picked', STAT]
  ], (d, s) => {
    if (!d.name.trim() || !d.item.trim()) { toast('Name and item are required'); return false; }
    const n = { ...o, ...d, outCost: +d.outCost || 0, total: +d.total || 0, advance: +d.advance || 0, id: o.id || uid() };
    db.orders = o.id ? db.orders.map(x => x.id === o.id ? n : x) : [n, ...db.orders];
    save(); render(); toast('Saved'); if (s === 'wa') wa(n);
  }, '<button class="btn alt" id="wa" type="submit">Save & WhatsApp</button>', f => {
    f.service.addEventListener('change', () => {
      const r = db.rates.find(x => x.service === f.service.value); if (!r) return;
      if (!f.total.value) f.total.value = r.rate; if (!f.outCost.value) f.outCost.value = r.cost || 0; if (!f.category.value) f.category.value = r.category || '';
    });
  });
}
function vendorForm(p = {}) {
  form(p.id ? 'Edit vendor' : 'New vendor', [['name', 'Business / worker name', 'text', p.name || ''], ['phone', 'Phone', 'tel', p.phone || ''],
    ['category', 'Category', 'text', p.category || '', allCats()], ['notes', 'Notes', 'text', p.notes || '']], d => {
    if (!d.name.trim()) { toast('Name required'); return false; }
    const n = { ...p, ...d, id: p.id || uid() };
    db.partners = p.id ? db.partners.map(x => x.id === p.id ? n : x) : [...db.partners, n]; save(); render();
  });
}
function rateForm(r = {}) {
  form(r.id ? 'Edit rate' : 'New standard rate', [['service', 'Service (e.g. Hemming)', 'text', r.service || ''], ['category', 'Category', 'text', r.category || '', allCats()],
    ['rate', 'Customer rate ₹', 'number', r.rate ?? ''], ['cost', 'Outsource cost ₹', 'number', r.cost ?? '']], d => {
    if (!d.service.trim()) { toast('Service required'); return false; }
    const n = { ...r, ...d, rate: +d.rate || 0, cost: +d.cost || 0, id: r.id || uid() };
    db.rates = r.id ? db.rates.map(x => x.id === r.id ? n : x) : [...db.rates, n]; save(); render();
  });
}

/* ---------- views ---------- */
const views = {
  orders(v) {
    const list = db.orders.filter(o => filter === 'All' || o.status === filter);
    v.innerHTML = `<div class="chips">${['All', ...STAT].map(s => `<button class="chip ${s === filter ? 'on' : ''}" data-f="${s}">${s}</button>`).join('')}</div>` +
      (list.map(o => `<div class="card tap" data-o="${o.id}"><div class="between"><b>${esc(o.name)}</b><span class="badge ${o.status}">${o.status}</span></div>
      <div>${esc(o.item)} <span class="mu">${esc(o.service)}</span></div><div class="between mu"><span>Pick ${o.pickup || '-'} → ${o.returned || o.expected || '-'}</span>
      ${o.paid ? '<span class="ok">Paid</span>' : `<span class="due">Due ${inr(due(o))}</span>`}</div></div>`).join('') || '<p class="mu">No orders yet. Tap + to add one.</p>') + '<button class="fab" id="add">+</button>';
    v.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { filter = b.dataset.f; render(); });
    v.querySelectorAll('[data-o]').forEach(c => c.onclick = () => bill(db.orders.find(o => o.id === c.dataset.o)));
    $('#add').onclick = () => orderForm();
  },
  vendors(v) {
    v.innerHTML = db.partners.map(p => `<div class="card"><div class="between"><b>${esc(p.name)}</b><span class="badge">${esc(p.category || 'General')}</span></div><div class="mu">${esc(p.phone)} ${esc(p.notes)}</div>
      <button data-e="${p.id}">Edit</button><button class="danger" data-d="${p.id}">Delete</button></div>`).join('') || '<p class="mu">No outsource partners yet.</p>' + '<button class="fab" id="add">+</button>';
    if (db.partners.length) v.insertAdjacentHTML('beforeend', '<button class="fab" id="add">+</button>');
    v.querySelectorAll('[data-e]').forEach(b => b.onclick = () => vendorForm(db.partners.find(p => p.id === b.dataset.e)));
    v.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { if (confirm('Delete vendor? Past orders keep their records.')) { db.partners = db.partners.filter(p => p.id !== b.dataset.d); save(); render(); } });
    $('#add').onclick = () => vendorForm();
  },
  rates(v) {
    v.innerHTML = (db.rates.map(r => `<div class="card"><div class="between"><b>${esc(r.service)}</b><span class="badge">${esc(r.category || 'General')}</span></div>
      <div class="mu">Customer ${inr(r.rate)} · Outsource ${inr(r.cost)} · Margin ${inr(r.rate - r.cost)}</div><button data-e="${r.id}">Edit</button><button class="danger" data-d="${r.id}">Delete</button></div>`).join('') || '<p class="mu">Add standard rates like Hemming ₹50.</p>') + '<button class="fab" id="add">+</button>';
    v.querySelectorAll('[data-e]').forEach(b => b.onclick = () => rateForm(db.rates.find(r => r.id === b.dataset.e)));
    v.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { if (confirm('Delete rate?')) { db.rates = db.rates.filter(r => r.id !== b.dataset.d); save(); render(); } });
    $('#add').onclick = () => rateForm();
  },
  cats(v) {
    const sum = (arr, k) => arr.reduce((a, o) => a + (+o[k] || 0), 0);
    if (selVendor) {
      const p = db.partners.find(x => x.id === selVendor), os = db.orders.filter(o => o.partnerId === selVendor);
      v.innerHTML = `<button class="chip" id="bk">← Back</button><div class="card"><h3>${esc(p ? p.name : 'Vendor')}</h3><div>Jobs: ${os.length} · Revenue: <b>${inr(sum(os, 'total'))}</b></div>
      <div class="mu">Sent to vendor (cost): ${inr(sum(os, 'outCost'))} · Profit: ${inr(sum(os, 'total') - sum(os, 'outCost'))}</div></div>
      <div class="card"><table><tr><th>Date</th><th>Item</th><th>Cost</th><th>Bill</th></tr>${os.map(o => `<tr><td>${o.pickup || '-'}</td><td>${esc(o.item)}</td><td>${inr(o.outCost)}</td><td>${inr(o.total)}</td></tr>`).join('')}</table></div>`;
      $('#bk').onclick = () => { selVendor = null; render(); }; return;
    }
    if (selCat !== null) {
      const ps = db.partners.filter(p => (p.category || '') === selCat);
      v.innerHTML = `<button class="chip" id="bk">← Back</button><h3>${esc(selCat || 'General')}</h3>` + (ps.map(p => { const os = db.orders.filter(o => o.partnerId === p.id);
        return `<div class="card tap" data-v="${p.id}"><div class="between"><b>${esc(p.name)}</b><span>${inr(sum(os, 'total'))}</span></div><div class="mu">${os.length} jobs · tap for ledger</div></div>`; }).join('') || '<p class="mu">No vendors in this category.</p>');
      $('#bk').onclick = () => { selCat = null; render(); };
      v.querySelectorAll('[data-v]').forEach(c => c.onclick = () => { selVendor = c.dataset.v; render(); }); return;
    }
    const cs = [...new Set([...allCats(), ...(db.partners.some(p => !p.category) ? [''] : [])])];
    v.innerHTML = cs.map(c => { const os = db.orders.filter(o => (o.category || '') === c);
      return `<div class="card tap" data-c="${esc(c)}"><div class="between"><b>${esc(c || 'General')}</b><span>${inr(sum(os, 'total'))}</span></div><div class="mu">${db.partners.filter(p => (p.category || '') === c).length} vendors · ${os.length} jobs</div></div>`; }).join('') || '<p class="mu">Categories appear once you add vendors, rates or orders.</p>';
    v.querySelectorAll('[data-c]').forEach(c => c.onclick = () => { selCat = c.dataset.c; render(); });
  },
  settings(v) {
    const s = db.settings;
    v.innerHTML = `<div class="card"><h3>Shop</h3><label>Shop name<input id="s-shop" value="${esc(s.shop)}"></label><label>Shop UPI ID<input id="s-upi" value="${esc(s.upi)}" placeholder="shop@upi"></label>
    <label>Theme<select id="s-theme"><option value="light" ${s.theme === 'light' ? 'selected' : ''}>Light</option><option value="dark" ${s.theme === 'dark' ? 'selected' : ''}>Dark</option></select></label></div>
    <div class="card"><h3>Security</h3><label><input type="checkbox" id="s-pin" ${s.pinOn ? 'checked' : ''}>PIN lock on app start</label></div>
    <div class="card"><h3>Backup (local only)</h3><button id="exp">Export backup</button><label class="btn" style="display:inline-block">Import backup<input type="file" id="imp" accept=".json" hidden></label><button class="danger" id="rst">Erase all data</button></div>`;
    $('#s-shop').onchange = e => { s.shop = e.target.value.trim() || 'My Shop'; save(); toast('Saved'); };
    $('#s-upi').onchange = e => { s.upi = e.target.value.trim(); save(); toast('Saved'); };
    $('#s-theme').onchange = e => { s.theme = e.target.value; applyTheme(); save(); };
    $('#s-pin').onchange = e => {
      if (e.target.checked) { const p = prompt('Set a 4-digit PIN'); if (/^\d{4}$/.test(p || '')) { s.pinOn = true; s.pin = p; save(); toast('PIN lock ON'); } else { e.target.checked = false; toast('PIN must be 4 digits'); } }
      else { if (prompt('Enter current PIN to turn off') === s.pin) { s.pinOn = false; s.pin = ''; save(); toast('PIN lock OFF'); } else { e.target.checked = true; toast('Wrong PIN'); } }
    };
    $('#exp').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' })); a.download = `bizz-backup-${today()}.json`; a.click(); };
    $('#imp').onchange = e => { const r = new FileReader(); r.onload = () => { try { const o = JSON.parse(r.result); if (!Array.isArray(o.orders)) throw 0; db = { ...def, ...o }; db.settings = { ...def.settings, ...o.settings }; save(); applyTheme(); render(); toast('Backup restored'); } catch { toast('Invalid backup file'); } }; if (e.target.files[0]) r.readAsText(e.target.files[0]); };
    $('#rst').onclick = () => { if (confirm('Erase ALL data on this device?')) { db = structuredClone(def); save(); applyTheme(); render(); } };
  }
};

function render() {
  $('#title').textContent = db.settings.shop + ' · ' + TABS.find(t => t[0] === tab)[2];
  $('#nav').innerHTML = TABS.map(([k, i, l]) => `<button class="${k === tab ? 'on' : ''}" data-t="${k}"><span>${i}</span>${l}</button>`).join('');
  $('#nav').querySelectorAll('button').forEach(b => b.onclick = () => { tab = b.dataset.t; selCat = null; selVendor = null; render(); });
  views[tab]($('#view'));
}
function applyTheme() { document.documentElement.dataset.theme = db.settings.theme; }
$('#theme').onclick = () => { db.settings.theme = db.settings.theme === 'dark' ? 'light' : 'dark'; applyTheme(); save(); };

function lock() {
  if (!(db.settings.pinOn && db.settings.pin)) return;
  const l = $('#lock'); l.hidden = false;
  l.innerHTML = '<div class="sheet"><h3>🔒 Enter PIN</h3><input id="pin" type="password" inputmode="numeric" maxlength="4" autofocus></div>';
  $('#pin').oninput = e => { if (e.target.value === db.settings.pin) l.hidden = true; else if (e.target.value.length >= 4) { e.target.value = ''; toast('Wrong PIN'); } };
}

applyTheme(); render(); lock();
