# -*- coding: utf-8 -*-
"""平台数字孪生：场景定义 + 预览渲染
1) 用同一份场景数据渲染 PNG 预览（验证外观与构图）
2) 导出 web3d/scene.js（供前端 JS 引擎使用）
"""
import json
import math
import os
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
WEB = HERE          # scene.js 与预览图直接输出到本目录
os.makedirs(WEB, exist_ok=True)

# ============================================================
# 一、场景定义（单位：米，y 轴向上，原点在底面中心）
# ============================================================
# kind: box | cyl(y轴) | cyly | cylz  → cyl 统一为"绕 z 转 90°"由 rot 处理更简单，
# 这里统一用 kind=box/cyl，cyl 默认轴向 y，用 rot 指定旋转。
PARTS = []
LABELS = [
    {"id": "L1", "text": "① 储液 / 配液", "p": [-0.28, 0.30, 0.30]},
    {"id": "L2", "text": "② 反应与换电极", "p": [0.08, 0.62, 0.30]},
    {"id": "L3", "text": "③ 蠕动泵组", "p": [-0.18, 1.00, 0.34]},
    {"id": "L4", "text": "④ 电化学测试", "p": [-0.14, 1.36, 0.32]},
    {"id": "L5", "text": "⑤ 排风", "p": [0.20, 1.76, 0.16]},
    {"id": "L6", "text": "⑥ 废液收集", "p": [0.30, 0.30, 0.30]},
]

C = {
    "al": "#AEB6C0",      # 铝型材
    "al_d": "#8C939D",    # 铝暗面
    "sheet": "#E4E9EF",   # 钣金白
    "sheet_d": "#C3CAD3",
    "glass": "#9FC4E8",
    "pump": "#F2F4F7",
    "roller": "#9AA2AC",
    "beaker": "#A9D3F0",
    "bottle": "#E3E8EE",
    "waste": "#D5DBE2",
    "dark": "#22262C",
    "ipc": "#3A4048",
    "estop": "#C00000",
    "yellow": "#E8B33A",
    "tray": "#DFE4EA",
    "red": "#D64545",
    "blue": "#3C6FB5",
    "yel": "#E0A72E",
    "grn": "#3BA55D",
    "wht": "#F5F7FA",
    "gry": "#8D949C",
}


def add(name, cn, spec, kind, size, pos, rot=(0, 0, 0), color="al", group="", pick=True):
    PARTS.append({
        "name": name, "cn": cn, "spec": spec, "kind": kind, "size": list(size),
        "pos": list(pos), "rot": list(rot), "color": color, "group": group, "pick": pick,
    })


# ---------- 结构：脚轮 / 底座 / 立柱 / 隔板 / 顶板 ----------
for i, (sx, sz) in enumerate([(-1, -1), (1, -1), (-1, 1), (1, 1)]):
    add("M-CASTOR-0%d" % (i + 1), "可调脚轮", "R-32", "cyl",
        (0.028, 0.055, 0.028), (sx * 0.38, 0.028, sz * 0.28), (0, 0, 0), "roller")

add("M-BASE-01", "底座钣金", "C-1", "box", (0.90, 0.05, 0.70), (0, 0.082, 0), (0, 0, 0), "sheet")
add("M-BASE-02", "底座框架", "C-1", "box", (0.80, 0.03, 0.60), (0, 0.108, 0), (0, 0, 0), "al_d")

SHELF_Y = [0.50, 0.90, 1.24]
for i, y in enumerate(SHELF_Y):
    add("M-SHELF-0%d" % (i + 1), "层板 %d" % (i + 1), "R-28", "box",
        (0.82, 0.018, 0.62), (0, y, 0), (0, 0, 0), "sheet")

for i, (sx, sz) in enumerate([(-1, -1), (1, -1), (-1, 1), (1, 1)]):
    add("M-FRAME-0%d" % (i + 1), "铝型材立柱 %d" % (i + 1), "R-28", "box",
        (0.04, 1.58, 0.04), (sx * 0.43, 0.87, sz * 0.33), (0, 0, 0), "al")

add("M-TOP-01", "顶板", "C-1", "box", (0.90, 0.03, 0.70), (0, 1.685, 0), (0, 0, 0), "sheet")

# ---------- 侧板与背板（让它读起来是"机柜"） ----------
add("M-SIDEP-01", "左侧钣金", "C-1", "box", (0.018, 1.56, 0.66), (-0.437, 0.88, 0), (0, 0, 0), "sheet_d")
add("M-SIDEP-02", "右侧钣金", "C-1", "box", (0.018, 1.56, 0.66), (0.437, 0.88, 0), (0, 0, 0), "sheet_d")
add("M-BACKP-01", "背板", "C-1", "box", (0.86, 1.56, 0.018), (0, 0.88, -0.335), (0, 0, 0), "sheet_d")

# ---------- 排风 ----------
add("M-EXH-01", "排风罩", "R-20", "box", (0.55, 0.10, 0.45), (0, 1.75, 0), (0, 0, 0), "sheet_d")
add("M-DUCT-01", "排风管接口", "R-20", "cyl", (0.07, 0.16, 0.07), (0, 1.88, 0), (0, 0, 0), "al_d")

# ---------- 玻璃门 ----------
add("M-DOOR-01", "左玻璃防护门", "R-19", "box", (0.42, 1.50, 0.012), (-0.215, 0.86, 0.345), (0, 0, 0), "glass")
add("M-DOOR-02", "右玻璃防护门", "R-19", "box", (0.42, 1.50, 0.012), (0.215, 0.86, 0.345), (0, 0, 0), "glass")

# ---------- 急停（装在左前立柱，按钮朝正前方） ----------
add("M-EST-01", "急停按钮", "R-21", "cyl", (0.032, 0.022, 0.032), (-0.43, 1.30, 0.352),
    (90, 0, 0), "estop")
add("M-EST-02", "急停底座", "R-21", "cyl", (0.044, 0.012, 0.044), (-0.43, 1.30, 0.340),
    (90, 0, 0), "yellow")

# ---------- 线槽 ----------
add("M-DUCTCH-01", "线槽（左）", "R-29", "box", (0.035, 1.30, 0.030), (-0.395, 0.86, 0.245), (0, 0, 0), "al_d")
add("M-DUCTCH-02", "线槽（右）", "R-29", "box", (0.035, 1.30, 0.030), (0.395, 0.86, 0.245), (0, 0, 0), "al_d")

# ---------- C4 顶层电气 ----------
add("M-EWS-01", "电化学工作站", "R-12", "box", (0.44, 0.18, 0.34), (-0.15, 1.38, -0.02), (0, 0, 0), "dark")
add("M-EWS-02", "工作站指示灯", "R-12", "box", (0.018, 0.018, 0.006), (0.03, 1.40, 0.155), (0, 0, 0), "grn")
add("M-IPC-01", "工控机", "R-23", "box", (0.26, 0.11, 0.30), (0.28, 1.345, -0.05), (0, 0, 0), "ipc")
add("M-GW-01", "IO 通信网关", "R-24", "box", (0.13, 0.08, 0.14), (0.28, 1.44, 0.16), (0, 0, 0), "sheet_d")

# ---------- C3 泵组 ----------
PUMP_X = [-0.30, -0.18, -0.06, 0.06, 0.18, 0.30]
PUMP_COLORS = ["red", "blue", "yel", "grn", "wht", "gry"]
for i, px in enumerate(PUMP_X):
    add("M-PUMP-0%d" % (i + 1), "蠕动泵 %d" % (i + 1), "R-01", "box",
        (0.075, 0.090, 0.060), (px, 1.03, 0.10), (0, 0, 0), "pump")
    add("M-PUMPR-0%d" % (i + 1), "泵头滚筒 %d" % (i + 1), "R-01", "cyl",
        (0.028, 0.058, 0.028), (px, 1.03, 0.155), (90, 0, 0), "roller")
    add("M-QC-0%d" % (i + 1), "快换接头 %d" % (i + 1), "R-02", "cyl",
        (0.011, 0.030, 0.011), (px, 1.10, 0.10), (0, 0, 0), PUMP_COLORS[i])
    add("M-PTUBE-0%d" % (i + 1), "泵管 %d" % (i + 1), "R-02", "box",
        (0.008, 0.20, 0.008), (px, 0.955, 0.17), (0, 0, 0), PUMP_COLORS[i])

# 触摸屏（右侧挂臂）
add("M-HMI-01", "触摸屏", "R-23", "box", (0.020, 0.22, 0.28), (0.50, 1.36, 0.02), (0, 0, 0), "dark")
add("M-HMI-02", "触摸屏支架", "R-23", "box", (0.10, 0.03, 0.03), (0.475, 1.36, 0.02), (0, 0, 0), "al_d")

# ---------- C2 抽屉 + 反应 + 电极转盘 ----------
add("M-DRAWER-01", "抽屉式层板", "R-27", "box", (0.78, 0.022, 0.58), (0, 0.925, 0), (0, 0, 0), "sheet_d")
BEK_X = [-0.26, -0.12, 0.02]
for i, bx in enumerate(BEK_X):
    add("M-REACTOR-0%d" % (i + 1), "反应烧杯 %d" % (i + 1), "R-09", "cyl",
        (0.056, 0.110, 0.056), (bx, 1.000, 0.195), (0, 0, 0), "beaker")
add("M-TURRET-01", "电极转盘", "R-07", "cyl", (0.115, 0.016, 0.115), (0.24, 0.948, 0.185), (0, 0, 0), "al_d")
for i in range(6):
    ang = math.radians(i * 60)
    add("M-TURRET-E%d" % (i + 1), "电极夹位 %d" % (i + 1), "R-07", "cyl",
        (0.010, 0.045, 0.010),
        (0.24 + 0.082 * math.cos(ang), 0.971, 0.185 + 0.082 * math.sin(ang)), (0, 0, 0), "roller")

# ---------- C1 储液 / 废液 ----------
add("M-TRAY-01", "接液盘（上层）", "R-17", "box", (0.78, 0.020, 0.56), (0, 0.525, 0), (0, 0, 0), "tray")
add("M-TRAY-02", "接液盘（底层）", "R-17", "box", (0.78, 0.020, 0.56), (0, 0.145, 0), (0, 0, 0), "tray")
for i, bx in enumerate([-0.26, -0.10, 0.06]):
    add("M-BOTTLE-0%d" % (i + 1), "储液瓶 %d" % (i + 1), "R-03", "cyl",
        (0.070, 0.230, 0.070), (bx, 0.282, 0.12), (0, 0, 0), "bottle")
    add("M-BCAP-0%d" % (i + 1), "瓶盖 %d" % (i + 1), "R-03", "cyl",
        (0.030, 0.030, 0.030), (bx, 0.412, 0.12), (0, 0, 0), PUMP_COLORS[i])
add("M-WASTE-01", "废液桶", "R-06", "cyl", (0.100, 0.270, 0.100), (0.29, 0.302, 0.12), (0, 0, 0), "waste")
add("M-WCAP-01", "废液桶盖", "R-06", "cyl", (0.040, 0.035, 0.040), (0.29, 0.455, 0.12), (0, 0, 0), "gry")

# 门把手
add("M-HANDLE-01", "左门把手", "R-19", "box", (0.012, 0.14, 0.020), (-0.035, 0.90, 0.358), (0, 0, 0), "roller")
add("M-HANDLE-02", "右门把手", "R-19", "box", (0.012, 0.14, 0.020), (0.035, 0.90, 0.358), (0, 0, 0), "roller")

# 抽屉滑轨与拉手（R-27 的可视化）
add("M-RAIL-01", "抽屉滑轨（左）", "R-27", "box", (0.022, 0.024, 0.50), (-0.372, 0.902, 0.02), (0, 0, 0), "al_d")
add("M-RAIL-02", "抽屉滑轨（右）", "R-27", "box", (0.022, 0.024, 0.50), (0.372, 0.902, 0.02), (0, 0, 0), "al_d")
add("M-DHANDLE-01", "抽屉拉手", "R-27", "box", (0.30, 0.018, 0.018), (0, 0.955, 0.288), (0, 0, 0), "roller")

# ============================================================
# 二、几何生成
# ============================================================
def rot3(v, rot):
    rx, ry, rz = [math.radians(a) for a in rot]
    x, y, z = v
    # Rx
    y, z = y * math.cos(rx) - z * math.sin(rx), y * math.sin(rx) + z * math.cos(rx)
    # Ry
    x, z = x * math.cos(ry) + z * math.sin(ry), -x * math.sin(ry) + z * math.cos(ry)
    # Rz
    x, y = x * math.cos(rz) - y * math.sin(rz), x * math.sin(rz) + y * math.cos(rz)
    return [x, y, z]


def make_faces(part):
    kind, size, pos, rot = part["kind"], part["size"], part["pos"], part["rot"]
    faces = []
    if kind == "box":
        w, h, d = [s / 2 for s in size]
        corners = [(-w, -h, -d), (w, -h, -d), (w, h, -d), (-w, h, -d),
                   (-w, -h, d), (w, -h, d), (w, h, d), (-w, h, d)]
        idx = [(0, 1, 2, 3), (5, 4, 7, 6), (4, 0, 3, 7), (1, 5, 6, 2), (3, 2, 6, 7), (4, 5, 1, 0)]
        for f in idx:
            faces.append([corners[i] for i in f])
    else:  # 圆柱（轴向 y）
        r, hgt = size[0] / 2, size[1]
        n = 18
        top, bot = [], []
        for i in range(n):
            a = 2 * math.pi * i / n
            x, z = r * math.cos(a), r * math.sin(a)
            bot.append((x, -hgt / 2, z))
            top.append((x, hgt / 2, z))
        for i in range(n):
            j = (i + 1) % n
            faces.append([bot[i], bot[j], top[j], top[i]])
        faces.append(top)
        faces.append(list(reversed(bot)))
    out = []
    for f in faces:
        out.append([[v[k] + pos[k] for k in range(3)] for v in [rot3(p, rot) for p in f]])
    return out


def build_scene():
    scene = []
    for p in PARTS:
        scene.append({"name": p["name"], "cn": p["cn"], "spec": p["spec"],
                      "color": p["color"], "group": p["group"], "pick": p["pick"],
                      "faces": make_faces(p),
                      "center": p["pos"]})
    return scene


# ============================================================
# 三、预览渲染（画家算法 + 兰伯特光照）
# ============================================================
def hex2rgb(h):
    h = h.lstrip("#")
    return [int(h[i:i + 2], 16) for i in (0, 2, 4)]


def sub(a, b): return [a[i] - b[i] for i in range(3)]
def cross(a, b): return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
def dot(a, b): return sum(a[i] * b[i] for i in range(3))
def norm(a):
    l = math.sqrt(dot(a, a)) or 1.0
    return [x / l for x in a]


def render(scene, out_png, W=1240, H=1240, eye=(3.15, 2.10, 3.70), target=(0, 0.90, 0), fov=25):
    eye = list(eye); target = list(target)
    f = norm(sub(target, eye))
    r = norm(cross(f, [0, 1, 0]))
    u = cross(r, f)
    scale = (H / 2) / math.tan(math.radians(fov) / 2)
    img = Image.new("RGB", (W, H), "#EEF1F5")
    d = ImageDraw.Draw(img)

    # 地面投影
    d.ellipse((W * 0.5 - 190, H * 0.845 - 30, W * 0.5 + 190, H * 0.845 + 30), fill="#E2E6EC")

    L1 = norm([-0.45, 0.82, 0.55])
    L2 = norm([0.55, 0.35, 0.65])

    def shade_of(n, base):
        lam = max(0.0, dot(n, L1))
        fill = max(0.0, dot(n, L2)) * 0.35
        k = 0.34 + 0.66 * lam + fill
        return tuple(min(255, int(c * k)) for c in base)

    opaque, glass = [], []
    for part in scene:
        base = hex2rgb(C[part["color"]])
        for face in part["faces"]:
            cam = []
            for v in face:
                rel = sub(v, eye)
                cam.append((dot(rel, r), dot(rel, u), dot(rel, f)))
            if any(c[2] <= 0.05 for c in cam):
                continue
            n = norm(cross(sub(face[1], face[0]), sub(face[2], face[0])))
            cen = [sum(v[i] for v in face) / len(face) for i in range(3)]
            if dot(n, sub(cen, eye)) >= 0:
                continue
            pts = [(W / 2 + c[0] / c[2] * scale, H / 2 - c[1] / c[2] * scale) for c in cam]
            depth = sum(c[2] for c in cam) / len(cam)
            is_glass = part["color"] == "glass"
            if is_glass:
                # 亮度随机微扰，模拟玻璃反光
                glass.append([depth, pts, base, n])
            else:
                col = shade_of(n, base)
                opaque.append([depth, pts, col])

    opaque.sort(key=lambda t: -t[0])
    for depth, pts, col in opaque:
        d.polygon(pts, fill=col, outline=tuple(int(c * 0.62) for c in col))

    # 玻璃：半透明叠加（不参与遮挡排序）
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    dl = ImageDraw.Draw(layer)
    glass.sort(key=lambda t: -t[0])
    for depth, pts, base, n in glass:
        spec = max(0.0, dot(n, norm(sub([-0.3, 0.9, 0.35], [0, 0, 0]))))
        a = int(12 + 24 * spec)
        col = tuple(min(255, int(c * (0.62 + 0.45 * spec))) for c in base)
        dl.polygon(pts, fill=col + (a,), outline=(160, 195, 225, 110))
    img = Image.alpha_composite(img.convert("RGBA"), layer).convert("RGB")
    img.save(out_png)
    print("preview ->", out_png, "| 不透明面 %d, 玻璃面 %d" % (len(opaque), len(glass)))


# ============================================================
# 四、导出给前端的 scene.js
# ============================================================
def export_js(scene):
    DRAWER_PREFIX = ("M-DRAWER", "M-REACTOR", "M-TURRET", "M-DHANDLE")
    DRAWER_DZ = 0.24   # 抽屉拉出行程（米）

    parts = []
    for p in scene:
        item = {
            "name": p["name"], "cn": p["cn"], "spec": p["spec"], "color": p["color"],
            "pick": p["pick"],
            "faces": [[[round(c, 4) for c in v] for v in f] for f in p["faces"]],
            "center": [round(c, 4) for c in p["center"]],
        }
        if p["name"].startswith(DRAWER_PREFIX):
            item["facesOpen"] = [
                [[round(v[0], 4), round(v[1], 4), round(v[2] + DRAWER_DZ, 4)] for v in f]
                for f in p["faces"]
            ]
        parts.append(item)

    payload = {"parts": parts, "labels": LABELS, "colors": C}
    js = ("// 自动生成：请勿手改（由 make_scene.py 生成）\n"
          "window.SCENE = " + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";\n")
    path = os.path.join(WEB, "scene.js")
    with open(path, "w", encoding="utf-8") as f:
        f.write(js)
    print("scene.js ->", path, "%.1f KB" % (os.path.getsize(path) / 1024))
    print("parts:", len(parts), "faces:", sum(len(p["faces"]) for p in parts),
          "| 可抽出部件:", sum(1 for p in parts if "facesOpen" in p))


if __name__ == "__main__":
    sc = build_scene()
    render(sc, os.path.join(WEB, "_preview.png"))
    export_js(sc)
