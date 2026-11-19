// The showcase's look: a girl in a dress (rose top and skirt, bare arms and legs, small shoes, a dark bob) in soft room light on a
// warm wooden floor, with a soft shadow that follows the feet. The skirt and the hair are drawn only; the physics does not know them.
import * as T from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';

const FLOOR_SIZE=12;  // the floor plane the body view makes (its grid is hidden)
// a dress: a rose top with short sleeves and a skirt (drawn only, on the pelvis), bare arms and legs, small shoes, a dark bob
const SKIN=0xf0c8ad,DRESS=0xc98196,SHOES=0x6e3434,HAIR=0x4a3226;
const OUTFIT=[[/^head|^neck|^forearm|^hand|^thigh|^shank/,SKIN],[/^thorax|^abdomen|^clavicle|^upperarm|^pelvis/,DRESS],[/^foot|^toes/,SHOES]];
// the skirt in the pelvis frame (y up, z front, m): from the waist to mid-thigh, wide enough for a step
const SKIRT={top:.08,bottom:-.195,rTop:.105,rBottom:.19,depth:.86};
// the hair in the head frame: around the head's ellipsoid (centre, radii), a little larger; a fringe on top, the face left open
const HEAD={c:[0,.07,.016],r:[.074,.084,.07],grow:1.1,back:-.006,up:.006,fringe:.36*Math.PI,nape:.8*Math.PI,face:1.05};
const tone=name=>(OUTFIT.find(([re])=>re.test(name))?.[1])??SKIN;

// a round shadow: dark in the middle, gone at the edge
function shadowTexture(){
 const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');
 const r=g.createRadialGradient(64,64,0,64,64,64);r.addColorStop(0,'rgba(60,40,30,.55)');r.addColorStop(.55,'rgba(60,40,30,.18)');r.addColorStop(1,'rgba(60,40,30,0)');
 g.fillStyle=r;g.fillRect(0,0,128,128);return new T.CanvasTexture(c);
}

function skirtMesh(){
 const g=new T.CylinderGeometry(SKIRT.rTop,SKIRT.rBottom,SKIRT.top-SKIRT.bottom,48,1,true);g.translate(0,(SKIRT.top+SKIRT.bottom)/2,0);g.scale(1,1,SKIRT.depth);
 return new T.Mesh(g,new T.MeshPhysicalMaterial({color:DRESS,roughness:.75,sheen:.6,sheenRoughness:.7,sheenColor:new T.Color(0xffffff),side:T.DoubleSide}));
}
function hairMesh(){
 const mat=new T.MeshPhysicalMaterial({color:HAIR,roughness:.55,sheen:.5,sheenRoughness:.5,sheenColor:new T.Color(0x9b7a64),side:T.DoubleSide});
 const front=Math.PI/2,group=new T.Group();
 // the crown and fringe all round, then the back and sides down to the nape, open in front for the face
 group.add(new T.Mesh(new T.SphereGeometry(1,40,16,0,2*Math.PI,0,HEAD.fringe),mat));
 group.add(new T.Mesh(new T.SphereGeometry(1,40,16,front+HEAD.face,2*Math.PI-2*HEAD.face,HEAD.fringe,HEAD.nape-HEAD.fringe),mat));
 group.scale.set(...HEAD.r.map(r=>r*HEAD.grow));group.position.set(HEAD.c[0],HEAD.c[1]+HEAD.up,HEAD.c[2]+HEAD.back);
 const holder=new T.Group();holder.add(group);return holder;
}
// a drawn piece that follows body b of the physics (its frame each frame)
function follow(piece,b,data){
 piece.matrixAutoUpdate=false;
 const m=new T.Matrix4();
 return()=>{const p=data.xpos,r=data.xmat,i=3*b,k=9*b;m.set(r[k],r[k+1],r[k+2],p[i],r[k+3],r[k+4],r[k+5],p[i+1],r[k+6],r[k+7],r[k+8],p[i+2],0,0,0,1);piece.matrix.copy(m);piece.matrixWorldNeedsUpdate=true;};
}

export function applyLook({scene,renderer,view,sim}){
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
 const skirt=skirtMesh(),hair=hairMesh();
 for(const piece of [skirt,hair]){piece.traverse(o=>{if(o.isMesh)o.castShadow=true;});scene.add(piece);}
 const pose=[follow(skirt,sim.model.body('pelvis').id,sim.data),follow(hair,sim.model.body('head').id,sim.data)];
 // the soft shadow under the body, at its pelvis, fainter as it rises; the skirt and the hair on the pelvis and the head
 return{update(x,y,z){blob.position.x=x;blob.position.z=z;blob.material.opacity=Math.max(.15,Math.min(1,1.6-y*.8));for(const p of pose)p();}};
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
