export const initialStats=()=>({frames:0,mean_ms:0,max_ms:0,mean_correction_deg:0,max_correction_deg:0,max_bone_error_m:0,max_range_error_deg:0,max_contact_error_m:0,solver_limit_frames:0});
export function updateStats(stats,{elapsed,correction,bone,range,solution}){
  stats.frames++;
  for(const [key,value]of [['ms',elapsed],['correction_deg',correction.reduce((s,v)=>s+v,0)/correction.length]])stats['mean_'+key]+=(value-stats['mean_'+key])/stats.frames;
  stats.max_ms=Math.max(stats.max_ms,elapsed);stats.max_correction_deg=Math.max(stats.max_correction_deg,...correction);stats.max_bone_error_m=Math.max(stats.max_bone_error_m,bone);stats.max_range_error_deg=Math.max(stats.max_range_error_deg,range);stats.max_contact_error_m=Math.max(stats.max_contact_error_m,...solution.contacts.map(f=>f.slip_m));if(solution.iterations===8)stats.solver_limit_frames++;
}
