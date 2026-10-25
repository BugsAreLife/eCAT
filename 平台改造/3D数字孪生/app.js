/* 数字孪生看板应用逻辑
 * 依赖：scene.js（场景数据）、engine.js（渲染引擎）；无第三方库。
 */
(function () {
  "use strict";

  // ---------- 0. 运行错误可视化（便于现场排查） ----------
  const errBox = document.getElementById("err");
  window.onerror = function (msg, src, line) {
    errBox.style.display = "block";
    errBox.textContent = "运行错误：" + msg + "\n" + (src || "") + ":" + (line || "");
  };

  if (!window.SCENE) {
    errBox.style.display = "block";
    errBox.textContent = "未找到 scene.js（请确认与 index.html 同目录）";
    return;
  }

  const PARTS = window.SCENE.parts;
  const COLORS = window.SCENE.colors;
  const LABELS = window.SCENE.labels || [];

  // ---------- 1. 规格书条目说明（点击部件时展示） ----------
  const SPEC = {
    "C-1": { t: "结构与液电分区", d: "铝型材框架 + 钣金侧/背板；液体层置于电气层下方，漏液路径不经过电气舱。" },
    "R-01": { t: "泵通道扩展", d: "≥6 路独立液体通道，流量可编程，支持正反转与纯水冲洗回路。" },
    "R-02": { t: "管路快换与色标", d: "液体接点改为带截止阀的快插接头；红/蓝/黄/绿/白/灰六色对应六路液体，键位物理防错。" },
    "R-03": { t: "储液液位检测", d: "储液瓶液位实时检测，低液位报警并阻止继续泵送。" },
    "R-06": { t: "废液液位与排放", d: "废液桶液位检测，超阈值提示或自动泵出，杜绝溢流。" },
    "R-07": { t: "电极自动更换机构", d: "六位电极转盘，自动取放电极，定位精度 ±0.2 mm，支撑连续多轮无人值守。" },
    "R-09": { t: "反应位温控", d: "反应烧杯温度控制 ±0.5 ℃，配温度传感。" },
    "R-12": { t: "电化学工作站程序化", d: "USB/LAN + SDK 脚本触发 LSV/CV/EIS/恒流计时，测试数据自动归档。" },
    "R-17": { t: "接液盘与漏液检测", d: "各液体层下设接液盘 + 漏液传感，泄漏即停机上报。" },
    "R-19": { t: "透明防护门", d: "前门带透明观察窗与门磁联锁；开门时高风险动作自动暂停。" },
    "R-20": { t: "排风接口", d: "顶部排风罩接实验室排风，保证柜内换气。" },
    "R-21": { t: "急停与安全回路", d: "急停按钮 + 安全继电器，急停后切断动力并保持状态，复位需人工。" },
    "R-23": { t: "工控机与触摸屏", d: "柜内工控机 + 现场触摸屏，独立散热风道。" },
    "R-24": { t: "IO 通信网关", d: "驱动板无开放接口时，用 Modbus TCP IO 网关旁路，实现全部执行器/传感可控。" },
    "R-27": { t: "中层抽屉式层板", d: "左右三节滑轨 + 拉手，层板可抽出；配到位微动开关，抽屉未归位禁止启动泵与加电。" },
    "R-28": { t: "框架与隔板加固", d: "承重横梁升级 40×40 并加斜撑，控制挠度与振动。" },
    "R-29": { t: "走线走管通道", d: "立柱/背板线槽与穿板件，线缆编号，改造后无悬空交叉。" },
    "R-32": { t: "可调脚轮", d: "带刹车脚轮 + 可调地脚，便于搬运与调平。" },
  };

  // ---------- 2. 模块定义 ----------
  const MODULES = [
    { key: "pump", name: "配液泵组", parts: ["M-PUMP-01", "M-PUMP-02", "M-PUMP-03", "M-PUMP-04", "M-PUMP-05", "M-PUMP-06"], anchor: [-0.06, 1.10, 0.20] },
    { key: "reactor", name: "反应与换电极", parts: ["M-REACTOR-01", "M-REACTOR-02", "M-REACTOR-03", "M-TURRET-01", "M-DRAWER-01"], anchor: [0.05, 1.00, 0.20] },
    { key: "test", name: "电化学测试", parts: ["M-EWS-01"], anchor: [-0.15, 1.38, 0.00] },
    { key: "store", name: "储液", parts: ["M-BOTTLE-01", "M-BOTTLE-02", "M-BOTTLE-03"], anchor: [-0.15, 0.30, 0.10] },
    { key: "waste", name: "废液收集", parts: ["M-WASTE-01"], anchor: [0.29, 0.30, 0.10] },
    { key: "safety", name: "安全与排风", parts: ["M-EST-01", "M-EXH-01", "M-DOOR-01", "M-DOOR-02"], anchor: [-0.10, 1.55, 0.30] },
  ];

  // ---------- 3. 工序定义 ----------
  const STEPS = [
    { name: "加液 / 配液", dur: 7, parts: ["M-PUMP-01", "M-PUMP-02", "M-PUMP-03", "M-PUMP-04", "M-PUMP-05", "M-PUMP-06", "M-BOTTLE-01", "M-BOTTLE-02", "M-BOTTLE-03"] },
    { name: "混合与反应（电沉积）", dur: 8, parts: ["M-REACTOR-01", "M-REACTOR-02", "M-REACTOR-03", "M-TURRET-01"] },
    { name: "电化学测试", dur: 10, parts: ["M-EWS-01", "M-REACTOR-01"] },
    { name: "清洗 / 更换电极", dur: 6, parts: ["M-PUMP-01", "M-TURRET-01", "M-REACTOR-02"] },
    { name: "废液处理", dur: 5, parts: ["M-WASTE-01", "M-PUMP-06"] },
  ];

  // ---------- 4. 异常定义 ----------
  const FAULTS = [
    { name: "泵管堵塞", target: "M-PUMP-03", recover: 4.5, msg: "P3 泵管压力异常（R-04）：已暂停当前工序，回退检查点并重试" },
    { name: "储液液位低", target: "M-BOTTLE-02", recover: 5.0, msg: "LS-02 储液液位 < 15%（R-03）：限制泵送，已通知人工补液" },
    { name: "防护门未关", target: "M-DOOR-01", recover: 4.0, msg: "门磁 DS-01 断开（R-16）：高风险动作已联锁暂停" },
    { name: "工作站通信掉线", target: "M-EWS-01", recover: 5.5, msg: "电化学工作站通信超时（R-12）：正在重连，数据断点已记录" },
    { name: "废液桶将满", target: "M-WASTE-01", recover: 4.0, msg: "LS-05 废液液位 92%（R-06）：已停止排液，等待清空" },
  ];

  // ---------- 5. 状态 ----------
  const S = {
    running: false, stepIdx: 0, stepT: 0, round: 0, elapsed: 0, errCount: 0,
    drawer: 0, drawerTarget: 0,
    selected: null, spin: true, labels: true,
    fault: null, faultT: 0,
  };

  const cam = { theta: -0.62, phi: 0.42, dist: 4.35, target: [0, 0.9, 0], fov: 26 };
  const camTo = { theta: -0.62, phi: 0.42, dist: 4.35, target: [0, 0.9, 0] };

  // ---------- 6. DOM ----------
  const $ = id => document.getElementById(id);
  const cv = $("cv"), ctx = cv.getContext("2d");
  const labelBox = $("labels");
  const logBox = $("log"), alertBox = $("alert");
  const elStep = $("mStep"), elElapsed = $("mElapsed"), elProg = $("mProg"), elBar = $("mBar");
  const elHdrState = $("hdrState"), elHdrRound = $("hdrRound"), elHdrErr = $("hdrErr");
  const elFps = $("fps"), elFaces = $("faces");
  const cardBox = $("card"), modsBox = $("mods");

  // 标注 DOM
  const labelEls = LABELS.map(l => {
    const d = document.createElement("div");
    d.className = "lab";
    d.textContent = l.text;
    labelBox.appendChild(d);
    return d;
  });

  // 模块列表 DOM
  const modRows = MODULES.map(m => {
    const row = document.createElement("div");
    row.className = "mod";
    row.innerHTML = '<span class="dot s-idle"></span><span class="nm">' + m.name + '</span><span class="st">待机</span>';
    row.addEventListener("click", () => {
      camTo.target = m.anchor.slice();
      camTo.dist = 3.1;
      log("聚焦模块：" + m.name);
    });
    modsBox.appendChild(row);
    return { el: row, dot: row.querySelector(".dot"), st: row.querySelector(".st"), def: m };
  });

  // ---------- 7. 画布尺寸 ----------
  let W = 800, H = 600, dpr = 1;
  function resize() {
    const r = cv.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(320, Math.round(r.width));
    H = Math.max(240, Math.round(r.height));
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener("resize", resize);

  // ---------- 8. 日志 ----------
  function log(msg, kind) {
    const t = new Date();
    const hh = String(t.getHours()).padStart(2, "0");
    const mm = String(t.getMinutes()).padStart(2, "0");
    const ss = String(t.getSeconds()).padStart(2, "0");
    const d = document.createElement("div");
    if (kind) d.className = kind;
    d.innerHTML = '<span class="t">' + hh + ":" + mm + ":" + ss + "</span>" + msg;
    logBox.prepend(d);
    while (logBox.childNodes.length > 40) logBox.removeChild(logBox.lastChild);
  }

  // ---------- 9. 状态计算 ----------
  function stateOf(name) {
    if (S.fault && S.fault.target === name) return "error";
    if (S.selected === name) return S.stateCache[name] || "idle";
    return S.stateCache[name] || "idle";
  }

  function rebuildStates() {
    const st = {};
    for (let i = 0; i < PARTS.length; i++) st[PARTS[i].name] = "idle";
    if (S.running && !S.fault) {
      const step = STEPS[S.stepIdx];
      for (const p of step.parts) st[p] = "running";
    }
    if (S.drawer > 0.5) st["M-DRAWER-01"] = "warn";
    for (const k in st) if (st[k] === "error") st[k] = "idle";
    S.stateCache = st;
  }

  // ---------- 10. 渲染循环 ----------
  let last = performance.now(), fpsAvg = 60;
  let hudT = 0;

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    fpsAvg = fpsAvg * 0.92 + (1 / Math.max(dt, 1e-3)) * 0.08;

    // 相机缓动
    if (S.spin && !dragging) cam.theta += 0.28 * dt;
    cam.theta += (camTo.theta - cam.theta) * Math.min(1, dt * 6);
    cam.phi += (camTo.phi - cam.phi) * Math.min(1, dt * 6);
    cam.dist += (camTo.dist - cam.dist) * Math.min(1, dt * 6);
    for (let i = 0; i < 3; i++) cam.target[i] += (camTo.target[i] - cam.target[i]) * Math.min(1, dt * 6);

    // 抽屉动画
    S.drawer += (S.drawerTarget - S.drawer) * Math.min(1, dt * 7);

    // 仿真推进
    if (S.running && !S.fault) {
      const step = STEPS[S.stepIdx];
      S.stepT += dt;
      S.elapsed += dt;
      if (S.stepT >= step.dur) {
        S.stepT = 0;
        S.stepIdx++;
        if (S.stepIdx >= STEPS.length) {
          S.stepIdx = 0;
          S.round++;
          log("完成第 " + S.round + " 轮实验，闭环优化器生成下一轮候选配方");
        }
      }
    }
    if (S.fault) {
      S.faultT += dt;
      if (S.faultT >= S.fault.recover) {
        log("异常已自动恢复：" + S.fault.name + "（检查点续跑）", "w");
        S.fault = null;
        S.faultT = 0;
      }
    }

    rebuildStates();

    // 三维渲染
    const camera = window.MINI3D.createCamera({
      theta: cam.theta, phi: cam.phi, dist: cam.dist, target: cam.target, fov: cam.fov,
    });
    const res = window.MINI3D.render(ctx, W, H, PARTS, camera, {
      colors: COLORS,
      time: now / 1000,
      stateOf: stateOf,
      selectedName: S.selected,
      drawerOpen: S.drawer > 0.5,
    });

    // 标注定位
    for (let i = 0; i < LABELS.length; i++) {
      const el = labelEls[i];
      if (!S.labels) { el.style.display = "none"; continue; }
      const pr = window.MINI3D.projectPoint(camera, W, H, LABELS[i].p);
      if (!pr.visible) { el.style.display = "none"; continue; }
      el.style.display = "block";
      el.style.left = pr.x + "px";
      el.style.top = pr.y + "px";
    }

    // HUD（限频）
    hudT += dt;
    if (hudT > 0.12) {
      hudT = 0;
      updateHUD();
      elFps.textContent = fpsAvg.toFixed(0);
      elFaces.textContent = res.opaque + res.glass;
    }

    requestAnimationFrame(frame);
  }

  // ---------- 11. HUD ----------
  function updateHUD() {
    const step = STEPS[S.stepIdx];
    const prog = S.running && !S.fault ? Math.min(1, S.stepT / step.dur) : 0;
    elStep.textContent = S.running ? (S.fault ? "异常暂停" : step.name) : "待机";
    const mm = String(Math.floor(S.elapsed / 60)).padStart(2, "0");
    const ss = String(Math.floor(S.elapsed % 60)).padStart(2, "0");
    elElapsed.textContent = mm + ":" + ss;
    elProg.textContent = Math.round(prog * 100) + "%";
    elBar.style.width = (prog * 100).toFixed(0) + "%";
    elHdrState.textContent = S.fault ? "异常" : (S.running ? "运行中" : "待机");
    elHdrRound.textContent = S.round;
    elHdrErr.textContent = S.errCount;

    if (S.fault) {
      alertBox.className = "show error";
      alertBox.textContent = "⚠ " + S.fault.name + "：" + S.fault.msg;
    } else {
      alertBox.className = "";
      alertBox.style.display = "none";
    }

    for (let i = 0; i < modRows.length; i++) {
      const r = modRows[i];
      let st = "idle";
      for (const p of r.def.parts) {
        const s = stateOf(p);
        if (s === "error") { st = "error"; break; }
        if (s === "running") st = "running";
        else if (s === "warn" && st !== "running") st = "warn";
      }
      r.dot.className = "dot s-" + st;
      r.st.textContent = st === "running" ? "运行中" : st === "error" ? "异常" : st === "warn" ? "预警" : "待机";
    }

    if (S.selected) renderCard(S.selected);
  }

  // ---------- 12. 部件信息卡 ----------
  function renderCard(name) {
    const part = PARTS.find(p => p.name === name);
    if (!part) return;
    const st = stateOf(name);
    const stTxt = st === "running" ? "运行中" : st === "error" ? "异常" : st === "warn" ? "预警" : "待机";
    const sp = SPEC[part.spec];
    cardBox.innerHTML =
      '<div class="name">' + part.cn + '</div>' +
      '<div class="code">' + part.name + '</div>' +
      '<span class="spec">规格书 ' + part.spec + (sp ? " · " + sp.t : "") + '</span>' +
      '<div class="state"><span class="dot s-' + st + '"></span>当前状态：' + stTxt + '</div>' +
      '<div class="desc" style="margin-top:8px">' + (sp ? sp.d : "该部件属于平台结构件。") + '</div>';
  }

  // ---------- 13. 交互：拖动旋转 / 滚轮缩放 / 点击拾取 ----------
  let dragging = false, dragMoved = false, lx = 0, ly = 0;

  cv.addEventListener("pointerdown", e => {
    dragging = true; dragMoved = false; lx = e.clientX; ly = e.clientY;
    cv.setPointerCapture(e.pointerId);
  });
  cv.addEventListener("pointermove", e => {
    if (!dragging) return;
    const dx = e.clientX - lx, dy = e.clientY - ly;
    if (Math.abs(dx) + Math.abs(dy) > 3) dragMoved = true;
    lx = e.clientX; ly = e.clientY;
    camTo.theta -= dx * 0.008;
    camTo.phi = Math.max(-0.25, Math.min(1.35, camTo.phi + dy * 0.006));
    cam.theta -= dx * 0.008;
    cam.phi = Math.max(-0.25, Math.min(1.35, cam.phi + dy * 0.006));
  });
  cv.addEventListener("pointerup", e => {
    dragging = false;
    if (dragMoved) return;
    const r = cv.getBoundingClientRect();
    const camera = window.MINI3D.createCamera({
      theta: cam.theta, phi: cam.phi, dist: cam.dist, target: cam.target, fov: cam.fov,
    });
    const hit = window.MINI3D.pick(PARTS, camera, W, H, e.clientX - r.left, e.clientY - r.top,
      { drawerOpen: S.drawer > 0.5 });
    if (hit) {
      S.selected = hit.name;
      renderCard(hit.name);
      log("选中部件：" + hit.cn + "（" + hit.spec + "）");
    } else {
      S.selected = null;
    }
  });
  cv.addEventListener("wheel", e => {
    e.preventDefault();
    camTo.dist = Math.max(2.0, Math.min(7.5, camTo.dist + e.deltaY * 0.0016));
  }, { passive: false });

  // ---------- 14. 控制按钮 ----------
  $("btnRun").addEventListener("click", () => {
    S.running = !S.running;
    $("btnRun").textContent = S.running ? "⏸ 暂停实验" : "▶ 启动实验";
    $("btnRun").className = S.running ? "" : "primary";
    log(S.running ? "启动连续运行：工序编排已下发（R-24）" : "已暂停实验，状态保持");
  });

  $("btnDrawer").addEventListener("click", () => {
    if (S.running) {
      log("运行中禁止抽出层板（R-27 到位联锁）", "e");
      return;
    }
    S.drawerTarget = S.drawerTarget > 0.5 ? 0 : 1;
    $("btnDrawer").textContent = S.drawerTarget > 0.5 ? "⇤ 推回层板" : "⇥ 抽出层板";
    log(S.drawerTarget > 0.5 ? "层板已抽出（模拟维护/换样）" : "层板已推回，微动开关到位");
  });

  $("btnFault").addEventListener("click", () => {
    if (S.fault) return;
    S.fault = FAULTS[Math.floor(Math.random() * FAULTS.length)];
    S.faultT = 0;
    S.errCount++;
    log("注入异常：" + S.fault.name + "（" + S.fault.target + "）", "e");
  });

  $("btnReset").addEventListener("click", () => {
    S.fault = null; S.faultT = 0;
    S.running = false; S.stepIdx = 0; S.stepT = 0; S.elapsed = 0; S.round = 0;
    S.drawerTarget = 0; S.selected = null;
    $("btnRun").textContent = "▶ 启动实验";
    $("btnRun").className = "primary";
    $("btnDrawer").textContent = "⇥ 抽出层板";
    cardBox.innerHTML = '<div class="desc" style="color:#8494a8">点击模型中的任意部件查看名称、规格书条目与实时状态。</div>';
    log("系统复位：状态清零，等待启动");
  });

  document.querySelectorAll("[data-view]").forEach(b => {
    b.addEventListener("click", () => {
      const v = b.getAttribute("data-view");
      if (v === "iso") { camTo.theta = -0.62; camTo.phi = 0.42; camTo.dist = 4.35; }
      if (v === "front") { camTo.theta = 0; camTo.phi = 0.10; camTo.dist = 4.0; }
      if (v === "side") { camTo.theta = -1.5708; camTo.phi = 0.12; camTo.dist = 4.0; }
      if (v === "top") { camTo.theta = -0.001; camTo.phi = 1.15; camTo.dist = 4.6; }
      camTo.target = [0, 0.9, 0];
      log("切换视角：" + b.textContent);
    });
  });

  $("cbSpin").addEventListener("change", e => { S.spin = e.target.checked; });
  $("cbLabel").addEventListener("change", e => { S.labels = e.target.checked; });

  // ---------- 15. 启动 ----------
  resize();
  rebuildStates();
  log("数字孪生看板已加载：" + PARTS.length + " 个命名部件");
  log("提示：点击部件可查看其对应的改造需求条目");
  requestAnimationFrame(frame);
})();
