﻿/* ============================================================
   §1 数据层（继承旧版仿真配置器知识基线，并与教学 docx 对齐）
   ============================================================ */
const OPTIONS = {
  deployMode:['独立专网','共享专网','公网切片'],
  band:['n28','n41','n78','n79'],
  frame:['2.5ms双周期','2.5ms单周期','5ms单周期'],
  sst:['1(eMBB)','2(URLLC)','3(mMTC)','4(V2X)'],
  qi:[1,2,3,4,5,6,7,8,9],
  ambr:['10Mbps','50Mbps','100Mbps','500Mbps','1Gbps','2Gbps','4Gbps'],
  upfLoc:['园区下沉','集中部署'],
  upfSpec:['1G','5G','10G']
};
const SLOT_BY_FRAME = {
  '2.5ms双周期':['10:2:2','9:3:2','8:4:2'],
  '2.5ms单周期':['10:2:2','9:3:2','8:4:2'],
  '5ms单周期':['6:4:4']
};
const QI_PDB = {1:100,2:150,3:50,4:300,5:100,6:300,7:100,8:300,9:300};
const CAPACITY = {'1G':1000,'5G':5000,'10G':10000};
// UE-AMBR 选项数值（Mbps），用于区间判定：≥ 单终端峰值×1.2 冗余 即合理
const AMBR_VAL = {'10Mbps':10,'50Mbps':50,'100Mbps':100,'500Mbps':500,'1Gbps':1000,'2Gbps':2000,'4Gbps':4000};
const REDUNDANCY = 0.20;
const PARAM_KEYS = ['deployMode','band','frame','slot','sst','qi','ambr','upfLoc','upfSpec'];
const PARAM_LABELS = {
  deployMode:'① 部署模式', band:'② 频段选择', frame:'③ 帧结构类型', slot:'④ 特殊时隙配比',
  sst:'⑤ 切片类型(SST)', qi:'⑥ 5QI值', ambr:'⑦ UE-AMBR', upfLoc:'⑧ UPF部署位置', upfSpec:'⑨ UPF规格'
};
// 诊断回步映射：值为零基步骤索引，界面步号 = 索引 + 1
const PARAM_STEP_INDEX = {deployMode:2, band:3, frame:3, slot:3, sst:4, qi:4, ambr:4, upfLoc:4, upfSpec:5};
// 4G 对应关系提示（挂在参数卡上）
const MAP4G_HINT = {
  deployMode:'', band:'', frame:'', slot:'',
  sst:'APN（都是选网络的标识，切片更精细）',
  qi:'QCI（都是 QoS 等级，5QI 范围更大）',
  ambr:'APN-AMBR（5G 分 UE 级 + 会话级）',
  upfLoc:'4G 的 SGW-U/PGW-U 无边缘下沉能力',
  upfSpec:''
};
const MAP4G_TABLE = [
  ['SNSSAI（切片标识）','APN（接入点名称）','都是选择特定网络的标识','5G 切片更精细，可多切片共用一个 APN'],
  ['5QI','QCI','都是标识 QoS 等级的数字','5QI 值范围更大，支持自定义'],
  ['UE-AMBR','APN-AMBR','都限制用户聚合比特率','5G 是 UE级 + 会话级两级 AMBR'],
  ['AMF','MME','都负责移动性管理','5G AMF 与 SMF 分离，拆分更细'],
  ['SMF','SGW-C / PGW-C','都负责会话管理','SMF 是纯控制面，与 UPF 分离'],
  ['UPF','SGW-U / PGW-U','都负责数据转发','UPF 可灵活下沉到网络边缘'],
  ['UDM','HSS','都存储用户签约数据','UDM 增加了切片选择等功能'],
  ['N2 接口','S1-AP 接口','基站与核心网控制面接口','接口名称和协议不同'],
  ['N3 接口','S1-U 接口','基站与核心网用户面接口','接口名称和协议不同']
];

const SCENARIOS = [
  { id:'coal', name:'智慧煤矿', icon:'⛏️', category:'urllc',
    brief:'大型煤矿推进"无人化采掘"，需 5G SA 专网实现矿卡远程操控、井下环境实时监测、无人机自动巡检。井下覆盖是最大挑战。',
    ind:{area:'10km² 矿区（含井下巷道）', dev:'200台矿卡(远程操控/视频回传)+100台巡检无人机+300个井下传感器', bw:'上行>200Mbps，下行>100Mbps', dl:'<30ms（设备控制指令）', rel:'99.999%', sp:'需支持井下覆盖（深度>500米），终端需具备防爆特性'},
    coverage:'覆盖 10km²', delayThreshold:30, bandwidthReq:360, ambrMin:60,
    correct:{deployMode:['独立专网'],band:['n28'],frame:['2.5ms双周期'],sst:['1(eMBB)'],qi:[3],upfLoc:['园区下沉']},
    reason:{deployMode:'矿区安全等级高，数据不能出矿区，只有独立专网能满足物理隔离要求。',band:'矿区覆盖面积达10km²，n28 波长最长、覆盖最远；高频段覆盖半径不足以支撑露天矿坑。',frame:'矿卡视频回传是持续上行大流量业务，需要连续上行时隙，应选上行占比更高的 2.5ms 双周期。',sst:'SST 按主导流量类型选：矿卡视频回传+井下传感器采集是流量主体，属 eMBB；矿卡远程操控的低时延由 5QI=3 单独保障。',ambr:'单台矿卡峰值=多路视频 50Mbps+控制 2Mbps，×1.2 冗余 ≈62Mbps，UE-AMBR 选 100Mbps 及以上档位即可（依据材料八单路带宽表）。'} },
  { id:'factory', name:'智慧工厂', icon:'🏭', category:'urllc',
    brief:'大型家电制造工厂建设 5G 全连接工厂，AGV 低时延调度，高清质检视频实时回传边缘平台做 AI 质检。',
    ind:{area:'5万㎡ 钢结构厂房', dev:'200台AGV+30路高清视频监控+500个传感器+50台员工终端', bw:'上行>500Mbps（多路视频回传），下行>100Mbps', dl:'<20ms（AGV调度），<100ms（监控视频）', rel:'99.999%', sp:'数据不能出园区（数据安全合规）'},
    coverage:'园区级覆盖', delayThreshold:20, bandwidthReq:720, ambrMin:20,
    correct:{deployMode:['独立专网'],band:['n41'],frame:['2.5ms双周期'],sst:['1(eMBB)'],qi:[7],upfLoc:['园区下沉']},
    reason:{deployMode:'工厂产线数据不允许出园区，需要独立专网做物理隔离。',band:'按选频决策建议，工厂属均衡型场景 → n41；n28 容量不足以支撑 500Mbps 上行视频回传，n78/n79 属容量优先型，用于本场景成本偏高。',frame:'以视频回传为主的上行业务模型，需要连续上行时隙，应选 2.5ms 双周期。',sst:'SST 按主导流量类型选：视频监控+员工上网是流量主体，属 eMBB；AGV 调度的低时延由 5QI=7 单独保障，不改变 SST 大类。',ambr:'单终端峰值=高清质检摄像头 15Mbps，×1.2 冗余 ≈18Mbps，UE-AMBR 选 50Mbps 及以上档位即可（依据材料八单路带宽表）。'} },
  { id:'port', name:'智慧港口', icon:'🚢', category:'urllc',
    brief:'大型集装箱港口升级自动化码头，岸桥司机移到中控室通过 5G 远程操控岸桥装卸，对时延和可靠性要求极高。',
    ind:{area:'2km² 码头作业区', dev:'50台岸桥(远程操控)+100台无人集卡+100个设备传感器', bw:'上行>300Mbps，下行>200Mbps', dl:'<10ms（岸桥远程操控），<50ms（数据采集）', rel:'99.999%', sp:'沿海高湿盐雾环境，设备需防腐'},
    coverage:'码头区域覆盖', delayThreshold:10, bandwidthReq:600, ambrMin:50,
    correct:{deployMode:['独立专网'],band:['n28'],frame:['2.5ms双周期'],sst:['2(URLLC)'],qi:[3],upfLoc:['园区下沉']},
    reason:{deployMode:'远程操控关系作业安全，必须独立专网保障可控性。',band:'按选频决策建议，覆盖优先（矿区/港口/电网）→ n28：码头 2km² 作业区要求大覆盖，n28 覆盖最远、穿透最强。',frame:'岸桥视频回传+集卡调度均以上行为主，应选 2.5ms 双周期争取更多上行资源。',sst:'岸桥远程操控对时延极敏感（<10ms），属 URLLC 场景。',ambr:'单岸桥峰值=多路视频 40Mbps+远程操控指令 2Mbps，×1.2 冗余 ≈50Mbps，UE-AMBR 选 50Mbps 及以上档位即可（依据材料八单路带宽表）。'} },
  { id:'campus', name:'智慧园区', icon:'🏢', category:'embb',
    brief:'高新技术产业园区建设 5G SA 智慧园区，智能安防、环境监测、园区办公多业务统一承载。',
    ind:{area:'1km² 科技园区', dev:'200路安防摄像头+500个环境传感器+200台员工终端+100个智能照明', bw:'下行>1Gbps（峰值），上行>100Mbps', dl:'<50ms', rel:'99.99%', sp:'混合业务并发（人+物同时接入），需差异化 QoS'},
    coverage:'覆盖 1km²', delayThreshold:50, bandwidthReq:1320, ambrMin:20,
    correct:{deployMode:['共享专网','公网切片'],band:['n41'],frame:['2.5ms单周期','5ms单周期'],sst:['1(eMBB)'],qi:[4,6,8,9],upfLoc:['集中部署']},
    reason:{deployMode:'安全要求中等，独立专网成本过高，共享专网或公网切片性价比更合适。',band:'覆盖面积和并发量中等，n41 在覆盖与容量间最均衡。',frame:'员工上网和监控回看都是下行为主的业务模型，应选下行占比更高的单周期帧结构。',sst:'上网、视频、传感器都是标准 eMBB 业务，无低时延强制要求。',ambr:'单终端峰值=安防摄像头 15Mbps，×1.2 冗余 ≈18Mbps，UE-AMBR 选 50Mbps 及以上档位即可（依据材料八单路带宽表）。'} },
  { id:'grid', name:'智慧电网', icon:'⚡', category:'urllc',
    brief:'电网公司利用 5G SA 专网实现输电线路智能巡检和配网差动保护，无人机回传高清视频，差动保护指令需极低时延。',
    ind:{area:'50km 输电线路（带状覆盖）', dev:'200台巡检无人机+300个输电线路传感器', bw:'上行>150Mbps，下行>50Mbps', dl:'<15ms（差动保护指令）', rel:'99.999%', sp:'狭长输电走廊（非面状覆盖），终端电池续航要求高'},
    coverage:'50km 带状覆盖', delayThreshold:15, bandwidthReq:240, ambrMin:25,
    correct:{deployMode:['独立专网'],band:['n28'],frame:['2.5ms双周期'],sst:['2(URLLC)'],qi:[3],upfLoc:['园区下沉']},
    reason:{deployMode:'电网涉及国家关键基础设施，安全要求极高，必须独立专网。',band:'50km 狭长带状覆盖是关键约束，n28 覆盖半径最大，其余频段无法连续覆盖整条走廊。',frame:'无人机巡检视频回传是持续上行业务，应选 2.5ms 双周期获得更多上行时隙。',sst:'差动保护要求时延 <15ms，属 URLLC 场景。',ambr:'单台无人机峰值=巡检视频 20Mbps，×1.2 冗余 ≈24Mbps，UE-AMBR 选 50Mbps 及以上档位即可（依据材料八单路带宽表）。'} },
  { id:'hospital', name:'智慧医院', icon:'🏥', category:'urllc',
    brief:'三甲医院建设智慧医院，远程手术机器人需医生通过 5G 远程操控，时延极苛刻；移动查房车跨楼宇漫游保持业务连续。',
    ind:{area:'8万㎡ 院区（门诊楼+住院楼+手术楼）', dev:'50台移动查房车+50台远程手术机器人+200个医疗传感器', bw:'上行>400Mbps，下行>500Mbps', dl:'<10ms（远程手术操控）', rel:'99.999%', sp:'数据不出院区（患者隐私合规），需支持移动性'},
    coverage:'院区覆盖', delayThreshold:10, bandwidthReq:1080, ambrMin:50,
    correct:{deployMode:['独立专网'],band:['n78','n79'],frame:['2.5ms双周期'],sst:['2(URLLC)'],qi:[3],upfLoc:['园区下沉']},
    reason:{deployMode:'患者隐私数据不能出院区，必须独立专网。',band:'按选频决策建议，容量优先（机场/医院）→ n78 或 n79：远程手术需大带宽承载多路高清视频，n28 容量不足。',frame:'手术视频回传+查房车数据以上行为主，应选 2.5ms 双周期。',sst:'远程手术要求时延 <10ms，是最典型的 URLLC 场景。',ambr:'单台手术机器人峰值=多路 4K 视频 40Mbps+操控指令 2Mbps，×1.2 冗余 ≈50Mbps，UE-AMBR 选 50Mbps 及以上档位即可（依据材料八单路带宽表）。'} },
  { id:'airport', name:'智慧机场', icon:'✈️', category:'embb',
    brief:'大型国际机场建设 5G SA 专网，同时满足地勤调度专网通信与航站楼旅客高速上网。',
    ind:{area:'5km² 航站楼+停机坪', dev:'300台地勤终端+500个环境传感器+2000个旅客终端', bw:'上行>200Mbps，下行>800Mbps（旅客服务）', dl:'<30ms（地勤调度）', rel:'99.999%', sp:'高密度用户场景，需同时服务公众与专网'},
    coverage:'覆盖 5km²', delayThreshold:30, bandwidthReq:1200, ambrMin:15,
    correct:{deployMode:['共享专网'],band:['n78','n79'],frame:['2.5ms单周期','5ms单周期'],sst:['1(eMBB)'],qi:[6,7,8,9],upfLoc:['集中部署']},
    reason:{deployMode:'地勤与旅客业务安全等级不同但可共存，共享专网兼顾安全与成本。',band:'按选频决策建议，容量优先（机场/医院）→ n78 或 n79：5km² 覆盖+2000 旅客终端高密度并发，需要大带宽容量。',frame:'旅客上网是下行为主，应选单周期帧结构。',sst:'旅客上网+地勤调度都是标准 eMBB 业务。',ambr:'单终端峰值=地勤/员工终端上网 10Mbps，×1.2 冗余 ≈12Mbps，UE-AMBR 选 50Mbps 及以上档位即可（依据材料八单路带宽表）。'} },
  { id:'mine', name:'智慧矿山', icon:'⛰️', category:'urllc',
    brief:'大型露天铁矿智能化改造，重型矿卡通过 5G 实现远程驾驶和自动循迹，每台矿卡回传多路高清视频，上行带宽需求大。',
    ind:{area:'15km² 露天矿坑', dev:'200台重型矿卡(多路视频回传)+300个环境/设备传感器', bw:'上行>250Mbps（多路视频回传），下行>150Mbps', dl:'<25ms（矿卡远程操控）', rel:'99.999%', sp:'广覆盖、大连接，矿区地形复杂（沟壑纵横）'},
    coverage:'覆盖 15km²', delayThreshold:25, bandwidthReq:480, ambrMin:60,
    correct:{deployMode:['独立专网'],band:['n28'],frame:['2.5ms双周期'],sst:['1(eMBB)'],qi:[3],upfLoc:['园区下沉']},
    reason:{deployMode:'矿山安全要求高，数据不能出矿区，应选独立专网。',band:'15km² 露天矿坑覆盖范围大，n28 覆盖最远。',frame:'矿卡多路视频回传是持续上行业务，应选 2.5ms 双周期。',sst:'SST 按主导流量类型选：矿卡多路视频回传是流量主体，属 eMBB；矿卡远程驾驶的低时延由 5QI=3 单独保障。',ambr:'单台矿卡峰值=多路视频（前方+后方+驾驶室）50Mbps+远程驾驶指令 2Mbps，×1.2 冗余 ≈62Mbps，UE-AMBR 选 100Mbps 及以上档位即可（依据材料八单路带宽表）。'} }
];

const BUSINESS_POOL = [
  { id:'agv',      name:'AGV/机器人控制指令',  direction:'上行', unitMbps:0.5, note:'控制信令，小数据量' },
  { id:'teleop',   name:'远程操控/自动驾驶指令', direction:'上行', unitMbps:2,   note:'控制指令+状态回传' },
  { id:'cam1080',  name:'高清视频监控(1080P)', direction:'上行', unitMbps:15,  note:'单路摄像头→服务器' },
  { id:'cam4k',    name:'超高清视频(4K)',      direction:'上行', unitMbps:40,  note:'单路高清摄像头' },
  { id:'drone',    name:'无人机巡检视频',      direction:'上行', unitMbps:20,  note:'单路空中视频回传' },
  { id:'sensor',   name:'传感器数据采集',      direction:'上行', unitMbps:0.1, note:'温湿度/振动等' },
  { id:'truckcam', name:'矿卡视频回传(多路)',  direction:'上行', unitMbps:50,  note:'前方+后方+驾驶室多路' },
  { id:'mobile',   name:'移动终端上网',        direction:'下行', unitMbps:10,  note:'员工手机/平板' },
  { id:'pax',      name:'旅客移动终端上网',    direction:'下行', unitMbps:5,   note:'机场/园区旅客' }
];

