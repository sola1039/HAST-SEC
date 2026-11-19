// 使用角色实际顶点形态键构造B转置B, 不猜测FLAME系数的语义.
export function morphMetric(vrm,names){
  const meshes=new Map(),n=names.length;
  names.forEach((name,i)=>{for(const bind of vrm.expressionManager.getExpression(name)?.binds??[]){
    if(!bind.primitives||!Number.isInteger(bind.index)||!Number.isFinite(bind.weight))continue;
    for(const mesh of bind.primitives){
      const attr=mesh.geometry.morphAttributes.position?.[bind.index],base=mesh.geometry.getAttribute('position');if(!attr)continue;
      if(!meshes.has(mesh))meshes.set(mesh,Array.from({length:n},()=>new Float64Array(attr.count*3)));
      const row=meshes.get(mesh)[i];
      for(let j=0;j<attr.count;j++)for(let a=0;a<3;a++){const get=['getX','getY','getZ'][a],delta=attr[get](j)-(mesh.geometry.morphTargetsRelative?0:base[get](j));row[j*3+a]+=delta*bind.weight;}
    }
  }});
  const gram=Array.from({length:n},()=>Array(n).fill(0));let vertices=0;
  for(const rows of meshes.values()){vertices+=rows[0].length/3;for(let i=0;i<n;i++)for(let j=0;j<=i;j++){let s=0;for(let k=0;k<rows[i].length;k++)s+=rows[i][k]*rows[j][k];gram[i][j]+=s;if(i!==j)gram[j][i]+=s;}}
  const scale=Math.max(...gram.map((r,i)=>r[i]),1e-9);gram.forEach((r,i)=>r.forEach((_,j)=>r[j]=r[j]/scale+(i===j?.01:0)));
  return {gram,vertices,channels:n,kind:'实际VRM形态键顶点距离与权重正则化',flame_calibrated:false};
}
