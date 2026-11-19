import {Vector3} from 'three';
import {rotationStep,rotationExp,boundedVector} from './feasible_math.mjs';
import {jointPolicy,projectJoint} from './joint_feasibility.mjs';
import {jointCoordinates,jointRotation} from './joint_coordinates.mjs';
import {predictHistory} from '../training/history_ar.mjs';
import {motionSpectrum} from './multiscale_motion.mjs';
const alpha=(hz,dt)=>1/(1+1/(2*Math.PI*hz*dt));
export function historyFilter(names,model,direction=1){
  const states=names.map(()=>null),spectra=names.map(motionSpectrum);let reports=[];
  function reset(){states.fill(null);spectra.forEach(s=>s.reset());reports=[];}
  function limit(i,target,dt){
    const prior=states[i];if(!prior)return projectJoint(names[i],target,0);if(dt===0)return prior.q.clone();
    const max=jointPolicy(names[i]).speed*dt,a=jointCoordinates(names[i],prior.q),b=jointCoordinates(names[i],target);
    const candidate=t=>projectJoint(names[i],names[i]==='hips'?prior.q.clone().slerp(target,t):jointRotation(names[i],a.clone().lerp(b,t)),0);
    let q=candidate(1);if(prior.q.angleTo(q)<=max)return q;
    let lo=0,hi=1;for(let k=0;k<18;k++){const t=(lo+hi)/2;if(prior.q.angleTo(candidate(t))<=max)lo=t;else hi=t;}
    return candidate(lo);
  }
  function propose(i,target,confidence,dt){
    if(!Number.isFinite(confidence)||confidence<0||confidence>1)throw Error('关节观测质量必须位于0到1.');
    const prior=states[i];if(!prior)return confidence>0?target.clone():target.clone().identity();if(dt===0)return prior.q.clone();
    const forecast=boundedVector(predictHistory(model,names[i],prior.history,direction),jointPolicy(names[i]).speed),missing=confidence===0?prior.missing+dt:0;
    if(missing)forecast.multiplyScalar(Math.exp(-missing/.4));
    const predicted=prior.q.clone().multiply(rotationExp(forecast.multiplyScalar(dt))),error=predicted.angleTo(target),variance=model?model.validation.variance.slice(i*3,i*3+3).reduce((s,v)=>s+v,0)*dt**2:.002;
    const noise=spectra[i].noise(),measurement=1e-8+.03**2*(1-confidence)**2+.005*noise,gain=confidence===0?0:confidence>.995&&noise===0?1:Math.max(variance,1e-6)/(Math.max(variance,1e-6)+measurement);
    const rawV=rotationStep(prior.raw,target).divideScalar(dt),speed=prior.speed.clone().lerp(rawV,alpha(1.5,dt)),base=/hips|spine|chest|Leg|Foot|Toes/.test(names[i])?1.5:3;
    const cutoff=(confidence>.995?6:base)+(confidence>.995?8:3)*speed.length();
    const smoothing=alpha(Math.max(.4,cutoff*(.25+.75*confidence)*(1-noise)),dt),result=confidence===0?predicted:prior.q.clone().slerp(predicted.slerp(target,gain),smoothing);
    reports[i]={bone:names[i],confidence,measurement_gain:gain,cutoff_hz:cutoff,filter_gain:smoothing,noise_gate:noise,missing_seconds:missing,prediction_error_deg:error*180/Math.PI};
    prior.missing=missing;prior.nextSpeed=speed;return result;
  }
  function commit(qs,raw,dt){
    for(let i=0;i<names.length;i++){
      const old=states[i],v=old&&dt>0?rotationStep(old.q,qs[i]).divideScalar(dt):new Vector3(),a=old&&dt>0?v.clone().sub(old.v).divideScalar(dt):new Vector3();
      let history=old?.history??[],elapsed=(old?.elapsed??0)+dt,stamp=old?.stamp??qs[i].clone(),rawStamp=old?.rawStamp??raw[i].clone();
      if(elapsed>=.05-1e-8){history=[...history,rotationStep(stamp,qs[i]).divideScalar(elapsed)].slice(-4);spectra[i].push(rotationStep(rawStamp,raw[i]),rotationStep(stamp,qs[i]));stamp=qs[i].clone();rawStamp=raw[i].clone();elapsed=0;}
      if(dt>0||!old)states[i]={q:qs[i].clone(),raw:raw[i].clone(),v,a,history,stamp,rawStamp,elapsed,speed:old?.nextSpeed??new Vector3(),missing:old?.missing??0};
    }
  }
  return {reset,propose,limit,commit,report:()=>({joints:reports,spectra:names.map((n,i)=>({bone:n,...spectra[i].report()}))}),previous:()=>states};
}
