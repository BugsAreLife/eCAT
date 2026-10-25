/* 应用状态 + 事件总线
 * 设计原则：一切变化先进事件流（bus），视图订阅后重绘；状态只在此处维护。
 */
window.APP = window.APP || {};

(function (A) {
  "use strict";

  // ---------- 全局状态 ----------
  A.state = {
    page: "home",
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

  // ---------- 视图注册 ----------
  A.views = {};
  A.navOrder = ["home", "dashboard", "twin", "archive", "tasks", "agent", "logs"];
  A.navMeta = {
    home: { name: "首页", ic: "⌂" },
    dashboard: { name: "驾驶舱", ic: "▦" },
    twin: { name: "数字孪生", ic: "◈" },
    archive: { name: "实验档案", ic: "▤" },
    tasks: { name: "任务中心", ic: "☰" },
    agent: { name: "Agent 工作台", ic: "✦" },
    logs: { name: "告警与日志", ic: "⚠" },
  };

  // ---------- 页面切换 ----------
  A.go = function (page) {
    if (!A.views[page]) page = "home";
    A.state.page = page;
    if (window.location.hash !== "#/" + page) window.location.hash = "#/" + page;
    A.render();
  };
})(window.APP);
