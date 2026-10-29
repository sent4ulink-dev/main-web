// Raindrops landing on the camera lens: glassy beads that pop onto the
// screen, sometimes trickle down leaving a few tiny droplets, and fade away.
// Drawn on a small 2D canvas over the scene (a couple of dozen gradients a
// frame), so it costs next to nothing on phones.

const MAX_DROPS = 26;

export function createLensDrops(host, { before = null } = {}) {
  const canvas = document.createElement("canvas");
  canvas.className = "lens-drops";
  canvas.setAttribute("aria-hidden", "true");
  if (before?.parentElement === host) before.after(canvas);
  else host.prepend(canvas);
  const g = canvas.getContext("2d");
  const drops = [];
  let spawnClock = 0;
  let width = 0;
  let height = 0;
  let scale = 1;
  let painted = false;

  function resize() {
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (w !== width || h !== height) {
      width = canvas.width = w;
      height = canvas.height = h;
      scale = Math.min(w, h) / 700;
    }
  }

  function spawn() {
    const r = (6 + Math.random() * 13) * scale;
    drops.push({
      x: width * (0.04 + Math.random() * 0.92),
      y: height * (0.03 + Math.random() * 0.8),
      r,
      life: 0,
      max: 0.9 + Math.random() * 1.5,
      slide: Math.random() < 0.3 ? (22 + Math.random() * 50) * scale : 0,
      trail: [],
    });
  }

  function bead(x, y, r, alpha) {
    g.globalAlpha = alpha;
    const body = g.createRadialGradient(x - r * 0.25, y - r * 0.3, r * 0.1, x, y, r);
    body.addColorStop(0, "rgba(255,255,255,0.10)");
    body.addColorStop(0.68, "rgba(214,226,255,0.14)");
    body.addColorStop(1, "rgba(58,66,108,0.3)");
    g.fillStyle = body;
    g.beginPath();
    g.ellipse(x, y, r, r * 1.08, 0, 0, Math.PI * 2);
    g.fill();
    // Light caught along the bottom edge, and a bright highlight up top.
    g.strokeStyle = "rgba(255,255,255,0.28)";
    g.lineWidth = Math.max(1, r * 0.12);
    g.beginPath();
    g.arc(x, y + r * 0.05, r * 0.78, Math.PI * 0.2, Math.PI * 0.8);
    g.stroke();
    g.fillStyle = "rgba(255,255,255,0.75)";
    g.beginPath();
    g.ellipse(x - r * 0.35, y - r * 0.42, r * 0.2, r * 0.14, -0.5, 0, Math.PI * 2);
    g.fill();
  }

  return {
    // amount: how hard it is raining (0..1).
    update(dt, amount) {
      if (!drops.length && amount < 0.05) {
        if (painted) {
          g.clearRect(0, 0, width, height);
          painted = false;
        }
        canvas.hidden = true;
        return;
      }
      canvas.hidden = false;
      resize();
      if (amount > 0.05) {
        spawnClock -= dt * amount * 7;
        while (spawnClock <= 0) {
          spawnClock += 1;
          if (drops.length < MAX_DROPS) spawn();
        }
      }
      g.clearRect(0, 0, width, height);
      for (let i = drops.length - 1; i >= 0; i -= 1) {
        const d = drops[i];
        d.life += dt;
        if (d.life >= d.max) {
          drops.splice(i, 1);
          continue;
        }
        if (d.slide && d.life > 0.25) {
          const before = d.y;
          d.y += d.slide * dt;
          if (Math.floor(before / (d.r * 1.6)) !== Math.floor(d.y / (d.r * 1.6))) d.trail.push({ x: d.x + (Math.random() - 0.5) * d.r * 0.4, y: before, r: d.r * (0.2 + Math.random() * 0.15) });
        }
        const grow = Math.min(1, d.life / 0.08);
        const fade = 1 - Math.max(0, (d.life - (d.max - 0.45)) / 0.45);
        for (const t of d.trail) bead(t.x, t.y, t.r, 0.8 * fade);
        bead(d.x, d.y, d.r * (0.6 + 0.4 * grow), fade);
      }
      g.globalAlpha = 1;
      painted = true;
    },
    dispose() {
      canvas.remove();
    },
  };
}
