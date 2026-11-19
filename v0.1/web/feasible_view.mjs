import {Vector3,Box3} from 'three';
import {createViewer} from './viewer.mjs';
import {modelLoader,prepareModel} from './model_loader.mjs';
import {PoseController} from '../motion/pose_controller.mjs';
import {createClearance} from '../hands/clearance.mjs';
import {registerFineFace} from '../face/details.mjs';
import {feasibleController} from '../motion/feasible_controller.mjs';
import {FACE_ORDER} from '../face/feasible_face.mjs';
import {morphMetric} from '../face/morph_metric.mjs';
import {poseState} from '../motion/feasible_state.mjs';
export async function feasibleView(model,config,regions=null,{controllerFactory=feasibleController,faceSetup=null,faceGroups=[],measureHead=null}={}){
  const json=async p=>{const r=await fetch(p);if(!r.ok)throw Error('统一控制配置读取失败.');return r.json();};
  const [profile,graph,gltf]=await Promise.all([json('/configs/skeleton_profile.json'),json('/configs/rig_profile.json'),modelLoader().loadAsync('/assets/avatar.vrm')]);
  const vrm=prepareModel(gltf),controller=new PoseController(vrm,profile);controller.reset();vrm.scene.position.y-=new Box3().setFromObject(vrm.scene).min.y;controller.sync();
  const headReference=measureHead?.(vrm,controller),clearance=createClearance(controller);clearance.shoulders(config.shoulder_offset_m??.02);registerFineFace(vrm);
  const faceOrder=faceSetup?faceSetup(vrm):FACE_ORDER,available=faceOrder.filter(n=>vrm.expressionManager.getExpression(n)),metric=morphMetric(vrm,faceOrder),createSolver=()=>controllerFactory(controller,{model,config,faceNames:available,faceMetric:metric,faceOrder,faceGroups,regions}),viewer=createViewer(document.getElementById('beat-stage'),{wheelZoom:false});let solver=createSolver();viewer.attach(vrm,profile,graph);viewer.showAxes(false);const fullBounds=new Box3().setFromObject(vrm.scene);let closeup=false;
  let enabled=true,lockedFeet=false,temporal=true,regional=true,last=null;
  function render(frame,meta,dt=0,draw=true,overrides={}){
    const qs=frame.rotations.map(q=>controller.adapt(q)),expressions={...Object.fromEntries(meta.face.map((n,i)=>[n,frame.face?.[i]??(n==='aa'?frame.jaw:0)])),...overrides};
    const input=poseState({...frame,expressions},controller,solver.rig.offsets[0],meta.face);
    if(enabled){last=solver.step(input,dt,{lockedFeet,temporal,regionsEnabled:regional,manualFace:overrides,forwardLeanDegrees:config.playback_torso_forward_degrees??0,faceBehavior:config.playback_face??null});solver.write(last);}else{controller.humanoid.resetNormalizedPose();controller.humanoid.setNormalizedPose(Object.fromEntries(meta.bones.map((name,i)=>[name,{rotation:qs[i]}])));for(const n of available)vrm.expressionManager.setValue(n,Math.max(0,Math.min(1,expressions[n]??0)));controller.node('hips').position.fromArray(input.root);controller.sync();last=null;}
    if(draw)viewer.render();return last;
  }
  return {render,validate:result=>solver.validate?.(result)??true,display(result,draw=true){if(result)solver.write(result);if(draw)viewer.render();},reset(){solver.reset();controller.reset();clearance.shoulders(config.shoulder_offset_m??.02);last=null;viewer.render();},configure(values,{rebuild=false}={}){Object.assign(config,values);if(rebuild){controller.reset();clearance.shoulders(config.shoulder_offset_m??.02);solver=createSolver();}else solver.reset();},options(values){({enabled,lockedFeet,temporal,regional}={enabled,lockedFeet,temporal,regional,...values});solver.reset();},view(side){if(side==='hands'){const box=new Box3().setFromPoints(['leftHand','rightHand'].map(n=>controller.node(n).getWorldPosition(new Vector3()))).expandByScalar(.15);viewer.fitBounds(box);closeup=true;return;}if(closeup&&side!=='face'){viewer.fitBounds(fullBounds);closeup=false;}viewer.view(side);},bones(show){viewer.showBones(show);},report:()=>({enabled,...solver.report()}),state:()=>last,available,direction:controller.direction,
    kinematics(){const r=solver.rig;return {names:r.names,parents:r.parents,offsets:r.offsets.map(p=>p.toArray()),baseQ:r.baseQ.toArray(),baseP:r.baseP.toArray(),direction:controller.direction,head:headReference?.().local};},
    faceOrder,faceOptions(values){Object.assign(config.playback_face,values);},audit(){return {head_reference:headReference?.(),joints:Object.fromEntries(solver.rig.names.map(n=>[n,controller.node(n).getWorldPosition(new Vector3()).toArray()])),rotations:solver.rig.names.map(n=>controller.node(n).quaternion.toArray()),expressions:Object.fromEntries(available.map(n=>[n,vrm.expressionManager.getValue(n)])),metric:{vertices:metric.vertices,channels:metric.channels},camera:viewer.inspect()};}};
}
