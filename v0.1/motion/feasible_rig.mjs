import {Vector3,Quaternion} from 'three';
import {finiteQuaternion} from './feasible_math.mjs';
export function feasibleRig(controller){
  const names=[...controller.profile.bone_order],nodes=names.map(n=>controller.node(n)),ids=new Map(nodes.map((n,i)=>[n,i]));
  const parents=nodes.map((n,i)=>{
    if(i===0)return -1;
    let p=n.parent;
    while(p&&!ids.has(p)){
      if(p.quaternion.angleTo(new Quaternion())>1e-7)throw Error('附加骨骼需为标准静止姿态.');
      p=p.parent;
    }
    return ids.get(p)??-1;
  }),offsets=nodes.map((n,i)=>parents[i]<0?n.position.clone():nodes[parents[i]].worldToLocal(n.getWorldPosition(new Vector3()))),children=names.map(()=>[]);
  parents.forEach((p,i)=>{if(p>=i)throw Error('人体骨架不是父级优先的树.');if(p>=0)children[p].push(i);});
  if(parents.filter(p=>p<0).length!==1||names[0]!=='hips')throw Error('人体骨架根节点定义不一致.');
  const parent=nodes[0].parent,baseQ=parent.getWorldQuaternion(new Quaternion()),baseP=parent.getWorldPosition(new Vector3());
  const length=offsets.map(v=>v.length()),end=names.map((name,i)=>children[i].find(j=>!/(Eye|Thumb|Index|Middle|Little|Ring)/.test(names[j]))??children[i][0]??i);
  function fk(qs,root=offsets[0]){
    if(qs.length!==names.length||!root.toArray().every(Number.isFinite))throw Error('全身状态形状或根位置无效.');
    const p=[],q=[];
    for(let i=0;i<names.length;i++){
      const a=parents[i],orientation=a<0?baseQ:q[a],origin=a<0?baseP:p[a];
      p[i]=offsets[i].clone();if(a<0)p[i].copy(root);
      p[i].applyQuaternion(orientation).add(origin);q[i]=orientation.clone().multiply(finiteQuaternion(qs[i]));
    }
    return {p,q};
  }
  const neutral=nodes.map(n=>n.quaternion.clone()),rest=fk(neutral);
  const error=Math.max(...rest.p.map((p,i)=>p.distanceTo(nodes[i].getWorldPosition(new Vector3()))));
  if(error>1e-6)throw Error('正向运动学与角色骨架不一致.');
  function write(qs,root,expressions={}){nodes.forEach((n,i)=>n.quaternion.copy(qs[i]));nodes[0].position.copy(root);for(const [name,value]of Object.entries(expressions))if(controller.vrm.expressionManager?.getExpression(name))controller.vrm.expressionManager.setValue(name,value);controller.sync();}
  function audit(state){let error=0;for(let i=1;i<names.length;i++)error=Math.max(error,Math.abs(state.p[i].distanceTo(state.p[parents[i]])-length[i]));return error;}
  const index=name=>{const i=names.indexOf(name);if(i<0)throw Error('缺少人体节点: '+name+'.');return i;};
  return {names,nodes,parents,offsets,children,end,baseQ,baseP,rest,neutral,fk,write,audit,index,root:()=>nodes[0].position.clone()};
}
