/* 视图（第二层）：模块总览
 * 路由：#/monitor、#/data、#/ops
 * 职责：把"首页 → 模块 → 页面 → 详情"的第二层做实——先看该模块的关键数字，
 *       再点卡片进入具体页面；数据模块额外提供最近轮次的第三层下钻入口。
 */
(function (A, D) {
  "use strict";
  const K = A.kit;

  function head(g, n) {
    return '<div class="pagehead">' +
      '<div class="ph-ic">' + g.ic + "</div>" +
      "<div><h2>" + K.esc(g.name) + "</h2>" +
      '<div class="ph-sub">' + K.esc(g.sub) + " ／ 第 2 层 · " + n + " 个页面</div></div>" +
      '<div class="ph-back" data-go="home">← 返回首页</div>' +
      "</div>";
  }

  function pageCard(r, p) {
    const meta = A.pages[p];
    return '<div class="card cap" data-go="' + r.group + "/" + p + '">' +
      '<div class="cap-ic">' + meta.ic + "</div>" +
      '<div class="cap-bd"><div class="cap-t">' + K.esc(meta.name) + "</div>" +
      '<div class="cap-d">' + K.esc(meta.hint) + "</div>" +
      '<div class="cap-go">进入 · 第 3 层 →</div></div></div>';
  }

  // ---------- 监控：实时摘要 ----------
  function monitorStats() {
    const S = A.state;
    const st = S.fault ? "异常处置中" : S.running ? "运行中" : "待机";
    return '<div class="grid g4">' +
      '<div class="card stat"><div class="k">运行状态</div><div class="v" style="font-size:20px"><span id="modState">' + st + "</span></div>" +
      '<div class="d">顶栏可启动 / 注入异常</div></div>' +
      '<div class="card stat"><div class="k">当前工序</div><div class="v" style="font-size:20px"><span id="modStep">' +
      K.esc(A.sim.currentStep().name) + "</span></div>" +
      '<div class="d">5 道工序循环</div></div>' +
      '<div class="card stat"><div class="k">本轮进度</div><div class="v"><span id="modProg">' +
      (A.sim.roundProgress() * 100).toFixed(0) + "</span><small>%</small></div>" +
      '<div class="pbar" id="modBar" style="margin-top:6px"><i style="width:' +
      (A.sim.roundProgress() * 100).toFixed(1) + '%"></i></div></div>' +
      '<div class="card stat"><div class="k">未恢复异常</div><div class="v"><span id="modAlarm">' +
      (S.alarms || []).filter(a => !a.recovered).length + "</span><small>起</small></div>" +
      '<div class="d">自动恢复后写入审计日志</div></div>' +
      "</div>";
  }

  // ---------- 数据：轮次摘要 ----------
  function dataStats() {
    const rounds = D.ROUNDS;
    const done = rounds.filter(r => r.verdict === "pass").length;
    const best = rounds.reduce((a, r) => (r.metrics.eta10 < a.metrics.eta10 ? r : a), rounds[0]);
    return '<div class="grid g4">' +
      '<div class="card stat"><div class="k">历史轮次</div><div class="v">' + rounds.length + "<small>轮</small></div>" +
      '<div class="d">含 1 次失败重试</div></div>' +
      '<div class="card stat"><div class="k">最佳 η10</div><div class="v">' + A.fmt.num(best.metrics.eta10, 1) +
      "<small>mV</small></div><div class=\"d up\">" + best.id + " · 目标 ≤ 60</div></div>" +
      '<div class="card stat"><div class="k">判定有效</div><div class="v">' + done + "<small>/ " + rounds.length + "</small></div>" +
      '<div class="d">失败轮次数据不参与寻优</div></div>' +
      '<div class="card stat"><div class="k">曲线归档</div><div class="v">' + (rounds.length * 2) + "<small>条</small></div>" +
      '<div class="d">每轮 LSV + Tafel</div></div>' +
      "</div>";
  }

  // ---------- 编排：任务摘要 ----------
  function opsStats() {
    const S = A.state;
    const tasks = S.tasks.length ? S.tasks : D.TASKS;
    const running = tasks.filter(t => t.status === "running").length;
    const queued = tasks.filter(t => t.status === "queued").length;
    return '<div class="grid g4">' +
      '<div class="card stat"><div class="k">任务队列</div><div class="v">' + tasks.length + "<small>条</small></div>" +
      '<div class="d">运行 ' + running + " · 排队 " + queued + "</div></div>" +
      '<div class="card stat"><div class="k">候选配方</div><div class="v">' + D.CANDIDATES.length + "<small>个</small></div>" +
      '<div class="d">需人工批准后下发</div></div>' +
      '<div class="card stat"><div class="k">工具调用</div><div class="v">' + A.sim.getTraces().length + "<small>条</small></div>" +
      '<div class="d">指令级审计，可回溯</div></div>' +
      '<div class="card stat"><div class="k">待批准</div><div class="v">' + D.CANDIDATES.length + "<small>个</small></div>" +
      '<div class="d down">未确认不下发（安全约束）</div></div>' +
      "</div>";
  }

  // ---------- 数据模块：最近轮次（第三层入口） ----------
  function roundLinks() {
    const rounds = D.ROUNDS;
    const last = rounds.slice(-4).reverse();
    return K.card("最近轮次 · 点开看第三层详情",
      last.map(function (r) {
        return '<div class="row" data-go="data/archive/' + r.id + '" style="cursor:pointer">' +
          '<span class="dot s-' + (r.status === "running" ? "run" : r.status === "failed" ? "err" : "idle") + '"></span>' +
          '<span class="nm"><b>' + r.id + "</b> · Mo " + Math.round(r.recipe.moRatio * 100) + "% · " + r.date + "</span>" +
          '<span class="st">η10 ' + A.fmt.num(r.metrics.eta10, 1) + " mV</span>" +
          '<span class="drill" style="margin-left:10px">详情 →</span></div>';
      }).join(""), "逐轮下钻");
  }

  // ---------- 层级路径（把"逐层"画出来） ----------
  function pathbar(g) {
    const trail = A.trail();          // 首页 › 当前模块
    const p1 = g.pages[0];
    let h = '<div class="pathbar">';
    trail.forEach(function (x, i) {
      h += (i ? '<span class="pa">›</span>' : "") +
        '<span class="pn' + (x.here ? " on" : "") + '" data-go="' + x.path + '">' +
        '<span class="pi">' + (i === 0 ? "⌂" : g.ic) + "</span>" + K.esc(x.name) + "</span>";
    });
    if (p1) {
      h += '<span class="pa">›</span><span class="pn" data-go="' + g.key + "/" + p1 + '">' +
        '<span class="pi">' + A.pages[p1].ic + "</span>" + K.esc(A.pages[p1].name) + "</span>";
    }
    if (g.key === "data") {
      h += '<span class="pa">›</span><span class="pn" data-go="data/archive/R-008">' +
        '<span class="pi">▤</span>R-008 详情</span>';
    } else {
      h += '<span class="pa">›</span><span class="pn ghost"><span class="pi">◆</span>详情</span>';
    }
    h += "</div>";
    return K.card("导航层级 · " + A.state.route.path, h +
      '<div class="muted" style="font-size:11.5px;margin-top:9px">' +
      "点亮的是当前层；实心方块可点击（回到该层），虚线为下一层示意。顶部一级导航 / 二级导航 / 右上角面包屑三条路径等价。" +
      "</div>", "逐层");
  }

  // ---------- 各模块补充内容 ----------
  function extra(g) {
    if (g.key === "monitor") {
      const logs = A.state.logs.slice(0, 6);
      const parts = D.PARTS.map(function (p) { return A.sim.partStateOf(p.name); });
      const run = parts.filter(function (s) { return s === "running"; }).length;
      const err = parts.filter(function (s) { return s === "error" || s === "warn"; }).length;
      const logHtml = logs.map(function (l) {
        const cls = l.level === "e" ? "e" : l.level === "w" ? "w" : "";
        return "<div class='" + cls + "'><span class='t'>" + A.fmt.hhmmss(l.ts) + "</span>" + K.esc(l.msg) + "</div>";
      }).join("") || '<div class="muted">暂无事件</div>';
      return '<div class="grid g2">' +
        K.card("最近事件", '<div class="log">' + logHtml + "</div>", "实时留痕") +
        K.card("部件概览",
          K.kv("部件总数", D.PARTS.length + " 个") +
          K.kv("运行中部件", run + " 个") +
          K.kv("异常部件", err + " 个") +
          K.kv("模拟源", "MockSource（可换 HttpSource）") +
          '<div class="muted" style="font-size:11.5px;margin-top:8px">部件命名与改造规格书、3D 场景一致（M-PUMP-01…R-07）。</div>', "13 部件") +
        "</div>";
    }
    if (g.key === "ops") {
      return K.card("候选配方 · 等待人工批准",
        D.CANDIDATES.map(function (c) {
          return '<div class="row"><span class="dot s-warn"></span>' +
            '<span class="nm"><b>' + c.id + "</b> · " + K.esc(c.recipe) + "</span>" +
            '<span class="st">η10 预测 ' + c.eta + " mV</span></div>";
        }).join("") +
        '<div class="muted" style="font-size:11.5px;margin-top:8px">' +
        "安全约束：温度 ≤ 70 ℃、pH ≤ 9.5；未获人工批准不下发（对应需求 R-30 二次确认）。</div>", "3 候选");
    }
    return "";
  }

  A.views.module = function (root) {
    const r = A.state.route;
    const g = A.groupByKey[r.group] || A.groups[0];

    let stats = "";
    if (g.key === "monitor") stats = monitorStats();
    else if (g.key === "data") stats = dataStats();
    else stats = opsStats();

    const cards = g.pages.map(function (p) { return pageCard(r, p); }).join("");

    root.innerHTML = head(g, g.pages.length) + stats +
      '<div class="sec-hd">本模块页面<span class="muted">点卡片进入第 3 层</span></div>' +
      '<div class="grid g3">' + cards + "</div>" +
      pathbar(g) +
      (g.key === "data" ? roundLinks() : "") +
      extra(g) +
      K.card("本模块说明",
        '<div class="muted" style="line-height:1.8;font-size:12px">' + K.esc(g.desc) + "<br>" +
        "· 导航层级：<b>首页</b> → <b>" + K.esc(g.name) + "</b> → 页面 → " +
        (g.key === "data" ? "轮次详情" : "详情") + "；左上角一级导航、下方二级导航、右上角面包屑都可点击回退。<br>" +
        "· 页面数据由 <span class='chip'>assets/data.js</span> 与模拟状态机驱动，全部为演示数据。" +
        "</div>", "层级");

    // 点击下钻
    root.querySelectorAll("[data-go]").forEach(function (el) {
      el.addEventListener("click", function () { A.go(el.getAttribute("data-go")); });
    });

    // 监控模块：软刷新实时数字
    if (g.key === "monitor") {
      A.onTick = function () {
        const S = A.state;
        const el = function (id) { return document.getElementById(id); };
        const set = function (id, v) { const e = el(id); if (e) e.textContent = v; };
        set("modState", S.fault ? "异常处置中" : S.running ? "运行中" : "待机");
        set("modStep", A.sim.currentStep().name);
        set("modProg", (A.sim.roundProgress() * 100).toFixed(0));
        set("modAlarm", (S.alarms || []).filter(a => !a.recovered).length);
        const bar = el("modBar");
        if (bar && bar.firstChild) bar.firstChild.style.width = (A.sim.roundProgress() * 100).toFixed(1) + "%";
      };
    }
  };
})(window.APP, window.DATA);
