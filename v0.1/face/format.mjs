export const FACE_NAMES=Object.freeze(["_neutral","browDownLeft","browDownRight","browInnerUp","browOuterUpLeft","browOuterUpRight","cheekPuff","cheekSquintLeft","cheekSquintRight","eyeBlinkLeft","eyeBlinkRight","eyeLookDownLeft","eyeLookDownRight","eyeLookInLeft","eyeLookInRight","eyeLookOutLeft","eyeLookOutRight","eyeLookUpLeft","eyeLookUpRight","eyeSquintLeft","eyeSquintRight","eyeWideLeft","eyeWideRight","jawForward","jawLeft","jawOpen","jawRight","mouthClose","mouthDimpleLeft","mouthDimpleRight","mouthFrownLeft","mouthFrownRight","mouthFunnel","mouthLeft","mouthLowerDownLeft","mouthLowerDownRight","mouthPressLeft","mouthPressRight","mouthPucker","mouthRight","mouthRollLower","mouthRollUpper","mouthShrugLower","mouthShrugUpper","mouthSmileLeft","mouthSmileRight","mouthStretchLeft","mouthStretchRight","mouthUpperUpLeft","mouthUpperUpRight","noseSneerLeft","noseSneerRight"]);
export const FACE_POINTS=Object.freeze([10,152,234,454,33,133,362,263,13,14,61,291,1,70,300]);
const round=value=>Number(value.toFixed(6));
export function validateBlendshapes(value){
  if(!value||Object.keys(value).length!==52||FACE_NAMES.some(name=>!Object.hasOwn(value,name)||!Number.isFinite(value[name])||value[name]<0||value[name]>1)) throw new Error("面部权重名称或数值无效.");
}
export function validateFaceFrame(frame){
  if(!frame||Object.keys(frame).sort().join(",")!=="blendshapes,decoded_time,index,inference_ms,points,time"||!Number.isInteger(frame.index)||frame.index<0||frame.index>=1800) throw new Error("面部帧字段或编号无效.");
  if([frame.time,frame.decoded_time,frame.inference_ms].some(v=>!Number.isFinite(v)||v<0)) throw new Error("面部时间或耗时无效.");
  if((frame.blendshapes===null)!==(frame.points===null)) throw new Error("面部缺失标记不一致.");
  if(frame.blendshapes!==null){
    validateBlendshapes(frame.blendshapes);
    if(!Array.isArray(frame.points)||frame.points.length!==FACE_POINTS.length||frame.points.some(p=>!Array.isArray(p)||p.length!==3||!p.every(Number.isFinite))) throw new Error("面部叠加点无效.");
  }
}
export function packFaceFrame(index,time,decodedTime,result,inferenceMs){
  const points=result.faceLandmarks?.[0],categories=result.faceBlendshapes?.[0]?.categories;
  if(Boolean(points)!==Boolean(categories)) throw new Error("面部关键点与权重输出不一致.");
  const frame={index,time,decoded_time:decodedTime,inference_ms:round(inferenceMs),blendshapes:categories?Object.fromEntries(categories.map(item=>[item.categoryName,round(item.score)])):null,points:points?FACE_POINTS.map(i=>[points[i]?.x,points[i]?.y,points[i]?.z].map(round)):null};
  validateFaceFrame(frame);return frame;
}
