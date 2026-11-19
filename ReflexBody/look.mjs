// The showcase's look: a dressed figure (skin, top, trousers, shoes) in soft room light on a warm wooden floor, with a soft shadow
// that follows the feet.
import * as T from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';

const FLOOR_SIZE=12;  // the floor plane the body view makes (its grid is hidden)
// an outfit, so she reads as a person against the floor: skin on the head, neck, forearms and hands, a blue top with sleeves to the
// elbows, navy trousers, dark shoes
const SKIN=0xf0c8ad;
const OUTFIT=[[/^head|^neck|^forearm|^hand/,SKIN],[/^thorax|^abdomen|^clavicle|^upperarm/,0x5b8fd0],[/^pelvis|^thigh|^shank/,0x3f4d6b],[/^foot|^toes/,0x2e2a2b]];
const tone=name=>(OUTFIT.find(([re])=>re.test(name))?.[1])??SKIN;

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
  else if(o.isMesh&&o.geometry?.parameters?.width===FLOOR_SIZE)o.material=new T.MeshStandardMaterial({color:0xd6c1a8,roughness:.9,metalness:0});
 });
 for(const m of view.meshes){
  if(m.userData.body===0)continue;
  const c=tone(m.userData.name),skin=c===SKIN;  // skin a little glossy, cloth matte with a soft sheen
  m.material=new T.MeshPhysicalMaterial({color:c,roughness:skin?.5:.75,metalness:0,clearcoat:skin?.2:0,clearcoatRoughness:.6,sheen:skin?.2:.6,sheenRoughness:.7,sheenColor:new T.Color(skin?0xffe9dc:0xffffff)});
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
