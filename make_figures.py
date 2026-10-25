# -*- coding: utf-8 -*-
"""生成报告插图：系统总体架构图 / 闭环优化流程图"""
import os
from PIL import Image, ImageDraw, ImageFont

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fig")
os.makedirs(OUT, exist_ok=True)

MSYH = r"C:\Windows\Fonts\msyh.ttc"
MSYHB = r"C:\Windows\Fonts\msyhbd.ttc"


def F(size, bold=False):
    return ImageFont.truetype(MSYHB if bold else MSYH, size)


def text_center(d, box, s, font, fill=(20, 20, 20)):
    x0, y0, x1, y1 = box
    b = d.textbbox((0, 0), s, font=font)
    w, h = b[2] - b[0], b[3] - b[1]
    d.text((x0 + (x1 - x0 - w) / 2 - b[0], y0 + (y1 - y0 - h) / 2 - b[1]), s, font=font, fill=fill)


def rrect(d, box, r, fill, outline, width=3):
    d.rounded_rectangle(box, radius=r, fill=fill, outline=outline, width=width)


def arrow_v(d, x, y0, y1, color, width=4):
    d.line([(x, y0), (x, y1)], fill=color, width=width)
    s = 14
    d.polygon([(x - s, y1 - s * 1.6), (x + s, y1 - s * 1.6), (x, y1)], fill=color)


def arrow_h(d, x0, x1, y, color, width=4):
    d.line([(x0, y), (x1, y)], fill=color, width=width)
    s = 14
    d.polygon([(x1 - s * 1.6, y - s), (x1 - s * 1.6, y + s), (x1, y)], fill=color)


# ---------------- 图 3.1 系统总体架构 ----------------
def fig_architecture():
    W, H = 2000, 1180
    img = Image.new("RGB", (W, H), "white")
    d = ImageDraw.Draw(img)

    f_layer = F(38, bold=True)
    f_mod = F(34)
    f_mod2 = F(32)
    f_note = F(32)

    layers = [
        ("智能决策层", "#DCE9F7", "#2F5597", ["AI Agent\n任务规划与调度", "异常诊断\n与恢复决策", "结果分析与\n下一轮配方推荐"]),
        ("数据与状态层", "#E2EFDA", "#548235", ["实验数据库 / ELN", "实验状态机\n与事件流", "设备语义模型", "审计日志"]),
        ("设备控制层", "#FFF2CC", "#BF8F00", ["协议适配\nModbus/SCPI/OPC UA", "工序编排\n与指令队列", "安全联锁\n与急停"]),
        ("实验执行层", "#FBE5D6", "#C55A11", ["配液模块", "材料制备模块", "电化学测试模块", "转移/清洗模块"]),
    ]

    left, right = 60, W - 60
    label_w = 290
    y = 40
    band_h = 205
    gap = 55
    centers = []
    for name, fill, line, mods in layers:
        rrect(d, (left, y, right, y + band_h), 18, fill, line, 3)
        # 左侧层名
        d.rectangle((left, y, left + label_w, y + band_h), fill=line)
        d.rectangle((left, y, left + label_w, y + band_h), fill=line)
        text_center(d, (left, y, left + label_w, y + band_h), name, f_layer, fill="white")
        # 模块框
        x0 = left + label_w + 40
        x1 = right - 40
        n = len(mods)
        bw = (x1 - x0 - 24 * (n - 1)) / n
        for i, m in enumerate(mods):
            bx0 = x0 + i * (bw + 24)
            box = (bx0, y + 45, bx0 + bw, y + band_h - 45)
            fnt = f_mod if "\n" in m else f_mod
            rrect(d, box, 12, "white", line, 2)
            text_center(d, box, m, fnt, fill=(30, 30, 30))
        centers.append((y, y + band_h))
        y += band_h + gap

    # 层间双向箭头
    for i in range(len(layers) - 1):
        y_from = centers[i][1]
        y_to = centers[i + 1][0]
        xm = (left + right) / 2
        for dx in (-120, 120):
            arrow_v(d, xm + dx, y_from + 6, y_to - 6, "#7F7F7F", 4)
        text_center(d, (xm - 110, y_from, xm + 110, y_to), "", f_note)

    # 右侧外部资源
    d.line([(left, H - 55), (right, H - 55)], fill=(200, 200, 200), width=2)
    note = "外部资源：文献知识库 · 材料数据库 · 设备技术文档 · 实验标准作业程序（SOP）"
    text_center(d, (left, H - 48, right, H - 8), note, f_note, fill=(90, 90, 90))

    img.save(os.path.join(OUT, "fig3_1_architecture.png"), dpi=(300, 300))
    print("saved fig3_1_architecture.png", img.size)


# ---------------- 图 5.1 闭环 ----------------
def fig_closed_loop():
    W, H = 2000, 760
    img = Image.new("RGB", (W, H), "white")
    d = ImageDraw.Draw(img)
    f_box = F(40, bold=True)
    f_sub = F(30)
    stages = [
        ("实验设计", "配方/工艺窗口\n主动学习推荐"),
        ("自动执行", "工序编排\n设备协同"),
        ("状态反馈", "事件流\n指标采集"),
        ("结果分析", "性能评价\n归因分析"),
        ("再设计", "知识沉淀\n候选更新"),
    ]
    n = len(stages)
    bw, bh = 330, 200
    gapx = (W - 80 - bw * n) / (n - 1)
    y0 = 150
    boxes = []
    for i, (name, sub) in enumerate(stages):
        x0 = 40 + i * (bw + gapx)
        box = (x0, y0, x0 + bw, y0 + bh)
        fill = "#DCE9F7" if i % 2 == 0 else "#E2EFDA"
        line = "#2F5597" if i % 2 == 0 else "#548235"
        rrect(d, box, 16, fill, line, 3)
        text_center(d, (x0, y0 + 15, x0 + bw, y0 + 85), name, f_box)
        text_center(d, (x0, y0 + 85, x0 + bw, y0 + bh - 15), sub, f_sub, fill=(70, 70, 70))
        boxes.append(box)
        if i < n - 1:
            arrow_h(d, x0 + bw + 8, x0 + bw + gapx - 8, y0 + bh / 2, "#7F7F7F", 5)

    # 反馈箭头：从最后一个框下方回指第一个框
    yb = H - 90
    first, last = boxes[0], boxes[-1]
    cx_first = (first[0] + first[2]) / 2
    cx_last = (last[0] + last[2]) / 2
    d.line([(cx_last, last[3] + 8), (cx_last, yb)], fill="#C00000", width=5)
    d.line([(cx_last, yb), (cx_first, yb)], fill="#C00000", width=5)
    d.line([(cx_first, yb), (cx_first, first[3] + 8)], fill="#C00000", width=5)
    s = 16
    d.polygon([(cx_first - s, first[3] + 8 + s * 1.8), (cx_first + s, first[3] + 8 + s * 1.8), (cx_first, first[3] + 8)], fill="#C00000")
    text_center(d, (cx_first + 100, yb - 112, cx_last - 100, yb - 54),
                "实验数据与知识回流：驱动下一轮实验设计", F(34), fill="#C00000")

    img.save(os.path.join(OUT, "fig5_1_closed_loop.png"), dpi=(300, 300))
    print("saved fig5_1_closed_loop.png", img.size)


fig_architecture()
fig_closed_loop()
