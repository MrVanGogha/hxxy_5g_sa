/* ============================================================
   §5 组件：参数卡片 + 思考前置 + 拓扑图
   ============================================================ */
function paramCardHtml(key){
  const isSlot = key === 'slot';
  const opts = isSlot ? (SLOT_BY_FRAME[app.sel.frame] || []) : OPTIONS[key];
  const cur = app.sel[key] ?? '';
  const hint4g = MAP4G_HINT[key] ? `<span class="badge4g"><b>4G 对应：</b>${MAP4G_HINT[key]}</span>` : '';
  return `
    <div class="pcard" id="pcard-${key}">
      <label>${PARAM_LABELS[key]}${hint4g}</label>
      <select id="sel-${key}" ${isSlot && !app.sel.frame ? 'disabled' : ''}>
        <option value="">${isSlot ? (app.sel.frame ? '请选择…' : '先选择③帧结构') : '请选择…'}</option>
        ${opts.map(o => `<option value="${o}" ${String(o)===String(cur)?'selected':''}>${o}</option>`).join('')}
      </select>
      <div class="status" id="status-${key}"></div>
    </div>`;
}
const THINK_ANSWERS = {}; // key -> 记录
function thinkHtml(key, q, choices, verdictFn){
  THINK_ANSWERS[key] = { q, choices, verdictFn };
  return `
    <fieldset class="think" data-think="${key}">
      <legend class="tq">🤔 ${q}</legend>
      <span class="think-meta">思考练习 · 不计分</span>
      ${choices.map(([label, val]) => `<label><input type="radio" name="think-${key}" value="${val}"> ${label}</label>`).join('')}
      <div class="verdict" id="verdict-${key}" aria-live="polite"></div>
      <div class="think-next">带着这个判断，完成下方参数 ↓</div>
    </fieldset>`;
}

/* 拓扑：横轴是物理距离。节点间距就是链路长度，所以 UPF 下沉/集中的差别
   不靠文字说明，而靠 UPF 方块自己移动到园区围墙内或外。 */
const TOPO_L = { upfX:400, dnX:670, shift:260, upfW:170, dnW:140, gnbR:350, fenceNarrow:356, fenceWide:806 };
const DM_TEXT = {
  '独立专网':'① 独立专网 —— 园区围墙内闭环，业务数据不出园',
  '共享专网':'① 共享专网 —— 共享运营商 RAN 与核心网，园区只自建部分网元',
  '公网切片':'① 公网切片 —— 无专属硬件，靠逻辑切片隔离，与公网用户共享资源'
};

function topoCard(id, key, x, y, w, order, name){
  return `
    <g id="tn-${id}" class="tnode" data-key="${key||''}" data-order="${order}">
      <rect class="tn-card" x="${x}" y="${y}" width="${w}" height="22" rx="5"/>
      <rect class="tn-bar" x="${x}" y="${y+4}" width="3" height="14" rx="1.5" fill="#C7D2DB"/>
      <text class="tn-name" x="${x+11}" y="${y+15}">${name}</text>
      <text class="tn-val" x="${x+w-26}" y="${y+15}" text-anchor="end">—</text>
      <text class="tn-state" x="${x+w-8}" y="${y+15}" text-anchor="end"></text>
    </g>`;
}

function topoSvg(){
  return `
  <svg viewBox="0 0 1120 462" role="img" aria-label="5G SA 专网拓扑：横轴为物理距离，节点间距表示链路时延">
    <defs>
      <pattern id="hatch" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
        <line x1="0" y1="0" x2="0" y2="6" stroke="#08788A" stroke-width="1" opacity=".13"/>
      </pattern>
      <marker id="arw" viewBox="0 0 10 10" refX="8.6" refY="5" markerWidth="5.2" markerHeight="5.2" orient="auto-start-reverse">
        <path d="M1.6,1.2 L8.6,5 L1.6,8.8" fill="none" stroke="#08788A" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
      </marker>
      <marker id="arwc" viewBox="0 0 10 10" refX="8.6" refY="5" markerWidth="5.2" markerHeight="5.2" orient="auto-start-reverse">
        <path d="M1.6,1.2 L8.6,5 L1.6,8.8" fill="none" stroke="#315F9D" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
      </marker>
    </defs>

    <g id="tn-deployMode" class="tnode" data-key="deployMode" data-order="1">
      <rect id="dmBand" x="40" y="12" width="1040" height="34" rx="8" fill="#EDF2F5" stroke="#D4DDE5" stroke-width="1"/>
      <text id="dmText" x="56" y="33" font-size="12.5" fill="#0B4A56">① 部署模式：尚未选择 —— 先决定数据要不要出园区</text>
    </g>

    <rect id="topoFence" class="fence weak" x="24" y="200" width="356" height="200" rx="14"/>

    <text class="plane-label" x="40" y="190">用户面 · USER PLANE</text>
    <text class="plane-label" x="180" y="70">控制面 · CONTROL PLANE</text>

    <path class="link-cp" d="M265,212 V152" marker-end="url(#arwc)"/>
    <path class="link-cp" d="M350,116 H400" marker-end="url(#arwc)"/>
    <path class="link-cp" d="M570,116 H640" marker-end="url(#arwc)"/>
    <path id="n4Path" class="link-cp" d="M485,152 V212" marker-end="url(#arwc)"/>

    <g><rect class="dev-box" x="180" y="80" width="170" height="72" rx="10"/>
      <text class="dev-title" x="194" y="100">AMF</text>
      <text class="dev-sub" x="194" y="114">接入与移动性管理</text>
      ${topoCard('sst','sst',186,120,158,5,'⑤ 切片')}</g>
    <g><rect class="dev-box" x="400" y="80" width="170" height="72" rx="10"/>
      <text class="dev-title" x="414" y="100">SMF</text>
      <text class="dev-sub" x="414" y="114">会话管理</text>
      ${topoCard('qi','qi',406,120,158,6,'⑥ 5QI')}</g>
    <g><rect class="dev-box" x="640" y="80" width="170" height="72" rx="10"/>
      <text class="dev-title" x="654" y="100">UDM</text>
      <text class="dev-sub" x="654" y="114">统一数据管理</text>
      ${topoCard('ambr','ambr',646,120,158,7,'⑦ AMBR')}</g>

    <path class="link-up" d="M130,260 H180" marker-end="url(#arw)"/>
    <path id="linkGnUp" class="link-up" d="M350,260 H400" marker-end="url(#arw)"/>
    <path id="linkUpDn" class="link-up" d="M570,260 H670" marker-end="url(#arw)"/>

    <g><rect class="dev-box" x="40" y="222" width="90" height="76" rx="10"/>
      <text class="dev-title" x="52" y="252">UE</text>
      <text class="dev-sub" x="52" y="270">行业终端</text>
      <text class="dev-sub" x="52" y="286">AGV·摄像头</text></g>

    <g><rect class="dev-box" x="180" y="212" width="170" height="96" rx="10"/>
      <text class="dev-title" x="265" y="252" text-anchor="middle">gNB 基站</text>
      <text class="dev-sub" x="265" y="270" text-anchor="middle">接入网 · 空口侧</text></g>

    <g id="upfGroup">
      <rect class="dev-box" x="400" y="212" width="170" height="96" rx="10"/>
      <text class="dev-title" x="485" y="250" text-anchor="middle">UPF</text>
      <text class="dev-sub" x="485" y="268" text-anchor="middle">用户面功能</text>
      <text id="upfHint" class="dev-hint" x="485" y="290" text-anchor="middle">尚未确定部署位置</text>
      ${topoCard('upfLoc','upfLoc',400,322,182,8,'⑧ 部署位置')}
      ${topoCard('upfSpec','upfSpec',400,348,182,9,'⑨ 规格')}
    </g>

    <text id="outHint" x="848" y="262" font-size="11" fill="#6E8280"></text>

    <g id="dnGroup">
      <rect class="dev-box ghost" x="670" y="222" width="140" height="76" rx="10"/>
      <text class="dev-title" x="684" y="252">DN 数据网</text>
      <text class="dev-sub" x="684" y="270">企业私有云</text>
      <text class="dev-sub" x="684" y="286">或公网 Internet</text>
    </g>

    ${topoCard('band','band',180,322,182,2,'② 频段')}
    ${topoCard('frame','frame',180,348,182,3,'③ 帧结构')}
    ${topoCard('slot','slot',180,374,182,4,'④ 时隙配比')}

    <line class="axis-line" x1="40" y1="424" x2="1070" y2="424"/>
    <text class="axis-text" x="40" y="442">园区侧</text>
    <text class="axis-text" x="555" y="442" text-anchor="middle">物理距离 —— 链路拉得越长，时延越大</text>
    <text class="axis-text" x="1070" y="442" text-anchor="end">运营商侧 / 公网</text>
  </svg>`;
}
/* 拓扑全屏查看：投影/细看时按屏幕宽度等比放大（SVG 矢量不糊），Esc 退出；
   全屏 API 不可用（如 iframe 内嵌）时降级为固定定位浮层 */
function updateZoomBtns(){
  const on = !!(document.fullscreenElement || document.querySelector('.topo-wrap.zoom-fallback'));
  document.querySelectorAll('.topo-zoom').forEach(b => { b.textContent = on ? '✕ 退出放大' : '⛶ 放大查看'; });
}
document.addEventListener('click', e => {
  const btn = e.target.closest && e.target.closest('.topo-zoom');
  if(!btn) return;
  const card = btn.closest('.card');
  const wrap = card && card.querySelector('.topo-wrap');
  if(!wrap) return;
  if(document.fullscreenElement){ document.exitFullscreen(); return; }
  if(wrap.classList.contains('zoom-fallback')){ wrap.classList.remove('zoom-fallback'); updateZoomBtns(); return; }
  if(wrap.requestFullscreen){
    const p = wrap.requestFullscreen();
    if(p && p.catch) p.catch(() => { wrap.classList.add('zoom-fallback'); updateZoomBtns(); });
  }else{
    wrap.classList.add('zoom-fallback'); updateZoomBtns();
  }
});
document.addEventListener('fullscreenchange', updateZoomBtns);
document.addEventListener('keydown', e => {
  if(e.key !== 'Escape') return;
  const z = document.querySelector('.topo-wrap.zoom-fallback');
  if(z){ z.classList.remove('zoom-fallback'); updateZoomBtns(); }
});

function paintTopo(){
  const host = document.getElementById('topoHost');
  if(!host || !app.scenario) return;
  if(!host.querySelector('svg')) host.innerHTML = topoSvg();
  const r = evaluateAll(app.scenario, app.sel);
  const snap = app.snapshot && app.snapshot.live ? app.snapshot.result : null;

  // 参数牌：值 + 判定色
  ['sst','qi','ambr','band','frame','slot','upfLoc','upfSpec'].forEach(k => {
    const g = host.querySelector('#tn-' + k);
    if(!g) return;
    const src = snap ? snap.params[k] : r.params[k];
    const v = app.sel[k];
    const has = isNum(v);
    const st = snap ? src.status : (has ? 'pending' : 'unselected');
    g.classList.remove('st-ok','st-bad','st-warn','st-pending');
    if(st !== 'unselected') g.classList.add('st-' + st);
    g.querySelector('.tn-val').textContent = has ? String(v) : '—';
    g.querySelector('.tn-state').textContent = !snap ? ''
      : src.status === ST.OK ? '✔' : src.status === ST.WARN ? '⚠'
      : src.status === ST.BAD ? '✘' : '';
  });

  // UPF 在图上移动：下沉进围墙，集中到运营商侧；DN 跟着一起走，园区内整段链路随之伸缩
  const dx = app.sel.upfLoc === '集中部署' ? TOPO_L.shift : 0;
  const upfL = TOPO_L.upfX + dx, upfR = upfL + TOPO_L.upfW;
  const dnL = TOPO_L.dnX + dx;
  const jump = app.topoDx === undefined || app.topoDx === dx;
  const prevDx = app.topoDx;
  const ug = host.querySelector('#upfGroup');
  const dg = host.querySelector('#dnGroup');
  // 页面每次重绘都会重建 SVG，所以要先把元素摆回上一次的位置，
  // 再过渡到新位置——否则动画的起点会丢，或者每次改参数都重放一次。
  const place = (el, val) => {
    if(!el) return;
    el.style.transition = 'none';
    el.style.transform = `translateX(${val}px)`;
    el.getBoundingClientRect();
    el.style.transition = '';
  };
  if(jump){
    place(ug, dx); place(dg, dx);
  } else {
    place(ug, prevDx); place(dg, prevDx);
    if(ug) ug.style.transform = `translateX(${dx}px)`;
    if(dg) dg.style.transform = `translateX(${dx}px)`;
  }
  app.topoDx = dx;
  // 位置未定时 UPF 画成虚框，表示"还没装进园区"
  const upfBox = ug && ug.querySelector('.dev-box');
  if(upfBox) upfBox.classList.toggle('ghost', !app.sel.upfLoc);
  // 下沉时数据网也在园区内，画实线；集中部署时在公网侧，画虚框
  const dnBox = dg && dg.querySelector('.dev-box');
  if(dnBox) dnBox.classList.toggle('ghost', app.sel.upfLoc !== '园区下沉');
  const l1 = host.querySelector('#linkGnUp');
  if(l1) l1.setAttribute('d', `M${TOPO_L.gnbR},260 H${upfL}`);
  const l2 = host.querySelector('#linkUpDn');
  if(l2) l2.setAttribute('d', `M${upfR},260 H${dnL}`);
  const n4 = host.querySelector('#n4Path');
  if(n4){
    const cx = upfL + TOPO_L.upfW / 2;
    n4.setAttribute('d', cx === 485 ? 'M485,152 V212' : `M485,152 V190 H${cx} V212`);
  }

  // 时延结论写在 UPF 上，随⑥⑧联合仿真变化
  const hint = host.querySelector('#upfHint');
  if(hint){
    const loc = app.sel.upfLoc;
    let t = '尚未确定部署位置', col = 'var(--muted)';
    if(loc && isNum(app.sel.qi)){
      const m = delayMetrics(app.scenario, app.sel.qi, loc);
      t = `${loc === '园区下沉' ? '本地分流' : '经回传'} · 时延 ${m.simDelay}ms`;
      col = m.pass ? 'var(--primary)' : 'var(--bad)';
    } else if(loc){
      t = loc === '园区下沉' ? '本地分流 · 数据不出园' : '经回传 · 数据出园';
      col = loc === '园区下沉' ? 'var(--primary)' : 'var(--bad)';
    }
    hint.textContent = t;
    hint.style.fill = col;
  }

  // ⑨规格不够时，用户面链路直接标红
  if(l2) l2.classList.toggle('overload', (snap ? snap.params.upfSpec.status : ST.UNSET) === ST.BAD);

  // ①部署模式：横幅文案 + 判定色 + 围墙形态
  const dm = app.sel.deployMode;
  const dmSt = snap ? snap.params.deployMode.status : (dm ? 'pending' : 'unselected');
  const dt = host.querySelector('#dmText');
  if(dt){
    const mark = dmSt === ST.OK ? '✔ ' : dmSt === ST.BAD ? '✘ ' : dmSt === ST.WARN ? '⚠ ' : '';
    dt.textContent = mark + (dm ? DM_TEXT[dm] : '① 部署模式：尚未选择 —— 先决定数据要不要出园区');
    dt.style.fill = dmSt === ST.OK ? 'var(--ok)' : dmSt === ST.BAD ? 'var(--bad)'
      : dmSt === ST.WARN ? 'var(--warn)' : '#0B4A56';
  }
  const band = host.querySelector('#dmBand');
  if(band){
    band.style.fill = dmSt === ST.OK ? 'var(--ok-bg)' : dmSt === ST.BAD ? 'var(--bad-bg)'
      : dmSt === ST.WARN ? 'var(--warn-bg)' : dm ? 'rgba(8,120,138,.07)' : '#EDF2F5';
    band.style.stroke = dmSt === ST.OK ? 'var(--ok)' : dmSt === ST.BAD ? 'var(--bad)'
      : dmSt === ST.WARN ? 'var(--warn)' : dm ? 'var(--primary-line)' : '#D4DDE5';
  }
  const fence = host.querySelector('#topoFence');
  if(fence){
    const fw = app.sel.upfLoc === '园区下沉' ? TOPO_L.fenceWide : TOPO_L.fenceNarrow;
    const prevFw = app.topoFenceW;
    const jumpF = prevFw === undefined || prevFw === fw;
    fence.style.transition = 'none';
    fence.setAttribute('width', jumpF ? fw : prevFw);
    fence.getBoundingClientRect();
    fence.style.transition = '';
    if(!jumpF) fence.setAttribute('width', fw);
    app.topoFenceW = fw;
    fence.setAttribute('class', 'fence' + (dm === '独立专网' ? ' solid' : dm === '共享专网' ? '' : ' weak'));
  }
  // 数据不出园时，右侧运营商网络侧确实是闲置的
  const oh = host.querySelector('#outHint');
  if(oh) oh.textContent = app.sel.upfLoc === '园区下沉' ? '运营商网络侧 · 本方案未使用' : '';

  bindTopoNodes(host);
}

/* 拓扑网元可点击：从图上直接跳到对应参数的配置位置 */
function bindTopoNodes(host){
  const svg = host.querySelector('svg');
  if(!svg || svg.dataset.bound) return;
  svg.dataset.bound = '1';
  svg.querySelectorAll('.tnode[data-key]').forEach(g => {
    const key = g.dataset.key;
    if(!key || PARAM_STEP_INDEX[key] === undefined) return;
    g.setAttribute('role', 'button');
    g.setAttribute('tabindex', '0');
    g.setAttribute('aria-label', `前往 ${PARAM_LABELS[key]} 的配置`);
    const tip = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    tip.textContent = `点击前往 ${PARAM_LABELS[key]}`;
    g.appendChild(tip);
    g.addEventListener('click', () => gotoParam(key));
    g.addEventListener('keydown', e => {
      if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); gotoParam(key); }
    });
  });
}

/* 提交评测后，拓扑按 ①—⑨ 顺序逐项点亮 */
function revealTopo(){
  const nodes = [...document.querySelectorAll('#topoHost .tnode')]
    .sort((a,b) => Number(a.dataset.order || 99) - Number(b.dataset.order || 99));
  nodes.forEach((n, i) => {
    n.style.animationDelay = (i * 70) + 'ms';
    n.classList.add('reveal');
  });
}

