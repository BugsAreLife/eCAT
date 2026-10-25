/* 视图 ③：实验档案（轮次 / 曲线 / 趋势 / 帕累托） */
(function (A, D) {
  "use strict";
  const K = A.kit;

  function statusText(r) {
    return r.status === "done" ? "完成" : r.status === "failed" ? "失败" : "进行中";
  }

  // 帕累托前沿：η10 与 衰减率 同时最小
  function frontier(rounds) {
    const pts = rounds.filter(r => r.status !== "failed")
      .map(r => [r.metrics.eta10, r.metrics.decay100h])
      .sort((a, b) => a[0] - b[0]);
    const out = [];
    let bestY = Infinity;
    pts.forEach(p => {
      if (p[1] < bestY) { out.push(p); bestY = p[1]; }
    });
    return out;
  }

  A.views.archive = function (root) {
    const S = A.state;
    const rounds = D.ROUNDS;
    const selId = S.selectedRound || rounds[7].id;
    const sel = rounds.find(r => r.id === selId) || rounds[7];

    const rows = rounds.map(r => ({
      attrs: (r.id === sel.id ? ' class="sel"' : "") + ' data-id="' + r.id + '"',
      cells: [
        "<b>" + r.id + "</b>",
        r.date,
        "Mo " + Math.round(r.recipe.moRatio * 100) + "%",
        A.fmt.num(r.metrics.eta10, 1),
        A.fmt.num(r.metrics.tafel, 1),
        K.badge(r.status === "failed" ? "failed" : r.status === "running" ? "running" : "done", statusText(r)),
      ],
    }));

    const stepRows = sel.steps.map(s => ({
      cells: [s.name, A.fmt.num(s.dur, 1) + " s", K.badge(s.status === "failed" ? "failed" : "done", s.status === "failed" ? "失败" : "完成")],
    }));

    root.innerHTML =
      '<div class="grid g32">' +
      K.card("实验轮次（" + rounds.length + " 轮）",
        K.table(["轮次", "时间", "配方", { label: "η10 / mV", num: true }, { label: "Tafel", num: true }, "状态"], rows) +
        '<div class="muted" style="margin-top:8px">点击任意轮次查看详情与曲线</div>') +
      K.card("单轮详情 · " + sel.id,
        '<div class="grid g2">' +
        K.kv("η10", A.fmt.num(sel.metrics.eta10, 1) + " mV") +
        K.kv("Tafel 斜率", A.fmt.num(sel.metrics.tafel, 1) + " mV/dec") +
        K.kv("Cdl", A.fmt.num(sel.metrics.cdl, 2) + " mF/cm²") +
        K.kv("100 h 衰减", A.fmt.num(sel.metrics.decay100h, 1) + " %") +
        "</div>" +
        K.kv("配方", "Mo " + Math.round(sel.recipe.moRatio * 100) + "% · " + sel.recipe.potential + " V · " +
          sel.recipe.timeMin + " min · " + sel.recipe.tempC + " ℃ · pH " + sel.recipe.pH) +
        K.kv("判定", sel.verdict === "pass" ? '<span class="badge b-run">有效</span>' :
          '<span class="badge b-err">无效</span> <span class="muted">' + K.esc(sel.reason) + "</span>") +
        '<div style="margin-top:10px"><canvas id="gantt" style="width:100%;height:120px"></canvas></div>') +
      "</div>" +

      '<div class="grid g2">' +
      K.card("LSV 极化曲线（" + sel.id + "）", '<canvas id="lsv" style="width:100%;height:210px"></canvas>') +
      K.card("Tafel 斜率（" + sel.id + "）", '<canvas id="tafel" style="width:100%;height:210px"></canvas>') +
      "</div>" +

      '<div class="grid g2">' +
      K.card("多轮指标趋势（η10 / Tafel）", '<canvas id="trend" style="width:100%;height:220px"></canvas>') +
      K.card("配方-性能分布（帕累托前沿）", '<canvas id="pareto" style="width:100%;height:220px"></canvas>',
        "虚线 = 帕累托前沿") +
      "</div>" +

      K.card("工序耗时（" + sel.id + "）", K.table(["工序", { label: "耗时", num: true }, "状态"], stepRows));

    // ---- 交互：切换轮次 ----
    root.querySelectorAll("tbody tr[data-id]").forEach(tr => {
      tr.addEventListener("click", () => {
        S.selectedRound = tr.getAttribute("data-id");
        A.render();
      });
    });

    // ---- 图表 ----
    K.gantt(root.querySelector("#gantt"), sel.steps, sel.steps.length, 0);

    K.lineChart(root.querySelector("#lsv"),
      [{ name: sel.id, color: "#0b5cad", pts: sel.curves.lsv }],
      { xLabel: "过电位 / mV", yLabel: "j / mA·cm⁻²", xlim: [0, 420], ylim: [0, 80],
        yFmt: v => v.toFixed(0), xFmt: v => v.toFixed(0) });

    K.lineChart(root.querySelector("#tafel"),
      [{ name: sel.id, color: "#2f9e57", pts: sel.curves.tafel }],
      { xLabel: "log(j / mA·cm⁻²)", yLabel: "E / mV", xlim: [-1, 1.6], ylim: [30, 140],
        yFmt: v => v.toFixed(0), xFmt: v => v.toFixed(1) });

    K.lineChart(root.querySelector("#trend"), [
      { name: "η10 / mV", color: "#0b5cad", pts: rounds.map((r, i) => [i + 1, r.metrics.eta10]) },
      { name: "Tafel / mV·dec⁻¹", color: "#e39a12", pts: rounds.map((r, i) => [i + 1, r.metrics.tafel]), dash: true },
    ], { xLabel: "轮次", yLabel: "数值", xlim: [1, rounds.length], ylim: [30, 130], marker: true,
      yFmt: v => v.toFixed(0), xFmt: v => v.toFixed(0) });

    const pts = rounds.filter(r => r.status !== "failed").map(r => [r.metrics.eta10, r.metrics.decay100h]);
    const labels = rounds.filter(r => r.status !== "failed").map(r => r.id.replace("R-00", "R"));
    K.scatterChart(root.querySelector("#pareto"),
      [{ name: "实验轮次", color: "#0b5cad", pts: pts, labels: labels, r: 5 }],
      { xLabel: "η10 / mV（越小越好）", yLabel: "衰减率 / %", frontier: frontier(rounds),
        xFmt: v => v.toFixed(0), yFmt: v => v.toFixed(0) });
  };
})(window.APP, window.DATA);
