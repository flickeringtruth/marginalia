/* Marginalia flux vortex hero (Three.js) — dark, theme-aware.
   A slow, swirling flow-field panel at the top of the library.
   Colours come from CSS variables, so the site can be black now and take other colours later:
     --flux-bg   base colour of the panel      (default #050507, near black)
     --flux-hue  hue in degrees for the glow   (default 72, golden amber)
     --flux-sat  saturation 0 to 1             (default 0.9)
   Speed 0.77, opacity 0.95, aspect-correct swirl (no stretched ellipse).
   - Loads Three.js r128 from cdnjs only when the library is visible.
   - Pauses when scrolled out of view or when the tab is hidden.
   - Follows your finger or mouse gently.
   - Reduced motion: renders one still frame.
   - If WebGL is unavailable, the CSS base colour stays.
   Loaded from read-along-size.js. Remove the import to turn it off. */
(() => {
  if (window.__fluxHero) return;
  window.__fluxHero = true;

  const SRC = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
  const reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  const SPEED = 0.77;
  const OPACITY = 0.95;

  const css = `
    #library .flux-hero{
      --flux-bg:#050507;
      --flux-hue:72;
      --flux-sat:0.9;
      position:relative;overflow:hidden;isolation:isolate;
      height:clamp(160px,28vh,250px);
      margin:0 calc(-1 * (var(--sar,0px) + var(--lp))) 0 calc(-1 * (var(--sal,0px) + var(--lp)));
      background:radial-gradient(120% 90% at 30% 15%,color-mix(in srgb,var(--flux-bg) 70%,#fff 30%) 0%,var(--flux-bg) 60%),var(--flux-bg);
      border-radius:0 0 26px 26px;
      touch-action:pan-y;
    }
    #library .flux-hero canvas{position:absolute;inset:0;width:100%;height:100%;display:block;opacity:0;transition:opacity 1.2s ease}
    #library .flux-hero canvas.on{opacity:1}
    #library .flux-hero::after{
      content:"";position:absolute;left:0;right:0;bottom:0;height:46%;pointer-events:none;z-index:1;
      background:linear-gradient(to bottom,rgba(0,0,0,0),var(--flux-bg) 94%);
    }
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
      // aspect-correct coordinates: the swirl stays round on a wide band
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

  /* Palette from the theme variables. Near-black base, glow in the hue, a warmer highlight. */
  function palette(THREE, hero) {
    const cs = getComputedStyle(hero);
    const hue = parseFloat(cs.getPropertyValue('--flux-hue')) || 72;
    const sat = clamp01(parseFloat(cs.getPropertyValue('--flux-sat')) || 0.9);
    const base = new THREE.Color(), glow = new THREE.Color(), hi = new THREE.Color();
    base.setHSL(hue / 360, 0.3, 0.02);
    glow.setHSL(hue / 360, sat, 0.44);
    hi.setHSL(((hue + 22) % 360) / 360, sat, 0.56);
    return { a: base, b: glow, c: hi };
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
    const pal = palette(THREE, hero);
    const uniforms = {
      uRes: { value: new THREE.Vector2(1, 1) },
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) },
      uA: { value: pal.a },
      uB: { value: pal.b },
      uC: { value: pal.c },
      uOpacity: { value: OPACITY }
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

    // pointer: a gentle pull toward the finger or cursor
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
      if (!reduce) time += dt * SPEED;
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
  }

  function mount() {
    const lib = document.getElementById('library');
    if (!lib || lib.querySelector('.flux-hero')) return;
    const hero = document.createElement('div');
    hero.className = 'flux-hero';
    hero.setAttribute('aria-hidden', 'true');
    lib.insertBefore(hero, lib.firstChild);

    // Only load Three.js while the library is actually on screen.
    const io = new IntersectionObserver(entries => {
      if (!entries.some(en => en.isIntersecting)) return;
      io.disconnect();
      loadThree().then(THREE => startHero(hero, THREE)).catch(err => console.warn('flux hero:', err));
    }, { threshold: 0 });
    io.observe(hero);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
