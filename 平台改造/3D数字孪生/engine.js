/* 轻量 3D 渲染引擎（Canvas 2D，画家算法 + 兰伯特光照）
 * 不依赖任何第三方库；双击 HTML 即可运行，无需服务器与网络。
 * 算法与 make_scene.py 的预览渲染保持一致。
 */
window.MINI3D = (function () {
  "use strict";

  // ---------- 向量工具 ----------
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  }
  function norm(a) {
    const l = Math.sqrt(dot(a, a)) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  }
  function hex2rgb(h) {
    h = h.replace("#", "");
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function mix(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }

  const STATE_COLOR = {
    idle: null,
    running: [59, 165, 93],
    warn: [240, 160, 32],
    error: [214, 39, 40],
  };
  const LIGHT_KEY = norm([-0.45, 0.82, 0.55]);
  const LIGHT_FILL = norm([0.55, 0.35, 0.65]);

  // ---------- 相机 ----------
  function createCamera(o) {
    o = o || {};
    const target = o.target || [0, 0.9, 0];
    const theta = o.theta == null ? -0.62 : o.theta;   // 方位角
    const phi = o.phi == null ? 0.42 : o.phi;          // 俯仰角
    const dist = o.dist == null ? 4.3 : o.dist;
    const fov = o.fov == null ? 26 : o.fov;
    const cp = Math.cos(phi), sp = Math.sin(phi);
    const eye = [
      target[0] + dist * cp * Math.sin(theta),
      target[1] + dist * sp,
      target[2] + dist * cp * Math.cos(theta),
    ];
    const f = norm(sub(target, eye));
    const r = norm(cross(f, [0, 1, 0]));
    const u = cross(r, f);
    return { eye, f, r, u, target, dist, theta, phi, fov, moved: true };
  }

  function projectPoint(cam, W, H, p) {
    const rel = sub(p, cam.eye);
    const cz = dot(rel, cam.f);
    if (cz <= 0.05) return { x: 0, y: 0, z: cz, visible: false };
    const scale = (H / 2) / Math.tan((cam.fov * Math.PI / 180) / 2);
    return {
      x: W / 2 + (dot(rel, cam.r) / cz) * scale,
      y: H / 2 - (dot(rel, cam.u) / cz) * scale,
      z: cz,
      visible: true,
    };
  }

  // ---------- 抽屉连续位移动画 ----------
  function drawerFaces(part, t) {
    if (!part.facesOpen || t <= 0.001) return part.faces;
    if (!part._rf) part._rf = part.faces.map(f => f.map(v => v.slice()));
    const n = part.faces.length;
    for (let i = 0; i < n; i++) {
      const a = part.faces[i], b = part.facesOpen[i], r = part._rf[i];
      for (let j = 0; j < a.length; j++) r[j][2] = a[j][2] + (b[j][2] - a[j][2]) * t;
    }
    return part._rf;
  }

  // ---------- 渲染 ----------
  function render(ctx, W, H, parts, cam, opts) {
    opts = opts || {};
    const time = opts.time || 0;
    const drawerT = opts.drawerT || 0;
    const stateOf = opts.stateOf || function () { return "idle"; };
    const colors = opts.colors || {};
    const drawerOpen = !!opts.drawerOpen;

    // 背景
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#f4f7fb");
    g.addColorStop(1, "#dfe5ee");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // 地面阴影
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = "#c9d2de";
    ctx.beginPath();
    ctx.ellipse(W * 0.5, H * 0.905, W * 0.21, H * 0.028, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const opaque = [];
    const glass = [];

    for (let pi = 0; pi < parts.length; pi++) {
      const part = parts[pi];
      const faces = drawerFaces(part, drawerT);
      const base = hex2rgb(colors[part.color] || "#cccccc");
      const st = stateOf(part.name);
      const stCol = STATE_COLOR[st];
      const isGlass = part.color === "glass";

      for (let fi = 0; fi < faces.length; fi++) {
        const face = faces[fi];
        const n = norm(cross(sub(face[1], face[0]), sub(face[2], face[0])));
        const cen = [
          (face[0][0] + face[1][0] + face[2][0] + (face[3] ? face[3][0] : face[0][0])) / (face[3] ? 4 : 3),
          (face[0][1] + face[1][1] + face[2][1] + (face[3] ? face[3][1] : face[0][1])) / (face[3] ? 4 : 3),
          (face[0][2] + face[1][2] + face[2][2] + (face[3] ? face[3][2] : face[0][2])) / (face[3] ? 4 : 3),
        ];
        if (dot(n, sub(cen, cam.eye)) >= 0) continue;   // 背面剔除

        const pts = [];
        let depth = 0, ok = true;
        for (let k = 0; k < face.length; k++) {
          const pr = projectPoint(cam, W, H, face[k]);
          if (!pr.visible) { ok = false; break; }
          pts.push([pr.x, pr.y]);
          depth += pr.z;
        }
        if (!ok) continue;
        depth /= face.length;

        const lam = Math.max(0, dot(n, LIGHT_KEY));
        const fill = Math.max(0, dot(n, LIGHT_FILL)) * 0.32;
        const k = 0.36 + 0.64 * lam + fill;
        let col = [Math.min(255, base[0] * k), Math.min(255, base[1] * k), Math.min(255, base[2] * k)];

        if (stCol && st !== "idle") {
          let t = 0.55;
          if (st === "error") t = 0.45 + 0.32 * (0.5 + 0.5 * Math.sin(time * 6));
          col = mix(col, stCol, t);
        }

        if (isGlass) {
          const spec = Math.max(0, dot(n, norm([-0.3, 0.9, 0.35])));
          glass.push({ pts, depth, col, alpha: 0.10 + 0.22 * spec, pi });
        } else {
          opaque.push({ pts, depth, col, pi });
        }
      }
    }

    opaque.sort(function (a, b) { return b.depth - a.depth; });
    ctx.lineJoin = "round";
    for (let i = 0; i < opaque.length; i++) {
      const f = opaque[i];
      const c = f.col;
      ctx.fillStyle = "rgb(" + (c[0] | 0) + "," + (c[1] | 0) + "," + (c[2] | 0) + ")";
      ctx.strokeStyle = "rgba(" + (c[0] * 0.62 | 0) + "," + (c[1] * 0.62 | 0) + "," + (c[2] * 0.62 | 0) + ",0.9)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(f.pts[0][0], f.pts[0][1]);
      for (let k = 1; k < f.pts.length; k++) ctx.lineTo(f.pts[k][0], f.pts[k][1]);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    glass.sort(function (a, b) { return b.depth - a.depth; });
    for (let i = 0; i < glass.length; i++) {
      const f = glass[i];
      ctx.save();
      ctx.globalAlpha = f.alpha;
      ctx.fillStyle = "rgb(" + (f.col[0] | 0) + "," + (f.col[1] | 0) + "," + (f.col[2] | 0) + ")";
      ctx.strokeStyle = "rgba(150,190,225,0.55)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(f.pts[0][0], f.pts[0][1]);
      for (let k = 1; k < f.pts.length; k++) ctx.lineTo(f.pts[k][0], f.pts[k][1]);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // 选中高亮
    if (opts.selectedName) {
      ctx.save();
      ctx.strokeStyle = "rgba(0,176,204,0.95)";
      ctx.lineWidth = 2;
      ctx.fillStyle = "rgba(0,176,204,0.20)";
      const all = opaque.concat(glass);
      for (let i = 0; i < all.length; i++) {
        const f = all[i];
        if (parts[f.pi].name !== opts.selectedName) continue;
        ctx.beginPath();
        ctx.moveTo(f.pts[0][0], f.pts[0][1]);
        for (let k = 1; k < f.pts.length; k++) ctx.lineTo(f.pts[k][0], f.pts[k][1]);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }

    return { opaque: opaque.length, glass: glass.length, faces: opaque.concat(glass) };
  }

  // ---------- 拾取 ----------
  function pointInPoly(px, py, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
      const hit = ((yi > py) !== (yj > py)) && (px < ((xj - xi) * (py - yi)) / (yj - yi || 1e-9) + xi);
      if (hit) inside = !inside;
    }
    return inside;
  }

  function pick(parts, cam, W, H, sx, sy, opts) {
    opts = opts || {};
    const drawerT = opts.drawerT || 0;
    const hits = [];
    for (let pi = 0; pi < parts.length; pi++) {
      if (parts[pi].pick === false) continue;
      if (parts[pi].color === "glass") continue;   // 玻璃门不参与拾取，否则内部部件点不到
      const faces = drawerFaces(parts[pi], drawerT);
      for (let fi = 0; fi < faces.length; fi++) {
        const face = faces[fi];
        const n = norm(cross(sub(face[1], face[0]), sub(face[2], face[0])));
        const cen = face[0];
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
        if (pointInPoly(sx, sy, pts)) hits.push({ pi, depth: depth / face.length });
      }
    }
    if (!hits.length) return null;
    hits.sort(function (a, b) { return a.depth - b.depth; });
    return parts[hits[0].pi];
  }

  return {
    createCamera, projectPoint, render, pick, hex2rgb, mix, norm, stateColor: STATE_COLOR,
  };
})();
