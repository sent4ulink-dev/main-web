/* The owner's stats page (stats.html): asks the orders Worker (through the gateway) for the numbers, and shows the sign-in or the
   code step when it says so. See "the owner's stats page" in worker/src/index.js. */
(() => {
  const $ = (id) => document.getElementById(id);
  const STYLE = { thanksgiving: 'Thanksgiving', pixel: 'Pixel', pinky: 'Pinky', winxp: 'WinXP', petal: 'Petal Isle', picnic: 'Picnic', salon: 'Heritage', mission: 'Mission', spooky: 'Halloween Night', halloween: 'Halloween' };
  const VIEWS = ['loading', 'signin', 'denied', 'code', 'dash'];
  const show = (v) => { VIEWS.forEach((x) => { $(x).hidden = x !== v; }); $('actions').hidden = v !== 'dash'; if (v === 'code') setTimeout(() => $('codeInput').focus(), 50); };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (n) => Number(n || 0).toLocaleString('en-US');
  const usd = (cents) => `$${(Number(cents || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const shortDay = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  let regionNames = null; try { regionNames = new Intl.DisplayNames(['en'], { type: 'region' }); } catch { /* old browser */ }
  const country = (c) => { try { return (regionNames && regionNames.of(c)) || c; } catch { return c; } };

  async function load() {
    let res;
    try { res = await fetch('/stats/data', { credentials: 'same-origin', cache: 'no-store' }); } catch { show('loading'); $('loading').querySelector('p').textContent = 'Couldn’t reach the server. Check the internet and refresh.'; return; }
    if (res.status === 401) { const b = await res.json().catch(() => ({})); show(b.need === 'code' ? 'code' : 'signin'); return; }
    if (res.status === 403) { show('denied'); return; }
    if (!res.ok) { show('loading'); $('loading').querySelector('p').textContent = 'Something went wrong. Refresh in a moment.'; return; }
    render(await res.json());
    show('dash');
  }

  $('code').addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = $('codeInput').value.replace(/\D/g, '');
    if (code.length !== 6) { $('codeMsg').textContent = 'The code has 6 digits.'; return; }
    $('codeBtn').disabled = true; $('codeMsg').textContent = '';
    try {
      const res = await fetch('/stats/verify', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
      const b = await res.json().catch(() => ({}));
      if (res.ok) { $('codeInput').value = ''; await load(); return; }
      if (res.status === 401 && b.need === 'signin') { show('signin'); return; }
      $('codeMsg').textContent = b.error || 'That didn’t work. Try again.';
    } catch { $('codeMsg').textContent = 'Couldn’t reach the server. Try again.'; }
    finally { $('codeBtn').disabled = false; }
  });
  $('codeInput').addEventListener('input', (e) => { const v = e.target.value.replace(/\D/g, '').slice(0, 6); e.target.value = v; if (v.length === 6) $('code').requestSubmit(); });
  $('refresh').addEventListener('click', load);
  $('lock').addEventListener('click', async () => { try { await fetch('/stats/logout', { method: 'POST', credentials: 'same-origin' }); } catch { /* it expires anyway */ } show('code'); });

  function tile(value, label, note = '') { return `<div class="tile"><b>${esc(value)}</b><small>${esc(label)}${note ? ` <span class="note">· ${esc(note)}</span>` : ''}</small></div>`; }

  function list(el, rows, { name = (k) => k, empty = 'Nothing yet.' } = {}) {
    const entries = (Array.isArray(rows) ? rows : Object.entries(rows || {})).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
    if (!entries.length) { $(el).innerHTML = `<p class="empty">${esc(empty)}</p>`; return; }
    const max = entries[0][1];
    $(el).innerHTML = `<table><tbody>${entries.map(([k, n]) => `<tr><td>${esc(name(k))}<span class="meter" style="width:${Math.max(2, (n / max) * 100).toFixed(1)}%"></span></td><td class="n">${num(n)}</td></tr>`).join('')}</tbody></table>`;
  }

  // a bar chart of one series over the days, with a hover tooltip per day (no second scale: one chart, one measure)
  function bars(svg, days, values, color, tipText) {
    const W = 600, H = 200, padL = 34, padB = 22, padT = 8, n = days.length;
    const max = Math.max(1, ...values);
    // the top of the scale: 2, 4, 6 or 10 × a power of ten, so its middle line is a whole number too
    const nice = (() => { const p = 10 ** Math.floor(Math.log10(max)); const m = max / p; return [2, 4, 6, 10].find((c) => c >= m) * p; })();
    const y = (v) => H - padB - ((H - padB - padT) * v) / nice;
    const step = (W - padL) / n, bw = Math.max(3, step - 2);   // (a 2px gap between bars)
    let out = '';
    for (const g of [0, 0.5, 1]) { const v = nice * g, gy = y(v); out += `<line class="grid-line" x1="${padL}" x2="${W}" y1="${gy}" y2="${gy}"/><text class="axis" x="${padL - 6}" y="${gy + 4}" text-anchor="end">${num(Math.round(v))}</text>`; }
    values.forEach((v, i) => {
      const x = padL + i * step + 1, top = y(v), h = H - padB - top;
      if (v > 0) {   // 3px rounded top, square on the baseline
        const r = Math.min(3, bw / 2, h);
        out += `<path class="bar" data-i="${i}" fill="${color}" d="M${x},${H - padB} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${H - padB} Z"/>`;
      }
      out += `<rect class="hit" data-i="${i}" x="${padL + i * step}" y="${padT}" width="${step}" height="${H - padB - padT}"/>`;
    });
    [0, Math.floor(n / 2), n - 1].forEach((i) => { out += `<text class="axis" x="${padL + i * step + step / 2}" y="${H - 5}" text-anchor="middle">${esc(shortDay(days[i]))}</text>`; });
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('preserveAspectRatio', 'none');
    svg.innerHTML = out;
    const tip = svg.parentElement.querySelector('.tip');
    const on = (i) => {
      svg.querySelectorAll('.bar').forEach((b) => b.classList.toggle('on', +b.dataset.i === i));
      if (i < 0) { tip.style.opacity = 0; return; }
      const box = svg.getBoundingClientRect(), pbox = svg.parentElement.getBoundingClientRect();
      tip.innerHTML = `<b>${esc(shortDay(days[i]))}</b>${tipText(i)}`;
      const half = tip.offsetWidth / 2, x = box.left - pbox.left + ((padL + i * step + step / 2) / W) * box.width;
      tip.style.left = `${Math.min(Math.max(x, half + 6), pbox.width - half - 6)}px`;   // (kept inside the panel)
      tip.style.top = `${box.top - pbox.top + (y(values[i]) / H) * box.height - 8}px`;
      tip.style.opacity = 1;
    };
    svg.querySelectorAll('.hit').forEach((r) => { r.addEventListener('pointerenter', () => on(+r.dataset.i)); });
    svg.addEventListener('pointerleave', () => on(-1));
  }

  function render(d) {
    const D = d.daily, last = d.days.length - 1;
    const v30 = sum(D.visitors), views30 = sum(D.views), buys30 = sum(D.purchases), rev30 = sum(D.revenue);
    $('tiles30').innerHTML = [
      tile(num(D.visitors[last]), 'Visitors today'),
      tile(num(v30), 'Visitors', 'one person counts once a day'),
      tile(num(views30), 'Page views'),
      tile(num(sum(D.demos)), 'Demo opens'),
      tile(num(sum(D.checkouts)), 'Checkouts started'),
      tile(num(buys30), 'Purchases', v30 ? `${((buys30 / v30) * 100).toFixed(1)}% of visitors` : ''),
      tile(usd(rev30), 'Revenue', 'before fees'),
      tile(num(sum(D.refunds)), 'Refunds'),
    ].join('');
    const A = d.all;
    $('tilesAll').innerHTML = [
      tile(num(A.purchases), 'Purchases', `${num(A.single)} × 1 link · ${num(A.pack)} × 8 links`),
      tile(usd(A.revenue), 'Revenue', 'before fees'),
      tile(num(A.refunds), 'Refunds', A.refunded ? usd(A.refunded) : ''),
      tile(num(A.links), 'Links made', `${num(A.unused)} paid for, not made yet`),
    ].join('');
    bars($('chartVisitors'), d.days, D.visitors, '#8b6dff', (i) => `${num(D.visitors[i])} visitors · ${num(D.views[i])} page views<br>${num(D.demos[i])} demo opens · ${num(D.opens[i])} bought links opened`);
    bars($('chartPurchases'), d.days, D.purchases, '#ff6b9d', (i) => `${num(D.purchases[i])} purchases · ${usd(D.revenue[i])}<br>${num(D.checkouts[i])} checkouts started${D.refunds[i] ? ` · ${num(D.refunds[i])} refunded` : ''}`);
    list('demoByCard', d.demoByCard, { name: (k) => STYLE[k] || k, empty: 'No demo opens yet.' });
    list('opensByCard', d.opensByCard, { name: (k) => STYLE[k] || k, empty: 'No bought links opened yet.' });
    list('countries', d.countries, { name: country, empty: 'No visits yet.' });
    list('referrers', d.referrers, { empty: 'No links from other sites yet (visits typed in or from apps show no source).' });
    list('linksByCard', d.linksByCard, { name: (k) => STYLE[k] || k, empty: 'No links made yet.' });
    $('recent').innerHTML = d.recent.length
      ? `<table><thead><tr><th>Paid</th><th>Pack</th><th class="n">Amount</th><th>Status</th><th class="n">Links made</th></tr></thead><tbody>${d.recent.map((o) => `<tr><td>${esc(new Date(o.at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }))}</td><td>${o.pack === 'pack' ? '8 links' : '1 link'}</td><td class="n">${usd(o.amount)}</td><td class="status-${esc(o.status)}">${esc(o.status)}</td><td class="n">${num(o.links)}</td></tr>`).join('')}</tbody></table>`
      : '<p class="empty">No purchases yet.</p>';
    $('dayTable').innerHTML = `<table><thead><tr><th>Day</th><th class="n">Visitors</th><th class="n">Page views</th><th class="n">Demos</th><th class="n">Links opened</th><th class="n">Checkouts</th><th class="n">Purchases</th><th class="n">Revenue</th></tr></thead><tbody>${d.days.map((day, i) => `<tr><td>${esc(shortDay(day))}</td><td class="n">${num(D.visitors[i])}</td><td class="n">${num(D.views[i])}</td><td class="n">${num(D.demos[i])}</td><td class="n">${num(D.opens[i])}</td><td class="n">${num(D.checkouts[i])}</td><td class="n">${num(D.purchases[i])}</td><td class="n">${usd(D.revenue[i])}</td></tr>`).reverse().join('')}</tbody></table>`;
    const off = d.tzOffsetMin || 0;
    $('tz').textContent = `UTC${off >= 0 ? '+' : '−'}${Math.abs(off / 60)}`;
    $('updated').textContent = `Updated ${new Date(d.updatedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}${d.ordersRead < d.ordersTotal ? ` · the newest ${num(d.ordersRead)} of ${num(d.ordersTotal)} orders` : ''}`;
  }

  load();
})();
