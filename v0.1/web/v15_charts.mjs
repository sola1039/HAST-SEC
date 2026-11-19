export const rotationAngle=(a,b)=>2*Math.acos(Math.min(1,Math.abs(a.reduce((s,v,i)=>s+v*b[i],0))))*180/Math.PI;
export function seriesChart(host,title,channels,unit){
 const figure=document.createElement('figure'),label=document.createElement('figcaption'),canvas=document.createElement('canvas');label.textContent=title;figure.append(label,canvas);host.append(figure);canvas.setAttribute('aria-label',title+'实时曲线');canvas.setAttribute('role','img');
 const colors=['#176fc2','#db8c1b','#6b59c9'],ctx=canvas.getContext('2d');
 let latest=[];const observer=new ResizeObserver(()=>draw(latest));observer.observe(figure);window.addEventListener('pagehide',()=>observer.disconnect(),{once:true});
 function draw(rows){
  if(!figure.clientWidth)return;
  const width=Math.max(100,figure.clientWidth),height=90;canvas.width=width*2;canvas.height=height*2;canvas.style.height=height+'px';ctx.setTransform(2,0,0,2,0,0);ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);
  const end=rows.at(-1)?.time??0,start=end-15;Object.assign(canvas.dataset,{samples:rows.length,first:rows[0]?.time??'',last:rows.at(-1)?.time??'',windowSeconds:15});
  const values=rows.flatMap(r=>channels.map(c=>r[c.key])),lo=Math.min(0,...values),hi=Math.max(lo+1,...values),left=38,right=width-8,top=27,bottom=height-19;
  ctx.font='9px system-ui';ctx.fillStyle='#64758c';ctx.fillText(hi.toFixed(1)+' '+unit,4,24);ctx.fillText(lo.toFixed(1),4,bottom);
  ctx.strokeStyle='#dce4ef';ctx.lineWidth=.5;for(let i=0;i<4;i++){const y=top+(bottom-top)*i/3;ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(right,y);ctx.stroke();}
  channels.forEach((c,i)=>{ctx.fillStyle=colors[i];ctx.fillText(c.label,8+i*(width-8)/channels.length,11);ctx.strokeStyle=colors[i];ctx.lineWidth=1.3;ctx.beginPath();rows.forEach((r,j)=>{const x=left+(right-left)*(r.time-start)/15,y=bottom-(bottom-top)*(r[c.key]-lo)/(hi-lo);if(j)ctx.lineTo(x,y);else ctx.moveTo(x,y);});ctx.stroke();});
  ctx.fillStyle='#64758c';ctx.fillText('-15秒',left,height-3);ctx.fillText('现在',right-22,height-3);
 }
 return rows=>{latest=rows;draw(rows);};
}

