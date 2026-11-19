// ReflexBody lite: drag the physics character by any part. Physics 5 ms steps (MuJoCo WASM), the controller every 20 ms.
import * as T from 'three';
import loadMujoco from '@mujoco/mujoco';
import {createBodyView} from './runtime/render.mjs';
import {createScene} from './runtime/scene.mjs';
import {arenaXml,createArena} from './runtime/arena.mjs';
import {loadTracker,Tracker} from './runtime/tracker.mjs';

const $=id=>document.getElementById(id);
const DT=.005,CTRL_HZ=50,STIFF=250,DAMP=20,F_MAX=200,MAX_STEPS=20,FALL_Y=.35;

async function start(){
 const {scene,camera,renderer,controls}=createScene($('stage'));
 camera.position.set(1.6,1.1,2.2);controls.target.set(0,.6,0);
 const get=(u,k)=>fetch(u).then(r=>{if(!r.ok)throw Error('读取失败: '+u);return r[k]();});
 const [mj,xml,meta,idle]=await Promise.all([loadMujoco(),get('./model/body_torque.xml','text'),get('./model/body.meta.json','json'),get('./model/idle_stand.json','json')]);
 const model=mj.MjModel.from_xml_string(arenaXml(xml));model.opt.timestep=DT;
 const data=new mj.MjData(model),floor=model.geom('floor').id;
 model.geom_priority[floor]=1;
 const surface=()=>{model.geom_friction[3*floor]=+$('surface').value;};surface();$('surface').onchange=surface;
 const tracker=new Tracker(mj,model,data,await loadTracker('./model/tracker/'),idle.ctrl);
 const reset=()=>{const t=data.time;data.qpos.set(idle.qpos);data.qvel.fill(0);data.ctrl.set(idle.ctrl);data.time=t;mj.mj_forward(model,data);tracker.reset();};
 reset();$('reset').onclick=()=>{grab=null;reset();};
 const view=createBodyView(scene,{model,data,bodyName:i=>model.body(i).name},meta),arena=createArena(scene);
 view.meshes.filter(m=>m.userData.body===0).forEach(m=>{m.visible=false;});
 const bodyMeshes=view.meshes.filter(m=>m.userData.body!==0);
 const ball=new T.Mesh(new T.SphereGeometry(.03,12,8),new T.MeshBasicMaterial({color:0xc0392b}));scene.add(ball);
 let grab=null,prev=null,lastQ=null,lastP=null,lastF=[0,0,0],force=0,netT=0,falls=0;const fingerV=[0,0,0];
 const point=g=>{const b=g.body,R=data.xmat,o=9*b,l=g.local;return [0,1,2].map(i=>data.xpos[3*b+i]+R[o+3*i]*l[0]+R[o+3*i+1]*l[1]+R[o+3*i+2]*l[2]);};
 // the finger: a spring from the taken point to where the pointer drags it
 function pull(){
  data.xfrc_applied.fill(0);force=0;if(!grab){lastQ=lastP=null;fingerV.fill(0);return null;}
  const p=point(grab),q=grab.target,f=[0,0,0];
  for(let k=0;k<3;k++)f[k]=STIFF*(q[k]-p[k])-(prev?DAMP*(p[k]-prev[k])/DT:0);
  prev=p;for(let k=0;k<3;k++)fingerV[k]=lastQ?.8*fingerV[k]+.2*(q[k]-lastQ[k])/DT:0;lastQ=q.slice();
  const n=Math.hypot(...f);if(n>F_MAX)for(let k=0;k<3;k++)f[k]*=F_MAX/n;force=Math.min(n,F_MAX);lastP=p;lastF=f.slice();
  const b=6*grab.body,c=3*grab.body,r=[p[0]-data.xipos[c],p[1]-data.xipos[c+1],p[2]-data.xipos[c+2]];
  data.xfrc_applied[b]=f[0];data.xfrc_applied[b+1]=f[1];data.xfrc_applied[b+2]=f[2];
  data.xfrc_applied[b+3]=r[1]*f[2]-r[2]*f[1];data.xfrc_applied[b+4]=r[2]*f[0]-r[0]*f[2];data.xfrc_applied[b+5]=r[0]*f[1]-r[1]*f[0];
  return q;
 }
 const ray=new T.Raycaster(),ndc=new T.Vector2(),plane=new T.Plane(),hitp=new T.Vector3(),el=renderer.domElement;
 const aim=e=>{const r=el.getBoundingClientRect();ndc.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(ndc,camera);};
 el.addEventListener('pointerdown',e=>{
  aim(e);view.meshes.forEach(m=>m.updateMatrixWorld(true));const hit=ray.intersectObjects(bodyMeshes,false)[0];if(!hit)return;
  e.stopImmediatePropagation();
  const b=hit.object.userData.body,o=9*b,d=[hit.point.x-data.xpos[3*b],hit.point.y-data.xpos[3*b+1],hit.point.z-data.xpos[3*b+2]];
  const local=[0,1,2].map(j=>data.xmat[o+j]*d[0]+data.xmat[o+3+j]*d[1]+data.xmat[o+6+j]*d[2]);
  plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new T.Vector3()),hit.point);
  grab={body:b,local,target:[hit.point.x,hit.point.y,hit.point.z],name:hit.object.userData.name};prev=null;controls.enabled=false;el.setPointerCapture(e.pointerId);
 },{capture:true});
 el.addEventListener('pointermove',e=>{if(!grab)return;aim(e);if(ray.ray.intersectPlane(plane,hitp))grab.target=[hitp.x,hitp.y,hitp.z];});
 el.addEventListener('pointerup',()=>{if(grab){grab=null;controls.enabled=true;}});
 function step(){
  if(data.time>=netT){tracker.control(grab&&lastP?{point:lastP,force:lastF,lead:fingerV}:null,+$('will').value);netT+=1/CTRL_HZ;}
  const q=pull();tracker.helper();mj.mj_step(model,data);
  if(data.qpos[1]<FALL_Y){falls++;grab=null;controls.enabled=true;reset();}
  return q;
 }
 let simT=data.time,last=performance.now();
 function frame(now){
  const wall=Math.min((now-last)/1000,.1);last=now;simT+=wall;
  let q=null,n=0;while(data.time<simT&&n<MAX_STEPS){q=step();n++;}
  if(data.time<simT)simT=data.time;
  ball.visible=!!grab;if(q)ball.position.set(...q);
  $('status').textContent=(grab?`拉着${grab.name}: ${force.toFixed(0)} 牛`:'按住身体任意部位拖动')+`; 倒地重置 ${falls} 次`;
  view.update();arena.update(model,data);controls.update();renderer.render(scene,camera);
  requestAnimationFrame(frame);
 }
 $('loading').remove();requestAnimationFrame(frame);
}
start().catch(e=>{console.error(e);$('loading').textContent='载入失败: '+e.message;});
