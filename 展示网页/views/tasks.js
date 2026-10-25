/* 视图 ④：任务中心（一句话下单 → 解析 → 队列 → 工序 DAG） */
(function (A, D) {
  "use strict";
  const K = A.kit;

  const EXAMPLE = "筛选 Mo 20%–28% 的 Ni-Mo 镀层，目标 η10 < 60 mV，最多 8 轮";

  // 规则解析（演示用：预设意图 + 正则抽取，非大模型推理）
  function parse(text) {
    const out = { goal: {}, ranges: {}, raw: text, items: [] };
    let m;
    if ((m = text.match(/η10\s*[<≤]\s*(\d+)\s*mV/i)) || (m = text.match(/(\d+)\s*mV/))) {
      out.goal.eta10Max = +m[1];
      out.items.push("目标 η10 ≤ " + m[1] + " mV");
    }
    if ((m = text.match(/最多\s*(\d+)\s*轮/)) || (m = text.match(/(\d+)\s*轮/))) {
      out.goal.roundLimit = +m[1];
      out.items.push("轮次上限 " + m[1] + " 轮");
    }
    if ((m = text.match(/Mo\s*(\d+)\s*%\s*[–\-~到]\s*(\d+)\s*%/i)) || (m = text.match(/(\d+)\s*%?\s*[–\-~]\s*(\d+)\s*%/))) {
      out.ranges.moRatio = [+m[1] / 100, +m[2] / 100];
      out.items.push("Mo 比例 " + m[1] + "%–" + m[2] + "%");
    }
    if ((m = text.match(/(\d+)\s*\/\s*(\d+)\s*\/\s*(\d+)\s*℃/))) {
      out.ranges.tempC = [+m[1], +m[3]];
      out.items.push("温度 " + m[1] + "/" + m[2] + "/" + m[3] + " ℃");
    }
    if (!out.goal.eta10Max) { out.goal.eta10Max = 65; out.items.push("目标 η10 ≤ 65 mV（默认）"); }
    if (!out.goal.roundLimit) { out.goal.roundLimit = 6; out.items.push("轮次上限 6 轮（默认）"); }
    if (!out.ranges.moRatio) { out.ranges.moRatio = [0.18, 0.28]; out.items.push("Mo 0.18–0.28（默认区间）"); }
    return out;
  }

  A.views.tasks = function (root) {
    const S = A.state;
    const tasks = A.sim.getTasks();
    const parsed = parse(S.taskText || EXAMPLE);
    const cur = A.sim.currentStep();

    const rows = tasks.map(t => ({
      cells: [
        "<b>" + t.id + "</b>",
        '<span title="' + K.esc(t.raw) + '">' + K.esc(t.raw.length > 34 ? t.raw.slice(0, 34) + "…" : t.raw) + "</span>",
        t.goal.eta10Max + " mV / " + t.goal.roundLimit + " 轮",
        t.progress + " / " + t.goal.roundLimit,
        K.badge(t.status === "running" ? "running" : t.status === "done" ? "done" : "idle",
          t.status === "running" ? "执行中" : t.status === "done" ? "已完成" : "排队中"),
      ],
    }));

    root.innerHTML =
      K.pagehead("☰", "任务中心", "TASK · 一句话下单 / 意图解析 / 工序编排", "ops", "智能编排") +
      '<div class="grid g2">' +
      K.card("下达任务（自然语言）",
        '<textarea id="taskInput" rows="3" placeholder="例如：' + K.esc(EXAMPLE) + '">' + K.esc(S.taskText || EXAMPLE) + "</textarea>" +
        '<div class="btnrow"><button id="btnParse" class="primary">解析意图</button>' +
        '<button id="btnDispatch">下发到队列</button></div>' +
        '<div class="muted" style="margin-top:8px">演示模式：规则解析 + 预设意图，非大模型推理</div>', "演示") +
      K.card("解析结果（可人工修改后再下发）",
        '<div style="margin-bottom:6px">' + parsed.items.map(x => '<span class="chip">' + K.esc(x) + "</span>").join("") + "</div>" +
        K.kv("目标：η10 上限", parsed.goal.eta10Max + " mV") +
        K.kv("轮次上限", parsed.goal.roundLimit + " 轮") +
        K.kv("Mo 比例区间", Math.round(parsed.ranges.moRatio[0] * 100) + "% – " +
          Math.round(parsed.ranges.moRatio[1] * 100) + "%") +
        K.kv("约束", "pH ≤ 9.5 · 温度 ≤ 70 ℃ · 单一赛题提交") +
        (parsed.ranges.tempC ? K.kv("温度序列", parsed.ranges.tempC.join(" / ") + " ℃") : "")) +
      "</div>" +

      K.card("实验队列", K.table(["任务", "描述", "目标", { label: "进度", num: true }, "状态"], rows)) +

      '<div class="grid g2">' +
      K.card("工序编排（DAG）", '<canvas id="dag" style="width:100%;height:230px"></canvas>',
        "当前工序：" + cur.name) +
      K.card("执行控制",
        K.kv("当前工序", cur.name) +
        K.kv("本轮进度", (A.sim.roundProgress() * 100).toFixed(0) + " %") +
        K.kv("运行状态", S.fault ? '<span class="badge b-err">异常暂停</span>' : S.running ? '<span class="badge b-run">运行中</span>' : '<span class="badge b-idle">待机</span>') +
        '<div class="muted" style="margin-top:8px">高风险动作（更换电极、调 pH、启动电沉积）需人工二次确认后方可执行（对应改造规格书 R-07 / 4.4 技能库权限分级）。</div>' +
        '<div class="btnrow"><button id="btnConfirm">二次确认高风险动作</button></div>') +
      "</div>";

    // 交互
    const ta = root.querySelector("#taskInput");
    root.querySelector("#btnParse").addEventListener("click", () => {
      S.taskText = ta.value;
      A.log("已解析任务意图：" + ta.value.slice(0, 30) + "…");
      A.render();
    });
    root.querySelector("#btnDispatch").addEventListener("click", () => {
      S.taskText = ta.value;
      const p = parse(ta.value);
      const id = "T-" + String(16 + tasks.length).padStart(3, "0");
      tasks.push({ id, raw: ta.value, goal: p.goal, status: "queued", progress: 0 });
      A.log("任务 " + id + " 已下发到队列（目标 η10 ≤ " + p.goal.eta10Max + " mV，上限 " + p.goal.roundLimit + " 轮）");
      A.render();
    });
    root.querySelector("#btnConfirm").addEventListener("click", () => {
      A.log("已人工确认高风险动作（演练）：二次确认流程可用", "w");
      A.state.traces.unshift({
        id: "TC-" + (2050 + A.state.traces.length), time: A.fmt.hhmmss(),
        request: "人工确认高风险动作：更换电极", tool: "confirmHighRisk",
        params: { action: "换电极", operator: "人工" },
        validation: "通过（人工确认）", result: "已放行，进入执行队列",
      });
      A.render();
    });

    // DAG：固定编排 + 当前工序状态（4 列两行蛇形布局，避免 8 个节点挤成一条线）
    const order = ["start", "fill", "react", "test", "clean", "waste", "archive", "next"];
    const label = { start: "任务确认", fill: "加液", react: "混合反应", test: "电化学测试", clean: "清洗/换电极", waste: "废液", archive: "数据归档", next: "下一轮推荐" };
    const posOf = function (i) {
      const row = i < 4 ? 0 : 1;
      const k = row === 0 ? i : 7 - i;            // 上行左→右，下行右→左（蛇形）
      return { x: k / 3, y: row === 0 ? 0.24 : 0.74 };
    };
    const nodes = order.map((id, i) => {
      const p = posOf(i);
      let state = "idle";
      if (id === "fill" || id === "react" || id === "test" || id === "clean" || id === "waste") {
        const ci = D.STEPS.findIndex(s => s.key === id);
        state = ci < S.stepIdx ? "done" : ci === S.stepIdx ? "run" : "idle";
      }
      if (id === "archive") state = S.stepIdx > 2 ? "done" : "idle";
      if (id === "next") state = S.roundCount > 0 ? "done" : "idle";
      return { id, label: label[id], x: p.x, y: p.y, state };
    });
    const edges = [];
    for (let i = 0; i < order.length - 1; i++) edges.push([order[i], order[i + 1]]);
    edges.push(["waste", "archive"]);
    K.dag(root.querySelector("#dag"), nodes, edges);
  };
})(window.APP, window.DATA);
