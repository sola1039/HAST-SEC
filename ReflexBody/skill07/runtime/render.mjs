import * as T from 'three';

const PLANE=0,SPHERE=2,CAPSULE=3,ELLIPSOID=4,BOX=6;

function meshFor(type,size,material){
 if(type===CAPSULE){const g=new T.CapsuleGeometry(size[0],2*size[1],6,16);g.rotateX(Math.PI/2);return new T.Mesh(g,material);}
 if(type===ELLIPSOID){const m=new T.Mesh(new T.SphereGeometry(1,24,16),material);m.geometry.scale(size[0],size[1],size[2]);return m;}
 if(type===SPHERE)return new T.Mesh(new T.SphereGeometry(size[0],20,14),material);
 if(type===BOX)return new T.Mesh(new T.BoxGeometry(2*size[0],2*size[1],2*size[2]),material);
 return null;
}

export function createBodyView(scene,sim,meta){
 const {model,data}=sim,colour=new Map(meta.segments.map(s=>[s.name,s.colour]));
 const group=new T.Group();scene.add(group);
 const floor=new T.Mesh(new T.PlaneGeometry(12,12),new T.MeshStandardMaterial({color:0xece6dc,roughness:.95}));
 floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;group.add(floor);
 const grid=new T.GridHelper(12,48,0xc9c0b2,0xddd6ca);grid.position.y=.001;group.add(grid);
 const meshes=[];
 for(let g=0;g<model.ngeom;g++){
  const type=model.geom_type[g];if(type===PLANE)continue;
  const body=model.geom_bodyid[g],name=sim.bodyName(body);
  const material=new T.MeshStandardMaterial({color:colour.get(name)??0xcccccc,roughness:.6,metalness:0});
  const mesh=meshFor(type,[model.geom_size[3*g],model.geom_size[3*g+1],model.geom_size[3*g+2]],material);
  if(!mesh)continue;
  mesh.castShadow=true;mesh.matrixAutoUpdate=false;mesh.userData={body,geom:g,name,base:material.color.clone()};
  group.add(mesh);meshes.push(mesh);
 }
 const m4=new T.Matrix4();
 return{
  meshes,
  update(){
   const p=data.geom_xpos,r=data.geom_xmat;
   for(const mesh of meshes){
    const g=mesh.userData.geom,i=3*g,k=9*g;
    m4.set(r[k],r[k+1],r[k+2],p[i],r[k+3],r[k+4],r[k+5],p[i+1],r[k+6],r[k+7],r[k+8],p[i+2],0,0,0,1);
    mesh.matrix.copy(m4);
   }
  },
  highlight(body,on){for(const m of meshes)if(m.userData.body===body)m.material.color.copy(on?m.userData.base.clone().offsetHSL(0,0,-.15):m.userData.base);}
 };
}
