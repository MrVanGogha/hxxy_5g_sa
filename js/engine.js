/* ============================================================
   §2 判定引擎（纯函数，继承旧版规则，一处出口）
   ============================================================ */
const ST = { UNSET:'unselected', PENDING:'pending', OK:'ok', BAD:'bad', WARN:'warn' };
const isNum = v => v !== '' && v !== null && v !== undefined;

function delayMetrics(sc, qi, loc){
  const pdb = QI_PDB[Number(qi)];
  const locDelay = loc === '园区下沉' ? 2 : 15;
  const simDelay = Math.round(0.15 * pdb + locDelay);
  return { qi:Number(qi), pdb, loc, locDelay, simDelay, threshold:sc.delayThreshold, pass: simDelay <= sc.delayThreshold };
}
function capacityMetrics(sc, spec){
  const capacity = CAPACITY[spec];
  const satisfaction = Math.round(capacity / sc.bandwidthReq * 100);
  const occupancy = Math.round(sc.bandwidthReq / capacity * 100);
  let status, text;
  if(satisfaction >= 100){ status = ST.OK;
    text = `容量满足度 ${satisfaction}%，规格「${spec}」（${capacity}Mbps）可承载场景带宽需求 ${sc.bandwidthReq}Mbps。`;
  } else if(satisfaction >= 75 && spec === '10G'){ status = ST.WARN;
    text = `已选最高规格「10G」（${capacity}Mbps），但场景理论需求达 ${sc.bandwidthReq}Mbps，满足度约 ${satisfaction}%。工程上可分区域部署第二套 UPF 分流——此项"有条件通过"，不扣分。`;
  } else { status = ST.BAD;
    text = `容量不足：场景需求 ${sc.bandwidthReq}Mbps，当前规格「${spec}」仅 ${capacity}Mbps（满足度 ${satisfaction}%），请提高规格档位。`;
  }
  return { spec, capacity, req:sc.bandwidthReq, satisfaction, occupancy, status, text };
}
function evSingleRule(sc, sel, k){
  const v = sel[k];
  const base = { key:k, value:v, correct:sc.correct[k] };
  if(v === '' || v == null) return { ...base, status:ST.UNSET, text:'尚未选择。' };
  const ok = sc.correct[k].includes(v);
  const reason = sc.reason[k] || '参考值与该场景终端并发/速率量级匹配。';
  return { ...base, status: ok?ST.OK:ST.BAD,
    text: ok ? `✅ 判定正确 — ${reason}` : `❌ 判定错误 — 正确应为「${sc.correct[k].join(' / ')}」。${reason}` };
}
function evFrame(sc, sel){
  const v = sel.frame;
  if(!v) return { key:'frame', value:v, correct:sc.correct.frame, status:ST.UNSET, text:'尚未选择。' };
  const ok = sc.correct.frame.includes(v);
  return { key:'frame', value:v, correct:sc.correct.frame, status: ok?ST.OK:ST.BAD,
    text: ok ? `✅ 判定正确 — ${sc.reason.frame}` : `❌ 判定错误 — 正确应为「${sc.correct.frame.join(' / ')}」。${sc.reason.frame}` };
}
function evSlot(sc, sel){
  const {frame, slot} = sel;
  if(!frame) return { key:'slot', value:slot, status: slot?ST.PENDING:ST.UNSET, text:'需先选择③帧结构类型。' };
  if(!slot) return { key:'slot', value:slot, status:ST.PENDING, text:'⏳ 待选择 — 请先确定③帧结构，再选时隙配比。' };
  const legal = (SLOT_BY_FRAME[frame]||[]).includes(slot);
  return { key:'slot', value:slot, status: legal?ST.OK:ST.BAD,
    text: legal ? `✅ 与帧结构「${frame}」联动匹配（合法组合：${SLOT_BY_FRAME[frame].join(' / ')}）。`
                : `❌ 时隙配比「${slot}」与帧结构「${frame}」不配套，合法取值为 ${SLOT_BY_FRAME[frame].join(' / ')}。` };
}
// URLLC：⑥+⑧ 联合时延仿真（升级版：错误时明确诊断责任归属）
function evJointDelay(sc, sel){
  const qi = sel.qi, loc = sel.upfLoc;
  if(!isNum(qi) || !loc){
    const mk = (key, v, half) => ({ key, value:v, status: isNum(v)&&v!==''?ST.PENDING:ST.UNSET,
      text: (isNum(v)&&v!=='') ? half : '尚未选择。' });
    return { qi: mk('qi', qi, '⏳ 待判定 · 需配合⑧UPF部署位置'),
             upfLoc: mk('upfLoc', loc, '⏳ 待判定 · 需配合⑥5QI值') };
  }
  const m = delayMetrics(sc, qi, loc);
  // 反事实诊断：固定对方，换最优值看能否通过 —— 告诉学生问题出在哪半边
  const qiFixPass  = delayMetrics(sc, 3, loc).pass;   // 若换成最优 5QI=3 能否过
  const locFixPass = delayMetrics(sc, qi, '园区下沉').pass; // 若换成下沉能否过
  let diag;
  if(m.pass) diag = `仿真时延 ${m.simDelay}ms ≤ 阈值 ${m.threshold}ms，满足要求。`;
  else if(!qiFixPass && locFixPass) diag = `问题主要在 ⑥5QI：即使 UPF 保持「${loc}」，只要 5QI 预算降到 50ms（5QI=3）即可达标；当前 5QI=${m.qi} 的标准预算 ${m.pdb}ms 过高。`;
  else if(qiFixPass && !locFixPass) diag = `问题主要在 ⑧部署位置：当前 5QI=${m.qi} 的预算本身可行，但「集中部署」引入 15ms 回传时延导致超标，改为「园区下沉」（约 2ms）即可达标。`;
  else diag = `⑥与⑧都有问题：5QI=${m.qi} 预算 ${m.pdb}ms 过高，且「${loc}」回传时延也偏大，需同时改为 5QI=3 + 园区下沉。`;
  return {
    qi: { key:'qi', value:qi, status: m.pass?ST.OK:ST.BAD, metric:m,
      text: (m.pass?'✅ ':'❌ ') + diag + `（5QI=${m.qi} 标准时延预算 ${m.pdb}ms）` },
    upfLoc: { key:'upfLoc', value:loc, status: m.pass?ST.OK:ST.BAD, metric:m,
      text: (m.pass?'✅ ':'❌ ') + `部署位置对总时延贡献 ${m.locDelay}ms。` + diag }
  };
}
function evQiRule(sc, sel){
  const v = sel.qi;
  if(!isNum(v)) return { key:'qi', value:v, correct:sc.correct.qi, status:ST.UNSET, text:'尚未选择。' };
  const ok = sc.correct.qi.includes(Number(v));
  return { key:'qi', value:v, correct:sc.correct.qi, status: ok?ST.OK:ST.BAD,
    text: ok ? '✅ 判定正确 — 下行缓冲/浏览类业务对时延不敏感，5QI=6 或 9 即可。'
             : `❌ 判定错误 — 正确应为 5QI=${sc.correct.qi.join('或')}。该场景对时延不敏感，选 URLLC 级低时延 5QI 会浪费调度资源。` };
}
function evUpfLocRule(sc, sel){
  const v = sel.upfLoc;
  if(!v) return { key:'upfLoc', value:v, correct:sc.correct.upfLoc, status:ST.UNSET, text:'尚未选择。' };
  const ok = sc.correct.upfLoc.includes(v);
  return { key:'upfLoc', value:v, correct:sc.correct.upfLoc, status: ok?ST.OK:ST.BAD,
    text: ok ? '✅ 判定正确 — 时延不敏感，可集中部署降低建设与运维成本。'
             : `❌ 判定错误 — 正确应为「${sc.correct.upfLoc.join('/')}」。该场景无需下沉边缘，集中部署性价比更高。` };
}
function evUpfSpec(sc, sel){
  const v = sel.upfSpec;
  if(!v) return { key:'upfSpec', value:v, status:ST.UNSET, text:'尚未选择。' };
  const m = capacityMetrics(sc, v);
  return { key:'upfSpec', value:v, status:m.status, text:(m.status===ST.OK?'✅ ':m.status===ST.WARN?'⚠️ ':'❌ ')+m.text, metric:m };
}
function evaluateAll(sc, sel){
  const params = {};
  params.deployMode = evSingleRule(sc, sel, 'deployMode');
  params.band = evSingleRule(sc, sel, 'band');
  params.frame = evFrame(sc, sel);
  params.slot = evSlot(sc, sel);
  params.sst = evSingleRule(sc, sel, 'sst');
  if(sc.category === 'urllc'){
    const j = evJointDelay(sc, sel);
    params.qi = j.qi; params.upfLoc = j.upfLoc;
  } else {
    params.qi = evQiRule(sc, sel);
    params.upfLoc = evUpfLocRule(sc, sel);
  }
  params.ambr = evSingleRule(sc, sel, 'ambr');
  params.upfSpec = evUpfSpec(sc, sel);
  const metrics = {
    delay: (sc.category==='urllc' && isNum(sel.qi) && sel.upfLoc) ? delayMetrics(sc, sel.qi, sel.upfLoc) : null,
    capacity: sel.upfSpec ? capacityMetrics(sc, sel.upfSpec) : null
  };
  const done = PARAM_KEYS.filter(k => params[k].status === ST.OK).length;
  const allChosen = PARAM_KEYS.every(k => isNum(sel[k]));
  return { params, metrics, done, allChosen, total:PARAM_KEYS.length };
}

