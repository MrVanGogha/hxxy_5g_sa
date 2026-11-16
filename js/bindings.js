/* ============================================================
   §6 页面绑定逻辑
   ============================================================ */
function markStale(){ if(app.snapshot) app.snapshot.live = false; }
function selectScenario(sc){
  app.scenario = sc; app.sel = {}; app.think = {}; app.calcRows = [];
  app.snapshot = null; app.attempts = 0;
  app.topoDx = undefined; app.topoFenceW = undefined;
}
function confirmScenarioChange(sc){
  const box = modal(`
    <h3 style="margin-top:0">更换场景将清空当前练习进度</h3>
    <p>将清空已选参数、思考题、带宽计算器和当前结果，且无法撤销。建议先导出已有结果。</p>
    <div class="modal-actions">
      <button class="btn ghost" id="keepScenario">保留当前场景</button>
      <button class="btn" id="confirmScenario">确认更换并清空</button>
    </div>`, { initialFocus:'#keepScenario' });
  box.overlay.querySelector('#keepScenario').addEventListener('click', box.close);
  box.overlay.querySelector('#confirmScenario').addEventListener('click', () => {
    box.close();
    selectScenario(sc);
    render();
  });
}

function bindPage(step, root){
  // 通用：底部翻页
  const prev = root.querySelector('#prevBtn'), next = root.querySelector('#nextBtn');
  if(prev) prev.addEventListener('click', () => { if(app.step>0){ app.step--; render(); } });
  if(next) next.addEventListener('click', () => { if(app.step<STEPS.length-1){ app.step++; render(); } });

  if(step === 0){
    root.querySelectorAll('.scn-card').forEach(c => c.addEventListener('click', () => {
      const sc = SCENARIOS.find(s => s.id === c.dataset.id);
      if(app.scenario && app.scenario.id !== sc.id){ confirmScenarioChange(sc); return; }
      if(!app.scenario) selectScenario(sc);
      render();
    }));
  }
  if(step === 1) bindCalc(root);
  if([2,3,4,5].includes(step)) bindParams(root, step);
  if(step === 6) bindResult(root);
}

/* 思考前置绑定 */
function bindThinks(root){
  root.querySelectorAll('.think').forEach(el => {
    const key = el.dataset.think;
    // 恢复之前已答的思考题状态（参数变化触发页面重绘时不丢失）
    const saved = app.think[key];
    if(saved){
      const t = THINK_ANSWERS[key];
      const radio = el.querySelector(`input[value="${saved}"]`);
      if(radio) radio.checked = true;
      const v0 = el.querySelector('.verdict');
      v0.style.display = 'block'; v0.className = 'verdict';
      v0.textContent = '💡 ' + t.verdictFn(saved);
    }
    el.querySelectorAll('input[type=radio]').forEach(radio => {
      radio.addEventListener('change', () => {
        const t = THINK_ANSWERS[key];
        app.think[key] = radio.value;
        const v = el.querySelector('.verdict');
        v.style.display = 'block';
        v.className = 'verdict';
        v.textContent = '💡 ' + t.verdictFn(radio.value);
      });
    });
  });
}

/* 参数卡绑定 */
function bindParams(root, step){
  if(step === 2){ const h = root.querySelector('#topoHost'); if(h){ h.innerHTML = topoSvg(); paintTopo(); } }
  bindThinks(root);
  const keys = {2:['deployMode'], 3:['band','frame','slot'], 4:['sst','qi','ambr','upfLoc'], 5:['upfSpec']}[step] || [];
  keys.forEach(key => {
    const sel = root.querySelector('#sel-' + key);
    if(!sel) return;
    sel.addEventListener('change', () => {
      app.sel[key] = sel.value;
      if(key === 'frame'){
        const legal = SLOT_BY_FRAME[sel.value] || [];
        if(app.sel.slot && !legal.includes(app.sel.slot)) app.sel.slot = '';
      }
      markStale();
      render(true);
    });
  });
  paintSnapshotOnCards(root, keys);
}
function paintSnapshotOnCards(root, keys){
  const snap = app.snapshot;
  keys.forEach(key => {
    const card = root.querySelector('#pcard-' + key);
    const stEl = root.querySelector('#status-' + key);
    const sel = root.querySelector('#sel-' + key);
    if(!card || !stEl) return;
    if(snap && snap.live){
      const p = snap.result.params[key];
      card.classList.add('st-' + p.status);
      stEl.innerHTML = p.text;
      if(p.status === ST.OK){ sel.disabled = true; }
      else if(p.status === ST.BAD || p.status === ST.WARN){
        // 只有判定为不合格 / 有条件通过时才给"重新选择"入口；未选与待判定不出现
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'retry'; b.textContent = '重新选择此项 →';
        b.addEventListener('click', () => {
          sel.disabled = false;
          card.scrollIntoView({behavior:motionBehavior(), block:'center'});
          sel.focus({preventScroll:true});
        });
        stEl.appendChild(b);
      }
    }
  });
}

/* 带宽计算器 */
let calcSeq = 0;
function validQty(value){ return /^[1-9]\d*$/.test(String(value).trim()); }
function qtyValue(r){ return r.qtyDraft !== undefined ? r.qtyDraft : r.qty; }
function calcFinal(){
  const total = app.calcRows.reduce((a, r) => {
    const b = BUSINESS_POOL.find(x => x.id === r.bizId);
    return a + (b && validQty(qtyValue(r)) ? b.unitMbps * Number(qtyValue(r)) : 0);
  }, 0);
  return +(total * (1 + REDUNDANCY)).toFixed(2);
}
function bindCalc(root){
  const host = root.querySelector('#calcRows');
  function updateTotals(){
    const total = app.calcRows.reduce((a, r) => {
      const b = BUSINESS_POOL.find(x => x.id === r.bizId);
      return a + (b && validQty(qtyValue(r)) ? b.unitMbps * Number(qtyValue(r)) : 0);
    }, 0);
    const fin = +(total * (1 + REDUNDANCY)).toFixed(2);
    root.querySelector('#calcTotal').textContent = total.toFixed(1) + ' Mbps';
    root.querySelector('#calcFinal').textContent = fin + ' Mbps';
    root.querySelector('#calcTier').textContent = fin > 0 ? tierOf(fin) : '—';
    const sg = root.querySelector('#calcSuggest');
    if(fin > 0 && app.scenario){
      sg.classList.add('show');
      sg.innerHTML = `📌 记住这个数字：<b>${fin} Mbps</b>，第 6 步选 ⑨UPF 规格时要用。` +
        (fin > app.scenario.bandwidthReq * 1.5 ? ' ⚠️ 注意：你的估算明显高于场景基线，检查一下是否多算了业务或数量。' : '');
    } else sg.classList.remove('show');
  }
  function syncQty(rowEl, input){
    const r = app.calcRows.find(x => x.rowId === Number(rowEl.dataset.row));
    const raw = input.value;
    const ok = validQty(raw);
    if(ok){ r.qty = String(Number(raw)); delete r.qtyDraft; }
    else { r.qtyDraft = raw; delete r.qty; }
    const b = BUSINESS_POOL.find(x => x.id === r.bizId);
    rowEl.classList.toggle('has-error', !ok);
    input.setAttribute('aria-invalid', String(!ok));
    const err = rowEl.querySelector('.qty-error');
    if(err) err.textContent = ok ? '' : '数量需为≥1的整数；此行暂不计入合计';
    rowEl.querySelector('.c-sub').textContent = b && ok ? (b.unitMbps * Number(raw)).toFixed(1) : '—';
    updateTotals();
  }
  function paint(){
    if(!app.calcRows.length){
      host.innerHTML = `<div style="padding:24px 18px;text-align:center">
        <div style="color:var(--muted);font-size:14px;margin-bottom:12px">还没有业务行。从本场景的真实业务开始，添加后填写并发数量。</div>
        <button type="button" class="btn ghost" id="addFirstRow">＋ 添加第一条业务</button>
      </div>`;
    } else {
      host.innerHTML = `<div class="calc-row head"><div>业务类型</div><div>方向</div><div>单路带宽</div><div>数量</div><div>小计(Mbps)</div><div></div></div>` +
        app.calcRows.map(r => {
          const b = BUSINESS_POOL.find(x => x.id === r.bizId);
          const raw = qtyValue(r);
          const ok = validQty(raw);
          const used = new Set(app.calcRows.map(x => x.bizId).filter(Boolean));
          return `<div class="calc-row${ok?'':' has-error'}" data-row="${r.rowId}">
            <select class="c-biz" aria-label="业务类型">
              <option value="">请选择业务类型…</option>
              ${BUSINESS_POOL.map(x => `<option value="${x.id}" ${x.id===r.bizId?'selected':''} ${x.id!==r.bizId && used.has(x.id)?'disabled':''}>${x.name}</option>`).join('')}
            </select>
            <div>${b?b.direction:'—'}</div>
            <div class="num">${b?b.unitMbps+' Mbps':'—'}</div>
            <div class="qty-cell"><input type="number" class="c-qty" min="1" step="1" placeholder="数量" value="${raw}" aria-invalid="${!ok}" aria-describedby="qty-error-${r.rowId}">
              <span class="qty-error" id="qty-error-${r.rowId}">${ok?'':'数量需为≥1的整数；此行暂不计入合计'}</span></div>
            <div class="num c-sub">${b && ok ? (b.unitMbps*Number(raw)).toFixed(1) : '—'}</div>
            <button class="c-del" title="删除" aria-label="删除业务行">✕</button>
          </div>`;
        }).join('');
    }
    updateTotals();
  }
  root.querySelector('#addRow').addEventListener('click', () => {
    app.calcRows.push({ rowId:++calcSeq, bizId:'', qty:'' }); paint();
  });
  host.addEventListener('input', e => {
    if(!e.target.classList.contains('c-qty')) return;
    const rowEl = e.target.closest('.calc-row'); if(!rowEl) return;
    syncQty(rowEl, e.target);
  });
  host.addEventListener('change', e => {
    const rowEl = e.target.closest('.calc-row'); if(!rowEl) return;
    const r = app.calcRows.find(x => x.rowId === Number(rowEl.dataset.row));
    if(e.target.classList.contains('c-biz')){ r.bizId = e.target.value; paint(); }
    if(e.target.classList.contains('c-qty')) syncQty(rowEl, e.target);
  });
  host.addEventListener('click', e => {
    if(e.target.id === 'addFirstRow'){
      app.calcRows.push({ rowId:++calcSeq, bizId:'', qty:'' });
      paint();
      const first = host.querySelector('.calc-row[data-row] select.c-biz');
      if(first) first.focus();
      return;
    }
    if(!e.target.classList.contains('c-del')) return;
    const rowEl = e.target.closest('.calc-row');
    app.calcRows = app.calcRows.filter(x => x.rowId !== Number(rowEl.dataset.row));
    paint();
  });
  paint();
}

/* 提交与结果 */
function motionBehavior(){ return matchMedia('(prefers-reduced-motion:reduce)').matches ? 'auto' : 'smooth'; }
function gotoParam(key){
  const step = PARAM_STEP_INDEX[key];
  if(step === undefined) return;
  app.step = step;
  render();
  const card = document.getElementById('pcard-' + key);
  const sel = document.getElementById('sel-' + key);
  if(card) card.scrollIntoView({behavior:motionBehavior(), block:'center'});
  if(sel) sel.focus({preventScroll:true});
}
function focusResultSummary(){
  const summary = document.getElementById('resultSummary');
  if(!summary) return;
  summary.scrollIntoView({behavior:motionBehavior(), block:'start'});
  summary.focus({preventScroll:true});
}
function bindResult(root){
  const th = root.querySelector('#topoHost');
  if(th){ th.innerHTML = topoSvg(); paintTopo(); }
  root.addEventListener('click', e => {
    const btn = e.target.closest('[data-goto-param]');
    if(btn) gotoParam(btn.dataset.gotoParam);
  });
  root.querySelector('#submitBtn').addEventListener('click', () => {
    if(!allFilled()) return;
    app.attempts++;
    app.snapshot = { result: evaluateAll(app.scenario, app.sel), live:true, attempt:app.attempts, at:new Date() };
    recordStats(app.scenario.id, app.snapshot.result);
    render();
    revealTopo();
    focusResultSummary();
  });
  const ex = root.querySelector('#exportBtn');
  if(ex) ex.addEventListener('click', exportMarkdown);
}

/* 导出 Markdown */
function exportMarkdown(){
  const sc = app.scenario, snap = app.snapshot;
  if(!snap) return;
  const r = snap.result;
  const lines = [];
  lines.push(`# ${sc.name} 5G SA 专网仿真评测结果`, '');
  lines.push(`- 提交次数：第 ${snap.attempt} 次 · 时间：${snap.at.toLocaleString('zh-CN')}`);
  lines.push(`- 总分：${r.done}/${r.total} 项合格`, '');
  lines.push(`## 参数配置与判定`, '');
  lines.push(`| 参数 | 本组取值 | 判定 | 说明 |`, `|---|---|---|---|`);
  PARAM_KEYS.forEach(k => {
    const p = r.params[k];
    const st = p.status===ST.OK?'✅合格':p.status===ST.WARN?'⚠️有条件通过':p.status===ST.BAD?'❌不合格':'未判定';
    lines.push(`| ${PARAM_LABELS[k]} | ${p.value ?? '—'} | ${st} | ${p.text.replace(/\|/g,'/')} |`);
  });
  if(r.metrics.delay) lines.push('', `## 时延仿真`, `仿真时延 ${r.metrics.delay.simDelay}ms（阈值 <${r.metrics.delay.threshold}ms），${r.metrics.delay.pass?'满足':'不满足'}要求。`);
  if(r.metrics.capacity) lines.push('', `## 容量仿真`, `UPF 规格 ${r.metrics.capacity.spec}（${r.metrics.capacity.capacity}Mbps），场景需求 ${r.metrics.capacity.req}Mbps，满足度 ${r.metrics.capacity.satisfaction}%。`);
  lines.push('', `## 5G↔4G 对应关系`, '', `| 5G SA | 4G LTE | 相似性 | 区别 |`, `|---|---|---|---|`);
  MAP4G_TABLE.forEach(row => lines.push(`| ${row.join(' | ')} |`));
  const blob = new Blob([lines.join('\n')], { type:'text/markdown;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${sc.name}_5GSA仿真评测结果${snap.live ? '' : '_已过期'}.md`;
  a.click(); URL.revokeObjectURL(a.href);
}

