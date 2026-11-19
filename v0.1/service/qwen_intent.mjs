import {qwenContract} from './qwen_contract.mjs';
import {compileSlots} from './qwen_slots.mjs';
import {qwenProcess} from './qwen_process.mjs';
import {qwenRequests} from './qwen_requests.mjs';
import {bodyContract} from './qwen_parts.mjs';
import {readDialogue} from './qwen_dialogue.mjs';
export function qwenIntent(root,classes){
 const process=qwenProcess(root),endpoint=process.endpoint;
 const contract=qwenContract(classes),requests=qwenRequests(endpoint,contract),extended=qwenRequests(endpoint,bodyContract(contract));
 let idle=null,busy=false,owner=null,primed=false,controller=null,settled=null,finish=null,kind=null,closing=false;
 const begin=(session,type='plan')=>{busy=true;owner=session;kind=type;clearTimeout(idle);controller=new AbortController();settled=new Promise(resolve=>finish=resolve);return controller.signal;};
 const state=()=>({...process.state(),busy});
 const stop=async()=>{clearTimeout(idle);primed=false;await process.stop();};
 const cool=async()=>{const c=await process.settings;busy=false;owner=null;controller=null;if(!closing)idle=setTimeout(()=>{void stop();},c.idle_seconds*1000);finish?.();finish=null;settled=null;};
 const punctuation={'，':',','。':'.','？':'?','！':'!','：':':','；':';'},normalize=value=>value?.replace(/[，。？！：；]/g,c=>punctuation[c]);
 async function warm(session){
  clearTimeout(idle);if(busy)return state();const signal=begin(session,'warm');
  try{if(!process.state().ready)primed=false;await process.ensure();signal.throwIfAborted();if(!primed){await requests.warm(signal);primed=true;}return {...state(),busy:false};}catch(e){if(!signal.aborted)await stop();throw e;}
  finally{await cool();}
 }
 return {state,stop,warm,async shutdown(){closing=true;controller?.abort();const done=settled;await stop();if(done)await done;clearTimeout(idle);},async proactive(context,session){
  if(busy)throw Error('中文模型正在处理上一条消息.');const signal=begin(session),started=performance.now();
  try{await process.ensure();signal.throwIfAborted();const raw=await extended.chat('现在你主动和玩家自然聊一句, 可以问问玩家想聊什么. 不要说将执行什么, 不要声称刚刚发生了某件事.',context,true,signal),{reply,...presentation}=readDialogue(raw.choices?.[0]?.message?.content);return {reply:normalize(reply),operation:'chat',base:{change:false,name:'保持',motion:0,rest:true},intents:[],timing:'同时',presentation,proactive:true,seconds:(performance.now()-started)/1000};}catch(e){if(!signal.aborted)await stop();throw e;}finally{await cool();}
 },async cancel(session,release=true){if(busy&&owner!==session)return false;const done=settled;if(release||kind!=='warm')controller?.abort();if(done)await done;if(release)await stop();return true;},async plan(text,context=[],session='local-test',generation='v13'){
  if(busy)throw Error('中文模型正在处理上一条消息.');const signal=begin(session),started=performance.now();
  try{const loadStart=performance.now();await process.ensure();const loadSeconds=(performance.now()-loadStart)/1000;
   signal.throwIfAborted();const selected=generation==='v15'?extended:requests,raw=await selected.plan(text,context,signal),content=raw.choices?.[0]?.message?.content;primed=true;
   const parsed=JSON.parse(content),sides={'left':'左','right':'右'};let result;
   try{result=compileSlots(parsed,{parts:generation==='v15'});}catch(e){if(generation!=='v15')throw e;result={...parsed,operation:'unsupported',intents:[],timing:'同时'};}
   if(generation==='v15'&&(result.operation==='unsupported'||(result.operation==='command'&&!result.intents.length&&!result.base.change))){result.operation='chat';result.intents=[];result.base={change:false,name:'保持',motion:0,rest:true};}
   const confirmation=result.intents.map(i=>{const [side,motion]=i.key.split('-');return sides[side]+'侧'+motion;}).join(', ');
   if(result.operation==='chat'){
    const answer=await selected.chat(text,context,generation==='v15',signal),content=answer.choices?.[0]?.message?.content;
    if(generation==='v15'){const {reply,...presentation}=readDialogue(content);result.reply=reply;result.presentation=presentation;}else result.reply=content;
   }
   if(result.operation==='command')result.reply=generation==='v15'?'':confirmation?'将执行: '+confirmation+'.':'将调整底座: '+result.base.name+'.';
   if(result.operation==='unsupported'){result.operation='chat';result.supported=false;result.reply='这个动作还没有学会, 没有执行.';}
   result.reply=normalize(result.reply);
   return {...result,seconds:(performance.now()-started)/1000,usage:raw.usage,model:'Qwen3.5-0.8B-Q8_0',timings:raw.timings,load_seconds:loadSeconds};
  }catch(e){if(!signal.aborted)await stop();throw e;}finally{await cool();}
 }};
}
