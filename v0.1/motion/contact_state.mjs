import {Vector3} from 'three';
import {supportHull,supportProjection} from './support_geometry.mjs';
export function contactState(rig){
  const ids=['left','right'].map(s=>rig.index(s+'Foot')),floor=ids.map(i=>rig.rest.p[i].y);let previous=null,feet=null;
  function reset(){previous=null;feet=ids.map(()=>({active:false,anchor:null,count:0,release:0,score:0}));}reset();
  function update(state,dt,locked=false,rootObserved=false){
    for(const [j,i]of ids.entries()){
      const p=state.p[i],v=previous&&dt>0?p.clone().sub(previous[j]).divideScalar(dt):new Vector3(),f=feet[j];
      f.score=Math.exp(-((Math.max(0,p.y-floor[j])/.06)**2))*Math.exp(-((Math.hypot(v.x,v.z)/.45)**2));
      f.prior=false;f.locked=locked;
      if(locked||f.score>.65){f.count++;f.release=0;}else{f.count=0;if(f.score<.22)f.release++;}
      if(!f.active&&(locked||f.count>=3||!previous&&f.score>.65)){f.active=true;f.anchor=p.clone();f.anchor.y=floor[j];}
      if(f.active&&!locked&&f.release>=3){f.active=false;f.anchor=null;}
      if(f.active&&!locked&&!rootObserved){f.anchor.x=p.x;f.anchor.z=p.z;}
    }
    if(!rootObserved&&!feet.some(f=>f.active)){
      const j=state.p[ids[0]].y<state.p[ids[1]].y?0:1;feet[j].active=true;feet[j].anchor=state.p[ids[j]].clone();feet[j].anchor.y=floor[j];feet[j].prior=true;
    }
    if(dt>0||!previous)previous=ids.map(i=>state.p[i].clone());
    return feet.map((f,j)=>({...f,index:ids[j],floor:floor[j],anchor:f.anchor?.clone()}));
  }
  function support(rows,state){
    const points=[];for(const f of rows.filter(f=>f.active)){
      const p=f.anchor??state.p[f.index],forward=new Vector3(0,0,1).applyQuaternion(state.q[f.index]);forward.y=0;forward.normalize();const side=new Vector3(forward.z,0,-forward.x);
      for(const a of [-.055,.09])for(const b of [-.035,.035])points.push(p.clone().addScaledVector(forward,a).addScaledVector(side,b));
    }
    return points.length?supportHull(points):null;
  }
  return {reset,update,support,project:supportProjection};
}
