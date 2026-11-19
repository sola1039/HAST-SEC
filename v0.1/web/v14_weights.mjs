export async function weights(name,prefix='/v14-data/'){
 const r=await fetch(prefix+name+'.json');if(!r.ok)throw Error('强化策略登记读取失败.');const meta=await r.json(),response=await fetch(prefix+name+'.bin');if(!response.ok)throw Error('强化策略权重读取失败.');
 const buffer=await response.arrayBuffer(),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer)),v=>v.toString(16).padStart(2,'0')).join('');if(hash!==meta.sha256||buffer.byteLength%4)throw Error('强化策略权重校验失败.');
 const values=new Float32Array(buffer);if(values.some(v=>!Number.isFinite(v))||name!=='idle'&&values.length!==meta.hidden*(meta.input+1)+meta.output*(meta.hidden+1))throw Error('强化策略权重形状或数值无效.');return {...meta,weights:values};
}
