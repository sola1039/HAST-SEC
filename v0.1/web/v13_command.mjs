import {motionName} from './v13_panels.mjs';
const $=id=>document.getElementById(id);
export function commandLoop({assets,policy,history,behavior,layers,pose,play,speech,prepare,generation,dialogue}){
 const session=crypto.randomUUID();
 const sendLabel=$('send').textContent;
 let pending=null,revision=0,context=[],lastPlan=null,selections=[],self=false,queue=[];
 function remember(messages){context=[...context,...messages].slice(-4);while(context.reduce((n,r)=>n+r.content.length,0)>1200)context=context.slice(1);}
 function cancel(){revision++;pending?.abort();pending=null;self=false;for(const item of queue)item.resolve();queue=[];dialogue?.pending(false);$('send').disabled=false;$('send').textContent=sendLabel;}
 async function proactive(){
  if(pending)return;const ticket=++revision;pending=new AbortController();self=true;dialogue.pending(true,true);
  try{await prepare();if(ticket!==revision)return;const response=await fetch('/v15-api/proactive',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({context,session}),signal:pending.signal}),plan=await response.json();if(ticket!==revision)return;if(!response.ok)throw Error(plan.error);lastPlan=plan;remember([{role:'assistant',content:plan.reply}]);await dialogue.receive(plan,()=>ticket===revision);if(ticket!==revision)return;if($('speak').checked)void speech.speak(plan.reply);}catch(e){if(ticket===revision&&e.name!=='AbortError')$('status').textContent=e.message;}finally{if(ticket===revision){pending=null;self=false;dialogue.pending(false);}}
 }
 async function send(text=$('text').value){
  if(!text.trim())return;
  if(pending&&!self){if(queue.length>=6){$('status').textContent='等待消息已满, 请稍后再发送.';return;}return new Promise(resolve=>{queue.push({text,resolve});$('status').textContent='已排队 '+queue.length+' 条消息, 当前动作继续.';});}
  const interrupted=self;if(interrupted)cancel();const ticket=++revision;pending=new AbortController();dialogue?.pending(true);$('send').disabled=false;$('send').textContent=sendLabel;$('status').textContent='正在理解你的消息...';
  try{if(interrupted){const r=await fetch('/v13-api/interrupt',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({session}),signal:pending.signal});if(!r.ok)throw Error('自主聊天取消失败.');}if(ticket!==revision)return;await prepare();if(ticket!==revision)return;const response=await fetch('/v13-api/plan',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text,context,session,...(generation==='v15'?{generation}:{})}),signal:pending.signal}),plan=await response.json();if(ticket!==revision)return;if(!response.ok)throw Error(plan.error);
   for(const i of plan.intents)await assets.load(assets.entries.get(i.key));if(ticket!==revision)return;
   if(plan.operation==='release')layers.clear();selections=[];
   for(const intent of plan.intents){const entry=assets.entries.get(intent.key);if(entry.side==='body'){layers.clear();continue;}
    const selected=policy.select(entry,history());selections.push(selected.report);layers.add(selected.entry,{...intent,...selected.options},pose());
   }
   behavior.lock(layers.active());behavior.apply(plan.base);lastPlan=plan;
   remember([{role:'user',content:text},...(plan.reply.trim()?[{role:'assistant',content:plan.reply}]:[])]);
   $('reply').textContent=plan.reply;$('intent').textContent=selections.map(s=>motionName(s.key)+' / 学习码'+s.code+' / 类内概率'+s.probability.toFixed(3)).join('\n');
   if(dialogue){await dialogue.receive({...plan,input_text:text},()=>ticket===revision,selections);if(ticket!==revision)return;}
   $('status').textContent='中文理解 '+plan.seconds.toFixed(2)+'秒';if(plan.operation!=='chat'||(dialogue&&plan.supported!==false))play();
   if($('speak').checked&&plan.reply.trim())void speech.speak(plan.reply);
  }catch(e){if(ticket===revision&&e.name!=='AbortError')$('status').textContent=e.message;}finally{if(ticket===revision){pending=null;dialogue?.pending(false);$('send').disabled=false;$('send').textContent=sendLabel;const next=queue.shift();if(next)void send(next.text).finally(next.resolve);}}
 }
 return {session,send,proactive,cancel,state:()=>({lastPlan,selections}),reset(){cancel();context=[];lastPlan=null;selections=[];}};
}
