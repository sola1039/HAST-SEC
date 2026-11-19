export function lowLatency(session){
 let pending=null,promise=null,heartbeat=null;
 const output=document.getElementById('language-ready');
 async function prepare(){
  if(promise)return promise;pending=new AbortController();const owned=pending;output.textContent='正在预加载千问, 骨骼播放继续.';
  promise=(async()=>{
   for(let attempt=0;attempt<40;attempt++){
    owned.signal.throwIfAborted();
    const r=await fetch('/v13-api/warm',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({session}),signal:owned.signal}),v=await r.json();if(!r.ok)throw Error(v.error);
    if(v.runtime.ready&&!v.runtime.busy){output.textContent='千问已就绪, 使用独立显卡.';return v.runtime;}
    await new Promise(resolve=>setTimeout(resolve,250));
   }
   throw Error('千问预加载等待超时, 请稍后重试.');
  })().catch(e=>{if(e.name!=='AbortError'&&pending===owned)output.textContent=e.message;throw e;}).finally(()=>{if(pending===owned){pending=null;promise=null;}});
  return promise;
 }
 function keep(){clearInterval(heartbeat);void prepare().catch(()=>{});heartbeat=setInterval(()=>{void prepare().catch(()=>{});},30000);}
 function stop(){clearInterval(heartbeat);heartbeat=null;pending?.abort();pending=null;promise=null;output.textContent='千问已释放, 开始播放或聚焦输入框可预加载.';}
 return {prepare,keep,stop};
}
