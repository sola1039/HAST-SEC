// ReflexBody Lite showcase: the physics body in a close-up arena, pulled by any part (finger or mouse). The controller runs every
// 20 ms in the physics (MuJoCo WebAssembly, 5 ms steps). This release pulls only.
import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import loadMujoco from '@mujoco/mujoco';
import {createSim} from './runtime/sim.mjs';
import {arenaXml,createArena} from './runtime/arena.mjs';
import {createBodyView} from './runtime/render.mjs';
import {loadTracker,Tracker} from './runtime/tracker.mjs';
import {mb,manifest,fetchBytes,withCountedFetch} from './loading.mjs';
import {applyLook,createTether} from './look.mjs';

const $=id=>document.getElementById(id);
const handset=matchMedia('(max-width: 600px)').matches;
const DT=.005,CONTROL_S=.02,WILL=.45,MAX_STEPS=12,FOLLOW=1.5,FALL_Y=.35;
const SPRING={stiff:250,damp:20,max:200};
const LOCKED='戳、掐、摸需要反射层, 本版未开源';

async function resource(url,format){const r=await fetch(url);if(!r.ok)throw Error(`${url}: ${r.status}`);return r[format]();}

// the arena: warm paper, soft daylight with shadows, an orbit camera that follows the body
function createArenaScene(stage){
 const scene=new T.Scene();scene.background=new T.Color(0xf3ece3);scene.fog=new T.Fog(0xf3ece3,7,16);
 const camera=new T.PerspectiveCamera(handset?42:36,1,.02,40);camera.position.set(.8,1.12,2.55);
 const renderer=new T.WebGLRenderer({antialias:!handset,powerPreference:'low-power'});
 renderer.shadowMap.enabled=true;renderer.outputColorSpace=T.SRGBColorSpace;stage.append(renderer.domElement);
 scene.add(new T.HemisphereLight(0xfff8f0,0xc4b6a6,1.5));
 const sun=new T.DirectionalLight(0xfff0e0,1.5);sun.position.set(2.2,4.2,3);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);
 Object.assign(sun.shadow.camera,{left:-2.5,right:2.5,top:2.5,bottom:-2.5,near:.5,far:12});scene.add(sun,sun.target);
 const controls=new OrbitControls(camera,renderer.domElement);
 Object.assign(controls,{enableDamping:true,dampingFactor:.12,minDistance:1.2,maxDistance:6,maxPolarAngle:Math.PI*.49,enablePan:false});
 controls.target.set(0,.7,0);controls.update();
 function resize(){
  if(!stage.clientWidth||!stage.clientHeight)return;
  camera.aspect=stage.clientWidth/stage.clientHeight;camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(devicePixelRatio,handset?1.5:2));renderer.setSize(stage.clientWidth,stage.clientHeight,false);
 }
 new ResizeObserver(resize).observe(stage);resize();
 const shift=new T.Vector3();
 return {scene,camera,renderer,controls,
  follow(x,z,dt){
   const blend=dt?1-Math.exp(-FOLLOW*dt):1;shift.set((x-controls.target.x)*blend,0,(z-controls.target.z)*blend);
   controls.target.add(shift);camera.position.add(shift);sun.position.add(shift);sun.target.position.add(shift);controls.update();
  }};
}

// the pull: a spring from the grabbed point toward the finger, on a plane facing the camera
function createPull({canvas,camera,pick,sim,enabled,ui}){
 const ray=new T.Raycaster(),ndc=new T.Vector2(),plane=new T.Plane(),hit=new T.Vector3(),view=new T.Vector3();
 let g=null;
 const aim=e=>{const b=canvas.getBoundingClientRect();ndc.set(2*(e.clientX-b.left)/b.width-1,1-2*(e.clientY-b.top)/b.height);ray.setFromCamera(ndc,camera);};
 canvas.addEventListener('pointerdown',e=>{
  if(!enabled()||g||!e.isPrimary||(e.pointerType==='mouse'&&e.button!==0))return;
  aim(e);const h=pick(ray);if(!h)return;
  e.stopImmediatePropagation();
  const p=h.point.toArray();plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(view),h.point);
  g={id:e.pointerId,body:h.body,local:sim.toLocal(h.body,p),target:p,prevTarget:p,prevPoint:p,lead:[0,0,0]};
  canvas.setPointerCapture(e.pointerId);ui.press(e);
 },{capture:true});
 canvas.addEventListener('pointermove',e=>{if(!g||e.pointerId!==g.id)return;aim(e);if(ray.ray.intersectPlane(plane,hit))g.target=hit.toArray();ui.move(e);});
 const up=e=>{if(!g||(e&&e.pointerId!==g.id))return;const id=g.id;g=null;if(canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);ui.release();};
 for(const ev of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(ev,up);
 window.addEventListener('blur',()=>up());
 return {grab:()=>g,cancel:()=>up()};
}

// the bottom status line: what is loading now; a failure says where and why and reloads on a tap
let phase='准备页面';
// the opening screen: what is loading and how far (share of all the bytes); it fades once she can be pulled
function say(text,share){$('splashText').textContent=text;if(share!==undefined)$('splash').style.setProperty('--p',`${Math.round(100*Math.min(1,share))}%`);}
function fail(error){
 console.error(error);const msg=`加载失败(${phase}): ${error?.message??error}`,splash=$('splash');
 if(!splash.classList.contains('is-gone')){splash.classList.add('is-failed');say(msg);$('retry').onclick=()=>location.reload();return;}
 const s=$('status');s.textContent=msg+'. 点这里重试';s.disabled=false;s.hidden=false;s.onclick=()=>location.reload();
}
addEventListener('error',e=>fail(e.error??e.message));
addEventListener('unhandledrejection',e=>fail(e.reason));

async function start(){
 const stage=$('stage'),app=$('app'),reset=$('reset'),status=$('status'),ripple=$('ripple'),hint=$('hint'),latency=$('latency'),memory=$('memory');
 const sizes=await manifest(),total=k=>sizes?.[k]??0;
 phase='下载物理引擎';let got=0;const engine=total('vendor/mujoco/mujoco.wasm');
 const lib=Object.entries(sizes??{}).filter(([k])=>k.startsWith('model/tracker/')).reduce((a,[,v])=>a+v,0),all=engine+lib;
 const show=(what,n)=>say(`${what} ${mb(n)}${all?` / ${mb(all)}`:''} MB`,all?n/all:undefined);
 show('正在下载物理引擎',0);
 const wasmBinary=await fetchBytes('./vendor/mujoco/mujoco.wasm',n=>{got+=n;show('正在下载物理引擎',got);});
 phase='初始化物理';say('正在初始化物理');
 const [mj,xml,idle,meta]=await Promise.all([loadMujoco({wasmBinary}),resource('./model/body_torque.xml','text'),resource('./model/idle_stand.json','json'),resource('./model/body.meta.json','json')]);
 const sim=createSim(mj,arenaXml(xml),DT),{model,data}=sim,floor=model.geom('floor').id;
 model.geom_priority[floor]=1;model.geom_friction[floor*3]=.5;
 const {scene,camera,renderer,controls,follow}=createArenaScene(stage);
 const view=createBodyView(scene,sim,meta),arena=createArena(scene),look=applyLook({scene,renderer,view,sim});
 view.meshes.filter(m=>m.userData.body===0).forEach(m=>{m.visible=false;});
 const bodyMeshes=view.meshes.filter(m=>m.userData.body!==0);
 const pickBody=ray=>{const h=ray.intersectObjects(bodyMeshes,false)[0];return h&&{body:h.object.userData.body,point:h.point};};
 let tracker=null,nextControl=0,spring=null,hintTimer=0,falls=0;
 const tether=createTether({tether:$('tether'),label:$('force'),camera,canvas:renderer.domElement});
 function showHint(text,ms=3200){hint.textContent=text;hint.classList.add('is-on');clearTimeout(hintTimer);if(ms)hintTimer=setTimeout(()=>hint.classList.remove('is-on'),ms);}
 // the left rail: pull only; the other hands are locked in this release
 for(const b of document.querySelectorAll('.tools button'))b.addEventListener('click',()=>showHint(b.dataset.mode==='pull'?'按住身体任意部位拖动':LOCKED));
 app.dataset.mode='pull';app.style.setProperty('--mode','#d9707a');
 const canvas=renderer.domElement;let pendingAt=null,estimate=null,lastMetric=0;
 const placeRing=e=>{const b=canvas.getBoundingClientRect();ripple.style.left=`${e.clientX-b.left}px`;ripple.style.top=`${e.clientY-b.top}px`;};
 const pull=createPull({canvas,camera,pick:pickBody,sim,enabled:()=>!!tracker,ui:{
  press(e){pendingAt=performance.now();placeRing(e);ripple.style.setProperty('--ring','#d9707a');app.classList.add('is-held');hint.classList.remove('is-on');controls.enabled=false;},
  move(e){pendingAt=performance.now();placeRing(e);},
  release(){app.classList.remove('is-held');controls.enabled=true;}}});
 function restore(){
  pull.cancel();sim.reset();data.qpos.set(idle.qpos);data.ctrl.set(idle.ctrl);sim.forward();
  tracker?.reset();nextControl=data.time;spring=null;view.update(0);follow(data.qpos[0],data.qpos[2],0);
 }
 restore();renderer.render(scene,camera);app.classList.add('is-visible');
 phase='下载动作库';$('status').hidden=true;reset.disabled=true;
 reset.addEventListener('click',restore);
 // one physics step (5 ms): the controller every 20 ms, the finger's spring, the hidden helper, the physics
 function step(){
  const g=pull.grab();
  if(tracker&&data.time>=nextControl-1e-9){tracker.control(spring?{point:spring.point,force:spring.force,lead:g?.lead??[0,0,0]}:null,WILL);nextControl+=CONTROL_S;}
  data.xfrc_applied.fill(0);spring=null;
  if(g){
   const point=sim.toWorld(g.body,g.local),force=point.map((p,i)=>SPRING.stiff*(g.target[i]-p)-SPRING.damp*(p-g.prevPoint[i])/DT);
   const n=Math.hypot(...force);if(n>SPRING.max)for(let i=0;i<3;i++)force[i]*=SPRING.max/n;
   for(let i=0;i<3;i++)g.lead[i]=.8*g.lead[i]+.2*(g.target[i]-g.prevTarget[i])/DT;
   g.prevPoint=point;g.prevTarget=g.target;spring={body:g.body,point,force};
   const b=g.body,o=6*b,c=3*b,r=[point[0]-data.xipos[c],point[1]-data.xipos[c+1],point[2]-data.xipos[c+2]],x=data.xfrc_applied;
   x[o]+=force[0];x[o+1]+=force[1];x[o+2]+=force[2];x[o+3]+=r[1]*force[2]-r[2]*force[1];x[o+4]+=r[2]*force[0]-r[0]*force[2];x[o+5]+=r[0]*force[1]-r[1]*force[0];
  }
  tracker?.helper();mj.mj_step(model,data);
  if(data.qpos[1]<FALL_Y){falls++;restore();showHint(`摔倒了, 已恢复站姿(第 ${falls} 次)`);}
 }
 async function loadController(){
  try{
   const pack=await withCountedFetch(n=>{got+=n;show('正在下载动作库',got);},()=>loadTracker('./model/tracker/'));
   phase='启动控制器';tracker=new Tracker(mj,model,data,pack,idle.ctrl);
   nextControl=data.time;status.hidden=true;reset.disabled=false;app.classList.add('is-ready');$('skill').textContent='ReflexBody Lite';$('splash').classList.add('is-gone');
   const notice=$('notice');notice.hidden=false;$('noticeOk').focus();$('noticeOk').onclick=()=>{notice.hidden=true;showHint('按住身体任意部位拖动');};
   showHint('按住身体任意部位拖动');resume();
  }catch(error){fail(error);}
 }
 let last=performance.now(),frameHandle=0,simLag=0;
 function frame(now){
  frameHandle=0;if(document.hidden)return;
  const dt=Math.min(.04,(now-last)/1000);last=now;
  if(tracker){simLag+=dt;let n=0;while(simLag>=DT&&n<MAX_STEPS){step();simLag-=DT;n++;}if(n===MAX_STEPS)simLag=0;}
  view.update(dt);arena.update(model,data);look.update(data.qpos[0],data.qpos[1],data.qpos[2]);
  const g=pull.grab();tether.draw(g&&spring?spring.point:null,[ripple.offsetLeft,ripple.offsetTop],spring?Math.hypot(...spring.force):0);
  if(!pull.grab())follow(data.qpos[0],data.qpos[2],dt);else controls.update();
  renderer.render(scene,camera);
  if(pendingAt!==null){const s=Math.max(0,performance.now()-pendingAt);estimate=estimate===null?s:estimate*.75+s*.25;pendingAt=null;}
  if(now-lastMetric>=750){
   latency.textContent=estimate===null?'—':String(Math.round(estimate));
   const used=performance.memory?.usedJSHeapSize;memory.textContent=Number.isFinite(used)?(used/1048576).toFixed(0):'不可测';lastMetric=now;
  }
  frameHandle=requestAnimationFrame(frame);
 }
 const resume=()=>{if(!document.hidden&&!frameHandle){last=performance.now();frameHandle=requestAnimationFrame(frame);}};
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&frameHandle){cancelAnimationFrame(frameHandle);frameHandle=0;}else resume();});
 resume();void loadController();
}

start().catch(fail);
