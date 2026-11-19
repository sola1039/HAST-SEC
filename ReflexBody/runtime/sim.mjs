export function createSim(mj,xml,timestep){
 const model=mj.MjModel.from_xml_string(xml);
 if(timestep!==undefined)model.opt.timestep=timestep;
 const data=new mj.MjData(model);
 const dt=model.opt.timestep,MAX_SUBSTEPS=60;
 let carry=0;
 const forces=new Map();
 function reset(){mj.mj_resetData(model,data);mj.mj_forward(model,data);carry=0;forces.clear();}
 function applyForces(){
  data.xfrc_applied.fill(0);
  for(const {body,point,force} of forces.values()){
   const o=6*body,c=3*body,r=[point[0]-data.xipos[c],point[1]-data.xipos[c+1],point[2]-data.xipos[c+2]];
   data.xfrc_applied[o]+=force[0];data.xfrc_applied[o+1]+=force[1];data.xfrc_applied[o+2]+=force[2];
   data.xfrc_applied[o+3]+=r[1]*force[2]-r[2]*force[1];data.xfrc_applied[o+4]+=r[2]*force[0]-r[0]*force[2];data.xfrc_applied[o+5]+=r[0]*force[1]-r[1]*force[0];
  }
 }
 function advance(seconds,beforeStep,afterStep,afterForces){
  carry+=seconds;let n=0;
  while(carry>=dt&&n<MAX_SUBSTEPS){beforeStep?.();applyForces();afterForces?.();mj.mj_step(model,data);afterStep?.();carry-=dt;n++;}
  if(n===MAX_SUBSTEPS)carry=0;
  return n;
 }
 function toWorld(body,local){const x=data.xpos,m=data.xmat,c=3*body,r=9*body;return [0,1,2].map(i=>x[c+i]+m[r+3*i]*local[0]+m[r+3*i+1]*local[1]+m[r+3*i+2]*local[2]);}
 function toLocal(body,world){const x=data.xpos,m=data.xmat,c=3*body,r=9*body,d=[0,1,2].map(i=>world[i]-x[c+i]);return [0,1,2].map(i=>m[r+i]*d[0]+m[r+3+i]*d[1]+m[r+6+i]*d[2]);}
 reset();
 return{model,data,dt,reset,advance,toWorld,toLocal,
  forward(){mj.mj_forward(model,data);},
  setForce(id,spec){if(spec)forces.set(id,spec);else forces.delete(id);},
  forceOn(body){let s=0;for(const f of forces.values())if(f.body===body)s+=Math.hypot(...f.force);return s;},
  bodyName:i=>model.body(i).name,
  time:()=>data.time,
  dispose(){data.delete();model.delete();}};
}
