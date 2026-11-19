import {Quaternion,Vector3} from 'three';
export function upright(q,max){const up=new Vector3(0,1,0),v=up.clone().applyQuaternion(q),angle=v.angleTo(up),limit=max*Math.PI/180;return angle>limit?new Quaternion().setFromUnitVectors(v,up).slerp(new Quaternion(),limit/angle).multiply(q):q;}
const cross=(a,b,c)=>(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);
export function supportHull(points){const p=points.map(v=>v.clone()).sort((a,b)=>a.x-b.x||a.z-b.z),half=list=>{const h=[];for(const v of list){while(h.length>1&&cross(h[h.length-2],h[h.length-1],v)<=0)h.pop();h.push(v);}return h;},a=half(p),b=half([...p].reverse());return a.slice(0,-1).concat(b.slice(0,-1));}
export function supportProjection(point,hull){
  if(hull.length<3)throw Error('支撑区域退化.');if(hull.every((a,i)=>cross(a,hull[(i+1)%hull.length],point)>=-1e-10))return point.clone();
  let best=null,error=Infinity;for(const [i,a]of hull.entries()){const b=hull[(i+1)%hull.length],d=new Vector3(b.x-a.x,0,b.z-a.z),p=new Vector3(point.x-a.x,0,point.z-a.z),t=Math.max(0,Math.min(1,p.dot(d)/Math.max(1e-12,d.lengthSq()))),q=a.clone().addScaledVector(d,t);q.y=point.y;const e=Math.hypot(q.x-point.x,q.z-point.z);if(e<error){error=e;best=q;}}return best;
}
export function massProxy(controller){
  const rows=[['hips','neck',.498],['neck','head',.08]];for(const side of ['left','right'])rows.push([side+'UpperArm',side+'LowerArm',.028],[side+'LowerArm',side+'Hand',.016],[side+'Hand',side+'Hand',.006],[side+'UpperLeg',side+'LowerLeg',.1],[side+'LowerLeg',side+'Foot',.0465],[side+'Foot',side+'Toes',.0145]);
  const nodes=rows.map(([a,b,w])=>[controller.node(a),controller.node(b),w]);return ()=>nodes.reduce((sum,[a,b,w])=>sum.addScaledVector(a.getWorldPosition(new Vector3()).add(b.getWorldPosition(new Vector3())).multiplyScalar(.5),w),new Vector3());
}
