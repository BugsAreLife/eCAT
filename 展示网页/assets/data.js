/* 模拟数据集（全部为演示数据，非真实实验结果）
 * 说明：所有曲线/指标由固定种子生成，保证每次打开一致，便于彩排。
 */
window.DATA = (function () {
  "use strict";

  // ---------- 固定种子随机数（保证可复现） ----------
  function seeded(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }
  const rnd = seeded(20261110);
  const r2 = (x, n) => Math.round(x * Math.pow(10, n)) / Math.pow(10, n);

  // ---------- 工序定义（用于状态机与时间轴） ----------
  const STEPS = [
    { key: "fill", name: "加液 / 配液", dur: 6 },
    { key: "react", name: "混合与反应", dur: 9 },
    { key: "test", name: "电化学测试", dur: 11 },
    { key: "clean", name: "清洗 / 更换电极", dur: 5 },
    { key: "waste", name: "废液处理", dur: 4 },
  ];
  const CYCLE = STEPS.reduce((a, s) => a + s.dur, 0);

  // ---------- 曲线生成 ----------
  // LSV：E(mV, 正数表示过电位) → j(mA/cm²)
  function makeLSV(eta10, tafel) {
    const pts = [];
    for (let i = 0; i <= 60; i++) {
      const E = i * 7;                        // 0 ~ 420 mV
      const j = 10 * Math.pow(10, (E - eta10) / tafel);
      pts.push([E, Math.min(80, r2(j, 3))]);
    }
    return pts;
  }
  // Tafel：log10(j) → E
  function makeTafel(eta10, tafel) {
    const pts = [];
    for (let lj = -1; lj <= 1.6; lj += 0.1) {
      pts.push([r2(lj, 2), r2(eta10 + tafel * lj, 1)]);
    }
    return pts;
  }

  // ---------- 历史轮次（9 轮，指标逐步优化） ----------
  const ROUNDS = [];
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    const eta10 = r2(118 - 56 * t + (rnd() - 0.5) * 4, 1);      // 118 → 62
    const tafel = r2(88 - 40 * t + (rnd() - 0.5) * 3, 1);       // 88 → 48
    const cdl = r2(8 + 4.4 * t + (rnd() - 0.5) * 0.6, 2);       // 8 → 12.4
    const decay = r2(18 - 9.5 * t + (rnd() - 0.5) * 1.2, 1);    // 18 → 8.5
    const moRatio = r2(0.10 + 0.18 * t + (rnd() - 0.5) * 0.02, 2);
    const running = i === 8;
    const failed = i === 3;                                     // 第 4 轮失败一次
    ROUNDS.push({
      id: "R-" + String(i + 1).padStart(3, "0"),
      status: running ? "running" : failed ? "failed" : "done",
      date: "11-0" + (i < 8 ? 6 + Math.floor(i / 4) : 9) + " " + String(9 + i).padStart(2, "0") + ":" + String((i * 7) % 60).padStart(2, "0"),
      recipe: {
        moRatio, potential: r2(-1.05 - 0.12 * t, 2), timeMin: Math.round(12 + 4 * t),
        tempC: r2(62 + 6 * t, 0), pH: r2(8.8 + 0.4 * t, 1), rpm: 300,
      },
      metrics: { eta10, tafel, cdl, decay100h: decay },
      steps: STEPS.map((s, si) => ({
        key: s.key, name: s.name,
        status: failed && si === 2 ? "failed" : "done",
        dur: s.dur + (rnd() - 0.5) * 1.5,
      })),
      curves: { lsv: makeLSV(eta10, tafel), tafel: makeTafel(eta10, tafel) },
      verdict: failed ? "fail" : "pass",
      reason: failed ? "测试阶段参比电极漂移，η10 数据异常，判定无效" : "",
      isBest: i === 7,
    });
  }

  // ---------- 部件清单（与 3D 模型命名保持一致，供孪生页占位使用） ----------
  const PARTS = [
    { name: "M-PUMP-01", cn: "蠕动泵 1（红）", spec: "R-01", step: "fill" },
    { name: "M-PUMP-02", cn: "蠕动泵 2（蓝）", spec: "R-01", step: "fill" },
    { name: "M-PUMP-03", cn: "蠕动泵 3（黄）", spec: "R-01", step: "fill" },
    { name: "M-PUMP-04", cn: "蠕动泵 4（绿）", spec: "R-01", step: "fill" },
    { name: "M-BOTTLE-01", cn: "储液瓶 1", spec: "R-03", step: "fill" },
    { name: "M-BOTTLE-02", cn: "储液瓶 2", spec: "R-03", step: "fill" },
    { name: "M-REACTOR-01", cn: "反应烧杯 1", spec: "R-09", step: "react" },
    { name: "M-REACTOR-02", cn: "反应烧杯 2", spec: "R-09", step: "react" },
    { name: "M-TURRET-01", cn: "电极转盘", spec: "R-07", step: "react" },
    { name: "M-EWS-01", cn: "电化学工作站", spec: "R-12", step: "test" },
    { name: "M-WASTE-01", cn: "废液桶", spec: "R-06", step: "waste" },
    { name: "M-EST-01", cn: "急停按钮", spec: "R-21", step: "*" },
    { name: "M-EXH-01", cn: "排风罩", spec: "R-20", step: "*" },
  ];

  // ---------- 任务（队列演示） ----------
  const TASKS = [
    { id: "T-014", raw: "筛选 Mo 20%–28% 的 Ni-Mo 镀层，目标 η10 < 60 mV，最多 8 轮",
      goal: { eta10Max: 60, roundLimit: 8 }, status: "running", progress: 3 },
    { id: "T-015", raw: "验证沉积温度 60/65/70 ℃ 对 Tafel 斜率的影响",
      goal: { eta10Max: 70, roundLimit: 3 }, status: "queued", progress: 0 },
    { id: "T-013", raw: "复现 R-005 配方并做三平行样重复性验证",
      goal: { eta10Max: 75, roundLimit: 3 }, status: "done", progress: 3 },
  ];

  // ---------- Agent 工具调用轨迹（审计链） ----------
  const TRACES = [
    { id: "TC-2041", time: "10:12:07", request: "启动第 8 轮电化学测试", tool: "startTest",
      params: { technique: "LSV", range: "-0.05~-0.45 V", scanRate: "5 mV/s" },
      validation: "通过（量程/电极就位校验 OK）", result: "已下发，工作站返回 ACK" },
    { id: "TC-2042", time: "10:12:31", request: "测试完成后自动归档曲线", tool: "archiveCurve",
      params: { round: "R-008", meta: "电极面积/参比/温度" },
      validation: "通过（元数据完整）", result: "已入库，关联 R-008" },
    { id: "TC-2043", time: "10:15:02", request: "检测到 η10 改善趋缓，生成下一轮候选", tool: "recommend",
      params: { model: "GP-EI", constraints: "pH≤9.5, T≤70℃" },
      validation: "通过（3 个候选均在可行域内）", result: "返回 3 个候选配方，等待人工批准" },
  ];

  // ---------- 历史告警 ----------
  const ALARMS = [
    { id: "A-331", time: "09:41:12", level: "hold", part: "M-PUMP-03", title: "泵管堵塞",
      symptom: "P3 出口压力 > 阈值持续 5 s", action: "回退检查点并重试 1/3", recovered: true, dur: 12 },
    { id: "A-332", time: "10:03:45", level: "info", part: "M-BOTTLE-02", title: "储液液位偏低",
      symptom: "LS-02 液位 18%（阈值 20%）", action: "限制泵送并提示补液", recovered: true, dur: 0 },
    { id: "A-333", time: "10:22:18", level: "stop", part: "M-EWS-01", title: "工作站通信超时",
      symptom: "SCPI 无响应 3 次", action: "重连成功，从检查点续跑", recovered: true, dur: 8 },
  ];

  // ---------- Agent 推荐候选（含证据） ----------
  const CANDIDATES = [
    { id: "C-1", recipe: "Mo 24%，-1.14 V，15 min，66 ℃，pH 9.0", eta: 58, risk: "低",
      evidence: ["历史最优 R-008（η10=62）同区间", "文献[13]：Mo 20–30% 区间活性最佳"] },
    { id: "C-2", recipe: "Mo 26%，-1.16 V，16 min，68 ℃，pH 9.2", eta: 55, risk: "中（温度接近上限）",
      evidence: ["R-007 拟合（η10=69）→ 预测提升 14 mV", "历史 R-004 在此温度曾出现镀层开裂"] },
    { id: "C-3", recipe: "Mo 22%，-1.12 V，14 min，64 ℃，pH 8.9", eta: 61, risk: "低",
      evidence: ["保守方案，参数区间内插", "稳定性衰减预测 8.2%（优于 R-008）"] },
  ];

  return { ROUNDS, STEPS, CYCLE, PARTS, TASKS, TRACES, ALARMS, CANDIDATES, rnd, r2 };
})();
