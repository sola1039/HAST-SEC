// The pull's line on the showcase: from the held point on the body to the finger, thicker and deeper with the force, the force
// written by the finger.
import * as T from 'three';

// the pull's line: from the held point on the body to the finger, thicker and deeper with the force, the force written by the finger
export function createTether({tether,label,camera,canvas}){
 const line=tether.querySelector('line'),dot=tether.querySelector('circle'),p=new T.Vector3();
 return{
  draw(point,finger,force){
   if(!point){tether.classList.remove('is-on');label.classList.remove('is-on');return;}
   const b=canvas.getBoundingClientRect();p.fromArray(point).project(camera);
   const x=(p.x+1)/2*b.width,y=(1-p.y)/2*b.height,k=Math.min(1,force/200);
   line.setAttribute('x1',x);line.setAttribute('y1',y);line.setAttribute('x2',finger[0]);line.setAttribute('y2',finger[1]);
   dot.setAttribute('cx',x);dot.setAttribute('cy',y);
   tether.style.setProperty('--w',`${2+5*k}px`);tether.style.setProperty('--ring',`hsl(352 ${45+40*k}% ${66-22*k}%)`);tether.classList.add('is-on');
   label.textContent=`${Math.round(force)} 牛`;label.style.left=`${finger[0]}px`;label.style.top=`${finger[1]}px`;label.classList.add('is-on');
  }};
}
