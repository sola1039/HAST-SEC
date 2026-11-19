import {Vector3,Matrix4} from 'three';
// 标准骨骼head节点并非头顶. 测量头骨主导网格的上沿作为验收参照, 不向骨骼写入任何控制.
export function headReference(vrm,controller){
 const raw=vrm.humanoid.getRawBoneNode('head'),head=controller.node('head'),inverse=new Matrix4().copy(head.matrixWorld).invert();let highest=null,count=0;
 vrm.scene.traverse(mesh=>{
  if(!mesh.isSkinnedMesh)return;const id=mesh.skeleton.bones.indexOf(raw);if(id<0)return;
  const indices=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight;if(!indices||!weights)return;mesh.skeleton.update();
  for(let i=0;i<indices.count;i++){
   let weight=0;for(let k=0;k<4;k++)if(indices.getComponent(i,k)===id)weight+=weights.getComponent(i,k);if(weight<.5)continue;
   const point=mesh.getVertexPosition(i,new Vector3()).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse);count++;
   if(!highest||point.y>highest.y)highest=point;
  }
 });
 if(!highest||!count)throw Error('没有可测量的头部网格, 不使用头节点冒充头顶.');
 return ()=>({world:head.localToWorld(highest.clone()).toArray(),local:highest.toArray(),vertices:count,kind:'头骨主导网格上沿, 含头发'});
}
