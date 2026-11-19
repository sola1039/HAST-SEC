import {dialoguePages} from './dialogue_pages.mjs';
export const BUBBLE_PAGE_SECONDS=3.5;
export function dialogueBubble(){
 const host=document.getElementById('beat-stage'),box=document.createElement('div');box.className='lumen-bubble';box.hidden=true;
 const name=document.createElement('strong');name.textContent='流明';const body=document.createElement('div');body.className='bubble-lines';body.setAttribute('aria-live','polite');
 const lines=Array.from({length:3},()=>{const line=document.createElement('div');body.append(line);return line;});
 const bar=document.createElement('nav'),count=document.createElement('span');bar.setAttribute('aria-label','回复页码');bar.append(count);box.append(name,body,bar);host.append(box);
 const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');let text='',pages=[],index=0,lastWidth=0,timer=null;
 function cancel(){clearTimeout(timer);timer=null;}
 function schedule(){cancel();if(box.hidden)return;timer=setTimeout(()=>{if(index<pages.length-1){index++;render();schedule();}else{box.hidden=true;cancel();}},BUBBLE_PAGE_SECONDS*1000);}
 function render(){lines.forEach((line,i)=>line.textContent=(pages[index]?.[i]??'').replace(/\r?\n$/,''));count.textContent=(index+1)+' / '+pages.length;}
 function layout(){if(!text)return;const width=body.clientWidth;if(!width)return;lastWidth=width;ctx.font=getComputedStyle(body).font;pages=dialoguePages(text,width,s=>ctx.measureText(s).width);index=Math.min(index,pages.length-1);render();}
 const observer=new ResizeObserver(()=>{if(body.clientWidth!==lastWidth)layout();});observer.observe(body);
 function reset(){cancel();text='';pages=[];index=0;box.hidden=true;}
 return {show(value){if(!value?.trim()){reset();return;}cancel();text=value;index=0;box.hidden=false;layout();schedule();},reset,state:()=>({text,pages,index,visible:!box.hidden}),dispose(){cancel();observer.disconnect();box.remove();}};
}
