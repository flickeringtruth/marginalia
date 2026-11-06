/* Marginalia flux vortex hero (Three.js) — dark, theme-aware, user-controlled.
   A slow, swirling flow-field panel at the top of the library.
   Settings › Library hero lets you:
     - show or hide the hero,
     - change hue, saturation, speed, opacity and base colour,
     - reset to the default look.
   Choices are saved on this device and apply live.
   - Loads Three.js r128 from cdnjs only when the library is visible and the hero is on.
   - Pauses when scrolled out of view or when the tab is hidden.
   - Follows your finger or mouse gently.
   - Reduced motion: renders one still frame.
   - If WebGL is unavailable, the base colour stays.
   Loaded from read-along-size.js. Remove the import to turn it off. */
(() => {
  if (window.__fluxHero) return;
  window.__fluxHero = true;

  const SRC = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
  const KEY = 'marginalia.flux';
  const reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  const DEFAULTS = { on: true, hue: 72, sat: 0.9, speed: 0.77, opacity: 0.95, bg: '#050507' };
  const LIMITS = { hue: [0, 360, 1], sat: [0, 1, 0.01], speed: [0, 2, 0.01], opacity: [0.2, 1, 0.01] };

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  function load() {
    try {
      const s = Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(KEY) || '{}'));
      s.hue = clamp(+s.hue, 0, 360); s.sat = clamp(+s.sat, 0, 1); s.speed = clamp(+s.speed, 0, 2);
      s.opacity = clamp(+s.opacity, 0.2, 1);
      if (!/^#[0-9a-f]{6}$/i.test(s.bg)) s.bg = DEFAULTS.bg;
      return s;
    } catch (e) { return Object.assign({}, DEFAULTS); }
  }
  let S = load();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } }

  const css = `
    #library .flux-hero{
      position:relative;overflow:hidden;isolation:isolate;
      height:clamp(160px,28vh,250px);
      margin:0 calc(-1 * (var(--sar,0px) + var(--lp))) 0 calc(-1 * (var(--sal,0px) + var(--lp)));
      background:radial-gradient(120% 90% at 30% 15%,color-mix(in srgb,var(--flux-bg) 70%,#fff 30%) 0%,var(--flux-bg) 60%),var(--flux-bg);
      border-radius:0 0 26px 26px;
      touch-action:pan-y;
    }
    #library .flux-hero[hidden]{display:none}
    #library .flux-hero canvas{position:absolute;inset:0;width:100%;height:100%;display:block;opacity:0;transition:opacity 1.2s ease}
    #library .flux-hero canvas.on{opacity:1}
    #library .flux-hero::after{
      content:"";position:absolute;left:0;right:0;bottom:0;height:46%;pointer-events:none;z-index:1;
      background:linear-gradient(to bottom,rgba(0,0,0,0),var(--flux-bg) 94%);
    }
    .flux-group .flux-val{min-width:54px;text-align:right;color:var(--muted);font-size:13px;font-variant-numeric:tabular-nums}
    .flux-group input[type=color]{width:44px;height:34px;border:0;padding:0;background:none;border-radius:8px;cursor:pointer}
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const VERT = `
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
  `;
  const FRAG = `
    precision highp float;
    uniform vec2 uRes;
    uniform float uTime;
    uniform vec2 uMouse;
    uniform vec3 uA;
    uniform vec3 uB;
    uniform vec3 uC;
    uniform float uOpacity;
    varying vec2 vUv;

    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p){
      vec2 i = floor(p), f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
                 mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
    }
    float fbm(vec2 p){
      float v = 0.0, a = 0.5;
      for (int i = 0; i < 5; i++){ v += a * noise(p); p = p * 2.03 + 11.7; a *= 0.5; }
      return v;
    }
    void main(){
      vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / min(uRes.x, uRes.y);
      vec2 m = (uMouse - 0.5) * vec2(uRes.x / uRes.y, 1.0) * 0.55;
      vec2 c = uv - m;
      float r = length(c);
      float swirl = atan(c.y, c.x) + uTime * 0.22 + 1.6 / (r + 0.28);
      vec2 q = vec2(cos(swirl), sin(swirl)) * r;
      vec2 w = vec2(fbm(q * 1.5 + uTime * 0.11), fbm(q * 1.5 + vec2(5.2, 1.3) - uTime * 0.09));
      float f = fbm(q * 2.1 + w * 2.6);
      float band = smoothstep(0.34, 0.88, f);
      vec3 col = mix(uA, uB, band);
      col = mix(col, uC, smoothstep(0.62, 1.0, f) * w.x);
      float vign = smoothstep(1.35, 0.15, r);
      float alpha = (0.12 + 0.62 * band) * vign * uOpacity;
      gl_FragColor = vec4(col * alpha, alpha);   // premultiplied: sits over any background colour
    }
  `;

  /* Colours from the user's settings. Base is the chosen background, glow follows the hue. */
  function palette(THREE, s) {
    const base = new THREE.Color(s.bg);
    const glow = new THREE.Color().setHSL(s.hue / 360, s.sat, 0.44);
    const hi = new THREE.Color().setHSL(((s.hue + 22) % 360) / 360, s.sat, 0.56);
    return { a: base, b: glow, c: hi };
  }
  function cssVars(hero, s) {
    hero.style.setProperty('--flux-bg', s.bg);
    hero.style.setProperty('--flux-hue', String(s.hue));
    hero.style.setProperty('--flux-sat', String(s.sat));
  }

  let threePromise = null;
  function loadThree() {
    if (window.THREE) return Promise.resolve(window.THREE);
    if (!threePromise) threePromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = SRC; s.async = true; s.crossOrigin = 'anonymous';
      s.onload = () => (window.THREE ? resolve(window.THREE) : reject(new Error('Three.js did not initialise')));
      s.onerror = () => { threePromise = null; s.remove(); reject(new Error('Three.js failed to load')); };
      document.head.appendChild(s);
    });
    return threePromise;
  }

  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }

  let runtime = null;   // { apply(state) } once the renderer is running
  function startHero(hero, THREE) {
    const canvas = document.createElement('canvas');
    hero.appendChild(canvas);

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, premultipliedAlpha: true, powerPreference: 'low-power' });
    } catch (e) { canvas.remove(); return; }
    renderer.setClearColor(0x000000, 0);
    const pr = Math.min(1.5, window.devicePixelRatio || 1);

    const scene = new THREE.Scene();
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const pal = palette(THREE, S);
    const uniforms = {
      uRes: { value: new THREE.Vector2(1, 1) },
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) },
      uA: { value: pal.a }, uB: { value: pal.b }, uC: { value: pal.c },
      uOpacity: { value: S.opacity }
    };
    const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false });
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));

    const resize = () => {
      const w = Math.max(1, hero.clientWidth), h = Math.max(1, hero.clientHeight);
      renderer.setPixelRatio(pr);
      renderer.setSize(w, h, false);
      uniforms.uRes.value.set(w * pr, h * pr);
    };
    resize();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    if (ro) ro.observe(hero);

    const target = new THREE.Vector2(0.5, 0.5);
    const onPointer = e => {
      const r = hero.getBoundingClientRect();
      target.set(clamp01((e.clientX - r.left) / r.width), clamp01(1 - (e.clientY - r.top) / r.height));
    };
    hero.addEventListener('pointermove', onPointer, { passive: true });
    hero.addEventListener('pointerdown', onPointer, { passive: true });

    let visible = false, raf = 0, last = 0, time = 0;
    const frame = now => {
      raf = 0;
      if (!visible || document.hidden) return;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      if (!reduce) time += dt * S.speed;
      uniforms.uTime.value = time;
      uniforms.uMouse.value.lerp(target, reduce ? 1 : 0.06);
      renderer.render(scene, cam);
      raf = requestAnimationFrame(frame);
    };
    const kick = () => { if (!raf && visible && !document.hidden) { last = 0; raf = requestAnimationFrame(frame); } };

    const io = new IntersectionObserver(entries => {
      visible = entries.some(en => en.isIntersecting);
      if (visible) kick();
    }, { threshold: 0 });
    io.observe(hero);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });

    renderer.render(scene, cam);
    requestAnimationFrame(() => canvas.classList.add('on'));
    if (reduce) { visible = true; renderer.render(scene, cam); visible = false; }
    else kick();

    // live updates from Settings
    runtime = {
      apply(s) {
        const p = palette(THREE, s);
        uniforms.uA.value.copy(p.a); uniforms.uB.value.copy(p.b); uniforms.uC.value.copy(p.c);
        uniforms.uOpacity.value = s.opacity;
        if (reduce) renderer.render(scene, cam);
      }
    };
  }

  let hero = null, loading = false;
  function ensureRunning() {
    if (!hero || !S.on || runtime || loading) return;
    loading = true;
    loadThree()
      .then(THREE => { if (S.on && !runtime) startHero(hero, THREE); })
      .catch(err => console.warn('flux hero:', err))
      .finally(() => { loading = false; });
  }

  function applySettings() {
    if (!hero) return;
    hero.hidden = !S.on;
    cssVars(hero, S);
    if (runtime) runtime.apply(S);
    if (S.on) ensureRunning();
  }

  /* Settings › Library hero */
  function injectSettings() {
    const body = document.getElementById('settingsBody');
    if (!body || body.querySelector('[data-flux-group]')) return;
    const group = document.createElement('div');
    group.className = 'grp flux-group';
    group.setAttribute('data-flux-group', '');
    group.innerHTML = `
      <h3>Library hero</h3>
      <button class="switch-row" type="button" data-flux-on>Show the swirling hero<span class="switch"></span></button>
      <label class="row"><span>Hue</span><input type="range" data-flux="hue" min="0" max="360" step="1" aria-label="Hue"><output class="flux-val" data-out="hue"></output></label>
      <label class="row"><span>Saturation</span><input type="range" data-flux="sat" min="0" max="1" step="0.01" aria-label="Saturation"><output class="flux-val" data-out="sat"></output></label>
      <label class="row"><span>Speed</span><input type="range" data-flux="speed" min="0" max="2" step="0.01" aria-label="Speed"><output class="flux-val" data-out="speed"></output></label>
      <label class="row"><span>Opacity</span><input type="range" data-flux="opacity" min="0.2" max="1" step="0.01" aria-label="Opacity"><output class="flux-val" data-out="opacity"></output></label>
      <label class="row"><span>Background</span><input type="color" data-flux="bg" aria-label="Hero background colour"><span style="flex:1"></span></label>
      <button class="wide-btn" type="button" data-flux-reset>Reset hero</button>
      <p class="hint">Saved on this device. Hue 72 is golden amber; dark backgrounds show the swirl best.</p>`;
    body.appendChild(group);

    const sync = () => {
      group.querySelector('[data-flux-on] .switch').classList.toggle('on', S.on);
      group.querySelectorAll('[data-flux]').forEach(i => {
        const k = i.dataset.flux;
        i.value = S[k];
        if (LIMITS[k]) {
          const [a, b] = LIMITS[k];
          i.style.setProperty('--p', ((S[k] - a) / (b - a) * 100) + '%');
          group.querySelector('[data-out="' + k + '"]').textContent = k === 'hue' ? Math.round(S[k]) + '°' : (+S[k]).toFixed(2);
        }
      });
    };
    sync();

    group.addEventListener('input', e => {
      const i = e.target.closest('[data-flux]'); if (!i) return;
      const k = i.dataset.flux;
      S[k] = k === 'bg' ? i.value : parseFloat(i.value);
      save(); sync(); applySettings();
    });
    group.addEventListener('click', e => {
      if (e.target.closest('[data-flux-on]')) { S.on = !S.on; save(); sync(); applySettings(); return; }
      if (e.target.closest('[data-flux-reset]')) { S = Object.assign({}, DEFAULTS); save(); sync(); applySettings(); }
    });
  }

  function mount() {
    const lib = document.getElementById('library');
    if (!lib || lib.querySelector('.flux-hero')) return;
    hero = document.createElement('div');
    hero.className = 'flux-hero';
    hero.setAttribute('aria-hidden', 'true');
    cssVars(hero, S);
    hero.hidden = !S.on;
    lib.insertBefore(hero, lib.firstChild);
    injectSettings();

    // Only load Three.js when the hero is on and the library is on screen.
    const io = new IntersectionObserver(entries => {
      if (!entries.some(en => en.isIntersecting)) return;
      ensureRunning();
    }, { threshold: 0 });
    io.observe(hero);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
