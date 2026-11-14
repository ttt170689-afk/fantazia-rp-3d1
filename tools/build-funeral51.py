#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-or-later
# Original FANTAZIA data conversion script, 2026.
"""Build the dressed funeral cast. Python dependencies: numpy, Pillow.

Usage: python tools/build-funeral51.py --source .cache/mh51
Sources and their exact revisions/licenses are recorded in funeral51-source.md.
The source ZIP can be extracted into --source to rebuild without network access.
No MakeHuman application code is imported. Only mesh/fit/rig/texture data is read.
"""
import argparse
import io
import json
import struct
from pathlib import Path
import numpy as np
from PIL import Image, ImageEnhance

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source', type=Path, default=ROOT / '.cache/mh51')
SOURCE = parser.parse_args().source
OUT = ROOT / 'public/assets/models/funeral51'
OUT.mkdir(parents=True, exist_ok=True)
CORE = SOURCE / 'core/makehuman/data'
ASSETS = SOURCE / 'assets/base'
TEX = SOURCE / 'js/public/data'
USED = set()


def read(path):
    USED.add(path)
    return path.read_text()


def obj(path):
    vertices, uv, faces = [], [], []
    group = 'body'
    for line in read(path).splitlines():
        bits = line.split()
        if not bits:
            continue
        if bits[0] == 'v': vertices.append(list(map(float, bits[1:4])))
        elif bits[0] == 'vt': uv.append(list(map(float, bits[1:3])))
        elif bits[0] == 'g': group = bits[1]
        elif bits[0] == 'f':
            corners = [tuple(int(v)-1 for v in c.split('/')[:2]) for c in bits[1:]]
            faces.append((group, corners))
    return np.array(vertices), np.array(uv), faces


BASE, BASE_UV, BASE_FACES = obj(CORE / '3dobjs/base.obj')
RIG = json.loads(read(CORE / 'rigs/default.mhskel'))
WEIGHTS = json.loads(read(CORE / 'rigs/default_weights.mhw'))['weights']
BONES = list(RIG['bones'])
BW = np.zeros((len(BASE), len(BONES)))
for name, rows in WEIGHTS.items():
    for vertex, value in rows:
        BW[vertex, BONES.index(name)] = value
BW /= np.maximum(BW.sum(axis=1, keepdims=True), 1e-8)


def morph(name):
    result = np.zeros_like(BASE)
    for line in read(CORE / ('targets/macrodetails/' + name + '.target')).splitlines():
        if line and not line.startswith('#'):
            v, x, y, z = line.split()
            result[int(v)] = [float(x), float(y), float(z)]
    return result


def fit(path, body):
    refs, blends, offsets, hidden = [], [], [], set()
    scales = np.ones(3)
    section = None
    for line in read(path).splitlines():
        b = line.split()
        if not b or b[0].startswith('#'): continue
        if b[0] in ['x_scale', 'y_scale', 'z_scale']:
            axis = 'xyz'.index(b[0][0])
            scales[axis] = abs(body[int(b[1]), axis] - body[int(b[2]), axis]) / float(b[3])
        elif b[0] == 'verts': section = 'verts'
        elif b[0] == 'delete_verts': section = 'delete'
        elif not b[0][0].isdigit(): continue
        elif section == 'verts':
            if len(b) == 1:
                refs.append([int(b[0])]*3); blends.append([1, 0, 0]); offsets.append([0, 0, 0])
            else:
                refs.append(list(map(int, b[:3])))
                blends.append(list(map(float, b[3:6])))
                offsets.append(list(map(float, b[6:9])))
        elif section == 'delete':
            i = 0
            while i < len(b):
                if i + 2 < len(b) and b[i+1] == '-':
                    hidden.update(range(int(b[i]), int(b[i+2])+1)); i += 3
                else: hidden.add(int(b[i])); i += 1
    refs, blends = np.array(refs), np.array(blends)
    coords = (body[refs] * blends[:, :, None]).sum(axis=1) + np.array(offsets)*scales
    weights = (BW[refs] * blends[:, :, None]).sum(axis=1)
    weights = np.maximum(weights, 0)
    weights /= np.maximum(weights.sum(axis=1, keepdims=True), 1e-8)
    return coords, weights, hidden


class GLB:
    def __init__(self):
        self.data = bytearray()
        self.j = dict(asset={'version':'2.0','generator':'FANTAZIA funeral51 / MakeHuman data conversion',
                             'copyright':'MakeHuman contributors; see assets/licenses/funeral51-source.md'},
                      scene=0, scenes=[{'nodes':[0]}], nodes=[{'name':'Mourner'}],
                      meshes=[], materials=[], textures=[], images=[], samplers=[{'magFilter':9729,'minFilter':9987,'wrapS':10497,'wrapT':10497}],
                      accessors=[], bufferViews=[], skins=[], buffers=[])
        self.textures = {}

    def view(self, data):
        self.data.extend(b'\0' * ((-len(self.data)) % 4))
        idx = len(self.j['bufferViews'])
        self.j['bufferViews'].append({'buffer':0,'byteOffset':len(self.data),'byteLength':len(data)})
        self.data.extend(data)
        return idx

    def accessor(self, data, kind, component=5126, bounds=False):
        data = np.asarray(data, dtype={5126:'<f4',5123:'<u2',5125:'<u4'}[component])
        acc = {'bufferView':self.view(data.tobytes()),'componentType':component,'count':len(data),'type':kind}
        if bounds:
            acc['min'] = data.min(axis=0).tolist(); acc['max'] = data.max(axis=0).tolist()
        self.j['accessors'].append(acc)
        return len(self.j['accessors'])-1

    def material(self, path, name, hair=False, desaturate=False, tint=None):
        USED.add(path)
        image = Image.open(path).convert('RGBA')
        if desaturate:
            alpha = image.getchannel('A')
            image = ImageEnhance.Color(image.convert('RGB')).enhance(.05).convert('RGBA')
            image.putalpha(alpha)
        if tint:
            a = np.asarray(image).copy()
            for c in range(3): a[:,:,c] = np.clip(a[:,:,c]*tint[c],0,255).astype('uint8')
            image = Image.fromarray(a)
        image.thumbnail((512,512), Image.Resampling.LANCZOS)
        stream = io.BytesIO(); image.save(stream, format='PNG', optimize=True)
        ti = len(self.j['textures'])
        self.j['images'].append({'bufferView':self.view(stream.getvalue()),'mimeType':'image/png'})
        self.j['textures'].append({'source':ti,'sampler':0})
        self.j['materials'].append({'name':name,'pbrMetallicRoughness':{'baseColorTexture':{'index':ti},'metallicFactor':0,'roughnessFactor':.9 if hair else .78},'doubleSided':True,**({'alphaMode':'MASK','alphaCutoff':.3} if hair else {})})
        return len(self.j['materials'])-1

    def mesh(self, name, verts, uv, faces, weights, material, hidden=None, body=False):
        triangles = []
        for group, corners in faces:
            if body and group != 'body': continue
            if hidden and any(v in hidden for v,t in corners): continue
            for i in range(1,len(corners)-1): triangles.append([corners[0],corners[i],corners[i+1]])
        # Smooth normals BEFORE splitting vertices at UV seams.
        normals = np.zeros_like(verts)
        ids = np.array([[v for v,t in tri] for tri in triangles])
        n = np.cross(verts[ids[:,1]]-verts[ids[:,0]], verts[ids[:,2]]-verts[ids[:,0]])
        for c in range(3): np.add.at(normals, ids[:,c], n)
        normals /= np.maximum(np.linalg.norm(normals,axis=1,keepdims=True),1e-8)
        remap, original, texcoords, indices = {}, [], [], []
        for tri in triangles:
            for pair in tri:
                if pair not in remap:
                    remap[pair] = len(original); original.append(pair[0]); texcoords.append(uv[pair[1]])
                indices.append(remap[pair])
        original = np.array(original)
        w = weights[original]
        joints = np.argsort(w,axis=1)[:,-4:]
        w = np.take_along_axis(w,joints,axis=1)
        w[w<1e-8] = 0
        w /= np.maximum(w.sum(axis=1,keepdims=True),1e-8)
        joints[w==0] = 0
        prim = {'attributes':{'POSITION':self.accessor(verts[original],'VEC3',bounds=True),
                              'NORMAL':self.accessor(normals[original],'VEC3'),
                              'TEXCOORD_0':self.accessor(np.array(texcoords)*[1,-1]+[0,1],'VEC2'),
                              'JOINTS_0':self.accessor(joints,'VEC4',5123),
                              'WEIGHTS_0':self.accessor(w,'VEC4')},
                'indices':self.accessor(indices,'SCALAR',5125),'material':material}
        mesh = len(self.j['meshes']); self.j['meshes'].append({'name':name,'primitives':[prim]})
        node = len(self.j['nodes']); self.j['nodes'].append({'name':name,'mesh':mesh,'skin':0})
        self.j['scenes'][0]['nodes'].append(node)
        for accessor in prim['attributes'].values():
            self.j['bufferViews'][self.j['accessors'][accessor]['bufferView']]['target'] = 34962
        self.j['bufferViews'][self.j['accessors'][prim['indices']]['bufferView']]['target'] = 34963

    def rig(self, body):
        positions = {n:body[RIG['joints'][b['head']]].mean(axis=0) for n,b in RIG['bones'].items()}
        offset = len(self.j['nodes'])
        inv = []
        for name in BONES:
            parent = RIG['bones'][name]['parent']
            self.j['nodes'].append({'name':name.replace('.','_'), 'translation':(positions[name]-(positions[parent] if parent else 0)).tolist()})
            parent_node = offset + BONES.index(parent) if parent else 0
            self.j['nodes'][parent_node].setdefault('children',[]).append(offset+BONES.index(name)) if parent_node < len(self.j['nodes']) else None
            m = np.eye(4); m[:3,3] = -positions[name]; inv.append(m.T.flatten())
        # Parents are not stored in topological order in MakeHuman.
        for i,name in enumerate(BONES):
            parent = RIG['bones'][name]['parent']
            if parent and BONES.index(parent)>i:
                self.j['nodes'][offset+BONES.index(parent)].setdefault('children',[]).append(offset+i)
        self.j['skins'].append({'name':'Funeral anatomy','joints':list(range(offset,offset+len(BONES))), 'inverseBindMatrices':self.accessor(inv,'MAT4'),'skeleton':offset+BONES.index('root')})

    def save(self, path):
        self.data.extend(b'\0' * ((-len(self.data)) % 4))
        self.j['buffers'] = [{'byteLength':len(self.data)}]
        text = json.dumps(self.j,separators=(',',':')).encode(); text += b' '*((-len(text))%4)
        path.write_bytes(struct.pack('<III',0x46546c67,2,28+len(text)+len(self.data))+struct.pack('<II',len(text),0x4e4f534a)+text+struct.pack('<II',len(self.data),0x004e4942)+self.data)


PROFILES = [
    ('father','caucasian-male-old','male-old','old_caucasian_male','old_lightskinned_male_diffuse.png','male_elegantsuit01','short03','shoes01',1.79),
    ('mother','caucasian-female-old','female-old','old_caucasian_female','old_lightskinned_female_diffuse.png','female_elegantsuit01','bob02','shoes03',1.66),
    ('friend','african-male-young','male-young','young_african_male','young_darkskinned_male_diffuse.png','male_elegantsuit01','short01','shoes01',1.86),
    ('brother','caucasian-male-young','male-young','young_caucasian_male','young_lightskinned_male_diffuse2.png','male_elegantsuit01','short01','shoes01',1.76),
    ('sister','asian-female-young','female-young','young_asian_female','young_lightskinned_female_diffuse3.png','female_elegantsuit01','ponytail01','shoes03',1.70)
]
manifest = []
for name, ethnic, macro, skin, skinfile, suit, hair, shoes, height in PROFILES:
    body = BASE + morph(ethnic) + morph('universal-'+macro+'-averagemuscle-averageweight')
    surface = sorted({v for g,f in BASE_FACES if g=='body' for v,t in f})
    floor = body[surface,1].min(); scale = height/(body[surface,1].max()-floor)
    def transform(v): return (v-[0,floor,0])*scale
    glb = GLB(); hidden = set(); parts = []
    for category,stem in [('clothes',suit),('clothes',shoes),('hair',hair)]:
        path = ASSETS/category/stem/stem
        _, uv, faces = obj(path.with_suffix('.obj'))
        coords, weights, mask = fit(path.with_suffix('.mhclo'),body)
        hidden.update(mask)
        texture = TEX/'proxies'/category/stem/'textures'/(stem+'_diffuse.png')
        tint = [.24,.24,.24] if stem == shoes else None
        if stem == 'female_elegantsuit01': tint = [.42,.43,.46] if name=='mother' else [.50,.48,.49]
        if stem == 'male_elegantsuit01' and name=='friend': tint = [.78,.85,1]
        if category=='hair' and name in ['father','mother']: tint = [1.15]*3 if name=='father' else [.65]*3
        material = glb.material(texture,stem, hair=category=='hair',desaturate=category=='clothes' or name in ['father','mother'],tint=tint)
        parts.append((stem,transform(coords),uv,faces,weights,material))
    # Remove occluded hip/thigh skin, including garment-boundary slivers.
    if 'female' in macro:
        posed = transform(body)
        hidden.update(np.where((posed[:,1]>height*.37)&(posed[:,1]<height*.65)&(np.abs(posed[:,0])<.24))[0].tolist())
    material = glb.material(TEX/'skins'/skin/'textures'/skinfile,'Skin / '+skin)
    glb.mesh('Anatomy / '+name,transform(body),BASE_UV,BASE_FACES,BW,material,hidden,True)
    for args in parts: glb.mesh(*args)
    _, uv, faces = obj(CORE/'eyes/high-poly/high-poly.obj')
    coords, weights, _ = fit(CORE/'eyes/high-poly/high-poly.mhclo',body)
    # The source has transparent corneal shells; opaque mode makes black sockets.
    eye = glb.material(CORE/'eyes/materials/brown_eye.png','Eyes',hair=True)
    glb.j['materials'][eye]['pbrMetallicRoughness']['roughnessFactor'] = .28
    glb.mesh('Eyes',transform(coords),uv,faces,weights,eye)
    glb.rig(transform(body))
    glb.j['nodes'][0]['extras'] = {'profile':name,'height':height,'version':51}
    path=OUT/(name+'.glb');glb.save(path)
    triangles = sum(glb.j['accessors'][m['primitives'][0]['indices']]['count']//3 for m in glb.j['meshes'])
    manifest.append({'id':name,'file':name+'.glb','height':height,'bytes':path.stat().st_size,'triangles':triangles,'bones':len(BONES)})
    print(name,path.stat().st_size,triangles)
(OUT/'manifest.json').write_text(json.dumps({'version':51,'cast':manifest},indent=2)+'\n')
(SOURCE/'used-files.json').write_text(json.dumps(sorted(str(p.relative_to(SOURCE)) for p in USED),indent=2))
