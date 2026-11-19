export const overlaps=(a,b,c,d)=>a<d&&b>c;
export function sourceQuality(rows,sources){
 if(!Array.isArray(rows)||rows.length>5000)throw Error('来源过滤记录数量无效.');
 const ranges=rows.map(r=>{
  const s=sources.find(s=>s.id===r.source);
  if(!s||!Number.isFinite(r.start)||!Number.isFinite(r.end)||r.start<0||r.end<=r.start||r.end>s.seconds+.05||!['保留','剔除','待定'].includes(r.decision))throw Error('来源过滤区间无效.');
  if(!/^[a-f0-9]{64}$/.test(r.sha256)||r.sha256!==s.sha256)throw Error('过滤所用源数据已变化, 请重新审核: '+r.source);
  return {...r};
 });
 const excluded=ranges.filter(r=>r.decision!=='保留');
 return {ranges,excluded,blocked:(source,start,end)=>excluded.some(r=>r.source===source&&overlaps(start,end,r.start,r.end))};
}
export function excludedPrototypes(prototypes,sources,quality,rate=20,frames=80){
 if(!Array.isArray(prototypes)||!Number.isFinite(rate)||rate<=0||!Number.isInteger(frames)||frames<=0)throw Error('原型过滤参数无效.');
 return prototypes.flatMap((p,i)=>{
  const s=sources.find(s=>s.index===p.segment);
  if(!s||!Number.isInteger(p.begin)||p.begin<0||p.begin+frames>s.frames)throw Error('原型来源或帧区间无效.');
  return quality.blocked(s.id,p.begin/rate,(p.begin+frames)/rate)?[i]:[];
 });
}
