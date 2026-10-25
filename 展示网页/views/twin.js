/* 视图 ②：数字孪生（3D 占位版）
 * 说明：3D 模型暂用等轴测线框占位；后续把 平台改造/3D数字孪生 下的
 *      engine3d.js / scene.js 复制进来，替换 drawPlaceholder() 即可。
 */
(function (A, D) {
  "use strict";
  const K = A.kit;

  // ---------- 等轴测占位绘制 ----------
  function drawPlaceholder(canvas, S) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const W = Math.max(320, Math.round(rect.width || 640));
    const H = Math.max(260, Math.round(rect.height || 460));
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // 背景网格（示意"设计视图"）
    ctx.save();
    ctx.strokeStyle = "rgba(56,189,248,.08)";
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 28) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 28) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.restore();

    // 等轴测投影：米 → 屏幕
    const s = Math.min(W, H) * 0.30;
    const ox = W / 2, oy = H * 0.80;
    const iso = (x, y, z) => [ox + (x - z) * 0.866 * s, oy + (x + z) * 0.5 * s - y * s];

    function line(a, b, color, width, dash) {
      const p1 = iso(a[0], a[1], a[2]), p2 = iso(b[0], b[1], b[2]);
      ctx.save();
      ctx.strokeStyle = color || "#4a7ba6";
      ctx.lineWidth = width || 1.6;
      if (dash) ctx.setLineDash(dash);
      ctx.beginPath(); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.stroke();
      ctx.restore();
    }
    function box(x0, y0, z0, x1, y1, z1, color, fill) {
      const c = [
        [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1],
        [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1],
      ].map(p => iso(p[0], p[1], p[2]));
      const faces = [
        [c[4], c[5], c[6], c[7]], // 顶
        [c[0], c[1], c[5], c[4]], // 前
        [c[1], c[2], c[6], c[5]], // 右
      ];
      if (fill) {
        faces.forEach((f, i) => {
          ctx.save();
          ctx.beginPath();
          f.forEach((p, k) => k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
          ctx.closePath();
          ctx.fillStyle = ["rgba(30,58,88,.9)", "rgba(20,42,68,.92)", "rgba(15,32,52,.92)"][i];
          ctx.fill();
          ctx.restore();
        });
      }
      ctx.strokeStyle = color || "#3f6b93";
      ctx.lineWidth = 1.5;
      const edges = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
      edges.forEach(e => {
        ctx.beginPath();
        ctx.moveTo(c[e[0]][0], c[e[0]][1]);
        ctx.lineTo(c[e[1]][0], c[e[1]][1]);
        ctx.stroke();
      });
    }

    // 机柜主体（宽 0.9 × 深 0.7 × 高 1.7，单位米）
    box(-0.45, 0, -0.35, 0.45, 1.7, 0.35, "#4a7ba6", true);
    // 层板
    [0.10, 0.50, 0.90, 1.24, 1.66].forEach(y => {
      const p = [iso(-0.42, y, -0.32), iso(0.42, y, -0.32), iso(0.42, y, 0.32), iso(-0.42, y, 0.32)];
      ctx.save();
      ctx.strokeStyle = "rgba(96,165,250,.45)"; ctx.lineWidth = 1.2;
      ctx.beginPath();
      p.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]));
      ctx.closePath(); ctx.stroke(); ctx.restore();
    });

    // 部件示意（按工序状态着色）
    const colorOf = name => {
      const st = A.sim.partStateOf(name);
      return st === "running" ? "#34d399" : st === "error" ? "#f87171" : st === "warn" ? "#fbbf24" : "#3f6488";
    };
    // 六路泵
    for (let i = 0; i < 6; i++) {
      const x = -0.34 + i * 0.135;
      box(x, 0.95, 0.02, x + 0.10, 1.06, 0.20, colorOf("M-PUMP-0" + (i + 1)), true);
    }
    // 反应烧杯
    for (let i = 0; i < 3; i++) {
      const x = -0.28 + i * 0.16;
      box(x, 0.52, 0.02, x + 0.12, 0.64, 0.18, colorOf("M-REACTOR-0" + (i + 1)), true);
    }
    // 储液瓶 / 废液桶
    box(-0.30, 0.12, 0.00, -0.14, 0.34, 0.18, colorOf("M-BOTTLE-01"), true);
    box(0.16, 0.12, 0.00, 0.36, 0.36, 0.20, colorOf("M-WASTE-01"), true);
    // 工作站 / 工控机
    box(-0.32, 1.28, -0.10, 0.02, 1.46, 0.24, colorOf("M-EWS-01"), true);
    // 排风罩
    box(-0.26, 1.70, -0.20, 0.26, 1.80, 0.20, colorOf("M-EXH-01"), true);

    // 占位水印
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(-0.22);
    ctx.textAlign = "center";
    ctx.font = "600 26px 'Microsoft YaHei',sans-serif";
    ctx.fillStyle = "rgba(120,200,230,.14)";
    ctx.fillText("3D 模型占位", 0, 0);
    ctx.font = "12.5px 'Microsoft YaHei',sans-serif";
    ctx.fillStyle = "rgba(120,200,230,.22)";
    ctx.fillText("待接入 engine3d.js / scene.js（与 CAD 一致的机柜模型）", 0, 24);
    ctx.restore();

    // 底部说明
    ctx.save();
    ctx.fillStyle = "#7f9ab5";
    ctx.font = "11.5px 'Microsoft YaHei',sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("等轴测线框占位 · 当前工序：" + A.sim.currentStep().name, 12, H - 12);
    ctx.restore();
  }

  A.views.twin = function (root) {
    const S = A.state;
    root.innerHTML =
      K.pagehead("◈", "数字孪生", "TWIN · 3D 部件状态（低模占位，待接入真实模型）", "monitor", "运行监控") +
      '<div class="twin-wrap">' +
      '<div class="twin-canvas"><canvas id="twinCv"></canvas>' +
      '<div class="twin-badge">占位图 · 3D 模型待接入</div></div>' +
      "<div>" +
      K.card("部件状态", K.rows(D.PARTS.map(p => ({
        name: p.cn + " · " + p.name,
        state: A.sim.partStateOf(p.name),
        right: (A.sim.partParamsOf(p.name).flow || A.sim.partParamsOf(p.name).level ||
          A.sim.partParamsOf(p.name).temp || A.sim.partParamsOf(p.name).tech || "—"),
      })))) +
      K.card("接入说明",
        '<div class="muted" style="line-height:1.7">' +
        "1. 把 <span class='chip'>平台改造/3D数字孪生/</span> 下的 <span class='chip'>engine3d.js</span>、" +
        "<span class='chip'>scene.js</span> 复制到本目录<br>" +
        "2. 把本页的 <span class='chip'>drawPlaceholder()</span> 换成 3D 引擎渲染<br>" +
        "3. 部件着色沿用 <span class='chip'>A.sim.partStateOf(name)</span>，命名与规格书一致（M-PUMP-01…R-07）" +
        "</div>", "待接入") +
      "</div></div>";
    drawPlaceholder(root.querySelector("#twinCv"), S);
  };
})(window.APP, window.DATA);
