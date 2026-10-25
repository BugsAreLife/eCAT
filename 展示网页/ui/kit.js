/* UI 组件（字符串模板）+ 自绘图表（Canvas 2D，无第三方库） */
window.APP = window.APP || {};

(function (A) {
  "use strict";

  const K = {};

  // ============================================================
  // 一、基础组件（返回 HTML 字符串）
  // ============================================================
  K.esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  };

  K.badge = function (state, text) {
    const map = { idle: "b-idle", running: "b-run", run: "b-run", warn: "b-warn", error: "b-err", err: "b-err", info: "b-info", done: "b-run", failed: "b-err" };
    return '<span class="badge ' + (map[state] || "b-idle") + '">' + K.esc(text || state) + "</span>";
  };

  K.card = function (title, body, tag) {
    return '<div class="card"><h3>' + K.esc(title) + (tag ? '<span class="tag">' + K.esc(tag) + "</span>" : "") + "</h3>" + body + "</div>";
  };

  K.stat = function (label, value, unit, delta, dir) {
    return '<div class="card stat"><div class="k">' + K.esc(label) + "</div>" +
      '<div class="v">' + K.esc(value) + (unit ? "<small>" + K.esc(unit) + "</small>" : "") + "</div>" +
      '<div class="d ' + (dir || "") + '">' + K.esc(delta || "&nbsp;") + "</div></div>";
  };

  K.pbar = function (pct) {
    return '<div class="pbar"><i style="width:' + Math.max(0, Math.min(100, pct)).toFixed(1) + '%"></i></div>';
  };

  K.timeline = function (steps, curIdx, stepT) {
    let html = '<div class="tl">';
    steps.forEach((s, i) => {
      const cls = i < curIdx ? "done" : i === curIdx ? "cur" : "";
      const p = i < curIdx ? 100 : i === curIdx ? Math.min(100, (stepT / s.dur) * 100) : 0;
      html += '<div class="seg ' + cls + '" style="--w:' + s.dur + '"><div>' + K.esc(s.name) + "</div>" +
        '<div class="bar"><i style="width:' + p + '%"></i></div></div>';
    });
    return html + "</div>";
  };

  K.table = function (headers, rows, opts) {
    opts = opts || {};
    let h = "<table><thead><tr>";
    headers.forEach(x => {
      const isNum = typeof x === "object" ? x.num : false;
      h += "<th" + (isNum ? ' class="num"' : "") + ">" + K.esc(typeof x === "object" ? x.label : x) + "</th>";
    });
    h += "</tr></thead><tbody>";
    rows.forEach(r => {
      h += "<tr" + (r.attrs || "") + ">";
      (r.cells || r).forEach((c, i) => {
        const isNum = typeof headers[i] === "object" && headers[i].num;
        h += "<td" + (isNum ? ' class="num"' : "") + ">" + c + "</td>";
      });
      h += "</tr>";
    });
    return h + "</tbody></table>";
  };

  K.rows = function (items) {
    return items.map(it =>
      '<div class="row"><span class="dot s-' + (it.state || "idle") + '"></span>' +
      '<span class="nm">' + K.esc(it.name) + "</span>" +
      '<span class="st">' + K.esc(it.right || "") + "</span></div>"
    ).join("");
  };

  K.kv = function (k, v) {
    return '<div class="kv"><span>' + K.esc(k) + "</span><span>" + v + "</span></div>";
  };

  // ============================================================
  // 二、图表（Canvas 自绘）
  // ============================================================
  function setup(canvas) {
    if (!canvas) return null;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : { width: 0, height: 0 };
    const W = Math.max(240, Math.round(rect.width || canvas.parentNode && canvas.parentNode.clientWidth || 480));
    const H = Math.max(140, Math.round(rect.height || 220));
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    return { ctx, W, H };
  }

  function axes(ctx, W, H, pad, xlim, ylim, opts) {
    ctx.save();
    ctx.strokeStyle = "#e6ecf3";
    ctx.lineWidth = 1;
    ctx.fillStyle = "#8494a8";
    ctx.font = "11px 'Microsoft YaHei',sans-serif";
    // 横向网格 + y 轴刻度
    const ny = 4;
    for (let i = 0; i <= ny; i++) {
      const y = pad.t + (H - pad.t - pad.b) * (i / ny);
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
      const val = ylim[1] - (ylim[1] - ylim[0]) * (i / ny);
      ctx.textAlign = "right"; ctx.textBaseline = "middle";
      ctx.fillText(opts.yFmt ? opts.yFmt(val) : val.toFixed(0), pad.l - 6, y);
    }
    // x 轴刻度（opts.xTicks 可指定整数刻度，避免等分落在小数轮次上）
    const ticks = opts.xTicks && opts.xTicks.length ? opts.xTicks : null;
    const n = ticks ? ticks.length : 6;
    for (let i = 0; i < n; i++) {
      let val, x;
      if (ticks) {
        val = ticks[i];
        x = pad.l + (W - pad.l - pad.r) * ((val - xlim[0]) / ((xlim[1] - xlim[0]) || 1));
      } else {
        val = xlim[0] + (xlim[1] - xlim[0]) * (i / 5);
        x = pad.l + (W - pad.l - pad.r) * (i / 5);
      }
      ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, H - pad.b); ctx.stroke();
      ctx.textAlign = i === 0 ? "left" : i === n - 1 ? "right" : "center";
      ctx.textBaseline = "top";
      ctx.fillText(opts.xFmt ? opts.xFmt(val) : val.toFixed(0), x, H - pad.b + 5);
    }
    // 轴标签
    if (opts.xLabel) {
      ctx.textAlign = "right"; ctx.textBaseline = "bottom";
      ctx.fillStyle = "#6b7787";
      ctx.fillText(opts.xLabel, W - pad.r, H - 2);
    }
    if (opts.yLabel) {
      ctx.save();
      ctx.translate(11, pad.t + 6);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = "right"; ctx.textBaseline = "top";
      ctx.fillStyle = "#6b7787";
      ctx.fillText(opts.yLabel, 0, 0);
      ctx.restore();
    }
    ctx.restore();
  }

  function toXY(pad, W, H, xlim, ylim, x, y) {
    const px = pad.l + (W - pad.l - pad.r) * ((x - xlim[0]) / (xlim[1] - xlim[0] || 1));
    const py = H - pad.b - (H - pad.t - pad.b) * ((y - ylim[0]) / (ylim[1] - ylim[0] || 1));
    return [px, py];
  }

  /** 折线图 series:[{name,color,pts:[[x,y]],dash}] */
  K.lineChart = function (canvas, series, opts) {
    opts = opts || {};
    const s = setup(canvas); if (!s) return;
    const { ctx, W, H } = s;
    const pad = { l: 46, r: 12, t: 12, b: 26 };
    let xs = [], ys = [];
    series.forEach(se => se.pts.forEach(p => { xs.push(p[0]); ys.push(p[1]); }));
    const xlim = opts.xlim || [Math.min.apply(null, xs), Math.max.apply(null, xs)];
    const ylim = opts.ylim || [Math.min.apply(null, ys), Math.max.apply(null, ys)];
    axes(ctx, W, H, pad, xlim, ylim, opts);
    series.forEach(se => {
      ctx.save();
      ctx.strokeStyle = se.color || "#0b5cad";
      ctx.lineWidth = se.width || 2;
      if (se.dash) ctx.setLineDash([5, 4]);
      ctx.beginPath();
      se.pts.forEach((p, i) => {
        const xy = toXY(pad, W, H, xlim, ylim, p[0], p[1]);
        i ? ctx.lineTo(xy[0], xy[1]) : ctx.moveTo(xy[0], xy[1]);
      });
      ctx.stroke();
      if (opts.marker) {
        ctx.fillStyle = se.color || "#0b5cad";
        se.pts.forEach(p => {
          const xy = toXY(pad, W, H, xlim, ylim, p[0], p[1]);
          ctx.beginPath(); ctx.arc(xy[0], xy[1], 2.2, 0, Math.PI * 2); ctx.fill();
        });
      }
      ctx.restore();
    });
    // 图例
    let lx = pad.l + 4, ly = pad.t + 4;
    ctx.font = "11px 'Microsoft YaHei',sans-serif";
    series.forEach(se => {
      if (!se.name) return;
      ctx.fillStyle = se.color || "#0b5cad";
      ctx.fillRect(lx, ly + 3, 12, 3);
      ctx.fillStyle = "#5a6b80";
      ctx.textAlign = "left"; ctx.textBaseline = "top";
      ctx.fillText(se.name, lx + 17, ly);
      lx += 24 + ctx.measureText(se.name).width;
    });
  };

  /** 散点图 groups:[{name,color,pts:[[x,y]],r}] */
  K.scatterChart = function (canvas, groups, opts) {
    opts = opts || {};
    const s = setup(canvas); if (!s) return;
    const { ctx, W, H } = s;
    const pad = { l: 46, r: 12, t: 12, b: 26 };
    let xs = [], ys = [];
    groups.forEach(g => g.pts.forEach(p => { xs.push(p[0]); ys.push(p[1]); }));
    const xlim = opts.xlim || [Math.min.apply(null, xs) * 0.9, Math.max.apply(null, xs) * 1.05];
    const ylim = opts.ylim || [Math.min.apply(null, ys) * 0.9, Math.max.apply(null, ys) * 1.08];
    axes(ctx, W, H, pad, xlim, ylim, opts);
    groups.forEach(g => {
      g.pts.forEach((p, i) => {
        const xy = toXY(pad, W, H, xlim, ylim, p[0], p[1]);
        ctx.beginPath();
        ctx.fillStyle = (g.colors && g.colors[i]) || g.color || "#0b5cad";
        ctx.arc(xy[0], xy[1], g.r || 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.lineWidth = 1; ctx.stroke();
        if (g.labels && g.labels[i]) {
          ctx.fillStyle = "#5a6b80"; ctx.font = "10.5px 'Microsoft YaHei',sans-serif";
          ctx.textAlign = "left"; ctx.textBaseline = "bottom";
          ctx.fillText(g.labels[i], xy[0] + 6, xy[1] - 3);
        }
      });
    });
    // 帕累托前沿（可选折线）
    if (opts.frontier) {
      ctx.save();
      ctx.strokeStyle = "#e39a12"; ctx.lineWidth = 1.6; ctx.setLineDash([6, 4]);
      ctx.beginPath();
      opts.frontier.forEach((p, i) => {
        const xy = toXY(pad, W, H, xlim, ylim, p[0], p[1]);
        i ? ctx.lineTo(xy[0], xy[1]) : ctx.moveTo(xy[0], xy[1]);
      });
      ctx.stroke(); ctx.restore();
    }
    let lx = pad.l + 4, ly = pad.t + 2;
    ctx.font = "11px 'Microsoft YaHei',sans-serif";
    groups.forEach(g => {
      if (!g.name) return;
      ctx.fillStyle = g.color || "#0b5cad";
      ctx.beginPath(); ctx.arc(lx + 5, ly + 6, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#5a6b80"; ctx.textAlign = "left"; ctx.textBaseline = "top";
      ctx.fillText(g.name, lx + 14, ly);
      lx += 20 + ctx.measureText(g.name).width;
    });
  };

  /** 迷你趋势线 */
  K.spark = function (canvas, pts, color) {
    const s = setup(canvas); if (!s) return;
    const { ctx, W, H } = s;
    if (!pts.length) return;
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
    const y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    ctx.beginPath();
    pts.forEach((p, i) => {
      const x = 4 + (W - 8) * ((p[0] - x0) / (x1 - x0 || 1));
      const y = H - 4 - (H - 8) * ((p[1] - y0) / ((y1 - y0) || 1));
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.strokeStyle = color || "#0b5cad";
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.lineTo(W - 4, H); ctx.lineTo(4, H); ctx.closePath();
    ctx.fillStyle = (color || "#0b5cad") + "18";
    ctx.fill();
  };

  /** 工序甘特（单轮） */
  K.gantt = function (canvas, steps, curIdx, stepT) {
    const s = setup(canvas); if (!s) return;
    const { ctx, W, H } = s;
    const pad = { l: 92, r: 12, t: 8, b: 8 };
    const total = steps.reduce((a, x) => a + x.dur, 0);
    const rowH = (H - pad.t - pad.b) / steps.length;
    let acc = 0;
    ctx.font = "11.5px 'Microsoft YaHei',sans-serif";
    steps.forEach((st, i) => {
      const y = pad.t + i * rowH;
      ctx.fillStyle = "#5a6b80"; ctx.textAlign = "right"; ctx.textBaseline = "middle";
      ctx.fillText(st.name, pad.l - 8, y + rowH / 2);
      ctx.fillStyle = "#f0f4f9";
      ctx.fillRect(pad.l, y + rowH * 0.22, W - pad.l - pad.r, rowH * 0.56);
      obj(st, i);
      acc += st.dur;
    });
    function obj(st, i) {
      const y = pad.t + i * rowH;
      let x = pad.l, w;
      let prev = 0;
      for (let k = 0; k < i; k++) prev += steps[k].dur;
      x = pad.l + (W - pad.l - pad.r) * (prev / total);
      w = (W - pad.l - pad.r) * (st.dur / total);
      const done = i < curIdx, cur = i === curIdx;
      ctx.fillStyle = done ? "#9fd3b4" : cur ? "#0b5cad" : "#dbe4ee";
      ctx.beginPath();
      const r = 4, yy = y + rowH * 0.22, hh = rowH * 0.56;
      ctx.moveTo(x + r, yy); ctx.lineTo(x + w - r, yy);
      ctx.quadraticCurveTo(x + w, yy, x + w, yy + r);
      ctx.lineTo(x + w, yy + hh - r); ctx.quadraticCurveTo(x + w, yy + hh, x + w - r, yy + hh);
      ctx.lineTo(x + r, yy + hh); ctx.quadraticCurveTo(x, yy + hh, x, yy + hh - r);
      ctx.lineTo(x, yy + r); ctx.quadraticCurveTo(x, yy, x + r, yy);
      ctx.fill();
      if (cur) {
        const p = Math.min(1, stepT / st.dur);
        ctx.fillStyle = "rgba(255,255,255,.35)";
        ctx.fillRect(x, yy, w * p, hh);
      }
      ctx.fillStyle = "#fff"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
      ctx.font = "10.5px 'Microsoft YaHei',sans-serif";
      if (w > 40) ctx.fillText(st.dur.toFixed(0) + " s", x + 6, yy + hh / 2);
      ctx.font = "11.5px 'Microsoft YaHei',sans-serif";
    }
  };

  /** DAG（任务中心用）：nodes:[{id,x,y,label,state}] edges:[[from,to]] */
  K.dag = function (canvas, nodes, edges) {
    const s = setup(canvas); if (!s) return;
    const { ctx, W, H } = s;
    ctx.font = "11.5px 'Microsoft YaHei',sans-serif";
    const byId = {};
    nodes.forEach(n => {
      byId[n.id] = n;
      const bw = 92, bh = 30;
      const x = n.x * (W - bw - 20) + 10, y = n.y * (H - bh - 16) + 8;
      n._x = x + bw / 2; n._y = y + bh / 2; n._w = bw; n._h = bh; n._lx = x; n._ly = y;
    });
    edges.forEach(e => {
      const a = byId[e[0]], b = byId[e[1]];
      if (!a || !b) return;
      ctx.strokeStyle = "#c3ccd8"; ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(a._x + a._w / 2, a._y);
      ctx.lineTo(b._x - b._w / 2 - 3, b._y);
      ctx.stroke();
      // 箭头
      const ang = Math.atan2(b._y - a._y, (b._x - b._w / 2) - (a._x + a._w / 2));
      const hx = b._x - b._w / 2 - 3, hy = b._y;
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(hx - Math.cos(ang - 0.4) * 8, hy - Math.sin(ang - 0.4) * 8);
      ctx.lineTo(hx - Math.cos(ang + 0.4) * 8, hy - Math.sin(ang + 0.4) * 8);
      ctx.closePath(); ctx.fillStyle = "#c3ccd8"; ctx.fill();
    });
    nodes.forEach(n => {
      ctx.fillStyle = n.state === "run" ? "#0b5cad" : n.state === "done" ? "#e9f7ee" : "#ffffff";
      ctx.strokeStyle = n.state === "run" ? "#0b5cad" : n.state === "done" ? "#9fd3b4" : "#d5dee9";
      ctx.lineWidth = 1.4;
      const r = 7, x = n._lx, y = n._ly, w = n._w, h = n._h;
      ctx.beginPath();
      ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = n.state === "run" ? "#fff" : "#3d4b5e";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(n.label, n._x, n._y);
    });
  };

  A.kit = K;
})(window.APP);
