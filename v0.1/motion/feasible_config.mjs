export function checkFeasibleConfig(config){
  const bounds={strength:[0,8],region_strength:[0,8],physics_strength:[0,1],mass_kg:[1,250],friction:[0,2],iterations:[1,8],maximum_root_step_mps:[0,5],hand_forward_m:[0,.1],shoulder_offset_m:[0,.1]};
  for(const [name,[lo,hi]]of Object.entries(bounds))if(config[name]!==undefined&&(!Number.isFinite(config[name])||config[name]<lo||config[name]>hi))throw Error('统一约束配置超出范围: '+name+'.');
  if(config.iterations!==undefined&&!Number.isInteger(config.iterations))throw Error('求解迭代次数必须为整数.');
  if(config.tasks&&Object.entries(config.tasks).some(([n,v])=>!['hand','contact','balance'].includes(n)||!Number.isFinite(v)||v<0||v>5))throw Error('联合目标的权重无效.');
  for(const [name,value]of Object.entries({history_lags:4,history_rate:20,maximum_history_gap_seconds:.4}))if(config[name]!==undefined&&config[name]!==value)throw Error('历史模型与运行时固定布局不一致: '+name+'.');
  return config;
}
