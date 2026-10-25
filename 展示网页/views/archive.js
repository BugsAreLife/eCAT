/* 视图（第 3 层页面）：实验档案
 * 路由：#/data/archive
 * 定位：档案列表 + 全局趋势（对比多轮）；单轮证据在 #/data/archive/R-00x 详情页。
 */
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
    const done = rounds.filter(r => r.verdict === "pass").length;

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

    root.innerHTML =
      '<div class="pagehead">' +
      '<div class="ph-ic">▤</div>' +
      "<div><h2>实验档案</h2>" +
      '<div class="ph-sub">ARCHIVE · ' + rounds.length + " 轮 ／ 判定有效 " + done + " 轮 ／ 点表行进入第 4 层详情</div></div>" +
      '<div class="ph-back" data-go="data">← 返回实验数据</div>' +
      "</div>" +

      '<div class="grid g32">' +
      K.card("实验轮次（" + rounds.length + " 轮）",
        K.table(["轮次", "时间", "配方", { label: "η10 / mV", num: true }, { label: "Tafel", num: true }, "状态"], rows) +
        '<div class="muted" style="margin-top:8px;font-size:11.5px">点任意行 → 打开该轮详情（LSV / Tafel / 工序 / 判定）</div>',
        "可下钻") +
      K.card("选中轮次速览 · " + sel.id,
        '<div class="grid g2">' +
        K.kv("η10", A.fmt.num(sel.metrics.eta10, 1) + " mV") +
        K.kv("Tafel 斜率", A.fmt.num(sel.metrics.tafel, 1) + " mV/dec") +
        K.kv("Cdl", A.fmt.num(sel.metrics.cdl, 2) + " mF/cm²") +
        K.kv("100 h 衰减", A.fmt.num(sel.metrics.decay100h, 1) + " %") +
        "</div>" +
        K.kv("配方", "Mo " + Math.round(sel.recipe.moRatio * 100) + "% · " + sel.recipe.potential + " V · " +
          sel.recipe.timeMin + " min · " + sel.recipe.tempC + " ℃ · pH " + sel.recipe.pH) +
        K.kv("判定", sel.verdict === "pass" ? '<span class="badge b-run">有效</span>' :
          '<span class="badge b-err">无效</span>' + (sel.reason ? ' <span class="muted" style="font-size:11px">' + K.esc(sel.reason) + "</span>" : "")) +
        '<div style="margin-top:10px"><div style="font-size:11.5px;color:#9dc2dd;margin-bottom:2px">该轮工序</div>' +
        sel.steps.map(s => '<div class="row"><span class="dot ' + (s.status === "failed" ? "s-err" : "s-run") + '"></span>' +
          '<span class="nm">' + K.esc(s.name) + '</span><span class="st">' + A.fmt.num(s.dur, 1) + " s</span></div>").join("") +
        "</div>" +
        '<div class="btnrow"><button class="primary" data-go="data/archive/' + sel.id + '">打开完整详情 →</button></div>') +
      "</div>" +

      '<div class="grid g2">' +
      K.card("多轮指标趋势（η10 / Tafel）", '<canvas id="trend" style="width:100%;height:230px"></canvas>') +
      K.card("配方-性能分布（帕累托前沿）", '<canvas id="pareto" style="width:100%;height:230px"></canvas>',
        "虚线 = 帕累托前沿") +
      "</div>" +

      K.card("说明",
        '<div class="muted" style="line-height:1.8;font-size:12px">' +
        "· 单轮曲线（LSV / Tafel）、工序耗时与判定证据在<b>轮次详情页</b>（点表行或上方按钮进入）。<br>" +
        "· 失败轮次（R-004）数据标记为无效，不参与贝叶斯寻优与帕累托统计。<br>" +
        "· 全部为演示数据，固定随机种子生成，便于彩排复现。" +
        "</div>");

    // ---- 交互：点行 → 进入第三层详情 ----
    root.querySelectorAll("tbody tr[data-id]").forEach(tr => {
      tr.addEventListener("click", () => {
        const id = tr.getAttribute("data-id");
        S.selectedRound = id;
        A.go("data/archive/" + id);
      });
    });
    root.querySelectorAll("[data-go]").forEach(el => {
      el.addEventListener("click", function (e) {
        e.stopPropagation();
        A.go(el.getAttribute("data-go"));
      });
    });

    // ---- 图表 ----
    K.lineChart(root.querySelector("#trend"), [
      { name: "η10 / mV", color: "#22d3ee", pts: rounds.map((r, i) => [i + 1, r.metrics.eta10]) },
      { name: "Tafel / mV·dec⁻¹", color: "#fbbf24", pts: rounds.map((r, i) => [i + 1, r.metrics.tafel]), dash: true },
    ], {
      xLabel: "轮次", yLabel: "数值", xlim: [1, rounds.length], ylim: [30, 130], marker: true,
      yFmt: v => v.toFixed(0), xFmt: v => v.toFixed(0),
      xTicks: rounds.map((r, i) => i + 1),
    });

    const pts = rounds.filter(r => r.status !== "failed").map(r => [r.metrics.eta10, r.metrics.decay100h]);
    const labels = rounds.filter(r => r.status !== "failed").map(r => r.id.replace("R-00", "R"));
    K.scatterChart(root.querySelector("#pareto"),
      [{ name: "实验轮次", color: "#22d3ee", pts: pts, labels: labels, r: 5 }],
      {
        xLabel: "η10 / mV（越小越好）", yLabel: "衰减率 / %", frontier: frontier(rounds),
        xFmt: v => v.toFixed(0), yFmt: v => v.toFixed(0),
      });
  };
})(window.APP, window.DATA);
