import {EXPRESSION_POSES} from './v9_expressions.mjs';
const clamp=x=>Math.max(0,Math.min(1,x));
// 情绪用临界阻尼精确步进, 眨眼使用独立的连续短时包络.
export function faceMotion(order){
 let time=0,nextBlink=3.2,blinkStart=-10,seed=47,states={};
 const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
 function reset(){time=0;nextBlink=3.2;blinkStart=-10;seed=47;states={};}
 return {reset,generate(source,manual,dt,options){
  if(!Number.isFinite(dt)||dt<0||dt>.12||Object.values({...source,...manual}).some(x=>!Number.isFinite(x)))throw Error('面部目标或时间步无效.');
  if(!options)return {...source,...manual};
  const pose=options.enabled?EXPRESSION_POSES[options.expression??'friendly']:{};
  if(!pose||!Number.isFinite(options.strength)||options.strength<0||options.strength>1||!Number.isFinite(options.lip_gain)||options.lip_gain<0||options.lip_gain>3||typeof options.blinking!=='boolean')throw Error('面部播放参数无效.');
  const targets=Object.fromEntries(order.map(n=>[n,source[n]??0]));
  for(const [n,v]of Object.entries(pose))targets[n]=Math.max(targets[n]??0,v*options.strength);
  if(dt>0){time+=dt;if(time>=nextBlink){blinkStart=time;nextBlink=time+2.5+3*random();}}
  if(options.enabled)targets.mouthSmile=clamp((targets.mouthSmile??0)+.035*(1+Math.sin(time*.7))/2);
  for(const [n,v]of Object.entries(manual))targets[n]=v;
  for(const [n,key]of [['happy','happy'],['angry','angry'],['sad','sad'],['relaxed','friendly']]){
   const amount=clamp(targets[n]??0);targets[n]=0;for(const [channel,v]of Object.entries(EXPRESSION_POSES[key]))targets[channel]=Math.max(targets[channel]??0,amount*v);
  }
  const result={};
  for(const n of order){
   const target=clamp(targets[n]??0),fast=/^(aa|ih|ou|ee|oh|blinkLeft|blinkRight)$/.test(n);let s=states[n]??{x:0,v:0};
   if(fast){s={x:target,v:0};}else if(dt>0){const w=8,y=s.x-target,j=(s.v+w*y)*dt,e=Math.exp(-w*dt);s={x:target+(y+j)*e,v:(s.v-w*j)*e};}else if(Object.keys(manual).length)s={x:target,v:0};
   s.x=clamp(s.x);states[n]=s;result[n]=s.x;
  }
  const phase=(time-blinkStart)/.24,blink=options.enabled&&options.blinking&&phase>0&&phase<1?(1-Math.cos(2*Math.PI*phase))/2:0;
  for(const side of ['Left','Right'])result['blink'+side]=Math.max(result['blink'+side],blink)*clamp(1-.9*result.eyeSmile-.5*result.eyeWorry);
  const lips=['aa','ih','ou','ee','oh'],reserved=lips.reduce((s,n)=>s+(n in manual?result[n]:0),0),total=lips.reduce((s,n)=>s+(n in manual?0:result[n]),0),budget=clamp(1-.35*result.mouthSmile-.3*result.mouthAngry-.25*result.mouthPanic),gain=Math.min(options.enabled?options.lip_gain:1,Math.max(0,budget-reserved)/Math.max(1e-9,total));
  for(const n of lips)if(!(n in manual))result[n]*=gain;
  for(const side of ['Left','Right'])result['eyeWide'+side]*=clamp(1-result['blink'+side]);
  return result;
 },report:()=>({seconds:time,next_blink:nextBlink,channels:order.length,kind:'独立表情目标、临界阻尼和眨眼包络'})};
}
