/* =========================================================
   POLUS · 3D OBJECTS
   Real-time three.js versions of the six destinations and the
   three project planets. One shared WebGL canvas draws every
   object into the on-screen box of its <span class="obj" data-o="...">,
   so the objects follow hover, the fly-in zoom and phone scrolling.
   Shaders for planets / rings / star surfaces come from space.js.
   ========================================================= */
import * as THREE from 'three';

const NOISE = /* glsl */`
  vec4 permute(vec4 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
  float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0); const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i = floor(v + dot(v, C.yyy)); vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz); vec3 l = 1.0 - g; vec3 i1 = min(g.xyz, l.zxy); vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx; vec3 x2 = x0 - i2 + 2.0 * C.xxx; vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
    i = mod(i, 289.0);
    vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 1.0 / 7.0; vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z); vec4 x_ = floor(j * ns.z); vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy; vec4 y = y_ * ns.x + ns.yyyy; vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy); vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0; vec4 s1 = floor(b1) * 2.0 + 1.0; vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy; vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x); vec3 p1 = vec3(a0.zw, h.y); vec3 p2 = vec3(a1.xy, h.z); vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0); m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
  }
  float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * snoise(p); p *= 2.07; a *= 0.5; } return s; }`;

const PHONE = Math.min(screen.width, screen.height) < 700;
const SEG = PHONE ? 48 : 72;
const LIGHT = new THREE.Vector3(-0.55, 0.45, 0.7).normalize();   // soft key light from the upper left

/* ---------- shared textures ---------- */
function radial(stops, size = 128) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([o, col]) => grd.addColorStop(o, col));
  g.fillStyle = grd; g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const glowTex = radial([[0, 'rgba(255,255,255,1)'], [.18, 'rgba(255,255,255,.5)'], [.5, 'rgba(255,255,255,.1)'], [1, 'rgba(255,255,255,0)']]);
const dotTex = radial([[0, 'rgba(255,255,255,1)'], [.35, 'rgba(255,255,255,.7)'], [1, 'rgba(255,255,255,0)']], 32);
function flareTex() {                        // the Polus four-point star, softly glowing
  const s = 256, c = document.createElement('canvas'); c.width = c.height = s;
  const g = c.getContext('2d'); g.translate(s / 2, s / 2);
  const star = (k, a) => { g.save(); g.scale(k, k); g.beginPath();
    g.moveTo(0, -120); g.bezierCurveTo(4, -40, 8, -8, 120, 0); g.bezierCurveTo(8, 8, 4, 40, 0, 120);
    g.bezierCurveTo(-4, 40, -8, 8, -120, 0); g.bezierCurveTo(-8, -8, -4, -40, 0, -120);
    g.fillStyle = `rgba(255,255,255,${a})`; g.fill(); g.restore(); };
  g.filter = 'blur(6px)'; star(1.02, .55); g.filter = 'none'; star(.98, 1);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const sprite = (tex, color, scale, opacity = 1) => {
  const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity }));
  m.scale.setScalar(scale); return m;
};

/* ---------- materials (from space.js) ---------- */
const VERT = /* glsl */`varying vec3 vL; varying vec3 vN; varying vec3 vP;
  void main() { vL = normal; vN = normalize(mat3(modelMatrix) * normal); vec4 wp = modelMatrix * vec4(position, 1.0); vP = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`;

// planets: rocky (0), swirling clouds (1), desert with a polar cap (2), gas giant bands (3)
const planetMat = (kind, cols, seed) => new THREE.ShaderMaterial({
  uniforms: { cA: { value: new THREE.Color(cols[0]) }, cB: { value: new THREE.Color(cols[1]) }, cC: { value: new THREE.Color(cols[2]) },
    uKind: { value: kind }, uSeed: { value: seed }, uGlow: { value: 0 }, uLight: { value: LIGHT } },
  vertexShader: VERT,
  fragmentShader: /* glsl */`
    uniform vec3 cA, cB, cC, uLight; uniform float uKind, uSeed, uGlow; varying vec3 vL; varying vec3 vN; varying vec3 vP;
    ${NOISE}
    void main() {
      vec3 p = vL + uSeed; vec3 base;
      if (uKind < 0.5) {
        float n = fbm(p * 2.6); float c = fbm(p * 9.0);
        base = mix(cB, cA, smoothstep(-0.45, 0.45, n));
        base = mix(base, cC, smoothstep(0.25, 0.55, c) * 0.55);
        base *= 0.85 + 0.3 * smoothstep(-0.2, 0.3, snoise(p * 22.0));
      } else if (uKind < 1.5) {
        float w = fbm(p * 1.6);
        float n = fbm(vec3(vL.x * 1.4, vL.y * 5.0 + w * 1.8, vL.z * 1.4) + uSeed);
        base = mix(cB, cA, smoothstep(-0.5, 0.5, n));
        base = mix(base, cC, smoothstep(0.35, 0.7, n) * 0.55);
      } else if (uKind < 2.5) {
        float n = fbm(p * 2.2);
        base = mix(cA, cB, smoothstep(0.0, 0.45, n));
        base = mix(base, cC, smoothstep(0.35, 0.8, fbm(p * 7.0)) * 0.3);
        float cap = smoothstep(0.93, 0.95, abs(vL.y) + n * 0.03);
        base = mix(base, vec3(0.93, 0.92, 0.9), cap);
      } else {
        float warp = fbm(vec3(vL.x * 3.0, vL.y * 12.0, vL.z * 3.0) + uSeed) * 0.07 + fbm(p * 5.0) * 0.015;
        float lat = vL.y + warp;
        float b1 = 0.5 + 0.5 * sin(lat * 23.0 + uSeed);
        float b2 = 0.5 + 0.5 * sin(lat * 9.0 + 1.3);
        base = mix(cB, cA, b1);
        base = mix(base, cC, smoothstep(0.55, 0.95, b2) * 0.55);
      }
      vec3 N = normalize(vN); vec3 V = normalize(cameraPosition - vP);
      float ndl = dot(N, uLight);
      vec3 col = base * (max(ndl, 0.0) * 1.3 + 0.05);
      float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
      col += mix(cA, vec3(1.0), 0.4) * fres * 0.45 * smoothstep(-0.3, 0.6, ndl);
      col += vec3(1.0) * fres * uGlow * 0.9;
      col *= 1.0 + uGlow * 0.25;
      gl_FragColor = vec4(col, 1.0);
      #include <colorspace_fragment>
    }`
});
// a star's burning surface
const starMat = (c1, c2) => new THREE.ShaderMaterial({
  uniforms: { uT: { value: 0 }, cA: { value: new THREE.Color(c1) }, cB: { value: new THREE.Color(c2) }, uGlow: { value: 0 } },
  vertexShader: VERT,
  fragmentShader: /* glsl */`
    uniform float uT, uGlow; uniform vec3 cA, cB; varying vec3 vL; varying vec3 vN; varying vec3 vP;
    ${NOISE}
    void main() {
      float n = fbm(vL * 3.2 + vec3(0.0, uT * 0.08, uT * 0.05));
      float g = fbm(vL * 11.0 - vec3(uT * 0.1));
      vec3 col = mix(cA, cB, smoothstep(-0.5, 0.6, n + g * 0.35));
      float mu = max(dot(normalize(vN), normalize(cameraPosition - vP)), 0.0);
      col *= 0.6 + 0.4 * pow(mu, 0.6);
      gl_FragColor = vec4(col * (1.35 + uGlow * 0.4), 1.0);
      #include <colorspace_fragment>
    }`
});
// Saturn-style ring with a Cassini gap
const ringMat = (ri, ro, c1, c2) => new THREE.ShaderMaterial({
  uniforms: { uIn: { value: ri }, uOut: { value: ro }, cA: { value: new THREE.Color(c1) }, cB: { value: new THREE.Color(c2) }, uGlow: { value: 0 } },
  vertexShader: /* glsl */`varying float vR; void main() { vR = length(position.xy); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform float uIn, uOut, uGlow; uniform vec3 cA, cB; varying float vR;
    void main() {
      float t = (vR - uIn) / (uOut - uIn);
      float bands = 0.62 + 0.18 * sin(t * 38.0) + 0.2 * sin(t * 13.0 + 1.0);
      float gap = 1.0 - smoothstep(0.0, 0.02, 0.025 - abs(t - 0.62));
      float a = smoothstep(0.0, 0.06, t) * (1.0 - smoothstep(0.9, 1.0, t)) * bands * gap;
      vec3 col = mix(cA, cB, t) * (1.1 + uGlow * 0.5);
      gl_FragColor = vec4(col * a, a * 0.9);
      #include <colorspace_fragment>
    }`,
  transparent: true, side: THREE.DoubleSide, depthWrite: false
});
const ellipseLine = (rx, ry, color, opacity) => {
  const pts = []; for (let k = 0; k <= 128; k++) { const a = k / 128 * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * rx, Math.sin(a) * ry, 0)); }
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
};

/* ---------- the objects ---------- */
// each builder returns { scene, update(t, dt, glow) }; the "core" of every object is radius ~1
const BUILD = {
  // Orbit: a ringed gas giant
  orbit() {
    const scene = new THREE.Scene(), tilt = new THREE.Group(); tilt.rotation.set(0.42, 0, -0.32); scene.add(tilt);
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.78, SEG, SEG / 2), planetMat(3, ['#f0dcb2', '#a8784c', '#fff2da'], 3.3));
    tilt.add(body);
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.65, 128, 1), ringMat(1.0, 1.65, '#c9a877', '#f3e6c6'));
    ring.rotation.x = -Math.PI / 2; tilt.add(ring);
    return { scene, update(t, dt, glow) { body.rotation.y += dt * 0.25; body.material.uniforms.uGlow.value = glow; ring.material.uniforms.uGlow.value = glow; } };
  },
  // Systems: a glowing core, three tilted orbits, signals racing round them
  systems() {
    const scene = new THREE.Scene(), g = new THREE.Group(); scene.add(g);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.26, 32, 16), starMat('#9fd0ff', '#ffffff')); g.add(core);
    const halo = sprite(glowTex, 0x7fb8ff, 1.7, .9); g.add(halo);
    const orbits = [], dots = [];
    [[0, 0], [Math.PI / 3, 0.35], [-Math.PI / 3, -0.35]].forEach(([rz, rx], i) => {
      const o = new THREE.Group(); o.rotation.set(1.05 + rx, 0, rz); g.add(o);
      o.add(ellipseLine(1.3, 1.3, 0x9cc9ff, 0.45));
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 8), new THREE.MeshBasicMaterial({ color: i === 1 ? 0xffd48a : 0xd8f0ff }));
      const dg = sprite(glowTex, i === 1 ? 0xffc46b : 0x8fd0ff, 0.5, .9); d.add(dg);
      o.add(d); orbits.push(o); dots.push({ d, sp: 0.9 + i * 0.35, ph: i * 2.1 });
    });
    return { scene, update(t, dt, glow) {
      g.rotation.y += dt * (0.18 + glow * 0.4);
      dots.forEach(({ d, sp, ph }) => { const a = t * sp * (1 + glow) + ph; d.position.set(Math.cos(a) * 1.3, Math.sin(a) * 1.3, 0); });
      core.material.uniforms.uT.value = t; core.material.uniforms.uGlow.value = glow; halo.material.opacity = .8 + glow * .4;
    } };
  },
  // Worlds: a spiral galaxy of thousands of coloured stars
  worlds() {
    const scene = new THREE.Scene(), g = new THREE.Group(); g.rotation.x = -1.05; g.rotation.z = 0.25; scene.add(g);
    let s = 42; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const N = PHONE ? 3500 : 7000, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), size = new Float32Array(N);
    const warm = new THREE.Color('#ffd9a3'), blue = new THREE.Color('#8fb6ff'), pink = new THREE.Color('#ff9ecb'), white = new THREE.Color('#ffffff'), c = new THREE.Color();
    for (let i = 0; i < N; i++) {
      const arm = i % 2, t = Math.pow(r(), 0.75), a = t * 3.6 * Math.PI + arm * Math.PI + (r() - .5) * (0.5 + t * 0.5);
      const rad = 0.08 + t * 1.45, spread = (r() - .5) * 0.22 * (0.4 + t);
      pos[i * 3] = Math.cos(a) * rad + spread; pos[i * 3 + 1] = Math.sin(a) * rad + spread; pos[i * 3 + 2] = (r() - .5) * 0.12 * (1 - t);
      c.copy(warm).lerp(blue, Math.min(1, t * 1.5)); if (r() < 0.06 && t > 0.3) c.copy(pink); if (r() < 0.08) c.lerp(white, 0.6);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; size[i] = (0.6 + r() * 1.4) * (1.2 - t * 0.5);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setAttribute('size', new THREE.BufferAttribute(size, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTex: { value: dotTex }, uScale: { value: 1 }, uGlow: { value: 0 } },
      vertexShader: /* glsl */`attribute float size; varying vec3 vC; uniform float uScale;
        void main() { vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * uScale * (6.0 / -mv.z); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: /* glsl */`uniform sampler2D uTex; uniform float uGlow; varying vec3 vC;
        void main() { float a = texture2D(uTex, gl_PointCoord).a; gl_FragColor = vec4(vC * (0.95 + uGlow * 0.5) * a, a); }`,
      vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    });
    const pts = new THREE.Points(geo, mat); g.add(pts);
    const core = sprite(glowTex, 0xffe0b0, 1.3, 1); scene.add(core);
    const core2 = sprite(glowTex, 0xffffff, 0.45, 1); scene.add(core2);
    return { scene, pts, update(t, dt, glow) { g.rotation.z += dt * (0.06 + glow * 0.25); mat.uniforms.uGlow.value = glow; core.material.opacity = .9 + glow * .3; } };
  },
  // Process: two stars locked in orbit, one warm and one blue
  process() {
    const scene = new THREE.Scene(), g = new THREE.Group(); g.rotation.x = 0.9; scene.add(g);
    g.add(ellipseLine(0.95, 0.95, 0xffffff, 0.18));
    const a = new THREE.Mesh(new THREE.SphereGeometry(0.34, 48, 24), starMat('#ff8a3d', '#ffe2a8'));
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.24, 48, 24), starMat('#6fa8ff', '#e8f3ff'));
    a.add(sprite(glowTex, 0xffa057, 1.9, .95)); b.add(sprite(glowTex, 0x7fb4ff, 1.5, .95));
    g.add(a, b);
    return { scene, update(t, dt, glow) {
      const ang = t * (0.55 + glow * 0.8);
      a.position.set(Math.cos(ang) * 0.42, Math.sin(ang) * 0.42, 0); b.position.set(-Math.cos(ang) * 0.95 * 0.62, -Math.sin(ang) * 0.95 * 0.62, 0);
      [a, b].forEach(m => { m.material.uniforms.uT.value = t; m.material.uniforms.uGlow.value = glow; });
    } };
  },
  // Polus: the pole star, with the four-point flare of the logo and its tilted ring
  polus() {
    const scene = new THREE.Scene();
    const star = new THREE.Mesh(new THREE.SphereGeometry(0.2, 32, 16), starMat('#cfe2ff', '#ffffff')); scene.add(star);
    const halo = sprite(glowTex, 0xcfe0ff, 1.8, .9); scene.add(halo);
    const flare = sprite(flareTex(), 0xffffff, 1.95, 1); scene.add(flare);
    const ringG = new THREE.Group(); ringG.rotation.set(1.15, 0.2, -0.55); scene.add(ringG);
    ringG.add(ellipseLine(1.2, 1.2, 0xe8d9b0, 0.7));
    const moon = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 6), new THREE.MeshBasicMaterial({ color: 0xfff1cf })); moon.add(sprite(glowTex, 0xffd98f, 0.4, .9)); ringG.add(moon);
    return { scene, update(t, dt, glow) {
      const a = t * 0.5; moon.position.set(Math.cos(a) * 1.2, Math.sin(a) * 1.2, 0);
      flare.material.rotation = Math.sin(t * 0.4) * 0.05; flare.scale.setScalar(1.95 + Math.sin(t * 1.3) * 0.05 + glow * 0.3);
      star.material.uniforms.uT.value = t; halo.material.opacity = .85 + glow * .3;
    } };
  },
  // Contact: a pulsar sweeping two beams while signals ripple outward
  contact() {
    const scene = new THREE.Scene();
    const star = new THREE.Mesh(new THREE.SphereGeometry(0.2, 32, 16), starMat('#b9a3ff', '#ffffff')); scene.add(star);
    scene.add(sprite(glowTex, 0xb8a6ff, 1.5, .95));
    const axis = new THREE.Group(); axis.rotation.z = 0.5; scene.add(axis);
    const spin = new THREE.Group(); axis.add(spin);
    const beamMat = new THREE.ShaderMaterial({
      uniforms: { uGlow: { value: 0 } },
      vertexShader: /* glsl */`varying float vY; void main() { vY = position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */`uniform float uGlow; varying float vY; void main() { float a = (1.0 - abs(vY) / 1.05) * (0.45 + uGlow * 0.3); gl_FragColor = vec4(vec3(0.78, 0.72, 1.0) * a, a); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide
    });
    [1, -1].forEach(sg => { const cone = new THREE.Mesh(new THREE.ConeGeometry(0.24, 1.05, 24, 1, true), beamMat); cone.position.y = sg * 0.56; cone.rotation.z = sg > 0 ? Math.PI : 0; cone.rotation.x = 0.35; spin.add(cone); });
    const rings = [0, 1, 2].map(i => { const m = new THREE.Mesh(new THREE.RingGeometry(0.97, 1, 96), new THREE.MeshBasicMaterial({ color: 0xcfc4ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); m.rotation.x = 1.1; scene.add(m); return m; });
    return { scene, update(t, dt, glow) {
      spin.rotation.y += dt * (1.6 + glow * 3);
      rings.forEach((m, i) => { const k = ((t * 0.45 + i / 3) % 1); m.scale.setScalar(0.25 + k * 1.35); m.material.opacity = (1 - k) * 0.6; });
      star.material.uniforms.uT.value = t; beamMat.uniforms.uGlow.value = glow;
    } };
  },
  // Project planets
  'planet-ocean'() { return planet(1, ['#79c3e6', '#154a78', '#f2fbff'], 5.1); },
  'planet-gas'()   { return planet(3, ['#e9d3ad', '#9a6440', '#f7ecdb'], 8.7, true); },
  'planet-rock'()  { return planet(2, ['#cf7447', '#6b2c18', '#efaa78'], 2.2); },
};
function planet(kind, cols, seed, moon) {
  const scene = new THREE.Scene(), tilt = new THREE.Group(); tilt.rotation.z = 0.35; scene.add(tilt);
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.95, SEG, SEG / 2), planetMat(kind, cols, seed)); tilt.add(body);
  let m = null;
  if (moon) { m = new THREE.Mesh(new THREE.SphereGeometry(0.13, 24, 12), planetMat(0, ['#bdb6ad', '#5f5a55', '#e2dbd0'], 1.7)); scene.add(m); }
  return { scene, update(t, dt, glow) {
    body.rotation.y += dt * 0.2; body.material.uniforms.uGlow.value = glow;
    if (m) { const a = t * 0.45; m.position.set(Math.cos(a) * 1.35, Math.sin(a) * 0.35, Math.sin(a) * 1.35); m.visible = true; }
  } };
}

/* ---------- renderer: one canvas, one viewport per object ---------- */
let renderer, canvas, camera;
const objects = new Map();      // key -> built object
const PAD = 0.42;               // extra room around each box for rings, glows and orbits
export function start() {
  try {
    canvas = document.createElement('canvas'); canvas.id = 'obj3d';
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  } catch (e) { return false; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, PHONE ? 1.75 : 2));
  renderer.setClearColor(0x000000, 0);
  renderer.autoClear = false;
  camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50); camera.position.set(0, 0, 6.35);
  document.body.appendChild(canvas);
  document.body.classList.add('o3d');
  const size = () => renderer.setSize(innerWidth, innerHeight, false);
  addEventListener('resize', size); size();
  requestAnimationFrame(loop);
  return true;
}
const clock = new THREE.Clock();
let t = 0;
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  const body = document.body;
  // nothing to draw behind the project page, or behind a full-screen panel on phones
  const covered = document.querySelector('#project.open') || (body.classList.contains('m') && document.querySelector('.panel.open'));
  const layer = document.querySelector('.nodes.on');
  if (!body.classList.contains('inside') || !layer || covered) { canvas.style.opacity = 0; return; }
  t += dt;
  canvas.style.opacity = layer.style.opacity || 1;
  renderer.setScissorTest(false); renderer.clear();
  renderer.setScissorTest(true);
  const H = innerHeight;
  layer.querySelectorAll('.obj[data-o]').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.bottom < -r.height || r.top > H + r.height || r.width < 4) return;
    const key = el.dataset.o;
    let o = objects.get(key); if (!o) { o = BUILD[key](); objects.set(key, o); }
    const node = el.closest('.node');
    const target = node && (node.matches(':hover') || node.classList.contains('lit') || node === document.activeElement) ? 1 : 0;
    o.glow = (o.glow || 0) + (target - (o.glow || 0)) * Math.min(1, dt * 6);
    o.update(t, dt, o.glow);
    const p = r.width * PAD, x = r.left - p, y = H - r.bottom - p, w = r.width + 2 * p, h = r.height + 2 * p;
    if (o.pts) o.pts.material.uniforms.uScale.value = h * renderer.getPixelRatio() / 230;   // galaxy stars scale with the drawing
    renderer.setViewport(x, y, w, h); renderer.setScissor(x, y, w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    renderer.render(o.scene, camera);
  });
}
