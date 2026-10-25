/* 视图 ⑤：Agent 工作台（对话 / 推荐候选 / 工具调用审计链） */
(function (A, D) {
  "use strict";
  const K = A.kit;

  // 脚本化应答（演示用；真实版本接 LLM API）
  function reply(text) {
    const t = text || "";
    const S = A.state;
    if (/失败|无效|R-004|为什么/.test(t)) {
      return {
        text: "R-004 判定为无效：第 3 道工序（电化学测试）出现参比电极漂移，η10 曲线在 -180 mV 附近出现台阶。\n" +
          "处置：该轮数据不参与优化模型训练，已标记为失败样本；下一轮已在测试前增加 5 min 开路稳定判据。",
        trace: { tool: "diagnoseRound", params: { round: "R-004", symptom: "参比漂移" },
          validation: "通过（规则+历史案例匹配）", result: "输出 3 条可能原因与验证步骤" },
      };
    }
    if (/下一轮|配方|试什么|推荐|候选/.test(t)) {
      return {
        text: "基于 R-001～R-008 数据与文献[13]，用 GP-EI 在约束（pH≤9.5、T≤70 ℃）内推荐 3 个候选。\n" +
          "预期最优：C-1（Mo 24%，预测 η10≈58 mV）。是否要我生成实验计划？",
        trace: { tool: "recommend", params: { model: "GP-EI", candidates: 3 },
          validation: "通过（3 个候选均在可行域内）", result: "返回 3 个候选，等待人工批准" },
      };
    }
    if (/异常|报警|故障|堵塞/.test(t)) {
      return {
        text: "最近一次异常是「泵管堵塞」：P3 出口压力 > 阈值持续 5 s。\n" +
          "处置链：暂停当前工序 → 回读设备状态 → 回退到最近检查点 → 重试 1/3；成功后从检查点续跑，未丢数据。\n" +
          "若连续 3 次失败，会升级为二级挂起并通知人工。",
        trace: { tool: "handleFault", params: { part: "M-PUMP-03", strategy: "retry+checkpoint" },
          validation: "通过（安全联锁未触发）", result: "自动恢复，耗时 5 s" },
      };
    }
    return {
      text: "我可以做三件事：①解释某一轮为什么失败；②基于历史数据推荐下一轮配方；③解释当前异常的处理过程。\n" +
        "所有动作都会先经过技能库校验，高风险操作需要你确认。",
      trace: null,
    };
  }

  A.views.agent = function (root) {
    const S = A.state;
    const cands = A.sim.getCandidates();
    const traces = A.sim.getTraces();

    const chatHtml = S.chat.map(m =>
      '<div class="row" style="align-items:flex-start">' +
      '<span class="badge ' + (m.role === "agent" ? "b-info" : "b-run") + '">' + (m.role === "agent" ? "Agent" : "我") + "</span>" +
      '<span class="nm" style="white-space:pre-wrap;overflow:visible;text-overflow:clip">' + K.esc(m.text) + "</span></div>"
    ).join("");

    const candHtml = cands.map(c =>
      '<div class="cand' + (S.selectedCand === c.id ? " sel" : "") + '" data-cand="' + c.id + '">' +
      '<div class="t">' + c.id + " · " + K.esc(c.recipe) + K.badge("info", "预测 η10 " + c.eta + " mV") + "</div>" +
      '<div class="m">风险：' + K.esc(c.risk) + '</div>' +
      '<div class="e">证据：' + c.evidence.map(K.esc).join("；") + "</div></div>"
    ).join("");

    const traceHtml = traces.map(t =>
      '<div class="trace" data-trace="' + t.id + '">' +
      '<div class="hd"><b>' + t.id + "</b><span class='muted'>" + t.time + "</span>" +
      '<span class="grow"></span><span class="chip">' + t.tool + "</span></div>" +
      '<div class="m">' + K.esc(t.request) + "</div>" +
      '<div class="bd"><ol>' +
      "<li><b>请求</b>：" + K.esc(t.request) + "</li>" +
      "<li><b>参数</b>：" + K.esc(JSON.stringify(t.params)) + "</li>" +
      "<li><b>技能库校验</b>：" + K.esc(t.validation) + "</li>" +
      "<li><b>执行结果</b>：" + K.esc(t.result) + "</li>" +
      "</ol></div></div>"
    ).join("");

    root.innerHTML =
      '<div class="grid g23">' +
      K.card("Agent 对话", '<div style="max-height:300px;overflow:auto;padding-right:4px">' + chatHtml + "</div>" +
        '<div style="display:flex;gap:8px;margin-top:10px">' +
        '<input id="chatIn" type="text" placeholder="问它：这轮为什么失败 / 下一轮试什么">' +
        '<button id="chatSend" class="primary">发送</button></div>' +
        '<div class="muted" style="margin-top:8px">演示模式：脚本化应答；真实版本接 LLM API + 文献库检索</div>', "演示") +
      K.card("推荐候选（闭环优化输出）", candHtml +
        '<div class="btnrow"><button id="btnApprove" class="primary">批准选中候选</button>' +
        '<button id="btnReject">否决</button></div>' +
        '<div class="muted" style="margin-top:8px">候选由贝叶斯优化（GP-EI）在可行域内生成；批准后转为实验任务</div>',
        "3 候选") +
      "</div>" +

      K.card("工具调用审计链（Agent 请求 → 技能库校验 → 控制层执行）",
        traceHtml + '<div class="muted" style="margin-top:6px">点击任一记录展开完整四段链路</div>',
        "审计");

    // 交互
    const input = root.querySelector("#chatIn");
    function send() {
      const v = (input.value || "").trim();
      if (!v) return;
      S.chat.push({ role: "user", text: v });
      const r = reply(v);
      S.chat.push({ role: "agent", text: r.text });
      A.state.traces.unshift({
        id: "TC-" + (2100 + A.state.traces.length), time: A.fmt.hhmmss(),
        request: v, tool: r.trace ? r.trace.tool : "answer",
        params: r.trace ? r.trace.params : {},
        validation: r.trace ? r.trace.validation : "通过（纯查询）",
        result: r.trace ? r.trace.result : "返回说明文本",
      });
      A.log("Agent 回复：已按脚本生成解释并记录审计链");
      A.render();
    }
    root.querySelector("#chatSend").addEventListener("click", send);
    input.addEventListener("keydown", e => { if (e.key === "Enter") send(); });

    root.querySelectorAll("[data-cand]").forEach(el => {
      el.addEventListener("click", () => {
        S.selectedCand = el.getAttribute("data-cand");
        A.render();
      });
    });

    root.querySelector("#btnApprove").addEventListener("click", () => {
      const c = cands.find(x => x.id === S.selectedCand) || cands[0];
      A.log("已批准候选 " + c.id + "（预测 η10 " + c.eta + " mV），已转为实验任务 T-016", "ok");
      A.state.traces.unshift({
        id: "TC-" + (2150 + A.state.traces.length), time: A.fmt.hhmmss(),
        request: "批准候选 " + c.id + " 并生成实验计划", tool: "approveCandidate",
        params: { candidate: c.id, recipe: c.recipe },
        validation: "通过（人工批准，参数在可行域内）", result: "已生成任务 T-016 并入队",
      });
      A.render();
    });

    root.querySelector("#btnReject").addEventListener("click", () => {
      const c = cands.find(x => x.id === S.selectedCand) || cands[0];
      A.log("已否决候选 " + c.id + "（人工判断风险偏高），记录原因待下一轮参考", "w");
      A.render();
    });

    root.querySelectorAll("[data-trace]").forEach(el => {
      el.addEventListener("click", () => {
        el.classList.toggle("open");
        S.selectedTrace = el.getAttribute("data-trace");
      });
    });
  };
})(window.APP, window.DATA);
