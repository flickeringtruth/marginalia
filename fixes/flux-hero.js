/* Marginalia flux vortex hero (Three.js).
   A slow, swirling flow-field band at the top of the library. Original shader, not AnimatedWebs' source.
   - Loads Three.js r128 from cdnjs only when the library is visible.
   - Pauses when scrolled out of view or when the tab is hidden.
   - Follows your finger or mouse gently.
   - Reduced motion: renders one still frame.
   - If WebGL is unavailable, the CSS gradient fallback stays.
   Loaded from read-along-size.js. Remove the import to turn it off. */
(() => {
  if (window.__fluxHero) return;
  window.__fluxHero = true;

  const SRC = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
  const reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  const css = `
    #library .flux-hero{
      position:relative;overflow:hidden;isolation:isolate;
      height:clamp(150px,26vh,240px);
      margin:0 calc(-1 * (var(--sar,0px) + var(--lp))) 0 calc(-1 * (var(--sal,0px) + var(--lp)));
      background:radial-gradient(120% 90% at 30% 20%,color-mix(in srgb,var(--accent) 26%,var(--bg)) 0%,var(--bg) 70%);
      touch-action:pan-y;
    }
    #library .flux-hero canvas{position:absolute;inset:0;width:100%;height:100%;display:block;opacity:0;transition:opacity 1.2s ease}
    #library .flux-hero canvas.on{opacity:1}
    #library .flux-hero::after{
      content:"";position:absolute;left:0;right:0;bottom:0;height:52%;pointer-events:none;z-index:1;
      background:linear-gradient(to bottom,rgba(0,0,0,0),var(--bg) 92%);
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
      float alpha = (0.16 + 0.6 * band) * vign;
      gl_FragColor = vec4(col * alpha, alpha);   // premultiplied
    }
  `;

  const PALETTE = {
    light: { a: '#eef6ff', b: '#5fb3ff', c: '#b893ff' },
    dark:  { a: '#05070f', b: '#0c58c4', c: '#7a46e0' }
  };

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
    const pal = PALETTE.light;
    const uniforms = {
      uRes: { value: new THREE.Vector2(1, 1) },
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) },
      uA: { value: new THREE.Color(pal.a) },
      uB: { value: new THREE.Color(pal.b) },
      uC: { value: new THREE.Color(pal.c) }
    };
    const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false });
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));

    let w = 1, h = 1;
    const resize = () => {
      const r = hero.getBoundingClientRect();
      w = Math.max(1, Math.round(r.width)); h = Math.max(1, Math.round(r.height));
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

    let dark = null, visible = false, raf = 0, last = 0, time = 0;
    const applyPalette = () => {
      const isDark = document.documentElement.classList.contains('dark');
      if (isDark === dark) return;
      dark = isDark;
      const p = isDark ? PALETTE.dark : PALETTE.light;
      uniforms.uA.value.set(p.a); uniforms.uB.value.set(p.b); uniforms.uC.value.set(p.c);
    };
    const frame = now => {
      raf = 0;
      if (!visible || document.hidden) return;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      if (!reduce) time += dt;
      uniforms.uTime.value = time;
      uniforms.uMouse.value.lerp(target, reduce ? 1 : 0.06);
      applyPalette();
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

    // first frame: fade the canvas in once it has painted
    renderer.render(scene, cam);
    requestAnimationFrame(() => canvas.classList.add('on'));
    if (reduce) { visible = true; renderer.render(scene, cam); visible = false; }
    else kick();
  }

  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }

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
