/* The actual detached cabin becomes a persistent, collidable forest wreck.
 * Transfer ownership instead of cloning/discarding its GPU resources. */
(function(){
 'use strict';let root=null,owner=null,collider=null;const resources=new Set();let hulls=[];
 function clear(){
  root?.parent?.remove(root);resources.forEach(r=>r.dispose?.());resources.clear();
  if(collider&&typeof streetColliders!=='undefined'){const i=streetColliders.indexOf(collider);if(i>=0)streetColliders.splice(i,1);}
  root=owner=collider=null;hulls=[];
 }
 function groundHeight(cabin,yaw){
  const p=cabin.position.clone(),q=cabin.quaternion.clone();cabin.position.set(0,0,0);cabin.rotation.order='YXZ';cabin.rotation.set(.12,yaw+.65,1.48);cabin.updateMatrixWorld(true);
  const y=.06-new THREE.Box3().setFromObject(cabin).min.y;cabin.position.copy(p);cabin.quaternion.copy(q);cabin.updateMatrixWorld(true);return y;
 }
 function adopt(cabin,source){
  clear();root=cabin;owner=scene;root.name='Fallen elevator — story38';
  function take(r){if(r){resources.add(r);source.delete(r);}}
  root.traverse(o=>{take(o.geometry);for(const m of (Array.isArray(o.material)?o.material:[o.material]))if(m){take(m);for(const value of Object.values(m))if(value?.isTexture)take(value);
    if(m.isMeshStandardMaterial&&!m.transparent&&m.metalness>.3){m.metalness=.2;m.roughness=.8;m.emissive.setHex(0x233245);m.emissiveIntensity=.18;}
  }});
  root.updateMatrixWorld(true);
  root.traverse(o=>{
   if(!o.isMesh||!o.geometry)return;o.geometry.computeBoundingBox();const b=o.geometry.boundingBox,points=[],world=new THREE.Box3();
   for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z]){const p=new THREE.Vector3(x,y,z).applyMatrix4(o.matrixWorld);world.expandByPoint(p);points.push([p.x,p.z]);}
   if(world.min.y>1.95||world.max.y<.08)return;
   points.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]),half=ps=>{const h=[];for(const p of ps){while(h.length>=2&&cross(h.at(-2),h.at(-1),p)<=0)h.pop();h.push(p);}h.pop();return h;};
   const h=half(points).concat(half([...points].reverse()));if(h.length>=3)hulls.push(h);
  });
  collider={x:root.position.x,z:root.position.z,r:6,story38Wreck:true};streetColliders.push(collider);
 }
 function collision(x,z,r=.45){
  if(!root||Math.hypot(x-root.position.x,z-root.position.z)>7)return false;
  return hulls.some(h=>{let inside=true;for(let i=0;i<h.length;i++){const a=h[i],b=h[(i+1)%h.length],dx=b[0]-a[0],dz=b[1]-a[1],q=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));if(dx*(z-a[1])-dz*(x-a[0])<0)inside=false;if(Math.hypot(x-a[0]-q*dx,z-a[1]-q*dz)<r)return true;}return inside;});
 }
 function update(){if(root&&owner!==scene)clear();}
 window.FZLift38Wreck={adopt,clear,groundHeight,update,collision,info:()=>({active:!!root,position:root?.position.toArray()||null,resources:resources.size,hulls:hulls.length,collider:collider?{...collider}:null})};
})();
