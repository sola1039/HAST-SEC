import {solveLinear} from '../feasible_math.mjs';
// 所有残差使用同一计算函数, 包括动力学项. 变量用米和弧度分别缩放.
export function numericSystem(point,residual,variables,move,evaluate,damping,previous=null){
  const columns=previous??variables.map((v,i)=>{
    const candidate=move(point,i,1e-3),r=evaluate(candidate).residual;
    if(r.length!==residual.length)throw Error('第九版残差布局发生变化.');
    return r.map((x,j)=>(x-residual[j])/1e-3);
  });
  const n=variables.length,m=residual.length,matrix=Array.from({length:n},()=>Array(n).fill(0)),gradient=Array(n).fill(0);
  // J转置J严格对称. 同一内积只算一次, 保持原求解和约束, 不降低迭代次数.
  for(let i=0;i<n;i++){
    const a=columns[i];for(let k=0;k<m;k++)gradient[i]+=a[k]*residual[k];
    for(let j=i;j<n;j++){const b=columns[j];let sum=0;for(let k=0;k<m;k++)sum+=a[k]*b[k];matrix[i][j]=sum;matrix[j][i]=sum;}
  }
  matrix.forEach((row,i)=>row[i]+=damping*Math.max(row[i],1e-7));
  const step=solveLinear(matrix,gradient.map(x=>-x),1e-9);
  return {step,gradient:Math.hypot(...gradient),columns};
}
export function updateJacobian(columns,step,before,after){
  const norm=step.reduce((s,x)=>s+x*x,0);if(norm<1e-12)return null;
  const error=after.map((x,k)=>x-before[k]-columns.reduce((s,c,i)=>s+c[k]*step[i],0));
  return columns.map((c,i)=>c.map((x,k)=>x+error[k]*step[i]/norm));
}
