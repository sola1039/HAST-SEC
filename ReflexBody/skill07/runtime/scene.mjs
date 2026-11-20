import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';

export function createScene(stage){
 const scene=new T.Scene();scene.background=new T.Color(0xfaf7f2);
 const camera=new T.PerspectiveCamera(40,1,.02,50);camera.position.set(1.8,1.2,2.6);
 const renderer=new T.WebGLRenderer({antialias:true});renderer.shadowMap.enabled=true;renderer.outputColorSpace=T.SRGBColorSpace;stage.append(renderer.domElement);
 scene.add(new T.HemisphereLight(0xffffff,0xb8ad9c,1.6));
 const sun=new T.DirectionalLight(0xffffff,1.6);sun.position.set(2,4,3);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
 Object.assign(sun.shadow.camera,{left:-2,right:2,top:2,bottom:-2,near:.5,far:10});scene.add(sun);
 const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,.7,0);controls.enableDamping=true;
 const resize=()=>{const r=stage.getBoundingClientRect();renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(r.width,r.height);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();};
 new ResizeObserver(resize).observe(stage);resize();
 return{scene,camera,renderer,controls};
}
