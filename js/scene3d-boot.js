
window.__scenesHidden=false;
window.__scenesBusy=false;
/* 沙盘场景 id ↔ 工作台场景 id（仅露天矿坑命名不同） */
var __SC2WB={coal:'coal',factory:'factory',port:'port',campus:'campus',grid:'grid',hospital:'hospital',airport:'airport',pit:'mine'};
var __WB2SC={coal:'coal',factory:'factory',port:'port',campus:'campus',grid:'grid',hospital:'hospital',airport:'airport',mine:'pit'};
/* 工作台轻提示 */
window.__wbToast=function(msg){
  var t=document.createElement('div');
  t.className='wb-toast';t.setAttribute('role','status');t.textContent=msg;
  document.body.appendChild(t);void t.offsetWidth;t.classList.add('in');
  setTimeout(function(){t.classList.remove('in');setTimeout(function(){if(t.parentNode)t.parentNode.removeChild(t)},340);},3200);
};
/* 在工作台里选中指定场景（沿用工作台自身的 selectScenario/render） */
window.__pickScenario=function(id){
  try{
    if(!id||typeof SCENARIOS==='undefined'||typeof app==='undefined')return false;
    var sc=null,i;
    for(i=0;i<SCENARIOS.length;i++)if(SCENARIOS[i].id===id){sc=SCENARIOS[i];break}
    if(!sc)return false;
    var changed=!app.scenario||app.scenario.id!==id;
    var had=!!app.scenario&&(Object.keys(app.sel||{}).length>0||(app.attempts||0)>0);
    if(changed){selectScenario(sc);app.step=0;}
    render();
    if(changed&&had)setTimeout(function(){window.__wbToast('已切换为「'+sc.name+'」场景，原场景的练习进度已清空');},700);
    setTimeout(function(){
      var card=document.querySelector('.scn-card[data-id="'+id+'"]');
      if(!card)return;
      try{card.scrollIntoView({block:'center',behavior:'smooth'})}catch(e){}
      card.classList.remove('scn-hit');void card.offsetWidth;card.classList.add('scn-hit');
      setTimeout(function(){card.classList.remove('scn-hit')},2400);
    },140);
    return true;
  }catch(e){return false}
};
/* 沙盘 → 工作台：sid 为 null 表示总览（不改动工作台当前场景） */
window.__goWorkbench=function(sid){
  if(sid)window.__pickScenario(__SC2WB[sid]||sid);
  window.__closeScenes();
};
/* 沙盘 → 工作台：沙盘推远淡出，工作台自上浮淡入；淡出结束后才隐藏并暂停 3D 渲染 */
window.__closeScenes=function(instant){
  var el=document.getElementById('scenes3d');
  if(!el)return;
  if(window.__scenesBusy)return;
  /* 数智人只在工作台视图唤起（首次进入时启动，之后常驻） */
  if(window.__cxRobotStart)window.__cxRobotStart();
  if(instant||window.matchMedia('(prefers-reduced-motion:reduce)').matches){
    el.style.display='none';document.body.classList.remove('sc-open');
    document.body.classList.remove('wb-enter');window.__scenesHidden=true;return;
  }
  window.__scenesBusy=true;
  document.body.classList.remove('sc-open');
  el.classList.add('sc3d-exit');
  document.body.classList.add('wb-enter');
  /* 底板淡出结束（500ms）即隐藏并暂停渲染，让工作台可交互 */
  setTimeout(function(){
    el.style.display='none';
    el.classList.remove('sc3d-exit');
    window.__scenesHidden=true;
  },500);
  /* 工作台上浮动画（最长 720ms）走完再清理类与锁，避免动画被截断 */
  setTimeout(function(){
    document.body.classList.remove('wb-enter');
    window.__scenesBusy=false;
  },760);
};
/* 工作台 → 沙盘：沙盘轻微推近淡入 */
window.__openScenes=function(){
  var el=document.getElementById('scenes3d');
  if(!el)return;
  if(window.__scenesBusy)return;
  var reduce=window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  window.__scenesHidden=false;
  el.style.display='block';
  document.body.classList.add('sc-open');
  if(!reduce){
    window.__scenesBusy=true;
    el.classList.add('sc3d-pre');
    void el.offsetWidth;
    el.classList.remove('sc3d-pre');
    setTimeout(function(){window.__scenesBusy=false;},480);
  }
};
document.getElementById('btnScenes').onclick=function(){
  /* 回到沙盘时，若工作台已选场景，沙盘直接定位到同一场景 */
  try{
    if(typeof app!=='undefined'&&app.scenario&&window.__scenesFocus){
      var sid=__WB2SC[app.scenario.id];
      if(sid)window.__scenesFocus(sid);
    }
  }catch(e){}
  window.__openScenes();
};
if(location.hash==='#workbench'){window.__closeScenes(true);}else{document.body.classList.add('sc-open');}
setTimeout(function(){if(!window.__scenesBooted){var f=document.getElementById('glFallback');if(f)f.hidden=false;}},9000);
