/* 无浏览器冒烟测试：加载全部脚本 → 启动 → 依次渲染 6 个页面 → 跑模拟/注入异常
 * 用法：node test_smoke.js
 * 目的：在没有浏览器自动化的情况下，尽早暴露引用错误、空指针、图表绘制异常。
 */
const fs = require("fs");
const path = require("path");

// ---------------- 最小 DOM 桩 ----------------
function ctxStub() {
  const noop = function () { };
  const c = {
    canvas: { width: 800, height: 400 },
    save: noop, restore: noop, beginPath: noop, closePath: noop,
    moveTo: noop, lineTo: noop, quadraticCurveTo: noop, arc: noop, ellipse: noop, rect: noop,
    fill: noop, stroke: noop, fillRect: noop, strokeRect: noop, clearRect: noop,
    fillText: noop, setLineDash: noop, translate: noop, rotate: noop, scale: noop,
    setTransform: noop, resetTransform: noop, clip: noop,
    measureText: function () { return { width: 40 }; },
    createLinearGradient: function () { return { addColorStop: noop }; },
  };
  ["fillStyle", "strokeStyle", "lineWidth", "font", "textAlign", "textBaseline", "globalAlpha", "lineJoin"].forEach(k => {
    let v = null; Object.defineProperty(c, k, { get: () => v, set: x => { v = x; } });
  });
  return c;
}

function stubEl(tag) {
  const el = {
    tagName: tag || "div",
    innerHTML: "", textContent: "", value: "",
    style: {}, dataset: {},
    width: 800, height: 400,
    children: [],
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); },
      toggle(c) { this._s.has(c) ? this._s.delete(c) : this._s.add(c); },
      contains(c) { return this._s.has(c); },
    },
    getAttribute() { return null; }, setAttribute() { },
    addEventListener() { }, removeEventListener() { },
    appendChild(c) { this.children.push(c); return c; },
    querySelector() { return stubEl("div"); },
    querySelectorAll() { return []; },
    getBoundingClientRect() { return { width: 800, height: 400, left: 0, top: 0 }; },
    getContext() { return ctxStub(); },
    focus() { }, remove() { },
  };
  return el;
}

const byId = {};
global.document = {
  readyState: "complete",
  body: stubEl("body"),
  getElementById(id) { return byId[id] || (byId[id] = stubEl("div")); },
  createElement(tag) { return stubEl(tag); },
  querySelector() { return stubEl("div"); },
  querySelectorAll() { return []; },
  addEventListener() { },
};
global.window = {
  location: { hash: "" },
  addEventListener() { },
  devicePixelRatio: 1,
  console: console,
};
global.performance = { now: () => Date.now() };

// ---------------- 加载脚本 ----------------
const dir = __dirname;
const files = [
  "assets/data.js", "core/bus.js", "core/sim.js", "ui/kit.js",
  "views/dashboard.js", "views/twin.js", "views/archive.js",
  "views/tasks.js", "views/agent.js", "views/logs.js", "app.js",
];

let failed = 0;
for (const f of files) {
  const code = fs.readFileSync(path.join(dir, f), "utf8");
  try {
    // 以 window 为全局执行（脚本内部通过 window.APP 挂载）
    const fn = new Function("window", "document", "performance", "clearInterval", "setInterval", code);
    fn(global.window, global.document, global.performance, clearInterval, setInterval);
    console.log("加载 OK  " + f);
  } catch (e) {
    failed++;
    console.log("加载 FAIL " + f + " -> " + e.message);
  }
}

const A = global.window.APP;
if (!A) { console.log("APP 未初始化"); process.exit(1); }

// ---------------- 渲染 6 个页面 ----------------
console.log("\n--- 页面渲染 ---");
for (const p of A.navOrder) {
  try {
    A.go(p);
    console.log("渲染 OK  " + p + "（" + A.navMeta[p].name + "）");
  } catch (e) {
    failed++;
    console.log("渲染 FAIL " + p + " -> " + e.message);
  }
}

// ---------------- 模拟推进 / 异常注入 ----------------
console.log("\n--- 模拟与异常 ---");
try {
  A.sim.start();
  for (let i = 0; i < 200; i++) A.sim.tick(0.5);       // 推进约 100 s，跨多轮
  console.log("运行 OK  已完成轮次 = " + A.state.roundCount + "，当前工序 = " + A.sim.currentStep().name);
  A.sim.injectFault();
  console.log("注入 OK  故障 = " + (A.state.fault && A.state.fault.title));
  for (let i = 0; i < 20; i++) A.sim.tick(0.5);        // 等待自动恢复
  console.log("恢复 OK  当前故障 = " + (A.state.fault ? "仍在" : "已清除"));
  A.sim.reset();
  A.sim.toggle();
  A.go("dashboard");
  for (let i = 0; i < 8; i++) A.sim.tick(0.5);
  console.log("复位/重启 OK");
} catch (e) {
  failed++;
  console.log("模拟 FAIL -> " + e.message + "\n" + e.stack);
}

// ---------------- 数据一致性 ----------------
console.log("\n--- 数据检查 ---");
try {
  const D = global.window.DATA;
  const badRound = D.ROUNDS.filter(r => !r.metrics || isNaN(r.metrics.eta10)).length;
  const curveOK = D.ROUNDS.every(r => r.curves.lsv.length > 10 && r.curves.tafel.length > 10);
  console.log("轮次数据：" + D.ROUNDS.length + " 轮，异常行 " + badRound + "，曲线 " + (curveOK ? "正常" : "缺失"));
  console.log("部件：" + D.PARTS.length + " 个，候选配方：" + D.CANDIDATES.length + " 个");
} catch (e) {
  failed++;
  console.log("数据 FAIL -> " + e.message);
}

console.log("\n结论：" + (failed === 0 ? "全部通过 ✓" : failed + " 处失败 ✗"));
setTimeout(() => process.exit(failed === 0 ? 0 : 1), 50);
