import {Quaternion,Vector3} from 'three';
import {rotationExp,rotationStep,solveLinear} from '../motion/feasible_math.mjs';
export function historyRows(window,bones,rate=20){
  const dim=window.frames[0].length,result=[];let previous=null;
  for(const row of window.frames){
    const q=bones.map((_,i)=>rotationExp(new Vector3(...row.subarray(i*3,i*3+3))));
    if(previous){const v=new Float64Array(dim);q.forEach((p,i)=>v.set(rotationStep(previous.q[i],p).multiplyScalar(rate).toArray(),i*3));for(let j=bones.length*3;j<dim;j++)v[j]=(row[j]-previous.row[j])*rate;result.push(v);}
    previous={q,row};
  }
  return result;
}
export function fitHistoryAR(train,validation,bones,{lags=4,rate=20}={}){
  if(lags!==4||!train.length||!validation.length)throw Error('历史预测训练范围无效.');
  const dim=train[0].frames[0].length,size=lags+1,normal=Array.from({length:dim},()=>Array.from({length:size},()=>Array(size).fill(0))),rhs=Array.from({length:dim},()=>Array(size).fill(0));let count=0;
  for(const w of train){const rows=historyRows(w,bones,rate);for(let t=lags;t<rows.length;t++){count++;for(let j=0;j<dim;j++){const x=[1,...Array.from({length:lags},(_,k)=>rows[t-1-k][j])],y=rows[t][j];for(let a=0;a<size;a++){rhs[j][a]+=x[a]*y;for(let b=0;b<size;b++)normal[j][a][b]+=x[a]*x[b];}}}}
  const weights=normal.map((m,j)=>solveLinear(m.map(r=>r.map(v=>v/count)),rhs[j].map(v=>v/count),.002)??[0,1,0,0,0]);
  function evaluate(windows){let n=0,loss=0,persistence=0;const error=Array(dim).fill(0);
    for(const w of windows){const rows=historyRows(w,bones,rate);for(let t=lags;t<rows.length;t++){n++;for(let j=0;j<dim;j++){const x=[1,...Array.from({length:lags},(_,k)=>rows[t-1-k][j])],pred=weights[j].reduce((s,v,k)=>s+v*x[k],0),e=(pred-rows[t][j])**2;loss+=e;error[j]+=e;persistence+=(rows[t-1][j]-rows[t][j])**2;}}}
    const mean=(a,b)=>error.slice(a,b).reduce((s,v)=>s+v,0)/(n*Math.max(1,b-a));return {samples:n,velocity_mse:loss/(n*dim),persistence_mse:persistence/(n*dim),bone_velocity_mse:mean(0,bones.length*3),face_proxy_mse:mean(bones.length*3,Math.min(dim,bones.length*3+19)),root_velocity_mse:dim>bones.length*3+19?mean(bones.length*3+19,dim):null,variance:error.map(v=>v/n)};
  }
  return {version:1,kind:'四阶逐通道角速度自回归, 约束系统补充关节联动',lags,rate,dim,bones,weights,parameters:dim*size,training:evaluate(train),validation:evaluate(validation)};
}
export function predictHistory(model,name,history,direction=1){
  const index=model?.bones.indexOf(name);if(index===undefined||index<0||history.length<model.lags)return history.at(-1)?.clone()??new Vector3();
  return new Vector3(...[0,1,2].map(a=>{const w=model.weights[index*3+a];return w[0]*(a===1?1:direction)+w.slice(1).reduce((s,c,k)=>s+c*history[history.length-1-k].getComponent(a),0);}));
}
