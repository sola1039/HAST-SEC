import * as T from 'three';

export const ARENA={half:2.0,height:2.2,thick:.05,near:.45};

export function arenaXml(xml){
 const {half:a,height:h,thick:t}=ARENA,y=h/2,o=a+t;
 const walls=[[o,0,t,a+2*t],[-o,0,t,a+2*t],[0,o,a+2*t,t],[0,-o,a+2*t,t]].map(([x,z,sx,sz],i)=>
  `<geom name="air_wall_${i}" type="box" pos="${x} ${y} ${z}" size="${sx} ${y} ${sz}" rgba="1 1 1 0" friction="0.5 0.005 0.0001" />`).join('');
 const at=xml.indexOf('/>',xml.indexOf('name="floor"'))+2;
 if(at<2)throw Error('arena: the model has no floor');
 return xml.slice(0,at)+walls+xml.slice(at);
}

const VERT=`varying vec3 vWorld;void main(){vec4 w=modelMatrix*vec4(position,1.);vWorld=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`;
const FRAG=`uniform vec3 uCenter;uniform float uStrength;varying vec3 vWorld;
void main(){float d=distance(vWorld,uCenter);float a=uStrength*(1.-smoothstep(.15,.85,d));
 float grid=step(.96,fract(vWorld.x*5.))+step(.96,fract(vWorld.y*5.))+step(.96,fract(vWorld.z*5.));
 gl_FragColor=vec4(.86,.16,.12,a*(.45+.35*min(grid,1.)));}`;

export function createArena(scene){
 const {half:a,height:h,near}=ARENA;
 const walls=[[1,'x'],[-1,'x'],[1,'z'],[-1,'z']].map(([sign,axis])=>{
  const mat=new T.ShaderMaterial({vertexShader:VERT,fragmentShader:FRAG,transparent:true,depthWrite:false,side:T.DoubleSide,
   uniforms:{uCenter:{value:new T.Vector3()},uStrength:{value:0}}});
  const mesh=new T.Mesh(new T.PlaneGeometry(2*a,h),mat);
  mesh.position.set(axis==='x'?sign*a:0,h/2,axis==='z'?sign*a:0);
  if(axis==='x')mesh.rotation.y=Math.PI/2;
  scene.add(mesh);return {sign,axis,mat};
 });
 const pts=[[-a,-a],[a,-a],[a,a],[-a,a],[-a,-a]].map(([x,z])=>new T.Vector3(x,.003,z));
 scene.add(new T.Line(new T.BufferGeometry().setFromPoints(pts),new T.LineBasicMaterial({color:0xb5a996})));
 return {
  update(model,data){
   for(const w of walls){
    const k=w.axis==='x'?0:2;let best=Infinity,at=0;
    for(let b=1;b<model.nbody;b++){const d=a-w.sign*data.xpos[3*b+k];if(d<best){best=d;at=b;}}
    const s=Math.min(Math.max(1-best/near,0),1);w.mat.uniforms.uStrength.value=s;
    if(s>0){const c=w.mat.uniforms.uCenter.value;c.set(data.xpos[3*at],data.xpos[3*at+1],data.xpos[3*at+2]);c.setComponent(k,w.sign*a);}
   }
  }
 };
}
