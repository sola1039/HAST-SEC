import {FACE_CHANNELS} from './mapping.mjs';
import {FINE_TARGETS} from './details.mjs';
export const FACE_ORDER=Object.freeze([...FACE_CHANNELS,...Object.keys(FINE_TARGETS)]);
// 欧氏最邻近投影到单纯形, 使用排序阈值. 口型竞争独立于眨眼和情绪.
export function simplex(values,limit=1){
  if(!Number.isFinite(limit)||limit<0||values.some(v=>!Number.isFinite(v)))throw Error('面部投影范围或数值无效.');
  const input=values.map(v=>Math.max(0,v)),sum=input.reduce((a,b)=>a+b,0);if(sum<=limit)return input;
  const order=[...input].sort((a,b)=>b-a);let running=0,theta=0;
  for(let i=0;i<order.length;i++){running+=order[i];const t=(running-limit)/(i+1);if(order[i]>t)theta=t;}
  return input.map(v=>Math.max(0,v-theta));
}
export function feasibleFace(available,metric=null,order=FACE_ORDER,groups=[]){
  const supported=new Set(available);let prior=null,last=null;
  return {reset(){prior=null;last=null;},project(values={},dt=0,confidence=1){
    if(!Number.isFinite(dt)||dt<0||dt>.12||!Number.isFinite(confidence)||confidence<0||confidence>1)throw Error('面部时间步或质量无效.');
    const raw=order.map(n=>values[n]??0);if(raw.some(v=>!Number.isFinite(v)))throw Error('面部权重必须为有限数.');
    let target=raw.slice();
    function feasible(weights){
    const source=weights.map((v,i)=>supported.has(order[i])?v:0),target=source.map(v=>Math.max(0,Math.min(1,v)));
    const mouth=simplex(source.slice(0,5));target.splice(0,5,...mouth);
    for(const side of ['Left','Right']){
      const a=order.indexOf('browUp'+side),b=order.indexOf('browDown'+side),pair=simplex([source[a],source[b]]);target[a]=pair[0];target[b]=pair[1];
    }
    for(const names of groups){const indices=names.map(n=>order.indexOf(n));if(indices.some(i=>i<0))throw Error('面部互斥通道不存在.');const values=simplex(indices.map(i=>target[i]));indices.forEach((i,k)=>target[i]=values[k]);}
    return target;}
    target=feasible(target);let iterations=0;
    if(metric){
      const G=metric.gram;if(G.length!==order.length||G.some(r=>r.length!==order.length||r.some(v=>!Number.isFinite(v))))throw Error('角色面部投影矩阵形状无效.');
      const L=Math.max(...G.map(r=>r.reduce((s,v)=>s+Math.abs(v),0)),1e-8);
      for(let k=0;k<60;k++){const next=feasible(target.map((v,i)=>v-G[i].reduce((s,g,j)=>s+g*(target[j]-raw[j]),0)/L)),change=Math.max(...next.map((v,i)=>Math.abs(v-target[i])));target=next;iterations++;if(change<1e-7)break;}
    }
    let result=target;
    if(prior&&dt>0){
      const gain=confidence>.95?1:1-Math.exp(-dt/(.025+.15*(1-confidence)));
      const fractions=target.map((v,i)=>Math.min(gain,(order[i].startsWith('blink')?30:12)*dt/Math.max(1e-12,Math.abs(v-prior[i]))));
      for(let pass=0;pass<=groups.length;pass++)for(const group of [[0,1,2,3,4],...['Left','Right'].map(s=>['browUp'+s,'browDown'+s].map(n=>order.indexOf(n))),...groups.map(g=>g.map(n=>order.indexOf(n)))]){const f=Math.min(...group.map(i=>fractions[i]));group.forEach(i=>fractions[i]=f);}
      result=target.map((v,i)=>prior[i]+fractions[i]*(v-prior[i]));
    }
    if(!prior||dt>0)prior=result.slice();
    last={supported:order.filter(n=>supported.has(n)),unmapped:order.filter((n,i)=>!supported.has(n)&&Math.abs(raw[i])>1e-8),squared_error:raw.reduce((s,v,i)=>s+(v-result[i])**2,0),iterations,metric:metric?.kind??'权重欧氏距离',source_flame_calibrated:false};
    return Object.fromEntries(order.map((n,i)=>[n,result[i]]));
  },report:()=>last};
}
