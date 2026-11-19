export function channelHistory(model,start,count,signs=Array(count).fill(1)){
  let previous=null,velocity=Array(count).fill(0),history=[],missing=0,stamp=null,elapsed=0;
  return {reset(){previous=null;velocity.fill(0);history=[];missing=0;stamp=null;elapsed=0;},propose(values,confidence,dt){
    if(values.length!==count||values.some(v=>!Number.isFinite(v))||!Number.isFinite(confidence)||confidence<0||confidence>1)throw Error('历史通道输入或观测质量无效.');
    if(!previous)return values.slice();if(dt===0)return confidence===1?values.slice():previous.slice();
    missing=confidence===0?missing+dt:0;
    const predicted=previous.map((v,i)=>{const w=model?.weights[start+i],speed=w&&history.length>=4?w[0]*signs[i]+w.slice(1).reduce((s,c,k)=>s+c*history.at(-1-k)[i],0):velocity[i];return v+Math.max(-10,Math.min(10,speed))*dt*Math.exp(-missing/.4);});
    const gain=confidence===1?1:confidence===0?0:confidence**2;
    return predicted.map((v,i)=>v+gain*(values[i]-v));
  },commit(values,dt){
    if(previous&&dt>0)velocity=values.map((v,i)=>(v-previous[i])/dt);
    if(!stamp)stamp=values.slice();elapsed+=dt;
    if(elapsed>=.05-1e-8){history.push(values.map((v,i)=>(v-stamp[i])/elapsed));history=history.slice(-4);stamp=values.slice();elapsed=0;}
    if(dt>0||!previous)previous=values.slice();
  }};
}
