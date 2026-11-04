/* Visible forest perimeter: the trail and the metro pavilion are INSIDE it.
 * Rendering is instanced; collision is four thin rectangles, not an invisible city wall. */
(function(){
 'use strict';let root=null,owner=null,required=false;const resources=new Set();
 const bounds={minX:-590,maxX:-372,minZ:-4,maxZ:200};
 const walls=[[-481,-4,218,.25],[-481,200,218,.25],[-590,98,.25,204],[-372,98,.25,204]];
 function clear(){root?.parent?.remove(root);resources.forEach(r=>r.dispose?.());resources.clear();root=owner=null;required=false;}
 function build(){
  if(owner===scene&&root)return;clear();owner=scene;root=new THREE.Group();root.name='Old forest perimeter — route through metro';scene.add(root);
  const own=r=>(resources.add(r),r),metal=own(new THREE.MeshLambertMaterial({color:0x51463b}));
  const cv=document.createElement('canvas');cv.width=cv.height=64;const ctx=cv.getContext('2d');ctx.strokeStyle='#927e64';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,32);ctx.lineTo(32,0);ctx.lineTo(64,32);ctx.lineTo(32,64);ctx.closePath();ctx.stroke();
  const tex=own(new THREE.CanvasTexture(cv));tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(7,7);
  const wire=own(new THREE.MeshLambertMaterial({map:tex,transparent:true,alphaTest:.2,side:THREE.DoubleSide,color:0x897763}));
  const panels=[];for(const [x,z,w,d] of walls){const horizontal=w>d,length=horizontal?w:d,count=Math.ceil(length/4);for(let i=0;i<count;i++)panels.push({x:x+(horizontal?(i+.5)*length/count-length/2:0),z:z+(horizontal?0:(i+.5)*length/count-length/2),yaw:horizontal?0:Math.PI/2,width:length/count});}
  const mesh=new THREE.InstancedMesh(own(new THREE.PlaneGeometry(1,5)),wire,panels.length),posts=new THREE.InstancedMesh(own(new THREE.CylinderGeometry(.075,.09,5.3,6)),metal,panels.length),rails=new THREE.InstancedMesh(own(new THREE.BoxGeometry(1,.09,.09)),metal,panels.length*2),dummy=new THREE.Object3D();
  panels.forEach((p,i)=>{dummy.position.set(p.x,2.5,p.z);dummy.rotation.set(0,p.yaw,0);dummy.scale.set(p.width,1,1);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);for(let k=0;k<2;k++){dummy.position.y=k?4.7:.35;dummy.updateMatrix();rails.setMatrixAt(i*2+k,dummy.matrix);}dummy.scale.set(1,1,1);dummy.position.set(p.x-Math.cos(p.yaw)*p.width/2,2.65,p.z+Math.sin(p.yaw)*p.width/2);dummy.updateMatrix();posts.setMatrixAt(i,dummy.matrix);});
  for(const m of [mesh,posts,rails]){m.frustumCulled=false;root.add(m);}
  const signCanvas=document.createElement('canvas');signCanvas.width=768;signCanvas.height=256;const c=signCanvas.getContext('2d');c.fillStyle='#392e20';c.fillRect(0,0,768,256);c.strokeStyle='#d2af67';c.lineWidth=14;c.strokeRect(7,7,754,242);c.fillStyle='#e6d8b2';c.textAlign='center';c.font='bold 48px Arial';c.fillText('ПРОХОД В ГОРОД ЗАКРЫТ',384,85);c.font='36px Arial';c.fillText('Старая станция «Лесная» →',384,161);c.fillText('Следуйте по тропе',384,214);
  const sign=new THREE.Mesh(own(new THREE.PlaneGeometry(5.2,1.73)),own(new THREE.MeshBasicMaterial({map:own(new THREE.CanvasTexture(signCanvas)),side:THREE.DoubleSide})));sign.position.set(-372.18,2.2,75);sign.rotation.y=-Math.PI/2;root.add(sign);
 }
 function collision(x,z,r=.45){return !!root&&walls.some(([cx,cz,w,d])=>x+r>cx-w/2&&x-r<cx+w/2&&z+r>cz-d/2&&z-r<cz+d/2);}
 function begin(){build();required=true;setDNTime(23);window.FZFlash40?.place();}
 function rescue(){if(!required)return false;localPlayer.mesh.position.set(-490,0,100);Object.assign(velocity,{x:0,y:0,z:0});FZPlay.release();setNavTarget(-477,92,'Тропа в город',true);showNotification('Вернул к безопасному началу тропы. Выход в город — через метро.','info');return true;}
 window.FZForest40={build,begin,clear,collision,rescue,required:()=>required,end:()=>{required=false;},night:()=>required,info:()=>({built:!!root,required,bounds,resources:resources.size})};
})();
