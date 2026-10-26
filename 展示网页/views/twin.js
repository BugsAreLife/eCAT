/* 视图（第 3 层）：数字孪生 · 改造机构演示台
 * 左：真实几何的 3D 平台（深色演播室光 + 地面网格 + 选中辉光）
 * 右：全部零件清单（按模块分组）/ 改造需求逐条比对（R-01…R-32、C-1…C-8）
 * 联动：点模型 ↔ 点清单 双向高亮；点需求 → 高亮该需求全部零件
 * 交互：抽屉抽出/推回（三节滑轨分段位移）、夹具夹紧/松开、电极装/拆
 */
(function (A, D) {
  "use strict";

  const K = A.kit;
  const SC = window.SCENE;
  const M3 = window.MINI3D;

  // ---------------- 需求条目（规格书原文标题） ----------------
  const REQ_NAMES = [
    ["R-01", "泵通道扩展"], ["R-02", "管路快换"], ["R-03", "储液液位检测"], ["R-04", "管路气泡/堵塞检测"],
    ["R-05", "纯水冲洗回路"], ["R-06", "废液液位与排放"], ["R-07", "电极自动更换机构"], ["R-08", "电极夹具标准化"],
    ["R-09", "反应位温控"], ["R-10", "搅拌与测试隔振"], ["R-11", "测试后清洗工位"], ["R-12", "工作站程序化控制"],
    ["R-13", "测试数据自动归档"], ["R-14", "样品标识与识别"], ["R-15", "柜内环境监测"], ["R-16", "门状态联锁"],
    ["R-17", "漏液检测"], ["R-18", "氢气浓度监测"], ["R-19", "透明防护门"], ["R-20", "排风接口"],
    ["R-21", "急停与安全回路"], ["R-22", "电气/液体分区"], ["R-23", "工控机与网络"], ["R-24", "驱动板接口开放"],
    ["R-25", "统一时基"], ["R-26", "审计日志"], ["R-27", "中层可拉出"], ["R-28", "隔板与框架加固"],
    ["R-29", "走线走管通道"], ["R-30", "标识系统"], ["R-31", "可调地脚与水平"], ["R-32", "脚轮（可选）"],
    ["C-1", "液电分离"], ["C-2", "重心与稳定"], ["C-3", "刚度与振动"], ["C-4", "隔振"],
    ["C-5", "维修可达性"], ["C-6", "散热"], ["C-7", "运输"], ["C-8", "材料相容性"],
  ].map(function (r) { return { id: r[0], name: r[1] }; });

  // 需求说明（3D 可见的机构类；其余在列表中标注为"非几何"）
  const REQ_DESC = {
    "R-01": "≥6 路独立液路、流量可编程：6 台蠕动泵 + 泵头滚筒并排布置。",
    "R-02": "液路接点改快插接头并做色标：6 色快换接头（红/蓝/黄/绿/白/灰），物理防错。",
    "R-03": "储液瓶液位检测：3 只储液瓶 + 彩色瓶盖（对应液路色标）。",
    "R-06": "废液液位与排放：废液桶 + 桶盖，配液位检测。",
    "R-07": "电极自动更换：六位电极转盘，转盘取放电极，定位 ±0.2 mm。",
    "R-08": "电极夹具标准化（P0）：快换夹头 = 底座 + 2×φ6 定位销 + 弹簧压片 + M6 压紧螺钉 + φ10 电极片，重复定位 ≤0.1 mm。",
    "R-09": "反应位温控 ±0.5 ℃：3 只反应烧杯置于抽屉层。",
    "R-12": "工作站程序化：电化学工作站 + 状态指示灯，脚本触发 LSV/CV/EIS。",
    "R-17": "接液盘与漏液检测：上层/底层接液盘承接泄漏。",
    "R-19": "透明防护门：左右双开玻璃门 + 门把手。",
    "R-20": "排风接口：顶部排风罩 + 排风管接口。",
    "R-21": "急停与安全回路：急停按钮 + 黄色底座。",
    "R-23": "工控机与触摸屏：柜内工控机 + 右侧挂臂触摸屏。",
    "R-24": "驱动板接口旁路：IO 通信网关。",
    "R-27": "中层可拉出：三节滚珠滑轨（外轨固定 / 中轨半程 / 内轨随抽屉）+ 左右限位块 + 到位微动开关 + 前面板与拉手。",
    "R-28": "隔板与框架加固：40×40 铝型材立柱、层板与横梁。",
    "R-29": "走线走管通道：左右立柱线槽。",
    "R-32": "可调脚轮：四只可调脚轮。",
    "C-1": "液电分离：液体层在下、电气层在上，漏液路径不经过电气舱。",
  };

  // ---------------- 模块分组 ----------------
  const GROUPS = [
    { key: "drawer", name: "抽屉与滑轨（R-27）", test: /^M-(RAIL|DSTOP|DSW|DRAWER|DFACE|DHANDLE)/ },
    { key: "fixture", name: "电极与快换夹具（R-08）", test: /^M-(TURRET|FIX|ELEC)/ },
    { key: "pump", name: "配液与管路（R-01/R-02）", test: /^M-(PUMP|PUMPR|QC|PTUBE)/ },
    { key: "liquid", name: "液路容器（R-03/R-06/R-09/R-17）", test: /^M-(REACTOR|BOTTLE|BCAP|WASTE|WCAP|TRAY)/ },
    { key: "elec", name: "电气与控制（R-12/R-23/R-24）", test: /^M-(EWS|IPC|GW|HMI)/ },
    { key: "safety", name: "安全与排风（R-19/R-20/R-21）", test: /^M-(DOOR|HANDLE|EST|EXH|DUCT)/ },
    { key: "frame", name: "柜体结构（R-28/R-32/C-1）", test: /^M-(BASE|FRAME|SHELF|SIDEP|BACKP|TOP|CASTOR)/ },
    { key: "wire", name: "走线与其它", test: /^M-/ },
  ];

  // ---------------- 工序 / 异常 ----------------
  const STEPS = [
    { name: "加液 / 配液", parts: ["M-PUMP-01", "M-PUMP-02", "M-PUMP-03", "M-PUMP-04", "M-PUMP-05", "M-PUMP-06", "M-BOTTLE-01", "M-BOTTLE-02", "M-BOTTLE-03"] },
    { name: "混合与反应", parts: ["M-REACTOR-01", "M-REACTOR-02", "M-REACTOR-03", "M-TURRET-01", "M-FIX-01-BASE", "M-FIX-02-BASE"] },
    { name: "电化学测试", parts: ["M-EWS-01", "M-EWS-02", "M-ELEC-01", "M-ELEC-02"] },
    { name: "清洗 / 更换电极", parts: ["M-PUMP-01", "M-TURRET-01", "M-FIX-01-CLAMP", "M-FIX-02-CLAMP", "M-FIX-01-SCREW", "M-FIX-02-SCREW"] },
    { name: "废液处理", parts: ["M-WASTE-01", "M-PUMP-06"] },
  ];

  const FAULTS = [
    { target: "M-PUMP-03", name: "泵管堵塞", msg: "P3 出口压力异常（R-04）：暂停工序并回退检查点" },
    { target: "M-BOTTLE-02", name: "储液液位低", msg: "LS-02 液位 <15%（R-03）：限制泵送并提示补液" },
    { target: "M-DOOR-01", name: "防护门未关", msg: "门磁断开（R-16/R-19）：高风险动作联锁暂停" },
    { target: "M-EWS-01", name: "工作站掉线", msg: "通信超时（R-12）：重连并记录断点" },
    { target: "M-WASTE-01", name: "废液桶将满", msg: "液位 92%（R-06）：停止排液，等待清空" },
    { target: "M-DSW-01", name: "抽屉未归位", msg: "到位开关未闭合（R-27）：禁止启动泵与加电" },
  ];

  // ---------------- 视图 ----------------
  A.views.twin = function (root) {
    if (!SC || !M3) {
      root.innerHTML = K.card("3D 场景未加载",
        '<div class="muted">缺少 assets/3d/scene.js 或 assets/3d/engine3d.js</div>');
      return;
    }
    const P = SC.parts;
    const bySpec = {};
    P.forEach(function (p) { (bySpec[p.spec] = bySpec[p.spec] || []).push(p.name); });

    const V = {
      sel: null, hover: null, selReq: null, tab: "parts", q: "",
      anim: { drawer: 0, clamp: 0, elec: 0 }, aim: { drawer: 0, clamp: 0, elec: 0 },
      cam: { theta: -0.62, phi: 0.26, dist: 4.35, target: [0, 0.90, 0] },
      camTo: { theta: -0.62, phi: 0.26, dist: 4.35, target: [0, 0.90, 0] },
      view: "iso", logs: [],
      run: false, stepIdx: 0, stepT: 0, round: 0, fault: null, faultT: 0,
    };

    root.innerHTML =
      '<div class="tw">' +
      '<section class="tw-stage">' +
      '<canvas id="twCv"></canvas>' +
      '<div class="tw-toolbar">' +
      '<button id="twRun" class="tw-btn tw-btn--primary">▶ 启动演示</button>' +
      '<button id="twDrawer" class="tw-btn">⇥ 抽出层板</button>' +
      '<button id="twClamp" class="tw-btn">⤒ 松开夹具</button>' +
      '<button id="twElec" class="tw-btn">⇧ 拆下电极</button>' +
      '<button id="twFault" class="tw-btn tw-btn--danger">⚠ 注入异常</button>' +
      '<button id="twReset" class="tw-btn">↺ 复位</button>' +
      "</div>" +
      '<div class="tw-views">' +
      '<button data-view="iso" class="on">等轴</button>' +
      '<button data-view="front">正视</button>' +
      '<button data-view="side">侧视</button>' +
      '<button data-view="top">俯视</button>' +
      '<button data-view="fixture">夹具特写</button>' +
      "</div>" +
      '<div class="tw-hud tl"><i class="dot s-idle" id="twDot"></i><b id="twState">待机</b>' +
      '<span class="sep">·</span><span id="twStep">—</span></div>' +
      '<div class="tw-hud tr"><span id="twFps">60</span> fps<span class="sep">·</span>' +
      '<span id="twFaces">0</span> 面<span class="sep">·</span><span>' + P.length + "</span> 件</div>" +
      '<div class="tw-hint">拖动旋转 · 滚轮缩放 · 点击零件查看对应改造需求</div>' +
      '<div class="tw-tag" id="twTag"></div>' +
      "</section>" +

      '<aside class="tw-side">' +
      '<div class="tw-tabs">' +
      '<div class="tw-tab on" data-tab="parts">零件清单 <b>' + P.length + "</b></div>" +
      '<div class="tw-tab" data-tab="reqs">需求比对 <b>' + REQ_NAMES.length + "</b></div>" +
      "</div>" +
      '<div class="tw-search"><input id="twQ" type="text" placeholder="搜索零件 / 编号 / 需求号"></div>' +
      '<div class="tw-list" id="twList"></div>' +
      '<div class="tw-info" id="twInfo"></div>' +
      '<div class="tw-log" id="twLog"></div>' +
      "</aside>" +
      "</div>";

    const cv = root.querySelector("#twCv");
    const ctx = cv && cv.getContext ? cv.getContext("2d") : null;
    const listBox = root.querySelector("#twList");
    const infoBox = root.querySelector("#twInfo");
    const logBox = root.querySelector("#twLog");
    const tagBox = root.querySelector("#twTag");
    if (!ctx) return;

    let W = 900, H = 700, dpr = 1;

    function resize() {
      const r = cv.getBoundingClientRect ? cv.getBoundingClientRect() : { width: 900, height: 700 };
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = Math.max(320, Math.round(r.width || 900));
      H = Math.max(260, Math.round(r.height || 700));
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      if (ctx.setTransform) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // ---------- 日志 ----------
    function log(msg, kind) {
      const t = new Date();
      const p2 = function (n) { return String(n).padStart(2, "0"); };
      V.logs.unshift({ t: p2(t.getHours()) + ":" + p2(t.getMinutes()) + ":" + p2(t.getSeconds()), msg: msg, kind: kind });
      if (V.logs.length > 30) V.logs.pop();
      if (logBox) {
        logBox.innerHTML = V.logs.slice(0, 4).map(function (l) {
          return '<div class="' + (l.kind || "") + '"><span class="t">' + l.t + "</span>" + K.esc(l.msg) + "</div>";
        }).join("");
      }
    }

    // ---------- 右侧清单 ----------
    function rowsForParts() {
      const q = V.q.trim().toLowerCase();
      const out = [];
      GROUPS.forEach(function (g, gi) {
        const list = P.filter(function (p) {
          if (V.selReq && p.spec !== V.selReq) return false;
          if (q && (p.cn + " " + p.name + " " + p.spec).toLowerCase().indexOf(q) < 0) return false;
          for (let i = 0; i < gi; i++) if (GROUPS[i].test.test(p.name)) return false;
          return g.test.test(p.name);
        });
        if (!list.length) return;
        out.push({ type: "head", text: g.name, n: list.length });
        list.forEach(function (p) { out.push({ type: "part", p: p }); });
      });
      return out;
    }

    function rowsForReqs() {
      const q = V.q.trim().toLowerCase();
      return REQ_NAMES.filter(function (r) {
        return !q || (r.id + " " + r.name).toLowerCase().indexOf(q) >= 0;
      }).map(function (r) {
        return { r: r, n: (bySpec[r.id] || []).length };
      });
    }

    function renderList() {
      if (!listBox) return;
      let html = "";
      if (V.tab === "parts") {
        const rows = rowsForParts();
        rows.forEach(function (row) {
          if (row.type === "head") {
            html += '<div class="tw-grouphd">' + K.esc(row.text) + "<span>" + row.n + "</span></div>";
          } else {
            const p = row.p;
            html += '<div class="tw-row' + (V.sel === p.name ? " on" : "") + '" data-part="' + p.name + '">' +
              '<span class="nm">' + K.esc(p.cn) + "</span>" +
              '<span class="code">' + p.name + "</span>" +
              '<span class="spec">' + p.spec + "</span></div>";
          }
        });
        if (!rows.length) html = '<div class="tw-empty">没有匹配的零件</div>';
      } else {
        rowsForReqs().forEach(function (row) {
          const modeled = row.n > 0;
          html += '<div class="tw-row tw-row--req' + (V.selReq === row.r.id ? " on" : "") + (modeled ? "" : " dim") +
            '" data-req="' + row.r.id + '">' +
            '<span class="rid">' + row.r.id + "</span>" +
            '<span class="nm">' + K.esc(row.r.name) + "</span>" +
            '<span class="cnt">' + (modeled ? row.n + " 件" : "非几何") + "</span></div>";
        });
      }
      listBox.innerHTML = html;

      listBox.querySelectorAll("[data-part]").forEach(function (el) {
        const name = el.getAttribute("data-part");
        el.addEventListener("mouseenter", function () { V.hover = name; });
        el.addEventListener("mouseleave", function () { V.hover = null; });
        el.addEventListener("click", function () { selectPart(name, true); });
      });
      listBox.querySelectorAll("[data-req]").forEach(function (el) {
        el.addEventListener("click", function () { selectReq(el.getAttribute("data-req")); });
      });
    }

    // ---------- 信息卡 ----------
    function renderInfo() {
      if (!infoBox) return;
      let part = V.sel ? P.find(function (p) { return p.name === V.sel; }) : null;
      if (!part) {
        if (V.selReq) {
          const ps = bySpec[V.selReq] || [];
          const rn = (REQ_NAMES.find(function (r) { return r.id === V.selReq; }) || {}).name || "";
          infoBox.innerHTML = '<div class="tw-i-hd"><b>' + V.selReq + "</b><span>" + K.esc(rn) + "</span></div>" +
            '<div class="tw-i-desc">' + K.esc(REQ_DESC[V.selReq] || "该条目为软件 / 接口 / 工艺类要求，3D 中不体现为独立零件。") + "</div>" +
            '<div class="tw-i-meta">关联零件 ' + ps.length + " 件" +
            (ps.length ? "：" + ps.slice(0, 4).map(function (n) { return n; }).join(" / ") + (ps.length > 4 ? " …" : "") : "") + "</div>";
        } else {
          infoBox.innerHTML = '<div class="tw-i-hd"><b>未选中</b><span>点击模型或右侧清单</span></div>' +
            '<div class="tw-i-desc">共 ' + P.length + " 件命名零件，覆盖 " + Object.keys(bySpec).length +
            " 条改造需求。切到「需求比对」可逐条查看 R-01…R-32 / C-1…C-8 的建模情况。</div>";
        }
        return;
      }
      const req = part.spec;
      const rn = (REQ_NAMES.find(function (r) { return r.id === req; }) || {}).name || "";
      const ps = bySpec[req] || [];
      let act = "";
      if (part.anim) {
        act = '<div class="tw-i-act">可动零件 · ' +
          (part.anim.t === "drawer" ? "随抽屉抽出" : part.anim.t === "clamp" ? "随压片松开" : "随电极拆装") + "</div>";
      }
      infoBox.innerHTML =
        '<div class="tw-i-hd"><b>' + K.esc(part.cn) + '</b><span class="code">' + part.name + "</span></div>" +
        '<div class="tw-i-req"><i>' + req + "</i>" + K.esc(rn) + "<em>" + ps.length + " 件</em></div>" +
        '<div class="tw-i-desc">' + K.esc(REQ_DESC[req] || "该零件属于平台结构件。") + "</div>" + act;
    }

    // ---------- 选中 / 需求 ----------
    function selectPart(name, focus) {
      V.sel = name; V.selReq = null;
      const part = P.find(function (p) { return p.name === name; });
      if (part) {
        if (tagBox) {
          tagBox.textContent = part.cn + " · " + part.name + " · " + part.spec;
          tagBox.className = "tw-tag show";
        }
        if (focus && part.center) {
          V.camTo.target = [part.center[0], part.center[1], part.center[2]];
          const tiny = /^M-(FIX|ELEC)/.test(part.name);
          V.camTo.dist = tiny ? 0.78 : 1.7;
          V.camTo.phi = 0.22;
          log("定位到 " + part.cn + "（" + part.spec + "）");
        }
      }
      renderList(); renderInfo();
      if (listBox) {
        const el = listBox.querySelector('[data-part="' + name + '"]');
        if (el) {
          if (el.scrollIntoView) el.scrollIntoView({ block: "nearest" });
          el.classList.add("on");
        }
      }
    }

    function selectReq(id) {
      V.selReq = (V.selReq === id) ? null : id;
      V.sel = null;
      renderList(); renderInfo();
      const ps = bySpec[V.selReq] || [];
      if (V.selReq && ps.length) {
        const c = P.find(function (p) { return p.name === ps[0]; }).center;
        V.camTo.target = [c[0], c[1], c[2]];
        V.camTo.dist = 1.6;
        log("需求 " + V.selReq + "：高亮 " + ps.length + " 件关联零件", "w");
      } else if (V.selReq) {
        log("需求 " + V.selReq + "：软件/接口类条目，3D 无对应几何", "w");
      }
    }

    // ---------- 视角 ----------
    const VIEWS = {
      iso: { theta: -0.62, phi: 0.26, dist: 4.35, target: [0, 0.90, 0] },
      front: { theta: 0.0, phi: 0.05, dist: 4.05, target: [0, 0.95, 0] },
      side: { theta: -Math.PI / 2, phi: 0.07, dist: 4.05, target: [0, 0.95, 0] },
      top: { theta: 0, phi: 1.12, dist: 4.0, target: [0, 0.95, 0] },
      fixture: { theta: -0.72, phi: 0.55, dist: 0.30, target: [0.322, 0.982, 0.185] },
    };

    function setView(key) {
      const v = VIEWS[key];
      if (!v) return;
      V.view = key;
      V.camTo.theta = v.theta;
      V.camTo.phi = v.phi;
      V.camTo.dist = v.dist;
      V.camTo.target = v.target.slice();
    }

    // ---------- 位移 ----------
    function offsetsOf() {
      const o = {};
      const T = SC.travel || { drawer: 0.24, clamp: 0.016, elec: 0.06 };
      P.forEach(function (p) {
        if (!p.anim) return;
        const t = V.anim[p.anim.t] || 0;
        const k = (p.anim.k == null ? 1 : p.anim.k) * t;
        if (p.anim.t === "drawer") o[p.name] = [0, 0, T.drawer * k];
        else if (p.anim.t === "clamp") o[p.name] = [0, T.clamp * k, 0];
        else if (p.anim.t === "elec") o[p.name] = [0, T.elec * k, 0];
      });
      return o;
    }

    function stateOf(name) {
      if (V.fault && V.fault.target === name) return "error";
      if (V.run && !V.fault && STEPS[V.stepIdx].parts.indexOf(name) >= 0) return "running";
      return "idle";
    }

    // ---------- 鼠标 ----------
    let dragging = false, moved = false, lx = 0, ly = 0;
    if (cv.addEventListener) {
      cv.addEventListener("pointerdown", function (e) {
        dragging = true; moved = false; lx = e.clientX; ly = e.clientY;
        if (cv.setPointerCapture) cv.setPointerCapture(e.pointerId);
      });
      cv.addEventListener("pointermove", function (e) {
        if (!dragging) return;
        const dx = e.clientX - lx, dy = e.clientY - ly;
        if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
        lx = e.clientX; ly = e.clientY;
        V.camTo.theta -= dx * 0.008;
        V.camTo.phi = Math.max(-0.15, Math.min(1.30, V.camTo.phi + dy * 0.006));
      });
      cv.addEventListener("pointerup", function (e) {
        dragging = false;
        if (moved) return;
        const r = cv.getBoundingClientRect();
        const hit = M3.pick(P, M3.createCamera(V.cam), W, H, e.clientX - r.left, e.clientY - r.top,
          { offsets: offsetsOf() });
        if (hit) {
          selectPart(hit.name, false);
          log("点选零件：" + hit.cn, "ok");
        } else {
          V.sel = null; V.selReq = null;
          if (tagBox) tagBox.className = "tw-tag";
          renderList(); renderInfo();
        }
      });
      cv.addEventListener("wheel", function (e) {
        if (e.preventDefault) e.preventDefault();
        V.camTo.dist = Math.max(0.55, Math.min(6.5, V.camTo.dist + (e.deltaY || 0) * 0.0014));
      }, { passive: false });
    }

    // ---------- 按钮 ----------
    const btn = function (id) { return root.querySelector("#" + id); };
    const bRun = btn("twRun"), bDrawer = btn("twDrawer"), bClamp = btn("twClamp"),
      bElec = btn("twElec"), bFault = btn("twFault"), bReset = btn("twReset");

    if (bRun) bRun.addEventListener("click", function () {
      V.run = !V.run;
      bRun.textContent = V.run ? "⏸ 暂停演示" : "▶ 启动演示";
      log(V.run ? "启动演示：工序联动开始（高亮当前工序相关零件）" : "已暂停演示");
    });
    if (bDrawer) bDrawer.addEventListener("click", function () {
      const to = V.aim.drawer > 0.5 ? 0 : 1;
      V.aim.drawer = to;
      bDrawer.textContent = to ? "⇤ 推回层板" : "⇥ 抽出层板";
      log(to ? "R-27：三节滑轨伸出（外轨固定 / 中轨半程 / 内轨全行程），限位块到位"
        : "R-27：层板推回，到位微动开关闭合", to ? "ok" : "");
    });
    if (bClamp) bClamp.addEventListener("click", function () {
      const to = V.aim.clamp > 0.5 ? 0 : 1;
      V.aim.clamp = to;
      bClamp.textContent = to ? "⤓ 压紧夹具" : "⤒ 松开夹具";
      log(to ? "R-08：弹簧压片抬起，可换电极" : "R-08：压片压下，弹簧压接保证接触电阻稳定", to ? "ok" : "");
    });
    if (bElec) bElec.addEventListener("click", function () {
      const to = V.aim.elec > 0.5 ? 0 : 1;
      V.aim.elec = to;
      bElec.textContent = to ? "⇩ 装回电极" : "⇧ 拆下电极";
      log(to ? "R-08：φ10 电极片沿 2×φ6 定位销装入，重复定位 ≤0.1 mm" : "R-08：电极片取出", to ? "ok" : "");
    });
    if (bFault) bFault.addEventListener("click", function () {
      if (V.fault) return;
      V.fault = FAULTS[Math.floor(Math.random() * FAULTS.length)];
      V.faultT = 0;
      log("注入异常：" + V.fault.name + " → " + V.fault.target, "e");
    });
    if (bReset) bReset.addEventListener("click", function () {
      V.run = false; V.stepIdx = 0; V.stepT = 0; V.round = 0;
      V.fault = null; V.faultT = 0;
      V.aim.drawer = 0; V.aim.clamp = 0; V.aim.elec = 0;
      V.sel = null; V.selReq = null; V.hover = null;
      if (bRun) bRun.textContent = "▶ 启动演示";
      if (bDrawer) bDrawer.textContent = "⇥ 抽出层板";
      if (bClamp) bClamp.textContent = "⤒ 松开夹具";
      if (bElec) bElec.textContent = "⇧ 拆下电极";
      if (tagBox) tagBox.className = "tw-tag";
      setView("iso");
      renderList(); renderInfo();
      log("系统复位：抽屉 / 夹具 / 电极回位，演示状态清零");
    });

    root.querySelectorAll("[data-view]").forEach(function (b) {
      b.addEventListener("click", function () {
        root.querySelectorAll("[data-view]").forEach(function (x) { x.classList.remove("on"); });
        b.classList.add("on");
        setView(b.getAttribute("data-view"));
        log("切换视角：" + b.textContent);
      });
    });
    root.querySelectorAll("[data-tab]").forEach(function (b) {
      b.addEventListener("click", function () {
        root.querySelectorAll("[data-tab]").forEach(function (x) { x.classList.remove("on"); });
        b.classList.add("on");
        V.tab = b.getAttribute("data-tab");
        V.selReq = null;
        renderList();
      });
    });
    const qBox = root.querySelector("#twQ");
    if (qBox) qBox.addEventListener("input", function () { V.q = qBox.value || ""; renderList(); });

    // ---------- 渲染循环 ----------
    const dotEl = btn("twDot"), stEl = btn("twState"), stepEl = btn("twStep"),
      fpsEl = btn("twFps"), faceEl = btn("twFaces");

    const cam = V.cam, camTo = V.camTo;
    let last = 0, fps = 60, hudT = 0, alive = true;

    function frame(now) {
      if (!alive || A.state.page !== "twin") return;
      const dt = Math.min(0.05, ((now || 0) - last) / 1000 || 0.016);
      last = now || 0;
      fps = fps * 0.92 + (1 / Math.max(dt, 1e-3)) * 0.08;

      const k = Math.min(1, dt * 6);
      cam.theta += (camTo.theta - cam.theta) * k;
      cam.phi += (camTo.phi - cam.phi) * k;
      cam.dist += (camTo.dist - cam.dist) * k;
      for (let i = 0; i < 3; i++) cam.target[i] += (camTo.target[i] - cam.target[i]) * k;

      ["drawer", "clamp", "elec"].forEach(function (key) {
        V.anim[key] += (V.aim[key] - V.anim[key]) * Math.min(1, dt * 6);
      });

      if (V.run && !V.fault) {
        V.stepT += dt;
        if (V.stepT > 6.5) {
          V.stepT = 0;
          V.stepIdx = (V.stepIdx + 1) % STEPS.length;
          if (V.stepIdx === 0) { V.round++; log("完成第 " + V.round + " 轮实验，闭环优化器生成下一轮候选", "ok"); }
        }
      }
      if (V.fault) {
        V.faultT += dt;
        if (V.faultT > 4.5) {
          log("异常已自动恢复：" + V.fault.name + "（检查点续跑）", "w");
          V.fault = null; V.faultT = 0;
        }
      }

      const selPart = V.sel ? P.find(function (q) { return q.name === V.sel; }) : null;
      const res = M3.render(ctx, W, H, P, M3.createCamera(cam), {
        colors: SC.colors, time: (now || 0) / 1000, stateOf: stateOf,
        selected: V.sel, hovered: V.hover,
        set: V.selReq ? (bySpec[V.selReq] || []) : null,
        offsets: offsetsOf(),
        labelText: selPart ? (selPart.cn + " · " + selPart.spec) : null,
      });

      hudT += dt;
      if (hudT > 0.15) {
        hudT = 0;
        if (fpsEl) fpsEl.textContent = fps.toFixed(0);
        if (faceEl) faceEl.textContent = res.faces;
        if (stEl) stEl.textContent = V.fault ? "异常" : V.run ? "演示中" : "待机";
        if (dotEl) dotEl.className = "dot " + (V.fault ? "s-err" : V.run ? "s-run" : "s-idle");
        if (stepEl) stepEl.textContent = V.run ? STEPS[V.stepIdx].name : "—";
      }
      if (window.requestAnimationFrame) window.requestAnimationFrame(frame);
    }

    resize();
    if (window.addEventListener) {
      window.addEventListener("resize", function () {
        if (A.state.page === "twin") resize();
      });
    }
    renderList(); renderInfo();

    // 截图/演示用的 URL 参数：?tw=drawer|clamp|elec &view=fixture&sel=M-FIX-01-CLAMP
    try {
      const qs = new URLSearchParams(window.location.search || "");
      const tw = qs.get("tw");
      if (tw === "drawer" || tw === "open") { V.aim.drawer = 1; if (bDrawer) bDrawer.textContent = "⇤ 推回层板"; }
      if (tw === "clamp") { V.aim.clamp = 1; if (bClamp) bClamp.textContent = "⤓ 压紧夹具"; }
      if (tw === "elec") { V.aim.elec = 1; if (bElec) bElec.textContent = "⇩ 装回电极"; }
      const vw = qs.get("view");
      if (vw && VIEWS[vw]) {
        root.querySelectorAll("[data-view]").forEach(function (x) {
          x.classList.toggle("on", x.getAttribute("data-view") === vw);
        });
        setView(vw);
        V.cam.theta = V.camTo.theta; V.cam.phi = V.camTo.phi; V.cam.dist = V.camTo.dist;
      }
      const sl = qs.get("sel");
      if (sl && P.some(function (p) { return p.name === sl; })) selectPart(sl, false);
      if (qs.get("tab") === "reqs") {
        V.tab = "reqs";
        root.querySelectorAll("[data-tab]").forEach(function (x) {
          x.classList.toggle("on", x.getAttribute("data-tab") === "reqs");
        });
        renderList();
      }
    } catch (e) { /* file:// 下无参数时忽略 */ }

    log("数字孪生已加载：" + P.length + " 件零件 / " + Object.keys(bySpec).length + " 条需求可联动");
    log("试试点「⇥ 抽出层板」看三节滑轨，或点「夹具特写」看 R-08 快换夹头");

    if (window.requestAnimationFrame) window.requestAnimationFrame(frame);
  };
})(window.APP, window.DATA);
