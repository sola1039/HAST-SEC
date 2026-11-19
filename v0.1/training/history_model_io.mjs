// 独立小分片, 避免大JSON与重复原始视频. 读写两端使用同一顺序.
export async function writeHistoryModel(folder,model,metrics,fs){
  const groups=[];for(let i=0;i<model.dim;i+=24){const part={begin:i,weights:model.weights.slice(i,i+24),variance:model.validation.variance.slice(i,i+24)},name='parameters-'+groups.length+'.json',text=JSON.stringify(part);if(text.length>5000)throw Error('历史模型分片超过上限.');await fs.writeFile(folder+name,text);groups.push(name);}
  const compact=group=>({...group,variance:undefined});
  const meta={...model,weights:undefined,training:compact(model.training),validation:compact(model.validation),parts:groups};
  for(const [name,value]of [['index',meta],['metrics',{...metrics,training:compact(model.training),validation:compact(model.validation)}]]){const text=JSON.stringify(value);if(text.length>5000)throw Error('历史模型清单超过上限.');await fs.writeFile(folder+name+'.json',text);}
}
export async function readHistoryModel(prefix,read){
  const meta=await read(prefix+'index.json');if(!Array.isArray(meta.parts)||meta.parts.length>30||meta.parts.some(n=>!/^parameters-\d+\.json$/.test(n)))throw Error('历史模型索引无效.');
  const rows=await Promise.all(meta.parts.map(n=>read(prefix+n))),weights=[],variance=[];
  for(const part of rows){if(part.begin!==weights.length||part.weights.length!==part.variance.length||part.weights.some(r=>r.length!==5||r.some(v=>!Number.isFinite(v)))||part.variance.some(v=>!Number.isFinite(v)||v<0))throw Error('历史预测参数无效.');weights.push(...part.weights);variance.push(...part.variance);}
  if(weights.length!==meta.dim||meta.dim<meta.bones.length*3||meta.lags!==4||meta.rate!==20)throw Error('历史模型通道或时钟不一致.');
  return {...meta,weights,validation:{...meta.validation,variance}};
}
