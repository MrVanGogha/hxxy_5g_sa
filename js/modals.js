/* ============================================================
   §7 顶栏弹层：4G 速查 + 教师统计
   ============================================================ */
function modal(html, options = {}){
  const trigger = document.activeElement;
  const ov = document.createElement('div');
  ov.className = 'modal-overlay';
  ov.innerHTML = `<div class="modal-dialog" role="dialog" aria-modal="true" tabindex="-1">
    <div class="modal-close-row"><button class="hbtn" id="mClose">关闭 ✕</button></div>${html}</div>`;
  const close = () => {
    window.removeEventListener('keydown', onKey);
    ov.remove();
    if(trigger && document.contains(trigger)) trigger.focus({preventScroll:true});
  };
  const onKey = e => { if(e.key === 'Escape') close(); };
  ov.addEventListener('click', e => { if(e.target === ov || e.target.id === 'mClose') close(); });
  window.addEventListener('keydown', onKey);
  document.body.appendChild(ov);
  const initial = options.initialFocus ? ov.querySelector(options.initialFocus) : ov.querySelector('#mClose');
  if(initial) initial.focus();
  return { overlay:ov, close };
}
document.getElementById('btn4g').addEventListener('click', () => {
  modal(`<h3 style="margin-top:0">📚 5G ↔ 4G 参数对应关系速查表</h3>
    <table class="map4g"><tr><th>5G SA 参数</th><th>4G LTE 对应</th><th>功能相似性</th><th>关键区别</th></tr>
    ${MAP4G_TABLE.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</table>
    <p style="font-size:12.5px;color:var(--muted)">理解 5G 与 4G 参数的对应关系，有助于把已学的 4G 知识迁移到 5G 专网设计中。</p>`);
});
document.getElementById('btnTeacher').addEventListener('click', () => {
  const all = loadStats();
  const cells = [];
  Object.entries(all).forEach(([scId, rec]) => {
    const sc = SCENARIOS.find(s => s.id === scId);
    PARAM_KEYS.forEach(k => {
      const w = rec.wrong[k] || 0;
      if(rec.total > 0) cells.push({ sc: sc ? sc.name : scId, k, rate: Math.round(w/rec.total*100), w, t: rec.total });
    });
  });
  modal(`<h3 style="margin-top:0">👩‍🏫 教师统计（本机累计，按参数错误率）</h3>
    ${cells.length ? `<div class="teacher-grid">${cells.map(c => `
      <div class="teacher-cell"><div class="n" style="color:${c.rate>50?'var(--bad)':c.rate>20?'var(--warn)':'var(--ok)'}">${c.rate}%</div>
      <div class="l">${c.sc} · ${PARAM_LABELS[c.k]}（错 ${c.w}/${c.t} 次）</div></div>`).join('')}</div>
      <button class="hbtn" id="clearStats" style="margin-top:14px">🗑 清空统计</button>`
    : '<p style="color:var(--muted)">还没有提交记录。学生提交评测后，这里按参数累计错误率。</p>'}`);
  const cs = document.getElementById('clearStats');
  if(cs) cs.addEventListener('click', () => { localStorage.removeItem(TKEY); document.querySelector('.hbtn#mClose')?.click(); });
});

