import {seeded} from "./pilot_network.mjs";
export function makeTrajectoryNet(latent,hidden=96){const input=latent*4+3,output=latent*10,weights=new Float32Array(hidden*(input+1)+output*(hidden+1)),random=seeded(813);for(let i=0;i<weights.length;i++)weights[i]=(random()-.5)*.12;return {latent,hidden,input,output,weights};}
export function trajectoryForward(net,x){
  const {hidden:h,input:n,output:o,weights:w}=net,activation=new Float64Array(h),values=new Float64Array(o),offset=h*(n+1);
  for(let i=0;i<h;i++){const base=i*(n+1);let z=w[base+n];for(let j=0;j<n;j++)z+=w[base+j]*x[j];activation[i]=Math.tanh(z);}
  for(let i=0;i<o;i++){const base=offset+i*(h+1);let z=w[base+h];for(let j=0;j<h;j++)z+=w[base+j]*activation[j];values[i]=z;}return {activation,values};
}
export function trajectoryGradient(net,x,result,error,gradient){
  const {hidden:h,input:n,output:o,weights:w}=net,offset=h*(n+1),dh=new Float64Array(h);
  for(let i=0;i<o;i++){const base=offset+i*(h+1);gradient[base+h]+=error[i];for(let j=0;j<h;j++){gradient[base+j]+=error[i]*result.activation[j];dh[j]+=error[i]*w[base+j];}}
  for(let i=0;i<h;i++){const e=dh[i]*(1-result.activation[i]**2),base=i*(n+1);gradient[base+n]+=e;for(let j=0;j<n;j++)gradient[base+j]+=e*x[j];}
}
export function normal(random){return Math.sqrt(-2*Math.log(Math.max(1e-9,random())))*Math.cos(2*Math.PI*random());}
export function trajectoryInput(context,condition){const activity=Array.isArray(condition)?condition:[0,1,2].map(c=>c===condition?1:0);return new Float64Array([...context,...activity]);}
export function trajectoryContext(history){const current=history.at(-1),d=current.length,result=[...current.map(v=>v*.5)];for(const lag of [1,4,10])for(let j=0;j<d;j++)result.push((current[j]-history[Math.max(0,history.length-1-lag)][j])*.5);return result;}
export function sampleResidual(space,random,previous){return space.basis.map((_,k)=>.35*(previous?.[k]??0)+Math.sqrt(1-.35**2)*normal(random));}