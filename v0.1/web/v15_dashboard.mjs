import {seriesChart,rotationAngle as angle} from './v15_charts.mjs';
import {controlTelemetry,updateTiles} from './v15_controls.mjs';
import {resourceGauges} from './v15_resources.mjs';
export function analysisDashboard(view,behavior,pose,layers){
 const column=document.createElement('div');column.className='lumen-data-column';document.querySelector('main').append(column);const top=document.createElement('div');top.className='telemetry';column.append(top);const tiles={};
 for(const [id,name]of [['base','运行状态'],['language','中文响应时间'],['solve','姿态求解耗时'],['cost','优化目标值'],['support','重心支撑偏差'],['range','关节 / 骨长误差']]){const card=document.createElement('div'),label=document.createElement('small'),value=document.createElement('strong');label.textContent=name;value.textContent='等待采样';card.append(label,value);top.append(card);tiles[id]=value;}
 const strip=document.createElement('div');strip.className='metrics-strip';column.append(strip);resourceGauges(strip);
 const panel=document.createElement('section');panel.className='timeseries-panel';const title=document.createElement('h2');title.textContent='实时运动与优化';const readout=document.createElement('p');readout.className='series-readout';
 const plots=document.createElement('div');plots.className='series-grid';panel.append(title,readout,plots);strip.append(panel);
 const charts=[seriesChart(plots,'输入与最终输出角速度',[{key:'rawSpeed',label:'输入'},{key:'outSpeed',label:'最终输出'}],'度/秒'),seriesChart(plots,'左右手实际高度, 相对髋部',[{key:'left',label:'左手'},{key:'right',label:'右手'}],'厘米'),seriesChart(plots,'动态平滑截止频率',[{key:'bodyHz',label:'躯干'},{key:'armHz',label:'手臂'},{key:'handHz',label:'手腕'}],'赫兹'),seriesChart(plots,'局部动作蒙版权重',[{key:'leftMask',label:'左臂'},{key:'rightMask',label:'右臂'},{key:'legMask',label:'双腿'}],'权重')];
 charts.push(seriesChart(plots,'优化目标值',[{key:'initial',label:'初始'},{key:'solved',label:'求解后'},{key:'final',label:'平滑后'}],'目标值'));
 const controls=new URLSearchParams(location.search).get('debug')==='1'?controlTelemetry(view):{update(){},reset(){}};let rows=[],time=0,elapsed=0,lastRaw=null,lastOut=null;const ids=[0,1,2,3,4,7,8,9,10,11,12,13,30,31,32,33,34,35,36];
 function draw(data){charts.forEach(chart=>chart(data));controls.update(view.report(),data);readout.textContent='最近15秒 / '+data.length+'个采样 / 10赫兹';}
 return {message(plan){tiles.language.textContent=plan.seconds.toFixed(2)+'秒';},step(dt){
  time+=dt;elapsed+=dt;if(elapsed<.1||!pose())return;const a=view.audit(),s=view.report(),b=behavior.state(),raw=pose(),out=a.rotations.map(q=>q.map((v,i)=>i===0||i===2?v*view.direction:v)),smoothing=s.last?.output_smoothing?.joints??[],hz=n=>smoothing.find(j=>j.bone===n)?.cutoff_hz??0,m=layers.state().weights;
  const speed=(current,previous)=>previous?ids.reduce((sum,j)=>sum+angle(current[j],previous[j]),0)/ids.length/elapsed:0;
  const row={time,rawSpeed:speed(raw,lastRaw),outSpeed:speed(out,lastOut),left:100*(a.joints.leftHand[1]-a.joints.hips[1]),right:100*(a.joints.rightHand[1]-a.joints.hips[1]),bodyHz:hz('chest'),armHz:hz('leftUpperArm'),handHz:hz('leftHand'),leftMask:Math.max(...m.slice(7,11)),rightMask:Math.max(...m.slice(30,34)),legMask:Math.max(...m.slice(11,15),...m.slice(34,38)),initial:s.last?.initial_cost??0,solved:s.last?.pre_smoothing_cost??0,final:s.last?.final_cost??0,torque:s.last?.dynamics.max_joint_torque_Nm??0};rows.push(row);rows=rows.filter(r=>time-r.time<15).slice(-150);lastRaw=raw.map(q=>q.slice());lastOut=out;elapsed=0;
  updateTiles(tiles,s,b.selection);draw(rows);
 },reset(){rows=[];time=0;elapsed=0;lastRaw=null;lastOut=null;Object.values(tiles).forEach(t=>t.textContent='等待采样');controls.reset();draw(rows);}};
}
