/* 模拟数据源 + 实验状态机（MockSource）
 * 说明：本文件是"假设备"。将来接真实平台时，只需用同样接口实现 HttpSource 即可，
 *      视图层无需改动（对应《产品制作方案》§2.1 数据层适配器）。
 */
window.APP = window.APP || {};

(function (A, D) {
  "use strict";

  const S = A.state;
  const STEPS = D.STEPS;

  // ---------- 故障剧本（演示用，5 类） ----------
  const FAULTS = [
    { part: "M-PUMP-03", title: "泵管堵塞", level: "hold", recover: 5,
      symptom: "P3 出口压力 > 阈值持续 5 s", action: "回退检查点并重试 1/3" },
    { part: "M-BOTTLE-02", title: "储液液位偏低", level: "hold", recover: 6,
      symptom: "LS-02 液位 18%（阈值 20%）", action: "限制泵送，等待人工补液" },
    { part: "M-EST-01", title: "急停回路被触发", level: "stop", recover: 6,
      symptom: "ESTOP 回路断开，动力已切断", action: "保持安全态，复位需人工确认" },
    { part: "M-EWS-01", title: "工作站通信超时", level: "stop", recover: 6,
      symptom: "SCPI 连续 3 次无响应", action: "重连并从最近检查点续跑" },
    { part: "M-WASTE-01", title: "废液桶将满", level: "hold", recover: 5,
      symptom: "LS-05 废液液位 92%（阈值 90%）", action: "停止排液，等待清空" },
  ];

  let lastTs = 0;
  let timer = null;

  // ---------- 初始化 ----------
  function init() {
    S.parts = {};
    D.PARTS.forEach(p => {
      S.parts[p.name] = { state: "idle", params: {} };
    });
    S.tasks = D.TASKS.map(t => Object.assign({}, t));
    S.alarms = D.ALARMS.map(a => Object.assign({}, a));
    S.traces = D.TRACES.map(t => Object.assign({}, t));
    S.logs = [];
    S.chat = [
      { role: "agent", text: "我是本平台的实验 Agent。可以问我：本轮为什么失败、下一轮试什么配方、当前异常怎么处理。" },
    ];
    S.stepIdx = 2; S.stepT = 3.2; S.elapsed = 0; S.roundCount = 7;
    S.running = false; S.fault = null; S.faultCount = 0; S.totalElapsed = 0;
    deriveParts();          // 首帧就有部件参数（否则孪生/部件列表显示空）
    A.log("系统初始化完成：13 个部件就绪，历史 9 轮数据已载入");
    A.log("提示：点击「启动」开始模拟运行，点「注入异常」体验告警与自恢复");
  }

  // ---------- 当前工序 ----------
  function currentStep() { return STEPS[S.stepIdx]; }

  function roundProgress() {
    const step = STEPS[S.stepIdx];
    return (S.stepIdx + Math.min(1, S.stepT / step.dur)) / STEPS.length;
  }

  // ---------- 部件状态推导 ----------
  function deriveParts() {
    const step = currentStep();
    const running = S.running && !S.fault;
    D.PARTS.forEach(p => {
      const st = S.parts[p.name];
      let state = "idle";
      if (running && (p.step === step.key || p.step === "*")) state = "running";
      st.state = state;
      // 参数（演示数值）
      const bump = Math.sin((S.totalElapsed + p.name.length) * 0.6);
      if (p.spec === "R-01") st.params = { flow: (1.6 + bump * 0.25).toFixed(2) + " mL/min" };
      else if (p.spec === "R-03") st.params = { level: (72 + bump * 6).toFixed(0) + " %" };
      else if (p.spec === "R-06") st.params = { level: (64 + bump * 8).toFixed(0) + " %" };
      else if (p.spec === "R-09") st.params = { temp: (66 + bump * 0.4).toFixed(1) + " ℃" };
      else if (p.spec === "R-07") st.params = { pos: "1/6" };
      else if (p.spec === "R-12") st.params = { ch: "CH1", tech: S.stepIdx === 2 ? "LSV" : "待机" };
      else st.params = {};
    });
    // 故障覆盖
    if (S.fault) {
      const st = S.parts[S.fault.part];
      if (st) st.state = S.fault.level === "stop" ? "error" : "warn";
    }
  }

  // ---------- 单步推进 ----------
  function tick(dt) {
    if (!S.running) { deriveParts(); return; }
    if (dt > 0.5) dt = 0.5;

    // 故障倒计时（期间暂停工序推进，模拟"挂起"）
    if (S.fault) {
      S.fault.left -= dt;
      if (S.fault.left <= 0) recoverFault();
      deriveParts();
      return;
    }

    S.elapsed += dt;
    S.totalElapsed += dt;
    S.stepT += dt;

    const step = STEPS[S.stepIdx];
    if (S.stepT >= step.dur) {
      S.stepT = 0;
      S.stepIdx++;
      if (S.stepIdx >= STEPS.length) {
        S.stepIdx = 0;
        S.roundCount++;
        S.elapsed = 0;
        const t = S.tasks.find(x => x.status === "running");
        if (t) { t.progress = Math.min(t.goal.roundLimit, t.progress + 1); }
        A.bus.emit("round", { roundCount: S.roundCount });
        A.log("第 " + S.roundCount + " 轮完成：指标已入库，闭环优化器开始生成下一轮候选", "ok");
      } else {
        A.bus.emit("step", { idx: S.stepIdx, name: STEPS[S.stepIdx].name });
      }
    }
    deriveParts();
  }

  // ---------- 启动 / 暂停 / 复位 ----------
  function start() {
    S.running = true;
    A.log("启动连续运行：工序编排已下发（加液 → 混合反应 → 电化学测试 → 清洗 → 废液）");
    A.bus.emit("run", { running: true });
  }
  function pause() {
    S.running = false;
    A.log("已暂停：状态保持，可从当前工序继续");
    A.bus.emit("run", { running: false });
  }
  function toggle() { S.running ? pause() : start(); }

  function reset() {
    S.running = false;
    S.fault = null;
    S.faultCount = 0;
    S.stepIdx = 0; S.stepT = 0; S.elapsed = 0; S.totalElapsed = 0;
    S.roundCount = 0;
    S.alarms = [];
    S.traces = [];
    S.chat = [{ role: "agent", text: "系统已复位。可以重新下达任务，或点「启动」开始模拟运行。" }];
    S.tasks = D.TASKS.map(t => Object.assign({}, t));
    deriveParts();
    A.log("系统复位：状态清零，等待启动");
    A.bus.emit("reset", {});
  }

  // ---------- 异常注入与恢复 ----------
  function injectFault() {
    if (S.fault) return;
    const f = FAULTS[Math.floor(Math.random() * FAULTS.length)];
    S.fault = Object.assign({}, f, { left: f.recover, at: Date.now() });
    S.faultCount++;
    const alarm = {
      id: "A-" + (340 + S.faultCount), time: A.fmt.hhmmss(), level: f.level,
      part: f.part, title: f.title, symptom: f.symptom, action: f.action,
      recovered: false, dur: f.recover,
    };
    S.alarms.unshift(alarm);
    S.fault.alarmId = alarm.id;
    A.log("异常：" + f.title + "（" + f.part + "）→ " + f.action, f.level === "stop" ? "e" : "w");
    A.bus.emit("fault", S.fault);
  }

  function recoverFault() {
    if (!S.fault) return;
    const f = S.fault;
    const alarm = S.alarms.find(a => a.id === f.alarmId);
    if (alarm) { alarm.recovered = true; alarm.resolvedAt = A.fmt.hhmmss(); }
    S.fault = null;
    A.log("异常已自动恢复：" + f.title + "（检查点续跑）", "ok");
    A.bus.emit("recover", { part: f.part });
  }

  // ---------- 数据源对外接口（MockSource） ----------
  const source = {
    kind: "mock",
    init,
    tick,
    start, pause, toggle, reset,
    injectFault,
    currentStep,
    roundProgress,
    getRounds: () => D.ROUNDS,
    getRound(id) { return D.ROUNDS.find(r => r.id === id) || null; },
    getParts: () => D.PARTS,
    partStateOf(name) { const p = S.parts[name]; return p ? p.state : "idle"; },
    partParamsOf(name) { const p = S.parts[name]; return p ? p.params : {}; },
    getTasks: () => S.tasks,
    getTraces: () => S.traces,
    getAlarms: () => S.alarms,
    getCandidates: () => D.CANDIDATES,
  };

  A.sim = source;

  // ---------- 主循环（250ms 一拍） ----------
  A.bootSim = function () {
    init();
    lastTs = Date.now();
    if (timer) clearInterval(timer);
    timer = setInterval(function () {
      const now = Date.now();
      const dt = (now - lastTs) / 1000;
      lastTs = now;
      tick(dt);
      A.tickRender && A.tickRender();
    }, 250);
  };
})(window.APP, window.DATA);
