// 3D-Ansicht eines Geräts aus den offiziellen CAD-Daten (dieselben GLB wie der Werkzeugraum-Planer).
// Ein Renderer für die ganze Sitzung (iPad verkraftet nur wenige WebGL-Kontexte), Modelle bleiben im Speicher.
import * as THREE from 'three';
import { OrbitControls } from '../../planer/assets/vendor/OrbitControls.js';
import { GLTFLoader } from '../../planer/assets/vendor/GLTFLoader.js';
import { DRACOLoader } from '../../planer/assets/vendor/DRACOLoader.js';
import { RoomEnvironment } from '../../planer/assets/vendor/RoomEnvironment.js';
import { abs } from './media.js';

// Materialklassen der CAD-Modelle (wie cad/zoller_cad.py bzw. der Planer)
const CLS = {
  darkgrey: { color: '#35383b', roughness: .42, clearcoat: .15, clearcoatRoughness: .25 },
  whitealu: { color: '#a9acab', roughness: .34, metalness: .72, clearcoat: .35, clearcoatRoughness: .12 },
  yellow: { color: '#f0dc00', roughness: .3, clearcoat: .6, clearcoatRoughness: .06 },
  blackplastic: { color: '#141516', roughness: .45 }, pa6: { color: '#111317', roughness: .55 },
  anodized: { color: '#1e2124', roughness: .32, metalness: .85 }, steel: { color: '#b9bdc0', roughness: .3, metalness: 1 },
  whiteplastic: { color: '#e6e4dc', roughness: .35, clearcoat: .2 }, paper: { color: '#e0ded6', roughness: .6 },
  wood: { color: '#c8a679', roughness: .5 }, worktop: { color: '#232426', roughness: .55 }, bellows: { color: '#18191b', roughness: .78 },
  blackoxide: { color: '#2a2826', roughness: .35, metalness: .9 }, brass: { color: '#c9a14a', roughness: .25, metalness: 1 },
  glossblack: { color: '#0d0e10', roughness: .16, clearcoat: 1, clearcoatRoughness: .03 }, zinc: { color: '#9da6ab', roughness: .33, metalness: 1 },
  red: { color: '#c8140f', roughness: .3, clearcoat: .5 }, chrome: { color: '#9a9e9c', roughness: .12, metalness: .95 },
  teal: { color: '#1fa58a', roughness: .4 }, blue: { color: '#35383b', roughness: .42 },          // kein Blau bei ZOLLER
  brushed: { color: '#c3c6c7', roughness: .4, metalness: .6 },
  led: { color: '#3ccf6a', roughness: .3, emissive: '#22c55e', emissiveIntensity: 1.6 },
  anthracite: { color: '#4c4f53', roughness: .42, clearcoat: .1, clearcoatRoughness: .3 },
  lightgrey: { color: '#c9cccf', roughness: .38 }, green: { color: '#1f8a3c', roughness: .55 },
};

export class Viewer {
  constructor() {
    this.canvas = document.createElement('canvas');
    const r = this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
    r.setClearColor(0x000000, 0);
    const sc = this.scene = new THREE.Scene();
    const pm = new THREE.PMREMGenerator(r);
    sc.environment = pm.fromScene(new RoomEnvironment(), .04).texture;
    const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(3, 5, 4); sc.add(key);
    const rim = new THREE.DirectionalLight(0xfff6c0, .7); rim.position.set(-4, 3, -3); sc.add(rim);
    this.cam = new THREE.PerspectiveCamera(28, 1, .05, 100);
    const c = this.controls = new OrbitControls(this.cam, this.canvas);
    c.enableDamping = true; c.dampingFactor = .08; c.enablePan = false; c.rotateSpeed = .7; c.zoomSpeed = .9;
    c.autoRotate = true; c.autoRotateSpeed = .55;
    c.minPolarAngle = .25; c.maxPolarAngle = Math.PI / 2 - .04;
    c.addEventListener('start', () => { c.autoRotate = false; clearTimeout(this.resume); this.onTouch?.(); });
    c.addEventListener('end', () => { clearTimeout(this.resume); this.resume = setTimeout(() => { c.autoRotate = true; }, 9000); });
    // weicher Schatten + Bühne
    const g = document.createElement('canvas'); g.width = g.height = 256;
    const x = g.getContext('2d'); const grd = x.createRadialGradient(128, 128, 6, 128, 128, 128);
    grd.addColorStop(0, 'rgba(0,0,0,.62)'); grd.addColorStop(.55, 'rgba(0,0,0,.22)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = grd; x.fillRect(0, 0, 256, 256);
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(g), transparent: true, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2; this.shadow.position.y = .002; sc.add(this.shadow);
    const ring = new THREE.Mesh(new THREE.RingGeometry(1, 1.006, 128), new THREE.MeshBasicMaterial({ color: 0xf0e600, transparent: true, opacity: .4, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = .003; this.ring = ring; sc.add(ring);
    const draco = new DRACOLoader(); draco.setDecoderPath(abs('planer/assets/vendor/draco/'));
    this.gltf = new GLTFLoader(); this.gltf.setDRACOLoader(draco);
    this.tex = new THREE.TextureLoader();
    this.lib = {};
    for (const [k, v] of Object.entries(CLS)) {
      this.lib[k] = new THREE.MeshPhysicalMaterial({ ...v, color: new THREE.Color(v.color), side: THREE.DoubleSide });
      if (v.emissive) this.lib[k].emissive = new THREE.Color(v.emissive);
    }
    // Scheiben der Zellen und Schränke: durchsichtig, damit man hineinsieht
    this.lib.glass = new THREE.MeshPhysicalMaterial({ color: 0x2a2f33, roughness: .05, transparent: true, opacity: .35, depthWrite: false, side: THREE.DoubleSide });
    this.models = new Map();
    this.current = null;
    this.ro = new ResizeObserver(() => this.resize());
  }

  attach(el) {
    if (this.el === el) return;
    this.detach();
    this.el = el;
    el.prepend(this.canvas);
    this.ro.observe(el);
    this.resize();
    this.renderer.setAnimationLoop(() => { this.controls.update(); this.renderer.render(this.scene, this.cam); });
  }

  detach() {
    if (!this.el) return;
    this.renderer.setAnimationLoop(null);
    this.ro.disconnect();
    this.canvas.remove();
    this.el = null;
  }

  resize() {
    if (!this.el) return;
    const w = this.el.clientWidth, h = this.el.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.cam.aspect = w / h; this.cam.updateProjectionMatrix();
    if (this.fit) this.frame(false);
  }

  async load(v) {
    if (this.models.has(v.model)) return this.models.get(v.model);
    const p = (async () => {
      const g = await this.gltf.loadAsync(abs(v.model));
      const obj = g.scene;
      let scr = null;
      obj.traverse((o) => {
        if (!o.isMesh) return;
        const cls = (o.material.name || '').replace('zc_', '');
        if (cls === 'screen') {
          if (!scr) {
            scr = new THREE.MeshStandardMaterial({ color: 0x020203, emissive: 0xffffff, emissiveIntensity: 1.05, roughness: .08 });
            if (v.screen) this.tex.load(abs(v.screen), (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; scr.emissiveMap = t; scr.needsUpdate = true; });
          }
          o.material = scr;
        } else o.material = this.lib[cls] || this.lib.darkgrey;
      });
      const box = new THREE.Box3().setFromObject(obj);
      const c = box.getCenter(new THREE.Vector3());
      obj.position.x -= c.x; obj.position.z -= c.z; obj.position.y -= box.min.y;
      const wrap = new THREE.Group(); wrap.add(obj);
      wrap.userData.box = new THREE.Box3().setFromObject(wrap);
      return wrap;
    })();
    this.models.set(v.model, p);
    p.catch(() => this.models.delete(v.model));
    return p;
  }

  async show(v, { reset = true } = {}) {
    const token = this.token = Symbol('show');
    const obj = await this.load(v);
    if (token !== this.token) return false;
    if (this.current) this.scene.remove(this.current);
    this.current = obj;
    this.scene.add(obj);
    const box = obj.userData.box, size = box.getSize(new THREE.Vector3());
    const foot = Math.max(size.x, size.z);
    this.shadow.scale.set(size.x * 1.7 + .5, size.z * 1.9 + .5, 1);
    this.ring.scale.setScalar(foot * .6 + .12);
    this.fit = { size, foot };
    this.frame(reset);
    return true;
  }

  frame(reset) {
    const { size } = this.fit;
    const r = Math.max(size.x, size.y, size.z) * .62 + .15;
    const fov = THREE.MathUtils.degToRad(this.cam.fov);
    const fit = Math.max(r / Math.sin(fov / 2), r / Math.sin(Math.atan(Math.tan(fov / 2) * this.cam.aspect)));
    const d = fit * 1.02;
    this.controls.target.set(0, size.y * .46, 0);
    this.controls.minDistance = d * .35; this.controls.maxDistance = d * 1.7;
    if (reset) {
      const az = .62, el = .2;
      this.cam.position.set(Math.sin(az) * Math.cos(el) * d, size.y * .46 + Math.sin(el) * d, Math.cos(az) * Math.cos(el) * d);
      this.controls.autoRotate = true;
    }
    this.cam.near = d / 100; this.cam.far = d * 10; this.cam.updateProjectionMatrix();
    this.controls.update();
  }
}

/** AR Quick Look (iPhone/iPad): USDZ aus dem Offline-Speicher als Blob öffnen */
export function arSupported() {
  const a = document.createElement('a');
  return !!(a.relList && a.relList.supports && a.relList.supports('ar'));
}
export async function openAR(path) {
  const res = await fetch(abs(path));
  const blob = new Blob([await res.arrayBuffer()], { type: 'model/vnd.usdz+zip' });
  const a = document.createElement('a');
  a.rel = 'ar';
  a.href = URL.createObjectURL(blob) + '#allowsContentScaling=0';
  a.appendChild(document.createElement('img'));     // Quick Look verlangt ein Bild im Link
  document.body.appendChild(a);
  a.click();
  setTimeout(() => a.remove(), 1000);
}
