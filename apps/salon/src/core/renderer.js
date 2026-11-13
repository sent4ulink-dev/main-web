import * as THREE from 'three';
import {
  EffectComposer, RenderPass, EffectPass, BloomEffect, ToneMappingEffect, ToneMappingMode,
  VignetteEffect, DepthOfFieldEffect, NoiseEffect, BlendFunction, Effect,
} from 'postprocessing';

// Safety net: one NaN/Inf pixel (from any shader) gets smeared across the whole screen by the bloom blur
// and shows as a black flash. Clamp the scene colour to finite values before bloom sees it.
class SanitizeEffect extends Effect {
  constructor() {
    super('Sanitize', `void mainImage(const in vec4 c, const in vec2 uv, out vec4 o) {
      vec3 v = min(max(c.rgb, vec3(0.0)), vec3(60000.0));
      o = vec4(v == v ? v : vec3(0.0), clamp(c.a, 0.0, 1.0));
    }`);
  }
}

/**
 * Renderer + post stack. Crisp first: the canvas renders at the screen's own pixel density (phones
 * included), and when frames run long the resolution steps down a little at a time; only at the floor
 * does the scene get lighter (grass, shadows). Tone mapping is Khronos PBR Neutral.
 */
export class Renderer {
  constructor(canvas) {
    const isMobile = matchMedia('(pointer: coarse)').matches;
    this.renderer = new THREE.WebGLRenderer({
      canvas, antialias: false, stencil: false, depth: true, alpha: false,
      powerPreference: 'high-performance',
    });
    const r = this.renderer;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NoToneMapping;
    r.toneMappingExposure = 1.0;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.setClearColor(0x2a3a26);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.05, 3000);

    this.composer = new EffectComposer(r, { frameBufferType: THREE.HalfFloatType, multisampling: isMobile ? 0 : 4 });
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    this.dof = new DepthOfFieldEffect(this.camera, { focusDistance: 4, focusRange: 3.2, bokehScale: 2.2, resolutionScale: 0.5 });
    this.dofPass = new EffectPass(this.camera, this.dof);
    this.composer.addPass(this.dofPass);
    this.composer.addPass(new EffectPass(this.camera, new SanitizeEffect()));

    // (the glow is soft by nature: on phones it's computed at a lower resolution, which costs far less)
    this.bloom = new BloomEffect({ mipmapBlur: true, intensity: 0.7, luminanceThreshold: 1.0, luminanceSmoothing: 0.2, radius: 0.7, resolutionScale: isMobile ? 0.35 : 0.5 });
    this.toneMap = new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL });
    this.vignette = new VignetteEffect({ offset: 0.32, darkness: 0.42 });
    this.noise = new NoiseEffect({ premultiply: true, blendFunction: BlendFunction.SCREEN });
    this.noise.blendMode.opacity.value = 0.008;
    this.composer.addPass(new EffectPass(this.camera, this.bloom, this.toneMap, this.vignette, this.noise));

    // No depth-of-field blur at any level: every object stays sharp.
    this.isMobile = isMobile;
    const sys = devicePixelRatio || 1;
    // at most 2x, phones too (above that a phone draws over twice the pixels for a picture that looks the same at its size, and
    // runs hot); phones go down to 1.25x when they must, and never climb back (see monitor)
    this.dprCap = Math.min(sys, 2);
    this.dprFloor = Math.min(this.dprCap, isMobile ? 1.25 : 1);
    this.dpr = this.dprCap;
    // Feature tiers, lightest first. Phones skip MSAA (at 2.5-3x pixel density edges are already
    // smooth, and resolving multisampled float buffers is costly on mobile GPUs), draw a thinner meadow
    // and refresh the shadow map less often — that budget goes into resolution instead.
    this.levels = isMobile
      ? [
        { msaa: 0, dof: false, grass: 0.26, shadow: 512, shadowEvery: 4 },
        { msaa: 0, dof: false, grass: 0.46, shadow: 1024, shadowEvery: 3 },
      ]
      : [
        { msaa: 0, dof: false, grass: 0.38, shadow: 1024, shadowEvery: 2 },
        { msaa: 2, dof: false, grass: 0.7, shadow: 2048, shadowEvery: 2 },
        { msaa: 4, dof: false, grass: 1.0, shadow: 2048, shadowEvery: 2 },
      ];
    if (window.__cardLite) {   // this phone ran out of memory on a card before (see the guard in index.html): the lightest card
      this.dprCap = Math.min(this.dprCap, 1.25); this.dprFloor = Math.min(this.dprFloor, 1); this.dpr = this.dprCap;
      this.levels = this.levels.slice(0, 1);
    }
    this.level = this.levels.length - 1;
    this._slowChecks = 0;
    this._goodChecks = 0;
    this.onQuality = null;
    this._frameTimes = [];
    this._lastCheck = 0;
    this._goodSince = 0;

    this._applySize();
    // Resizing a canvas clears it. Doing that between frames is what made the view blink black (the
    // browser shows the empty canvas once), so a resize only marks the size dirty; it's applied at the
    // start of the next render, right before drawing.
    addEventListener('resize', () => this.resize());
  }

  get maxDpr() { return this.forceDpr ?? this.dpr; }

  resize() { this._dirty = true; }

  _applySize() {
    this._dirty = false;
    // the stage (the canvas's own box: smaller while the editing toolbar takes its strip)
    const c = this.renderer.domElement, w = c.clientWidth || innerWidth, h = c.clientHeight || innerHeight, dpr = this.maxDpr;
    if (w === this._w && h === this._h && dpr === this._dpr) return;
    this._w = w; this._h = h; this._dpr = dpr;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  applyLevel(sunLight) {
    const L = this.levels[this.level];
    this.composer.multisampling = L.msaa;
    this.dofPass.enabled = L.dof;
    if (sunLight && sunLight.shadow.mapSize.x !== L.shadow) {
      sunLight.shadow.mapSize.set(L.shadow, L.shadow);
      sunLight.shadow.map?.dispose();
      sunLight.shadow.map = null;
    }
    this.resize();
    this.onQuality?.(L, this.level);
  }

  /**
   * Adaptive quality. Missing 60 fps two checks in a row → drop the pixel ratio by 0.25 (down to the
   * floor), then lighten the scene. Clear headroom (fast GPU or 120 Hz screen) → give it back.
   */
  monitor(dt, now, sunLight) {
    if (dt > 0.25) return;                       // tab switch / hitch
    if (this._t0 === undefined) this._t0 = now;
    if (now - this._t0 < 4) return;              // shader warm-up right after loading
    this._frameTimes.push(dt);
    if (now - this._lastCheck < 2) return;
    this._lastCheck = now;
    const ft = this._frameTimes.sort((a, b) => a - b);
    const p75 = ft[Math.floor(ft.length * 0.75)] || 0.016;
    this._frameTimes = [];
    if (p75 > 0.0195) {
      this._goodChecks = 0;
      if (++this._slowChecks < 2) return;
      this._slowChecks = 0;
      if (this.dpr > this.dprFloor + 0.01) { this.dpr = Math.max(this.dprFloor, this.dpr - 0.25); this.resize(); }
      else if (this.level > 0) { this.level--; this.applyLevel(sunLight); }
      return;
    }
    this._slowChecks = 0;
    if (this.isMobile) return;   // phones only ever step down: every step re-sizes the big 3D buffers, and up-and-down again and again runs a phone out of memory
    if (p75 < 0.0125) {
      if (++this._goodChecks < 3) return;
      this._goodChecks = 0;
      if (this.level < this.levels.length - 1) { this.level++; this.applyLevel(sunLight); }
      else if (this.dpr < this.dprCap - 0.01) { this.dpr = Math.min(this.dprCap, this.dpr + 0.25); this.resize(); }
    } else this._goodChecks = 0;
  }

  render(dt) {
    if (this._dirty) this._applySize();
    this.composer.render(dt);
  }
}
