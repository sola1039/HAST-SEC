// Download progress for the first load on a slow network: the physics engine and the controller's data, counted as they arrive.
export const mb=b=>(b/1048576).toFixed(1);

// sizes of the large files (model/manifest.json, written by the release build); null when it cannot be read
export async function manifest(){
 try{const r=await fetch('./model/manifest.json');return r.ok?(await r.json()).files:null;}catch{return null;}
}

// the body of a response, passed on as it is read; onBytes(n) for every chunk
function counted(response,onBytes){
 if(!response.ok||!response.body)return response;
 const reader=response.body.getReader();
 const body=new ReadableStream({async pull(c){const {done,value}=await reader.read();if(done){c.close();return;}onBytes(value.byteLength);c.enqueue(value);},cancel(r){reader.cancel(r);}});
 return new Response(body,{status:response.status,statusText:response.statusText,headers:response.headers});
}

export async function fetchBytes(url,onBytes){
 const r=counted(await fetch(url),onBytes);
 if(!r.ok)throw Error(`${url}: ${r.status}`);
 return r.arrayBuffer();
}

// run load() with every fetch it makes counted (the controller's loader fetches its files itself)
export async function withCountedFetch(onBytes,load){
 const plain=globalThis.fetch;
 globalThis.fetch=async(...a)=>counted(await plain(...a),onBytes);
 try{return await load();}finally{globalThis.fetch=plain;}
}
