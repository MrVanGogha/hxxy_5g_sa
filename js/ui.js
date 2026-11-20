﻿/* ============================================================
   §4 步骤定义与渲染骨架
   ============================================================ */
const STEPS = [
  { name:'场景与需求', desc:'认领场景，划出 5 项指标' },
  { name:'带宽估算', desc:'业务累加 +20% 冗余' },
  { name:'网络架构', desc:'① 部署模式 + 拓扑认知' },
  { name:'空口配置', desc:'② 频段 ③ 帧结构 ④ 时隙' },
  { name:'核心网配置', desc:'⑤ 切片 ⑥ 5QI ⑦ AMBR ⑧ UPF位置' },
  { name:'容量与规格', desc:'⑨ UPF 规格定档' },
  { name:'提交评测', desc:'诊断报告 + 导出成果' }
];

const main = document.getElementById('mainHost');
const navEl = document.getElementById('stepNav');

function renderNav(){
  navEl.innerHTML = STEPS.map((s, i) => {
    const locked = !app.scenario && i > 0;
    const cls = ['step-item', i===app.step?'active':'', locked?'locked':'', stepDone(i)?'done':''].join(' ');
    return `<button type="button" class="${cls}" data-step="${i}" ${i===app.step?'aria-current="step"':''} ${locked?'aria-disabled="true"':''}>
      <span class="step-num">${stepDone(i) && i!==app.step ? '✓' : String(i+1).padStart(2,'0')}</span>
      <span><span class="step-name">${s.name}</span><span class="step-desc">${s.desc}</span></span>
    </button>`;
  }).join('');
  navEl.querySelectorAll('.step-item').forEach(el => {
    el.addEventListener('click', () => {
      const i = Number(el.dataset.step);
      if(!app.scenario && i > 0) return;
      app.step = i; render();
    });
  });
}
function stepDone(i){
  if(i === 0) return !!app.scenario;
  if(i === 1) return app.calcRows.some(r => r.bizId && Number(r.qty) > 0);
  const groups = {2:['deployMode'], 3:['band','frame','slot'], 4:['sst','qi','ambr','upfLoc'], 5:['upfSpec']};
  if(groups[i]) return groups[i].every(k => isNum(app.sel[k]));
  return false;
}

function render(keepScroll){
  renderNav();
  const pages = [pageScenario, pageCalc, pageArch, pageRadio, pageCore, pageSpec, pageResult];
  const y = window.scrollY;
  main.innerHTML = '';
  const div = document.createElement('div');
  div.className = 'step-page show';
  div.innerHTML = pages[app.step]();
  main.appendChild(div);
  bindPage(app.step, div);
  if(keepScroll) window.scrollTo(0, y);
  else window.scrollTo({top:0, behavior:'smooth'});
  saveProgress();
}

/* 进度持久化：刷新不丢失（按场景隔离） */
const PKEY = 'sa5g_progress';
function saveProgress(){
  if(!app.scenario) return;
  try{
    localStorage.setItem(PKEY, JSON.stringify({
      scenarioId: app.scenario.id, sel: app.sel, think: app.think,
      calcRows: app.calcRows, calcSeq, attempts: app.attempts, step: app.step
    }));
  }catch(e){}
}
function loadProgress(){
  try{
    const p = JSON.parse(localStorage.getItem(PKEY));
    if(!p) return;
    const sc = SCENARIOS.find(s => s.id === p.scenarioId);
    if(!sc) return;
    app.scenario = sc; app.sel = p.sel || {}; app.think = p.think || {};
    app.calcRows = p.calcRows || []; calcSeq = p.calcSeq || 0;
    app.attempts = p.attempts || 0; app.step = p.step || 0;
  }catch(e){}
}
function navBtns(prevOk = true, nextLabel = '下一步 →', nextOk = true){
  const reason = app.step===0 && !nextOk ? '<span class="nav-reason" id="nextReason">请先选择一个行业场景</span>' : '';
  return `<div class="navbtns">
    <button class="btn ghost" id="prevBtn" ${app.step===0?'disabled':''}>← 上一步</button>
    <span class="nav-next">${reason}<button class="btn" id="nextBtn" ${nextOk?'':'disabled'} ${reason?'aria-describedby="nextReason"':''}>${nextLabel}</button></span>
  </div>`;
}

/* 每步任务行：做什么 + 完成度（填写≠合格，仅表示已填写） */
const STEP_TASK = [
  '选择 1 个场景，并看清覆盖、业务、带宽、时延、可靠性 5 项指标。',
  '添加业务并填写并发数，记住"×1.2 冗余后"的估算值。',
  '先判断数据隔离要求，再选择 ① 部署模式。',
  '依次完成 ② 频段 → ③ 帧结构 → ④ 时隙配比。',
  '完成 ⑤—⑧；URLLC 场景需联动检查 ⑥ 5QI 与 ⑧ UPF 位置。',
  '对照第 2 步估算和场景带宽基线，选择 ⑨ UPF 规格。',
  '补齐 9 项后提交；有错误时按诊断返回修改。'
];
const STEP_KEYS = [[], [], ['deployMode'], ['band','frame','slot'], ['sst','qi','ambr','upfLoc'], ['upfSpec'], []];
function stepGoal(i){
  let done = 0, total = 0;
  if(i === 0){
    total = 1; done = app.scenario ? 1 : 0;
  } else if(i === 1){
    total = 1;
    const rows = app.calcRows.filter(r => r.bizId);
    done = (rows.length && rows.every(r => Number(r.qty) >= 1)) ? 1 : 0;
  } else if(i === 6){
    total = PARAM_KEYS.length; done = PARAM_KEYS.filter(k => isNum(app.sel[k])).length;
  } else {
    const ks = STEP_KEYS[i] || [];
    total = ks.length; done = ks.filter(k => isNum(app.sel[k])).length;
  }
  return `<div class="step-goal">
    <span>${STEP_TASK[i]}</span>
    <span style="font-family:var(--mono);font-size:12.5px;color:${done===total?'var(--ok)':'var(--muted)'};white-space:nowrap">已填写 ${done} / ${total}</span>
  </div>`;
}

/* ---------- 步骤 1：场景与需求 ---------- */
function pageScenario(){
  return `
    <h2 class="page-title">第 1 步 · 认领你们的场景</h2>
    <p class="page-sub">8 组对应 8 个行业场景。点击卡片认领后，先读任务书，把 5 项核心指标看清楚——后面所有设计决策都由它们推导出来。</p>
    ${stepGoal(0)}
    <div class="scn-grid">
      ${SCENARIOS.map(s => `
        <div class="scn-card ${app.scenario && app.scenario.id===s.id?'active':''}" data-id="${s.id}">
          <span class="ic">${s.icon}</span>
          <span class="cat">${s.category==='urllc'?'低时延型 · URLLC':'大容量型 · eMBB'}</span>
          <div class="nm">${s.name}</div>
          <div class="bf">${s.coverage} · 带宽需求 ≈${s.bandwidthReq}Mbps${s.delayThreshold?` · 时延<${s.delayThreshold}ms`:' · 时延不敏感'}</div>
        </div>`).join('')}
    </div>
    <div id="scnDetail">${app.scenario ? scenarioDetailHtml(app.scenario) : ''}</div>
    ${navBtns(false, '确认场景，下一步：带宽估算 →', !!app.scenario)}
  `;
}
function scenarioDetailHtml(sc){
  return `
    <div class="card" style="margin-top:18px">
      <h3>${sc.icon} ${sc.name} · 场景需求说明书</h3>
      <p style="color:var(--muted);font-size:13.5px;margin-top:0">${sc.brief}</p>
      <table class="req">
        <tr><th>覆盖面积</th><td>${sc.ind.area}</td></tr>
        <tr><th>终端/业务</th><td>${sc.ind.dev}</td></tr>
        <tr><th>带宽要求</th><td>${sc.ind.bw}</td></tr>
        <tr><th>时延要求</th><td>${sc.ind.dl}</td></tr>
        <tr><th>可靠性</th><td>${sc.ind.rel}</td></tr>
        <tr><th>特殊需求</th><td>${sc.ind.sp}</td></tr>
      </table>
      <div style="margin-top:12px">
        <span class="tag">判定方式：${sc.category==='urllc'?'仿真计算时延':'仿真计算容量裕度'}</span>
        <span class="tag">场景带宽基线 ≈ ${sc.bandwidthReq} Mbps（用于⑨UPF规格判定）</span>
      </div>
    </div>
    <div class="hint">💡 <b>设计顺序提示：</b>先别急着选参数。下一步先用带宽计算器估算本场景总带宽——它决定你后面 ⑨UPF 规格的选择依据。</div>`;
}

/* ---------- 步骤 2：带宽估算 ---------- */
function pageCalc(){
  return `
    <h2 class="page-title">第 2 步 · 带宽估算</h2>
    <p class="page-sub">从业务资源池中挑出本场景会用到的业务，填并发数量，算出总带宽。这是中立算术工具，不计分——但算错会导致后面 ⑨UPF 规格选错。</p>
    ${stepGoal(1)}
    <div class="hint">📖 <b>计算方法：</b>逐业务：单路带宽 × 并发数量 = 小计；全部累加后 <b>×1.2（加 20% 冗余）</b>，再向上取整到标准档位（1G / 5G / 10G）。</div>
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <h3 style="margin:0">🧮 带宽估算计算器</h3>
        <button class="btn ghost" id="addRow">＋ 添加业务</button>
      </div>
      <div id="calcRows"></div>
      <div class="calc-sum-bar">
        <span>合计带宽：<b id="calcTotal">0 Mbps</b></span>
        <span>×1.2 冗余后：<b id="calcFinal" style="color:var(--blue)">0 Mbps</b></span>
        <span>建议 UPF 档位：<b id="calcTier" style="color:var(--ok)">—</b></span>
      </div>
      <div class="suggest" id="calcSuggest"></div>
    </div>
    ${navBtns(true, '下一步：网络架构 →')}
  `;
}
function tierOf(mbps){ return mbps <= 1000 ? '1G' : mbps <= 5000 ? '5G' : mbps <= 10000 ? '10G' : '超出10G（需分流）'; }

/* ---------- 步骤 3：网络架构（①部署模式 + 拓扑） ---------- */
function pageArch(){
  return `
    <h2 class="page-title">第 3 步 · 网络架构设计</h2>
    <p class="page-sub">架构选型是方案的第一决策：数据能不能出园区？预算和安全怎么权衡？先回答下面的问题，再选部署模式。</p>
    ${stepGoal(2)}
    ${thinkHtml('deployMode', '先想一想：本场景的数据安全和隔离要求，允许业务数据离开园区/矿区吗？', [
      ['绝不允许，需物理隔离','yes'],
      ['要求较高但可与运营商共享核心网','mid'],
      ['要求一般，成本优先','no']
    ], ans => ({
      yes:'判断正确 → 应选「独立专网」。',
      mid:'有道理 → 「共享专网」（无线独享+核心网共享）正为此设计。',
      no:'成本敏感场景 → 「公网切片」更合适。请确认本场景是否真属于此类。'
    }[ans]))}
    <div class="pgrid">${paramCardHtml('deployMode')}</div>
    <div class="card" style="margin-top:18px">
      <div class="topo-head"><h3>🗺️ 5G SA 专网拓扑 · 你的选择落在哪里</h3><button type="button" class="btn ghost topo-zoom">⛶ 放大查看</button></div>
      <p style="font-size:12.5px;color:var(--muted);margin:0 0 8px">横轴是物理距离：节点间距越长，链路时延越大。选择⑧ UPF 部署位置时，UPF 会真的在图上移动——下沉就进园区围墙，回传链路随之缩短；集中就退到运营商侧，回传链路被拉长。点击任一参数牌可直接跳到它的配置位置。</p>
      <span class="topo-legend"><i></i>用户面链路<i class="lg-cp"></i>控制面信令<i class="lg-fence"></i>园区边界<i class="lg-card"></i>参数落位</span>
      <div class="topo-wrap" id="topoHost"></div>
    </div>
    ${navBtns(true, '下一步：空口配置 →')}
  `;
}

/* ---------- 步骤 4：空口配置 ---------- */
function pageRadio(){
  return `
    <h2 class="page-title">第 4 步 · 空口配置</h2>
    <p class="page-sub">无线侧三要素：频段决定覆盖与容量的基本面，帧结构/时隙配比决定上下行资源分配。</p>
    ${stepGoal(3)}
    ${thinkHtml('band', '先想一想：本场景是"覆盖优先"还是"容量优先"？', [
      ['覆盖优先（面积大/带状/井下）','cover'],
      ['容量优先（高密度/大带宽）','cap'],
      ['两者均衡','bal']
    ], ans => ({
      cover:'覆盖优先 → 低频段 n28 是主力候选。',
      cap:'容量优先 → 看向 n78/n79 大带宽频段。',
      bal:'均衡 → n41 往往是最稳的选择。对照场景指标再确认一次。'
    }[ans]))}
    <div class="pgrid">${paramCardHtml('band')}</div>
    ${thinkHtml('frame', '先想一想：本场景的业务以"上行"还是"下行"为主？（回看第 1 步需求里的带宽要求）', [
      ['上行为主（视频回传/采集类）','up'],
      ['下行为主（上网/分发类）','down']
    ], ans => ({
      up:'上行为主 → 应选上行时隙更多的「2.5ms 双周期」帧结构。',
      down:'下行为主 → 应选下行占比更高的「单周期」帧结构。'
    }[ans]))}
    <div class="pgrid">${paramCardHtml('frame')}${paramCardHtml('slot')}</div>
    ${navBtns(true, '下一步：核心网配置 →')}
  `;
}

/* ---------- 步骤 5：核心网配置 ---------- */
function pageCore(){
  const sc = app.scenario;
  return `
    <h2 class="page-title">第 5 步 · 核心网配置</h2>
    <p class="page-sub">切片、QoS、签约速率与 UPF 部署位置。参数名旁的蓝色标注，标出了每个 5G 参数在 4G 网络中的对应概念，帮助你贯通两代移动通信的知识。</p>
    ${stepGoal(4)}
    ${sc.category==='urllc' ? `
    ${thinkHtml('sst', '先想一想：本场景最关键的那类业务（远控/保护/手术），时延要求属于哪个等级？', [
      ['≤20ms 级，必须超可靠低时延','urllc'],
      ['100ms 级，大带宽即可','embb']
    ], ans => ({
      urllc:'正确 → 切片应选 SST=2(URLLC)，5QI 也要配套选低时延等级。',
      embb:'再想想 — 回看需求里的时延指标。如果关键业务时延 <20ms，应按 URLLC 对待。'
    }[ans]))}` : `
    <div class="hint">💡 本场景为 eMBB 大容量型：时延要求 ≥20ms，UPF 可集中部署降成本；5QI 按速查表选：视频监控/数据采集→4 或 6，控制/调度类→7，普通上网→8 或 9。</div>`}
    <div class="pgrid">
      ${paramCardHtml('sst')}${paramCardHtml('qi')}${paramCardHtml('ambr')}${paramCardHtml('upfLoc')}
    </div>
    ${navBtns(true, '下一步：容量与规格 →')}
  `;
}

/* ---------- 步骤 6：容量与规格 ---------- */
function pageSpec(){
  const calcTotal = calcFinal();
  return `
    <h2 class="page-title">第 6 步 · ⑨ UPF 规格定档</h2>
    <p class="page-sub">规格必须扛住场景带宽需求。你在第 2 步算出的冗余后带宽是 <b style="font-family:var(--mono)">${calcTotal > 0 ? calcTotal + ' Mbps（建议档位 ' + tierOf(calcTotal) + '）' : '（尚未计算 — 可回第 2 步用计算器估算）'}</b>。</p>
    ${stepGoal(5)}
    <div class="hint">🧮 <b>仿真判定：</b>满足度 = 规格容量 ÷ 场景带宽基线（${app.scenario ? app.scenario.bandwidthReq : '—'}Mbps）。≥100% 合格；不足则判容量不足。规格容量：1G=1000Mbps，5G=5000Mbps，10G=10000Mbps。</div>
    <div class="pgrid">${paramCardHtml('upfSpec')}</div>
    ${navBtns(true, '下一步：提交评测 →')}
  `;
}

/* ---------- 步骤 7：提交评测 ---------- */
/* 第 7 步缺项清单：每项可直接回步 */
function missingListHtml(){
  const miss = PARAM_KEYS.filter(k => !isNum(app.sel[k]));
  if(!miss.length) return '';
  return `<div class="card">
    <h3>还差 ${miss.length} 项参数</h3>
    <div class="missing-list">
      ${miss.map(k => {
        const idx = PARAM_STEP_INDEX[k];
        return `<div class="missing-item">
          <span>${PARAM_LABELS[k]}<span style="color:var(--muted);font-size:12.5px">　· 第 ${idx+1} 步</span></span>
          <button class="btn ghost" data-goto-param="${k}">回到第 ${idx+1} 步</button>
        </div>`;
      }).join('')}
    </div>
  </div>`;
}

function pageResult(){
  const sc = app.scenario;
  let html = `
    <h2 class="page-title">第 7 步 · 提交仿真评测</h2>
    <p class="page-sub">提交后逐项判定并锁定答对项；答错项会给出错因诊断，可直接回到对应步骤修正后重新提交。</p>
    ${stepGoal(6)}
    <div class="card" style="text-align:center;padding:26px">
      <button class="btn ok" id="submitBtn" style="font-size:16px;padding:13px 44px" ${allFilled()?'':'disabled'}>
        ${app.snapshot ? '重新提交仿真' : '🚀 提交仿真评测'}
      </button>
      <div style="margin-top:10px;font-size:12.5px;color:var(--muted)">
        ${allFilled() ? '9 项参数已填写完整。提交后将生成成绩、方案拓扑、仿真仪表和逐项诊断。' : '还有参数未选择，暂不能提交。下列缺项可点击直接回到对应步骤：'}
      </div>
    </div>
    ${allFilled() ? '' : missingListHtml()}
    <div id="resultArea">${app.snapshot ? staleBannerHtml(app.snapshot) + resultHtml(app.snapshot, sc) : ''}</div>`;
  return html;
}
function allFilled(){ return PARAM_KEYS.every(k => isNum(app.sel[k])); }
function staleBannerHtml(snap){
  if(snap.live) return '';
  return `<div class="stale-banner"><b>结果已过期 · 当前显示第 ${snap.attempt} 次提交的历史快照</b>你在提交后修改了参数，以下成绩、拓扑和诊断不代表当前配置，请重新提交仿真。</div>`;
}

function resultHtml(snap, sc){
  const r = snap.result;
  const score = Math.round(r.done / r.total * 100);
  const nonOk = PARAM_KEYS.filter(k => r.params[k].status !== ST.OK);
  const onlyWarn = nonOk.length > 0 && nonOk.every(k => r.params[k].status === ST.WARN);
  const color = onlyWarn || score >= 60 ? (score >= 90 || onlyWarn ? 'var(--ok)' : 'var(--warn)') : 'var(--bad)';
  const m = r.metrics;
  return `
    <div class="card score-hero" id="resultSummary" tabindex="-1" aria-live="polite">
      <div class="ring" style="--score:${score};--ring-color:${color}"><div class="ring-core">${onlyWarn ? '<span class="conditional">有条件</span><span>通过</span>' : `<span class="score-num">${score}</span><span class="score-total">/100</span>`}</div></div>
      <div style="flex:1;min-width:240px">
        <h3 style="margin:0 0 4px">${sc.icon} ${sc.name} · 方案评估 <span class="attempt">ATTEMPT ${String(snap.attempt).padStart(2,'0')}</span></h3>
        <div class="score-conclusion">${score}/100 · ${r.done}/${r.total}项合格</div>
        <p style="margin:0;color:var(--muted);font-size:13.5px">${onlyWarn
          ? `9 项参数判定全部正确；其中 ${nonOk.length} 项受候选值上限限制为"有条件通过"，不计扣分。`
          : `9 项参数中 <b>${r.done}</b> 项判定正确。${nonOk.length ? '错误项诊断见下，可回对应步骤修正。' : '全部通过，🎉 方案达标！'}`}</p>
      </div>
      <button class="btn ghost" id="exportBtn">📄 ${snap.live ? '导出结果（Markdown）' : `导出第 ${snap.attempt} 次历史结果`}</button>
    </div>
    <div class="card">
      <div class="topo-head"><h3>🗺️ 方案拓扑总览</h3><button type="button" class="btn ghost topo-zoom">⛶ 放大查看</button></div>
      <p style="font-size:12.5px;color:var(--muted);margin:0 0 8px">本次提交的完整方案。参数牌按判定结果着色（绿=合格，红=不合格，黄=有条件通过）；⑨规格不足时用户面链路会标红，表示容量撑不住这条业务。点击任一参数牌可回到对应步骤修改。</p>
      <span class="topo-legend"><i></i>用户面链路<i class="lg-cp"></i>控制面信令<i class="lg-fence"></i>园区边界<i class="lg-card"></i>参数落位</span>
      <div class="topo-wrap" id="topoHost"></div>
    </div>
    ${(m.delay || m.capacity) ? `
    <div class="card"><h3>📊 仿真仪表</h3>
      ${m.delay ? `<div style="font-size:13.5px">仿真时延：<b style="font-family:var(--mono);color:${m.delay.pass?'var(--ok)':'var(--bad)'}">${m.delay.simDelay} ms</b>（阈值 <${m.delay.threshold}ms）</div>
        <div class="gauge"><div style="width:${Math.min(100, Math.round(m.delay.simDelay/m.delay.threshold*100))}%;background:${m.delay.pass?'var(--ok)':'var(--bad)'}"></div></div>` : ''}
      ${m.capacity ? `<div style="font-size:13.5px;margin-top:8px">容量满足度：<b style="font-family:var(--mono);color:${m.capacity.status===ST.OK?'var(--ok)':m.capacity.status===ST.WARN?'var(--warn)':'var(--bad)'}">${m.capacity.satisfaction}%</b>（${m.capacity.capacity}Mbps / 需求 ${m.capacity.req}Mbps）</div>
        <div class="gauge"><div style="width:${Math.min(100, m.capacity.satisfaction)}%;background:${m.capacity.status===ST.OK?'var(--ok)':m.capacity.status===ST.WARN?'var(--warn)':'var(--bad)'}"></div></div>` : ''}
    </div>` : ''}
    <div class="card"><h3>🩺 逐项诊断报告</h3>
      ${PARAM_KEYS.map(k => {
        const p = r.params[k];
        const cls = p.status===ST.OK?'ok':p.status===ST.WARN?'warn':p.status===ST.BAD?'bad':'';
        const stepNo = PARAM_STEP_INDEX[k] + 1;
        const action = p.status===ST.BAD
          ? `<button class="btn ghost" data-goto-param="${k}">回到第${stepNo}步 · 修改${PARAM_LABELS[k]}</button>`
          : (p.status===ST.WARN ? `<button class="btn ghost" data-goto-param="${k}">查看第6步规格说明</button>` : '');
        return `<div class="diag ${cls}" id="diag-${k}"><div class="dt">${PARAM_LABELS[k]}：${p.value ?? '未选'}</div><div class="diag-body">${p.text}</div>${action ? `<div class="diag-actions">${action}</div>` : ''}</div>`;
      }).join('')}
    </div>
    <div class="card"><h3>📚 5G↔4G 参数对应关系</h3>
      <table class="map4g">
        <tr><th>5G SA 参数</th><th>4G LTE 对应</th><th>功能相似性</th><th>关键区别</th></tr>
        ${MAP4G_TABLE.map(r2 => `<tr>${r2.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}
      </table>
    </div>`;
}

