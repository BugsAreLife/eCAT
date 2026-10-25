/* 视图 ①：驾驶舱 */
(function (A, D) {
  "use strict";
  const K = A.kit;

  A.views.dashboard = function (root) {
    const S = A.state;
    const rounds = D.ROUNDS;
    const idx = Math.min(S.roundIdx == null ? rounds.length - 1 : S.roundIdx, rounds.length - 1);
    const cur = rounds[idx];
    const prev = rounds[Math.max(0, idx - 1)];
    const step = A.sim.currentStep();

    // 告警横幅
    let banner = "";
    if (S.fault) {
      banner = '<div class="banner show ' + (S.fault.level === "stop" ? "stop" : "hold") + '">' +
        "<b>⚠ " + K.esc(S.fault.title) + "</b>" +
        '<span class="muted">' + K.esc(S.fault.part) + " · " + K.esc(S.fault.symptom) + "</span>" +
        "<span class=\"grow\"></span>" +
        "<span>处置：" + K.esc(S.fault.action) + "（" + Math.ceil(S.fault.left) + " s 后自动恢复）</span></div>";
    }

    const dEta = cur.metrics.eta10 - prev.metrics.eta10;
    const dTaf = cur.metrics.tafel - prev.metrics.tafel;
    const bestEta = rounds.reduce((a, r) => (r.metrics.eta10 < a ? r.metrics.eta10 : a), rounds[0].metrics.eta10);

    root.innerHTML =
      K.pagehead("▦", "驾驶舱", "DASHBOARD · 工序推进与关键指标", "monitor", "运行监控") +
      banner +
      '<div class="grid g4">' +
      K.stat("已完成轮次", S.roundCount, "轮", "目标 8 轮 · 闭环优化中") +
      K.stat("本轮已运行", A.fmt.mmss(S.elapsed), "", "当前工序：" + step.name) +
      K.stat("η10（本轮）", A.fmt.num(cur.metrics.eta10, 1), "mV",
        (dEta <= 0 ? "↓ " : "↑ ") + Math.abs(dEta).toFixed(1) + " mV 较上轮", dEta <= 0 ? "up" : "down") +
      K.stat("Tafel 斜率", A.fmt.num(cur.metrics.tafel, 1), "mV/dec",
        (dTaf <= 0 ? "↓ " : "↑ ") + Math.abs(dTaf).toFixed(1) + " 较上轮", dTaf <= 0 ? "up" : "down") +
      "</div>" +

      K.card("工序时间轴", K.timeline(D.STEPS, S.stepIdx, S.stepT) +
        '<div style="margin-top:8px;display:flex;gap:16px;align-items:center">' +
        '<div style="flex:1">' + K.pbar(A.sim.roundProgress() * 100) + "</div>" +
        '<div class="muted">本轮进度 ' + (A.sim.roundProgress() * 100).toFixed(0) + "%</div></div>",
        S.running ? (S.fault ? "异常暂停" : "运行中") : "待机") +

      '<div class="grid g23">' +
      K.card("关键指标", '<div class="grid g2">' +
        K.stat("双电层电容 Cdl", A.fmt.num(cur.metrics.cdl, 2), "mF/cm²", "表征活性面积") +
        K.stat("100 h 衰减率", A.fmt.num(cur.metrics.decay100h, 1), "%", "目标 < 10%", cur.metrics.decay100h < 10 ? "up" : "down") +
        K.kv("沉积温度", cur.recipe.tempC + " ℃") +
        K.kv("电解液 pH", cur.recipe.pH + "（上限 9.5）") +
        K.kv("沉积电位", cur.recipe.potential + " V") +
        K.kv("沉积时间", cur.recipe.timeMin + " min") +
        "</div>") +
      K.card("闭环优化进度",
        '<div style="display:flex;align-items:center;gap:14px">' +
        '<div style="flex:1"><canvas id="spark" style="width:100%;height:64px"></canvas></div>' +
        '<div style="text-align:right">' +
        '<div class="muted">历史最优 η10</div>' +
        '<div style="font-size:22px;font-weight:600"><span class="mono">' + A.fmt.num(bestEta, 1) + '</span><small> mV</small></div>' +
        "</div></div>" +
        K.kv("当前最优配方", "Mo " + Math.round(cur.recipe.moRatio * 100) + "% / " + cur.recipe.potential + " V") +
        K.kv("贝叶斯优化轮次", S.roundCount + " / 8") +
        K.kv("停止判据", "连续 3 轮改进 < 2% 或达轮次上限")) +
      "</div>" +

      K.card("事件日志", '<div class="log" id="logbox"></div>');

    // 迷你趋势
    const cv = root.querySelector("#spark");
    A.kit.spark(cv, rounds.map((r, i) => [i, r.metrics.eta10]), "#22d3ee");

    // 日志
    const lb = root.querySelector("#logbox");
    lb.innerHTML = S.logs.slice(0, 8).map(l => {
      const cls = l.level === "e" ? "e" : l.level === "w" ? "w" : "";
      return "<div class='" + cls + "'><span class='t'>" + A.fmt.hhmmss(l.ts) + "</span>" + K.esc(l.msg) + "</div>";
    }).join("") || '<div class="muted">暂无事件</div>';
  };
})(window.APP, window.DATA);
