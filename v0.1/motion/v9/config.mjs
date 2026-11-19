export function checkV9(config){
  const ranges={strength:[0,8],region_strength:[0,8],physics_strength:[0,1],mass_kg:[1,250],friction:[0,2],maximum_root_step_mps:[0,5],hand_forward_m:[0,.1],shoulder_offset_m:[0,.06],solve_iterations:[1,12],restore_iterations:[1,20],support_tolerance_m:[.001,.05],contact_tolerance_m:[.001,.08],foot_tilt_degrees:[1,25],hips_tilt_degrees:[1,18],chest_tilt_degrees:[1,40],maximum_hold_seconds:[.05,2]};
  for(const [name,[lo,hi]]of Object.entries(ranges))if(!Number.isFinite(config[name])||config[name]<lo||config[name]>hi)throw Error('第九版配置超出范围: '+name+'.');
  if(config.solver_rate!==20||!Number.isInteger(config.solve_iterations)||!Number.isInteger(config.restore_iterations))throw Error('第九版时钟或迭代次数无效.');
  if(typeof config.reuse_jacobian!=='boolean')throw Error('第九版导数复用开关无效.');
  const lean=config.playback_torso_forward_degrees??0;if(!Number.isFinite(lean)||lean<0||lean>12)throw Error('第九版播放前倾角度无效.');
  for(const name of ['inertia_body','inertia_arms','inertia_details'])if(!Number.isFinite(config[name])||config[name]<0||config[name]>20)throw Error('第九版惯性权重无效: '+name+'.');
  if(!Number.isFinite(config.inertia_motion_step_rad)||config.inertia_motion_step_rad<.01||config.inertia_motion_step_rad>.5)throw Error('第九版运动自适应尺度无效.');
  if(config.output_smoothing)for(const [name,value]of Object.entries(config.output_smoothing))if(!Number.isFinite(value)||value<=0||value>30)throw Error('最终平滑参数无效: '+name+'.');
  const smooth=config.output_smoothing;if(smooth){
    for(const part of ['body','arms','hands','details','root'])if(smooth[part+'_max_hz']<smooth[part+'_hz']||smooth[part+'_max_hz']>=config.solver_rate/2)throw Error('最终平滑响应上限无效: '+part+'.');
    if(smooth.window_seconds<.15||smooth.window_seconds>2)throw Error('最终平滑幅度窗口无效.');
    for(const part of ['body','arm','detail'])if(smooth[part+'_motion_degrees']<=smooth.minimum_motion_degrees)throw Error('最终平滑活动阈值顺序无效.');
  }
  return config;
}
