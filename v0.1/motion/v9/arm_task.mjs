import {Vector3} from 'three';
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
export function segmentDistance(a,b,c,d){
 const ux=b.x-a.x,uy=b.y-a.y,uz=b.z-a.z,vx=d.x-c.x,vy=d.y-c.y,vz=d.z-c.z,wx=a.x-c.x,wy=a.y-c.y,wz=a.z-c.z;
 const A=ux*ux+uy*uy+uz*uz,B=ux*vx+uy*vy+uz*vz,C=vx*vx+vy*vy+vz*vz,D=ux*wx+uy*wy+uz*wz,E=vx*wx+vy*wy+vz*wz,den=A*C-B*B;
 const distance=(s,t)=>Math.hypot(wx+s*ux-t*vx,wy+s*uy-t*vy,wz+s*uz-t*vz);
 if(C<1e-12)return distance(A<1e-12?0:clamp(-D/A),0);
 let s=A<1e-12?0:clamp(den>1e-12?(B*E-C*D)/den:0),t=(B*s+E)/C;
 if(t<0){t=0;s=A<1e-12?0:clamp(-D/A);}else if(t>1){t=1;s=A<1e-12?0:clamp((B-D)/A);}return distance(s,t);
}
export function armTask(rig,state,goal){
 const side=goal.bone.startsWith('right')?'right':'left',idx=n=>rig.index(n),P=n=>state.p[idx(n)],shoulder=P(side+'UpperArm'),elbow=P(side+'LowerArm'),wrist=P(side+'Hand'),up=new Vector3(0,1,0),width=rig.rest.p[idx('rightUpperArm')].distanceTo(rig.rest.p[idx('leftUpperArm')]);
 const upper=rig.offsets[idx(side+'LowerArm')].length(),torso=[P('hips'),P('neck'),width*.34],head=[P('head'),P('head').clone().addScaledVector(up,.10),width*.40],armRadius=Math.max(.018,upper*.10),segments=[[shoulder.clone().lerp(elbow,.25),elbow,armRadius],[elbow,wrist,armRadius],[wrist,wrist,.027]],clearances=[];
 for(const [a,b,r] of segments)for(const [c,d,R] of [torso,head])clearances.push(segmentDistance(a,b,c,d)-r-R);
 // X为标准化骨架的纵轴. 四元数取最短扭转, 不把相反符号误认为另一姿态.
 const twists=['Shoulder','UpperArm','LowerArm'].map(part=>{const i=idx(side+part),q=state.q[rig.parents[i]].clone().invert().multiply(state.q[i]);return 2*Math.atan2(Math.abs(q.x),Math.abs(q.w));}),limits=[20,35,35].map(d=>d*Math.PI/180);
 // 范围内没有代价; 超范围的二次残差在最小二乘中成为四次代价.
 const residual=[...twists.map((a,i)=>2*(Math.max(0,a-limits[i])/(30*Math.PI/180))**2),...clearances.map(v=>2*(Math.max(0,.005-v)/.03)**2)],hard=clearances.map(v=>Math.max(0,(-v-.002)/.03));
 const step=goal.previousHand?wrist.distanceTo(new Vector3().fromArray(goal.previousHand)):0;
 if(goal.maxStep){residual.push(Math.max(0,(step-.8*goal.maxStep)/(.2*goal.maxStep))**2);hard.push(Math.max(0,step/goal.maxStep-1));}
 return {residual,hard,metrics:{task_arm_twists_deg:twists.map(a=>a*180/Math.PI),task_arm_twist_soft_degrees:[20,35,35],task_hand_step_cm:step*100,task_min_body_clearance_m:Math.min(...clearances),task_max_body_penetration_m:Math.max(0,-Math.min(...clearances)),task_proxy_kind:'按骨架宽度估计的身体与头部胶囊, 不是衣服网格'}};
}
