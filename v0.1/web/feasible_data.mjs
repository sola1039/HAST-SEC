import {readHistoryModel} from '../training/history_model_io.mjs';
import {hydrateRegions} from '../training/feasible_priors.mjs';
import {loadDirectionModel} from './beat_direction_model.mjs';
export async function readJson(url){const response=await fetch(url);if(!response.ok)throw Error('运行资源读取失败.');return response.json();}
export async function feasibleData({motionFactory=loadDirectionModel,configUrl='/configs/v9_control.json'}={}){
 const prefix='/feasible-history/';
 const [motion,history,config,index]=await Promise.all([motionFactory(),readHistoryModel(prefix,readJson),readJson(configUrl),readJson(prefix+'regions-index.json')]);
 const parts=await Promise.all(index.parts.map(name=>readJson(prefix+name)));
 return {motion,history,config,regions:hydrateRegions(Object.assign({},...parts)),sources:[],checklist:[]};
}
