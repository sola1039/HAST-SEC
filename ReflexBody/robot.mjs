// The showcase as a humanoid robot in a simulation scene: graphite and silver metal parts, a dark visor with a light strip, a chest
// light, joint rings; a checkered blue-grey ground under a gradient sky. The visor, lights and rings are drawn only and follow the
// body's parts each frame; the physics does not know them.
import * as T from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';

const FLOOR_SIZE=12;  // the floor plane the body view makes (its grid is hidden)
const GLOW=0x39c5ff;
const METAL={dark:0x2a2f37,silver:0xc4cad3,black:0x15171b};
const PART=[[/^thorax|^abdomen|^pelvis|^neck|^clavicle/,'dark'],[/^upperarm|^thigh/,'silver'],[/^forearm|^shank|^hand/,'dark'],[/^foot|^toes/,'black'],[/^head/,'dark']];
// the head's ellipsoid in its frame (centre, radii), for the visor
const HEAD={c:[0,.07,.016],r:[.074,.084,.07]};
// joint rings: at the origin of these parts' frames (shoulder, elbow, hip, knee), across their left-right axis
const RINGS=[['upperarm',.042],['forearm',.034],['thigh',.056],['shank',.044]];

function metal(kind){
 const c=METAL[kind];
 return new T.MeshPhysicalMaterial({color:c,metalness:kind==='silver'?.55:.45,roughness:kind==='black'?.8:kind==='silver'?.32:.4,clearcoat:kind==='black'?0:.6,clearcoatRoughness:.25});
}
const glow=(intensity=2.2)=>new T.MeshStandardMaterial({color:0x0b1a24,emissive:GLOW,emissiveIntensity:intensity,roughness:.4});

// the ground of a robot simulator: blue-grey checks with light edges, 0.5 m squares
function checkerTexture(){
 const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');
 for(let i=0;i<2;i++)for(let j=0;j<2;j++){g.fillStyle=(i+j)%2?'#2f4357':'#22323f';g.fillRect(i*128,j*128,128,128);}
 g.strokeStyle='rgba(200,220,240,.35)';g.lineWidth=2;g.strokeRect(1,1,254,254);g.beginPath();g.moveTo(128,0);g.lineTo(128,256);g.moveTo(0,128);g.lineTo(256,128);g.stroke();
 const t=new T.CanvasTexture(c);t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(FLOOR_SIZE,FLOOR_SIZE);t.anisotropy=8;t.colorSpace=T.SRGBColorSpace;return t;
}
function skyTexture(){
 const c=document.createElement('canvas');c.width=2;c.height=256;const g=c.getContext('2d'),r=g.createLinearGradient(0,0,0,256);
 r.addColorStop(0,'#0c1622');r.addColorStop(.55,'#3c5b7a');r.addColorStop(1,'#8fa9c2');g.fillStyle=r;g.fillRect(0,0,2,256);
 const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return t;
}

// a drawn piece that follows body b of the physics
function follow(piece,b,data){
 piece.matrixAutoUpdate=false;const m=new T.Matrix4();
 return()=>{const p=data.xpos,r=data.xmat,i=3*b,k=9*b;m.set(r[k],r[k+1],r[k+2],p[i],r[k+3],r[k+4],r[k+5],p[i+1],r[k+6],r[k+7],r[k+8],p[i+2],0,0,0,1);piece.matrix.copy(m);piece.matrixWorldNeedsUpdate=true;};
}
function visor(){
 const g=new T.Group(),front=Math.PI/2;
 // a dark glass shell over the face and a light strip across it
 const shell=new T.Mesh(new T.SphereGeometry(1,40,20,front-1.15,2.3,.3*Math.PI,.42*Math.PI),new T.MeshPhysicalMaterial({color:0x07090c,metalness:.2,roughness:.08,clearcoat:1,clearcoatRoughness:.05}));
 const strip=new T.Mesh(new T.SphereGeometry(1,40,4,front-.85,1.7,.47*Math.PI,.045*Math.PI),glow(2.6));
 shell.scale.set(...HEAD.r.map(r=>r*1.04));strip.scale.set(...HEAD.r.map(r=>r*1.06));
 for(const m of [shell,strip]){m.position.set(...HEAD.c);g.add(m);}
 return g;
}
function chestLight(){
 const g=new T.Group(),m=new T.Mesh(new T.CircleGeometry(.018,24),glow(3));
 const ring=new T.Mesh(new T.RingGeometry(.022,.028,32),glow(1.2));
 for(const x of [m,ring]){x.position.set(0,.11,.098);g.add(x);}
 return g;
}
function jointRing(r){
 const g=new T.Group(),disc=new T.Mesh(new T.CylinderGeometry(r,r,.034,32),metal('black')),band=new T.Mesh(new T.TorusGeometry(r*.92,.0035,8,40),glow(1.4));
 disc.rotation.z=Math.PI/2;band.rotation.y=Math.PI/2;g.add(disc,band);return g;
}

export function applyRobot({scene,renderer,view,sim}){
 renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
 const pmrem=new T.PMREMGenerator(renderer);
 scene.environment=pmrem.fromScene(new RoomEnvironment(),.04).texture;scene.environmentIntensity=.6;pmrem.dispose();
 scene.background=skyTexture();scene.fog=new T.Fog(0x3c5b7a,8,18);
 scene.traverse(o=>{
  if(o.isGridHelper)o.visible=false;
  else if(o.isMesh&&o.geometry?.parameters?.width===FLOOR_SIZE)o.material=new T.MeshStandardMaterial({map:checkerTexture(),roughness:.85,metalness:0});
 });
 for(const m of view.meshes){
  if(m.userData.body===0)continue;
  const kind=(PART.find(([re])=>re.test(m.userData.name))?.[1])??'dark';
  m.material=metal(kind);m.userData.base=m.material.color.clone();
 }
 const {model,data}=sim,pieces=[[visor(),'head'],[chestLight(),'thorax']];
 for(const [name,r] of RINGS)for(const side of ['l','r'])pieces.push([jointRing(r),`${name}_${side}`]);
 const pose=pieces.map(([piece,name])=>{piece.traverse(o=>{if(o.isMesh)o.castShadow=true;});scene.add(piece);return follow(piece,model.body(name).id,data);});
 return{update(){for(const p of pose)p();}};
}
