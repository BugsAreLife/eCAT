/* 轻量 3D 引擎 v2（Canvas 2D，画家算法 + 三点光照）
 * 深色演播室风格：暗场 + 地面网格 + 选中辉光 + 部件位移动画
 * 无第三方依赖；配合 scene.js（make_scene.py 生成）使用。
 */
window.MINI3D = (function () {
  "use strict";

  // ---------- 向量 ----------
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function norm(a) { const l = Math.sqrt(dot(a, a)) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }

  const KEY = norm([-0.45, 0.86, 0.52]);      // 主光
  const FILL = norm([0.62, 0.30, 0.60]);      // 补光
  const RIM = norm([0.10, 0.42, -0.90]);      // 轮廓光（背后）

  const STATE = {
    idle: null,
    running: [46, 219, 160],
    warn: [251, 191, 36],
    error: [248, 113, 113],
    ok: [34, 211, 238],
  };

  function createCamera(o) {
    o = o || {};
    const target = o.target || [0, 0.9, 0];
    const theta = o.theta == null ? -0.62 : o.theta;
    const phi = o.phi == null ? 0.30 : o.phi;
    const dist = o.dist == null ? 3.2 : o.dist;
    const fov = o.fov == null ? 30 : o.fov;
    const cp = Math.cos(phi), sp = Math.sin(phi);
    const eye = [
      target[0] + dist * cp * Math.sin(theta),
      target[1] + dist * sp,
      target[2] + dist * cp * Math.cos(theta),
    ];
    const f = norm(sub(target, eye));
    const r = norm(cross(f, [0, 1, 0]));
    const u = cross(r, f);
    return { eye, f, r, u, target, dist, theta, phi, fov };
  }

  function projectPoint(cam, W, H, p) {
    const rel = sub(p, cam.eye);
    const cz = dot(rel, cam.f);
    if (cz <= 0.04) return { x: 0, y: 0, z: cz, visible: false };
    const scale = (H / 2) / Math.tan((cam.fov * Math.PI / 180) / 2);
    return {
      x: W / 2 + (dot(rel, cam.r) / cz) * scale,
      y: H / 2 - (dot(rel, cam.u) / cz) * scale,
      z: cz,
      visible: true,
    };
  }

  // ---------- 位移（抽屉 / 压片 / 电极） ----------
  const offCache = new WeakMap();
  function movedFaces(part, off) {
    if (!off) return part.faces;
    const key = off[0] + "," + off[1] + "," + off[2];
    let c = offCache.get(part);
    if (c && c.key === key) return c.faces;
    const faces = part.faces.map(function (f) {
      return f.map(function (v) { return [v[0] + off[0], v[1] + off[1], v[2] + off[2]]; });
    });
    offCache.set(part, { key: key, faces: faces });
    return faces;
  }

  // ---------- 主渲染 ----------
  function render(ctx, W, H, parts, cam, opts) {
    opts = opts || {};
    const time = opts.time || 0;
    const colors = opts.colors || {};
    const offsets = opts.offsets || {};
    const stateOf = opts.stateOf || function () { return "idle"; };
    const selected = opts.selected || null;
    const hovered = opts.hovered || null;
    const setName = opts.set || null;          // 需求高亮：一批零件
    const setKey = setName ? setName.join(",") : "";

    // 背景
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#0a1420");
    g.addColorStop(0.55, "#070d16");
    g.addColorStop(1, "#04070c");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // 顶部氛围光
    const rad = ctx.createRadialGradient(W * 0.5, H * 0.12, 10, W * 0.5, H * 0.3, Math.max(W, H) * 0.7);
    rad.addColorStop(0, "rgba(34,211,238,.10)");
    rad.addColorStop(0.5, "rgba(59,130,246,.05)");
    rad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = rad;
    ctx.fillRect(0, 0, W, H);

    // 地面网格
    drawFloor(ctx, W, H, cam);

    // 收集面
    const faces = [];
    for (let pi = 0; pi < parts.length; pi++) {
      const part = parts[pi];
      const fs = movedFaces(part, offsets[part.name]);
      const base = hex2rgb(colors[part.color] || "#9aa4b2");
      const st = stateOf(part.name);
      const stCol = STATE[st] || null;
      for (let fi = 0; fi < fs.length; fi++) {
        const face = fs[fi];
        const n = norm(cross(sub(face[1], face[0]), sub(face[2], face[0])));
        const cen = faceCenter(face);
        if (dot(n, sub(cen, cam.eye)) >= 0) continue;

        const pts = [];
        let depth = 0, ok = true;
        for (let k = 0; k < face.length; k++) {
          const pr = projectPoint(cam, W, H, face[k]);
          if (!pr.visible) { ok = false; break; }
          pts.push([pr.x, pr.y]);
          depth += pr.z;
        }
        if (!ok) continue;

        // 三点光照
        const lam = Math.max(0, dot(n, KEY));
        const fill = Math.max(0, dot(n, FILL)) * 0.34;
        const rim = Math.max(0, dot(n, RIM)) * 0.22;
        const k = 0.18 + 0.74 * lam + fill + rim;
        // 深色场曝光：压暗金属高光并整体推冷
        const EX = 0.50;
        let col = [base[0] * k * EX + 5, base[1] * k * EX * 1.04 + 14, base[2] * k * EX * 1.16 + 30];

        let extra = null;
        if (stCol && st !== "idle") {
          const t = st === "error" ? 0.45 + 0.30 * (0.5 + 0.5 * Math.sin(time * 7)) : 0.42;
          col = mix(col, stCol, t);
          extra = stCol;
        }

        faces.push({
          pts, depth: depth / face.length, col, part: pi,
          glass: part.color === "glass", extra,
        });
      }
    }

    faces.sort(function (a, b) { return b.depth - a.depth; });
    ctx.lineJoin = "round";
    for (let i = 0; i < faces.length; i++) {
      const f = faces[i];
      const c = f.col;
      ctx.globalAlpha = f.glass ? 0.14 : 1;
      ctx.fillStyle = "rgb(" + (c[0] | 0) + "," + (c[1] | 0) + "," + (c[2] | 0) + ")";
      ctx.strokeStyle = f.glass ? "rgba(150,200,235,.35)" : "rgba(" + (c[0] * 0.55 | 0) + "," + (c[1] * 0.6 | 0) + "," + (c[2] * 0.72 | 0) + ",.85)";
      ctx.lineWidth = 0.8;
      path(ctx, f.pts);
      ctx.fill();
      if (!f.glass) ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // 选中 / 悬停 / 需求集合高亮（半透明穿透描边）
    const markSel = [];
    const markSet = [];
    const markHover = [];
    for (let i = 0; i < faces.length; i++) {
      const f = faces[i];
      const name = parts[f.part].name;
      if (selected && name === selected) markSel.push(f);
      else if (hovered && name === hovered) markHover.push(f);
      else if (setName && setName.indexOf(name) >= 0) markSet.push(f);
    }
    const pulse = 0.55 + 0.45 * Math.sin(time * 4);
    if (markSet.length) {
      ctx.save();
      ctx.fillStyle = "rgba(167,139,250,.16)";
      ctx.strokeStyle = "rgba(167,139,250,.85)";
      ctx.lineWidth = 1.2;
      markSet.forEach(function (f) { path(ctx, f.pts); ctx.fill(); ctx.stroke(); });
      ctx.restore();
    }
    if (markHover.length) {
      ctx.save();
      ctx.fillStyle = "rgba(34,211,238,.12)";
      ctx.strokeStyle = "rgba(34,211,238,.7)";
      ctx.lineWidth = 1.2;
      markHover.forEach(function (f) { path(ctx, f.pts); ctx.fill(); ctx.stroke(); });
      ctx.restore();
    }
    if (markSel.length) {
      ctx.save();
      ctx.shadowColor = "rgba(34,211,238,.9)";
      ctx.shadowBlur = 16;
      ctx.fillStyle = "rgba(34,211,238," + (0.20 + 0.10 * pulse).toFixed(2) + ")";
      ctx.strokeStyle = "rgba(160,248,255," + (0.7 + 0.3 * pulse).toFixed(2) + ")";
      ctx.lineWidth = 1.8;
      markSel.forEach(function (f) { path(ctx, f.pts); ctx.fill(); ctx.stroke(); });
      ctx.restore();
    }

    // 选中件定位环
    if (selected) {
      const part = parts.find(function (p) { return p.name === selected; });
      if (part) {
        const c = [part.center[0] + (offsets[selected] ? offsets[selected][0] : 0),
        part.center[1] + (offsets[selected] ? offsets[selected][1] : 0),
        part.center[2] + (offsets[selected] ? offsets[selected][2] : 0)];
        const pr = projectPoint(cam, W, H, c);
        if (pr.visible) {
          ctx.save();
          ctx.strokeStyle = "rgba(34,211,238," + (0.5 + 0.4 * pulse).toFixed(2) + ")";
          ctx.lineWidth = 1.2;
          const rr = 14 + 4 * pulse;
          ctx.beginPath();
          ctx.arc(pr.x, pr.y, rr, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(pr.x, pr.y, 2.4, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(34,211,238,.95)";
          ctx.fill();
          ctx.restore();
          // HUD 引线标注
          if (opts.labelText) {
            const lx = pr.x + 34, ly = pr.y - 34;
            ctx.save();
            ctx.strokeStyle = "rgba(34,211,238,.75)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(pr.x + 10, pr.y - 10);
            ctx.lineTo(lx - 8, ly + 8);
            ctx.stroke();
            ctx.font = "600 12px 'Microsoft YaHei',sans-serif";
            const txt = String(opts.labelText);
            const tw = (ctx.measureText ? ctx.measureText(txt).width : txt.length * 7) + 18;
            const bx = lx - 4, by = ly - 13, bh = 22;
            ctx.beginPath();
            ctx.moveTo(bx + 5, by);
            ctx.lineTo(bx + tw - 5, by);
            ctx.quadraticCurveTo(bx + tw, by, bx + tw, by + 5);
            ctx.lineTo(bx + tw, by + bh - 5);
            ctx.quadraticCurveTo(bx + tw, by + bh, bx + tw - 5, by + bh);
            ctx.lineTo(bx + 5, by + bh);
            ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - 5);
            ctx.lineTo(bx, by + 5);
            ctx.quadraticCurveTo(bx, by, bx + 5, by);
            ctx.closePath();
            ctx.fillStyle = "rgba(7,18,30,.92)";
            ctx.fill();
            ctx.strokeStyle = "rgba(34,211,238,.55)";
            ctx.stroke();
            ctx.fillStyle = "#d8fbff";
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            ctx.fillText(txt, bx + 9, by + bh / 2);
            ctx.restore();
          }
        }
      }
    }

    return { faces: faces.length, parts: parts.length };
  }

  function faceCenter(f) {
    let x = 0, y = 0, z = 0;
    for (let i = 0; i < f.length; i++) { x += f[i][0]; y += f[i][1]; z += f[i][2]; }
    return [x / f.length, y / f.length, z / f.length];
  }
  function path(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  }
  function drawFloor(ctx, W, H, cam) {
    ctx.save();
    const lim = 0.95;
    for (let i = -4; i <= 4; i++) {
      const t = (i / 4) * lim;
      [[[t, 0, -lim], [t, 0, lim]], [[-lim, 0, t], [lim, 0, t]]].forEach(function (seg) {
        const a = projectPoint(cam, W, H, seg[0]);
        const b = projectPoint(cam, W, H, seg[1]);
        if (!a.visible || !b.visible) return;
        const d = Math.min(1, Math.abs(i) / 4);
        ctx.strokeStyle = "rgba(56,189,248," + (0.16 - d * 0.10).toFixed(3) + ")";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      });
    }
    ctx.restore();
  }

  // ---------- 拾取 ----------
  function inPoly(px, py, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
      if (((yi > py) !== (yj > py)) && (px < ((xj - xi) * (py - yi)) / (yj - yi || 1e-9) + xi)) inside = !inside;
    }
    return inside;
  }

  function pick(parts, cam, W, H, sx, sy, opts) {
    opts = opts || {};
    const offsets = opts.offsets || {};
    const hits = [];
    for (let pi = 0; pi < parts.length; pi++) {
      const part = parts[pi];
      if (part.pick === false || part.color === "glass") continue;
      const fs = movedFaces(part, offsets[part.name]);
      for (let fi = 0; fi < fs.length; fi++) {
        const face = fs[fi];
        const n = norm(cross(sub(face[1], face[0]), sub(face[2], face[0])));
        if (dot(n, sub(face[0], cam.eye)) >= 0) continue;
        const pts = [];
        let depth = 0, ok = true;
        for (let k = 0; k < face.length; k++) {
          const pr = projectPoint(cam, W, H, face[k]);
          if (!pr.visible) { ok = false; break; }
          pts.push([pr.x, pr.y]);
          depth += pr.z;
        }
        if (!ok) continue;
        if (inPoly(sx, sy, pts)) hits.push({ pi: pi, depth: depth / face.length });
      }
    }
    if (!hits.length) return null;
    hits.sort(function (a, b) { return a.depth - b.depth; });
    return parts[hits[0].pi];
  }

  function hex2rgb(h) {
    h = String(h || "#888").replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function mix(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }

  return {
    createCamera, projectPoint, render, pick, hex2rgb, mix, norm, STATE,
  };
})();
