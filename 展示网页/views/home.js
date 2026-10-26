/* 视图（第 1 层）：首页 Hero（v0.4 深色 premium 科技风）
 * 左侧：三行渐隐标题 + 副标题 + 两个按钮 + 数据条
 * 右侧：四块等轴测玻璃数据板（Canvas 自绘）+ 两张玻璃卡
 * 底部：技术栈 logo 行
 * 诚实边界：所有数字来自 assets/data.js 的模拟数据，非真实实验结果。
 */
(function (A, D) {
  "use strict";

  const REDUCE = (function () {
    try { return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); }
    catch (e) { return false; }
  })();

  // 调试/截图开关：index.html?noanim  → 直接显示静止终态
  const NOANIM = (function () {
    try { return /[?&]noanim/.test(String(window.location.search || "")); }
    catch (e) { return false; }
  })();

  let artRaf = 0;
  let viewRoot = null;

  function stopArt() {
    if (artRaf && window.cancelAnimationFrame) window.cancelAnimationFrame(artRaf);
    artRaf = 0;
  }

  // ============================================================
  // 一、画布缩放：设计画布 1980 × 1080，按内容区尺寸等比缩放
  // ============================================================
  function fitUnit(root) {
    const hv = root && root.querySelector ? root.querySelector(".hv") : null;
    if (!hv) return;
    const w = root.clientWidth || (window.innerWidth || 1440);
    const h = root.clientHeight || (window.innerHeight ? window.innerHeight - 128 : 772);
    if (!(w > 0 && h > 0)) return;
    const u = Math.min(w / 1980, h / 1080);
    if (hv.style && hv.style.setProperty) hv.style.setProperty("--u", u.toFixed(4) + "px");
  }

  if (window.addEventListener) {
    window.addEventListener("resize", function () {
      if (viewRoot && document.body && document.body.contains(viewRoot)) fitUnit(viewRoot);
    });
  }

  // ============================================================
  // 二、插画：四块等轴测玻璃数据板
  // ============================================================
  function startArt(mount) {
    const cv = mount.querySelector("canvas");
    const ctx = cv && cv.getContext ? cv.getContext("2d") : null;
    if (!ctx) return;

    const COS = Math.cos(Math.PI / 6), SIN = 0.5;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 1, H = 1, S = 1, cx = 0, cy = 0;

    function measure() {
      const r = mount.getBoundingClientRect ? mount.getBoundingClientRect() : { width: 800, height: 800 };
      W = Math.max(300, Math.round(r.width || 800));
      H = Math.max(300, Math.round(r.height || 800));
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      if (ctx.setTransform) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      S = Math.min(W, H) * 0.235;     // 菱形半高
      cx = W * 0.5;
      cy = H * 0.5;
    }
    measure();

    function pr(u, v, z, x0, y0) {
      return [x0 + (u - v) * COS * S, y0 + (u + v) * SIN * S - z * S];
    }
    // 等轴测：把 (u,v) 平面上的「正方形」四角投影后就是顶面的菱形
    function diamond(x0, y0, z, k) {
      const kk = k == null ? 1 : k;
      return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(function (p) {
        return pr(p[0] * kk, p[1] * kk, z, x0, y0);
      });
    }
    function pathOf(pts) {
      ctx.beginPath();
      pts.forEach(function (p, i) { i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); });
      ctx.closePath();
    }
    function hash(a, b, c) {
      let h = (a * 374761393 + b * 668265263 + c * 2246822519) >>> 0;
      h = ((h ^ (h >>> 13)) * 1274126177) >>> 0;
      return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    }
    function dot(x, y, r, color) {
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.fill();
    }

    // ---- 一块玻璃板 ----
    function slab(t, cfg) {
      const bob = Math.sin(t * 0.5 + cfg.ph) * 0.02 * S;
      const x0 = cx + cfg.dx * W + Math.cos(t * 0.36 + cfg.ph) * 0.006 * S;
      const y0 = cy + cfg.dy * H + bob;
      const z = 0;
      const k = cfg.k;
      const th = 0.05;
      const top = diamond(x0, y0, z, k);
      const bot = diamond(x0, y0, z - th, k);

      // 厚度侧面
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4;
        ctx.beginPath();
        ctx.moveTo(top[i][0], top[i][1]);
        ctx.lineTo(top[j][0], top[j][1]);
        ctx.lineTo(bot[j][0], bot[j][1]);
        ctx.lineTo(bot[i][0], bot[i][1]);
        ctx.closePath();
        ctx.fillStyle = "rgba(8,7,13,.5)";
        ctx.fill();
        ctx.strokeStyle = "rgba(159,240,236,.14)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // 顶面
      pathOf(top);
      let g = null;
      if (ctx.createLinearGradient) {
        g = ctx.createLinearGradient(top[2][0], top[2][1], top[0][0], top[0][1]);
        if (g && g.addColorStop) { g.addColorStop(0, cfg.a); g.addColorStop(1, cfg.b); }
      }
      ctx.save();
      ctx.globalAlpha = cfg.o;
      ctx.fillStyle = (g && g.addColorStop) ? g : cfg.a;
      ctx.fill();
      ctx.restore();

      // 顶面描边 + 发光
      ctx.save();
      ctx.shadowColor = cfg.glow || cfg.b;
      ctx.shadowBlur = 14;
      ctx.strokeStyle = "rgba(255,255,255,.42)";
      ctx.lineWidth = 1.1;
      pathOf(top);
      ctx.stroke();
      ctx.restore();

      return { x0: x0, y0: y0, z: z, top: top, k: k };
    }

    // 内容通用：裁剪到顶面
    function clipped(sl, fn) {
      ctx.save();
      pathOf(sl.top);
      ctx.clip();
      fn();
      ctx.restore();
    }

    // ① 数据点网格 + 流动粒子
    function cPoints(t, sl) {
      clipped(sl, function () {
        const k = sl.k;
        for (let i = -3; i <= 3; i++) {
          for (let j = -3; j <= 3; j++) {
            const u = i / 3.6, v = j / 3.6;
            if (Math.max(Math.abs(u), Math.abs(v)) > 0.95) continue;
            const p = pr(u * k, v * k, sl.z + 0.005, sl.x0, sl.y0);
            dot(p[0], p[1], 1.1, "rgba(200,255,250,.35)");
          }
        }
        dot(pr(0, 0, sl.z + 0.005, sl.x0, sl.y0)[0], pr(0, 0, sl.z + 0.005, sl.x0, sl.y0)[1], 2.2, "rgba(210,255,252,.75)");
        // 流动粒子
        for (let r = -1; r <= 1; r++) {
          const v = r * 0.55;
          const flow = (t * 0.12 + r * 0.31) % 1;
          for (let q = 0; q < 4; q++) {
            const u = -0.9 + ((q / 4 + flow) % 1) * 1.8;
            if (Math.max(Math.abs(u), Math.abs(v)) > 0.92) continue;
            const p = pr(u * k, v * k, sl.z + 0.01, sl.x0, sl.y0);
            const a = 0.35 + 0.45 * Math.abs(Math.sin(t * 1.6 + q + r));
            dot(p[0], p[1], 1.5, "rgba(205,255,250," + a.toFixed(2) + ")");
          }
        }
      });
    }

    // ② 流动光波
    function cWaves(t, sl) {
      clipped(sl, function () {
        const k = sl.k;
        for (let r = 0; r < 3; r++) {
          const v = -0.5 + r * 0.5;
          ctx.beginPath();
          for (let i = 0; i <= 44; i++) {
            const u = -0.95 + (i / 44) * 1.9;
            const zz = sl.z + 0.02 + Math.sin(u * 3.4 + t * 1.6 + r) * 0.05;
            const p = pr(u * k, v * k, zz, sl.x0, sl.y0);
            i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]);
          }
          ctx.strokeStyle = "rgba(175,248,242," + (0.5 - r * 0.08).toFixed(2) + ")";
          ctx.lineWidth = 1.1;
          ctx.stroke();
        }
      });
    }

    // ③ 像素块闪烁
    function cPixels(t, sl) {
      clipped(sl, function () {
        const k = sl.k;
        for (let i = -3; i <= 3; i++) {
          for (let j = -3; j <= 3; j++) {
            const u = i / 3.6, v = j / 3.6;
            if (Math.max(Math.abs(u), Math.abs(v)) > 0.9) continue;
            const n = hash(i, j, Math.floor(t * 2.2));
            if (n < 0.28) continue;
            const sz = 0.035 + n * 0.03;
            const pts = [[u + sz, v], [u, v + sz], [u - sz, v], [u, v - sz]].map(function (p) {
              return pr(p[0] * k, p[1] * k, sl.z + 0.01, sl.x0, sl.y0);
            });
            pathOf(pts);
            ctx.fillStyle = n > 0.7
              ? "rgba(159,240,236," + (0.1 + n * 0.26).toFixed(2) + ")"
              : "rgba(109,90,220," + (0.08 + n * 0.22).toFixed(2) + ")";
            ctx.fill();
          }
        }
      });
    }

    // ④ 紫色雾
    function cHaze(t, sl) {
      clipped(sl, function () {
        if (!ctx.createRadialGradient) return;
        const g = ctx.createRadialGradient(sl.x0, sl.y0, 4, sl.x0, sl.y0, S * 0.9);
        if (!g || !g.addColorStop) return;
        g.addColorStop(0, "rgba(140,110,255,.28)");
        g.addColorStop(1, "rgba(77,25,177,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(sl.x0, sl.y0, S * 0.9, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // 背景光 + 微粒
    function backdrop(t) {
      if (ctx.createRadialGradient) {
        const g = ctx.createRadialGradient(cx, cy, 10, cx, cy, Math.max(W, H) * 0.55);
        if (g && g.addColorStop) {
          g.addColorStop(0, "rgba(109,90,220,.16)");
          g.addColorStop(0.55, "rgba(77,25,177,.07)");
          g.addColorStop(1, "rgba(13,12,17,0)");
          ctx.save();
          if ("globalCompositeOperation" in ctx) ctx.globalCompositeOperation = "lighter";
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(cx, cy, Math.max(W, H) * 0.55, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
      for (let i = 0; i < 14; i++) {
        const seed = hash(i, 7, 3);
        const x = (seed * W + t * (5 + seed * 8)) % (W + 40) - 20;
        const y = (hash(i, 11, 5) * H + Math.sin(t * 0.4 + i) * 6 + H) % H;
        const a = 0.08 + 0.16 * Math.abs(Math.sin(t * 0.6 + i));
        dot(x, y, 0.8 + seed * 0.7, "rgba(159,240,236," + a.toFixed(3) + ")");
      }
    }

    // 四块板：由下到上，越上面越小、越往上
    const LEVELS = [
      { dy: 0.160, dx: -0.055, k: 1.00, ph: 0.0, o: 0.52, a: "rgba(77,25,177,.42)", b: "rgba(109,90,220,.22)", content: cHaze },
      { dy: 0.042, dx: -0.019, k: 0.93, ph: 0.6, o: 0.48, a: "rgba(96,120,225,.34)", b: "rgba(120,180,240,.20)", content: cPixels },
      { dy: -0.078, dx: 0.019, k: 0.86, ph: 1.2, o: 0.46, a: "rgba(120,205,240,.24)", b: "rgba(170,245,240,.20)", content: cWaves },
      { dy: -0.196, dx: 0.055, k: 0.79, ph: 1.8, o: 0.44, a: "rgba(150,235,235,.24)", b: "rgba(215,255,252,.14)", content: cPoints },
    ];

    function drawAt(t) {
      if (!ctx.clearRect) return;
      ctx.clearRect(0, 0, W, H);
      backdrop(t);
      LEVELS.forEach(function (cfg) {
        const sl = slab(t, cfg);
        cfg.content(t, sl);
      });
    }

    if (REDUCE || NOANIM || !window.requestAnimationFrame) {
      drawAt(2.4);
      return;
    }

    const t0 = (window.performance && window.performance.now) ? window.performance.now() : Date.now();
    function frame(ts) {
      if (A.state.page !== "home") { artRaf = 0; return; }
      drawAt(((ts || Date.now()) - t0) / 1000);
      artRaf = window.requestAnimationFrame(frame);
    }
    artRaf = window.requestAnimationFrame(frame);

    if (window.addEventListener) {
      window.addEventListener("resize", function () {
        if (!document.body || !document.body.contains(mount)) return;
        measure();
      });
    }
  }

  // ============================================================
  // 三、视图
  // ============================================================
  const ICON_NET =
    '<svg viewBox="0 0 32 32" fill="none" stroke="#9ff0ec" stroke-width="1.5" stroke-linecap="round">' +
    '<path d="M8 9.5 16 5l8 4.5v9L16 23l-8-4.5z" opacity=".4"/>' +
    '<circle cx="16" cy="5" r="2.3"/><circle cx="24" cy="9.5" r="2.3"/><circle cx="24" cy="18.5" r="2.3"/>' +
    '<circle cx="16" cy="23" r="2.3"/><circle cx="8" cy="18.5" r="2.3"/><circle cx="8" cy="9.5" r="2.3"/>' +
    '<circle cx="16" cy="14" r="2" fill="#9ff0ec" stroke="none"/>' +
    '<path d="M16 7.3v4.7M21.9 10.8 18 12.8M21.9 17.3 18 15.3M16 20.7v-4.7M10.1 17.3 14 15.3M10.1 10.8 14 12.8" opacity=".85"/></svg>';

  const ICON_FORT =
    '<svg viewBox="0 0 32 32" fill="none" stroke="#9ff0ec" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M16 4 5.5 8.5v8.2C5.5 23.4 10 27.4 16 28.6c6-1.2 10.5-5.2 10.5-11.9V8.5z" opacity=".45"/>' +
    '<path d="M16 7.6 8.8 10.7v6c0 4.9 3.1 8 7.2 8.9 4.1-.9 7.2-4 7.2-8.9v-6z"/>' +
    '<rect x="12.6" y="13.4" width="6.8" height="5.6" rx="1.4"/>' +
    '<path d="M14.2 13.4v-1.5a1.8 1.8 0 0 1 3.6 0v1.5"/>' +
    '<circle cx="16" cy="16" r=".85" fill="#9ff0ec" stroke="none"/></svg>';

  A.views.home = function (root) {
    viewRoot = root;
    stopArt();

    const rounds = D.ROUNDS.length;
    const parts = D.PARTS.length;
    const still = REDUCE || NOANIM;

    root.innerHTML =
      '<section class="hv' + (still ? " hv-nomotion" : "") + '">' +
      '<div class="hv-canvas">' +

      // ---------- 左栏 ----------
      '<div class="hv-copy">' +
      '<span class="hv-eyebrow" style="--d:.08s"><i></i>演示数据 · 模拟运行</span>' +
      '<h1 class="hv-h1">' +
      '<span class="hv-linewrap"><span class="hv-line" style="--d:.16s">让每一次实验</span></span>' +
      '<span class="hv-linewrap"><span class="hv-line" style="--d:.28s">都建立在可查</span></span>' +
      '<span class="hv-linewrap"><span class="hv-line" style="--d:.40s">的数据之上。</span></span>' +
      "</h1>" +
      '<p class="hv-sub" style="--d:.62s">平台把已验证的实验数据、电化学表征与审计记录逐层叠起来，' +
      "供催化研发团队、检测机构与产线运维共用同一份事实。</p>" +
      '<div class="hv-btns">' +
      '<button class="hv-btn hv-btn--primary" id="hvStart" style="--d:.74s">▶ 启动模拟运行</button>' +
      '<button class="hv-btn hv-btn--glass" data-go="monitor" style="--d:.84s">进入运行监控</button>' +
      "</div>" +
      '<div class="hv-stats">' +
      '<div class="hv-stat" style="--d:.96s"><b>' + rounds + "</b><span>轮闭环寻优</span></div>" +
      '<div class="hv-stat" style="--d:1.05s"><b>' + parts + "</b><span>台部件在监控</span></div>" +
      '<div class="hv-stat" style="--d:1.14s"><b>5</b><span>类故障剧本</span></div>' +
      "</div>" +
      "</div>" +

      // ---------- 右侧艺术区 + 玻璃卡 ----------
      '<div class="hv-stage">' +
      '<div class="hv-art"><canvas id="hvArt"></canvas></div>' +

      '<div class="hv-card hv-card--a" style="--d:1.18s">' +
      '<div class="ic">' + ICON_NET + "</div>" +
      '<div class="hv-kicker">Benchmarking · 基准评估</div>' +
      '<div class="hv-title">双基准判定：LSV 与 Tafel<br>每轮结论自动归档。</div>' +
      "</div>" +

      '<div class="hv-card hv-card--b" style="--d:1.32s">' +
      '<div class="ic">' + ICON_FORT + "</div>" +
      '<div class="hv-kicker">Red-team · 红队注入</div>' +
      '<div class="hv-title">5 类故障剧本<br>挂起 · 处置 · 续跑留痕。</div>' +
      "</div>" +
      "</div>" +

      // ---------- 底部 ----------
      '<div class="hv-logos">' +
      '<span class="hv-logo hv-logo--bi" style="--d:1.50s">Ni–Mo</span>' +
      '<span class="hv-logo hv-logo--bi" style="--d:1.57s">GP–EI</span>' +
      '<span class="hv-logo hv-logo--wide" style="--d:1.64s">digital twin</span>' +
      '<span class="hv-logo hv-logo--caps" style="--d:1.71s">MODBUS · SCPI</span>' +
      "</div>" +
      '<div class="hv-foot" style="--d:1.72s"><b>DEMO</b> · 界面数据为模拟生成，非真实实验结果</div>' +

      "</div></section>";

    fitUnit(root);

    // 画布尺寸需等布局完成后再量
    const raf = window.requestAnimationFrame;
    if (raf) {
      raf(function () { if (A.state.page === "home") startArt(root.querySelector(".hv-art")); });
    } else {
      startArt(root.querySelector(".hv-art"));
    }

    // 兜底：若动画时钟未推进（部分无头/低配环境），2.2s 后强制显示终态
    if (!still) {
      setTimeout(function () {
        if (A.state.page !== "home" || !document.body.contains(root)) return;
        const probe = root.querySelector(".hv-card--a");
        if (!probe) return;
        const op = window.getComputedStyle ? parseFloat(window.getComputedStyle(probe).opacity) : 1;
        if (!(op > 0.5)) {
          const sec = root.querySelector(".hv");
          if (sec && sec.classList) sec.classList.add("hv-nomotion");
        }
      }, 2200);
    }

    // 主按钮：启动模拟并进入驾驶舱
    const btn = root.querySelector("#hvStart");
    if (btn) {
      btn.addEventListener("click", function () {
        const was = A.state.running;
        A.sim.toggle();
        if (!was) A.go("monitor/dashboard");
        else A.render();
      });
    }
  };
})(window.APP, window.DATA);
