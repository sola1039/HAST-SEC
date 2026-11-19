import {loadBeatModel} from "./beat_model.mjs";
import {beatDirectionRuntime} from "../training/beat_direction_runtime.mjs";
export async function loadDirectionModel(options={}){
  const {prefix='/baseline-v8b-data/',...runtimeOptions}=options;
  if(!['/baseline-v8b-data/','/baseline-v9-filtered-data/'].includes(prefix))throw Error('方向模型版本无效.');
  const data=await loadBeatModel(prefix),read=async name=>{const r=await fetch(prefix+name);if(!r.ok)throw Error("方向数据读取失败: "+name);const b=await r.arrayBuffer(),hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",b)),v=>v.toString(16).padStart(2,"0")).join("");if(hash!==data.meta.direction_hashes[name])throw Error("方向数据校验不符: "+name);return JSON.parse(new TextDecoder().decode(b));};
  const [direction,noise]=await Promise.all(["direction.json","direction-noise.json"].map(read)),raw=data.create;
  const create=()=>beatDirectionRuntime(data.meta,data.weights,data.codes,direction,noise,runtimeOptions);create();return {...data,create,raw,direction,noise};
}
