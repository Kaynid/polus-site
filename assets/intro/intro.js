import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// ---------- renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
const PHONE = Math.min(screen.width, screen.height) < 700;
renderer.setPixelRatio(Math.min(devicePixelRatio, PHONE ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.getElementById('intro').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x010207);
const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.01, 6000);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.9, 0.55, 1.0);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------- the celestial pole frame ----------
// A = Earth's rotation axis (23.4 deg tilt, leaning slightly toward the viewer so the Arctic shows).
const Y = new THREE.Vector3(0, 1, 0);
const A = Y.clone().applyEuler(new THREE.Euler(0.32, 0, -THREE.MathUtils.degToRad(23.4))).normalize();
const Z = new THREE.Vector3(0, 0, 1);
const F = Z.clone().sub(A.clone().multiplyScalar(Z.dot(A))).normalize(); // toward the viewer, perpendicular to axis
const POLE = A.clone(); // North Pole on a radius-1 Earth
const SUN = new THREE.Vector3(-0.85, 0.75, 0.55).normalize(); // high enough that the Arctic is in daylight

// ---------- textures ----------
const manager = new THREE.LoadingManager();
const loader = new THREE.TextureLoader(manager);
const aniso = renderer.capabilities.getMaxAnisotropy();
const tex = (url, srgb) => {
  const t = loader.load(url);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  return t;
};
const TEX = 'assets/intro/textures/';
const RES = renderer.capabilities.maxTextureSize >= 8192 && Math.min(screen.width, screen.height) >= 700 ? '8k' : '4k';
const dayMap = tex(TEX + 'day_' + RES + '.jpg', true);
const nightMap = tex(TEX + 'night_' + RES + '.jpg', true);
const cloudMap = tex(TEX + 'bump_rough_clouds_4k.jpg', false); // b = clouds, r = bump
cloudMap.wrapS = THREE.RepeatWrapping;

// ---------- Earth ----------
const earthAxis = new THREE.Group();
earthAxis.quaternion.setFromUnitVectors(Y, A);
scene.add(earthAxis);

const earthMat = new THREE.ShaderMaterial({
  uniforms: {
    dayMap: { value: dayMap }, nightMap: { value: nightMap }, cloudMap: { value: cloudMap },
    sunDir: { value: SUN }, cloudShift: { value: 0 }
  },
  vertexShader: /* glsl */`
    varying vec2 vUv; varying vec3 vN; varying vec3 vP; varying vec3 vLocalN;
    void main() {
      vUv = uv; vLocalN = normal;
      vN = normalize(mat3(modelMatrix) * normal);
      vec4 wp = modelMatrix * vec4(position, 1.0); vP = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }`,
  fragmentShader: /* glsl */`
    uniform sampler2D dayMap, nightMap, cloudMap; uniform vec3 sunDir; uniform float cloudShift;
    varying vec2 vUv; varying vec3 vN; varying vec3 vP; varying vec3 vLocalN;

    // 3D simplex noise (Ashima / Stefan Gustavson, MIT)
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
    float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * snoise(p); p *= 2.07; a *= 0.5; } return s; }
    // distance to the nearest Voronoi cell edge: polygonal ice floes (after Inigo Quilez)
    vec3 hash3(vec3 p) {
      p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6)));
      return fract(sin(p) * 43758.5453);
    }
    float floeEdge(vec3 x) {
      vec3 n = floor(x), f = fract(x), mr = vec3(0.0); float md = 8.0;
      for (int k = -1; k <= 1; k++) for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
        vec3 g = vec3(float(i), float(j), float(k)); vec3 r = g + hash3(n + g) - f; float d = dot(r, r);
        if (d < md) { md = d; mr = r; }
      }
      md = 8.0;
      for (int k = -1; k <= 1; k++) for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
        vec3 g = vec3(float(i), float(j), float(k)); vec3 r = g + hash3(n + g) - f;
        if (dot(mr - r, mr - r) > 1e-5) md = min(md, dot(0.5 * (mr + r), normalize(r - mr)));
      }
      return md;
    }

    // Arctic sea ice, drawn procedurally so there is no texture pinch at the pole
    vec3 seaIce(vec3 day, float ocean) {
      float lat = degrees(asin(clamp(vLocalN.y, -1.0, 1.0)));
      float edge = 77.0 + fbm(vLocalN * 5.0) * 7.0;
      float ice = smoothstep(edge - 1.2, edge + 1.2, lat);
      ice *= max(ocean, smoothstep(84.0, 86.0, lat)); // keep Greenland / islands from the map
      if (ice < 0.001) return day;
      // floes: patchy brightness; leads: angular dark cracks along floe edges, clustered in bands
      vec3 col = mix(vec3(0.93, 0.955, 0.99), vec3(0.7, 0.77, 0.87), smoothstep(-0.3, 0.9, fbm(vLocalN * 26.0)));
      vec3 q = vLocalN * 28.0 + vec3(snoise(vLocalN * 60.0)) * 0.12;
      float band = smoothstep(0.05, 0.6, snoise(vLocalN * 6.0 + 11.0));
      float px = length(fwidth(q)); // cell units per pixel: widen and fade cracks when far away (no shimmer)
      float lead = (1.0 - smoothstep(0.0, max(0.014, px), floeEdge(q))) * (0.1 + 0.9 * band) * (1.0 - smoothstep(0.08, 0.3, px))
                 + 0.5 * (1.0 - smoothstep(0.0, max(0.012, px * 3.1), floeEdge(q * 3.1 + 7.3))) * band * (1.0 - smoothstep(0.03, 0.1, px));
      vec3 water = mix(vec3(0.05, 0.11, 0.2), vec3(0.42, 0.52, 0.64), smoothstep(-0.2, 0.8, snoise(q * 0.6))); // some refrozen
      col = mix(col, water, clamp(lead, 0.0, 1.0) * 0.7);
      return mix(day, col * 0.74, ice);
    }

    void main() {
      vec3 N = normalize(vN); vec3 V = normalize(cameraPosition - vP);
      float ndl = dot(N, sunDir);
      float dayAmt = smoothstep(-0.10, 0.22, ndl);
      vec3 day = texture2D(dayMap, vUv).rgb;
      day = mix(vec3(dot(day, vec3(0.299, 0.587, 0.114))), day, 0.78) * 0.82; // calmer, satellite-like colour
      vec3 night = texture2D(nightMap, vUv).rgb;
      float cloud = smoothstep(0.12, 0.85, texture2D(cloudMap, vUv + vec2(cloudShift, 0.0)).b);
      cloud *= 1.0 - smoothstep(0.88, 0.95, abs(vLocalN.y)); // no clouds over the pole (texture pinches there)
      float ocean = smoothstep(0.015, 0.08, day.b - max(day.r, day.g));
      day = seaIce(day, ocean);
      ocean *= 1.0 - smoothstep(0.96, 0.98, vLocalN.y);
      vec3 H = normalize(sunDir + V);
      float spec = pow(max(dot(N, H), 0.0), 70.0) * ocean * (1.0 - cloud) * 0.55;
      float lam = max(ndl, 0.0);
      vec3 col = day * (lam * 1.35 + 0.015);
      col = mix(col, vec3(0.96, 0.97, 1.0) * (lam * 1.15 + 0.01), cloud * 0.92);
      col += night * vec3(1.0, 0.72, 0.38) * 2.2 * (1.0 - dayAmt) * (1.0 - cloud * 0.85);
      col += spec * vec3(1.0, 0.94, 0.82) * dayAmt;
      float fres = pow(1.0 - max(dot(N, V), 0.0), 2.6);
      col += vec3(0.28, 0.52, 1.0) * fres * 0.85 * smoothstep(-0.35, 0.5, ndl);
      gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`
});
const earth = new THREE.Mesh(new THREE.SphereGeometry(1, PHONE ? 160 : 256, PHONE ? 80 : 128), earthMat);
earthAxis.add(earth);
const SPIN0 = -Math.PI / 2 - 0.35; // Europe / Africa toward camera at the start

// atmosphere halo
const ATMO_R = 1.06;
const atmo = new THREE.Mesh(
  new THREE.SphereGeometry(ATMO_R, 128, 64),
  new THREE.ShaderMaterial({
    uniforms: { sunDir: { value: SUN } },
    vertexShader: /* glsl */`
      varying vec3 vN; varying vec3 vP;
      void main() {
        vN = normalize(mat3(modelMatrix) * normal);
        vec4 wp = modelMatrix * vec4(position, 1.0); vP = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 sunDir; varying vec3 vN; varying vec3 vP;
      void main() {
        // how close the view ray passes to Earth's centre: glow peaks at the limb, fades to the shell edge
        vec3 rd = normalize(vP - cameraPosition);
        float h = length(cross(rd, -cameraPosition));
        float rim = pow(1.0 - clamp((h - 1.0) / ${(ATMO_R - 1).toFixed(3)}, 0.0, 1.0), 2.2);
        vec3 N = normalize(vN);
        float lit = smoothstep(-0.4, 0.6, dot(N, sunDir));
        gl_FragColor = vec4(vec3(0.30, 0.58, 1.0) * rim * lit * 1.6, 1.0);
      }`,
    side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false
  })
);
scene.add(atmo);

// ---------- the celestial pole beam ----------
const BEAM_BOTTOM = -2000, BEAM_TOP = 1400;
// Unit-radius cylinder; the vertex shader sets the real radius so the beam is never thinner
// than ~1.2px on screen (no dropouts) but stays a fine line up close.
const beamMat = new THREE.ShaderMaterial({
  uniforms: { uFade: { value: 1 }, uColor: { value: new THREE.Color(0xffffff) }, uRadius: { value: 0.0022 }, uPx: { value: 0.001 }, uCamY: { value: 0 }, uRingK: { value: 13.5 }, uRingSC: { value: 0.004 } },
  vertexShader: /* glsl */`
    uniform float uRadius, uPx, uCamY, uRingK, uRingSC;
    varying float vY; varying vec3 vN; varying vec3 vP; varying float vDim;
    void main() {
      // rings are spaced geometrically out from the camera's height on the axis, so the
      // screen-width rule below stays accurate right next to the camera
      float s = position.y;
      float y = clamp(uCamY + sign(s) * (exp(abs(s) * uRingK) - 1.0) * uRingSC, ${BEAM_BOTTOM.toFixed(1)}, ${BEAM_TOP.toFixed(1)});
      vY = y;
      vec3 axisPt = vec3(0.0, y, 0.0);
      float depth = max(-(modelViewMatrix * vec4(axisPt, 1.0)).z, 0.0);
      float rMin = depth * uPx * 0.9;       // ~1.8px wide minimum...
      float r = max(uRadius, rMin);
      vDim = clamp(uRadius / r * 1.6, 0.35, 1.0); // ...but dimmed to match, so it reads as a fine, smooth line
      vec3 local = axisPt + vec3(position.x, 0.0, position.z) * r;
      vN = normalize(mat3(modelMatrix) * normal);
      vec4 wp = modelMatrix * vec4(local, 1.0); vP = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }`,
  fragmentShader: /* glsl */`
    uniform float uFade; uniform vec3 uColor; varying float vY; varying vec3 vN; varying vec3 vP; varying float vDim;
    void main() {
      vec3 V = normalize(cameraPosition - vP);
      float core = pow(abs(dot(normalize(vN), V)), 1.5);
      float tip = 1.0 - smoothstep(${(BEAM_TOP * 0.35).toFixed(1)}, ${BEAM_TOP.toFixed(1)}, vY);
      float tail = smoothstep(${BEAM_BOTTOM.toFixed(1)}, ${(BEAM_BOTTOM * 0.5).toFixed(1)}, vY);
      // kept near the bloom threshold: bloom on a 1-2px line breaks up into beads
      gl_FragColor = vec4(uColor * 1.5 * vDim * core * tip * tail * uFade, 1.0);
    }`,
  blending: THREE.AdditiveBlending, transparent: true, depthWrite: false
});
const beamGeo = new THREE.CylinderGeometry(1, 1, 2, 12, 700, true); // y in [-1, 1], remapped in the shader
const beam = new THREE.Mesh(beamGeo, beamMat);
beam.quaternion.setFromUnitVectors(Y, A);
beam.frustumCulled = false;
scene.add(beam);

// soft glow sprite texture
function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.18, 'rgba(255,255,255,0.55)');
  grd.addColorStop(0.5, 'rgba(255,255,255,0.12)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const glowTex = glowTexture();
const poleGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffffff, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true }));
poleGlow.position.copy(POLE).multiplyScalar(1.001);
poleGlow.scale.setScalar(0.05);
scene.add(poleGlow);

// the pole star the beam points at
const polaris = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffffff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
polaris.position.copy(A).multiplyScalar(BEAM_TOP);
polaris.scale.setScalar(36);
scene.add(polaris);

// ---------- stars ----------
function starField(count, rMin, rMax, sizeMin, sizeMax, seed) {
  let s = seed; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const pos = new Float32Array(count * 3), col = new Float32Array(count * 3), size = new Float32Array(count);
  const tint = [new THREE.Color(0xbcd0ff), new THREE.Color(0xffffff), new THREE.Color(0xfff0d8), new THREE.Color(0xffd6a8)];
  for (let i = 0; i < count; i++) {
    const u = rnd() * 2 - 1, th = rnd() * Math.PI * 2, r = rMin + rnd() * (rMax - rMin), q = Math.sqrt(1 - u * u);
    pos.set([r * q * Math.cos(th), r * u, r * q * Math.sin(th)], i * 3);
    const c = tint[Math.floor(rnd() * tint.length)], b = 0.35 + Math.pow(rnd(), 3) * 1.6;
    col.set([c.r * b, c.g * b, c.b * b], i * 3);
    size[i] = sizeMin + Math.pow(rnd(), 4) * (sizeMax - sizeMin);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('size', new THREE.BufferAttribute(size, 1));
  const m = new THREE.ShaderMaterial({
    uniforms: { uPR: { value: renderer.getPixelRatio() } },
    vertexShader: /* glsl */`
      attribute float size; attribute vec3 color; varying vec3 vC; uniform float uPR;
      void main() { vC = color; gl_PointSize = size * uPR; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      varying vec3 vC;
      void main() { float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(vC * a * a, 1.0); }`,
    blending: THREE.AdditiveBlending, transparent: true, depthWrite: false
  });
  const p = new THREE.Points(g, m); p.frustumCulled = false; return p;
}
scene.add(starField(9000, 2600, 4200, 1.2, 3.2, 7));
scene.add(starField(500, 2600, 4200, 2.5, 5.5, 91));

// ---------- speed streaks along the beam ----------
const STREAKS = 1400;
const streakGeo = new THREE.BufferGeometry();
{
  let s = 12345; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const base = new Float32Array(STREAKS * 2 * 3), side = new Float32Array(STREAKS * 2), bright = new Float32Array(STREAKS * 2);
  const R = new THREE.Vector3().crossVectors(A, F);
  for (let i = 0; i < STREAKS; i++) {
    const t = 1.15 + Math.pow(rnd(), 1.6) * 220;            // distance up the axis
    const r = 0.03 + Math.pow(rnd(), 2.2) * (0.25 + t * 0.02); // tighter near the beam
    const th = rnd() * Math.PI * 2;
    const p = A.clone().multiplyScalar(t).addScaledVector(F, Math.cos(th) * r).addScaledVector(R, Math.sin(th) * r);
    const b = 0.2 + rnd() * 0.8;
    for (let k = 0; k < 2; k++) { base.set([p.x, p.y, p.z], (i * 2 + k) * 3); side[i * 2 + k] = k; bright[i * 2 + k] = b; }
  }
  streakGeo.setAttribute('position', new THREE.BufferAttribute(base, 3));
  streakGeo.setAttribute('side', new THREE.BufferAttribute(side, 1));
  streakGeo.setAttribute('bright', new THREE.BufferAttribute(bright, 1));
}
const streakMat = new THREE.ShaderMaterial({
  uniforms: { uLen: { value: 0.01 }, uAxis: { value: A }, uAlpha: { value: 0 } },
  vertexShader: /* glsl */`
    attribute float side; attribute float bright; uniform float uLen; uniform vec3 uAxis;
    varying float vB; varying float vSide;
    void main() {
      vec3 p = position - uAxis * side * uLen;
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      vB = bright * smoothstep(40.0, 2.0, -mv.z); vSide = side;
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: /* glsl */`
    uniform float uAlpha; varying float vB; varying float vSide;
    void main() { gl_FragColor = vec4(vec3(1.0) * vB * uAlpha * (1.0 - vSide * 0.9), 1.0); }`,
  blending: THREE.AdditiveBlending, transparent: true, depthWrite: false
});
const streaks = new THREE.LineSegments(streakGeo, streakMat);
streaks.frustumCulled = false;
scene.add(streaks);

// ---------- camera path ----------
const quatLook = (pos, target, up) => {
  const m = new THREE.Matrix4().lookAt(pos, target, up);
  return new THREE.Quaternion().setFromRotationMatrix(m);
};
// Keyframe poses
const K1 = { pos: new THREE.Vector3(0, 0, 7.2), target: new THREE.Vector3(0, 0, 0), up: Y };
// K2: hovering over the Arctic, a little on the viewer's side of the pole, looking down at it
// with the horizon in the upper part of the frame.
const R = new THREE.Vector3().crossVectors(A, F).normalize();
const K2_COLAT = THREE.MathUtils.degToRad(8), K2_ALT = 1.3, K2_PITCH_UP = THREE.MathUtils.degToRad(7);
const S = A.clone().multiplyScalar(Math.cos(K2_COLAT)).addScaledVector(F, Math.sin(K2_COLAT));
const K2pos = S.clone().multiplyScalar(K2_ALT);
const toPole = POLE.clone().sub(K2pos).normalize().applyAxisAngle(R, K2_PITCH_UP);
const K2 = { pos: K2pos, target: K2pos.clone().add(toPole), up: S };
// K3: above the pole, pitched up to look straight along the beam (beam enters from the bottom).
const K3pos = POLE.clone().addScaledVector(A, 0.9).addScaledVector(F, 0.05);
const K3 = { pos: K3pos, target: K3pos.clone().addScaledVector(A, 100), up: F };
for (const k of [K1, K2, K3]) k.q = quatLook(k.pos, k.target, k.up);
const FAR = 160; // how far up the pole the camera ends

// scroll segments
const P1 = [0.0, 0.34];  // Earth wide -> North Pole close-up
const P2 = [0.40, 0.58]; // turn up the beam, start climbing
const P3 = [0.62, 0.90]; // launch into deep space, settle
const seg = (p, [a, b]) => THREE.MathUtils.clamp((p - a) / (b - a), 0, 1);
const easeIO = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeInOutQuint = t => t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2;

const tmpQ = new THREE.Quaternion(), tmpTarget = new THREE.Vector3(), tmpUp = new THREE.Vector3();
const toCam = new THREE.Vector3();
let lastZ = 0;
function applyProgress(p, dt) {
  const t1 = easeIO(seg(p, P1)), t2 = easeIO(seg(p, P2)), t3raw = seg(p, P3), t3 = easeInOutQuint(t3raw);

  if (p <= P1[1] + 0.03) {
    // aim at a point that slides from Earth's centre to the K2 target, so Earth never leaves frame
    camera.position.lerpVectors(K1.pos, K2.pos, t1);
    tmpTarget.lerpVectors(K1.target, K2.target, t1);
    tmpUp.lerpVectors(K1.up, K2.up, t1).normalize();
    tmpQ.copy(quatLook(camera.position, tmpTarget, tmpUp));
  } else if (p <= P3[0]) {
    camera.position.lerpVectors(K2.pos, K3.pos, t2 * t2); // pitch up first, then climb, so the horizon slides away
    tmpQ.slerpQuaternions(K2.q, K3.q, t2);
  } else {
    camera.position.copy(K3.pos).addScaledVector(A, t3 * FAR);
    tmpQ.copy(K3.q);
  }
  camera.quaternion.copy(tmpQ);

  // beam: fine world radius up close, never thinner than ~1px far away
  toCam.copy(camera.position);
  const axisDist = toCam.sub(A.clone().multiplyScalar(camera.position.dot(A))).length();
  beamMat.uniforms.uRadius.value = 0.0022 * THREE.MathUtils.clamp(axisDist / 7, 0.03, 1);
  beamMat.uniforms.uCamY.value = camera.position.dot(A);
  const ringSC = Math.max(0.004, axisDist * 0.04); // first ring gap ~ 4% of the camera's distance to the beam
  beamMat.uniforms.uRingSC.value = ringSC;
  beamMat.uniforms.uRingK.value = Math.log(1 + (BEAM_TOP - BEAM_BOTTOM) / ringSC);

  // Earth spins gently with scroll
  earth.rotation.y = SPIN0 + p * 0.5;
  earthMat.uniforms.cloudShift.value = p * 0.01;

  // streak length follows camera speed along the axis
  const z = camera.position.dot(A);
  const speed = dt > 0 ? Math.abs(z - lastZ) / dt : 0; lastZ = z;
  streakMat.uniforms.uLen.value = THREE.MathUtils.clamp(speed * 0.045, 0.004, 6);
  streakMat.uniforms.uAlpha.value = THREE.MathUtils.smoothstep(p, 0.42, 0.52) * (1 - THREE.MathUtils.smoothstep(p, 0.86, 0.93));

  // beam fades into the pole star at the end
  beamMat.uniforms.uFade.value = 1 - 0.85 * THREE.MathUtils.smoothstep(p, 0.8, 0.92);
  polaris.material.opacity = THREE.MathUtils.smoothstep(p, 0.7, 0.92);
  poleGlow.material.opacity = 1 - THREE.MathUtils.smoothstep(p, 0.55, 0.65);

}

// ---------- autoplay (replaces scroll) ----------
function fitCamera() {
  const aspect = innerWidth / innerHeight;
  camera.aspect = aspect;
  camera.fov = aspect >= 1 ? 35 : THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(17.5)) / aspect * 0.62));
  camera.updateProjectionMatrix();
  beamMat.uniforms.uPx.value = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / innerHeight;
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
}
addEventListener('resize', fitCamera);
fitCamera();

export const DURATION = 6;   // seconds for the whole journey
const END = 0.93;              // stop on the pole star, before the proto's final idle stretch
const clock = new THREE.Clock();
let raf = 0, startT = 0, onDone = null, stopped = false, ready = false, wanted = false;

function frame(now) {
  if (stopped) return;
  const dt = Math.min(clock.getDelta(), 0.1);
  const t = Math.min(1, (now - startT) / (DURATION * 1000));
  applyProgress(t * END, dt);
  composer.render();
  if (t < 1) raf = requestAnimationFrame(frame);
  else { stopped = true; onDone && onDone(); }
}
function begin() {
  applyProgress(0, 0); composer.render(); clock.getDelta();
  startT = performance.now();
  raf = requestAnimationFrame(frame);
}
manager.onLoad = () => { ready = true; if (wanted && !stopped) begin(); };
manager.onError = () => { if (!stopped) { stopped = true; onDone && onDone(); } };

export function start(cb) { onDone = cb; wanted = true; if (ready) begin(); }
export function stop() { stopped = true; cancelAnimationFrame(raf); }
export function dispose() {
  stop();
  try { renderer.dispose(); renderer.forceContextLoss(); } catch (e) {}
  renderer.domElement.remove();
}
