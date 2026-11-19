// The showcase's look: a matte porcelain mannequin in soft room light, a clean floor with a soft shadow that follows the feet.
import * as T from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';

const FLOOR_SIZE=12;  // the floor plane the body view makes (its grid is hidden)
// one porcelain family: the trunk a little warmer, the hands and feet a little deeper
const TONES=[[/^head|^neck/,0xe8cdb8],[/^thorax|^abdomen|^pelvis|^clavicle/,0xe2c3ab],[/^hand|^foot|^toes/,0xd2ae95]];
const LIMB=0xdfc1aa;
const tone=name=>(TONES.find(([re])=>re.test(name))?.[1])??LIMB;

// a round shadow: dark in the middle, gone at the edge
function shadowTexture(){
 const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');
 const r=g.createRadialGradient(64,64,0,64,64,64);r.addColorStop(0,'rgba(60,40,30,.55)');r.addColorStop(.55,'rgba(60,40,30,.18)');r.addColorStop(1,'rgba(60,40,30,0)');
 g.fillStyle=r;g.fillRect(0,0,128,128);return new T.CanvasTexture(c);
}

export function applyLook({scene,renderer,view}){
 renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
 const pmrem=new T.PMREMGenerator(renderer);
 scene.environment=pmrem.fromScene(new RoomEnvironment(),.04).texture;scene.environmentIntensity=.32;pmrem.dispose();
 scene.traverse(o=>{
  if(o.isGridHelper)o.visible=false;
  else if(o.isMesh&&o.geometry?.parameters?.width===FLOOR_SIZE)o.material=new T.MeshStandardMaterial({color:0xe8dacb,roughness:1,metalness:0});
 });
 for(const m of view.meshes){
  if(m.userData.body===0)continue;
  m.material=new T.MeshPhysicalMaterial({color:tone(m.userData.name),roughness:.52,metalness:0,clearcoat:.3,clearcoatRoughness:.55,sheen:.35,sheenRoughness:.6,sheenColor:new T.Color(0xfff2e8)});
  m.userData.base=m.material.color.clone();
 }
 const blob=new T.Mesh(new T.PlaneGeometry(.85,.85),new T.MeshBasicMaterial({map:shadowTexture(),transparent:true,depthWrite:false}));
 blob.rotation.x=-Math.PI/2;blob.position.y=.003;blob.renderOrder=1;scene.add(blob);
 // the soft shadow under the body, at its pelvis, fainter as it rises
 return{update(x,y,z){blob.position.x=x;blob.position.z=z;blob.material.opacity=Math.max(.15,Math.min(1,1.6-y*.8));}};
}

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
