import {Quaternion,Vector3} from "three";
import {beatRuntime,blendBeat} from "../training/beat_runtime.mjs";
import {rotationExp} from "../retarget/rotation_math.mjs";
import {sourceQuality,excludedPrototypes} from '../training/source_quality.mjs';
export async function loadBeatModel(prefix="/baseline-v7-data/"){
  const read=async name=>{const r=await fetch(prefix+name);if(!r.ok)throw Error("骨骼模型资源读取失败: "+name);return r;};
  const [meta,metrics,sources,prototypes,wb,cb]=await Promise.all(["model.json","metrics.json","sources.json","prototypes.json"].map(name=>read(name).then(r=>r.json())).concat(["weights.bin","codes.bin"].map(name=>read(name).then(r=>r.arrayBuffer()))));
  const hash=async data=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",data)),v=>v.toString(16).padStart(2,"0")).join("");
  if(await hash(wb)!==meta.weights_sha256||await hash(cb)!==meta.codes_sha256)throw Error("模型或原型校验不符.");
  meta.prototypes=prototypes;const weights=new Float32Array(wb),codes=new Float32Array(cb);
  const review=await read("review.json").then(r=>r.json());if(review.codes_sha256!==meta.codes_sha256)throw Error("原型审核编号与当前码库不一致.");meta.excluded_prototypes=review.excluded_prototypes;
  const filtered=await fetch('/semantic-api/source-filter');if(!filtered.ok)throw Error('来源过滤记录读取失败.');
  const quality=sourceQuality((await filtered.json()).excluded,sources);meta.excluded_prototypes=[...new Set([...meta.excluded_prototypes,...excludedPrototypes(prototypes,sources,quality,meta.rate,meta.frames)])];
  const create=()=>beatRuntime(meta,weights,codes);create();
  return {meta,metrics,sources,review,weights,codes,create,preview(token,time){
    if(!Number.isInteger(token)||token<0||token>=meta.codes||!Number.isFinite(time)||time<0)throw Error("原型预览位置无效.");
    const p=Math.min(meta.frames-1,time*meta.rate),a=Math.floor(p),b=Math.min(a+1,meta.frames-1),row=i=>Array.from(codes.subarray((token*meta.frames+i)*meta.dim,(token*meta.frames+i+1)*meta.dim));
    return {values:blendBeat(row(a),row(b),p-a,meta.bones.length),token,time,seconds:time,steps:0};
  }};
}
export function beatFrame(values,meta,gesture=null,elapsed=0){
  const rotations=meta.bones.map((_,i)=>rotationExp(new Vector3(...values.slice(i*3,i*3+3))).toArray());
  const fade=Math.sin(Math.PI*Math.min(1,elapsed/3))**2;
  function change(name,axis,angle){const i=meta.bones.indexOf(name);rotations[i]=new Quaternion(...rotations[i]).multiply(new Quaternion().setFromAxisAngle(axis,angle*fade)).toArray();}
  if(gesture==="nod")change("head",new Vector3(1,0,0),Math.sin(elapsed*7)*.2);
  if(gesture==="shake")change("head",new Vector3(0,1,0),Math.sin(elapsed*7)*.2);
  if(gesture==="wave")for(const [name,goal]of [["rightUpperArm",[-.2,0,-1.1]],["rightLowerArm",[-.7,0,Math.sin(elapsed*9)*.25]]]){
    const i=meta.bones.indexOf(name);rotations[i]=new Quaternion(...rotations[i]).slerp(rotationExp(new Vector3(...goal)),fade).toArray();
  }
  return {rotations,root:[0,0,0],jaw:Math.max(0,Math.min(1,values[meta.bones.length*3])),face:Array.from(values.slice(meta.bones.length*3,meta.bones.length*3+meta.face.length))};
}
