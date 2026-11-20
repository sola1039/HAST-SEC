// The showcase as the Unitree G1 robot in a simulation scene: the G1's meshes (robot/g1.bin, made by tools/build_robot_skin.py from
// the MuJoCo Menagerie unitree_g1, BSD-3-Clause, Unitree Robotics) drawn on the physics body's segments, which are hidden; the
// physics is the body's own. A checkered blue-grey ground under a gradient sky.
import * as T from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';

const FLOOR_SIZE=12;  // the floor plane the body view makes (its grid is hidden)

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
const MATERIAL={
 black:()=>new T.MeshPhysicalMaterial({color:0x2a2c30,metalness:.35,roughness:.45,clearcoat:.4,clearcoatRoughness:.3}),
 metal:()=>new T.MeshPhysicalMaterial({color:0xb9bec6,metalness:.6,roughness:.35,clearcoat:.5,clearcoatRoughness:.25}),
};

export async function loadRobot(base='./robot/'){
 const [meta,buf]=await Promise.all([fetch(base+'g1.json').then(r=>{if(!r.ok)throw Error('机器人模型读取失败');return r.json();}),
  fetch(base+'g1.bin').then(r=>{if(!r.ok)throw Error('机器人模型读取失败');return r.arrayBuffer();})]);
 return {meta,pos:new Float32Array(buf,0,meta.vertices*3),index:new Uint32Array(buf,meta.vertices*12,meta.indices)};
}

// scene: the robot's pieces on the body's segments; returns update() for every frame and the meshes a finger can take
export function applyRobot({scene,renderer,view,sim,robot}){
 renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
 const pmrem=new T.PMREMGenerator(renderer);
 scene.environment=pmrem.fromScene(new RoomEnvironment(),.04).texture;scene.environmentIntensity=.6;pmrem.dispose();
 scene.background=skyTexture();scene.fog=new T.Fog(0x3c5b7a,8,18);
 scene.traverse(o=>{
  if(o.isGridHelper)o.visible=false;
  else if(o.isMesh&&o.geometry?.parameters?.width===FLOOR_SIZE)o.material=new T.MeshStandardMaterial({map:checkerTexture(),roughness:.85,metalness:0});
 });
 // the physics body: hidden, the robot drawn instead (?bones=1: shown as a wireframe over the robot, to check the fit)
 const bones=new URLSearchParams(location.search).has('bones');
 for(const m of view.meshes)if(m.userData.body!==0){if(bones)m.material=new T.MeshBasicMaterial({color:0xff3366,wireframe:true});else m.visible=false;}
 const {model,data}=sim,mats={black:MATERIAL.black(),metal:MATERIAL.metal()},pieces=[];
 for(const p of robot.meta.pieces){
  const g=new T.BufferGeometry(),[v0,vn]=p.vert,[i0,inn]=p.index;
  g.setAttribute('position',new T.BufferAttribute(robot.pos.subarray(3*v0,3*(v0+vn)),3));
  g.setIndex(new T.BufferAttribute(robot.index.subarray(i0,i0+inn),1));g.computeVertexNormals();g.computeBoundingSphere();
  const mesh=new T.Mesh(g,mats[p.material]??mats.metal),body=model.body(p.segment).id;
  mesh.castShadow=true;mesh.matrixAutoUpdate=false;mesh.userData={body,name:p.segment};scene.add(mesh);pieces.push(mesh);
 }
 const m4=new T.Matrix4();
 return{
  meshes:pieces,
  update(){
   const x=data.xpos,r=data.xmat;
   for(const mesh of pieces){const b=mesh.userData.body,i=3*b,k=9*b;
    m4.set(r[k],r[k+1],r[k+2],x[i],r[k+3],r[k+4],r[k+5],x[i+1],r[k+6],r[k+7],r[k+8],x[i+2],0,0,0,1);mesh.matrix.copy(m4);mesh.matrixWorldNeedsUpdate=true;}
  }};
}
