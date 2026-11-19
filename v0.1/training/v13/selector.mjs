import {seeded} from '../pilot_network.mjs';
import {trajectoryForward,trajectoryGradient} from '../continuous_dense.mjs';
import {Quaternion} from 'three';
import {rotationLog} from '../../retarget/rotation_math.mjs';
export function selectorNet(input,output,hidden=48){const random=seeded(131),weights=new Float32Array(hidden*(input+1)+output*(hidden+1));for(let i=0;i<weights.length;i++)weights[i]=(random()-.5)*.08;return {input,output,hidden,weights};}
export function poseFeatures(qs,previous,joints){return joints.flatMap(j=>{const q=new Quaternion(...qs[j]),p=new Quaternion(...previous[j]),v=rotationLog(q),d=rotationLog(p.invert().multiply(q));return [...v.toArray().map(x=>x/Math.PI),...d.toArray().map(x=>x/Math.PI)];});}
export function selectorForward(net,input){const f=trajectoryForward(net,input),max=Math.max(...f.values),p=Array.from(f.values,x=>Math.exp(x-max)),sum=p.reduce((a,b)=>a+b,0);return {...f,p:p.map(v=>v/sum)};}
export function selectorLoss(net,rows){return rows.reduce((s,r)=>s-Math.log(Math.max(1e-12,selectorForward(net,r.x).p[r.target])),0)/rows.length;}
export function fitSelector(net,train,validation,{epochs=100,onEpoch}={}){
 if(!train.length||!validation.length)throw Error('动作码训练与验证数据不足.');const random=seeded(137),size=net.weights.length,m=new Float64Array(size),v=new Float64Array(size);let best=net.weights.slice(),bestLoss=selectorLoss(net,validation),bestEpoch=0,stale=0,step=0,actual=0;
 const initial=bestLoss;
 for(let epoch=1;epoch<=epochs;epoch++){
  const order=train.map((_,i)=>i);for(let i=order.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
  for(let start=0;start<order.length;start+=32){const batch=order.slice(start,start+32),g=new Float64Array(size);
   for(const i of batch){const row=train[i],f=selectorForward(net,row.x),e=f.p.map((p,k)=>(p-(k===row.target?1:0))/batch.length);trajectoryGradient(net,row.x,f,e,g);}
   step++;for(let j=0;j<size;j++){const a=Math.max(-1,Math.min(1,g[j]+.0001*net.weights[j]));m[j]=.9*m[j]+.1*a;v[j]=.999*v[j]+.001*a*a;net.weights[j]-=.003*(m[j]/(1-.9**step))/(Math.sqrt(v[j]/(1-.999**step))+1e-8);}
  }
  const loss=selectorLoss(net,validation);actual=epoch;onEpoch?.({epoch,training:selectorLoss(net,train),validation:loss});
  if(loss<bestLoss-.0005){bestLoss=loss;best=net.weights.slice();bestEpoch=epoch;stale=0;}else stale++;
  if(stale>=18&&epoch>=25)break;
 }
 net.weights.set(best);return {epochs:actual,best_epoch:bestEpoch,initial_validation_loss:initial,train_loss:selectorLoss(net,train),validation_loss:bestLoss,parameters:size};
}
