// 仅转换千问已经预测的语义字段. 不读取、搜索或匹配用户原文.
export function compileSlots(plan,{parts=false}={}){
 const motions={'上抬':'向上抬高','下放':'向下放低','前伸':'向前移动','后移':'向后移动','左移':'向左移动','右移':'向右移动','摆臂':'摆动手臂','自然活动':'小幅自然活动'},sides={'左':'left','右':'right'};
 const slots=plan.intents;
 const intents=slots.filter(r=>r.action!=='保持不动').map(({side,action,height,part,幅度,速度,...parameters})=>{if(parts&&!['手臂','腿'].includes(part))throw Error('中文模型缺少有效身体部位.');if(part==='腿'&&action!=='上抬')throw Error('这个腿动作尚未学会, 没有替换为手臂.');const motion=part==='腿'?'抬腿':action==='挥手'?'挥手打招呼':action==='上抬'?{'默认':'向上抬高','齐平头部':'向上抬到头部高度','高于头顶':'向上举过头部'}[height]:motions[action];return {key:sides[side]+'-'+motion,strength:幅度,speed:速度,...parameters};}).sort((a,b)=>a.delay-b.delay);
 // 时序由模型给出的开始时间决定, 不让两个冗余字段互相矛盾.
 const timing=new Set(intents.map(i=>i.delay)).size>1?'依次':'同时';
 return {...plan,timing,slots,intents};
}
