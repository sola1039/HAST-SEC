import {feasibleData} from './feasible_data.mjs';
import {loadDirectionModel} from './beat_direction_model.mjs';
import {beatRuntimeV9} from '../training/beat_runtime_v9.mjs';
import {beatFrame} from './beat_model.mjs';
import {controllerV9} from '../motion/v9/controller.mjs';
import {fixedClock} from '../motion/v9/clock.mjs';
import {feasibleView} from './feasible_view.mjs';
import {registerV9Face,FACE_GROUPS} from '../face/v9_profile.mjs';
import {beatLayers} from '../motion/beat_layers.mjs';
import {skillAssets} from './v13_assets.mjs';
import {generation} from './v14_generation.mjs';
import {panels,trainingPanel} from './v13_panels.mjs';
import {commandLoop} from './v13_command.mjs';
import {localSpeech} from './v13_speech.mjs';
import {headReference} from './head_reference.mjs';
import {lowLatency} from './v13_latency.mjs';
import {dialogueController} from './v15_dialogue.mjs';
const $=id=>document.getElementById(id);
let behavior,dialogue;
const speech=localSpeech(value=>{behavior.setSpeaking(value&&!dialogue?.brief());if(value)play();},message=>$('status').textContent=message);
let view,data,assets,layers,clock,commands,policy,latency,history=[],seconds=0,playing=false,last=0,raf,raw,basePose;
function report(){return {playing,seconds,base:behavior.state(),tracks:layers.state(),solver:view.report(),derivativeAudit:data.config.derivative_audit,avatar:view.audit(),raw,basePose,...commands.state()};}
function pause(){playing=false;last=0;cancelAnimationFrame(raf);raf=null;commands?.cancel();latency?.stop();speech.stop();void fetch('/v13-api/stop',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({session:commands?.session}),keepalive:true}).catch(()=>{});}
function step(dt){
 seconds+=dt;behavior.lock(layers.active());const row=behavior.sample(dt),frame=beatFrame(row.values,data.motion.meta);
 basePose=frame.rotations;raw=layers.sample(basePose,dt);frame.rotations=raw;frame.rootObserved=false;const leg=layers.state().tracks.find(t=>t.part==='leg'&&t.weight>.1);frame.swingFoot=leg?leg.side+'Foot':null;
 const result=view.render(frame,data.motion.meta,dt,false);dialogue?.step(dt);
 const canonical=result.rotations.map(q=>q.map((v,i)=>i===0||i===2?v*view.direction:v));history.push(canonical);if(history.length>20)history.shift();
 if(result.last.requires_pause)throw Error('姿态求解失败, 已暂停.');return result;
}
function advance(dt){clock.advance(dt);view.display(clock.display());panels(report());}
function loop(now){if(!playing)return;try{const dt=last?Math.min(.1,(now-last)/1000):0;last=now;advance(dt);raf=requestAnimationFrame(loop);}catch(e){pause();$('status').textContent=e.message;}}
function play(){if(playing)return;playing=true;latency?.keep();last=0;raf=requestAnimationFrame(loop);}
function reset(){pause();behavior.reset(data.motion);layers.reset();view.reset();dialogue?.reset();clock.reset();history=[];seconds=0;commands.reset();advance(0);$('status').textContent='已重置并暂停.';}
try{
 const selected=await generation();behavior=selected.behavior;
 assets=await skillAssets(selected.bootstrap);data=await feasibleData({motionFactory:()=>loadDirectionModel({bodyFactory:(m,w,c)=>beatRuntimeV9(m,w,c,{policy:behavior.policy}),prefix:'/baseline-v9-filtered-data/'}),configUrl:'/configs/v9_control.json'});
 if(JSON.stringify(assets.library.bones)!==JSON.stringify(data.motion.meta.bones))throw Error('骨架不一致.');
 data.config.arm_collision_enabled=true;data.config.cached_derivative=true;view=await feasibleView(data.history,data.config,data.regions,{controllerFactory:controllerV9,faceSetup:registerV9Face,faceGroups:FACE_GROUPS,measureHead:headReference});
 policy=await selected.policy(assets.library);layers=beatLayers(data.motion.meta.bones,assets.sources);clock=fixedClock(step,view.validate,20,data.motion.meta.bones);
 trainingPanel(policy);selected.decorate(policy);
 const ctx={assets,policy,history:()=>history,behavior,layers,pose:()=>raw??basePose};
 if(selected.generation==='v15')dialogue=dialogueController({view,...ctx});
 commands=commandLoop({...ctx,play,speech,dialogue,generation:selected.generation,prepare:()=>latency.prepare()});latency=lowLatency(commands.session);dialogue?.bind(commands.proactive,()=>playing);reset();$('play').disabled=false;$('reset').disabled=false;
 $('text').onfocus=()=>{void latency.prepare().catch(()=>{});};
 $('command').onsubmit=e=>{e.preventDefault();void commands.send();};for(const [id,fn]of Object.entries({play,pause,reset}))$(id).onclick=fn;
 for(const id of ['front','hands','side'])$(id).onclick=()=>view.view(id==='side'?'left':id);
 $('speech-start').onclick=()=>{behavior.setSpeaking(true);play();};$('speech-end').onclick=()=>behavior.setSpeaking(false);
 document.onvisibilitychange=()=>{if(document.hidden)pause();};window.onpagehide=pause;window.languageV13={send:commands.send,pause,reset,advance,state:report,dialogue:()=>dialogue?.state(),setSpeaking:behavior.setSpeaking,geometry:()=>view.kinematics()};
}catch(e){$('status').textContent=e.message;}
