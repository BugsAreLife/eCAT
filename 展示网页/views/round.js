/* 视图（第三层）：轮次详情
 * 路由：#/data/archive/R-008
 * 职责：从实验档案点进来后，看到该轮的全部证据——曲线、配方、工序耗时、判定结论，
 *       并可左右切换到相邻轮次（同层内继续下钻/回溯）。
 */
(function (A, D) {
  "use strict";
  const K = A.kit;

  function normalizeId(p) {
    const m = String(p || "").match(/R-?0*(\d+)/i);
    if (!m) return null;
    return "R-" + String(m[1]).padStart(3, "0");
  }

  function statusBadge(r) {
    if (r.status === "done") return K.badge("done", "完成");
    if (r.status === "failed") return K.badge("failed", "失败");
    return K.badge("running", "进行中");
  }

  A.views.round = function (root) {
    const rounds = D.ROUNDS;
    const id = normalizeId(A.state.route.param);
    const idx = Math.max(0, rounds.findIndex(r => r.id === id));
    const r = rounds[idx] || rounds[rounds.length - 1];
    const prev = rounds[idx - 1];
    const next = rounds[idx + 1];
    const first = rounds[0];
    const pass = rounds.filter(x => x.verdict === "pass");
    const best = pass.reduce((a, x) => (x.metrics.eta10 < a.metrics.eta10 ? x : a), pass[0]);
    const dFirst = r.metrics.eta10 - first.metrics.eta10;
    const dBest = r.metrics.eta10 - best.metrics.eta10;

    const stepRows = r.steps.map(s => ({
      cells: [s.name, A.fmt.num(s.dur, 1) + " s",
        K.badge(s.status === "failed" ? "failed" : "done", s.status === "failed" ? "失败" : "完成")],
    }));

    root.innerHTML =
      '<div class="pagehead">' +
      '<div class="ph-ic">▤</div>' +
      "<div><h2>轮次详情 · " + r.id + "</h2>" +
      '<div class="ph-sub">' + K.esc(r.date) + " ／ " + (r.verdict === "pass" ? "判定有效" : "判定无效") +
      " ／ 第 4 层" + "</div></div>" +
      '<div class="ph-back" data-go="data/archive">← 返回实验档案</div>' +
      "</div>" +

      // 关键指标
      '<div class="grid g4">' +
      '<div class="card stat"><div class="k">η10 过电位</div><div class="v">' + A.fmt.num(r.metrics.eta10, 1) +
      "<small>mV</small></div><div class=\"d " + (dFirst <= 0 ? "up" : "down") + '">较首轮 ' +
      (dFirst <= 0 ? "↓ " : "↑ ") + Math.abs(dFirst).toFixed(1) + " mV</div></div>" +
      '<div class="card stat"><div class="k">Tafel 斜率</div><div class="v">' + A.fmt.num(r.metrics.tafel, 1) +
      "<small>mV/dec</small></div><div class=\"d\">首轮 " + A.fmt.num(first.metrics.tafel, 1) + "</div></div>" +
      '<div class="card stat"><div class="k">双电层电容 Cdl</div><div class="v">' + A.fmt.num(r.metrics.cdl, 2) +
      "<small>mF/cm²</small></div><div class=\"d\">表征活性面积</div></div>" +
      '<div class="card stat"><div class="k">100 h 衰减</div><div class="v">' + A.fmt.num(r.metrics.decay100h, 1) +
      "<small>%</small></div><div class=\"d " + (r.metrics.decay100h < 10 ? "up" : "down") + '">目标 &lt; 10%</div></div>' +
      "</div>" +

      // 曲线 + 判定
      '<div class="grid g23">' +
      K.card("LSV 极化曲线", '<canvas id="rdLsv" style="width:100%;height:250px"></canvas>', r.id) +
      K.card("判定与配方",
        K.kv("判定结论", r.verdict === "pass" ? '<span class="badge b-run">有效</span>' :
          '<span class="badge b-err">无效</span>') +
        (r.reason ? '<div class="muted" style="font-size:11.5px;margin:2px 0 6px">' + K.esc(r.reason) + "</div>" : "") +
        K.kv("Mo 比例", Math.round(r.recipe.moRatio * 100) + " %") +
        K.kv("沉积电位", r.recipe.potential + " V") +
        K.kv("沉积时间", r.recipe.timeMin + " min") +
        K.kv("温度", r.recipe.tempC + " ℃") +
        K.kv("pH", r.recipe.pH) +
        K.kv("与最优轮次差", (dBest === 0 ? "最优" : (dBest > 0 ? "+" : "") + dBest.toFixed(1) + " mV"),
          "") +
        '<div class="muted" style="font-size:11.5px;margin-top:8px">最优轮次：' +
        best.id + "（η10 " + A.fmt.num(best.metrics.eta10, 1) + " mV）</div>", "证据") +
      "</div>" +

      // Tafel + 工序
      '<div class="grid g2">' +
      K.card("Tafel 斜率曲线", '<canvas id="rdTafel" style="width:100%;height:250px"></canvas>') +
      K.card("工序耗时（甘特）", '<canvas id="rdGantt" style="width:100%;height:250px"></canvas>',
        r.steps.length + " 道工序") +
      "</div>" +

      K.card("工序明细（" + r.id + "）", K.table(["工序", { label: "耗时", num: true }, "状态"], stepRows),
        r.steps.filter(s => s.status === "failed").length ? "含失败工序" : "全部完成") +

      // 同层切换
      '<div class="card" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">' +
      '<button' + (prev ? ' data-go="data/archive/' + prev.id + '"' : " disabled") + ">← 上一轮" +
      (prev ? " · " + prev.id : "") + "</button>" +
      '<button' + (next ? ' data-go="data/archive/' + next.id + '"' : " disabled") + ">下一轮" +
      (next ? " · " + next.id : "") + " →</button>" +
      '<span class="muted" style="font-size:11.5px">共 ' + rounds.length + " 轮 · 当前位置第 " + (idx + 1) + " 轮</span>" +
      '<span class="grow"></span>' +
      '<span class="drill" data-go="data">↑ 回到实验数据模块</span>' +
      "</div>";

    // ---- 图表 ----
    K.lineChart(root.querySelector("#rdLsv"),
      [{ name: r.id, color: "#22d3ee", pts: r.curves.lsv }],
      {
        xLabel: "过电位 / mV", yLabel: "j / mA·cm⁻²", xlim: [0, 420], ylim: [0, 80],
        yFmt: v => v.toFixed(0), xFmt: v => v.toFixed(0),
      });

    K.lineChart(root.querySelector("#rdTafel"),
      [{ name: r.id, color: "#34d399", pts: r.curves.tafel }],
      {
        xLabel: "log(j / mA·cm⁻²)", yLabel: "E / mV", xlim: [-1, 1.6], ylim: [30, 140],
        yFmt: v => v.toFixed(0), xFmt: v => v.toFixed(1),
      });

    K.gantt(root.querySelector("#rdGantt"), r.steps, r.steps.length, 0);

    // ---- 交互 ----
    root.querySelectorAll("[data-go]").forEach(function (el) {
      el.addEventListener("click", function () { A.go(el.getAttribute("data-go")); });
    });
  };
})(window.APP, window.DATA);
