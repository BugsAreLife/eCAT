# -*- coding: utf-8 -*-
"""生成图 3.2：析氢催化剂自动化实验工作站 产品形态与工位布局示意图
(a) 俯视图 —— 各功能模块位置与样品转运路径
(b) 正视图 —— 整机外形、防护罩、控制柜
"""
import os
from PIL import Image, ImageDraw, ImageFont

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fig")
os.makedirs(OUT, exist_ok=True)
MSYH = r"C:\Windows\Fonts\msyh.ttc"
MSYHB = r"C:\Windows\Fonts\msyhbd.ttc"


def F(size, bold=False):
    return ImageFont.truetype(MSYHB if bold else MSYH, size)


def tc(d, box, s, font, fill=(20, 20, 20)):
    x0, y0, x1, y1 = box
    lines = s.split("\n")
    hs, ws = [], []
    for ln in lines:
        b = d.textbbox((0, 0), ln, font=font)
        hs.append(b[3] - b[1])
        ws.append(b[2] - b[0])
    gap = int(font.size * 0.42)
    total = sum(hs) + gap * (len(lines) - 1)
    y = y0 + (y1 - y0 - total) / 2
    for ln, h in zip(lines, hs):
        b = d.textbbox((0, 0), ln, font=font)
        d.text((x0 + (x1 - x0 - (b[2] - b[0])) / 2 - b[0], y - b[1]), ln, font=font, fill=fill)
        y += h + gap


def rrect(d, box, r, fill, outline, width=3):
    d.rounded_rectangle(box, radius=r, fill=fill, outline=outline, width=width)


def dash_h(d, x0, x1, y, color, width=3, dash=14, gap=10):
    x = x0
    while x < x1:
        d.line([(x, y), (min(x + dash, x1), y)], fill=color, width=width)
        x += dash + gap


def dash_v(d, x, y0, y1, color, width=3, dash=14, gap=10):
    y = y0
    while y < y1:
        d.line([(x, y), (x, min(y + dash, y1))], fill=color, width=width)
        y += dash + gap


def dash_rect(d, box, color, width=3, dash=14, gap=10):
    x0, y0, x1, y1 = box
    dash_h(d, x0, x1, y0, color, width, dash, gap)
    dash_h(d, x0, x1, y1, color, width, dash, gap)
    dash_v(d, x0, y0, y1, color, width, dash, gap)
    dash_v(d, x1, y0, y1, color, width, dash, gap)


# ---------------- 配色（与图 3.1 同族） ----------------
C_EXEC_F, C_EXEC_L = "#FBE5D6", "#C55A11"
C_CTRL_F, C_CTRL_L = "#FFF2CC", "#BF8F00"
C_DATA_F, C_DATA_L = "#E2EFDA", "#548235"
C_DEC_F, C_DEC_L = "#DCE9F7", "#2F5597"
GRAY_F, GRAY_L = "#E7E6E6", "#595959"
INK = (25, 25, 25)
SUB = (70, 70, 70)

W, H = 2000, 940
img = Image.new("RGB", (W, H), "white")
d = ImageDraw.Draw(img)

f_title = F(42, bold=True)
f_box = F(33, bold=True)
f_sub = F(22)
f_note = F(27)
f_tiny = F(23)

# ================= (a) 俯视图 =================
d.text((90, 52), "（a）工位布局（俯视图）", font=f_title, fill=INK)

BX0, BY0, BX1, BY1 = 90, 150, 1190, 700
d.rectangle((BX0, BY0, BX1, BY1), fill="#FBFBFB", outline="#8C8C8C", width=3)

# 背部导轨
rrect(d, (130, 168, 1150, 208), 10, C_CTRL_F, C_CTRL_L, 3)
tc(d, (130, 168, 1150, 208), "⑤ 三轴转运机构（X 向导轨 + 快换夹爪）", F(28, bold=True), fill=(90, 60, 0))
d.rectangle((632, 208, 664, 268), fill=C_CTRL_F, outline=C_CTRL_L, width=3)
d.rectangle((638, 268, 658, 290), fill="#FFFFFF", outline=C_CTRL_L, width=2)

# 台面尺寸注记（避让导轨与工位）
d.text((BX0 + 14, BY0 + 74), "台面 1600 mm × 800 mm", font=f_tiny, fill=(120, 120, 120))

stations = [
    ("①", "配液工位", "精密天平\n多通道泵\npH 电极 · 定容"),
    ("②", "材料制备", "恒温槽\n可编程电源\n三电极沉积工装"),
    ("③", "电化学测试", "多通道恒电位仪\nKOH 电解池\n自动换样机构"),
    ("④", "清洗工位", "多级冲洗·吹干\n废液分类\n液位监测"),
]
SX = [140, 400, 660, 920]
SY0, SY1 = 310, 530
SW = 220
for i, (num, name, sub) in enumerate(stations):
    x0 = SX[i]
    rrect(d, (x0, SY0, x0 + SW, SY1), 14, C_EXEC_F, C_EXEC_L, 3)
    tc(d, (x0, SY0 + 8, x0 + SW, SY0 + 62), "%s %s" % (num, name), f_box, fill=(120, 50, 10))
    tc(d, (x0 + 6, SY0 + 66, x0 + SW - 6, SY1 - 12), sub, f_sub, fill=SUB)

# 工位间转运箭头
for i in range(3):
    x_from = SX[i] + SW + 2
    x_to = SX[i + 1] - 2
    d.line([(x_from, 420), (x_to, 420)], fill=C_CTRL_L, width=4)
    d.polygon([(x_to, 420), (x_to - 14, 412), (x_to - 14, 428)], fill=C_CTRL_L)

# 台下控制柜（虚线）
dash_rect(d, (140, 600, 1140, 668), "#595959", 3)
tc(d, (140, 600, 1140, 668), "⑥ 台下控制柜：工控机 / 驱动与 IO / 通信网关 / 急停回路（虚线示意）",
   F(27), fill=(70, 70, 70))

# 急停按钮（左下角）
d.ellipse((102, 600, 134, 632), fill="#C00000", outline="#7F0000", width=2)
d.text((104, 638), "急停", font=F(23, bold=True), fill="#7F0000")

# 操作侧标注（左侧，避开尺寸标注）
d.text((BX0, BY1 + 8), "正面（操作侧）", font=f_note, fill=(110, 110, 110))

# 宽度尺寸线
DY = 762
d.line([(BX0, DY), (BX1, DY)], fill="#595959", width=2)
d.polygon([(BX0, DY), (BX0 + 16, DY - 6), (BX0 + 16, DY + 6)], fill="#595959")
d.polygon([(BX1, DY), (BX1 - 16, DY - 6), (BX1 - 16, DY + 6)], fill="#595959")
tc(d, (BX0 + 480, DY - 44, BX0 + 640, DY - 6), "1600 mm", F(28), fill="#404040")

# 深度尺寸线（右侧）
DX = 1235
d.line([(DX, BY0), (DX, BY1)], fill="#595959", width=2)
d.polygon([(DX, BY0), (DX - 6, BY0 + 16), (DX + 6, BY0 + 16)], fill="#595959")
d.polygon([(DX, BY1), (DX - 6, BY1 - 16), (DX + 6, BY1 - 16)], fill="#595959")
d.rectangle((DX - 2, BY0 + 245, DX + 100, BY0 + 290), fill="white")
d.text((DX + 6, BY0 + 250), "800 mm", font=F(28), fill="#404040")

# ================= (b) 正视图 =================
d.text((1400, 52), "（b）整机正视图", font=f_title, fill=INK)

CX0, CX1 = 1400, 1900
CY0, CY1 = 150, 760

d.rectangle((CX0, CY0, CX1, CY0 + 40), fill=GRAY_F, outline=GRAY_L, width=3)
tc(d, (CX0, CY0, CX1, CY0 + 40), "排风接口（接实验室排风）", F(26, bold=True), fill=(60, 60, 60))

d.rectangle((CX0, CY0 + 40, CX1, CY1), fill="#FFFFFF", outline=GRAY_L, width=4)

# 透明观察窗 + 内部示意
wx0, wy0, wx1, wy1 = CX0 + 26, CY0 + 72, CX1 - 26, CY0 + 408
d.rectangle((wx0, wy0, wx1, wy1), fill=C_DEC_F, outline=C_DEC_L, width=3)
tc(d, (wx0, wy0 + 10, wx1, wy0 + 52), "透明防护罩 / 观察窗（可观察内部运行）", F(24, bold=True), fill=(30, 70, 140))

bench_y = wy0 + 268
d.line([(wx0 + 10, bench_y), (wx1 - 10, bench_y)], fill="#8C8C8C", width=6)
d.text((wx0 + 12, bench_y + 6), "内部台面", font=F(21), fill=(120, 120, 120))
bw, bg = 76, 20
bx_start = wx0 + 20
for i, num in enumerate(["①", "②", "③", "④"]):
    bx = bx_start + i * (bw + bg)
    d.rounded_rectangle((bx, bench_y - 64, bx + bw, bench_y), radius=6,
                        fill=C_EXEC_F, outline=C_EXEC_L, width=2)
    tc(d, (bx, bench_y - 64, bx + bw, bench_y), num, F(24, bold=True), fill=(120, 50, 10))

# 控制柜
cy0 = CY0 + 432
d.rectangle((wx0, cy0, wx1, CY1 - 16), fill=GRAY_F, outline=GRAY_L, width=3)
tc(d, (wx0, cy0 + 6, wx1, cy0 + 52), "控制柜", F(30, bold=True), fill=(50, 50, 50))
tc(d, (wx0, cy0 + 56, wx1, cy0 + 130), "工控机 / 驱动与 IO\n通信网关 / 安全联锁回路", f_sub, fill=(60, 60, 60))

# 触摸屏（右侧挂臂）
hx0, hy0 = CX1 + 10, CY0 + 200
d.line([(CX1, hy0 + 48), (hx0, hy0 + 48)], fill=GRAY_L, width=4)
rrect(d, (hx0, hy0, hx0 + 84, hy0 + 96), 8, C_DEC_F, C_DEC_L, 3)
tc(d, (hx0, hy0, hx0 + 84, hy0 + 96), "触摸屏", F(23, bold=True), fill=(30, 70, 140))

# 地脚
for fx in (CX0 + 40, CX1 - 62):
    d.rectangle((fx, CY1, fx + 22, CY1 + 15), fill=GRAY_F, outline=GRAY_L, width=2)
d.text((CX0 + 150, CY1 + 18), "可调地脚", font=f_tiny, fill=(120, 120, 120))

tc(d, (CX0 - 80, CY1 + 48, CX1 + 100, CY1 + 88),
   "外形约 1600 × 800 × 1900 mm（防护罩闭合状态）", f_note, fill=(90, 90, 90))

# ================= 图例 =================
ly = 866
d.line([(100, ly + 12), (168, ly + 12)], fill=C_CTRL_L, width=4)
d.polygon([(168, ly + 12), (154, ly + 4), (154, ly + 20)], fill=C_CTRL_L)
d.text((180, ly - 2), "样品转运路径", font=f_note, fill=SUB)

dash_rect(d, (470, ly - 6, 552, ly + 30), "#595959", 2, dash=8, gap=6)
d.text((566, ly - 2), "台下隐藏部件（虚线示意）", font=f_note, fill=SUB)

d.text((1060, ly - 2), "注：示意图，各视图非等比例", font=f_tiny, fill=(130, 130, 130))

path = os.path.join(OUT, "fig3_2_workstation.png")
img.save(path, dpi=(300, 300))
print("saved", path, img.size)
