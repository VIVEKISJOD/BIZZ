// Lightweight QR generator: byte mode, ECC level L, versions 1-6 (up to ~130 chars)
const EC = [7, 10, 15, 20, 26, 18], NB = [1, 1, 1, 1, 1, 2];
const mul = (x, y) => { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; } return z; };
const rs = (data, deg) => {
  const d = Array(deg).fill(0); d[deg - 1] = 1; let r = 1;
  for (let i = 0; i < deg; i++) { for (let j = 0; j < deg; j++) { d[j] = mul(d[j], r); if (j + 1 < deg) d[j] ^= d[j + 1]; } r = mul(r, 2); }
  const out = Array(deg).fill(0);
  for (const b of data) { const f = b ^ out.shift(); out.push(0); d.forEach((c, i) => out[i] ^= mul(c, f)); }
  return out;
};
const raw = v => { let r = (16 * v + 128) * v + 64; if (v >= 2) { const a = Math.floor(v / 7) + 2; r -= (25 * a - 10) * a - 55; } return r; };

export function qrMatrix(text) {
  const bytes = [...new TextEncoder().encode(text)];
  let ver = 1;
  for (; ver <= 6; ver++) if (Math.floor(raw(ver) / 8) - EC[ver - 1] * NB[ver - 1] >= Math.ceil((12 + bytes.length * 8) / 8)) break;
  if (ver > 6) throw new Error('Text too long for QR');
  const cap = Math.floor(raw(ver) / 8) - EC[ver - 1] * NB[ver - 1];
  const bits = []; const put = (v, n) => { for (let i = n - 1; i >= 0; i--) bits.push((v >>> i) & 1); };
  put(4, 4); put(bytes.length, 8); bytes.forEach(b => put(b, 8));
  put(0, Math.min(4, cap * 8 - bits.length)); while (bits.length % 8) bits.push(0);
  const data = []; for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(''), 2));
  for (let p = 0xEC; data.length < cap; p ^= 0xFD) data.push(p);
  const nb = NB[ver - 1], el = EC[ver - 1], rc = Math.floor(raw(ver) / 8), ns = nb - rc % nb, sl = Math.floor(rc / nb);
  const blocks = [];
  for (let i = 0, k = 0; i < nb; i++) { const d = data.slice(k, k + sl - el + (i < ns ? 0 : 1)); k += d.length; const e = rs(d, el); if (i < ns) d.push(0); blocks.push(d.concat(e)); }
  const cw = [];
  for (let i = 0; i < blocks[0].length; i++) blocks.forEach((b, j) => { if (i !== sl - el || j >= ns) cw.push(b[i]); });
  const n = ver * 4 + 17;
  const m = [...Array(n)].map(() => Array(n).fill(false)), f = [...Array(n)].map(() => Array(n).fill(false));
  const set = (x, y, v) => { m[y][x] = v; f[y][x] = true; };
  for (let i = 0; i < n; i++) { set(6, i, i % 2 == 0); set(i, 6, i % 2 == 0); }
  const finder = (cx, cy) => { for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const x = cx + dx, y = cy + dy; if (x >= 0 && x < n && y >= 0 && y < n) { const d = Math.max(Math.abs(dx), Math.abs(dy)); set(x, y, d != 2 && d != 4); } } };
  finder(3, 3); finder(n - 4, 3); finder(3, n - 4);
  if (ver > 1) { const c = n - 7; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(c + dx, c + dy, Math.max(Math.abs(dx), Math.abs(dy)) != 1); }
  const fmt = mask => {
    const d = (1 << 3) | mask; let r = d;
    for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
    const b = ((d << 10) | r) ^ 0x5412, g = i => ((b >>> i) & 1) == 1;
    for (let i = 0; i <= 5; i++) set(8, i, g(i)); set(8, 7, g(6)); set(8, 8, g(7)); set(7, 8, g(8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, g(i));
    for (let i = 0; i < 8; i++) set(n - 1 - i, 8, g(i));
    for (let i = 8; i < 15; i++) set(8, n - 15 + i, g(i));
    set(8, n - 8, true);
  };
  fmt(0);
  let k = 0;
  for (let r = n - 1; r >= 1; r -= 2) {
    if (r == 6) r = 5;
    for (let v = 0; v < n; v++) for (let j = 0; j < 2; j++) {
      const x = r - j, up = ((r + 1) & 2) == 0, y = up ? n - 1 - v : v;
      if (!f[y][x] && k < cw.length * 8) { m[y][x] = ((cw[k >>> 3] >>> (7 - (k & 7))) & 1) == 1; k++; }
    }
  }
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (!f[y][x] && (x + y) % 2 == 0) m[y][x] = !m[y][x];
  fmt(0);
  return m;
}

export function qrSvg(text, px = 220) {
  const m = qrMatrix(text), n = m.length; let p = '';
  m.forEach((r, y) => r.forEach((v, x) => { if (v) p += `M${x + 4},${y + 4}h1v1h-1z`; }));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n + 8} ${n + 8}" width="${px}" height="${px}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${p}" fill="#000"/></svg>`;
}
