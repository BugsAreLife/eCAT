/* 应用状态 + 事件总线 + 信息架构（层级导航）
 *
 * 导航结构（逐层下钻）：
 *   首页 home
 *   ├─ 运行监控 monitor  → 驾驶舱 dashboard / 数字孪生 twin / 告警与日志 logs
 *   ├─ 实验数据 data     → 实验档案 archive → 轮次详情 data/archive/R-008
 *   └─ 智能编排 ops      → 任务中心 tasks / Agent 工作台 agent
 *
 * 设计原则：一切变化先进事件流（bus），视图订阅后重绘；状态只在此处维护。
 */
window.APP = window.APP || {};

(function (A) {
  "use strict";

  // ---------- 全局状态 ----------
  A.state = {
    route: { group: null, view: "home", page: null, param: null, path: "home" },
    page: "home",       // 当前视图键（home / module / dashboard / archive / round / …）
    running: false,
    roundIdx: 7,        // 当前执行第 8 轮（0-based 指向 R-008）
    stepIdx: 2,
    stepT: 3.2,
    elapsed: 0,         // 本轮已运行秒
    totalElapsed: 0,
    roundCount: 7,      // 已完成轮次
    parts: {},          // name -> {state, params}
    alarms: [],         // 运行期告警
    logs: [],           // 事件日志
    fault: null,        // 当前故障 {part,title,symptom,action,recover,left}
    faultCount: 0,
    traces: [],         // 运行期新增轨迹
    tasks: [],          // 任务队列（运行时副本）
    selectedRound: null,
    selectedTrace: null,
    selectedCand: "C-1",
    chat: [],           // Agent 对话
    expandedAlarm: null,
    demo: false,
  };

  // ---------- 事件总线 ----------
  const listeners = [];
  A.bus = {
    seq: 0,
    history: [],
    on(fn) { listeners.push(fn); },
    emit(type, payload, level) {
      this.seq++;
      const evt = { seq: this.seq, ts: Date.now(), type, level: level || "info", payload: payload || {} };
      this.history.push(evt);
      if (this.history.length > 2000) this.history.shift();
      for (let i = 0; i < listeners.length; i++) {
        try { listeners[i](evt); } catch (e) { /* 视图异常不应中断事件流 */ }
      }
      return evt;
    },
  };

  // ---------- 工具函数 ----------
  A.fmt = {
    hhmmss(ts) {
      const d = new Date(ts || Date.now());
      const p = n => String(n).padStart(2, "0");
      return p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
    },
    mmss(sec) {
      const s = Math.max(0, Math.floor(sec));
      return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
    },
    num(v, n) {
      if (v == null || isNaN(v)) return "–";
      return Number(v).toFixed(n == null ? 1 : n);
    },
  };

  // ---------- 事件日志 ----------
  A.log = function (msg, level) {
    const item = { ts: Date.now(), msg, level: level || "info" };
    A.state.logs.unshift(item);
    if (A.state.logs.length > 200) A.state.logs.pop();
    A.bus.emit("log", item, level);
  };

  // ============================================================
  // 信息架构：视图 / 页面 / 模块
  // ============================================================
  A.views = {};

  // 页面（第三层）
  A.pages = {
    dashboard: { name: "驾驶舱", ic: "▦", hint: "工序推进与关键指标" },
    twin: { name: "数字孪生", ic: "◈", hint: "3D 部件状态" },
    logs: { name: "告警与日志", ic: "⚠", hint: "分级处置与留痕" },
    archive: { name: "实验档案", ic: "▤", hint: "9 轮数据与曲线" },
    tasks: { name: "任务中心", ic: "☰", hint: "一句话下单与编排" },
    agent: { name: "Agent 工作台", ic: "✦", hint: "候选配方与审计链" },
  };

  // 模块（第二层）
  A.groups = [
    {
      key: "monitor", name: "运行监控", ic: "◉", sub: "STATUS · TWIN · ALARM",
      desc: "看平台此刻在干什么：工序进度、部件状态、异常处置。",
      pages: ["dashboard", "twin", "logs"],
    },
    {
      key: "data", name: "实验数据", ic: "▤", sub: "ARCHIVE · CURVES",
      desc: "看历史跑得怎么样：配方、曲线、判定结论，逐轮可下钻到细节。",
      pages: ["archive"],
    },
    {
      key: "ops", name: "智能编排", ic: "✦", sub: "TASK · AGENT",
      desc: "下一句任务，看 Agent 如何编排工序、给出候选并等待人工批准。",
      pages: ["tasks", "agent"],
    },
  ];
  A.groupByKey = {};
  A.groups.forEach(g => { A.groupByKey[g.key] = g; });
  A.groupOfPage = function (page) {
    for (let i = 0; i < A.groups.length; i++) {
      if (A.groups[i].pages.indexOf(page) >= 0) return A.groups[i];
    }
    return null;
  };

  // 全部可路由路径（测试与文档用）
  A.allRoutes = [
    "home",
    "monitor", "monitor/dashboard", "monitor/twin", "monitor/logs",
    "data", "data/archive", "data/archive/R-008",
    "ops", "ops/tasks", "ops/agent",
  ];

  // ---------- 路由（解析在 app.js，跳转在这里） ----------
  A.go = function (path) {
    const p = String(path == null ? "home" : path).replace(/^#?\/+/, "").replace(/\/+$/, "") || "home";
    const h = "#/" + p;
    if (window.location.hash !== h) window.location.hash = h;
    A.route();
  };

  // 面包屑（返回 [{name, path, here}]）
  A.trail = function (route) {
    const r = route || A.state.route;
    const out = [{ name: "首页", path: "home" }];
    if (r.group) {
      const g = A.groupByKey[r.group];
      if (g) out.push({ name: g.name, path: r.group });
      if (r.page && A.pages[r.page]) out.push({ name: A.pages[r.page].name, path: r.group + "/" + r.page });
      if (r.view === "round") out.push({ name: r.param || "轮次详情", path: r.path });
    }
    out.forEach((x, i) => { x.here = i === out.length - 1; });
    return out;
  };
})(window.APP);
