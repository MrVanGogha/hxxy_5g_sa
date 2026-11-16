
import * as THREE from 'three';
import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/* ===== data.js ===== */
// 场景数据：来自「5G 典型应用场景与网络需求特征对照表」
// bw 单位 Mbps；lat 单位 ms（null 表示时延不敏感）；covKm 为覆盖面积 km²（null 表示园区/区域级覆盖）
const S=[
 {id:'coal',zh:'智慧煤矿',en:'Smart Coal Mine',type:'URLLC',typeZh:'低时延型',cov:'覆盖 10 km²',covKm:10,bw:600,lat:30,latTxt:'<30 ms',r:60,note:'井下巷道与地面联动：无人矿卡、掘进机远程控制'},
 {id:'factory',zh:'智慧工厂',en:'Smart Factory',type:'URLLC',typeZh:'低时延型',cov:'园区级覆盖',covKm:null,bw:720,lat:20,latTxt:'<20 ms',r:56,note:'机器人、AGV 与产线视觉质检'},
 {id:'port',zh:'智慧港口',en:'Smart Port',type:'URLLC',typeZh:'低时延型',cov:'码头区域覆盖',covKm:null,bw:360,lat:10,latTxt:'<10 ms',r:76,note:'岸桥远程操控与集卡自动驾驶'},
 {id:'campus',zh:'智慧园区',en:'Smart Campus',type:'eMBB',typeZh:'大容量型',cov:'覆盖 1 km²',covKm:1,bw:480,lat:null,latTxt:'时延不敏感',r:58,note:'视频监控、人员车辆管理、物联感知'},
 {id:'grid',zh:'智慧电网',en:'Smart Grid',type:'URLLC',typeZh:'低时延型',cov:'50 km 带状覆盖',covKm:null,strip:true,bw:480,lat:15,latTxt:'<15 ms',r:78,note:'沿输电线路带状组网，无人机巡检与差动保护'},
 {id:'hospital',zh:'智慧医院',en:'Smart Hospital',type:'URLLC',typeZh:'低时延型',cov:'院区覆盖',covKm:null,bw:2500,lat:10,latTxt:'<10 ms',r:54,note:'远程会诊、移动查房、急救车实时传输'},
 {id:'airport',zh:'智慧机场',en:'Smart Airport',type:'eMBB',typeZh:'大容量型',cov:'覆盖 5 km²',covKm:5,bw:12800,lat:null,latTxt:'时延不敏感',r:66,note:'航站楼高密度接入、高清视频与行李追踪'},
 {id:'pit',zh:'智慧矿山',en:'Smart Open-pit Mine',type:'URLLC',typeZh:'低时延型',cov:'覆盖 15 km²',covKm:15,bw:516,lat:25,latTxt:'<25 ms',r:62,ph:1.12,note:'露天矿坑无人运输与电铲远程作业'}
];
const BWMAX=12800;
const ACC={URLLC:0x2ec4d6,eMBB:0xffa733};
const C={concrete:'#b7c1ca',dark:'#4a5560',glass:'#7fb3d5',red:'#c4503b',blue:'#3a7ca5',yellow:'#e0aa3e',green:'#5f9360',steel:'#8d9aa6',white:'#eef2f5',earth:'#6b5646',coal:'#23272b',water:'#2f6f9a'};
const V=function(x,y,z){return new THREE.Vector3(x,y,z)};
const rnd=function(i){var s=Math.sin(i*12.9898)*43758.5453;return s-Math.floor(s)};
const clamp=function(v,a,b){return Math.max(a,Math.min(b,v))};


/* ===== realism.js ===== */
// 写实渲染用到的工具：程序化贴图、桁架合并、集装箱材质、水面法线

/** sRGB 十六进制 -> 线性颜色（渲染器输出为 sRGB，材质颜色需要先转线性） */
const srgb = hex => new THREE.Color(hex).convertSRGBToLinear();

function makeTex(w, h, draw, opt) {
  opt = opt || {};
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (opt.data !== true) t.encoding = THREE.sRGBEncoding;
  if (opt.repeat) t.repeat.set(opt.repeat[0], opt.repeat[1]);
  return t;
}

function speckle(x, w, h, n, seed, a) {
  for (let i = 0; i < n; i++) {
    const v = rnd(i * 2.1 + seed) > .5 ? 255 : 0;
    x.fillStyle = 'rgba(' + v + ',' + v + ',' + v + ',' + (a * rnd(i + seed * 3)) + ')';
    x.fillRect(rnd(i * 3.7 + seed) * w, rnd(i * 5.3 + seed + 1) * h, 1 + rnd(i) * 2, 1 + rnd(i + 9) * 2);
  }
}

/** 混凝土码头面：板缝 + 色差 + 颗粒 */
function concreteTex(rx, ry) {
  return makeTex(512, 512, (x, w, h) => {
    x.fillStyle = '#a2a4a6'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) {
      x.fillStyle = 'rgba(' + (rnd(i) > .5 ? '255,255,255' : '0,0,0') + ',' + (.03 + rnd(i + 4) * .05) + ')';
      x.fillRect((i % 2) * 256, Math.floor(i / 2) * 256, 256, 256);
    }
    speckle(x, w, h, 5000, 3, .1);
    x.fillStyle = 'rgba(30,30,30,.45)';
    x.fillRect(0, 0, w, 3); x.fillRect(0, 0, 3, h); x.fillRect(255, 0, 2, h); x.fillRect(0, 255, w, 2);
  }, { repeat: [rx, ry] });
}

/** 沥青堆场 */
function asphaltTex(rx, ry) {
  return makeTex(512, 512, (x, w, h) => {
    x.fillStyle = '#44474b'; x.fillRect(0, 0, w, h);
    speckle(x, w, h, 9000, 7, .16);
    for (let k = 0; k < 14; k++) {
      x.strokeStyle = 'rgba(20,20,20,' + (.12 + rnd(k) * .12) + ')'; x.lineWidth = 1 + rnd(k + 2) * 2;
      x.beginPath(); x.moveTo(rnd(k * 3) * w, rnd(k * 5) * h); x.lineTo(rnd(k * 7) * w, rnd(k * 11) * h); x.stroke();
    }
  }, { repeat: [rx, ry] });
}

/** 船舶上层建筑的窗带 */
function windowTex() {
  return makeTex(256, 128, (x, w, h) => {
    x.fillStyle = '#eceeef'; x.fillRect(0, 0, w, h);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 12; c++) {
      x.fillStyle = '#26323f'; x.fillRect(8 + c * 20, 10 + r * 28, 13, 12);
      x.fillStyle = 'rgba(255,255,255,.25)'; x.fillRect(8 + c * 20, 10 + r * 28, 13, 3);
    }
  });
}

let CM = null;
/** 集装箱材质（单个箱子的 6 个面）。贴图是中性灰，颜色由实例色或材质色给出 */
function containerMats() {
  if (CM) return CM;
  const stripe = (x, w, h, a, b) => {
    for (let i = 0; i < w; i += 8) {
      const g = x.createLinearGradient(i, 0, i + 8, 0);
      g.addColorStop(0, a); g.addColorStop(.5, b); g.addColorStop(1, a);
      x.fillStyle = g; x.fillRect(i, 0, 8, h);
    }
  };
  const side = makeTex(512, 128, (x, w, h) => {
    x.fillStyle = '#ededed'; x.fillRect(0, 0, w, h);
    stripe(x, w, h, 'rgba(0,0,0,0)', 'rgba(0,0,0,.24)');
    for (let k = 0; k < 60; k++) {
      x.fillStyle = 'rgba(90,60,30,' + (.03 + rnd(k) * .08) + ')';
      x.fillRect(rnd(k * 3 + 1) * w, rnd(k * 5 + 2) * h * .25, 1 + rnd(k) * 3, h * (.3 + rnd(k * 7) * .6));
    }
    x.fillStyle = 'rgba(0,0,0,.4)'; x.fillRect(0, 0, w, 7); x.fillRect(0, h - 9, w, 9);
    x.fillStyle = 'rgba(0,0,0,.6)'; x.fillRect(0, 0, 12, h); x.fillRect(w - 12, 0, 12, h);
    speckle(x, w, h, 1500, 5, .08);
  });
  const bump = makeTex(512, 128, (x, w, h) => {
    x.fillStyle = '#808080'; x.fillRect(0, 0, w, h);
    stripe(x, w, h, '#b8b8b8', '#484848');
    x.fillStyle = '#d0d0d0'; x.fillRect(0, 0, w, 7); x.fillRect(0, h - 9, w, 9);
  }, { data: true });
  const end = makeTex(256, 256, (x, w, h) => {
    x.fillStyle = '#e6e6e6'; x.fillRect(0, 0, w, h);
    stripe(x, w, h, 'rgba(0,0,0,0)', 'rgba(0,0,0,.16)');
    x.fillStyle = 'rgba(0,0,0,.55)'; x.fillRect(0, 0, w, 10); x.fillRect(0, h - 10, w, 10); x.fillRect(0, 0, 10, h); x.fillRect(w - 10, 0, 10, h);
    x.fillRect(w / 2 - 1, 10, 2, h - 20);
    [.2, .38, .62, .8].forEach(p => { x.fillStyle = 'rgba(30,30,30,.7)'; x.fillRect(w * p - 2, 14, 4, h - 28); x.fillStyle = 'rgba(0,0,0,.8)'; x.fillRect(w * p - 6, h * .5 - 4, 12, 8) });
    speckle(x, w, h, 700, 8, .08);
  });
  const roof = makeTex(256, 128, (x, w, h) => {
    x.fillStyle = '#d2d2d2'; x.fillRect(0, 0, w, h);
    speckle(x, w, h, 900, 2, .12);
  });
  const mk = (map, bm, bs) => new THREE.MeshStandardMaterial({ map, bumpMap: bm || null, bumpScale: bs || 0, roughness: .55, metalness: .35 });
  const sideM = mk(side, bump, .8), endM = mk(end), roofM = mk(roof);
  const floorM = new THREE.MeshStandardMaterial({ color: srgb('#555'), roughness: .9 });
  CM = { mats: [endM, endM, roofM, floorM, sideM, sideM] };
  return CM;
}

/** 可单独着色的集装箱网格（用于吊具、卡车） */
function containerMesh(hex, rotY) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(3.05, .65, .61), containerMats().mats.map(x => {
    const c = x.clone(); c.color = srgb(hex); return c;
  }));
  m.castShadow = m.receiveShadow = true;
  if (rotY) m.rotation.y = rotY;
  return m;
}

/** 桁架：把很多细杆合并成一个网格，岸桥/RTG 才不会拖垮帧率 */
class Frame {
  constructor() { this.geos = []; }
  bar(a, b, t) {
    const d = new THREE.Vector3().subVectors(b, a), len = d.length();
    if (len < 1e-4) return this;
    const geo = new THREE.BoxGeometry(t, len, t);
    geo.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())));
    geo.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    this.geos.push(geo); return this;
  }
  box(w, h, d, x, y, z) {
    const geo = new THREE.BoxGeometry(w, h, d); geo.translate(x, y, z); this.geos.push(geo); return this;
  }
  mesh(mat) {
    const m = new THREE.Mesh(BufferGeometryUtils.mergeBufferGeometries(this.geos, false), mat);
    m.castShadow = m.receiveShadow = true; return m;
  }
}

/** 可平铺的水面法线贴图（多组正弦波叠加） */
function waterNormals() {
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N;
  const x = c.getContext('2d'), img = x.createImageData(N, N);
  const W = [[2, 1, .5, 0], [3, -2, .35, 1.3], [-4, 3, .25, 2.1], [5, 4, .12, .7]];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    let dx = 0, dy = 0;
    W.forEach(w => {
      const a = 2 * Math.PI * (w[0] * i / N + w[1] * j / N) + w[3];
      const k = Math.cos(a) * w[2] * 2 * Math.PI / N;
      dx += k * w[0]; dy += k * w[1];
    });
    let nx = -dx * 10, ny = -dy * 10, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    const p = (j * N + i) * 4;
    img.data[p] = (nx * .5 + .5) * 255; img.data[p + 1] = (ny * .5 + .5) * 255; img.data[p + 2] = (nz * .5 + .5) * 255; img.data[p + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

/** Reusable photoreal scene materials and geometry helpers for non-port industries. */
function industrialMats() {
  return {
    concrete: new THREE.MeshStandardMaterial({ map: concreteTex(2, 2), color: srgb('#aab0b4'), roughness: .92 }),
    asphalt: new THREE.MeshStandardMaterial({ map: asphaltTex(3, 3), color: srgb('#73777a'), roughness: .96 }),
    steel: new THREE.MeshStandardMaterial({ color: srgb('#89939b'), metalness: .72, roughness: .36 }),
    darkSteel: new THREE.MeshStandardMaterial({ color: srgb('#303941'), metalness: .68, roughness: .42 }),
    yellow: new THREE.MeshStandardMaterial({ color: srgb('#e2aa32'), metalness: .25, roughness: .48 }),
    white: new THREE.MeshStandardMaterial({ color: srgb('#e4e8e9'), roughness: .56 }),
    glass: new THREE.MeshPhysicalMaterial({ color: srgb('#65a9c7'), metalness: .18, roughness: .18, transparent: true, opacity: .48, transmission: .18 }),
    rubber: new THREE.MeshStandardMaterial({ color: srgb('#202326'), roughness: .96 }),
    vegetation: new THREE.MeshStandardMaterial({ color: srgb('#3e6847'), roughness: .92 }),
    red: new THREE.MeshStandardMaterial({ color: srgb('#b74735'), roughness: .58 }),
    blue: new THREE.MeshStandardMaterial({ color: srgb('#35647c'), roughness: .58 })
  };
}
function meshBox(g, w, h, d, x, y, z, mat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y + h / 2, z); m.castShadow = m.receiveShadow = true; g.add(m); return m;
}
function meshCyl(g, r1, r2, h, x, y, z, mat, n = 16) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, n), mat); m.position.set(x, y + h / 2, z); m.castShadow = m.receiveShadow = true; g.add(m); return m;
}
function meshSphere(g, r, x, y, z, mat, n = 12) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, n, Math.max(8, n - 2)), mat); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m;
}

/* 别名: scenes.js 中 meshBox as rb 等 */
var rb=meshBox, rc=meshCyl, rs=meshSphere;

/* ===== port.js ===== */
// 写实版智慧港口：1 个单位约等于 4 米。
// 40 英尺集装箱 3.05×0.65×0.61，岸桥高约 55 米，船长约 150 米。

const std = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: srgb(c), roughness: .6, metalness: .2 }, o || {}));
function put(g, geo, mat, x, y, z) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; g.add(m); return m;
}
const bx = (g, w, h, d, x, y, z, mat) => put(g, new THREE.BoxGeometry(w, h, d), mat, x, y + h / 2, z);
const cy = (g, rt, rb, h, x, y, z, mat, seg) => put(g, new THREE.CylinderGeometry(rt, rb, h, seg || 16), mat, x, y + h / 2, z);
const plane = (g, w, d, x, y, z, mat) => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.receiveShadow = true; g.add(m);
};
const BOX_COLORS = ['#7c858c', '#1f3f73', '#a8382d', '#c9732a', '#2f6b52', '#4b6f7a', '#5e3d2c', '#b3b7ba', '#c9a227'];
const pick = k => BOX_COLORS[Math.floor(rnd(k) * BOX_COLORS.length)];

function sPortReal(g) {
  const u = g.userData;
  const steel = std('#dfe3e6', { roughness: .5, metalness: .45 });
  const darkSteel = std('#394048', { roughness: .55, metalness: .55 });
  const yellow = std('#d8a42a', { roughness: .5, metalness: .4 });
  const rubber = std('#17181b', { roughness: .95, metalness: 0 });
  const wall = std('#7d838a', { roughness: .95, metalness: 0 });
  const glass = std('#1d2b38', { roughness: .15, metalness: .6 });

  /* ---- 码头与水体 ---- */
  bx(g, 46, 3, 23, 0, -3, -11.5, wall);
  { const bed = bx(g, 46, 1.9, 23, 0, -3, 11.5, std('#0d2a33', { roughness: 1, metalness: 0 })); bed.receiveShadow = false; bed.castShadow = false; }
  plane(g, 46, 11, 0, .012, -5.5, new THREE.MeshStandardMaterial({ map: concreteTex(6, 1.5), roughness: .92 }));
  plane(g, 46, 12, 0, .012, -17, new THREE.MeshStandardMaterial({ map: asphaltTex(6, 1.6), roughness: .95 }));
  const paint = c => new THREE.MeshStandardMaterial({ color: srgb(c), roughness: .8 });
  bx(g, 46, .012, .12, 0, .013, -.5, paint('#d8b020'));
  for (let i = 0; i < 18; i++) bx(g, 1.2, .012, .08, -21 + i * 2.5, .013, -5.3, paint('#e8e8e8'));
  for (let i = 0; i < 12; i++) cy(g, .08, .1, .22, -21 + i * 4, 0, -.32, rubber, 8);
  [-1.2, -8.7].forEach(z => bx(g, 46, .08, .18, 0, .01, z, darkSteel));
  for (let i = 0; i < 7; i++) bx(g, 1.2, .5, .2, -18 + i * 6, -1.3, .12, rubber);

  const wn = waterNormals(); wn.repeat.set(1.5, .75);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(46, 23), new THREE.MeshPhysicalMaterial({
    color: srgb('#10424f'), roughness: .12, metalness: .15, normalMap: wn, normalScale: new THREE.Vector2(.35, .35), clearcoat: 1, clearcoatRoughness: .08
  }));
  water.receiveShadow = true;
  water.rotation.x = -Math.PI / 2; water.position.set(0, -.8, 11.5); g.add(water);

  /* ---- 船体 ---- */
  const sh = new THREE.Shape();
  sh.moveTo(-16, -3); sh.lineTo(-16, 3); sh.quadraticCurveTo(-16, 4, -13, 4); sh.lineTo(8, 4);
  sh.quadraticCurveTo(18, 3.6, 22, 0); sh.quadraticCurveTo(18, -3.6, 8, -4); sh.lineTo(-13, -4); sh.quadraticCurveTo(-16, -4, -16, -3);
  const hg = new THREE.ExtrudeGeometry(sh, { depth: 2.4, bevelEnabled: false, curveSegments: 20 });
  hg.rotateX(Math.PI / 2);
  const deckY = -.1, SZ = 5.6;
  const hull = new THREE.Mesh(hg, [std('#5d6a62', { roughness: .8, metalness: .1 }), std('#1c2e4a', { roughness: .45, metalness: .35 })]);
  hull.position.set(0, deckY, SZ); hull.castShadow = hull.receiveShadow = true; g.add(hull);
  // 上层建筑
  const wt = windowTex(), house = new THREE.MeshStandardMaterial({ map: wt, roughness: .5, metalness: .1 });
  bx(g, 3.2, 2.7, 6.2, -12.4, deckY, SZ, house);
  bx(g, 3.4, .55, 7.4, -12.4, deckY + 2.7, SZ, std('#eceeef', { roughness: .5 }));
  bx(g, 2.6, .5, 6.8, -12.3, deckY + 3.25, SZ, glass);
  cy(g, .55, .6, 1.5, -14.3, deckY + 2.7, SZ, std('#b3342b', { roughness: .6 }), 20);
  cy(g, .56, .56, .35, -14.3, deckY + 4.2, SZ, std('#111', { roughness: .8 }), 20);
  cy(g, .05, .05, 2.2, -12.4, deckY + 3.75, SZ, darkSteel, 6);
  const radar = bx(g, 1.1, .08, .12, -12.4, deckY + 5.95, SZ, darkSteel); spinner(g, radar, 'y', 3);
  // 货物实例（船上 + 堆场）
  const items = [];
  const hw = x => x < 8 ? 3.6 : Math.max(0, 3.6 * (1 - Math.pow((x - 8) / 14, 2)));
  for (let b = 0; b < 8; b++) {
    const cx = -8.6 + b * 3.2, n = Math.floor(2 * hw(cx + 1.5) / .66);
    for (let j = 0; j < n; j++) {
      const tiers = 2 + Math.floor(rnd(b * 13 + j * 7) * 3) - (j < 1 || j > n - 2 ? 1 : 0);
      for (let t = 0; t < tiers; t++) items.push([cx, deckY + .325 + t * .65, SZ + (j - (n - 1) / 2) * .66, pick(b * 31 + j * 5 + t)]);
    }
  }
  [-13.5, 0, 13.5].forEach((bcx, bi) => {
    for (let bay = 0; bay < 3; bay++) for (let blk = 0; blk < 2; blk++) for (let r = 0; r < 5; r++) {
      const k = bi * 91 + bay * 17 + blk * 7 + r * 3, h = 1 + Math.floor(rnd(k) * 4);
      for (let t = 0; t < h; t++) items.push([bcx + (bay - 1) * 3.2, .325 + t * .65, (blk ? -18.8 : -13.2) - r * .72, pick(k + t)]);
    }
  });
  const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(3.05, .65, .61), containerMats().mats, items.length);
  const m4 = new THREE.Matrix4();
  items.forEach((it, i) => { m4.setPosition(it[0], it[1], it[2]); inst.setMatrixAt(i, m4); inst.setColorAt(i, srgb(it[3])); });
  inst.instanceMatrix.needsUpdate = true; inst.instanceColor.needsUpdate = true;
  inst.castShadow = inst.receiveShadow = true; g.add(inst);

  /* ---- 岸桥 ---- */
  const tw = tower(g, -20.5, -8, 12);
  const hoists = [];
  function qcrane(xc, ph) {
    const f = new Frame(), Y = 13.2, t = .26, gx = 2.4, zw = -1.2, zl = -8.7;
    [-gx, gx].forEach(sx => {
      const X = xc + sx;
      f.bar(V(X, .3, zw), V(X, Y, zw), t).bar(V(X, .3, zl), V(X, Y, zl), t);
      [.3, 5, 9, Y].forEach(y => f.bar(V(X, y, zw), V(X, y, zl), t * .75));
      f.bar(V(X, .3, zw), V(X, 5, zl), .12).bar(V(X, .3, zl), V(X, 5, zw), .12);
      f.bar(V(X, 5, zw), V(X, Y, zl), .12).bar(V(X, 5, zl), V(X, Y, zw), .12);
      f.box(.7, .35, .9, X, .15, zw).box(.7, .35, .9, X, .15, zl);
    });
    [zw, zl].forEach(z => {
      [.3, 5, 9, Y].forEach(y => f.bar(V(xc - gx, y, z), V(xc + gx, y, z), t * .75));
      f.bar(V(xc - gx, 5, z), V(xc + gx, Y, z), .1).bar(V(xc + gx, 5, z), V(xc - gx, Y, z), .1);
    });
    const z0 = -14, z1 = 11.5, n = 30, d = (z1 - z0) / n;
    [-.9, .9].forEach(sx => {
      const X = xc + sx;
      f.bar(V(X, Y, z0), V(X, Y, z1), .16).bar(V(X, Y + 1.1, z0), V(X, Y + 1.1, z1), .16);
      for (let i = 0; i < n; i++) {
        const za = z0 + i * d, zb = za + d;
        f.bar(V(X, i % 2 ? Y + 1.1 : Y, za), V(X, i % 2 ? Y : Y + 1.1, zb), .09);
        if (i % 2 === 0) f.bar(V(X, Y, za), V(X, Y + 1.1, za), .08);
      }
    });
    for (let i = 0; i <= n; i += 2) { const z = z0 + i * d; f.bar(V(xc - .9, Y, z), V(xc + .9, Y, z), .08); f.bar(V(xc - .9, Y + 1.1, z), V(xc + .9, Y + 1.1, z), .08) }
    const ap = V(xc, Y + 4.8, -3.5);
    [[-.9, -5.5], [.9, -5.5], [-.9, -2], [.9, -2]].forEach(p => f.bar(ap, V(xc + p[0], Y + 1.1, p[1]), .17));
    f.bar(ap, V(xc, Y + 1.1, z1), .07).bar(ap, V(xc, Y + 1.1, z0), .07);
    g.add(f.mesh(steel));
    bx(g, 2.8, 1.3, 4.2, xc, Y + 1.1, -9.5, std('#b9c6d1', { roughness: .5, metalness: .3 }));
    bx(g, 1.3, .3, .3, xc, Y + 1.25, z1, std('#c0392b', { roughness: .6 }));
    // 小车 + 吊具 + 集装箱
    const tr = new THREE.Group(); g.add(tr);
    put(tr, new THREE.BoxGeometry(1.7, .5, 1.8), darkSteel, 0, 0, 0);
    bx(tr, .8, .7, .9, 1.2, -.75, .3, glass);
    const cab = [];
    [[-.7, -.4], [.7, -.4], [-.7, .4], [.7, .4]].forEach(p => { const c = put(tr, new THREE.BoxGeometry(.04, 1, .04), darkSteel, p[0], -.5, p[1]); cab.push(c) });
    const sp = new THREE.Group(); tr.add(sp);
    put(sp, new THREE.BoxGeometry(3.0, .14, .65), darkSteel, 0, 0, 0);
    const cont = containerMesh(pick(ph * 5 + 2)); cont.position.y = -.4; sp.add(cont);
    hoists.push({ cab, sp, ph });
    mover(g, tr, V(xc, Y + 1.5, -3), V(xc, Y + 1.5, 10.5), .035, ph * .3);
    link(g, tr, tw);
  }
  qcrane(-6, 0); qcrane(9, 2.2);
  u.extra = (t, dt) => {
    wn.offset.x += dt * .012; wn.offset.y += dt * .007;
    hoists.forEach(h => {
      const len = 1.4 + (.5 + .5 * Math.sin(t * .4 + h.ph)) * 10.5;
      h.cab.forEach(c => { c.scale.y = len; c.position.y = -len / 2 });
      h.sp.position.y = -len;
    });
  };

  /* ---- 轮胎式龙门吊（RTG） ---- */
  const rtg = new THREE.Group(); g.add(rtg);
  const rf = new Frame(), RH = 4.7, za = -12.4, zb = -16.9;
  [-1.3, 1.3].forEach(sx => {
    [za, zb].forEach(z => { rf.bar(V(sx, .2, z), V(sx, RH, z), .2); rf.box(.35, .4, .5, sx, .2, z) });
    rf.bar(V(sx, RH, za), V(sx, RH, zb), .2);
    rf.bar(V(sx, .8, za), V(sx, .8, zb), .12);
  });
  [za, zb].forEach(z => rf.bar(V(-1.3, RH, z), V(1.3, RH, z), .2));
  rf.box(1.2, .6, 1.2, 0, RH + .35, (za + zb) / 2);
  rtg.add(rf.mesh(yellow));
  mover(g, rtg, V(-16, 0, 0), V(-11, 0, 0), .03, 0.4);
  link(g, V(-13.5, 5.2, -14.6), tw);

  /* ---- 灯塔 ---- */
  const lamp = new THREE.MeshStandardMaterial({ color: srgb('#fff6dc'), emissive: srgb('#fff0c0'), emissiveIntensity: 1.6 });
  [-18, 0, 18].forEach(x => {
    cy(g, .1, .18, 11, x, 0, -11.6, darkSteel, 8);
    bx(g, 2.4, .35, .35, x, 11, -11.6, darkSteel);
    for (let i = 0; i < 4; i++) bx(g, .45, .2, .12, x - .9 + i * .6, 10.7, -11.4, lamp);
  });

  /* ---- 集卡 ---- */
  function truck(hex) {
    const v = new THREE.Group(); g.add(v);
    put(v, new THREE.BoxGeometry(.62, .78, .9), std('#e4e7ea', { roughness: .45, metalness: .3 }), 0, .6, 1.9);
    put(v, new THREE.BoxGeometry(.56, .3, .03), glass, 0, .85, 2.36);
    put(v, new THREE.BoxGeometry(.5, .1, 3.5), darkSteel, 0, .3, -.1);
    [[1.7], [-1.1], [-1.5]].forEach(a => [-.3, .3].forEach(sx => {
      const w = put(v, new THREE.CylinderGeometry(.16, .16, .14, 12), rubber, sx, .16, a[0]); w.rotation.z = Math.PI / 2;
    }));
    const c = containerMesh(hex, Math.PI / 2); c.position.set(0, .66, -.3); v.add(c);
    return v;
  }
  [['#1f3f73', -5.0, 0], ['#a8382d', -6.2, .5], ['#c9732a', -3.9, 1.05]].forEach((c, i) => {
    const v = truck(c[0]);
    mover(g, v, V(-20, 0, c[1]), V(20, 0, c[1]), .035, c[2]);
    link(g, v, tw);
  });
  link(g, V(-12.4, deckY + 4, SZ), tw);
}

/* ===== helpers.js ===== */

// 共享上下文：边线材质、地块材质（主题切换时统一改色）
const ctx={edgeMat:null,plateMats:[]};

/* ---------- geometry helpers ---------- */
function M(c,o){o=o||{};return new THREE.MeshStandardMaterial(Object.assign({color:new THREE.Color(c).convertSRGBToLinear(),roughness:.85,metalness:.05,flatShading:true},o))}
function add(g,geo,c,x,y,z,o){
  o=o||{};var noEdge=o.noEdge;var mo={};for(var k in o){if(k!=='noEdge')mo[k]=o[k]}
  var m=new THREE.Mesh(geo,M(c,mo));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;g.add(m);
  if(!noEdge&&ctx.edgeMat)m.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo,30),ctx.edgeMat));
  return m;
}
function box(g,w,h,d,x,y,z,c,o){return add(g,new THREE.BoxGeometry(w,h,d),c,x,y+h/2,z,o)}
function cyl(g,rt,rb,h,x,y,z,c,o,seg){return add(g,new THREE.CylinderGeometry(rt,rb,h,seg||20),c,x,y+h/2,z,o)}
function cone(g,r,h,x,y,z,c,seg){return add(g,new THREE.ConeGeometry(r,h,seg||8),c,x,y+h/2,z)}
function grp(g,x,y,z){var n=new THREE.Group();n.position.set(x,y||0,z||0);g.add(n);return n}
function plate(g,top,hole){
  var pm=new THREE.MeshStandardMaterial({color:0xffffff,roughness:1,flatShading:true});ctx.plateMats.push(pm);
  var geo;
  if(hole){
    var sh=new THREE.Shape();sh.moveTo(-23,-23);sh.lineTo(23,-23);sh.lineTo(23,23);sh.lineTo(-23,23);sh.lineTo(-23,-23);
    var h=new THREE.Path();h.absarc(0,0,hole,0,Math.PI*2,true);sh.holes.push(h);
    geo=new THREE.ExtrudeGeometry(sh,{depth:6,bevelEnabled:false,curveSegments:40});geo.rotateX(-Math.PI/2);
    var m=new THREE.Mesh(geo,pm);m.position.y=top-6;m.receiveShadow=true;g.add(m);
    m.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo,40),ctx.edgeMat));
    var fl=new THREE.Mesh(new THREE.CylinderGeometry(hole,hole,1,40),pm);fl.position.y=top-6.5;g.add(fl);
    return;
  }
  geo=new THREE.BoxGeometry(46,1,46);
  var p=new THREE.Mesh(geo,pm);p.position.y=top-.5;p.receiveShadow=true;g.add(p);
  p.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo),ctx.edgeMat));
}
function tower(g,x,z,h,y0){
  h=h||12;y0=y0||0;var acc=g.userData.acc;
  var st={roughness:.4,metalness:.6,flatShading:false};
  add(g,new THREE.CylinderGeometry(.14,.3,h,14),'#dfe5ea',x,y0+h/2,z,Object.assign({noEdge:true},st));
  add(g,new THREE.BoxGeometry(1,.9,.7),'#8f9aa4',x+.9,y0+.45,z+.2,{noEdge:true,roughness:.5,metalness:.4});
  add(g,new THREE.CylinderGeometry(.5,.5,.08,18),'#aab4bd',x,y0+h-.1,z,Object.assign({noEdge:true},st));
  var ph=Math.min(1.5,h*.3);
  for(var k=0;k<3;k++){var a2=k*2.0944+.5;
    var p=add(g,new THREE.BoxGeometry(.36,ph,.1),'#f4f6f8',x+Math.sin(a2)*.62,y0+h-ph/2-.02,z+Math.cos(a2)*.62,Object.assign({noEdge:true},st));
    p.rotation.y=a2;p.rotateX(-.09)}
  var dish=add(g,new THREE.CylinderGeometry(.26,.26,.05,16),'#ffffff',x+Math.sin(.5+3.14)*.5,y0+h-ph-.9,z+Math.cos(.5+3.14)*.5,Object.assign({noEdge:true},st));
  dish.rotation.x=Math.PI/2;dish.rotation.z=.5;
  add(g,new THREE.SphereGeometry(Math.min(.26,h*.08),12,10),acc,x,y0+h+.25,z,{emissive:acc,emissiveIntensity:1.6,noEdge:true});
  var top=V(x,y0+h+.25,z);g.userData.towers.push({x:x,z:z,y:y0,top:top});return top;
}
function link(g,a,b){g.userData.links.push([a,b])}
function mover(g,m,a,b,s,ph){g.userData.movers.push({m:m,a:a,b:b,s:s,ph:ph||0})}
function pmover(g,m,f,s,ph){g.userData.movers.push({m:m,f:f,s:s,ph:ph||0})}
function spinner(g,m,axis,s){g.userData.spins.push({m:m,axis:axis,s:s})}
function vehicle(g,c,w,l,h){var v=new THREE.Group();g.add(v);box(v,w,h*.55,l,0,.25,0,c);box(v,w*.9,h*.45,l*.38,0,.25+h*.55,l*.2,C.dark);return v}
const ep=function(e){return e.position||e};

/* ===== scenes.js ===== */

const RM = industrialMats();
function ground(g, kind) {
  const tex = kind === 'asphalt' ? asphaltTex(3, 3) : null;
  const mat = kind === 'asphalt' ? new THREE.MeshStandardMaterial({ map: tex, color: srgb('#777b7d'), roughness: .96 }) : RM.concrete.clone();
  /* 各场景会在通用地面之上叠 0.01~0.02 间距的装饰地皮（沥青/碎石/广场），
     深度缓冲在远景距离上精度不足会导致两层逐像素互搏（地盘闪烁）。
     给通用地面加 polygonOffset 把它在深度上后移，让装饰层稳定胜出，根治 z-fighting。 */
  mat.polygonOffset = true; mat.polygonOffsetFactor = 2; mat.polygonOffsetUnits = 2;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(45,45),mat);m.rotation.x=-Math.PI/2;m.position.y=.03;m.receiveShadow=true;g.add(m);
  for(let x=-20;x<=20;x+=10) rb(g,.08,.03,42,x,.06,0,RM.steel);
  for(let z=-20;z<=20;z+=10) rb(g,42,.03,.08,0,.06,z,RM.steel);
}

/* ---------- scene builders (1/2) ---------- */
function sCoal(g){
  plate(g,-6);
  box(g,46,6,46,0,-6,0,C.earth,{transparent:true,opacity:.3});
  box(g,44,.8,44,0,-6,0,'#2a2e33',{noEdge:true});
  box(g,38,2.2,2.6,0,-5.2,-4,C.coal);
  box(g,2.6,2.2,26,10,-5.2,6,C.coal);
  cyl(g,1.1,1.1,6,-12,-6,-4,'#6a747d',{},14);
  var l1=box(g,.6,11,.6,-13.6,0,-4,C.yellow);l1.rotation.z=-.22;
  var l2=box(g,.6,11,.6,-10.4,0,-4,C.yellow);l2.rotation.z=.22;
  var wg=grp(g,-12,10.5,-4);var w=cyl(wg,1.5,1.5,.5,0,-.25,0,'#444c55',{},18);w.rotation.z=Math.PI/2;
  spinner(g,wg,'x',1.3);
  box(g,7,4,6,-12,0,8,C.steel);
  box(g,10,6,8,6,0,13,C.concrete);cyl(g,.8,.8,10,10,6,13,C.steel,{},10);
  cone(g,3.2,3,-3,0,14,C.coal,7);cone(g,2.4,2.4,0,0,16,C.coal,7);
  box(g,14,.5,1,-2,3,9,C.dark);
  var relay=tower(g,6,-2.9,2,-5.2);
  var main=tower(g,17,-12,13);
  var t1=vehicle(g,C.yellow,1.4,2.6,1.6);g.add(t1);mover(g,t1,V(-16,-4.8,-4),V(16,-4.8,-4),.05,0);
  var t2=vehicle(g,C.yellow,1.4,2.6,1.6);mover(g,t2,V(10,-4.8,-6),V(10,-4.8,18),.045,.9);
  var rh=box(g,1.8,1.4,3,-3,-5.2,-4,C.red);
  link(g,t1,relay);link(g,t2,relay);link(g,rh,relay);link(g,relay,main);link(g,V(-12,10.5,-4),main);link(g,V(6,6,13),main);
}
function sFactory(g){
  plate(g,0);
  box(g,32,.3,22,0,0,0,'#cdd5dc');
  var wm={transparent:true,opacity:.2};
  box(g,32,4,.3,0,.3,-11,C.glass,wm);box(g,32,4,.3,0,.3,11,C.glass,wm);box(g,.3,4,22,-16,.3,0,C.glass,wm);box(g,.3,4,22,16,.3,0,C.glass,wm);
  for(var k=-1;k<=1;k++)box(g,.4,.4,22,k*10,4.3,0,C.steel,{noEdge:true});
  [-5,2].forEach(function(z,ci){
    box(g,26,.8,1.6,0,.3,z,C.dark);
    for(var j=0;j<3;j++){var it=box(g,.9,.9,.9,0,0,0,C.yellow,{noEdge:true});mover(g,it,V(-12,1.6,z),V(12,1.6,z),.05,ci*.7+j*.66)}
  });
  var tw=tower(g,15,-16,13);
  function robot(x,z){
    var r=grp(g,x,.3,z);cyl(r,.7,.9,.6,0,0,0,C.dark,{},12);
    var arm=grp(r,0,.6,0);box(arm,.5,2.2,.5,0,0,0,C.red);
    var fore=grp(arm,0,2.2,0);fore.rotation.z=1;box(fore,.4,2,.4,0,0,0,C.red);
    spinner(g,arm,'y',.9);link(g,V(x,2.4,z),tw);
  }
  robot(-8,-8.5);robot(-1,-8.5);robot(5,5.5);robot(11,5.5);
  [-13.5,13.5].forEach(function(x,i){
    var a=grp(g,0,0,0);box(a,1.6,.5,2.2,0,0,0,C.blue);box(a,1,.7,1,0,.5,0,C.white);
    mover(g,a,V(x,.6,-9),V(x,.6,9),.07,i*.5);link(g,a,tw);
  });
  box(g,12,5,8,-10,0,-17,C.concrete);box(g,6,3,5,2,0,-17,C.steel);
  link(g,V(0,4.3,0),tw);
}
function sPort(g){
  plate(g,0);
  box(g,46,.25,22,0,0,12,C.water,{transparent:true,opacity:.85,noEdge:true});
  box(g,46,.8,24,0,0,-10,'#9aa4ad');
  var hull=box(g,28,2.4,6.5,3,.1,11,'#2b3a47');box(g,6,5,5,-8,2.5,11,C.white);
  var pal=[C.red,C.blue,C.yellow,C.green];
  for(var i=0;i<6;i++)for(var j=0;j<2;j++)box(g,3.6,1.5,2.4,-3+i*4.1,2.5,9.9+j*2.4,pal[(i+j)%4],{});
  for(var ix=0;ix<6;ix++)for(var iz=0;iz<3;iz++){var n=1+Math.floor(rnd(ix*7+iz*3)*3);for(var h=0;h<n;h++)box(g,3.6,1.5,2.2,-14+ix*5.2+(iz>1?2:0),.8+h*1.5,-19+iz*3.4,pal[(ix+iz+h)%4])}
  function crane(x,s){
    var legs=[[-1,0],[1,0],[-1,8],[1,8]];
    legs.forEach(function(p){box(g,.7,11*s,.7,x+p[0]*3.2,.8,-3+p[1],C.yellow)});
    box(g,.9,.9,22,x,11*s+.8,4,C.yellow);box(g,7,.7,.7,x,11*s+.8,-3,C.yellow,{noEdge:true});
    var tr=grp(g,0,0,0);box(tr,1.6,1,1.6,0,0,0,C.dark);box(tr,.15,5*s,.15,0,-5*s,0,C.steel,{noEdge:true});box(tr,2.6,.6,1.2,0,-5.4*s,0,C.red);
    mover(g,tr,V(x,11*s+1.4,-2),V(x,11*s+1.4,13),.06,x>0?.8:0);return tr;
  }
  var c1=crane(-6,1),c2=crane(10,.9);
  var tw=tower(g,-19,-3,13);
  [0,1,2].forEach(function(i){var t=vehicle(g,C.blue,1.3,2.8,1.4);mover(g,t,V(-18,.8,-5.5-(i%2)*1.6),V(18,.8,-5.5-(i%2)*1.6),.05,i*.6);link(g,t,tw)});
  link(g,c1,tw);link(g,c2,tw);link(g,V(-8,7,11),tw);
}
function sCampus(g){
  plate(g,0);
  box(g,46,.12,3,0,0,0,'#58626b',{noEdge:true});box(g,3,.12,46,0,0,0,'#58626b',{noEdge:true});
  var B=[[-12,-12,8,8,9,C.concrete],[-12,11,9,7,6,C.glass],[12,-12,7,9,12,C.steel],[13,11,8,8,7,C.concrete],[0,-15,6,6,5,C.white],[0,14,10,6,4,C.glass],[-17,0,5,8,5,C.steel]];
  var tops=[];
  B.forEach(function(b){box(g,b[2],b[4],b[3],b[0],0,b[1],b[5],b[5]===C.glass?{transparent:true,opacity:.7}:{});tops.push(V(b[0],b[4]+.3,b[1]))});
  for(var i=0;i<16;i++){var a=i<8?-20+i*5.4:-20+(i-8)*5.4;var z=i<8?-2.8:2.8;var xx=a,zz=z;if(i>=8){xx=z;zz=a}cyl(g,.15,.15,1.2,xx,0,zz,'#6b4f3a',{noEdge:true},6);cone(g,1,2.4,xx,1.2,zz,C.green,7)}
  var t1=tower(g,-4.5,-4.5,10),t2=tower(g,5,5,10);
  for(var c=0;c<4;c++){var v=vehicle(g,[C.red,C.blue,C.yellow,C.white][c],1.2,2.4,1.1);var horiz=c%2===0;
    mover(g,v,horiz?V(-21,.5,c<2?-.8:.8):V(c<2?-.8:.8,.5,-21),horiz?V(21,.5,c<2?-.8:.8):V(c<2?-.8:.8,.5,21),.04,c*.5);
    link(g,v,c%2?t1:t2)}
  tops.forEach(function(p,i){link(g,p,i%2?t1:t2)});
}
/* ---------- scene builders (2/2) ---------- */
function sGrid(g){
  plate(g,0);
  var xs=[-20,-10,0,10,20],wireMat=new THREE.LineBasicMaterial({color:0x8d9aa6});
  xs.forEach(function(x){
    [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(function(p){var l=cyl(g,.12,.5,12,x+p[0]*.7,0,p[1]*.7,C.steel,{noEdge:true},4)});
    box(g,.2,.2,1.5,x,5,0,C.steel,{noEdge:true});box(g,1.6,.2,.2,x,8,0,C.steel,{noEdge:true});
    box(g,.3,.3,8,x,11,0,C.steel,{noEdge:true});box(g,.3,.3,3,x,13.2,0,C.steel,{noEdge:true});
    cyl(g,.18,.18,1.1,x,13.2,0,'#e6ecf0',{noEdge:true},6);
  });
  [[-3.9,11],[3.9,11],[0,13.2]].forEach(function(w){
    for(var i=0;i<xs.length-1;i++){var pts=[];for(var u=0;u<=16;u++){var t=u/16;pts.push(V(xs[i]+(xs[i+1]-xs[i])*t,w[1]-.2-1.8*4*t*(1-t),w[0]))}
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),wireMat))}
  });
  box(g,8,.2,7,-18,0,-12,'#9aa4ad',{noEdge:true});
  for(var i=0;i<3;i++){box(g,1.8,2.4,1.8,-20+i*2.6,.2,-12,C.blue);cyl(g,.25,.25,1,-20+i*2.6,2.6,-12,C.white,{noEdge:true},8)}
  box(g,.2,3,.2,-14.4,0,-14.5,C.steel,{noEdge:true});box(g,.2,3,.2,-14.4,0,-9.5,C.steel,{noEdge:true});
  var tws=[tower(g,-14,9,11),tower(g,0,9,11),tower(g,14,9,11)];
  xs.forEach(function(x,i){link(g,V(x,13.8,0),tws[Math.min(2,Math.max(0,Math.round((x+14)/14)))]);});
  var dr=grp(g,0,0,0);box(dr,1.2,.3,1.2,0,0,0,C.red);box(dr,2.2,.08,.2,0,.3,0,C.dark,{noEdge:true});box(dr,.2,.08,2.2,0,.3,0,C.dark,{noEdge:true});
  mover(g,dr,V(-21,16,3),V(21,16,3),.035,0);link(g,dr,tws[1]);link(g,dr,tws[0]);
  link(g,V(-17,3,-12),tws[0]);
  var sm=new THREE.Mesh(new THREE.BoxGeometry(44,10,16),new THREE.MeshBasicMaterial({color:g.userData.acc,wireframe:true,transparent:true,opacity:.10}));sm.position.set(0,5,0);g.userData.cover=sm;g.add(sm);
}
function sHospital(g){
  plate(g,0);
  box(g,16,10,10,0,0,-5,'#e9eef2');box(g,8,6,8,-12,0,-3,'#dde5ea');box(g,8,6,8,12,0,-3,'#dde5ea');
  box(g,5,1.4,.2,0,5.4,.1,C.red,{noEdge:true});box(g,1.4,5,.2,0,3.6,.1,C.red,{noEdge:true});
  for(var r=0;r<2;r++)for(var c=-3;c<=3;c++){box(g,1.4,1.2,.15,c*2,2+r*3,.1,C.glass,{noEdge:true})}
  cyl(g,2.8,2.8,.25,12,6,-3,'#5c6770',{},20);box(g,.4,.05,2,11,6.3,-3,C.white,{noEdge:true});box(g,.4,.05,2,13,6.3,-3,C.white,{noEdge:true});box(g,2.4,.05,.4,12,6.3,-3,C.white,{noEdge:true});
  box(g,5,.12,30,0,0,15,'#58626b',{noEdge:true});
  for(var i=0;i<10;i++){var xx=i<5?-18+i*2.2:8+(i-5)*2.2;cyl(g,.15,.15,1.2,xx,0,12,'#6b4f3a',{noEdge:true},6);cone(g,1,2.4,xx,1.2,12,C.green,7)}
  var amb=vehicle(g,C.white,1.4,3,1.5);box(amb,1.5,.25,2.4,0,.7,0,C.red,{noEdge:true});mover(g,amb,V(0,.5,28),V(0,.5,4),.05,0);
  var t1=tower(g,-18,10,10),t2=tower(g,18,10,10);
  link(g,amb,t1);link(g,amb,t2);link(g,V(12,6.4,-3),t2);link(g,V(0,10.3,-5),t1);link(g,V(-12,6.3,-3),t1);link(g,V(0,3,-1),t2);link(g,V(12,3,-3),t2);link(g,V(-12,3,-1),t1);
}
function sAirport(g){
  plate(g,0);
  box(g,44,.1,6,0,0,16,'#3d444b',{noEdge:true});
  for(var i=0;i<9;i++)box(g,2,.02,.3,-19+i*4.8,.1,16,C.white,{noEdge:true});
  box(g,3,.1,14,-12,0,6,'#4a5158',{noEdge:true});box(g,34,.1,12,2,0,-5,'#545c63',{noEdge:true});
  box(g,28,5,8,0,0,-14,C.glass,{transparent:true,opacity:.55});box(g,30,.8,10,0,5,-14,'#dfe5ea');
  for(var j=0;j<4;j++)box(g,1.2,1.2,5,-9+j*6,2.2,-8.4,C.steel);
  function plane(x,z,rot,col){var p=grp(g,x,1.4,z);p.rotation.y=rot;var f=add(p,new THREE.CylinderGeometry(.9,.9,9,12),col,0,0,0);f.rotation.x=Math.PI/2;
    box(p,9,.2,2,0,0,.4,col);box(p,.2,2,1.5,0,.6,-4,col);box(p,3.4,.15,1,0,.8,-4.1,col);return p}
  plane(-6,-1,0,C.white);plane(10,-1,0,'#d9e2e8');
  var mv=plane(0,0,0,C.white);mover(g,mv,V(-19,1.4,16),V(19,1.4,16),.04,0);mv.rotation.y=0;
  cyl(g,.9,1.2,12,16,0,-4,C.concrete,{},12);cyl(g,2.4,1.7,2.4,16,12,-4,C.glass,{transparent:true,opacity:.7},12);
  var t1=tower(g,-17,-18,13),t2=tower(g,15,-19,13);
  for(var k=0;k<3;k++){var cart=vehicle(g,C.yellow,1,1.8,1);mover(g,cart,V(-12,.5,-2),V(12,.5,-2),.06,k*.5);link(g,cart,k%2?t1:t2)}
  link(g,mv,t1);link(g,mv,t2);link(g,V(16,13.5,-4),t2);link(g,V(0,5.5,-14),t1);link(g,V(-9,5,-14),t1);link(g,V(9,5,-14),t2);link(g,V(-6,2.4,-1),t1);link(g,V(10,2.4,-1),t2);
}
function sPit(g){
  plate(g,0,20);
  var prof=[[20,0],[17.5,-1.2],[15.5,-1.2],[13.5,-2.4],[11.5,-2.4],[9.5,-3.6],[7.5,-3.6],[5.5,-4.8],[0.01,-4.8]].map(function(p){return new THREE.Vector2(p[0],p[1])});
  var lm=new THREE.Mesh(new THREE.LatheGeometry(prof,48),new THREE.MeshStandardMaterial({color:'#8a6b52',flatShading:true,side:THREE.DoubleSide,roughness:1}));
  lm.receiveShadow=true;lm.castShadow=true;g.add(lm);
  function sp(u){var a=u*Math.PI*2*2.3,r=19-u*15;return V(Math.cos(a)*r,-u*4.2+.5,Math.sin(a)*r)}
  var t1=tower(g,-17,-17,13),t2=tower(g,17,17,13);
  for(var i=0;i<3;i++){var t=vehicle(g,C.yellow,2,4,2.2);pmover(g,t,sp,.025,i*.65);link(g,t,i%2?t1:t2)}
  var ex=grp(g,-2,-4.8,2);box(ex,2.4,1.2,3,0,0,0,C.yellow);box(ex,.5,.5,4,0,1.4,2,C.dark);spinner(g,ex,'y',.3);link(g,V(-2,-2.4,2),t1);
  box(g,3,1.6,2.2,3,-4.8,-3,C.red);link(g,V(3,-2.4,-3),t2);
  box(g,6,3,5,-19,0,14,C.steel);box(g,4,2,3,19,0,-14,C.concrete);
}
function realisticCoal(g){
  g.userData.noCoverage=true;g.userData.beamIntensity=.08;
  g.userData.saGridOpacity=.018;g.userData.saBoundaryOpacity=.55;g.userData.saWallOpacity=.035;
  const yardTex=concreteTex(1.3,1.3),yardMat=new THREE.MeshStandardMaterial({map:yardTex,color:srgb('#777a7a'),roughness:.94});
  const yard=new THREE.Mesh(new THREE.PlaneGeometry(46,46),yardMat);yard.rotation.x=-Math.PI/2;yard.position.y=.02;yard.receiveShadow=true;g.add(yard);
  const coal=new THREE.MeshStandardMaterial({color:srgb('#202326'),roughness:.98,flatShading:true});
  const safety=new THREE.MeshStandardMaterial({color:srgb('#e4b13b'),metalness:.2,roughness:.55});
  const dark=new THREE.MeshStandardMaterial({color:srgb('#090d10'),roughness:1});

  // A restrained cut slope forms a backdrop without obscuring the working yard.
  const rockTex=asphaltTex(1.2,1),rockMat=new THREE.MeshStandardMaterial({map:rockTex,color:srgb('#665747'),roughness:1,flatShading:true,side:THREE.DoubleSide});
  const ridgeX=[-22,-17,-12,-7,-2,4,10,16,22],ridgeH=[1,3.4,2.3,4.5,3.2,2.4,4.8,3.1,1.2],ridgeZ=-19;
  const rv=[],ri=[];
  ridgeX.forEach((x,i)=>{rv.push(x,.15,ridgeZ+5,x,ridgeH[i],ridgeZ,x,.15,ridgeZ-5)});
  for(let i=0;i<ridgeX.length-1;i++){let a=i*3,b=a+3;ri.push(a,a+1,b+1,a,b+1,b,a+1,a+2,b+1,a+2,b+2,b+1)}
  const rg=new THREE.BufferGeometry();rg.setAttribute('position',new THREE.Float32BufferAttribute(rv,3));rg.setIndex(ri);rg.computeVertexNormals();
  const ridge=new THREE.Mesh(rg,rockMat);ridge.castShadow=ridge.receiveShadow=true;g.add(ridge);
  // Dark arched adit portal with reinforced concrete collar and visible tunnel roof.
  const portal=new THREE.Mesh(new THREE.ShapeGeometry((()=>{const s=new THREE.Shape();s.moveTo(-3.3,0);s.lineTo(-3.3,3);s.quadraticCurveTo(-3.3,6.1,0,6.1);s.quadraticCurveTo(3.3,6.1,3.3,3);s.lineTo(3.3,0);s.lineTo(-3.3,0);return s})()),RM.concrete);
  portal.position.set(-1,0,12.6);portal.castShadow=true;g.add(portal);
  const mouth=new THREE.Mesh(new THREE.ShapeGeometry((()=>{const s=new THREE.Shape();s.moveTo(-2.55,0);s.lineTo(-2.55,2.7);s.quadraticCurveTo(-2.55,5,0,5);s.quadraticCurveTo(2.55,5,2.55,2.7);s.lineTo(2.55,0);s.lineTo(-2.55,0);return s})()),dark);
  mouth.position.set(-1,0,12.68);g.add(mouth);
  const archPts=[V(-3.8,.1,12.8),V(-3.8,3,12.8),V(-3.25,4.8,12.8),V(-1,5.6,12.8),V(1.25,4.8,12.8),V(1.8,3,12.8),V(1.8,.1,12.8)];
  const archCurve=new THREE.CatmullRomCurve3(archPts);const arch=new THREE.Mesh(new THREE.TubeGeometry(archCurve,32,.28,10,false),RM.steel);arch.castShadow=true;g.add(arch);
  // Dark opening and a few recessed support ribs suggest a tunnel continuing underground.
  const tunnelFace=new THREE.Mesh(new THREE.CircleGeometry(2.35,32),dark);tunnelFace.position.set(-1,2.45,12.72);g.add(tunnelFace);
  for(let z of [11.2,9.5,7.8]){const rib=new THREE.Mesh(new THREE.TorusGeometry(2.25,.075,6,32,Math.PI),RM.steel);rib.position.set(-1,2.05,z);g.add(rib)}
  for(let z of [11.2,9.5,7.8])for(let x of [-3.25,1.25])rb(g,.12,2.1,.12,x,0,z,RM.steel);
  // Twin mine rails, sleepers and a low profile underground shuttle.
  for(let z=-4;z<=12;z+=.9)rb(g,2.7,.12,.18,-1,.12,z,RM.darkSteel);
  for(let x of [-1.85,-.15])rb(g,.12,.16,17,x,.2,4,RM.steel);
  const shuttle=grp(g,-1,.28,0);rb(shuttle,1.55,.72,3.3,0,0,0,RM.yellow);rb(shuttle,1.48,.28,1.3,0,.72,-.45,RM.darkSteel);
  for(let x of [-.8,.8])for(let z of [-1,1])rc(shuttle,.3,.3,.22,x,0,z,RM.rubber,12);
  mover(g,shuttle,V(-1,.25,10),V(-1,.25,-3),.035,0);

  // Shaft headframe and winding gear at the surface.
  const frame=new Frame();
  for(let x of [-2.7,2.7])for(let z of [-2.2,2.2]){frame.bar(V(-12+x,.3,-6+z),V(-12+x*.68,12,-6+z*.68),.34);frame.bar(V(-12+x*.68,12,-6+z*.68),V(-12+x*.68,14,-6+z*.68),.34)}
  for(let y of [2,6,10,13.8]){frame.bar(V(-14.8,y,-8.2),V(-9.2,y,-8.2),.24);frame.bar(V(-14.8,y,-3.8),V(-9.2,y,-3.8),.24)}
  for(let z of [-8.2,-3.8]){frame.bar(V(-14.8,2,z),V(-9.2,13.8,z),.18);frame.bar(V(-9.2,2,z),V(-14.8,13.8,z),.18)}
  g.add(frame.mesh(RM.steel));rb(g,7,.45,5,-12,14,-6,RM.darkSteel);
  const pulley=rc(g,1.15,1.15,.65,-12,14.6,-6,RM.darkSteel,24);pulley.rotation.x=Math.PI/2;spinner(g,pulley,'z',.45);
  rb(g,7,.18,.24,-12,13.8,-8.25,RM.yellow);
  const cage=grp(g,-12,0,-6);rb(cage,1.25,2.2,1.2,0,1,0,RM.darkSteel);rb(cage,1.35,.14,1.3,0,2.15,0,RM.yellow);
  const cable=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,10,8),RM.steel);cable.position.set(-12,8.5,-6);g.add(cable);

  // Coal preparation building, silos, conveyor and stockpiles.
  rb(g,13,8,10,9,0,-13,RM.concrete);const roofL=rb(g,7,.32,10,6,8,-13,RM.darkSteel),roofR=rb(g,7,.32,10,12,8,-13,RM.darkSteel);roofL.rotation.z=-.13;roofR.rotation.z=.13;
  for(let x of [3,15])for(let z of [-17,-9])rb(g,.28,8,.28,x,0,z,RM.steel);
  rb(g,10,4,.16,9,2,-7.9,RM.glass);for(let x of [5,8,11,14])rb(g,.12,4,.2,x,2,-7.8,RM.steel);
  for(let x of [5,9,13]){rc(g,1.65,1.65,6,x,0,-19,RM.steel,20);rc(g,1.72,1.72,.22,x,6,-19,RM.darkSteel,20);rc(g,.3,.3,1.7,x,6.8,-19,RM.darkSteel,12)}
  for(let i=0;i<3;i++){const pile=new THREE.Mesh(new THREE.ConeGeometry(2.7-i*.3,1.8+i*.22,12),coal);pile.position.set(-17+i*3.1,1,-15.5);pile.rotation.z=.04*i;pile.castShadow=true;g.add(pile)}
  // Transfer belt on steel trestles from the adit to the wash plant.
  const beltA=V(2,.9,5),beltB=V(5,7,-9),beltLen=beltA.distanceTo(beltB),beltMid=beltA.clone().add(beltB).multiplyScalar(.5);
  const belt=new THREE.Mesh(new THREE.BoxGeometry(1.25,.16,beltLen),RM.rubber);belt.position.copy(beltMid);belt.quaternion.setFromUnitVectors(V(0,0,1),beltB.clone().sub(beltA).normalize());belt.castShadow=true;g.add(belt);
  for(let i=1;i<=4;i++){const t=i/5,p=beltA.clone().lerp(beltB,t);rc(g,.1,.1,p.y,p.x,p.y/2,p.z,RM.steel,8);rb(g,1.55,.12,.12,p.x,p.y,p.z,RM.steel)}

  // Mine haul road, scale haul truck and facility lighting.
  const roadMat=new THREE.MeshStandardMaterial({map:asphaltTex(1.5,4),roughness:.96});
  const road=rb(g,6,.08,30,18,.08,1,roadMat);road.rotation.y=-.32;
  const truck=grp(g,0,0,0);rb(truck,3.2,1.55,5,0,0,0,RM.yellow);rb(truck,2.8,1.2,2.6,0,1.55,-.8,RM.darkSteel);rb(truck,3.4,.22,3.9,0,1.2,1.1,RM.yellow);
  for(let x of [-1.6,1.6])for(let z of [-1.7,1.7])rc(truck,.66,.66,.42,x,0,z,RM.rubber,16);
  mover(g,truck,V(16,.12,12),V(19,.12,-10),.035,0);
  for(let x of [-20,20])for(let z of [-19,18]){rc(g,.12,.12,7,x,0,z,RM.darkSteel,10);const lamp=rs(g,.32,x,7.2,z,new THREE.MeshBasicMaterial({color:0xffd58a}),12)}

  const t1=tower(g,-20,-18,13),t2=tower(g,20,-17,13);
  link(g,shuttle,t1);link(g,truck,t2);link(g,cage,t1);link(g,V(9,8,-13),t2);link(g,V(-12,14,-6),t1);
}
function realisticFactory(g){
  g.userData.noCoverage=true;g.userData.beamIntensity=.14;
  g.userData.saGridOpacity=.025;g.userData.saBoundaryOpacity=.52;g.userData.saWallOpacity=.03;
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(43,43),new THREE.MeshStandardMaterial({map:concreteTex(2.4,2.4),color:srgb('#8d9294'),roughness:.9}));
  floor.rotation.x=-Math.PI/2;floor.position.y=.015;floor.receiveShadow=true;g.add(floor);
  const white=new THREE.MeshStandardMaterial({color:srgb('#e3e6e5'),roughness:.6,metalness:.12});
  const line=new THREE.MeshStandardMaterial({color:srgb('#e8c44d'),roughness:.72});
  const machine=new THREE.MeshStandardMaterial({color:srgb('#40505a'),metalness:.58,roughness:.38});
  const screen=new THREE.MeshStandardMaterial({color:srgb('#0a3444'),emissive:srgb('#1599bd'),emissiveIntensity:1.1,roughness:.28});
  const red=new THREE.MeshStandardMaterial({color:srgb('#b54d3a'),metalness:.35,roughness:.45});
  const roof=new THREE.MeshPhysicalMaterial({color:srgb('#53656d'),metalness:.38,roughness:.25,transparent:true,opacity:.2,side:THREE.DoubleSide});

  // Open-side industrial hall: roof, columns and glazing frame the production floor without hiding it.
  const hall=new Frame();
  for(let x=-18;x<=18;x+=6){hall.bar(V(x,0,-16),V(x,10,-16),.28);hall.bar(V(x,0,15),V(x,10,15),.28);hall.bar(V(x,10,-16),V(x,10,15),.24)}
  for(let x=-15;x<=15;x+=6){hall.bar(V(x,10,-16),V(x+3,12,-.5),.18);hall.bar(V(x+3,12,-.5),V(x,10,15),.18)}
  g.add(hall.mesh(RM.steel));
  rb(g,39,.12,8,-1,11.75,-8.25,roof);rb(g,39,.12,8,-1,11.75,7.25,roof);
  rb(g,39,.18,.6,-1,10.2,-16,RM.yellow);
  for(let x=-15;x<=15;x+=6){rb(g,.15,7,.12,x,2,-15.85,RM.steel);rb(g,5.7,5,.08,x,3,-15.9,RM.glass)}

  // Three production cells: guarded robot, powered conveyor and machine enclosure.
  const towers=[];
  function robotCell(x,z,phase){
    rb(g,8,.08,7,x,.08,z,RM.darkSteel);
    for(let px of [-3.75,3.75])for(let pz of [-3.25,3.25])rc(g,.1,.1,2.4,x+px,0,z+pz,RM.steel,8);
    rb(g,8,.12,.12,x,2.4,z-3.25,RM.steel);rb(g,8,.12,.12,x,2.4,z+3.25,RM.steel);
    const bot=grp(g,x,0,z);rc(bot,.86,.98,.45,0,0,0,RM.darkSteel,24);const shoulder=grp(bot,0,.55,0);
    const upper=rb(shoulder,.48,2.7,.48,0,0,0,RM.yellow);upper.rotation.z=.56;
    const elbow=grp(shoulder,1.18,2.1,0);const lower=rb(elbow,.38,2.35,.38,0,0,0,RM.yellow);lower.rotation.z=-.85;
    const wrist=grp(elbow,.9,1.7,0);rb(wrist,.18,.7,.5,0,0,0,RM.darkSteel);spinner(g,shoulder,'y',.32+phase*.04);spinner(g,elbow,'z',-.44);
    rb(g,1.9,1.8,2.4,x+2.4,0,z,white);rb(g,1.35,.7,.12,x+2.4,1.05,z+1.22,screen);
    link(g,V(x,3.4,z),towers[0]);
  }
  const t1=tower(g,-19,16,12),t2=tower(g,19,16,12);towers.push(t1,t2);
  robotCell(-10,-5,0);robotCell(0,-5,1);robotCell(10,-5,2);
  // Material line through the center with rollers and parts moving to quality inspection.
  rb(g,31,.5,2.2,0,.35,5,RM.darkSteel);
  for(let x=-14;x<=14;x+=1.4)rc(g,.22,.22,2,x,.85,5,RM.steel,12).rotation.x=Math.PI/2;
  for(let x of [-12,-5,2,9]){const part=rb(g,1.05,.45,1.15,x,1.1,5,red);mover(g,part,V(x,1.1,5),V(x+4.5,1.1,5),.06,x*.08)}
  // Vision inspection portal on the outgoing end.
  for(let x of [12.2,16.2])rb(g,.28,4.2,.28,x,1,5,RM.steel);
  rb(g,4.3,.3,.35,14.2,5.05,5,RM.steel);rb(g,.72,.48,.35,14.2,4.45,5,screen);
  for(let i=0;i<2;i++)rs(g,.18,14.2+(i?-.55:.55),4.35,5,new THREE.MeshBasicMaterial({color:0x5ff5ff}),10);
  link(g,V(14.2,5.2,5),t2);
  // AGV lane, loading rack and two independent guided vehicles.
  const lane=new THREE.Mesh(new THREE.PlaneGeometry(37,5),new THREE.MeshStandardMaterial({color:srgb('#394248'),roughness:.9}));lane.rotation.x=-Math.PI/2;lane.position.set(0,.03,12);g.add(lane);
  for(let x=-17;x<=17;x+=4)rb(g,2,.025,.12,x,.07,10.2,line);
  for(let z of [10.2,13.8])rb(g,35,.025,.12,0,.07,z,line);
  function agv(col,phase){const a=grp(g,0,.15,0);rb(a,2.1,.55,2.7,0,0,0,col);rb(a,1.45,.35,1.25,0,.55,.15,RM.darkSteel);for(let x of [-.75,.75])for(let z of [-.85,.85])rc(a,.24,.24,.18,x,0,z,RM.rubber,12);const signal=rs(a,.11,0,1.2,0,new THREE.MeshBasicMaterial({color:0x55f0bf}),8);mover(g,a,V(-15,.15,12),V(15,.15,12),.04,phase);link(g,a,phase? t2:t1);return a}
  agv(RM.yellow,0);agv(RM.blue,.5);
  for(let x of [-15,-12]){rb(g,.18,4,.18,x,0,17,RM.steel);for(let y of [1,2.2,3.4])rb(g,4.5,.1,.8,x+2,y,17,RM.steel)}
  // Digital production board and a small outside utility room ground the factory entrance.
  rb(g,5,3.4,.22,-14,3,-15.55,RM.darkSteel);rb(g,4.1,2.2,.08,-14,3.55,-15.68,screen);
  rb(g,6,3.2,4,15,0,-12,RM.concrete);rb(g,6.4,.18,4.4,15,3.2,-12,RM.darkSteel);
  link(g,V(-14,4.8,-15),t1);link(g,V(15,3.4,-12),t2);
}
function realisticCampus(g){ground(g,'asphalt');
  const buildings=[[-12,-11,9,8,8],[-12,10,10,7,6],[11,-11,8,9,11],[12,10,9,8,7],[0,14,12,6,4]];
  buildings.forEach((b,i)=>{rb(g,b[2],b[4],b[3],b[0],0,b[1],i%2?RM.white:RM.concrete);for(let y=2;y<b[4];y+=2)for(let x=-b[2]/2+1;x<b[2]/2;x+=2)rb(g,.9,1.1,.08,b[0]+x,y,b[1]-b[3]/2-.05,RM.glass);rb(g,b[2]+.6,.25,b[3]+.6,b[0],b[4],b[1],RM.darkSteel)});
  for(let i=0;i<20;i++){let x=-21+i*2.2;rc(g,.14,.14,1.3,x,0,19,RM.darkSteel,8);rs(g,1.2,x,2,19,RM.vegetation)}
  let t1=tower(g,-18,-17,12),t2=tower(g,18,-17,12);let car=grp(g,0,0,0);rb(car,1.7,.7,3.4,0,.3,0,RM.blue);[-1,1].forEach(x=>[-1,1].forEach(z=>rc(car,.32,.32,.25,x*.65,0,z*1.1,RM.rubber,12)));mover(g,car,V(-18,.2,0),V(18,.2,0),.035,0);link(g,car,t1);link(g,car,t2)
}
function realisticGrid(g){ground(g,'concrete');
  g.userData.beamIntensity=.12;g.userData.saGridOpacity=.018;g.userData.saBoundaryOpacity=.5;g.userData.saWallOpacity=.025;
  const land=new THREE.Mesh(new THREE.PlaneGeometry(46,46),new THREE.MeshStandardMaterial({map:asphaltTex(2,2),color:srgb('#59605a'),roughness:1}));land.rotation.x=-Math.PI/2;land.position.y=.02;land.receiveShadow=true;g.add(land);
  const lattice=new THREE.MeshStandardMaterial({color:srgb('#7f8b91'),metalness:.72,roughness:.37});
  const cableMat=new THREE.LineBasicMaterial({color:0x29333a,transparent:true,opacity:.92});
  const insulator=new THREE.MeshStandardMaterial({color:srgb('#b7d6da'),roughness:.32,metalness:.15});
  const safety=new THREE.MeshStandardMaterial({color:srgb('#e5bf42'),roughness:.62});
  const towerXs=[-18,-6,7,19];
  function pylon(x){
    const f=new Frame(), h=17, base=2.7;
    for(let z of [-base,base]){f.bar(V(x-base,0,z),V(x-.75,h,z*.24),.2);f.bar(V(x+base,0,z),V(x+.75,h,z*.24),.2);f.bar(V(x-base,0,z),V(x+.75,h,z*.24),.13);f.bar(V(x+base,0,z),V(x-.75,h,z*.24),.13)}
    for(let y of [3,7,11,14.5]){f.bar(V(x-2.2,y,-base*.72),V(x+2.2,y,-base*.72),.13);f.bar(V(x-2.2,y,base*.72),V(x+2.2,y,base*.72),.13)}
    f.bar(V(x-.75,h,-.65),V(x,h+3,0),.15);f.bar(V(x+.75,h,.65),V(x,h+3,0),.15);
    g.add(f.mesh(lattice));
    [[14.5,4.3],[11,5.4],[7,4.5]].forEach(a=>{for(let z of [-1,1]){rb(g,a[1],.14,.16,x,a[0],z*2.2,lattice);for(let sx of [-1,1]){rc(g,.15,.15,.7,x+sx*a[1]/2,a[0]-.68,z*2.2,insulator,10)}}});
  }
  towerXs.forEach(pylon);
  // Three circuits on each side, sagging naturally between every pair of pylons.
  for(let z of [-2.2,2.2])for(let y of [13.8,10.3,6.5])for(let i=0;i<towerXs.length-1;i++){
    const pts=[];for(let k=0;k<=24;k++){const t=k/24,x=towerXs[i]+(towerXs[i+1]-towerXs[i])*t;pts.push(V(x,y-2.25*4*t*(1-t),z))}g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),cableMat));
  }
  // Compact 110 kV substation at the left end of the corridor.
  const gravel=new THREE.Mesh(new THREE.PlaneGeometry(13,11),new THREE.MeshStandardMaterial({color:srgb('#a0a39f'),roughness:1}));gravel.rotation.x=-Math.PI/2;gravel.position.set(-14,.045,-12);g.add(gravel);
  for(let x=-19;x<=-9;x+=2.5)for(let z of [-15,-11,-7])rc(g,.09,.09,2.8,x,0,z,lattice,8);
  for(let z of [-15,-11,-7])rb(g,11,.12,.12,-14,2.8,z,lattice);
  for(let x of [-17,-12,-10]){rb(g,1.8,2.4,2.1,x,0,-11,RM.darkSteel);rb(g,1.1,.8,.14,x,1.1,-9.94,new THREE.MeshStandardMaterial({color:srgb('#153c4b'),emissive:srgb('#1aa6c6'),emissiveIntensity:.8}));for(let p of [-.55,.55])rc(g,.38,.38,.5,x+p,2.4,-11,insulator,12)}
  for(let x of [-19,-9])for(let z of [-16,-6])rb(g,.15,2.2,.15,x,0,z,lattice);
  for(let x=-19;x<=-9;x+=1.5){rb(g,1.4,.06,.06,x,.7,-16,safety);rb(g,1.4,.06,.06,x,.7,-6,safety)}
  // Protection cabinet and line terminal mark the differential-protection application.
  rb(g,2.4,2.6,1.4,14,0,-12,RM.concrete);rb(g,1.7,1.3,.1,14,1,-11.26,new THREE.MeshStandardMaterial({color:srgb('#113342'),emissive:srgb('#16a8c7'),emissiveIntensity:1}));
  for(let x of [12.7,15.3])rc(g,.12,.12,4,x,0,-8.5,lattice,10);
  // Inspection drone follows the transmission corridor, connected to two 5G sites.
  const drone=grp(g,0,0,0);rc(drone,.58,.58,.22,0,0,0,RM.darkSteel,16);for(let p of [[-1.35,-1.1],[1.35,-1.1],[-1.35,1.1],[1.35,1.1]]){rb(drone,1.35,.06,.08,p[0]/2,.15,p[1]/2,RM.steel);rc(drone,.42,.035,.08,p[0],.22,p[1],RM.darkSteel,14)}rs(drone,.12,0,.2,0,new THREE.MeshBasicMaterial({color:0x50f0bf}),8);
  mover(g,drone,V(-18,18,4),V(19,17,4),.025,0);
  const t1=tower(g,-21,17,12),t2=tower(g,21,17,12);link(g,drone,t1);link(g,drone,t2);link(g,V(-14,3,-12),t1);link(g,V(14,3,-12),t2);link(g,V(7,17,0),t2);
}
function realisticHospital(g){ground(g,'concrete');
  g.userData.noCoverage=true;g.userData.beamIntensity=.1;g.userData.saGridOpacity=.02;g.userData.saBoundaryOpacity=.48;g.userData.saWallOpacity=.025;
  /* 地面：广场砖 + 南侧沥青环路 + 斑马线 */
  const plaza=new THREE.Mesh(new THREE.PlaneGeometry(44,44),new THREE.MeshStandardMaterial({map:concreteTex(2.2,2.2),color:srgb('#a2a8a8'),roughness:.88}));plaza.rotation.x=-Math.PI/2;plaza.position.y=.02;plaza.receiveShadow=true;g.add(plaza);
  const road=new THREE.Mesh(new THREE.PlaneGeometry(44,7),new THREE.MeshStandardMaterial({map:asphaltTex(3,1),color:srgb('#454c50'),roughness:.95}));road.rotation.x=-Math.PI/2;road.position.set(0,.05,13);road.receiveShadow=true;g.add(road);
  for(let x=-21;x<=21;x+=3.4)rb(g,1.5,.02,.16,x,.08,13,RM.white);
  for(let x=1.4;x<=5;x+=1.2)rb(g,.55,.02,6.4,x,.085,13,RM.white);
  const facade=new THREE.MeshStandardMaterial({color:srgb('#e3e7e7'),roughness:.55,metalness:.06});
  const trim=new THREE.MeshStandardMaterial({color:srgb('#4b626c'),metalness:.55,roughness:.35});
  const curtain=new THREE.MeshStandardMaterial({map:windowTex(),color:srgb('#9fc3d4'),roughness:.3,metalness:.35});
  const windowMat=new THREE.MeshStandardMaterial({color:srgb('#327890'),emissive:srgb('#0c3142'),emissiveIntensity:.35,metalness:.3,roughness:.18});
  const red=new THREE.MeshStandardMaterial({color:srgb('#c93f3a'),roughness:.48});
  const redGlow=new THREE.MeshStandardMaterial({color:srgb('#c93f3a'),emissive:srgb('#a3261f'),emissiveIntensity:.7,roughness:.4});
  /* 住院主楼：裙楼 + 塔楼 + 玻璃幕墙明框分格 + 楼顶红十字灯箱与机房水箱 */
  rb(g,21,3,12,0,0,-9,facade);rb(g,21.6,.4,12.6,0,3,-9,trim);
  for(let x=-8.6;x<=8.6;x+=2.15)rb(g,1.35,1.5,.1,x,.9,-2.92,windowMat);
  rb(g,15,12.6,9,0,3.4,-11,facade);
  rb(g,15.6,.5,9.6,0,16,-11,trim);
  rb(g,14.6,12.2,.12,0,3.6,-6.42,curtain);
  for(let y=4.9;y<15.6;y+=2.35)rb(g,14.8,.1,.16,0,y,-6.4,trim);
  for(let x=-6.4;x<=6.4;x+=2.15)rb(g,.12,12.2,.16,x,3.7,-6.4,trim);
  rb(g,3.4,.5,.16,0,14.6,-6.32,redGlow);rb(g,.5,3.4,.16,0,13.15,-6.32,redGlow);
  rb(g,4,1.6,5,-4,16.5,-11,trim);rc(g,.8,.8,.7,3,16.5,-9,RM.steel,16);rc(g,.8,.8,.7,4.6,16.5,-12,RM.steel,16);
  /* 急诊楼（西）：红色标识带 + 白十字 + 急救车位雨棚 */
  rb(g,12,5.5,9,-14.5,0,-5.5,facade);rb(g,12.5,.4,9.5,-14.5,5.5,-5.5,trim);
  rb(g,12.6,1,.4,-14.5,3.9,-.82,red);
  rb(g,2.6,.42,.14,-14.5,4.15,-1.04,RM.white);rb(g,.42,2.6,.14,-14.5,3.06,-1.04,RM.white);
  for(let x=-18.6;x<=-10.4;x+=2.1)rb(g,1.3,1.2,.1,x,1.7,-.96,windowMat);
  rb(g,9,.35,4.6,-14.5,2.9,1.4,trim);rb(g,9,.16,4.6,-14.5,3.25,1.4,red);
  for(let x of [-18.4,-10.6])for(let z of [-.4,3.2])rc(g,.14,.14,2.9,x,0,z,trim,8);
  /* 门诊/会诊楼（东）：屋顶直升机坪 + 救援直升机（旋翼旋转） */
  rb(g,14,6,8.5,14,0,-8.5,facade);rb(g,14.5,.4,9,14,6,-8.5,trim);
  for(let x=8.8;x<=19.2;x+=2.1)for(let y of [1.6,3.9])rb(g,1.3,1.25,.1,x,y,-4.2,windowMat);
  const pad=new THREE.Mesh(new THREE.CylinderGeometry(3.9,3.9,.16,48),new THREE.MeshStandardMaterial({color:srgb('#3d4a50'),roughness:.75}));pad.position.set(14,6.42,-8.5);pad.receiveShadow=true;g.add(pad);
  const hr=new THREE.Mesh(new THREE.RingGeometry(2.1,2.5,40),RM.white);hr.rotation.x=-Math.PI/2;hr.position.set(14,6.53,-8.5);g.add(hr);
  rb(g,.6,.06,3,14,6.52,-8.5,RM.white);rb(g,3,.06,.6,14,6.52,-8.5,RM.white);
  for(let a=0;a<8;a++){const an=a*Math.PI/4;rc(g,.05,.05,.5,14+Math.cos(an)*3.7,6.5,-8.5+Math.sin(an)*3.7,RM.yellow,6)}
  const heli=grp(g,14,6.75,-8.5);
  rc(heli,.44,.44,2.6,0,.35,0,RM.white,16).rotation.x=Math.PI/2;
  rb(heli,.5,.5,2.2,0,.5,2.2,trim);rb(heli,1.1,.08,.5,0,.62,3.3,trim);
  const rotor=grp(heli,0,.95,0);rb(rotor,5.4,.06,.22,0,0,0,trim);rb(rotor,.22,.06,5.4,0,0,0,trim);spinner(g,rotor,'y',7);
  const trotor=grp(heli,0,.62,3.35);rb(trotor,.06,.9,.16,0,0,0,trim);spinner(g,trotor,'z',10);
  for(let sd of [-1,1]){rb(heli,.12,.1,2.2,sd*.55,0,0,trim);rb(heli,.08,.32,.08,sd*.55,.14,-.7,trim);rb(heli,.08,.32,.08,sd*.55,.14,.8,trim)}
  rs(heli,.3,0,.62,-1.05,windowMat,12);
  /* 门诊入口：玻璃门斗 + 大悬挑雨棚 */
  rb(g,8,2.9,3.4,0,0,-2.6,curtain);
  rb(g,11,.4,5.6,0,3.05,-1.6,trim);rb(g,11,.14,5.6,0,3.45,-1.6,RM.white);
  for(let x of [-4.6,4.6])for(let z of [-3.6,.6])rc(g,.16,.16,3.05,x,0,z,trim,10);
  /* 救护车：白车身红腰线 + 顶灯，两辆路上跑、两辆急救位待命 */
  function ambulance(){const a=grp(g,0,0,0);
    rb(a,2.1,1.5,4.4,0,.32,0,RM.white);rb(a,2.14,.3,4.42,0,1.06,0,red);
    rb(a,1.8,.62,1.1,0,1.5,-1.5,windowMat);
    rb(a,.5,.5,.08,0,1.15,2.22,redGlow);
    rb(a,.9,.16,.5,0,1.86,-.6,new THREE.MeshBasicMaterial({color:0x68d6ff}));
    for(let x of [-.85,.85])for(let z of [-1.45,1.45])rc(a,.34,.34,.26,x,0,z,RM.rubber,12);
    return a}
  const amb1=ambulance();mover(g,amb1,V(-20,.05,13),V(20,.05,13),.028,0);
  const amb2=ambulance();mover(g,amb2,V(20,.05,15.4),V(-20,.05,15.4),.028,.5);
  const amb3=ambulance();amb3.position.set(-14.5,.05,1.6);amb3.rotation.y=Math.PI/2;
  const amb4=ambulance();amb4.position.set(-11.6,.05,1.6);amb4.rotation.y=Math.PI/2;
  /* 停车场（东南）：划线车位 + 社会车辆 */
  for(let x of [8.6,11.2,13.8,16.4,19])rb(g,.14,.02,4.6,x,.06,19.4,RM.white);
  rb(g,10.4,.02,.14,13.8,.06,17.1,RM.white);rb(g,10.4,.02,.14,13.8,.06,21.7,RM.white);
  const carCols=['#5d7484','#8a4a3c','#4a5d50'];
  for(let i=0;i<3;i++){const v=vehicle(g,carCols[i],1.5,3.4,1.3);v.position.set(9.9+i*2.6,.08,19.4)}
  /* 绿化：西侧行道树 + 东侧点缀 + 入口花坛 */
  for(let x of [-17,-13.5,-10,-6.5]){rc(g,.13,.13,1.4,x,0,18,trim,8);rs(g,1.15,x,2,18,RM.vegetation,10)}
  for(let z of [-2,2,6]){rc(g,.13,.13,1.4,20.5,0,z,trim,8);rs(g,1.15,20.5,2,z,RM.vegetation,10)}
  for(let x of [-6.2,6.2]){rb(g,2.2,.5,1.1,x,0,3.4,trim);rs(g,.5,x-.5,.85,3.4,RM.vegetation,8);rs(g,.5,x+.5,.85,3.4,RM.vegetation,8)}
  /* 院区标识柱（红十字灯箱）+ 照明灯杆 */
  rc(g,.12,.12,3.4,6.5,0,8.6,trim,8);rb(g,1.5,1.5,.3,6.5,3.4,8.6,facade);
  rb(g,.9,.24,.34,6.5,4.03,8.6,redGlow);rb(g,.24,.9,.34,6.5,3.72,8.6,redGlow);
  for(let x of [-8,8]){rc(g,.07,.07,3.4,x,0,8,trim,8);rs(g,.16,x,3.5,8,new THREE.MeshBasicMaterial({color:0xfff2c8}),8)}
  /* 5G 基站与业务链路 */
  const t1=tower(g,-21,20,12),t2=tower(g,21,20,12);
  link(g,amb1,t1);link(g,amb2,t2);link(g,V(0,16.4,-11),t1);link(g,V(14,7.7,-8.5),t2);link(g,V(-14.5,3.3,1.4),t1);link(g,V(0,3.2,-1.6),t2);
}
function realisticAirport(g){ground(g,'asphalt');
  rb(g,44,.08,6,0,.08,16,RM.darkSteel);for(let x=-19;x<=19;x+=4.8)rb(g,2,.02,.2,x,.13,16,RM.white);
  rb(g,32,7,11,0,0,-13,RM.glass);rb(g,34,.7,12,0,7,-13,RM.white);for(let x=-14;x<=14;x+=4)rb(g,.12,6,11,x,.5,-13,RM.steel);
  function aircraft(x,z){let p=grp(g,x,1.5,z);let f=rc(p,.85,.85,8,0,0,0,RM.white,20);f.rotation.x=Math.PI/2;rb(p,13,.2,2,0,0,0,RM.white);rb(p,3,.15,1,0,.2,-3,RM.white);for(let xx of [-4,4]){let e=rc(p,.45,.4,1.4,xx,-.5,.4,RM.darkSteel,16);e.rotation.x=Math.PI/2}return p}
  aircraft(-7,-1);let moving=aircraft(0,0);mover(g,moving,V(-20,1.5,16),V(20,1.5,16),.035,0);
  for(let i=0;i<6;i++)rb(g,1.2,1.2,2,-12+i*4,.2,-5,RM.yellow);
  const t1=tower(g,-19,-18,13),t2=tower(g,19,-18,13);
  link(g,moving,t1);link(g,moving,t2);link(g,V(0,7,-13),t1);link(g,V(16,2,-5),t2);
}
function realisticPit(g){
  /* 露天矿：带孔地坪 + 车削四级台阶矿坑 + 螺旋运矿路 + 采矿装备 + 地表四大功能区 */
  const dirtMat=new THREE.MeshStandardMaterial({map:concreteTex(3,3),color:srgb('#8a7350'),roughness:1});
  const shp=new THREE.Shape();shp.moveTo(-22.5,-22.5);shp.lineTo(22.5,-22.5);shp.lineTo(22.5,22.5);shp.lineTo(-22.5,22.5);shp.lineTo(-22.5,-22.5);
  const hole=new THREE.Path();hole.absarc(0,0,20.2,0,Math.PI*2,true);shp.holes.push(hole);
  const dirt=new THREE.Mesh(new THREE.ShapeGeometry(shp,44),dirtMat);dirt.rotation.x=-Math.PI/2;dirt.position.y=.03;dirt.receiveShadow=true;g.add(dirt);
  /* 坑口安全挡墙 + 路肩亮边 */
  const berm=new THREE.Mesh(new THREE.CylinderGeometry(20.85,20.85,.55,64,1,true),new THREE.MeshStandardMaterial({color:srgb('#7d6a49'),roughness:1,side:THREE.DoubleSide}));berm.position.y=.28;g.add(berm);
  const crest=new THREE.Mesh(new THREE.RingGeometry(20.12,20.6,64),new THREE.MeshStandardMaterial({color:srgb('#b8a17c'),roughness:1}));crest.rotation.x=-Math.PI/2;crest.position.y=.045;g.add(crest);
  /* 坑体：4 级台阶（平台宽 3.2，边坡高 2.0），坑底深 8 */
  const prof=[[20.2,0],[18.5,0],[16.1,-3.4],[14.4,-3.4],[12.0,-6.8],[10.3,-6.8],[7.9,-10.2],[6.2,-10.2],[3.8,-13.6],[0.01,-13.6]].map(q=>new THREE.Vector2(q[0],q[1]));
  const rock=new THREE.Mesh(new THREE.LatheGeometry(prof,64),new THREE.MeshStandardMaterial({color:srgb('#a98d60'),flatShading:true,side:THREE.DoubleSide,roughness:1}));
  rock.receiveShadow=true;rock.castShadow=true;g.add(rock);
  /* 边坡岩层分带（略突出，模拟不同岩性） */
  const bands=[[18.5,16.1,-1.7,'#5d4730'],[14.4,12.0,-5.1,'#6d5437'],[10.3,7.9,-8.5,'#57432d'],[6.2,3.8,-11.9,'#4a3826']];
  for(const q of bands){const b=new THREE.Mesh(new THREE.CylinderGeometry(q[0]+.06,q[1]+.06,3.42,64,1,true),new THREE.MeshStandardMaterial({color:srgb(q[3]),flatShading:true,side:THREE.DoubleSide,roughness:1}));b.position.y=q[2];g.add(b)}
  /* 台阶平台碎石路 */
  const roadMat=new THREE.MeshStandardMaterial({color:srgb('#8f7853'),roughness:1});
  const benches=[[17.3,0],[13.2,-3.4],[9.1,-6.8],[5.0,-10.2]];
  for(const q of benches){const r=new THREE.Mesh(new THREE.RingGeometry(q[0]-.85,q[0]+.85,64),roadMat);r.rotation.x=-Math.PI/2;r.position.y=q[1]+.035;r.receiveShadow=true;g.add(r)}
  /* 台阶坡脚阴影线：强化高差与台阶层次 */
  const toeMat=new THREE.MeshStandardMaterial({color:srgb('#4c3a26'),roughness:1});
  for(const q of [[18.5,0],[14.4,-3.4],[10.3,-6.8],[6.2,-10.2]]){const r=new THREE.Mesh(new THREE.RingGeometry(q[0]-.34,q[0]+.06,64),toeMat);r.rotation.x=-Math.PI/2;r.position.y=q[1]+.05;g.add(r)}
  /* 矿脉出露：边坡上两段深色矿化带 */
  const oreMat=new THREE.MeshStandardMaterial({color:srgb('#3f362b'),flatShading:true,side:THREE.DoubleSide,roughness:1});
  const o1=new THREE.Mesh(new THREE.CylinderGeometry(14.36,11.96,3.44,20,1,true,.6,1.5),oreMat);o1.position.y=-5.1;g.add(o1);
  const o2=new THREE.Mesh(new THREE.CylinderGeometry(10.26,7.86,3.44,16,1,true,3.1,1.2),oreMat);o2.position.y=-8.5;g.add(o2);
  /* 螺旋运矿路：从坑口连续盘下到坑底（带状面片） */
  const SP={y0:0,y1:-13.6,r0:17.3,r1:3.6,th0:1.05,turns:3.4,width:1.9};
  function helix(u){const y=SP.y0+(SP.y1-SP.y0)*u,r=SP.r0+(SP.r1-SP.r0)*u,th=SP.th0+u*SP.turns*Math.PI*2;return {y:y,r:r,th:th,x:Math.cos(th)*r,z:Math.sin(th)*r}}
  (function spiral(){
    const N=170,pos=[],idx=[];
    for(let i=0;i<=N;i++){const h=helix(i/N),w=SP.width/2;
      pos.push(Math.cos(h.th)*(h.r-w+.3),h.y+.07,Math.sin(h.th)*(h.r-w+.3));
      pos.push(Math.cos(h.th)*(h.r+w+.3),h.y+.07,Math.sin(h.th)*(h.r+w+.3));
      if(i<N){const a=i*2;idx.push(a,a+1,a+2,a+1,a+3,a+2)}}
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setIndex(idx);geo.computeVertexNormals();
    const m=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:srgb('#7f6a47'),roughness:1,side:THREE.DoubleSide}));m.receiveShadow=true;g.add(m);
    /* 路肩挡土坎：沿外缘的小碎石带 */
    const ep=[],ei=[];
    for(let i=0;i<=N;i++){const h=helix(i/N),w=SP.width/2+0.35;
      ep.push(Math.cos(h.th)*(h.r+w+.3),h.y+.07,Math.sin(h.th)*(h.r+w+.3));
      ep.push(Math.cos(h.th)*(h.r+w+.3),h.y+.42,Math.sin(h.th)*(h.r+w+.3));
      if(i<N){const a=i*2;ei.push(a,a+1,a+2,a+1,a+3,a+2)}}
    const eg=new THREE.BufferGeometry();eg.setAttribute('position',new THREE.Float32BufferAttribute(ep,3));eg.setIndex(ei);eg.computeVertexNormals();
    g.add(new THREE.Mesh(eg,new THREE.MeshStandardMaterial({color:srgb('#6d5940'),roughness:1,side:THREE.DoubleSide})));
  })();
  /* 矿卡：大梁 + 敞口翻斗（含矿石）+ 驾驶室 + 六轮 */
  const oreLoad=new THREE.MeshStandardMaterial({color:srgb('#4a4034'),roughness:1,flatShading:true});
  function haulTruck(){const t=grp(g,0,0,0);t.scale.setScalar(.86);
    rb(t,2.1,.45,4.8,0,.55,0,RM.darkSteel);
    rb(t,2.45,.16,3.2,0,1.0,.6,RM.steel);
    rb(t,.16,1.05,3.2,-1.22,1.02,.6,RM.yellow);rb(t,.16,1.05,3.2,1.22,1.02,.6,RM.yellow);
    rb(t,2.45,1.05,.18,0,1.02,2.22,RM.yellow);
    rb(t,2.1,.42,2.9,0,1.18,.55,oreLoad);
    rb(t,2.1,1.0,1.5,0,1.0,-1.55,RM.yellow);
    rb(t,1.9,.55,.12,0,1.35,-2.3,new THREE.MeshStandardMaterial({color:srgb('#2b414c'),metalness:.35,roughness:.18}));
    rb(t,.9,.45,.4,0,2.0,-1.75,RM.darkSteel);
    for(const x of [-1.12,1.12]){rc(t,.58,.58,.42,x,0,-1.55,RM.rubber,14);rc(t,.58,.58,.42,x,0,.35,RM.rubber,14);rc(t,.58,.58,.42,x,0,1.6,RM.rubber,14)}
    return t}
  const t1=tower(g,20,20,13),t2=tower(g,-21,-20,13);
  /* 两辆无人矿卡沿螺旋运矿路一上一下 */
  const onSpiral=(off)=>{return u=>{const h=helix(Math.min(1,Math.max(0,(u+off)%1)));return V(h.x,h.y+.1,h.z)}};
  const tk1=haulTruck();pmover(g,tk1,onSpiral(0),.022,0);link(g,tk1,t1);
  const tk2=haulTruck();pmover(g,tk2,onSpiral(.42),.022,.5);link(g,tk2,t2);
  const tk3=haulTruck();pmover(g,tk3,onSpiral(.78),.02,.2);link(g,tk3,t1);
  /* 台阶细节：牙轮钻机、碎石堆、洒水降尘车 */
  const drill=grp(g,13.0,-3.4,-3.4);drill.rotation.y=.6;
  rb(drill,1.4,.5,1.6,0,0,0,RM.darkSteel);rb(drill,.34,.34,.9,0,.5,-.2,RM.white);
  const mast=rb(drill,.26,.26,3.4,0,1.2,-.5,RM.steel);mast.rotation.x=-.06;
  rb(drill,.7,.9,.7,0,.6,.5,RM.white);
  for(let i=0;i<3;i++)cone(g,.5,.55,12.4,-3.35,1.2+i*1.4,'#6b5a44',7);
  for(let i=0;i<3;i++)cone(g,.4,.45,8.9,-6.75,-3.6+i*1.2,'#6b5a44',7);
  /* 坑底：电铲（上车缓转）+ 待装矿卡 + 矿石堆 + 坑底积水 */
  const shovel=grp(g,-1.3,-13.6,.7);
  rb(shovel,.8,.6,3.0,-.9,0,0,RM.darkSteel);rb(shovel,.8,.6,3.0,.9,0,0,RM.darkSteel);
  rc(shovel,.95,.95,.45,0,.6,0,RM.yellow,16);
  const up=grp(shovel,0,1.05,0);
  rb(up,2.0,1.15,2.6,0,0,.35,RM.yellow);
  rb(up,1.8,.85,.7,0,.06,1.6,RM.darkSteel);
  rb(up,.85,.8,.95,-.75,.1,-1.0,RM.yellow);
  rb(up,.6,.55,.1,-.75,.35,-1.5,new THREE.MeshStandardMaterial({color:srgb('#2b414c'),metalness:.35,roughness:.18}));
  const boom=grp(up,0,.85,-1.0);boom.rotation.x=-.72;
  rb(boom,.32,.32,3.3,0,0,-1.6,RM.yellow);
  const stick=grp(boom,0,0,-3.2);stick.rotation.x=.62;
  rb(stick,.2,.2,1.9,0,0,-.95,RM.yellow);
  rb(stick,.95,.85,.95,0,-.35,-2.0,RM.darkSteel);
  spinner(g,up,'y',.16);link(g,V(-1.3,-12,.7),t2);
  const tk4=haulTruck();tk4.position.set(1.1,-13.6,1.5);tk4.rotation.y=1.9;
  cone(g,1.0,1.3,1.6,-13.6,-1.3,'#4a4034',8);
  cone(g,.7,1.0,2.9,-13.6,1.2,'#4a4034',8);
  const pond=new THREE.Mesh(new THREE.CircleGeometry(1.15,24),new THREE.MeshStandardMaterial({color:srgb('#3f6d78'),roughness:.12,metalness:.45}));pond.rotation.x=-Math.PI/2;pond.position.set(1.5,-13.54,2.6);g.add(pond);
  /* 地表环路 + 一辆重载矿卡运往破碎站 */
  const ring=new THREE.Mesh(new THREE.RingGeometry(21.05,22.35,72),new THREE.MeshStandardMaterial({color:srgb('#8a7554'),roughness:1}));ring.rotation.x=-Math.PI/2;ring.position.y=.055;ring.receiveShadow=true;g.add(ring);
  const tk5=haulTruck();pmover(g,tk5,u=>{const a=.35+u*Math.PI*2;return V(Math.cos(a)*21.7,.12,Math.sin(a)*21.7)},.03,.55);link(g,tk5,t2);
  /* 东北：边坡监测站（三脚架 + 雷达主机 + 平板天线 + 太阳能板 + 机柜） */
  const mon=grp(g,14.5,0,19);
  for(let i=0;i<3;i++){const a=i*2.09;const leg=rc(mon,.055,.055,2.5,Math.cos(a)*.6,.1,Math.sin(a)*.6,RM.steel,8);leg.rotation.z=Math.cos(a)*.26;leg.rotation.x=-Math.sin(a)*.26}
  rb(mon,.8,.55,.8,0,2.25,0,RM.white);
  const dish=rb(mon,1.0,.75,.1,0,2.6,-.55,RM.white);dish.rotation.x=-.4;
  const panel=rb(mon,1.1,.06,.75,1.0,1.15,.35,RM.blue);panel.rotation.z=.45;panel.rotation.y=.4;
  rb(mon,.55,.8,.45,-.75,0,.7,RM.darkSteel);link(g,V(14.5,3.3,19),t1);
  /* 东南：破碎站（受料斗 + 破碎厂房 + 立筒仓）+ 输送廊 + 堆料场 */
  const cr=grp(g,18,0,-18.5);
  rb(cr,4.2,2.8,4.2,0,0,0,RM.steel);rb(cr,4.5,.3,4.5,0,2.8,0,RM.darkSteel);
  const hop=rc(cr,.6,1.7,1.7,-1,2.95,0,RM.darkSteel,4);hop.rotation.y=Math.PI/4;
  rc(cr,1.3,1.3,5.8,2.9,0,1.3,RM.concrete,16);
  const conv=grp(g,19.2,0,-13.2);conv.rotation.x=.2;
  rb(conv,1.3,.26,7.6,0,2.3,0,RM.darkSteel);
  for(const z of [-2.8,0,2.8]){rc(conv,.08,.08,2.3+Math.abs(z)*.28,.5,0,z,RM.steel,8);rc(conv,.08,.08,2.3+Math.abs(z)*.28,-.5,0,z,RM.steel,8)}
  cone(g,2.3,2.7,21.4,0,-9.8,'#7a6549',10);
  cone(g,1.7,2.0,17.2,0,-20.2,'#4a4034',10);
  link(g,V(18,3.6,-18.5),t2);
  /* 西南：调度指挥中心（主楼 + 门厅 + 天线 + 屋顶机组 + 皮卡） */
  const dp=grp(g,-18,0,-18);
  rb(dp,6.6,3.4,5.0,0,0,0,RM.white);rb(dp,7.0,.3,5.4,0,3.4,0,RM.darkSteel);
  rb(dp,2.4,2.6,1.2,0,0,2.9,RM.white);rb(dp,2.6,.2,1.4,0,2.6,2.9,RM.darkSteel);
  for(let x=-2.5;x<=2.5;x+=1.7)rb(dp,1.0,1.1,.1,x,1.4,2.52,new THREE.MeshStandardMaterial({color:srgb('#2b414c'),metalness:.35,roughness:.2}));
  rc(dp,.09,.09,4.4,2.3,3.7,-1.3,RM.steel,8);rs(dp,.17,2.3,8.1,-1.3,new THREE.MeshBasicMaterial({color:0xff6b5e}),8);
  rb(dp,1.3,.6,1.3,-2.0,3.7,-1.1,RM.steel);rb(dp,1.3,.6,1.3,-.3,3.7,-1.5,RM.steel);
  const pk1=vehicle(g,'#6b7d86',1.6,3.3,1.5);pk1.position.set(-14.0,.08,-21.0);
  const pk2=vehicle(g,'#7d6a5c',1.6,3.3,1.5);pk2.position.set(-14.0,.08,-17.6);
  link(g,V(-18,4.4,-18),t2);
  /* 西北：维修车间（开敞库 + 待修矿卡 + 轮胎垛 + 油罐） */
  const ws=grp(g,-18.5,0,17);
  rb(ws,6.2,3.2,4.8,0,0,0,RM.steel);rb(ws,6.6,.3,5.2,0,3.2,0,RM.darkSteel);
  rb(ws,4.8,2.4,.2,0,0,-2.42,RM.darkSteel);
  const tk6=haulTruck();tk6.position.set(-15.8,.1,13.0);tk6.rotation.y=-.75;
  for(const q of [[-21.6,19.8],[-20.3,19.8]]){rc(g,.64,.64,.5,q[0],.05,q[1],RM.rubber,12);rc(g,.64,.64,.5,q[0],.55,q[1],RM.rubber,12);rc(g,.64,.64,.5,q[0],1.05,q[1],RM.rubber,12)}
  rc(g,1.1,1.1,2.4,-21.6,0,10.5,RM.white,14);
  /* 照明灯塔 */
  for(const q of [[21.5,8],[-8,21.9],[-21.9,-6]]){rc(g,.1,.14,7.2,q[0],0,q[1],RM.steel,8);rb(g,.9,.2,.5,q[0],7.2,q[1],RM.darkSteel);rs(g,.18,q[0],7.3,q[1],new THREE.MeshBasicMaterial({color:0xfff2c8}),8)}
}
const BUILD={coal:realisticCoal,factory:realisticFactory,port:sPortReal,campus:realisticCampus,grid:realisticGrid,hospital:realisticHospital,airport:realisticAirport,pit:realisticPit};

/* ===== sa.js ===== */
// 5G SA 专网叠加层：本地 UPF/MEC 机房、5GC 控制面、N3 回传光纤、专网边界、应用热点、架构示意图
// 以下方案内容均为典型部署的示意，不是具体项目的设计参数。

const GREEN = 0x41f0a0, VIOLET = 0xa78bfa, CYAN = 0x39e6ff;

/* pos: 本地 UPF/MEC 机房在地块上的位置；apps.p: 应用热点在场景里的位置 */
const SA = {
  coal: { pos: [19, 0, 19], term: '矿卡 · 掘进机', biz: '集控平台',
    apps: [
      { n: '无人矿卡', d: '井下运输车辆无人驾驶，调度指令本地下发', p: [0, -2, -4] },
      { n: '提升机远控', d: '井口提升机视频与控制信号回传集控中心', p: [-12, 13.5, -4] },
      { n: '巷道高清巡检', d: '巡检机器人的高清视频在矿区内处理', p: [10, -3, 12] }] },
  factory: { pos: [19, 0, 19], term: '机器人 · AGV', biz: 'MES / 视觉平台',
    apps: [
      { n: '机械臂协同', d: '多台机械臂通过 5G 同步动作，取代有线控制', p: [-8, 4.5, -8.5] },
      { n: 'AGV 调度', d: 'AGV 路径与避让由边缘服务器实时计算', p: [13.5, 2.5, 0] },
      { n: '视觉质检', d: '产线图像送到本地 MEC 推理，缺陷结果随即回传', p: [0, 3, -5] }] },
  port: { pos: [20, 0, -8], term: '岸桥 · 集卡', biz: '码头操作系统 TOS',
    apps: [
      { n: '岸桥远程操控', d: '司机在中控室通过多路高清视频操作岸桥', p: [-6, 19, 6] },
      { n: '集卡自动驾驶', d: '车辆定位与调度指令经本地 UPF 往返', p: [0, 3.5, -5.5] },
      { n: '龙门吊远控', d: '堆场龙门吊的视频与控制信号上传到控制室', p: [-13.5, 7, -14.6] }] },
  campus: { pos: [20, 0, 19], term: '摄像头 · 传感器', biz: '园区管理平台',
    apps: [
      { n: '视频监控', d: '大量摄像头视频在园区内汇聚和分析', p: [-12, 10.5, -12] },
      { n: '无人巡逻车', d: '巡逻车的视频与定位回传，指令本地下发', p: [0, 2.5, 0] },
      { n: '物联感知', d: '环境、能耗等传感器经 5G 接入', p: [12, 13, -12] }] },
  grid: { pos: [19, 0, -14], term: '巡检无人机 · 保护终端', biz: '电网调度系统',
    apps: [
      { n: '无人机巡检', d: '沿线路飞行并回传高清视频', p: [0, 17, 3] },
      { n: '差动保护', d: '线路两端保护装置通过 5G 交换数据，要求时延低', p: [0, 14.5, 0] },
      { n: '变电站监控', d: '站内视频和设备状态接入监控平台', p: [-18, 4.5, -12] }] },
  hospital: { pos: [-19, 0, -18], term: '急救车 · 查房终端', biz: 'HIS / PACS',
    apps: [
      { n: '5G 急救车', d: '患者生命体征和影像在转运途中传回院内', p: [0, 3.5, 12] },
      { n: '远程会诊', d: '高清影像和视频在院区内传输，不经过公网', p: [0, 11, -5] },
      { n: '移动查房', d: '医护手持终端访问院内系统', p: [-12, 7.5, -3] }] },
  airport: { pos: [21, 0, 2], term: '行李车 · 摄像头', biz: '机场运行系统 AOCC',
    apps: [
      { n: '行李追踪', d: '行李车与分拣设备定位数据实时回传', p: [0, 3.5, -2] },
      { n: '航站楼高清视频', d: '大量摄像头视频并发上传和分析', p: [0, 7, -14] },
      { n: '机坪特种车辆', d: '牵引车与摆渡车的调度与定位', p: [0, 2.5, 16] }] },
  pit: { pos: [19, 0, 14], term: '矿卡 · 电铲', biz: '矿山调度系统',
    apps: [
      { n: '无人矿卡', d: '坑内车辆自动驾驶，调度在矿区本地完成', p: [5, -1, 5] },
      { n: '电铲远控', d: '操作员在远处通过视频控制电铲', p: [-2, -2, 2] },
      { n: '边坡监测', d: '边坡雷达与视频持续上传', p: [14.5, 5.5, 19] }] }
};

const bas = (c, o) => new THREE.MeshBasicMaterial(Object.assign({ color: c, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }, o || {}));

function dashed(pts, color, dash, gap, opacity) {
  const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color, dashSize: dash, gapSize: gap, transparent: true, opacity }));
  l.computeLineDistances(); return l;
}

function buildSA(g, id) {
  const cfg = SA[id], u = g.userData, grp = new THREE.Group(); g.add(grp);
  const [px, , pz] = cfg.pos;

  /* 本地 UPF / MEC 机房 */
  const body = new THREE.MeshStandardMaterial({ color: 0x1b2631, roughness: .4, metalness: .7 });
  const glow = new THREE.MeshStandardMaterial({ color: 0x0a2a33, emissive: CYAN, emissiveIntensity: 1.4 });
  const room = new THREE.Group(); room.position.set(px, 0, pz); grp.add(room);
  const mk = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; room.add(m); return m; };
  mk(new THREE.BoxGeometry(3.6, 1.9, 2.4), body, 0, .95, 0);
  mk(new THREE.BoxGeometry(3.7, .12, 2.5), new THREE.MeshStandardMaterial({ color: 0x3a4652, roughness: .5, metalness: .6 }), 0, 1.96, 0);
  for (let i = 0; i < 6; i++) mk(new THREE.BoxGeometry(.32, 1.2, .04), glow, -1.35 + i * .54, 1, 1.21);
  [-1, 0, 1].forEach(k => mk(new THREE.CylinderGeometry(.28, .28, .16, 14), new THREE.MeshStandardMaterial({ color: 0x59636e, roughness: .4, metalness: .7 }), k * 1.0, 2.1, -.3));
  const sig = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, 1, 6), bas(CYAN, { opacity: .5 })); sig.position.set(0, 2.5, 0); room.add(sig);
  room.userData.top = V(px, 2.2, pz);

  /* 5GC 控制面 */
  const core = new THREE.Group(); core.position.set(px, 19, pz); grp.add(core);
  const wire = new THREE.Mesh(new THREE.IcosahedronGeometry(1.9, 1), bas(CYAN, { wireframe: true, opacity: .75 }));
  const inner = new THREE.Mesh(new THREE.OctahedronGeometry(.8, 0), bas(VIOLET, { opacity: .9 }));
  core.add(wire, inner);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.7, .035, 6, 56), bas(VIOLET, { opacity: .8 })); ring.rotation.x = Math.PI / 2; core.add(ring);
  grp.add(dashed([V(px, 2.3, pz), V(px, 17, pz)], VIOLET, .5, .35, .85));

  /* N2 信令：基站到核心网 */
  u.towers.forEach(t => grp.add(dashed([t.top, V(px, 19, pz)], VIOLET, .6, .5, .22)));

  /* N3 回传：基站到本地 UPF，沿地面走线 */
  const fibers = u.towers.map(t => {
    const a = V(t.x, .35, t.z), b = V(px, .35, pz);
    const mid = V(b.x, .35, a.z);                      // 走直角，避免斜穿场景
    const pts = [a, mid, b];
    grp.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: GREEN, transparent: true, opacity: .9 })));
    const l1 = a.distanceTo(mid), l2 = mid.distanceTo(b);
    return { a, mid, b, l1, l2, L: l1 + l2 };
  });
  const NP = fibers.length * 5, arr = new Float32Array(NP * 3);
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  const pts = new THREE.Points(pg, new THREE.PointsMaterial({ color: GREEN, size: .9, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  pts.frustumCulled = false; grp.add(pts);

  /* 专网边界：虚线框 + 半透明围栏 */
  const E = 22.4, rect = [V(-E, .2, -E), V(E, .2, -E), V(E, .2, E), V(-E, .2, E), V(-E, .2, -E)];
  grp.add(dashed(rect, GREEN, 1.2, .7, u.saBoundaryOpacity == null ? .95 : u.saBoundaryOpacity));
  const wallMat = bas(GREEN, { opacity: u.saWallOpacity == null ? .07 : u.saWallOpacity, side: THREE.DoubleSide });
  [[0, -E, 0], [0, E, 0], [-E, 0, Math.PI / 2], [E, 0, Math.PI / 2]].forEach(w => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2 * E, 1.6), wallMat);
    m.position.set(w[0] === 0 ? 0 : w[0], .8, w[0] === 0 ? w[1] : 0); m.rotation.y = w[2]; grp.add(m);
  });
  const grid = new THREE.GridHelper(2 * E, 22, GREEN, GREEN); grid.position.y = .06; grid.material.transparent = true; grid.material.opacity = u.saGridOpacity == null ? .1 : u.saGridOpacity; grid.material.depthWrite = false; grp.add(grid);

  u.sa = {
    group: grp, room, coreTop: V(px, 21.6, pz), roomTop: V(px, 2.6, pz),
    tick(t) {
      wire.rotation.y = t * .5; wire.rotation.x = t * .2; inner.rotation.y = -t * .9; ring.rotation.z = t * .6;
      glow.emissiveIntensity = 1.1 + .5 * Math.sin(t * 3);
      let k = 0;
      fibers.forEach((f, fi) => {
        for (let j = 0; j < 5; j++) {
          const s = ((t * .09 + j / 5 + fi * .17) % 1) * f.L;
          const p = s < f.l1 ? f.a.clone().lerp(f.mid, s / f.l1) : f.mid.clone().lerp(f.b, (s - f.l1) / f.l2);
          arr[k++] = p.x; arr[k++] = p.y + .12; arr[k++] = p.z;
        }
      });
      pg.attributes.position.needsUpdate = true;
    }
  };
}

/* ---------- 右侧面板：SA 专网方案 + 架构示意图 ---------- */
function saPanel(s) {
  const c = SA[s.id], slice = s.type === 'URLLC' ? '低时延高可靠切片（URLLC）' : '大带宽切片（eMBB）';
  const apps = c.apps.map(a => '<li><b>' + a.n + '</b><span>' + a.d + '</span></li>').join('');
  const svg =
    '<svg class="arch" viewBox="0 0 320 176" role="img" aria-label="5G SA 专网数据流向：终端经基站到本地 UPF 和业务系统，信令走 5GC 控制面">'
    + '<rect x="2" y="78" width="316" height="68" rx="2" fill="none" stroke="var(--local)" stroke-dasharray="4 3"/>'
    + '<text x="8" y="159" class="t" fill="var(--local)">专网边界内：数据在本地处理，不经过公网</text>'
    + '<rect x="104" y="6" width="112" height="32" fill="none" stroke="var(--ctrl)"/>'
    + '<text x="160" y="20" class="t" text-anchor="middle" fill="var(--ctrl)">5GC 控制面</text><text x="160" y="32" class="t s" text-anchor="middle" fill="var(--muted)">AMF · SMF · UDM</text>'
    + '<path d="M132 38 V86 M188 38 V86" stroke="var(--ctrl)" stroke-dasharray="3 3" fill="none"/>'
    + '<text x="136" y="64" class="t s" fill="var(--ctrl)">N2</text><text x="192" y="64" class="t s" fill="var(--ctrl)">N4</text>'
    + ['终端|' + c.term, '5G 基站|gNB', '本地 UPF|+ MEC', '业务系统|' + c.biz].map((n, i) => {
      const x = 4 + i * 82, [a, b] = n.split('|'), stroke = i === 1 ? 'var(--acc)' : 'var(--ink)';
      return '<rect x="' + x + '" y="92" width="66" height="40" fill="var(--panel)" stroke="' + stroke + '"/>'
        + '<text x="' + (x + 33) + '" y="108" class="t" text-anchor="middle" fill="var(--ink)">' + a + '</text>'
        + '<text x="' + (x + 33) + '" y="123" class="t s" text-anchor="middle" fill="var(--muted)">' + (b.length > 8 ? b.slice(0, 8) : b) + '</text>';
    }).join('')
    + [70, 152, 234].map(x => '<path d="M' + x + ' 112 H' + (x + 16) + '" stroke="var(--local)" stroke-width="2"/><path d="M' + (x + 16) + ' 112 l-5 -3.5 v7z" fill="var(--local)"/>').join('')
    + '</svg>';
  return '<div class="m"><h3>5G SA 专网（示意）</h3>'
    + '<ul class="read sa"><li><b>切片</b><span>' + slice + '</span></li><li><b>UPF</b><span>下沉到场区本地，终端数据不出专网边界</span></li><li><b>控制面</b><span>5GC 控制面可部署在场区内，也可放在云端</span></li></ul>' + svg + '</div>'
    + '<div class="m"><h3>典型应用</h3><ul class="read apps">' + apps + '</ul></div>';
}

/* ===== main.js ===== */

const $ = s => document.querySelector(s);
const $$ = s => Array.prototype.slice.call(document.querySelectorAll(s));

/* ---------- state ---------- */
let sel = 0, view = 'overview', gl = false, spin = true, saOn = true;
var appLabels = [];
if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) spin = false;
const groups = [], pos = [];
let renderer, scene, camera, light, cv, overviewHub;
const cam = { th: .4, ph: 1.0, r: 205, tx: 0, ty: 0, tz: 0 };
const goal = { th: .4, ph: 1.0, r: 205, tx: 0, ty: 0, tz: 0 };

/* ---------- per-scene finishing: coverage, rings, links, particles ---------- */
var ringGeo;
function finish(g,i){
  var s=S[i],u=g.userData,col=u.acc;
  if(!s.strip&&!u.noCoverage){
    var R=s.covKm?6+2.2*Math.sqrt(s.covKm):10.5;
    var hg=new THREE.SphereGeometry(R,32,14,0,Math.PI*2,0,Math.PI/2);
    var w=new THREE.Mesh(hg,new THREE.MeshBasicMaterial({color:col,wireframe:true,transparent:true,opacity:.14,depthWrite:false}));
    var sd=new THREE.Mesh(hg,new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.045,depthWrite:false,side:THREE.DoubleSide}));
    w.position.y=sd.position.y=.2;g.add(w);g.add(sd);
  }
  u.rings=[];var RR=s.strip?9:12;u.ringMax=RR;
  u.towers.forEach(function(t){for(var k=0;k<3;k++){
    var m=new THREE.Mesh(ringGeo,new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.4,depthWrite:false,side:THREE.DoubleSide}));
    m.position.set(t.x,t.y+.2,t.z);m.userData.k=k;g.add(m);u.rings.push(m)}});
  u.beams=[];
  u.towers.forEach(function(t){for(var k=0;k<3;k++){
    var cg=new THREE.ConeGeometry(s.strip?4:5.2,s.strip?8:11,24,1,true);cg.translate(0,-(s.strip?4:5.5),0);
    var bm=new THREE.Mesh(cg,new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.07,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}));
    var holder=new THREE.Group();holder.position.copy(t.top);holder.rotation.y=k*2.0944+.5;bm.rotation.x=.75;holder.add(bm);g.add(holder);u.beams.push(bm)}});
  var n=u.links.length;
  u.lineArr=new Float32Array(n*6);
  var lg=new THREE.BufferGeometry();lg.setAttribute('position',new THREE.BufferAttribute(u.lineArr,3));
  u.lines=new THREE.LineSegments(lg,new THREE.LineBasicMaterial({color:col,transparent:true,opacity:.35,depthWrite:false}));
  u.lines.frustumCulled=false;g.add(u.lines);
  var np=n?Math.round(6+Math.sqrt(s.bw)*.55):0;u.np=np;
  u.parr=new Float32Array(np*3);
  var pg=new THREE.BufferGeometry();pg.setAttribute('position',new THREE.BufferAttribute(u.parr,3));
  u.pts=new THREE.Points(pg,new THREE.PointsMaterial({color:col,size:.75,transparent:true,opacity:.95,depthWrite:false,sizeAttenuation:true}));
  u.pts.frustumCulled=false;g.add(u.pts);
  u.pli=[];u.pt=[];u.pd=[];
  for(var k=0;k<np;k++){u.pli.push(k%n);u.pt.push(rnd(k+1));u.pd.push(k%2?1:-1)}
  u.speed=80/(s.lat||36);
}
var _a=new THREE.Vector3(),_b=new THREE.Vector3(),_d=new THREE.Vector3();
function tickGroup(g,t,dt){
  var u=g.userData,i,k;
  for(i=0;i<u.movers.length;i++){var mv=u.movers[i];var x=((t*mv.s+mv.ph)%2+2)%2,kk=x<1?x:2-x;
    if(mv.f){mv.m.position.copy(mv.f(kk));var nx=mv.f(Math.min(1,kk+.01)),pv=mv.f(Math.max(0,kk-.01));_d.copy(nx).sub(pv);if(x>=1)_d.negate()}
    else{mv.m.position.lerpVectors(mv.a,mv.b,kk);_d.copy(x<1?mv.b:mv.a).sub(x<1?mv.a:mv.b)}
    mv.m.rotation.y=Math.atan2(_d.x,_d.z)}
  for(i=0;i<u.spins.length;i++){var sp=u.spins[i];sp.m.rotation[sp.axis]+=sp.s*dt}
  for(i=0;i<u.rings.length;i++){var r=u.rings[i];var ph=((t*.35+r.userData.k/3)%1);var sc=.6+ph*u.ringMax;r.scale.set(sc,1,sc);r.material.opacity=.5*(1-ph)}
  var n=u.links.length,A=u.lineArr,P=u.parr;
  for(i=0;i<n;i++){var a=ep(u.links[i][0]),b=ep(u.links[i][1]);A[i*6]=a.x;A[i*6+1]=a.y;A[i*6+2]=a.z;A[i*6+3]=b.x;A[i*6+4]=b.y;A[i*6+5]=b.z}
  u.lines.geometry.attributes.position.needsUpdate=true;
  for(k=0;k<u.np;k++){
    var li=u.pli[k],ea=ep(u.links[li][0]),eb=ep(u.links[li][1]);
    var len=Math.max(2,_a.copy(ea).distanceTo(eb));
    var tt=u.pt[k]+u.pd[k]*dt*u.speed/len;tt=tt-Math.floor(tt);u.pt[k]=tt;
    P[k*3]=ea.x+(eb.x-ea.x)*tt;P[k*3+1]=ea.y+(eb.y-ea.y)*tt+Math.sin(Math.PI*tt)*len*.06;P[k*3+2]=ea.z+(eb.z-ea.z)*tt;
  }
  u.pts.geometry.attributes.position.needsUpdate=true;
  for(i=0;i<u.beams.length;i++)u.beams[i].material.opacity=(.045+.04*(.5+.5*Math.sin(t*2+i*1.3)))*(u.beamIntensity||1);
}

/* ---------- WebGL setup ---------- */
function setShadowBounds(b){var sc=light.shadow.camera;sc.left=-b;sc.right=b;sc.top=b;sc.bottom=-b;sc.updateProjectionMatrix()}
function theme(){
  if(!gl)return;
  /* 3D 舞台固定为夜间科技风，不跟随页面主题 */
  scene.background=new THREE.Color('#0b1f30').convertSRGBToLinear();
  scene.fog=new THREE.Fog(new THREE.Color('#0b1f30').convertSRGBToLinear(),260,620);
  ctx.plateMats.forEach(function(m){m.color.set('#1a2733').convertSRGBToLinear()});
  ctx.edgeMat.color.set('#6fd8ff').convertSRGBToLinear();
}
function setGoal(keep){
  if(!gl)return;
  var asp=cv.clientWidth/Math.max(1,cv.clientHeight),k=Math.min(2.2,Math.max(1,1.45/asp));
  if(view==='overview'){goal.tx=0;goal.ty=0;goal.tz=0;goal.r=292*k*(asp>1.9?.9:1);if(!keep){goal.ph=1.0;goal.th=.4}}
  else{var p=pos[sel];goal.tx=p.x;goal.ty=S[sel].ty||2;goal.tz=p.z;goal.r=S[sel].r*k;if(!keep){goal.ph=S[sel].ph||1.0;goal.th=S[sel].th||.75}}
  setShadowBounds(view==='overview'?150:34);
}
function resize(){
  if(!gl)return;var w=cv.clientWidth,h=cv.clientHeight;if(!w||!h)return;
  renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();setGoal(true);
}
var dragging=false,labels=[];
function initGL(){
  cv=$('#c');
  try{renderer=new THREE.WebGLRenderer({canvas:cv,antialias:true})}catch(e){
    $('#stage').insertAdjacentHTML('beforeend','<div class="nogl">当前浏览器无法启用 WebGL，3D 沙盘不可用。左右两侧的场景数据仍可查看。</div>');return}
  gl=true;
  renderer.outputEncoding=THREE.sRGBEncoding;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  scene=new THREE.Scene();
  var pm=new THREE.PMREMGenerator(renderer);scene.environment=pm.fromScene(new RoomEnvironment(),.04).texture;camera=new THREE.PerspectiveCamera(42,1,.5,900);
  scene.add(new THREE.HemisphereLight(0xffffff,0x6c7a88,.3));
  light=new THREE.DirectionalLight(0xffffff,.7);light.castShadow=true;light.shadow.mapSize.set(2048,2048);
  light.shadow.camera.near=1;light.shadow.camera.far=400;setShadowBounds(150);scene.add(light);scene.add(light.target);
  ctx.edgeMat=new THREE.LineBasicMaterial({color:0x000000,transparent:true,opacity:.3});
  ringGeo=new THREE.RingGeometry(.94,1,64);ringGeo.rotateX(-Math.PI/2);
  overviewHub=new THREE.Group();scene.add(overviewHub);
  var hubBase=new THREE.Mesh(new THREE.CylinderGeometry(17,19,1.4,64),new THREE.MeshStandardMaterial({color:0x102330,metalness:.65,roughness:.42}));hubBase.position.y=-.2;hubBase.receiveShadow=true;overviewHub.add(hubBase);
  var hubRing=new THREE.Mesh(new THREE.TorusGeometry(16,.24,8,96),new THREE.MeshBasicMaterial({color:0x41f0a0,transparent:true,opacity:.8}));hubRing.rotation.x=Math.PI/2;hubRing.position.y=.6;overviewHub.add(hubRing);
  var hubCore=new THREE.Mesh(new THREE.IcosahedronGeometry(5,1),new THREE.MeshStandardMaterial({color:0x193d51,emissive:0x087d96,emissiveIntensity:.8,metalness:.6,roughness:.3,wireframe:true}));hubCore.position.y=7;overviewHub.add(hubCore);
  var hubOrbit=new THREE.Mesh(new THREE.TorusGeometry(9,.1,6,64),new THREE.MeshBasicMaterial({color:0xa78bfa,transparent:true,opacity:.75}));hubOrbit.position.y=7;hubOrbit.rotation.x=Math.PI/2.8;overviewHub.add(hubOrbit);
  var ringRadius=106,overviewPoints=S.map(function(_,i){var a=-Math.PI/2+i*Math.PI*2/S.length;return V(Math.cos(a)*ringRadius,0,Math.sin(a)*ringRadius)});
  overviewPoints.forEach(function(p){var line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(0,.25,0),V(p.x*.78,.25,p.z*.78)]),new THREE.LineBasicMaterial({color:0x4ce0bb,transparent:true,opacity:.22}));overviewHub.add(line)});
  S.forEach(function(s,i){
    var g=new THREE.Group();
    g.userData={acc:ACC[s.type],towers:[],links:[],movers:[],spins:[],idx:i};
    BUILD[s.id](g);finish(g,i);buildSA(g,s.id);
    var p=overviewPoints[i];g.position.copy(p);pos.push(p);groups.push(g);scene.add(g);
    var b=document.createElement('button');b.className='lbl';b.innerHTML='<span>'+s.zh+'</span><span class="chip '+s.type.toLowerCase()+'">'+s.type+'</span>';
    b.onclick=function(){go(i,'scene')};$('#labels').appendChild(b);labels.push(b);
    SA[s.id].apps.forEach(function(ap){
      var d=document.createElement('div');d.className='tag';d.hidden=true;d.innerHTML='<i></i><span>'+ap.n+'</span>';d.title=ap.d;
      $('#labels').appendChild(d);appLabels.push({el:d,i:i,v:new THREE.Vector3(p.x+ap.p[0],ap.p[1],p.z+ap.p[2])});
    });
  });
  theme();
  var mq=window.matchMedia('(prefers-color-scheme: dark)');
  if(mq.addEventListener)mq.addEventListener('change',theme);
  new MutationObserver(theme).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
  /* orbit controls */
  var ptrs={},moved=0,lastPinch=0;
  cv.addEventListener('pointerdown',function(e){try{cv.setPointerCapture(e.pointerId)}catch(x){}ptrs[e.pointerId]={x:e.clientX,y:e.clientY};moved=0;dragging=true});
  cv.addEventListener('pointermove',function(e){
    var p=ptrs[e.pointerId];if(!p)return;var ids=Object.keys(ptrs);
    var dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;
    if(ids.length===1){goal.th-=dx*.006;goal.ph=clamp(goal.ph-dy*.005,.15,1.5);moved+=Math.abs(dx)+Math.abs(dy)}
    else if(ids.length===2){var a=ptrs[ids[0]],b=ptrs[ids[1]];var d=Math.hypot(a.x-b.x,a.y-b.y);if(lastPinch>0)goal.r=clamp(goal.r*lastPinch/d,18,460);lastPinch=d;moved+=10}
  });
  function up(e){
    var had=ptrs[e.pointerId];delete ptrs[e.pointerId];lastPinch=0;if(!Object.keys(ptrs).length)dragging=false;
    if(had&&e.type==='pointerup'&&moved<6&&view==='overview'){
      var r=cv.getBoundingClientRect(),ray=new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1),camera);
      var hit=ray.intersectObjects(groups,true)[0];
      if(hit){var o=hit.object;while(o&&o.userData.idx===undefined)o=o.parent;if(o)go(o.userData.idx,'scene')}
    }
  }
  cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up);
  cv.addEventListener('wheel',function(e){e.preventDefault();goal.r=clamp(goal.r*(1+e.deltaY*.0012),18,460)},{passive:false});
  new ResizeObserver(resize).observe($('#stage'));
  resize();
  var clock=new THREE.Clock(),v3=new THREE.Vector3();
  function frame(){if(window.__scenesHidden){requestAnimationFrame(frame);return;}
    requestAnimationFrame(frame);
    var dt=Math.min(.05,clock.getDelta()),t=clock.elapsedTime;
    if(spin&&!dragging)goal.th+=dt*.12;
    var f=Math.min(1,dt*4);
    ['th','ph','r','tx','ty','tz'].forEach(function(k){cam[k]+=(goal[k]-cam[k])*f});
    var sp=Math.sin(cam.ph);
    camera.position.set(cam.tx+cam.r*sp*Math.sin(cam.th),cam.ty+cam.r*Math.cos(cam.ph),cam.tz+cam.r*sp*Math.cos(cam.th));
    camera.lookAt(cam.tx,cam.ty,cam.tz);
    light.position.set(cam.tx+50,cam.ty+80,cam.tz+35);light.target.position.set(cam.tx,cam.ty,cam.tz);
    hubCore.rotation.y=t*.18;hubOrbit.rotation.z=t*.16;
    groups.forEach(function(g){if(g.visible){tickGroup(g,t,dt);if(g.userData.extra)g.userData.extra(t,dt);if(g.userData.sa&&saOn)g.userData.sa.tick(t)}});
    var w=cv.clientWidth,h=cv.clientHeight;
    labels.forEach(function(b,i){
      if(view!=='overview'){b.hidden=true;return}
      v3.set(pos[i].x,9,pos[i].z).project(camera);
      b.hidden=v3.z>1;b.style.transform='translate('+((v3.x*.5+.5)*w)+'px,'+((-v3.y*.5+.5)*h)+'px) translate(-50%,-100%)';
    });
    appLabels.forEach(function(a){
      var on=saOn&&view==='scene'&&a.i===sel;if(!on){a.el.hidden=true;return}
      v3.copy(a.v).project(camera);a.el.hidden=v3.z>1;
      a.el.style.transform='translate('+((v3.x*.5+.5)*w)+'px,'+((-v3.y*.5+.5)*h)+'px)';
    });
    renderer.render(scene,camera);
  }
  frame();
}

/* ---------- UI ---------- */
function esc(x){return x}
function renderSpec(i){
  var s=S[i],col=s.type==='URLLC'?'var(--urllc)':'var(--embb)';
  var bw=Math.max(2,s.bw/BWMAX*100);
  var lat=s.lat?'<div class="bar" style="--accent:'+col+'"><i style="width:'+(s.lat/30*100)+'%"></i></div><div class="ticks"><span>0</span><span>10</span><span>20</span><span>30 ms</span></div>'
    :'<div class="bar na"></div><div class="ticks"><span>该场景没有时延指标</span></div>';
  var order=S.map(function(x,k){return k}).sort(function(a,b){return S[b].bw-S[a].bw});
  var cmp=order.map(function(k){var x=S[k],c=x.type==='URLLC'?'var(--urllc)':'var(--embb)';
    return '<button data-i="'+k+'" aria-current="'+(k===i)+'"><span>'+x.zh+'</span><span class="b"><i style="width:'+Math.max(1.5,x.bw/BWMAX*100)+'%;background:'+c+'"></i></span><span class="v">'+x.bw+'</span></button>'}).join('');
  $('#spec').innerHTML=
   '<h2>'+s.zh+'</h2><div class="sub"><span>'+s.en+'</span><span class="chip '+s.type.toLowerCase()+'">'+s.typeZh+' · '+s.type+'</span></div>'
  +'<p class="note" style="margin:0 0 10px;font-size:13px">'+s.note+'</p>'
  +'<div class="m"><h3>覆盖范围</h3><div class="val" style="font-size:22px">'+s.cov+'</div></div>'
  +'<div class="m"><h3>带宽需求</h3><div class="val">≈'+s.bw+'<small>Mbps</small></div><div class="bar" style="--accent:'+col+'"><i style="width:'+bw+'%"></i></div><div class="ticks"><span>0</span><span>12800 Mbps（机场）</span></div></div>'
  +'<div class="m"><h3>时延要求（越短越苛刻）</h3><div class="val">'+s.latTxt+'</div>'+lat+'</div>'
  +'<div class="m"><h3>3D 怎么读</h3><ul class="read"><li><b>粒子数量</b><span>对应带宽，数据越多粒子越密</span></li><li><b>流动速度</b><span>对应时延，要求越严粒子越快</span></li><li><b>线框罩体</b><span>示意覆盖范围，电网为带状罩体</span></li><li><b>扩散光环</b><span>5G 基站的信号发射，颜色区分 URLLC 与 eMBB</span></li></ul></div>'
  +saPanel(s)
  +'<div class="m"><h3>带宽对比（Mbps）</h3><div class="cmp" id="cmp">'+cmp+'</div></div>';
  $$('#cmp button').forEach(function(b){b.onclick=function(){go(+b.dataset.i,'scene')}});
}
function go(i,mode){
  sel=i;view=mode;
  $$('.item').forEach(function(b,k){b.setAttribute('aria-current',k===i)});
  $('#vOv').setAttribute('aria-pressed',mode==='overview');$('#vSc').setAttribute('aria-pressed',mode==='scene');
  renderSpec(i);
  labels.forEach(function(b,k){b.setAttribute('aria-current',k===i)});
  if(gl){groups.forEach(function(g,k){g.visible=mode==='overview'||k===i;if(g.userData.sa)g.userData.sa.group.visible=saOn});if(overviewHub)overviewHub.visible=mode==='overview';setGoal()}
  try{history.replaceState(null,'','#'+(mode==='overview'?'overview':S[i].id))}catch(e){}
}
function buildUI(){
  var list=$('#list');
  S.forEach(function(s,i){
    var b=document.createElement('button');b.className='item';b.dataset.t=s.type;
    b.innerHTML='<span class="nm">'+s.zh+'</span><span class="chip '+s.type.toLowerCase()+'">'+s.type+'</span><span class="en">'+s.en+'</span>';
    b.onclick=function(){go(i,'scene')};list.appendChild(b);
  });
  $('#vOv').onclick=function(){go(sel,'overview')};
  $('#vSc').onclick=function(){go(sel,'scene')};
  var sa=$('#saBtn');sa.setAttribute('aria-pressed',saOn);sa.onclick=function(){saOn=!saOn;sa.setAttribute('aria-pressed',saOn);groups.forEach(function(g){if(g.userData.sa)g.userData.sa.group.visible=saOn})};
  var sb=$('#spin');sb.setAttribute('aria-pressed',spin);
  sb.onclick=function(){spin=!spin;sb.setAttribute('aria-pressed',spin)};
}
function fromHash(){
  var h=(location.hash||'').slice(1);
  if(h==='overview'||!h){go(sel,'overview');return}
  for(var i=0;i<S.length;i++)if(S[i].id===h){go(i,'scene');return}
  go(sel,'overview');
}
buildUI();initGL();fromHash();
window.addEventListener('hashchange',fromHash);
/* ===== 融合接线 ===== */
window.__scenesBooted=true;
var __ctaBtn=document.getElementById('goWorkbench');
var __ctaName=document.getElementById('goWbName');
var __ctaSub=document.getElementById('goWbSub');
var __ctaWant=__ctaName.textContent;
function __ctaPaint(){
  var isScene=view==='scene';
  var name=isScene?'进入「'+S[sel].zh+'」场景':'进入 5G SA 专网虚拟仿真工作台';
  var sub=isScene?'工作台将自动选中该场景':'校验网络配置是否正确';
  if(__ctaWant===name)return;
  __ctaWant=name;
  __ctaBtn.classList.add('swapping');
  setTimeout(function(){
    __ctaName.textContent=name;
    __ctaSub.textContent=sub;
    __ctaBtn.dataset.mode=isScene?'scene':'overview';
    __ctaBtn.classList.remove('swapping');
  },130);
}
/* go() 是唯一视图/场景切换入口，包一层以同步按钮文案 */
var __goBase=go;
go=function(i,mode){
  var r=__goBase(i,mode);
  try{__ctaPaint()}catch(e){}
  return r;
};
window.__scenesFocus=function(id){
  for(var i=0;i<S.length;i++)if(S[i].id===id){go(i,'scene');return true}
  return false;
};
window.__scenesCurrent=function(){return view==='scene'?S[sel].id:null};
document.getElementById('goWorkbench').onclick=function(){
  window.__goWorkbench(view==='scene'?S[sel].id:null);
};
__ctaPaint();

