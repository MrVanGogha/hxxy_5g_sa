
/* 超星数智人：改为按需启动。
   独立工作台页面 → DOMContentLoaded 后立即初始化；
   融合版（含 #scenes3d 沙盘）→ 由沙盘脚本在首次进入工作台视图时调用 __cxRobotStart()，
   沙盘视图里既不加载、也不显示。 */
window.__cxRobotStart = function(){
  if(window.__cxStarted) return;
  window.__cxStarted = true;
  (function initCxRobot(retries){
    if(typeof CxRobotSdkJs !== 'undefined' && CxRobotSdkJs && CxRobotSdkJs.init){
      CxRobotSdkJs.init("https://robot.chaoxing.com/embedChat?unitId=1454&robotId=a40732f8196740809de85a58cd40cc5b&groupId=0&openType=auto&openPage=coze", "2c1421b74d1607f1695476e356c5a85c");
      console.log('[数智人] SDK 初始化成功');
    } else if(retries > 0){
      console.warn('[数智人] SDK 尚未就绪，1 秒后重试（剩余 ' + retries + ' 次）…');
      setTimeout(function(){ initCxRobot(retries - 1); }, 1000);
    } else {
      console.error('[数智人] SDK 加载失败。请检查：1) 网络能否访问 robot.chaoxing.com（系统代理是否可用）；2) 是否被广告拦截插件屏蔽；3) 是否以 http(s) 方式打开页面。页面主体功能不受影响。');
    }
  })(5);
};
document.addEventListener('DOMContentLoaded', function(){
  if(!document.getElementById('scenes3d')) window.__cxRobotStart();
});

