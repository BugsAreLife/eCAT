/* 应用入口：导航、路由、顶栏、全局循环 */
(function (A) {
  "use strict";

  const $ = function (id) { return document.getElementById(id); };
  const errBox = $("errbox");

  function showErr(msg) {
    if (!errBox) return;
    errBox.style.display = "block";
    errBox.textContent += (errBox.textContent ? "\n" : "") + msg;
  }
  window.onerror = function (msg, src, line) {
    showErr("运行错误：" + msg + "  (" + (src || "") + ":" + (line || "") + ")");
  };
  window.addEventListener("unhandledrejection", function (e) {
    showErr("未处理的异步错误：" + (e && e.reason));
  });

  // ---------- 导航 ----------
  function renderNav() {
    const nav = $("nav");
    if (!nav) return;
    const alarmCnt = (A.state.alarms || []).filter(a => !a.recovered).length;
    nav.innerHTML = A.navOrder.map(function (key) {
      const m = A.navMeta[key];
      const active = A.state.page === key ? " active" : "";
      const cnt = key === "logs" && alarmCnt > 0 ? '<span class="cnt">' + alarmCnt + "</span>" : "";
      return '<div class="navitem' + active + '" data-page="' + key + '">' +
        '<span class="ic">' + m.ic + "</span><span>" + m.name + "</span>" + cnt + "</div>";
    }).join("");
    nav.querySelectorAll("[data-page]").forEach(function (el) {
      el.addEventListener("click", function () { A.go(el.getAttribute("data-page")); });
    });
  }

  // ---------- 顶栏 ----------
  function updateTop() {
    const S = A.state;
    const st = S.fault ? "异常" : S.running ? "运行中" : "待机";
    const dot = $("hdrStateDot");
    if (dot) dot.className = "dot " + (S.fault ? "s-err" : S.running ? "s-run" : "s-idle");
    if ($("hdrState")) $("hdrState").textContent = st;
    if ($("hdrRound")) $("hdrRound").textContent = S.roundCount;
    // 顶栏"异常"只统计未恢复的（历史已恢复告警在「告警与日志」页留档）
    if ($("hdrAlarm")) $("hdrAlarm").textContent = (S.alarms || []).filter(a => !a.recovered).length;
    if ($("btnRun")) {
      $("btnRun").textContent = S.running ? "⏸ 暂停" : "▶ 启动";
    }
  }

  // ---------- 渲染 ----------
  const HINT = {
    home: "首页的卡片与导览步骤可直接点击进入对应页面",
    dashboard: "顶栏可启动运行 / 注入异常 / 复位；数据每秒刷新",
    twin: "3D 为低模占位，接入真实模型后启用点击拾取高亮",
    archive: "左侧选择轮次，右侧对比 LSV / Tafel 曲线",
    tasks: "一句话下单为规则解析，下发前需二次确认",
    agent: "候选配方需人工批准后才下发；展开可看证据链",
    logs: "告警可展开诊断树；时间轴显示处置过程",
  };

  A.render = function () {
    const S = A.state;
    renderNav();
    updateTop();
    const meta = A.navMeta[S.page] || A.navMeta.home;
    if ($("sbPage")) $("sbPage").textContent = meta.name;
    if ($("sbHint")) $("sbHint").textContent = HINT[S.page] || "";
    const root = $("view");
    if (!root) return;
    root.innerHTML = "";
    A.onTick = null;                 // 视图可注册低频软刷新（首页用）
    try {
      A.views[S.page](root);
    } catch (e) {
      showErr("页面渲染失败（" + S.page + "）：" + (e && e.message));
      if (window.console) console.error(e);
    }
  };

  // ---------- 循环：驾驶舱高频刷新，其余低频 ----------
  let tickN = 0;
  let lastNavAlarm = -1;
  A.tickRender = function () {
    tickN++;
    const p = A.state.page;

    // 首页：只做软刷新（不重绘整页，避免收敛曲线闪烁）
    if (p === "home") {
      if (A.onTick) A.onTick();
      const ac = (A.state.alarms || []).filter(a => !a.recovered).length;
      if (ac !== lastNavAlarm) { lastNavAlarm = ac; renderNav(); }
      updateTop();
      return;
    }

    if (p === "dashboard") { A.render(); return; }
    if (p === "twin" && tickN % 4 === 0) { A.render(); return; }
    if (p === "logs" && tickN % 4 === 0) { A.render(); return; }
    if (p === "tasks" && tickN % 8 === 0) { A.render(); return; }
    updateTop();
  };

  // ---------- 路由 ----------
  function parseHash() {
    const h = (window.location.hash || "").replace(/^#\/?/, "");
    return A.views[h] ? h : "home";
  }
  window.addEventListener("hashchange", function () {
    A.state.page = parseHash();
    A.render();
  });

  // ---------- 启动 ----------
  function boot() {
    A.state.page = parseHash();

    // 顶栏按钮
    $("btnRun").addEventListener("click", function () { A.sim.toggle(); updateTop(); A.render(); });
    $("btnFault").addEventListener("click", function () { A.sim.injectFault(); A.render(); });
    $("btnReset").addEventListener("click", function () { A.sim.reset(); updateTop(); A.render(); });

    // 时钟
    setInterval(function () {
      if ($("sbClock")) $("sbClock").textContent = A.fmt.hhmmss();
    }, 500);
    if ($("sbClock")) $("sbClock").textContent = A.fmt.hhmmss();

    // 模拟主循环
    A.bootSim();

    // 首屏
    A.render();
    A.log("界面就绪：" + A.navOrder.length + " 个页面已加载（演示数据）");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(window.APP);
