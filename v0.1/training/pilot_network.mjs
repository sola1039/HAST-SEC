export function seeded(seed=71){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return (seed+.5)/4294967296;};}
export function makeNetwork(codes,hidden=48,conditions=3){
  if(!Number.isInteger(conditions)||conditions<1||conditions>3)throw new Error("状态数量无效.");
  const input=codes*2+conditions,size=hidden*(input+1)+codes*(hidden+1),rng=seeded(),weights=new Float32Array(size);
  for(let i=0;i<size;i++)weights[i]=(rng()-.5)*.15;return {codes,hidden,input,weights};
}
export function forward(net,history,condition){
  const {codes:k,hidden:h,input:n,weights:w}=net,x=Array(n).fill(0);x[history[0]]=1;x[k+history[1]]=1;x[2*k+condition]=1;
  const hidden=Array.from({length:h},(_,i)=>Math.tanh(w[i*(n+1)+n]+x.reduce((s,v,j)=>s+v*w[i*(n+1)+j],0))),offset=h*(n+1);
  const logits=Array.from({length:k},(_,i)=>w[offset+i*(h+1)+h]+hidden.reduce((s,v,j)=>s+v*w[offset+i*(h+1)+j],0)),max=Math.max(...logits),p=logits.map(v=>Math.exp(v-max)),sum=p.reduce((s,v)=>s+v,0);
  return {x,hidden,p:p.map(v=>v/sum)};
}
export function loss(net,rows){return rows.reduce((s,r)=>s-Math.log(Math.max(1e-9,forward(net,r.history,r.condition).p[r.target])),0)/rows.length;}
export function fitNetwork(net,train,validation,{epochs=200,onEpoch}={}){
  if(!train.length||!validation.length)throw new Error("训练与留出转移不足.");
  const {input:n,hidden:h,codes:k,weights:w}=net,size=w.length,offset=h*(n+1),m=new Float64Array(size),v=new Float64Array(size),rng=seeded(99);
  let best=w.slice(),bestLoss=loss(net,validation),step=0,stale=0,lastEpoch=0,bestEpoch=0;const initial=bestLoss;
  for(let epoch=1;epoch<=epochs;epoch++){
    const order=train.map((_,i)=>i);for(let i=order.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
    for(let batch=0;batch<order.length;batch+=16){
      const selected=order.slice(batch,batch+16),g=new Float64Array(size);
      for(const index of selected){const row=train[index],f=forward(net,row.history,row.condition),errors=f.p.map((p,i)=>(p-(i===row.target?1:0))*row.weight/selected.length),dh=Array(h).fill(0);
        for(let i=0;i<k;i++){const base=offset+i*(h+1);g[base+h]+=errors[i];for(let j=0;j<h;j++){g[base+j]+=errors[i]*f.hidden[j];dh[j]+=errors[i]*w[base+j];}}
        for(let i=0;i<h;i++){const e=dh[i]*(1-f.hidden[i]**2),base=i*(n+1);g[base+n]+=e;for(let j=0;j<n;j++)if(f.x[j])g[base+j]+=e*f.x[j];}
      }
      step++;for(let j=0;j<size;j++){const gradient=Math.max(-1,Math.min(1,g[j]+.0005*w[j]));m[j]=.9*m[j]+.1*gradient;v[j]=.999*v[j]+.001*gradient**2;w[j]-=.003*(m[j]/(1-.9**step))/(Math.sqrt(v[j]/(1-.999**step))+1e-8);}
    }
    const current=loss(net,validation);lastEpoch=epoch;onEpoch?.({epoch,training:loss(net,train),validation:current});
    if(current<bestLoss-.001){bestLoss=current;best=w.slice();bestEpoch=epoch;stale=0;}else stale++;
    if(stale>=30&&epoch>=40)break;
  }
  w.set(best);return {epochs:lastEpoch,best_epoch:bestEpoch,initial_validation_cross_entropy:initial,training_cross_entropy:loss(net,train),validation_cross_entropy:loss(net,validation)};
}
