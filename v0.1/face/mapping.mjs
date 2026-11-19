import {validateBlendshapes,validateFaceFrame} from "./format.mjs";
import {fineFaceWeights,FINE_TARGETS} from "./details.mjs";
export const FACE_CHANNELS=Object.freeze(["aa","ih","ou","ee","oh","blinkLeft","blinkRight","happy","angry","sad","relaxed"]);
const clamp=value=>Math.max(0,Math.min(1,value));
export function mapFace(shapes){
  validateBlendshapes(shapes);
  const mean=key=>(shapes[key+"Left"]+shapes[key+"Right"])/2;
  const opening=clamp((shapes.jawOpen-.025)/.6)*(1-shapes.mouthClose),wide=mean("mouthStretch"),pucker=shapes.mouthPucker,funnel=shapes.mouthFunnel;
  const vowels=[(1-Math.max(pucker,funnel))**2,wide*(1-opening),pucker,wide*opening,funnel],total=vowels.reduce((sum,v)=>sum+v,0)||1;
  const result=Object.fromEntries(FACE_CHANNELS.map(name=>[name,0]));
  ["aa","ih","ou","ee","oh"].forEach((name,i)=>{result[name]=opening*vowels[i]/total;});
  result.blinkLeft=shapes.eyeBlinkLeft;result.blinkRight=shapes.eyeBlinkRight;
  const smile=clamp((mean("mouthSmile")-.15)/.85),brow=clamp((mean("browDown")-.2)/.8),frown=mean("mouthFrown");
  const emotionScale=(1-.7*opening)*(1-.5*Math.max(result.blinkLeft,result.blinkRight));
  result.happy=.6*smile*emotionScale;result.relaxed=.15*smile*emotionScale;
  result.angry=.4*brow*emotionScale;result.sad=.4*frown*shapes.browInnerUp*emotionScale;
  return result;
}
export function faceSampler(frames){
  if(!Array.isArray(frames)||!frames.length||frames.length>1800) throw new Error("面部回放帧数无效.");
  frames.forEach((frame,i)=>{validateFaceFrame(frame);if(frame.index!==i||i&&frame.time<=frames[i-1].time) throw new Error("面部回放时间或编号不一致.");});
  const neutral=Object.fromEntries(FACE_CHANNELS.map(name=>[name,0])),mapped=frames.map(frame=>frame.blendshapes?mapFace(frame.blendshapes):neutral);
  const fineNames=Object.keys(FINE_TARGETS),fineNeutral=Object.fromEntries(fineNames.map(name=>[name,0])),fine=frames.map(frame=>frame.blendshapes?fineFaceWeights(frame.blendshapes):fineNeutral);
  return {duration:frames.at(-1).time,at(time){
    if(!Number.isFinite(time)||time<0) throw new Error("面部回放时间无效.");
    let index=frames.findIndex(frame=>frame.time>time);index=index<0?frames.length-1:Math.max(0,index-1);
    const next=Math.min(index+1,frames.length-1),span=frames[next].time-frames[index].time,t=span?clamp((time-frames[index].time)/span):0;
    const nearest=t<.5?index:next;
    return {time:Math.min(time,frames.at(-1).time),index:nearest,observed:frames[nearest].blendshapes!==null,frame:frames[nearest],expressions:Object.fromEntries(FACE_CHANNELS.map(name=>[name,mapped[index][name]*(1-t)+mapped[next][name]*t])),fine_expressions:Object.fromEntries(fineNames.map(name=>[name,fine[index][name]*(1-t)+fine[next][name]*t]))};
  }};
}
export const sampleFace=(frames,time)=>faceSampler(frames).at(time);
