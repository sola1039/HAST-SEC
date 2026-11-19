import {checkV9} from '../motion/v9/config.mjs';
const controls=[['strength','软边界强度',0,1,.05,'超出关节可行范围的惩罚权重'],['region_strength','历史区域强度',0,1,.05,'素材分布对姿态修正的约束权重'],['inertia_body','躯干惯性',1,12,.5,'越大越抑制躯干快速变化'],['inertia_arms','手臂惯性',1,12,.5,'越大越抑制手臂非连续变化'],['body_hz','躯干基础截止频率',.3,1.6,.05,'赫兹, 越低越平滑但响应更慢'],['arms_hz','手臂基础截止频率',.3,2,.05,'赫兹, 控制小幅手臂动作的平滑'],['arms_max_hz','手臂最大截止频率',2,8,.1,'赫兹, 控制大幅运动时的响应上限'],['hands_hz','手腕基础截止频率',.3,2,.05,'赫兹, 抑制手腕细微抖动']];
export function tuningPanel(host,view,defaults){
 let current=structuredClone(defaults);const details=document.createElement('details'),summary=document.createElement('summary'),grid=document.createElement('div'),inputs=new Map(),message=document.createElement('p');summary.textContent='展开临时调参, 对比控制效果';grid.className='tuning-grid';
 const smooth=key=>key.endsWith('_hz');
 for(const [key,name,min,max,step,meaning]of controls){const label=document.createElement('label'),title=document.createElement('span'),slider=document.createElement('input'),value=document.createElement('output'),help=document.createElement('small');title.textContent=name;help.textContent=meaning;Object.assign(slider,{type:'range',min,max,step,value:smooth(key)?current.output_smoothing[key]:current[key]});value.textContent=slider.value;slider.oninput=()=>value.textContent=slider.value;label.append(title,value,slider,help);grid.append(label);inputs.set(key,{slider,value});}
 const apply=document.createElement('button'),restore=document.createElement('button');apply.textContent='暂停并应用参数';restore.textContent='恢复默认参数';
 function commit(next){try{checkV9(next);window.languageV13?.pause();view.configure(next);current=structuredClone(next);window.languageV13?.reset();message.textContent='参数已应用并重置暂停, 点击开始后查看新的曲线. 本页刷新后恢复默认.';}catch(e){message.textContent=e.message;}}
 apply.onclick=()=>{const next=structuredClone(current);for(const [key,{slider}]of inputs){const v=Number(slider.value);if(smooth(key))next.output_smoothing[key]=v;else next[key]=v;}commit(next);};
 restore.onclick=()=>{commit(structuredClone(defaults));for(const [key,{slider,value}]of inputs){slider.value=smooth(key)?defaults.output_smoothing[key]:defaults[key];value.textContent=slider.value;}};
 message.textContent='仅调整本页软约束和平滑响应, 不改中文规划、模型权重或硬性可行性上限. 应用时暂停并清空旧时序, 避免历史状态与新参数混用.';details.append(summary,grid,apply,restore,message);host.append(details);
}
