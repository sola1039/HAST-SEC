const tables=new Map();
function table(n){if(!tables.has(n))tables.set(n,Array.from({length:n},(_,k)=>Array.from({length:n},(_,i)=>Math.sqrt(2/n)*Math.cos(Math.PI*(i+.5)*k/n))));return tables.get(n);}
export function spectrum(rows,rate=20,threshold=7){
  const n=rows.length;if(n<8)return {power:0,high:0,entropy:0,amplitude:0,ratio:0};
  const means=[0,1,2].map(a=>rows.reduce((s,v)=>s+v[a],0)/n),center=(n-1)/2,den=rows.reduce((s,_,i)=>s+(i-center)**2,0),slope=[0,1,2].map(a=>rows.reduce((s,v,i)=>s+(v[a]-means[a])*(i-center),0)/den),d=rows.map((v,i)=>v.map((x,a)=>x-means[a]-slope[a]*(i-center))),cos=table(n),powers=[];
  for(let k=1;k<n;k++)powers.push([0,1,2].reduce((s,a)=>s+d.reduce((v,r,i)=>v+r[a]*cos[k][i],0)**2,0)/n);
  const power=powers.reduce((a,b)=>a+b,0),high=powers.reduce((s,v,i)=>s+((i+1)*rate/(2*n)>=threshold?v:0),0),entropy=power>1e-12?-powers.reduce((s,v)=>{const p=v/power;return s+(p>0?p*Math.log(p):0);},0)/Math.log(n-1):0;
  return {power,high,entropy,amplitude:Math.sqrt(power),ratio:high/(power||1)};
}
export function motionSpectrum(name){
  const threshold=/hips|spine|chest|Leg|Foot|Toes/.test(name)?4:/head|neck/.test(name)?6:7.5;let raw=[],filtered=[],last=null,ticks=0;
  return {reset(){raw=[];filtered=[];last=null;ticks=0;},push(a,b){raw.push(a.toArray());filtered.push(b.toArray());if(raw.length>64){raw.shift();filtered.shift();}if(++ticks%4===0)last={short:spectrum(raw.slice(-16),20,threshold),long:spectrum(raw,20,threshold),output:spectrum(filtered,20,threshold),threshold_hz:threshold};return last;},noise(){
    if(!last)return 0;const s=last.short,l=last.long,small=Math.max(0,1-s.amplitude/.08),random=Math.max(0,(s.entropy-.65)/.35),persistent=Math.min(1,l.ratio/.2);
    return Math.min(.9,small*random*s.ratio*persistent);
  },report:()=>last};
}
