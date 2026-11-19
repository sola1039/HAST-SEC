// 沿用第九版学习概率与原始动作. 行为名称不冒充已训练的状态条件.
export function basePolicy(conditional=null){
 let intent={name:'静止',motion:0,rest:true},speaking=false,listening=false,runtime=null,last=null,locked=null,queued=null,elapsed=0,conversationUntil=0;
 const effective=()=>locked??{intent:listening?{name:'静止',motion:0,rest:true}:intent,speaking:!listening&&(speaking||elapsed<conversationUntil),listening};
 // 局部覆盖期间只锁住原型切换, 不缩放未覆盖关节或改变骨骼姿态.
 const policy=i=>locked&&last&&i!==locked.token?0:1;
 function attach(data){runtime=conditional?conditional.create(data,()=>({...effective(),locked:!!locked})):data.create();last=null;}
 function apply(value){if(!value.change)return;if(locked){queued=value;return;}intent={name:value.rest?'静止':value.name,motion:value.motion,rest:value.rest};}
 function setSpeaking(value){if(typeof value!=='boolean')throw Error('说话事件必须为布尔值.');speaking=value;}
 function lock(value){
  if(value&&!locked&&last)locked={intent:{...intent},speaking:speaking||elapsed<conversationUntil,token:last.token};
  else if(!value&&locked){locked=null;if(queued){const value=queued;queued=null;apply(value);}}
 }
 function sample(dt){if(!runtime)throw Error('底座尚未装载.');elapsed+=dt;last=runtime.sample(dt);return last;}
 return {policy,attach,apply,setSpeaking,setListening(value){listening=!!value;},setConversing(seconds){if(!Number.isFinite(seconds)||seconds<0||seconds>60)throw Error('交流时长无效.');conversationUntil=elapsed+seconds;},lock,sample,state:()=>{const s=effective();return {name:s.speaking?'聊天':s.intent.name,speaking,listening,conversing:elapsed<conversationUntil,rest:s.intent.rest&&!s.speaking,motion:s.intent.motion,locked:!!locked,queued:queued?.name??null,motion_gain:1,body_policy:conditional?'强化训练的底座选择':'第九版原始学习概率',state_condition_trained:!!conditional,selection:runtime?.selection?.()};},reset(data){intent={name:'静止',motion:0,rest:true};speaking=false;listening=false;locked=null;queued=null;elapsed=0;conversationUntil=0;attach(data);}};
}
