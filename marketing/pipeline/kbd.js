// A plain phone keyboard that slides up when a text is being edited (animated with requestAnimationFrame, so it also
// moves smoothly on the virtual clock). No key pop-ups: letters appear in the text while the thumb is on the keys.
(() => {
  if (document.getElementById('kbd')) return;
  const css = document.createElement('style');
  css.textContent = `#kbd{position:fixed;left:0;right:0;bottom:0;height:270px;background:#d4d6dd;z-index:99999;font:400 22px -apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:#111;padding:4px 3px 0;box-sizing:border-box;transform:translateY(100%)}
#kbd .sug{display:flex;height:40px;align-items:center;justify-content:space-around;font-size:16px;color:#333;border-bottom:1px solid #c3c5cc;margin:0 4px 6px}
#kbd .row{display:flex;justify-content:center;gap:6px;margin:0 0 10px}
#kbd .k{width:33px;height:42px;border-radius:6px;background:#fff;box-shadow:0 1px 0 #898a8e;display:flex;align-items:center;justify-content:center}
#kbd .k.w{width:46px;background:#aeb3be;font-size:16px}#kbd .k.sp{width:180px;font-size:15px}#kbd .k.rt{width:86px;background:#aeb3be;font-size:15px}`;
  document.head.appendChild(css);
  const rows = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
  const k = document.createElement('div'); k.id = 'kbd';
  k.innerHTML = '<div class="sug"><span>maze</span><span>made</span><span>make</span></div>' +
    rows.map((r, i) => '<div class="row">' + (i === 2 ? '<div class="k w">⇧</div>' : '') + [...r].map(c => `<div class="k">${c}</div>`).join('') + (i === 2 ? '<div class="k w">⌫</div>' : '') + '</div>').join('') +
    '<div class="row"><div class="k w">123</div><div class="k w">🙂</div><div class="k sp">space</div><div class="k rt">return</div></div>';
  document.body.appendChild(k);
  // lift: how far the page moves up with the keyboard, so the text being edited stays above it (as on a real phone)
  window.kbdShow = (lift = 0) => {
    const t0 = performance.now(), D = 280; const page = [...document.body.children].filter(e => e !== k && e.tagName !== 'SCRIPT' && e.tagName !== 'STYLE');
    const tick = () => {
      const x = Math.min(1, (performance.now() - t0) / D); const e = 1 - Math.pow(1 - x, 3);
      k.style.transform = `translateY(${(1 - e) * 100}%)`; page.forEach(el => { el.style.transform = `translateY(${-lift * e}px)`; });
      if (x < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
})();
