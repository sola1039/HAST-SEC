import {Vector3} from 'three';
import {upright,supportHull,supportProjection} from '../support_geometry.mjs';
export function contactV9(rig){
  const ids=['leftFoot','rightFoot'].map(n=>rig.index(n)),floor=ids.map(i=>rig.rest.p[i].y),returning=new Set();let feet=null,previous=null,lastSwing=null;
  const copy=f=>({...f,anchor:f.anchor.clone(),orientation:f.orientation.clone(),landingTarget:f.landingTarget?.clone()});
  function reset(){previous=null;feet=null;lastSwing=null;returning.clear();}
  function propose(state,dt,locked=false,realized=rig.rest,center=realized.p[0],swingFoot=null){
    if(swingFoot&&!['leftFoot','rightFoot'].includes(swingFoot))throw Error('支撑任务部位无效.');
    if(lastSwing&&lastSwing!==swingFoot)returning.add(rig.index(lastSwing));
    if(swingFoot)returning.delete(rig.index(swingFoot));lastSwing=swingFoot;
    const rows=ids.map((index,j)=>{
      const p=state.p[index],v=previous&&dt>0?p.clone().sub(previous[j]).divideScalar(dt):new Vector3(),score=Math.exp(-((Math.max(0,p.y-floor[j])/.06)**2+(Math.hypot(v.x,v.z)/.45)**2));
      const old=feet?.[j],f=old?copy(old):{index,active:true,anchor:rig.rest.p[index].clone(),orientation:upright(rig.rest.q[index].clone(),0),count:0,release:0};
      f.floor=floor[j];f.score=score;f.prior=false;f.locked=locked;f.landing=false;f.unloading=false;
      const requested=rig.names[index]===swingFoot,recovering=returning.has(index)&&!requested;
      f.count=(recovering||score>.65)&&!requested?f.count+dt:0;f.release=!recovering&&(score<.22||requested)?f.release+dt:0;
      if(f.active&&!locked&&f.release>=.15){
        const other=feet?.filter(g=>g.index!==index&&g.active)??[];
        if(other.length&&supportProjection(center,support(other)).sub(center).setY(0).length()<=.015){f.active=false;f.release=0;}
        else f.unloading=true;
      }
      if(!f.active&&(locked||f.count>=.15)){
        f.landing=true;f.landingTarget=realized.p[index].clone().setY(f.floor);
        if(recovering){const delta=f.landingTarget.clone().sub(realized.p[index]);if(delta.length()>.4*dt)delta.setLength(.4*dt);f.landingTarget=realized.p[index].clone().add(delta);}
        const tilt=new Vector3(0,1,0).applyQuaternion(realized.q[index]).angleTo(new Vector3(0,1,0));
        if(Math.abs(realized.p[index].y-f.floor)<=.025&&tilt<=10*Math.PI/180){f.active=true;f.landing=false;f.anchor=realized.p[index].clone().setY(f.floor);f.orientation=upright(realized.q[index].clone(),0);f.count=0;returning.delete(index);}
      }
      if(recovering&&f.active)returning.delete(index);
      return f;
    });
    if(!rows.some(f=>f.active)){const j=feet?.findIndex(f=>f.active)??0;rows[Math.max(0,j)].active=true;rows[Math.max(0,j)].prior=true;rows[Math.max(0,j)].landing=false;}
    const remaining=rows.filter(f=>f.active&&!f.unloading);
    return {rows,hull:support(rows),futureHull:remaining.length&&rows.some(f=>f.unloading)?support(remaining):null,swingFoot,footTarget:swingFoot?state.p[rig.index(swingFoot)].clone():null,observation:ids.map(i=>state.p[i].clone())};
  }
  function support(rows){
    const points=[];for(const f of rows.filter(f=>f.active)){const forward=new Vector3(0,0,1).applyQuaternion(f.orientation),side=new Vector3(forward.z,0,-forward.x);
      for(const a of [-.055,.09])for(const b of [-.035,.035])points.push(f.anchor.clone().addScaledVector(forward,a).addScaledVector(side,b));}
    return supportHull(points);
  }
  return {reset,propose,support,project:supportProjection,commit(proposal){feet=proposal.rows.map(copy);previous=proposal.observation.map(p=>p.clone());},current(){return feet?{rows:feet.map(copy),hull:support(feet)}:null;},observe(proposal){previous=proposal.observation.map(p=>p.clone());}};
}
