/* 应用入口：路由（逐层下钻）、顶部导航窗格、顶栏、全局循环 */
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

  // ============================================================
  // 一、路由解析：#/group/page/param
  // ============================================================
  function parseRoute() {
    const raw = decodeURIComponent(String(window.location.hash || "").replace(/^#\/?/, "")).replace(/\/+$/, "");
    const home = { group: null, page: null, param: null, view: "home", path: "home" };
    if (!raw || raw === "home") return home;

    const parts = raw.split("/").filter(Boolean);
    const g = A.groupByKey[parts[0]];
    if (!g) return home;                                     // 未知模块 → 回首页

    if (!parts[1]) return { group: g.key, page: null, param: null, view: "module", path: g.key };
    if (g.pages.indexOf(parts[1]) < 0) {
      return { group: g.key, page: null, param: null, view: "module", path: g.key };
    }

    const param = parts[2] ? decodeURIComponent(parts[2]).toUpperCase() : null;
    // 第三层：轮次详情
    if (parts[1] === "archive" && param) {
      return { group: g.key, page: parts[1], param, view: "round", path: g.key + "/archive/" + param };
    }
    return { group: g.key, page: parts[1], param: null, view: parts[1], path: g.key + "/" + parts[1] };
  }

  let lastPath = null;
  A.route = function (force) {
    const r = parseRoute();
    if (!force && lastPath === r.path && A.views[A.state.page]) return;
    lastPath = r.path;
    A.state.route = r;
    A.state.page = r.view;
    A.render();
  };

  // ============================================================
  // 二、顶部导航窗格
  // ============================================================
  function crumbsHtml() {
    const trail = A.trail();
    return trail.map(function (t, i) {
      const sep = i ? '<span class="crumb-sep">›</span>' : "";
      const cls = "crumb" + (t.here ? " here" : "");
      return sep + '<span class="' + cls + '" data-go="' + t.path + '">' + A.kit.esc(t.name) + "</span>";
    }).join("");
  }

  function renderNav() {
    const nav = $("navpane");
    if (!nav) return;
    const r = A.state.route;
    const alarmCnt = (A.state.alarms || []).filter(a => !a.recovered).length;

    let h = '<div class="navrow">';
    // 一级：首页
    h += '<div class="tab' + (r.view === "home" ? " on" : "") + '" data-go="home">' +
      '<span class="ic">⌂</span>首页</div>';
    // 一级：三个模块
    A.groups.forEach(function (g) {
      const on = r.group === g.key ? " on" : "";
      const cnt = g.key === "monitor" && alarmCnt > 0 ? '<span class="cnt">' + alarmCnt + "</span>" : "";
      h += '<div class="tab' + on + '" data-go="' + g.key + '">' +
        '<span class="ic">' + g.ic + "</span>" + A.kit.esc(g.name) + cnt + "</div>";
    });
    h += '<div class="spacer"></div>';
    h += '<div class="crumbs">' + crumbsHtml() + "</div>";
    h += "</div>";

    // 二级：当前模块的页面
    if (r.group) {
      const g = A.groupByKey[r.group];
      h += '<div class="subnav"><span class="lbl">' + g.sub + "</span>";
      h += '<div class="subtab' + (r.view === "module" ? " on" : "") + '" data-go="' + g.key + '">◈ 模块总览</div>';
      g.pages.forEach(function (p) {
        const meta = A.pages[p];
        const on = (r.view === p || (p === "archive" && r.view === "round")) ? " on" : "";
        h += '<div class="subtab' + on + '" data-go="' + g.key + "/" + p + '">' +
          meta.ic + " " + A.kit.esc(meta.name) + "</div>";
      });
      h += "</div>";
    }
    nav.innerHTML = h;

    nav.querySelectorAll("[data-go]").forEach(function (el) {
      el.addEventListener("click", function () { A.go(el.getAttribute("data-go")); });
    });
  }

  // ============================================================
  // 三、顶栏
  // ============================================================
  function updateTop() {
    const S = A.state;
    const st = S.fault ? "异常" : S.running ? "运行中" : "待机";
    const dot = $("hdrStateDot");
    if (dot) dot.className = "dot " + (S.fault ? "s-err" : S.running ? "s-run" : "s-idle");
    if ($("hdrState")) $("hdrState").textContent = st;
    if ($("hdrRound")) $("hdrRound").textContent = S.roundCount;
    // 顶栏"异常"只统计未恢复的（历史已恢复告警在「告警与日志」页留档）
    if ($("hdrAlarm")) $("hdrAlarm").textContent = (S.alarms || []).filter(a => !a.recovered).length;
    if ($("btnRun")) $("btnRun").textContent = S.running ? "⏸ 暂停" : "▶ 启动";
  }

  // ============================================================
  // 四、渲染
  // ============================================================
  const HINT = {
    home: "层级：首页 → 模块 → 页面 → 轮次详情；一级导航在上、二级导航在下、面包屑在右上",
    module: "第 2 层：点卡片进入第 3 层页面；面包屑/返回可回退",
    dashboard: "第 3 层：顶栏可启动 / 注入异常 / 复位；数据每 0.25 s 刷新",
    twin: "第 3 层：点模型 ↔ 点右侧清单双向高亮；可抽出层板 / 松开夹具 / 拆装电极",
    logs: "第 3 层：告警可展开诊断树；时间轴显示处置过程",
    archive: "第 3 层：点表格行进入第 4 层轮次详情",
    round: "第 4 层：曲线 / 工序耗时 / 判定结论；可左右切换相邻轮次",
    tasks: "第 3 层：一句话下单为规则解析，下发前需二次确认",
    agent: "第 3 层：候选配方需人工批准后才下发；展开可看证据链",
  };

  A.render = function () {
    const S = A.state;
    renderNav();
    updateTop();
    const r = S.route;
    const meta = r.view === "home" ? { name: "首页" } :
      r.view === "module" ? { name: (A.groupByKey[r.group] || {}).name || "模块" } :
        r.view === "round" ? { name: "轮次详情" } :
          (A.pages[r.view] || { name: r.view });
    if ($("sbPage")) $("sbPage").textContent = meta.name;
    if ($("sbHint")) $("sbHint").textContent = HINT[r.view] || "";

    const root = $("view");
    if (!root) return;
    root.innerHTML = "";
    // 首页全幅铺满 / 孪生页固定视口（其他页面保持原内边距）
    if (root.classList && root.classList.toggle) {
      root.classList.toggle("bleed", r.view === "home");
      root.classList.toggle("twinpage", r.view === "twin");
    }
    A.onTick = null;                 // 视图可注册低频软刷新（首页/模块总览用）
    const fn = A.views[r.view] || A.views.home;
    try {
      fn(root);
    } catch (e) {
      showErr("页面渲染失败（" + r.view + "）：" + (e && e.message));
      if (window.console) console.error(e);
    }
  };

  // ============================================================
  // 五、循环：按视图节流刷新
  // ============================================================
  let tickN = 0;
  let lastNavAlarm = -1;
  A.tickRender = function () {
    tickN++;
    const p = A.state.page;

    // 软刷新（只改数字，不重绘整页）：首页 / 模块总览
    if (p === "home" || p === "module") {
      if (A.onTick) A.onTick();
      const ac = (A.state.alarms || []).filter(a => !a.recovered).length;
      if (ac !== lastNavAlarm) { lastNavAlarm = ac; renderNav(); }
      updateTop();
      return;
    }

    if (p === "dashboard") { A.render(); return; }
    // twin 自带 rAF 渲染循环，不能整页重绘（否则画布/交互会被反复重建）
    if (p === "logs" && tickN % 4 === 0) { A.render(); return; }
    if (p === "tasks" && tickN % 8 === 0) { A.render(); return; }
    updateTop();
  };

  // ============================================================
  // 六、启动
  // ============================================================
  window.addEventListener("hashchange", function () { A.route(); });

  function boot() {
    // 统一的下钻/回退点击代理（视图里只需写 data-go="module/page/param"）
    document.addEventListener("click", function (e) {
      let el = e.target;
      while (el && el !== document.body) {
        if (el.getAttribute && el.getAttribute("data-go")) {
          A.go(el.getAttribute("data-go"));
          return;
        }
        el = el.parentNode;
      }
    });

    // 顶栏按钮
    $("btnRun").addEventListener("click", function () { A.sim.toggle(); updateTop(); A.render(); });
    $("btnFault").addEventListener("click", function () { A.sim.injectFault(); A.render(); });
    $("btnReset").addEventListener("click", function () { A.sim.reset(); updateTop(); A.render(); });
    // 品牌点击回首页
    const brand = document.querySelector(".brand");
    if (brand) brand.addEventListener("click", function () { A.go("home"); });

    // 时钟
    setInterval(function () {
      if ($("sbClock")) $("sbClock").textContent = A.fmt.hhmmss();
    }, 500);
    if ($("sbClock")) $("sbClock").textContent = A.fmt.hhmmss();

    // 模拟主循环
    A.bootSim();

    // 首屏：按 hash 进入（没有 hash 即首页）
    A.route(true);
    A.log("界面就绪：" + (A.allRoutes.length) + " 条路由、7 个视图已加载（演示数据）");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(window.APP);
