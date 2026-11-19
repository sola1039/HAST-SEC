export function resourceGauges(host){
 const panel=document.createElement('section');panel.className='resource-panel';const title=document.createElement('h2');title.textContent='实时资源占用';const gauges=document.createElement('div');gauges.className='resource-gauges';const cards=[];
 for(const name of ['运行内存','运行资源存储']){const card=document.createElement('div');card.className='resource-card';const ring=document.createElement('div');ring.className='resource-ring';const value=document.createElement('strong');value.textContent='采样中';ring.append(value);const label=document.createElement('span');label.textContent=name;card.append(ring,label);gauges.append(card);cards.push({ring,value});}
 const note=document.createElement('p');note.className='resource-note';note.textContent='正在读取本机资源.';panel.append(title,gauges,note);host.append(panel);
 let timer=null,request=null,closed=false;
 const size=bytes=>bytes>=1024**3?(bytes/1024**3).toFixed(2)+' GiB':(bytes/1024**2).toFixed(1)+' MiB';
 async function sample(){
  if(closed||document.hidden)return;request=new AbortController();const timeout=setTimeout(()=>request?.abort(),4000);
  try{const response=await fetch('/v15-api/resources',{signal:request.signal,cache:'no-store'});if(!response.ok)throw Error('资源读取失败.');const data=await response.json(),heap=performance.memory?.usedJSHeapSize??null,known=data.language_rss_bytes!==null,memory=data.service_rss_bytes+(data.language_rss_bytes??0)+(heap??0);
   [known?memory:null,data.storage_bytes].forEach((bytes,i)=>{cards[i].value.textContent=bytes===null?'暂不可用':size(bytes);cards[i].ring.style.setProperty('--fill',bytes===null?'0deg':Math.min(360,360*bytes/(2*1024**3))+'deg');});
   note.textContent='内存: '+(heap===null?'服务工作集':'页面JS堆 + 服务工作集')+', 含已启动的中文推理进程, 不含完整浏览器及显存. 存储: 中文权重、动作运行数据与角色, 不含历史训练素材和运行库. 刻度上限2 GiB.';
  }catch(e){if(!closed&&!document.hidden){cards.forEach(c=>c.value.textContent='暂不可用');note.textContent='资源采样暂不可用, 请稍后重试.';}}
  finally{clearTimeout(timeout);request=null;if(!closed&&!document.hidden)timer=setTimeout(sample,3000);}
 }
 function visibility(){clearTimeout(timer);request?.abort();if(!document.hidden&&!request)sample();}
 document.addEventListener('visibilitychange',visibility);window.addEventListener('pagehide',()=>{closed=true;clearTimeout(timer);request?.abort();document.removeEventListener('visibilitychange',visibility);},{once:true});sample();
}
