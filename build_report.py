# -*- coding: utf-8 -*-
"""
在《附件2作品报告书模板.docx》基础上生成作品报告书。
策略：保留模板的封面/承诺书/分节/页眉/页码体系，替换正文内容与目录域。
"""
import os
import shutil
from docx import Document
from docx.shared import Pt, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import parse_xml
from docx.oxml.ns import qn, nsdecls

import content_a as A
import content_b as B

HERE = os.path.dirname(os.path.abspath(__file__))
TPL = os.path.join(HERE, "附件2作品报告书模板.docx")
OUT = os.path.join(HERE, "作品报告书-基于AI Agent的析氢催化剂智能优化系统.docx")

# 目录页码（依据最终版式渲染实测校准，正文页码从 1 起算）
PAGES = {
    "第一章  绪论": 1,
    "1.1  研究背景与意义": 1,
    "1.2  国内外研究现状": 1,
    "1.3  现有技术缺口": 3,
    "1.4  研究目标与主要工作": 3,
    "第二章  析氢催化剂湿实验流程解构与需求分析": 4,
    "2.1  典型湿实验流程与工序拆分": 4,
    "2.2  实验对象与关键性能指标": 4,
    "2.3  工序自动化可行性评估": 4,
    "2.4  系统需求指标体系": 5,
    "2.5  本章小结": 6,
    "第三章  自动化实验平台总体方案": 6,
    "3.1  总体架构": 6,
    "3.2  功能模块划分": 7,
    "3.3  模块接口与协同机制": 7,
    "3.4  安全联锁与可靠性设计": 8,
    "3.5  本章小结": 8,
    "第四章  面向实验过程的 AI Agent 系统设计": 8,
    "4.1  设计约束分析": 8,
    "4.2  Agent 总体架构": 9,
    "4.3  实验状态感知与语义建模": 9,
    "4.4  技能库与工具调用规范": 10,
    "4.5  异常处置与人在环机制": 10,
    "4.6  可靠性护栏设计": 11,
    "4.7  本章小结": 11,
    "第五章  实验反馈驱动的材料优化闭环机制": 12,
    "5.1  实验结果结构化与知识沉淀": 12,
    "5.2  文献与历史数据联合检索": 12,
    "5.3  候选方案生成与主动学习推荐": 12,
    "5.4  闭环流程与迭代控制": 13,
    "5.5  本章小结": 14,
    "第六章  系统验证方案与应用前景": 14,
    "6.1  验证目标与评价指标": 14,
    "6.2  分级验证用例": 14,
    "6.3  异常注入测试设计": 15,
    "6.4  实施计划与里程碑": 15,
    "6.5  应用前景与转化路径": 15,
    "6.6  本章小结": 16,
    "支撑材料": 16,
    "参考文献": 16,
    "致谢": 17,
}

NS = nsdecls("w")


# --------------------------------------------------------------------------
# 样式定义
# --------------------------------------------------------------------------
def style_xml(style_id, name, ppr, rpr, based_on="1"):
    return (
        '<w:style %s w:type="paragraph" w:customStyle="1" w:styleId="%s">'
        '<w:name w:val="%s"/><w:basedOn w:val="%s"/><w:qFormat/>%s%s</w:style>'
        % (NS, style_id, name, based_on, ppr, rpr)
    )


def rpr(fonts_cn, size_half_pt, bold=False, kern=2):
    b = "<w:b/>" if bold else '<w:b w:val="0"/>'
    return (
        '<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" '
        'w:eastAsia="%s" w:cs="Times New Roman"/>%s<w:kern w:val="%d"/>'
        '<w:sz w:val="%d"/><w:szCs w:val="%d"/>'
        '<w:lang w:val="en-US" w:eastAsia="zh-CN"/></w:rPr>'
        % (fonts_cn, b, kern, size_half_pt, size_half_pt)
    )


def add_styles(doc):
    styles_el = doc.styles.element

    # 正文：小四宋体，1.25 倍行距，段前后 0.25 行，首行缩进 2 字符
    styles_el.append(parse_xml(style_xml(
        "ZW", "正文",
        '<w:pPr><w:widowControl w:val="0"/><w:snapToGrid w:val="0"/>'
        '<w:spacing w:beforeLines="25" w:afterLines="25" w:line="300" w:lineRule="auto"/>'
        '<w:ind w:firstLineChars="200" w:firstLine="480"/><w:jc w:val="both"/></w:pPr>',
        rpr("宋体", 24))))

    # 标题2：小四宋体加粗，顶格
    styles_el.append(parse_xml(style_xml(
        "BT2", "标题2",
        '<w:pPr><w:keepNext/><w:widowControl w:val="0"/><w:snapToGrid w:val="0"/>'
        '<w:spacing w:beforeLines="50" w:afterLines="50" w:line="300" w:lineRule="auto"/>'
        '<w:ind w:left="0" w:firstLine="0"/><w:jc w:val="left"/>'
        '<w:outlineLvl w:val="1"/></w:pPr>',
        rpr("宋体", 24, bold=True))))

    # 标题3：小四宋体，顶格
    styles_el.append(parse_xml(style_xml(
        "BT3", "标题3",
        '<w:pPr><w:keepNext/><w:widowControl w:val="0"/><w:snapToGrid w:val="0"/>'
        '<w:spacing w:beforeLines="25" w:afterLines="25" w:line="300" w:lineRule="auto"/>'
        '<w:ind w:left="0" w:firstLine="0"/><w:jc w:val="left"/>'
        '<w:outlineLvl w:val="2"/></w:pPr>',
        rpr("宋体", 24))))

    # 表图题注：五号黑体居中，与图表同页
    styles_el.append(parse_xml(style_xml(
        "BTTC", "表图题",
        '<w:pPr><w:keepNext/><w:widowControl w:val="0"/><w:snapToGrid w:val="0"/>'
        '<w:spacing w:beforeLines="50" w:afterLines="25" w:line="240" w:lineRule="auto"/>'
        '<w:ind w:firstLine="0"/><w:jc w:val="center"/></w:pPr>',
        rpr("黑体", 21))))

    # 插图：居中，无缩进（图题用 BTTC，但图题在其后，不需要 keepNext）
    styles_el.append(parse_xml(style_xml(
        "CT", "插图",
        '<w:pPr><w:widowControl w:val="0"/><w:snapToGrid w:val="0"/>'
        '<w:spacing w:beforeLines="25" w:afterLines="25" w:line="240" w:lineRule="auto"/>'
        '<w:ind w:firstLine="0"/><w:jc w:val="center"/>'
        '<w:keepNext/></w:pPr>',
        rpr("宋体", 21))))

    # 表格内文字：五号宋体，单倍行距，居中
    styles_el.append(parse_xml(style_xml(
        "BGWZ", "表格文字",
        '<w:pPr><w:widowControl w:val="0"/><w:snapToGrid w:val="0"/>'
        '<w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/>'
        '<w:ind w:firstLine="0"/><w:jc w:val="center"/></w:pPr>',
        rpr("宋体", 21))))

    # 参考文献条目：五号宋体，悬挂缩进，条目内不跨页
    styles_el.append(parse_xml(style_xml(
        "CKWX", "参考文献条目",
        '<w:pPr><w:keepLines/><w:widowControl w:val="0"/><w:snapToGrid w:val="0"/>'
        '<w:spacing w:beforeLines="0" w:afterLines="0" w:line="300" w:lineRule="auto"/>'
        '<w:ind w:left="420" w:hanging="420"/><w:jc w:val="both"/></w:pPr>',
        rpr("宋体", 21))))

    # 摘要段落（无首行缩进差异，沿用正文；单独留出样式以备调整）
    styles_el.append(parse_xml(style_xml(
        "ZY", "摘要正文",
        '<w:pPr><w:widowControl w:val="0"/><w:snapToGrid w:val="0"/>'
        '<w:spacing w:beforeLines="50" w:afterLines="50" w:line="300" w:lineRule="auto"/>'
        '<w:ind w:firstLineChars="200" w:firstLine="480"/><w:jc w:val="both"/></w:pPr>',
        rpr("宋体", 24))))

    # 封面主标题（承接原“标题1”的视觉，避免修改章节标题样式后封面变形）
    styles_el.append(parse_xml(
        '<w:style %s w:type="paragraph" w:customStyle="1" w:styleId="FMBT">'
        '<w:name w:val="封面主标题"/><w:basedOn w:val="1"/><w:qFormat/>'
        '<w:pPr><w:spacing w:before="120" w:after="120"/><w:jc w:val="center"/></w:pPr>'
        '<w:rPr><w:rFonts w:ascii="微软雅黑" w:hAnsi="微软雅黑" w:eastAsia="微软雅黑" w:cs="微软雅黑"/>'
        '<w:b/><w:kern w:val="2"/><w:sz w:val="36"/><w:szCs w:val="36"/>'
        '<w:lang w:val="en-US" w:eastAsia="zh-CN"/></w:rPr></w:style>' % NS))

    # 重定义“标题1”：4 号黑体居中，段前后各一行，outlineLvl=0
    st = doc.styles["标题1"].element
    for tag in ("w:pPr", "w:rPr"):
        old = st.find(qn(tag))
        if old is not None:
            st.remove(old)
    st.append(parse_xml(
        '<w:pPr %s><w:keepNext/><w:widowControl w:val="0"/><w:snapToGrid w:val="0"/>'
        '<w:spacing w:beforeLines="100" w:afterLines="100" w:line="300" w:lineRule="auto"/>'
        '<w:ind w:firstLine="0"/><w:jc w:val="center"/>'
        '<w:outlineLvl w:val="0"/></w:pPr>' % NS))
    st.append(parse_xml(
        '<w:rPr %s><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" '
        'w:eastAsia="黑体" w:cs="Times New Roman"/><w:b w:val="0"/><w:kern w:val="2"/>'
        '<w:sz w:val="28"/><w:szCs w:val="28"/>'
        '<w:lang w:val="en-US" w:eastAsia="zh-CN"/></w:rPr>' % NS))


# --------------------------------------------------------------------------
# 通用小工具
# --------------------------------------------------------------------------
def clear_runs(p):
    for r in list(p.runs):
        r._r.getparent().remove(r._r)


def set_runs(p, parts):
    """parts: [(text, dict(bold=, underline=, size=, font=)), ...]"""
    clear_runs(p)
    for text, fmt in parts:
        r = p.add_run(text)
        f = r.font
        if fmt.get("bold") is not None:
            f.bold = fmt["bold"]
        if fmt.get("underline") is not None:
            f.underline = fmt["underline"]
        if fmt.get("size"):
            f.size = Pt(fmt["size"])
        if fmt.get("font"):
            f.name = fmt["font"]
            r._r.get_or_add_rPr().rFonts.set(qn("w:eastAsia"), fmt["font"])


def cover_line(p, label, value, size=18, pad=0):
    set_runs(p, [(label, {"bold": True, "size": size, "font": "微软雅黑"}),
                 ("  ", {"size": size, "font": "微软雅黑"}),
                 (value + " " * pad, {"underline": True, "size": size, "font": "微软雅黑"})])


def cell_text(cell, text, bold=False):
    cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
    p = cell.paragraphs[0]
    p.style = "表格文字"
    clear_runs(p)
    r = p.add_run(text)
    r.font.size = Pt(10.5)
    r.font.name = "Times New Roman"
    r._r.get_or_add_rPr().rFonts.set(qn("w:eastAsia"), "黑体" if bold else "宋体")
    if bold:
        r.font.bold = True


def add_tbl_borders(tbl):
    tblPr = tbl._tbl.tblPr
    borders = parse_xml(
        '<w:tblBorders %s>'
        '<w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/>'
        '<w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/>'
        '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/>'
        '<w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/>'
        '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="000000"/>'
        '<w:insideV w:val="single" w:sz="4" w:space="0" w:color="000000"/>'
        '</w:tblBorders>' % NS)
    tblPr.insert_element_before(borders, "w:shd", "w:tblLayout", "w:tblCellMar",
                                "w:tblLook", "w:tblCaption", "w:tblDescription")


def add_para(doc, text, style, anchor):
    p = doc.add_paragraph(text, style=style)
    anchor.addprevious(p._p)
    return p


def add_toc_field(doc, entries, anchor):
    """在 anchor 之后插入 TOC 域（带静态缓存结果，Word 中可按 F9 更新）。"""
    def ppr(level):
        ind = "" if level == 1 else '<w:ind w:left="420" w:firstLine="0"/>'
        return ('<w:pPr><w:tabs><w:tab w:val="right" w:leader="dot" w:pos="9060"/></w:tabs>'
                '<w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/>'
                '%s<w:jc w:val="left"/></w:pPr>' % ind)

    def rpr_txt(level):
        if level == 1:
            return ('<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" '
                    'w:eastAsia="黑体" w:cs="Times New Roman"/><w:sz w:val="24"/></w:rPr>')
        return ('<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" '
                'w:eastAsia="宋体" w:cs="Times New Roman"/><w:sz w:val="21"/></w:rPr>')

    last = anchor
    for i, (level, text, page) in enumerate(entries):
        parts = []
        if i == 0:
            parts.append('<w:r><w:fldChar w:fldCharType="begin"/></w:r>'
                         '<w:r><w:instrText xml:space="preserve"> TOC \\o "1-2" \\h \\z \\u </w:instrText></w:r>'
                         '<w:r><w:fldChar w:fldCharType="separate"/></w:r>')
        parts.append('<w:r>%s<w:t xml:space="preserve">%s</w:t></w:r>' % (rpr_txt(level), text))
        parts.append('<w:r>%s<w:tab/><w:t>%s</w:t></w:r>' % (rpr_txt(level), page))
        if i == len(entries) - 1:
            parts.append('<w:r><w:fldChar w:fldCharType="end"/></w:r>')
        xml = '<w:p %s>%s%s</w:p>' % (NS, ppr(level), "".join(parts))
        p = parse_xml(xml)
        last.addnext(p)
        last = p


# --------------------------------------------------------------------------
# 主流程
# --------------------------------------------------------------------------
def main():
    shutil.copyfile(TPL, OUT)
    doc = Document(OUT)
    add_styles(doc)

    # 移除模板的“文档网格”：网格会让行高按 linePitch 吸附，实际行距远超 1.25 倍
    for s in doc.sections:
        dg = s._sectPr.find(qn("w:docGrid"))
        if dg is not None:
            s._sectPr.remove(dg)

    ps = list(doc.paragraphs)

    # ---------- 封面 ----------
    ps[0].style = doc.styles["封面主标题"]
    cover_line(ps[2], "作品类型", "总体设计方案", pad=6)
    cover_line(ps[4], "参赛院系", "【待填：参赛院系】", pad=2)
    # 赛题分两行：第一行标签 + 前半，第二行缩进 + 后半
    set_runs(ps[6], [("参赛赛题", {"bold": True, "size": 18, "font": "微软雅黑"}),
                     ("  ", {"size": 18, "font": "微软雅黑"}),
                     ("基于 AI Agent 的析氢催化剂", {"underline": True, "size": 18, "font": "微软雅黑"}),
                     ("        ", {"underline": True, "size": 18, "font": "微软雅黑"})])
    set_runs(ps[7], [("            ", {"size": 18, "font": "微软雅黑"}),
                     ("智能优化系统开发", {"underline": True, "size": 18, "font": "微软雅黑"}),
                     ("                      ", {"underline": True, "size": 18, "font": "微软雅黑"})])
    cover_line(ps[9], "参赛选手", "【待填：姓名（学号）、…】", pad=2)
    set_runs(ps[10], [(" " * 10, {"size": 18, "font": "微软雅黑"}),
                      (" " * 28, {"underline": True, "size": 18, "font": "微软雅黑"})])
    cover_line(ps[12], "指导教师", "施建峰    李洋", pad=8)

    # 删除封面提示行
    ps[3]._p.getparent().remove(ps[3]._p)

    # ---------- 作品题目 / 摘要 / 关键词 ----------
    set_runs(ps[29], [(A.TITLE, {"size": 16, "font": "黑体"})])
    ps[29].alignment = WD_ALIGN_PARAGRAPH.CENTER
    ps[29].paragraph_format.page_break_before = True   # 模板缺此分页，补上

    # ps[30] = 摘  要（保留原格式）
    ps[31]._p.getparent().remove(ps[31]._p)          # (不超过800字)

    abs_p = ps[32]
    abs_p.style = doc.styles["摘要正文"]
    clear_runs(abs_p)
    r = abs_p.add_run(A.ABSTRACT)
    r.font.size = Pt(12)
    r.font.name = "Times New Roman"
    r._r.get_or_add_rPr().rFonts.set(qn("w:eastAsia"), "宋体")

    ps[33]._p.getparent().remove(ps[33]._p)          # 撰写摘要注意事项

    kw_p = ps[34]
    kw_p.style = doc.styles["摘要正文"]
    pPr = kw_p._p.get_or_add_pPr()
    old_ind = pPr.find(qn("w:ind"))
    if old_ind is not None:
        pPr.remove(old_ind)
    pPr.append(parse_xml('<w:ind %s w:left="0" w:right="0" w:firstLine="0" w:firstLineChars="0"/>' % NS))
    set_runs(kw_p, [("关键词：", {"bold": True, "size": 12, "font": "宋体"}),
                    (A.KEYWORDS, {"size": 12, "font": "宋体"})])

    ps[35]._p.getparent().remove(ps[35]._p)          # 关键词数量提示

    # ---------- 目录 ----------
    # 删除模板缓存的目录条目与说明（保留 ps[38] 的分页符与 ps[54] 的分节符段落）
    for i in range(40, 54):
        ps[i]._p.getparent().remove(ps[i]._p)

    entries = []
    for kind, *rest in A.BLOCKS:
        if kind == "h1":
            entries.append((1, rest[0], PAGES.get(rest[0], 1)))
        elif kind == "h2":
            entries.append((2, rest[0], PAGES.get(rest[0], 1)))
    for kind, *rest in B.BLOCKS:
        if kind == "h1":
            entries.append((1, rest[0], PAGES.get(rest[0], 1)))
        elif kind == "h2":
            entries.append((2, rest[0], PAGES.get(rest[0], 1)))
    entries.append((1, "支撑材料", PAGES.get("支撑材料", 1)))
    entries.append((1, "参考文献", PAGES.get("参考文献", 1)))
    entries.append((1, "致谢", PAGES.get("致谢", 1)))
    add_toc_field(doc, entries, ps[39]._p)

    # ---------- 删除模板正文样例 ----------
    body = doc.element.body
    body_sectPr = body.find(qn("w:sectPr"))
    start_el = ps[55]._p          # 原“第一章”样例标题
    children = list(body.iterchildren())
    idx = children.index(start_el)
    for ch in children[idx:]:
        if ch is body_sectPr or ch.tag == qn("w:sectPr"):
            break
        body.remove(ch)

    # ---------- 写正文 ----------
    all_blocks = A.BLOCKS + B.BLOCKS
    for block in all_blocks:
        kind = block[0]
        if kind == "h1":
            add_para(doc, block[1], "标题1", body_sectPr)
        elif kind == "h2":
            add_para(doc, block[1], "标题2", body_sectPr)
        elif kind == "h3":
            add_para(doc, block[1], "标题3", body_sectPr)
        elif kind == "p":
            add_para(doc, block[1], "正文", body_sectPr)
        elif kind == "img":
            _, path, caption, width = block
            p = doc.add_paragraph(style="插图")
            p.add_run().add_picture(os.path.join(HERE, path), width=Cm(width))
            body_sectPr.addprevious(p._p)
            add_para(doc, caption, "表图题", body_sectPr)
        elif kind == "tbl":
            caption, header, rows, widths = block[1], block[2], block[3], block[4]
            merges = block[5] if len(block) > 5 else []
            add_para(doc, caption, "表图题", body_sectPr)
            ncol = len(header)
            tbl = doc.add_table(rows=len(rows) + 1, cols=ncol)
            tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
            tbl.autofit = False
            add_tbl_borders(tbl)
            for j, w in enumerate(widths):
                tbl.columns[j].width = Cm(w)
            for j, txt in enumerate(header):
                cell_text(tbl.cell(0, j), txt, bold=True)
            for i, row in enumerate(rows):
                for j, txt in enumerate(row):
                    cell_text(tbl.cell(i + 1, j), txt)
            # 纵向合并单元格（首列分组），合并后重写文字
            for col, r0, r1 in merges:
                merged = tbl.cell(r0 + 1, col)
                for r in range(r0 + 2, r1 + 2):
                    merged = merged.merge(tbl.cell(r, col))
                keep_text = rows[r0][col]
                for extra in merged.paragraphs[1:]:
                    extra._p.getparent().remove(extra._p)
                cell_text(merged, keep_text)
            for row in tbl.rows:
                for j, w in enumerate(widths):
                    row.cells[j].width = Cm(w)
                trPr = row._tr.get_or_add_trPr()
                trPr.append(parse_xml('<w:cantSplit %s/>' % NS))
                if row is tbl.rows[0]:
                    trPr.append(parse_xml('<w:tblHeader %s/>' % NS))
            # 除最后一行外全部 keepNext，使整表不被分页截断
            for row in tbl.rows[:-1]:
                for cell in row.cells:
                    for para in cell.paragraphs:
                        para.paragraph_format.keep_with_next = True
            body_sectPr.addprevious(tbl._tbl)
            # 表后空行
            add_para(doc, "", "正文", body_sectPr)

    # ---------- 支撑材料 / 参考文献 / 致谢 ----------
    add_para(doc, "支撑材料", "标题1", body_sectPr)
    add_para(doc, "本方案形成的支撑材料主要包括：", "正文", body_sectPr)
    for s in B.SUPPORT:
        add_para(doc, s, "正文", body_sectPr)
    add_para(doc, "上述材料随作品报告书一并提交，具体内容以附件形式附后。", "正文", body_sectPr)

    add_para(doc, "参考文献", "标题1", body_sectPr)
    for ref in B.REFERENCES:
        add_para(doc, ref, "参考文献条目", body_sectPr)

    add_para(doc, "致谢", "标题1", body_sectPr)
    add_para(doc, B.ACK, "正文", body_sectPr)

    doc.save(OUT)
    print("saved:", OUT)
    print("paragraphs:", len(doc.paragraphs), "tables:", len(doc.tables))


if __name__ == "__main__":
    main()
