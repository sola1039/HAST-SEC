import {dialogueBubble,BUBBLE_PAGE_SECONDS} from './dialogue_bubble.mjs';
import {analysisDashboard} from './v15_dashboard.mjs';
export function dialogueController({view,assets,policy,history,behavior,layers,pose}){
 const css=document.createElement('link');css.rel='stylesheet';css.href='/web/dialogue_bubble.css';document.head.append(css);
 const form=document.getElementById('command'),chatDock=document.createElement('footer');chatDock.className='lumen-chat-dock';document.body.append(chatDock);chatDock.append(form);form.querySelector('label').firstChild.textContent='与流明聊天';document.getElementById('text').placeholder='聊聊天, 或告诉流明你想做什么...';
 chatDock.append(document.getElementById('status'));if(new URLSearchParams(location.search).get('debug')==='1')document.body.classList.add('debug-visible');
 const dashboard=analysisDashboard(view,behavior,pose,layers);document.body.classList.add('lumen-analysis');
 const bubble=dialogueBubble();let remaining=0,presentation=null,lastFace='',waiting=false,userWaiting=false,spontaneous=false,active=()=>false,request=null,previous=null,time=0,next=0;
 const listen=()=>behavior.setListening(userWaiting||(!spontaneous&&remaining>0&&presentation?.engagement==='brief'));
 function face(expression,strength){const key=expression+':'+strength;if(key!==lastFace){view.faceOptions({enabled:true,expression,strength,blinking:true});lastFace=key;}}
 return {bind(fn,isActive){request=fn;active=isActive;},pending(value,self=false){waiting=value;userWaiting=value&&!self;listen();},async receive(plan,current=()=>true,selections=[]){
  dashboard.message(plan,selections);bubble.show(plan.reply);if(!plan.reply.trim()){remaining=0;presentation=null;return;}presentation={...(plan.presentation??{expression:'friendly',gesture:'none',engagement:'brief'})};
  const length=[...new Intl.Segmenter('zh',{granularity:'grapheme'}).segment(plan.reply)].length;
  if(length<=40)presentation.engagement='brief';remaining=Math.min(60,Math.max(5,bubble.state().pages.length*BUBBLE_PAGE_SECONDS));spontaneous=!!plan.proactive;userWaiting=false;listen();
  face(presentation.expression,.75);
  if(plan.operation!=='chat'||plan.supported===false)return;
  if(presentation.engagement==='conversation')behavior.setConversing(remaining);
  if(presentation.gesture!=='none'){
   const side=presentation.gesture==='left_wave'?'left':'right',entry=assets.entries.get(side+'-挥手打招呼');
   if(!entry)throw Error('问候技能未加载.');await assets.load(entry);if(!current())return;
   const selected=policy.select(entry,history());layers.add(selected.entry,{speed:1,strength:1,hold:0,delay:0,...selected.options},pose());behavior.lock(layers.active());
  }
 },step(dt){dashboard.step(dt);time+=dt;remaining=Math.max(0,remaining-dt);listen();const kind=behavior.state().selection?.kind;
  if(active()){if(kind==='chat'&&previous!=='chat'&&!waiting&&!remaining&&!layers.active()&&time>=next){next=time+20;void request?.();}previous=kind;}
  if(remaining>0)return;face(kind==='activity'?'happy':kind==='chat'?'friendly':'neutral',kind==='activity'?.6:kind==='chat'?.7:.4);
 },brief:()=>remaining>0&&presentation?.engagement==='brief',state:()=>({...bubble.state(),presentation,remaining,waiting,spontaneous}),reset(){remaining=0;presentation=null;waiting=false;userWaiting=false;spontaneous=false;previous=null;time=0;next=0;listen();dashboard.reset();bubble.reset();face('neutral',.4);}};
}
