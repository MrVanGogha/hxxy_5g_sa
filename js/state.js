/* ============================================================
   §3 应用状态
   ============================================================ */
const app = {
  scenario: null,
  sel: {},              // 学生选择
  think: {},            // 思考前置的回答 {param: {choice, right}}
  calcRows: [],         // 带宽计算器
  snapshot: null,       // 正式评测快照 {result, live, attempt}
  attempts: 0,
  step: 0,
  maxStep: 0
};

// 教师统计（localStorage 持久化）
const TKEY = 'sa5g_teacher_stats';
function loadStats(){ try{ return JSON.parse(localStorage.getItem(TKEY)) || {}; }catch(e){ return {}; } }
function saveStats(s){ localStorage.setItem(TKEY, JSON.stringify(s)); }
function recordStats(scId, result){
  const all = loadStats();
  const rec = all[scId] || { total:0, wrong:{} };
  rec.total++;
  PARAM_KEYS.forEach(k => {
    if(result.params[k].status !== ST.OK) rec.wrong[k] = (rec.wrong[k]||0)+1;
  });
  all[scId] = rec; saveStats(all);
}

