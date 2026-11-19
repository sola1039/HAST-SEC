import {Vector3} from 'three';
import {FACE_ORDER} from '../face/feasible_face.mjs';
import {channelHistory} from './channel_history.mjs';
export function auxiliaryHistory(rig,model,direction){
  const faceStart=rig.names.length*3,root=channelHistory(model,faceStart+FACE_ORDER.length,3,[direction,1,direction]),face=channelHistory(model,faceStart,FACE_ORDER.length);
  return {reset(){root.reset();face.reset();},root(position,quality,dt){return new Vector3(...root.propose(position.toArray(),quality,dt));},face(values,quality,dt){const result=face.propose(FACE_ORDER.map(n=>values[n]??0),quality,dt);return Object.fromEntries(FACE_ORDER.map((n,i)=>[n,result[i]]));},commit(position,expressions,dt){root.commit(position.toArray(),dt);face.commit(FACE_ORDER.map(n=>expressions[n]??0),dt);}};
}
