/* 无浏览器冒烟测试：加载 scene.js + engine.js，用假 canvas context 跑渲染与拾取
 * 用法：node test_engine.js
 * 检查项：渲染不抛异常、坐标无 NaN、拾取能命中部件、每帧耗时
 */
const fs = require("fs");
const path = require("path");

global.window = {};
const dir = __dirname;
eval(fs.readFileSync(path.join(dir, "scene.js"), "utf8"));
eval(fs.readFileSync(path.join(dir, "engine.js"), "utf8"));

const { parts, colors, labels } = window.SCENE;
const M = window.MINI3D;

let nan = 0, pathOps = 0, fills = 0;
function chk(x, y, tag) {
  pathOps++;
  if (!Number.isFinite(x) || !Number.isFinite(y)) { nan++; if (nan < 4) console.log("NaN at", tag, x, y); }
}

const ctx = {
  canvas: { width: 800, height: 600 },
  _fill: "#000", _stroke: "#000", _lw: 1, _ga: 1, _lj: "round",
  set fillStyle(v) { this._fill = v; }, get fillStyle() { return this._fill; },
  set strokeStyle(v) { this._stroke = v; }, get strokeStyle() { return this._stroke; },
  set lineWidth(v) { this._lw = v; }, get lineWidth() { return this._lw; },
  set globalAlpha(v) { this._ga = v; }, get globalAlpha() { return this._ga; },
  set lineJoin(v) { this._lj = v; }, get lineJoin() { return this._lj; },
  save() {}, restore() {},
  beginPath() {}, closePath() {},
  moveTo(x, y) { chk(x, y, "moveTo"); },
  lineTo(x, y) { chk(x, y, "lineTo"); },
  fill() { fills++; }, stroke() {},
  fillRect() {},
  ellipse(x, y, rx, ry) { chk(x, y, "ellipse"); chk(rx, ry, "ellipse-r"); },
  createLinearGradient() { return { addColorStop() {} }; },
};

const W = 800, H = 600;
const cam = M.createCamera({ theta: -0.62, phi: 0.42, dist: 4.35, target: [0, 0.9, 0], fov: 26 });

// ---- 1. 渲染一次 ----
const res = M.render(ctx, W, H, parts, cam, {
  colors, time: 0, stateOf: () => "idle", selectedName: "M-PUMP-01",
});
console.log("1) 渲染：不透明面 %d，玻璃面 %d，fill 调用 %d，路径点 %d，NaN %d",
  res.opaque, res.glass, fills, pathOps, nan);

// ---- 2. 性能：预热 3 帧，再测 30 帧 ----
for (let i = 0; i < 3; i++) M.render(ctx, W, H, parts, cam, { colors });
const t0 = process.hrtime.bigint();
for (let i = 0; i < 30; i++) {
  M.render(ctx, W, H, parts, cam, { colors, time: i / 60, stateOf: () => "running" });
}
const ms = Number(process.hrtime.bigint() - t0) / 1e6 / 30;
console.log("2) 性能：" + ms.toFixed(2) + " ms/帧  → 理论上限 " + Math.round(1000 / ms) + " fps");

// 单点投影成本
const t1 = process.hrtime.bigint();
for (let i = 0; i < 20000; i++) M.projectPoint(cam, W, H, [0.1, 0.9, 0.2]);
console.log("   projectPoint 2 万次：" + (Number(process.hrtime.bigint() - t1) / 1e6).toFixed(2) + " ms");

// ---- 3. 拾取：把 8 个关键部件的中心投影到屏幕，在屏幕上点回去 ----
const keys = ["M-PUMP-01", "M-REACTOR-01", "M-EWS-01", "M-WASTE-01", "M-BOTTLE-02", "M-EST-01"];
let ok = 0;
for (const name of keys) {
  const p = parts.find(x => x.name === name);
  const pr = M.projectPoint(cam, W, H, p.center);
  if (!pr.visible) { console.log("   -", name, "不可见"); continue; }
  const hit = M.pick(parts, cam, W, H, pr.x, pr.y, {});
  const hitName = hit ? hit.name : "(空)";
  const good = hit && hit.spec && hit.name ? "✓" : "✗";
  if (hit) ok++;
  console.log("   %s 点 %s → 命中 %s（%s）", good, name, hitName, hit ? hit.spec : "-");
}
console.log("3) 拾取：%d/%d 命中（含被前面的玻璃门挡住的属于正常）", ok, keys.length);

// ---- 4. 抽屉动画（drawerT=1）与状态着色 ----
const res2 = M.render(ctx, W, H, parts, cam, {
  colors, time: 1, stateOf: (n) => (n === "M-PUMP-03" ? "error" : "idle"), drawerT: 1,
});
console.log("4) 抽屉抽出+异常着色：面片 %d，累计 NaN %d", res2.opaque + res2.glass, nan);

// ---- 5. 视角四连（正视/侧视/俯视） ----
for (const [nm, o] of [["正视", { theta: 0, phi: 0.1 }], ["侧视", { theta: -Math.PI / 2, phi: 0.12 }], ["俯视", { theta: 0, phi: 1.15 }]]) {
  const c2 = M.createCamera(Object.assign({ dist: 4.2, target: [0, 0.9, 0], fov: 26 }, o));
  const r2 = M.render(ctx, W, H, parts, c2, { colors });
  const p = M.projectPoint(c2, W, H, [0, 0.9, 0]);
  console.log("   %s：面片 %d，中心投影 (%d, %d) 可见=%s", nm, r2.opaque, p.x | 0, p.y | 0, p.visible);
}

console.log("\n结论：%s（NaN=%d）", nan === 0 ? "通过 ✓" : "存在坐标异常 ✗", nan);
