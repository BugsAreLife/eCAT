/* 视图 ⓪：首页（项目总览 / 演示入口）
 * 职责：一屏讲清「这是什么 → 做到什么程度 → 评委怎么点」，并提供直达各功能页的入口。
 * 诚实边界：本页所有指标来自 assets/data.js 的模拟数据，非真实实验结果。
 */
(function (A, D) {
  "use strict";
  const K = A.kit;

  // ---------- 核心能力卡（点击直达） ----------
  const CAPS = [
    { ic: "▦", t: "运行驾驶舱", tag: "驾驶舱", page: "dashboard",
      d: "闭环轮次、5 道工序时间轴、实时指标与事件流一屏掌握，异常时横幅直接给出处置动作。" },
    { ic: "◈", t: "数字孪生", tag: "孪生", page: "twin",
      d: "机柜平台的三维还原，泵 / 烧杯 / 工作站按当前工序着色，故障部件即时变红并选中。" },
    { ic: "▤", t: "实验档案", tag: "档案", page: "archive",
      d: "每轮配方、LSV / Tafel 曲线、合格判定全留痕，任一历史轮次都能回溯比对。" },
    { ic: "☰", t: "一句话下任务", tag: "任务", page: "tasks",
      d: "自然语言 → 结构化目标 → 工序编排与安全校验；解析结果先给人确认，再下发执行。" },
    { ic: "✦", t: "Agent 决策台", tag: "Agent", page: "agent",
      d: "贝叶斯优化给出候选配方 + 证据链，人工批准后方可执行，决策过程可审计、不黑箱。" },
    { ic: "⚠", t: "异常自恢复", tag: "告警", page: "logs",
      d: "5 类故障注入演示：挂起 → 分级处置 → 检查点续跑，全程留痕，可展开诊断树。" },
  ];

  // ---------- 3 分钟导览路线 ----------
  const GUIDE = [
    { t: "启动运行", d: "顶栏「▶ 启动」，看工序时间轴与部件状态联动推进。", page: "dashboard" },
    { t: "看数字孪生", d: "泵 / 烧杯 / 工作站随工序高亮，异常部件变红。", page: "twin" },
    { t: "注入异常", d: "顶栏「⚠ 注入异常」，观察分级告警、处置与自动恢复。", page: "logs" },
    { t: "下一句任务", d: "任务中心输入一句话，检查解析出的目标与安全约束。", page: "tasks" },
    { t: "批准候选", d: "Agent 台看候选配方与证据，人工批准后才下发。", page: "agent" },
  ];

  function stateOf() {
    const S = A.state;
    return S.fault ? { cls: "s-err", text: "异常处置中" }
      : S.running ? { cls: "s-run", text: "运行中" }
        : { cls: "s-idle", text: "待机" };
  }

  function stat(id, label, val, unit, delta, dir) {
    return '<div class="card stat"><div class="k">' + K.esc(label) + "</div>" +
      '<div class="v">' + (id ? '<span id="' + id + '">' : "") + val + (id ? "</span>" : "") +
      (unit ? "<small>" + K.esc(unit) + "</small>" : "") + "</div>" +
      '<div class="d ' + (dir || "") + '">' + delta + "</div></div>";
  }

  A.views.home = function (root) {
    const S = A.state;
    const rounds = D.ROUNDS;
    const first = rounds[0].metrics;
    const last = rounds[rounds.length - 1].metrics;
    const etaDrop = ((1 - last.eta10 / first.eta10) * 100).toFixed(1);
    const tafDrop = ((1 - last.tafel / first.tafel) * 100).toFixed(1);
    const st = stateOf();
    const step = A.sim.currentStep();
    const prog = A.sim.roundProgress() * 100;
    const activeAlarms = (S.alarms || []).filter(a => !a.recovered).length;
    const recovered = (S.alarms || []).filter(a => a.recovered).length;

    root.innerHTML =

      // ==================== 一、Hero ====================
      '<section class="home-hero"><div class="deco"></div>' +
      '<div class="hero-grid">' +

      '<div class="hero-copy">' +
      '<div class="kicker">浙江大学 ·「启真问创·重器领航」智能过程装备创新创业大赛</div>' +
      "<h1>基于 AI Agent 的<br>析氢催化剂智能优化系统</h1>" +
      '<p class="lede">在既有立式机柜式电解水制氢评价平台上做<b>增量改造</b>：由 Agent 把' +
      "「下达任务 → 编排工序 → 电化学表征 → 贝叶斯寻优 → 异常处置」串成<b>无人值守闭环</b>，" +
      "实验数据自动归档、每个动作可追溯。</p>" +
      '<div class="hero-tags">' +
      ["电解水制氢", "AI Agent 托管", "贝叶斯闭环寻优", "数字孪生监控", "异常自恢复"].map(function (x) {
        return '<span class="ht">' + x + "</span>";
      }).join("") +
      "</div>" +
      '<div class="hero-btns">' +
      '<button class="hero-primary" id="heroBtn">' + (S.running ? "⏸ 暂停运行" : "▶ 启动模拟运行") + "</button>" +
      '<button class="hero-ghost" data-go="dashboard">▦ 进入驾驶舱</button>' +
      '<button class="hero-ghost" data-go="agent">✦ Agent 决策台</button>' +
      "</div>" +
      '<div class="hero-note">界面数据为<b>模拟生成</b>，用于流程与交互演示；非真实实验结果。</div>' +
      "</div>" +

      // 实时状态卡
      '<div class="hero-status">' +
      '<div class="hs-hd"><i class="dot ' + st.cls + '" id="homeDot"></i>' +
      '<b id="homeState">' + st.text + '</b><span class="hs-live">实时刷新</span></div>' +
      '<div class="kv"><span>当前工序</span><span id="homeStep">' + K.esc(step.name) + "</span></div>" +
      '<div class="kv"><span>本轮进度</span><span id="homeProg">' + prog.toFixed(0) + "%</span></div>" +
      '<div class="pbar" id="homeBar"><i style="width:' + prog.toFixed(1) + '%"></i></div>' +
      '<div class="kv"><span>已完成轮次</span><span><b id="homeRound">' + S.roundCount + "</b> / 8 轮</span></div>" +
      '<div class="kv"><span>最新 η10</span><span>' + A.fmt.num(last.eta10, 1) + " mV</span></div>" +
      '<div class="kv"><span>当前异常</span><span><b id="homeAlarm">' + activeAlarms + "</b> 起未恢复</span></div>" +
      "</div>" +

      "</div></section>" +

      // ==================== 二、关键指标 ====================
      '<div class="grid g4">' +
      stat("homeKpiRound", "已完成轮次", S.roundCount, "轮",
        "本次会话推进 · 目标 8 轮闭环", "") +
      stat("", "η10 过电位", A.fmt.num(last.eta10, 1), "mV",
        "首轮 " + A.fmt.num(first.eta10, 1) + " → " + A.fmt.num(last.eta10, 1) + "，累计 ↓" + etaDrop + "%", "up") +
      stat("", "Tafel 斜率", A.fmt.num(last.tafel, 1), "mV/dec",
        "首轮 " + A.fmt.num(first.tafel, 1) + " → " + A.fmt.num(last.tafel, 1) + "，累计 ↓" + tafDrop + "%", "up") +
      stat("homeAlarmAll", "异常处置", (S.alarms || []).length, "起",
        "自动恢复 <b id='homeRecovered'>" + recovered + "</b> 起 · 待处理 <b id='homeAlarm2'>" + activeAlarms + "</b> 起", "") +
      "</div>" +

      // ==================== 三、闭环成效 ====================
      K.card("闭环优化成效",
        '<div class="conv-wrap">' +
        '<div><canvas id="homeConv" style="width:100%;height:226px"></canvas></div>' +
        '<div class="conv-side">' +
        K.kv("首轮 η10", A.fmt.num(first.eta10, 1) + " mV") +
        K.kv("最新 η10", "<b>" + A.fmt.num(last.eta10, 1) + " mV</b>") +
        K.kv("目标线", "≤ 60 mV") +
        K.kv("累计降幅", "↓ " + etaDrop + " %") +
        K.kv("Tafel", A.fmt.num(first.tafel, 1) + " → " + A.fmt.num(last.tafel, 1)) +
        K.kv("历史轮次", rounds.length + " 轮（含 1 次失败重试）") +
        '<div class="muted" style="font-size:11.5px;line-height:1.7;margin-top:8px">' +
        "停止判据：连续 3 轮改进 &lt; 2% 或达轮次上限，满足即转入归档与人工确认。</div>" +
        "</div></div>",
        rounds.length + " 轮 · 目标 60 mV") +

      // ==================== 四、核心能力 ====================
      '<div class="sec-hd">核心能力<span class="muted">点卡片直达对应页面</span></div>' +
      '<div class="grid g3">' +
      CAPS.map(function (c) {
        return '<div class="card cap" data-go="' + c.page + '" title="进入 ' + K.esc(c.t) + '">' +
          '<div class="cap-ic">' + c.ic + "</div>" +
          '<div class="cap-bd">' +
          '<div class="cap-t">' + K.esc(c.t) + '<span class="chip">' + K.esc(c.tag) + "</span></div>" +
          '<div class="cap-d">' + K.esc(c.d) + "</div>" +
          '<div class="cap-go">进入 →</div>' +
          "</div></div>";
      }).join("") +
      "</div>" +

      // ==================== 五、导览路线 ====================
      '<div class="sec-hd">现场导览<span class="muted">约 3 分钟 · 按顺序点击</span></div>' +
      '<div class="steps">' +
      GUIDE.map(function (g, i) {
        return '<div class="step" data-go="' + g.page + '">' +
          '<div class="n">' + (i + 1) + "</div>" +
          '<div class="t">' + K.esc(g.t) + "</div>" +
          '<div class="d">' + K.esc(g.d) + "</div></div>";
      }).join("") +
      "</div>" +

      // ==================== 六、能力边界 ====================
      '<div class="sec-hd">能力边界<span class="muted">如实标注，不做过度承诺</span></div>' +
      '<div class="honest">' +
      '<div class="honest-t">⚠ 本页面为功能演示版本（v0.1），以下四点请按实说明</div>' +
      "<ul>" +
      "<li><b>数据为模拟</b>：轮次、曲线、部件参数由固定随机种子生成，用于演示交互与流程，<u>非真实实验结果</u>。</li>" +
      "<li><b>Agent 为脚本化</b>：对话应答与候选配方基于预置规则与证据模板，未接入大模型；一句话下单为规则解析。</li>" +
      "<li><b>3D 为低模占位</b>：等轴测线框示意，非 CAD 工程模型；接入真实模型后沿用同一部件命名与着色接口。</li>" +
      "<li><b>未连接硬件</b>：未与真实蠕动泵 / 电化学工作站通信；数据层以 MockSource 隔离，替换为 HttpSource 即可对接。</li>" +
      "</ul></div>" +

      // ==================== 七、配套文档 ====================
      '<div class="card docidx" style="margin-top:12px"><h3>配套文档<span class="tag">同一仓库</span></h3>' +
      '<div class="docs">' +
      '<a href="../' + encodeURI("作品报告书-基于AI Agent的析氢催化剂智能优化系统.docx") + '">📄 作品报告书</a>' +
      '<a href="../' + encodeURI("平台改造/平台改造需求规格书.md") + '">🧩 平台改造需求规格书</a>' +
      '<a href="' + encodeURI("产品制作方案.md") + '">🗺 产品制作方案</a>' +
      '<a href="../' + encodeURI("Git使用说明.md") + '">🌿 Git 使用说明</a>' +
      "</div>" +
      '<div class="muted" style="font-size:11.5px;margin-top:8px">' +
      "初稿 v0.1 · 目标 2026-11-10 提交 · 本地双击 index.html 即可运行，无需服务器</div>" +
      "</div>";

    // ---------- 交互 ----------
    root.querySelectorAll("[data-go]").forEach(function (el) {
      el.addEventListener("click", function () { A.go(el.getAttribute("data-go")); });
    });

    const hb = root.querySelector("#heroBtn");
    if (hb) {
      hb.addEventListener("click", function () {
        const was = A.state.running;
        A.sim.toggle();
        if (!was) A.go("dashboard");     // 启动后直接进入驾驶舱看推进
        else A.render();
      });
    }

    // ---------- 收敛曲线 ----------
    const pts = rounds.map(function (r, i) { return [i, r.metrics.eta10]; });
    K.lineChart(root.querySelector("#homeConv"), [
      { name: "η10 (mV)", color: "#0b5cad", pts: pts, width: 2.2 },
      { name: "目标 60 mV", color: "#e39a12", dash: true, width: 1.5, pts: [[0, 60], [rounds.length - 1, 60]] },
    ], {
      xlim: [0, rounds.length - 1], ylim: [50, 130], marker: true,
      xTicks: rounds.map(function (r, i) { return i; }).filter(function (i) { return i % 2 === 0; }),
      xFmt: function (v) { return "R-" + String(Math.round(v) + 1).padStart(3, "0"); },
      yFmt: function (v) { return v.toFixed(0); },
      yLabel: "η10 / mV",
    });

    // ---------- 低频软刷新（不重绘整页，避免曲线闪烁） ----------
    A.onTick = function () {
      const s = A.state;
      const ui = stateOf();
      const el = function (id) { return document.getElementById(id); };
      const set = function (id, v) { const e = el(id); if (e) e.textContent = v; };

      const dot = el("homeDot");
      if (dot) dot.className = "dot " + ui.cls;
      set("homeState", ui.text);
      set("homeStep", A.sim.currentStep().name);
      set("homeProg", (A.sim.roundProgress() * 100).toFixed(0) + "%");
      set("homeRound", s.roundCount);
      set("homeKpiRound", s.roundCount);

      const bar = el("homeBar");
      if (bar && bar.firstChild) bar.firstChild.style.width = (A.sim.roundProgress() * 100).toFixed(1) + "%";

      const active = (s.alarms || []).filter(function (a) { return !a.recovered; }).length;
      set("homeAlarm", active);
      set("homeAlarm2", active);
      set("homeAlarmAll", (s.alarms || []).length);
      set("homeRecovered", (s.alarms || []).filter(function (a) { return a.recovered; }).length);

      const b = el("heroBtn");
      if (b) b.textContent = s.running ? "⏸ 暂停运行" : "▶ 启动模拟运行";
    };
  };
})(window.APP, window.DATA);
