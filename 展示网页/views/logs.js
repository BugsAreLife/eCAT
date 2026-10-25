/* 视图 ⑥：告警与日志（分级告警 / 诊断树 / 审计日志） */
(function (A, D) {
  "use strict";
  const K = A.kit;

  function levelBadge(level) {
    if (level === "stop") return K.badge("error", "停机");
    if (level === "hold") return K.badge("warn", "挂起");
    return K.badge("info", "提示");
  }

  A.views.logs = function (root) {
    const S = A.state;
    const alarms = A.sim.getAlarms();
    const traces = A.sim.getTraces();

    const alarmRows = alarms.map(a => {
      const open = S.expandedAlarm === a.id;
      return {
        attrs: ' data-alarm="' + a.id + '"' + (open ? ' class="sel"' : ""),
        cells: [
          "<b>" + a.id + "</b>",
          a.time,
          levelBadge(a.level),
          K.esc(a.title),
          '<span class="muted">' + K.esc(a.part) + "</span>",
          a.recovered ? '<span class="badge b-run">已恢复' + (a.dur ? "（" + a.dur + " s）" : "") + "</span>" :
            '<span class="badge b-err">处理中</span>',
        ],
      };
    });

    // 展开的诊断详情
    let detail = "";
    const cur = alarms.find(a => a.id === S.expandedAlarm);
    if (cur) {
      detail = K.card("告警详情 · " + cur.id + "（" + cur.title + "）",
        K.kv("级别", levelBadge(cur.level)) +
        K.kv("涉及部件", cur.part) +
        K.kv("症状", K.esc(cur.symptom)) +
        '<div style="margin-top:10px"><b>诊断树（症状 → 验证动作 → 判定）</b>' +
        '<ol style="margin:6px 0 0 18px;padding:0;font-size:12.5px;color:#46536a">' +
        "<li>验证通信心跳：读取设备状态寄存器 → " + (cur.level === "stop" ? "无响应（通信类）" : "正常（排除通信）") + "</li>" +
        "<li>验证执行器反馈：泵/加热输出与回读比对 → " + (cur.part.indexOf("PUMP") >= 0 ? "出口压力持续偏高" : "执行器反馈正常") + "</li>" +
        "<li>验证传感器：与冗余检测交叉比对 → " + (cur.part.indexOf("BOTTLE") >= 0 ? "液位确实低于阈值" : "无矛盾") + "</li>" +
        "<li>判定：" + (cur.level === "stop" ? "需人工确认后复位" : "可自动处置") + "</li>" +
        "</ol></div>" +
        K.kv("处置策略", K.esc(cur.action)) +
        K.kv("恢复状态", cur.recovered ? "已自动恢复（检查点续跑）" : "进行中"),
        "诊断");
    }

    const traceRows = traces.map(t => ({
      cells: [
        "<b>" + t.id + "</b>",
        t.time,
        K.esc(t.request.length > 26 ? t.request.slice(0, 26) + "…" : t.request),
        "<span class='chip'>" + K.esc(t.tool) + "</span>",
        K.esc(t.validation),
        K.esc(t.result),
      ],
    }));

    const logHtml = S.logs.slice(0, 20).map(l => {
      const cls = l.level === "e" ? "e" : l.level === "w" ? "w" : "";
      return "<div class='" + cls + "'><span class='t'>" + A.fmt.hhmmss(l.ts) + "</span>" + K.esc(l.msg) + "</div>";
    }).join("") || '<div class="muted">暂无事件</div>';

    root.innerHTML =
      K.card("告警列表（" + alarms.length + " 条，点击查看诊断）",
        K.table(["编号", "时间", "级别", "类型", "部件", "状态"], alarmRows), "无人值守核心") +
      detail +
      '<div class="grid g2">' +
      K.card("审计日志（指令级）", K.table(["编号", "时间", "请求", "工具", "校验", "结果"], traceRows)) +
      K.card("事件日志（" + S.logs.length + " 条）", '<div class="log">' + logHtml + "</div>") +
      "</div>" +
      K.card("说明",
        '<div class="muted" style="line-height:1.7">' +
        "· 告警分级：<b>提示</b>（仅记录）→ <b>挂起</b>（暂停任务等待确认）→ <b>停机</b>（立即中断并通知）<br>" +
        "· 每条指令带 requestId，可回溯到发起人、校验结果与执行效果（对应改造规格书 R-21 / 报告 4.6 审计）<br>" +
        "· 本页数据为模拟生成，用于演示分级与回溯能力" +
        "</div>");

    // 交互：展开告警
    root.querySelectorAll("[data-alarm]").forEach(el => {
      el.addEventListener("click", () => {
        const id = el.getAttribute("data-alarm");
        S.expandedAlarm = S.expandedAlarm === id ? null : id;
        A.render();
      });
    });
  };
})(window.APP, window.DATA);
