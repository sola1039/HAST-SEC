export function mountCanvas(container,canvas){
  Object.assign(canvas.style,{display:'block',width:'100%',height:'100%'});
  container.appendChild(canvas);
}

export function resizeViewport(container,renderer,camera){
  const width=container.clientWidth,height=container.clientHeight;
  if(width<1||height<1)return false;
  renderer.setSize(width,height,false);
  camera.aspect=width/height;
  camera.updateProjectionMatrix();
  return true;
}
