const half=u=>{const s=u>>15?-1:1,e=(u>>10)&31,f=u&1023;return e===0?s*f*2**-24:e===31?(f?NaN:s*Infinity):s*(1+f/1024)*2**(e-15);};
function f16(buf){const u=new Uint16Array(buf),out=new Float32Array(u.length);for(let i=0;i<u.length;i++)out[i]=half(u[i]);return out;}
const elu=x=>x>0?x:Math.expm1(x);

export async function loadTracker(base='/model/tracker/'){
 const get=async n=>{const r=await fetch(base+n);if(!r.ok)throw Error('跟踪数据读取失败: '+n);return n.endsWith('.json')?r.json():r.arrayBuffer();};
 const [net,lib,w,root,body,end,cand,feat]=await Promise.all(['net.json','lib.json','net.bin','ref_root.bin','ref_body.bin','clip_end.bin','cand.bin','cand_feat.bin'].map(get));
 const pack={net,lib,w:new Float32Array(w),root:new Float32Array(root),body:f16(body),end:new Int32Array(end),cand:new Int32Array(cand),feat:f16(feat)};
 pack.candOf=new Int32Array(lib.frames).fill(-1);pack.cand.forEach((r,i)=>{pack.candOf[r]=i;});
 return pack;
}

function forward(spec,W,x){let h=x;spec.forEach((L,li)=>{const o=new Float32Array(L.out);for(let j=0;j<L.out;j++){let a=W[L.b+j];const r=L.w+j*L.in;for(let k=0;k<L.in;k++)a+=W[r+k]*h[k];o[j]=li<spec.length-1?elu(a):a;}h=o;});return h;}

export class Tracker{
 constructor(mj,model,data,pack,tgt0){
  this.mj=mj;this.model=model;this.data=data;this.p=pack;this.tgt0=tgt0;this.pel=model.body('pelvis').id;this.nb=model.nbody;
  this.feet=[model.body('foot_l').id,model.body('foot_r').id];
  const L=pack.lib;this.bw=L.body_width;this.fd=L.feat_dim;this.searchSteps=Math.round(L.search_s/.02);this.reset();
 }
 reset(){this.r=-1;this.ya=0;this.sh=[0,0,0];this.step=0;this.switches=0;this.dist=0;}
 heading(){const q=this.data.qpos;return Math.atan2(2*(q[4]*q[6]+q[3]*q[5]),1-2*(q[4]*q[4]+q[5]*q[5]));}
 rotY(a,x,y,z){const c=Math.cos(a),s=Math.sin(a);return [c*x+s*z,y,-s*x+c*z];}
 features(h,finger,will){
  const q=this.data.qpos,v=this.data.qvel,L=this.p.lib,c=Math.cos(h),s=Math.sin(h),Rh=x=>[c*x[0]-s*x[2],x[1],s*x[0]+c*x[2]];
  let pull=[0,0,0,0,0,0],lead=[0,0];
  if(finger&&Math.hypot(...finger.force)>=L.f_min){const pt=Rh([finger.point[0]-q[0],finger.point[1]-q[1],finger.point[2]-q[2]]),f=Rh(finger.force).map(x=>x/100),lv=Rh(finger.lead);pull=[...pt,...f];lead=[lv[0],lv[2]];}
  const vel=Rh([v[0],v[1],v[2]]),d=this.data,fl=3*this.feet[0],fr=3*this.feet[1];
  const co=Rh([d.subtree_com[3]-(d.xpos[fl]+d.xpos[fr])/2,0,d.subtree_com[5]-(d.xpos[fl+2]+d.xpos[fr+2])/2]);
  return [...pull,...lead,will,vel[0],vel[2],v[4],...L.legs.map(i=>q[i]),...L.legv.map(i=>v[i]),...L.upper.map(i=>q[i]),co[0],co[2]];
 }
 search(h,finger,will){
  const L=this.p.lib,f=this.features(h,finger,will).map((x,i)=>(x-L.mean[i])/L.sd[i]*L.w[i]),F=this.p.feat,d=this.fd,n=this.p.cand.length;
  const distOf=ci=>{let s=0;const o=ci*d;for(let k=0;k<d;k++){const e=F[o+k]-f[k];s+=e*e;}return s;};
  let best=-1,bd=Infinity;for(let i=0;i<n;i++){let s=0;const o=i*d;for(let k=0;k<d&&s<bd;k++){const e=F[o+k]-f[k];s+=e*e;}if(s<bd){bd=s;best=i;}}
  let cur=-1;if(this.r>=0&&this.r<this.p.end[this.r]-1)cur=this.p.candOf[this.r]>=0?this.p.candOf[this.r]:this.p.candOf[this.r-1];
  if(cur>=0&&bd>L.switch*distOf(cur))return this.r;
  this.dist=Math.sqrt(bd);return this.p.cand[best];
 }
 control(finger,will){
  const q=this.data.qpos,v=this.data.qvel,p=this.p,h=this.heading();
  if(this.r<0||this.step%this.searchSteps===0||this.r>=p.end[this.r]-1){
   const r=this.search(h,finger,will);
   if(r!==this.r){this.r=r;this.ya=h-p.root[4*r+3];const rp=this.rotY(this.ya,p.root[4*r],p.root[4*r+1],p.root[4*r+2]);this.sh=[q[0]-rp[0],0,q[2]-rp[2]];this.switches++;}
  }
  this.step++;
  const c=Math.cos(h),s=Math.sin(h),Rh=(x,y,z)=>[c*x-s*z,y,s*x+c*z],net=p.net,x=this.data.xmat,frc=this.data.xfrc_applied;
  const vr=Rh(v[0],v[1],v[2]),obs=[q[1],-x[12],-x[13],-x[14],...vr,v[3],v[4],v[5]];
  for(let i=7;i<this.model.nq;i++)obs.push(q[i]);for(let i=6;i<this.model.nv;i++)obs.push(v[i]);
  for(let b=0;b<this.nb;b++){const f=Rh(frc[6*b],frc[6*b+1],frc[6*b+2]);obs.push(f[0]/100,f[1]/100,f[2]/100);}
  if(net.will_obs)obs.push(will);
  const fut=[],end=p.end[this.r],bw=this.bw;
  for(const k of net.future){const j=Math.min(this.r+k,end),rp=this.rotY(this.ya,p.root[4*j],p.root[4*j+1],p.root[4*j+2]),rel=Rh(rp[0]+this.sh[0]-q[0],rp[1]-q[1],rp[2]+this.sh[2]-q[2]),dh=p.root[4*j+3]+this.ya-h;
   fut.push(...rel,Math.sin(dh),Math.cos(dh));for(let a=0;a<44;a++)fut.push(p.body[j*bw+a]);}
  const N=net.norm,on=obs.map((o,i)=>(o-N.obs[0][i])/N.obs[1][i]),fn=fut.map((o,i)=>(o-N.future[0][i])/N.future[1][i]);
  const z=forward(net.layers.enc,p.w,Float32Array.from([...on,...fn]));
  const ph=[p.body[this.r*bw+50],p.body[this.r*bw+51],p.body[this.r*bw+52]];
  const a=forward(net.layers.dec,p.w,Float32Array.from([...on,...ph,...z]));
  for(let i=0;i<a.length;i++)this.data.ctrl[i]=this.tgt0[i]+a[i]*N.target[1][i]+N.target[0][i];
  this.refRow=this.r;this.r=Math.min(this.r+1,end);
 }
 helper(){
  if(this.refRow===undefined)return;
  const p=this.p,r=this.refRow,bw=this.bw,L=p.lib,[kr,dr,tmax,kp,dp,fmax,lift,press]=L.help[Math.round(p.body[r*bw+53])];
  const d=this.data,x=d.xmat,o=9*this.pel,up=[x[o+1],x[o+4],x[o+7]],w=[d.cvel[6*this.pel],d.cvel[6*this.pel+1],d.cvel[6*this.pel+2]];
  const ur=this.rotY(this.ya,p.body[r*bw+44],p.body[r*bw+45],p.body[r*bw+46]);
  const cr=[up[1]*ur[2]-up[2]*ur[1],up[2]*ur[0]-up[0]*ur[2],up[0]*ur[1]-up[1]*ur[0]];
  let tau=cr.map((cv,i)=>kr*cv-dr*w[i]);const tn=Math.hypot(...tau);if(tn>tmax)tau=tau.map(t=>t*tmax/tn);
  const rp=this.rotY(this.ya,p.root[4*r],p.root[4*r+1],p.root[4*r+2]),rv=this.rotY(this.ya,p.body[r*bw+47],p.body[r*bw+48],p.body[r*bw+49]);
  let f=[0,1,2].map(i=>kp*(rp[i]+this.sh[i]-d.qpos[i])+dp*(rv[i]-d.qvel[i]));f[1]*=lift;const fnn=Math.hypot(...f);if(fnn>fmax)f=f.map(v=>v*fmax/fnn);f[1]-=press*L.weight;
  const b=6*this.pel;for(let i=0;i<3;i++){d.xfrc_applied[b+i]+=f[i];d.xfrc_applied[b+3+i]+=tau[i];}
 }
}
