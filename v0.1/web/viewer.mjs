import * as THREE from "three";
import {OrbitControls} from "three/addons/controls/OrbitControls.js";
import {mountCanvas,resizeViewport} from './viewer_layout.mjs';
import {syncAvatar} from '../motion/avatar_sync.mjs';

export function createViewer(container,{wheelZoom=true}={}) {
  const scene=new THREE.Scene();
  scene.background=new THREE.Color(0xf3f6fa);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x687886, 2.4));
  const light=new THREE.DirectionalLight(0xffffff,2.3);light.position.set(-1,3,2);scene.add(light);
  scene.add(new THREE.GridHelper(4, 20, 0xa9bbcb, 0xdce5ed));
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  mountCanvas(container,renderer.domElement);
  const camera=new THREE.PerspectiveCamera(32,1,0.01,30);
  const controls=new OrbitControls(camera,renderer.domElement);
  controls.enableZoom=Boolean(wheelZoom);
  controls.minDistance=.3;controls.maxDistance=9;
  const axes=new THREE.AxesHelper(.16);axes.material.depthTest=false;axes.renderOrder=10;scene.add(axes);
  let vrm,profile,graph,selected="head",lines,radius=3,pendingBox=null;
  const vector=new THREE.Vector3(),fullTarget=new THREE.Vector3();
  const yaw=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI);
  function render() {
    if (vrm) {
      syncAvatar(vrm);
      const node = vrm.humanoid.getNormalizedBoneNode(selected);
      node.getWorldPosition(axes.position); node.getWorldQuaternion(axes.quaternion);
      if (profile.vrm_version === "0") axes.quaternion.multiply(yaw);
      if (lines) {
        const attribute=lines.geometry.getAttribute("position");
        let offset=0;
        for (const [child, parent] of Object.entries(graph.bone_parents)) {
          if (!parent) continue;
          vrm.humanoid.getRawBoneNode(parent).getWorldPosition(vector); vector.toArray(attribute.array, offset); offset += 3;
          vrm.humanoid.getRawBoneNode(child).getWorldPosition(vector); vector.toArray(attribute.array, offset); offset += 3;
        }
        attribute.needsUpdate = true;
        lines.geometry.computeBoundingSphere();
      }
    }
    renderer.render(scene, camera);
  }
  function view(side = "front") {
    if(side === "face") {vrm.humanoid.getRawBoneNode("head").getWorldPosition(controls.target);controls.target.y-=.02;camera.position.copy(controls.target).add(new THREE.Vector3(0,0,.65));controls.update();render();return;}
    controls.target.copy(fullTarget);
    const directions={front:[0,0,1],back:[0,0,-1],left:[1,0,0],right:[-1,0,0]};
    camera.position.copy(controls.target).add(new THREE.Vector3(...directions[side]).multiplyScalar(radius));
    controls.update(); render();
  }
  function resize() {
    if(!resizeViewport(container,renderer,camera))return;
    if(pendingBox){const box=pendingBox;pendingBox=null;fitBounds(box,fullTarget);}else render();
  }
  function fitBounds(box,target=null) {
    if (box.isEmpty()) throw new Error("预览边界为空.");
    if(target)fullTarget.copy(target);else box.getCenter(fullTarget);controls.target.copy(fullTarget);
    const {clientWidth:width,clientHeight:height}=container;if(width<1||height<1){pendingBox=box.clone();return;}
    const span=Math.max(fullTarget.y-box.min.y,box.max.y-fullTarget.y,(fullTarget.x-box.min.x)/camera.aspect,(box.max.x-fullTarget.x)/camera.aspect);
    radius=span/Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*1.18;
    view();
  }
  const observer=new ResizeObserver(resize);observer.observe(container);
  controls.addEventListener("change", render);
  window.addEventListener("pagehide", () => { observer.disconnect(); controls.dispose(); renderer.dispose(); }, {once:true});
  resize();
  return {
    scene, render, view, fitBounds,
    inspect(){return {target:controls.target.toArray(),camera:camera.position.toArray(),full_target:fullTarget.toArray(),head_screen:vrm?vrm.humanoid.getNormalizedBoneNode("head").getWorldPosition(new THREE.Vector3()).project(camera).toArray():null,wheel_zoom:controls.enableZoom};},
    attach(model, skeleton, binding) {
      vrm = model; profile = skeleton; graph = binding; scene.add(vrm.scene);
      const box = new THREE.Box3().setFromObject(vrm.scene);
      lines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({color:0x197e9d,depthTest:false}));
      const segments=Object.values(graph.bone_parents).filter(Boolean).length;
      lines.geometry.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(segments * 6), 3));
      lines.visible=false;lines.renderOrder=8;scene.add(lines);fitBounds(box);
    },
    select(name){selected=name;render();},
    showBones(show){if(lines)lines.visible=show;render();},
    showAxes(show){axes.visible=show;render();}
  };
}
