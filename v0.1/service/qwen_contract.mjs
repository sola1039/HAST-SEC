export function qwenContract(){
 const intent={type:'object',properties:{side:{type:'string',enum:['左','右']},action:{type:'string',enum:['上抬','下放','前伸','后移','左移','右移','摆臂','自然活动','保持不动']},height:{type:'string',enum:['默认','齐平头部','高于头顶']},幅度:{type:'number'},速度:{type:'number'},hold:{type:'number'},delay:{type:'number'}},required:['side','action','height','幅度','速度','hold','delay'],additionalProperties:false};
 const base={type:'object',properties:{change:{type:'boolean'},name:{type:'string'},motion:{type:'number'},rest:{type:'boolean'}},required:['change','name','motion','rest'],additionalProperties:false};
 const schema={type:'object',properties:{reply:{type:'string'},operation:{type:'string',enum:['command','release','chat','unsupported']},base,intents:{type:'array',items:intent,maxItems:4}},required:['reply','operation','base','intents'],additionalProperties:false};
 const unchanged={change:false,name:'保持',motion:.3,rest:false},move=(side,action='上抬',height='默认',{speed=1,strength=1,...p}={})=>({side,action,height,幅度:strength,速度:speed,hold:2,delay:0,...p});
 const example=(text,intents=[],operation='command',b=unchanged)=>[{role:'user',content:text},{role:'assistant',content:JSON.stringify({reply:'好的.',operation,base:b,intents})}];
 const examples=[
  ...example('举起右手',[move('右')]),...example('把左手举到头顶上面',[move('左','上抬','高于头顶')]),
  ...example('右手升到脑袋那么高',[move('右','上抬','齐平头部')]),
  ...example('左臂抬高至与脑袋平齐即可',[move('左','上抬','齐平头部')]),
  ...example('左臂往高处抬, 右臂维持原样',[move('左'),move('右','保持不动')]),
  ...example('右手抬小一点, 左手别动',[move('右','上抬','默认',{strength:.5}),move('左','保持不动')]),
  ...example('左臂慢慢往前伸',[move('左','前伸','默认',{speed:.6})]),
  ...example('把右手向后移动',[move('右','后移')]),...example('摆动左胳膊',[move('左','摆臂')]),
  ...example('左臂朝左侧伸展',[move('左','左移')]),...example('右臂朝右侧伸展',[move('右','右移')]),
  ...example('右臂向前伸一点点',[move('右','前伸','默认',{strength:.4})]),
  ...example('两只手一起举过头',[move('左','上抬','高于头顶'),move('右','上抬','高于头顶')]),
  ...example('先举右手, 再举左手',[move('右'),move('左','上抬','默认',{delay:6})]),
  ...example('先举左手, 然后放下',[move('左'),move('左','下放','默认',{delay:6})]),
  ...example('右臂抬起后慢慢放低',[move('右'),move('右','下放','默认',{speed:.6,delay:6})]),
  ...example('放下吧',[],'release'),...example('保持安静站着',[],'command',{change:true,name:'静止',motion:0,rest:true}),
  ...example('自然活动一下',[],'command',{change:true,name:'自然活动',motion:.45,rest:false}),
  ...example('停止当前动作',[],'release'),...example('站好保持安静',[],'command',{change:true,name:'静止',motion:0,rest:true}),
  ...example('我今天很开心',[],'chat'),...example('给我表演后空翻',[],'unsupported')
 ];
 const prompt='你是中文运动意图解析模型. 每条请求独立理解, 不复制最近示例动作. 输出JSON. 左右均指角色自身, 侧别side与空间方向action独立: 左移是朝左方向, 右移是朝右方向, 前伸是朝前方向, 后移是朝后方向. height与action独立: 与头一样高或平齐为齐平头部, 超过头或在头上方为高于头顶, 未要求高度用默认. 幅度与速度独立: 小幅只降低幅度, 慢速只降低速度; 正常幅度和速度都为1. 不改变的部位用保持不动或省略. delay是每条动作相对于本次请求的开始时间, 有先后则后续动作delay更大, 一起做则delay相同. 用户要求取消当前动作或整体放下用release, intents为空. 用户要求静止站立用command, base.change=true,rest=true,motion=0,intents为空. 普通聊天或只讨论动作是chat. 能力仅限手臂方向移动, 举高, 放低, 摆臂, 静止和自然活动. 后空翻等不属于这些能力的请求用unsupported且intents为空, 禁止用别的动作代替. 普通聊天不改base. command必须有动作或base.change=true. 速度0.4到2, 幅度0到1, hold 0到20秒, delay 0到30秒. 回复简短中文.';
 return {schema,prompt,examples};
}
