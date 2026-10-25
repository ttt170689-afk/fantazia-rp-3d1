#!/usr/bin/env python3
"""Asset-only handoff: original audio/rigs + standalone designed SFX. No Godot project.
Requires numpy. Optional --validation points at a gltf-validator report for the ORIGINAL files.
Writes only ignored dropbox/ files; does not modify runtime assets.
"""
import argparse, csv, hashlib, io, json, re, shutil, struct, wave, zipfile
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT/'dropbox'/'Fantazia-Assets-150'
RATE = 44100
records = {}

def sha(b): return hashlib.sha256(b).hexdigest()
def register(name, **meta): records[name] = meta

def wav(name, x, loop=False, description=''):
    x = np.asarray(x, dtype=float)
    assert np.isfinite(x).all() and np.max(np.abs(x)) > 1e-8
    x -= x.mean()
    if not loop:
        n=min(round(.006*RATE),len(x)//4)
        x[:n]*=np.linspace(0,1,n);x[-n:]*=np.linspace(1,0,n)
    peak = .32 if loop else .66
    x *= peak/max(np.max(np.abs(x)),1e-9)
    p=OUT/'audio/sfx'/f'{name}.wav';p.parent.mkdir(parents=True,exist_ok=True)
    with wave.open(str(p),'wb') as f:
        f.setnchannels(1);f.setsampwidth(2);f.setframerate(RATE);f.writeframes(np.round(x*32767).astype('<i2').tobytes())
    register(p.relative_to(OUT).as_posix(),kind='sfx',duration=len(x)/RATE,loop=loop,
             description=description,origin='New offline procedural synthesis; not a field recording')

def noise(rng,n,cutoff):
    spectrum=np.fft.rfft(rng.normal(0,1,n))
    f=np.fft.rfftfreq(n,1/RATE)
    spectrum*=1/np.sqrt(1+(f/max(30,cutoff))**6)
    spectrum[0]=0
    return np.fft.irfft(spectrum,n)

def tone(t,hz,end=None):
    if end is None:return np.sin(2*np.pi*hz*t)
    return np.sin(2*np.pi*(hz*t+(end-hz)*t*t/(2*max(t[-1],.001))))

def transient(kind,dur,freq,seed):
    rng=np.random.default_rng(seed);t=np.arange(round(dur*RATE))/RATE
    n=noise(rng,len(t),freq*5);attack=1-np.exp(-t*450)
    if kind=='roar':
        carrier=tone(t,freq,freq*.6)+.4*tone(t,freq*2)+.2*tone(t,freq*3)
        x=(carrier*.45+n*.9)*(np.sin(np.pi*t/dur)**.6)*(.7+.3*np.sin(2*np.pi*7*t))
    elif kind=='pulse_loop':
        return (tone(t,freq)+tone(t,freq*2)*.2)*(.15+.85*np.sin(2*np.pi*2*t)**8)+n*.08
    elif kind=='breath_loop':
        return n*(.15+.85*np.sin(2*np.pi*t/dur)**2)+tone(t,freq)*.05
    elif kind=='impact': x=(n*.8+tone(t,freq,freq*.4)*.35)*np.exp(-t/(dur*.18))
    elif kind=='slide': x=n*(np.sin(np.pi*t/dur)**1.5)+.13*tone(t,freq,freq*.6)*np.exp(-t/dur)
    elif kind=='motor': x=(tone(t,freq,freq*2)*.35+tone(t,freq*2,freq*3)*.12+n*.2)*np.sin(np.pi*t/dur)
    elif kind=='spark': x=n*(np.sin(2*np.pi*37*t)>.4)*np.exp(-t/(dur*.3))+tone(t,freq,freq*.5)*.05
    elif kind=='alarm': x=(tone(t,freq)+tone(t,freq*1.5)*.3)*(np.sin(2*np.pi*3*t)>.05)*np.sin(np.pi*t/dur)
    elif kind=='chime':
        x=tone(t,freq)*np.exp(-t/(dur*.3))
        for at,ratio in [(dur*.22,1.25),(dur*.43,1.5)]:
            u=np.maximum(0,t-at);x+=.6*tone(u,freq*ratio)*np.exp(-u/(dur*.28))*(t>=at)
    else:x=(tone(t,freq,freq*.75)+tone(t,freq*2)*.12)*np.exp(-t/(dur*.22))
    return x*attack

def create_sfx():
    surfaces={'asphalt':(1600,90),'concrete':(2100,115),'tile':(3000,165),'metal':(4200,210),
              'wood':(1100,145),'gravel':(3300,65),'grass':(750,55),'water':(1700,75)}
    for si,(surface,(cut,hz)) in enumerate(surfaces.items()):
        for v in range(4):
            rng=np.random.default_rng(24000+si*10+v);dur=.2+v*.012;t=np.arange(round(dur*RATE))/RATE
            x=noise(rng,len(t),cut)*(1-np.exp(-t*600))*np.exp(-t/(.035+v*.002))
            x+=.22*tone(t,hz*(.94+v*.023),hz*.42)*np.exp(-t/.035)
            if surface in ['gravel','grass','water']:
                x+=noise(rng,len(t),cut*.6)*np.exp(-((t-.08)/.04)**2)*.35
            if surface=='metal':x+=.08*tone(t,480+v*19)*np.exp(-t/.10)
            wav(f'footsteps/{surface}_{v+1:02}',x,description=f'{surface}: distinct footfall take {v+1}; randomize takes in Godot')
    groups={
      'ui':[
        ('click','tone',.09,680),('back','tone',.14,420),('hover','tone',.06,980),('focus','tone',.12,740),
        ('confirm','chime',.65,660),('cancel','tone',.18,310),('error','alarm',.45,160),('purchase','chime',.9,880),
        ('notification','chime',.55,590),('panel_open','slide',.24,390),('panel_close','slide',.17,230),('toggle','impact',.08,210)],
      'doors':[
        ('wood_open','slide',.9,120),('wood_close','impact',.5,85),('steel_open','slide',1.3,380),('steel_close','impact',.65,150),
        ('glass_open','slide',.7,610),('glass_close','impact',.24,480),('cabinet_open','slide',.4,195),('cabinet_close','impact',.26,190),
        ('locker_open','slide',.8,470),('locker_close','impact',.45,250),('elevator_open','motor',1.5,90),('elevator_close','motor',1.8,70),
        ('lock','impact',.16,780),('unlock','impact',.23,920),('gate_start','motor',2.1,55),('gate_stop','impact',.8,110)],
      'metro':[
        ('arrival_brake','slide',2.4,620),('door_open','slide',1.2,190),('door_close','slide',1.3,230),('station_chime','chime',1.6,659),
        ('closing_warning','chime',.85,880),('motor_start','motor',3.4,48),('motor_stop','motor',2.8,85),('rail_joint','impact',.15,65),
        ('ticket_accept','chime',.45,1047),('ticket_denied','alarm',.48,220),('turnstile_pass','impact',.35,310),('departure_air','slide',1.9,145)],
      'lab':[
        ('power_on','motor',1.7,125),('power_off','motor',1.6,70),('spark_short','spark',.16,2100),('spark_long','spark',.7,1700),
        ('electric_shock','spark',.45,950),('keypad_press','tone',.09,1200),('keypad_accept','chime',.6,780),('keypad_reject','alarm',.7,180),
        ('alarm_short','alarm',1.4,730),('relay_click','impact',.12,550),('machine_start','motor',2.4,42),('machine_stop','motor',2,95)],
      'movement':[
        ('jump_takeoff','slide',.25,190),('land_soft','impact',.3,60),('land_hard','impact',.55,95),('whoosh_short','slide',.65,750),
        ('sky_descent','slide',2.3,480),('cloth_slide','slide',.38,550),('crouch_cloth','slide',.27,320),('ladder_step','impact',.23,180)],
      'combat':[
        ('monster_roar','roar',2.2,55),('monster_growl','roar',1.6,42),('claw_swing','slide',.5,850),('claw_hit','impact',.4,150),
        ('tail_swipe','slide',1.1,310),('monster_step','impact',.6,48),('monster_stunned','roar',.8,130),('monster_emerge','motor',2.8,35),
        ('sword_swing','slide',.45,1250),('sword_hit','impact',.4,1050),('punch_swing','slide',.25,470),('punch_hit','impact',.22,100),
        ('shield_block','impact',.7,670),('player_fall','impact',.8,55),('chase_pulse_loop','pulse_loop',8,55),('monster_breath_loop','breath_loop',8,42)],
      'props':[
        ('coin_pickup','chime',.45,1500),('coins_bag','spark',.65,1100),('key_pickup','impact',.3,1900),('item_pickup','chime',.36,540),
        ('flashlight_on','impact',.08,280),('flashlight_off','impact',.07,190),('sword_draw','slide',.9,1800),('sword_sheath','slide',.65,1050)]}
    seed=25000
    for group,items in groups.items():
        for name,kind,dur,freq in items:
            seed+=1;wav(group+'/'+name,transient(kind,dur,freq,seed),loop=name.endswith('_loop'),description=f'{group}/{name}: designed {kind} effect')
    amb=[('city_day',310,60),('city_night',150,45),('sky_clouds',750,0),('station_idle',190,53),
         ('train_tunnel',450,67),('park_breeze',580,0),('roof_wind',1100,0),('sea_shore',950,0),
         ('rain_light',2800,0),('rain_heavy',5200,0),('server_room',750,100),('mall_air',270,50)]
    for i,(name,cut,hz) in enumerate(amb):
        dur=12;t=np.arange(RATE*dur)/RATE;rng=np.random.default_rng(26000+i)
        x=noise(rng,len(t),cut)*(.65+.25*np.sin(2*np.pi*(i%3+1)*t/dur))
        if hz:x+=.12*tone(t,hz)+.04*tone(t,hz*2)
        if name=='sea_shore':x*=.3+.7*np.sin(2*np.pi*t/dur)**2
        wav('ambience/'+name+'_loop',x,loop=True,description=f'Synthetic {name} loop; no voices/field recordings')
    assert len(records)==128

def glb(path):
    data=path.read_bytes();magic,version,total=struct.unpack_from('<III',data)
    assert magic==0x46546c67 and version==2 and total==len(data)
    size,kind=struct.unpack_from('<II',data,12);assert kind==0x4e4f534a
    j=json.loads(data[20:20+size]);off=20+size
    n,kind=struct.unpack_from('<II',data,off);assert kind==0x004e4942
    return j,bytearray(data[off+8:off+8+n])

def repair_city(source,dest):
    """Archive-only compatibility fix: zero/invalid normals and missing UV default."""
    j,b=glb(source);fixed=0;uvs=0
    def view(ai):
        a=j['accessors'][ai];v=j['bufferViews'][a['bufferView']]
        dtype={5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'}[a['componentType']]
        width={'VEC3':3,'VEC2':2,'SCALAR':1}[a['type']]
        stride=v.get('byteStride',np.dtype(dtype).itemsize*width)
        return np.ndarray((a['count'],width),dtype=dtype,buffer=b,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(stride,np.dtype(dtype).itemsize))
    done=set()
    for mesh in j['meshes']:
        for p in mesh['primitives']:
            attrs=p['attributes'];ni=attrs.get('NORMAL')
            if ni is not None and ni not in done:
                normals=view(ni);length=np.linalg.norm(normals,axis=1);bad=~np.isfinite(length)|(np.abs(length-1)>.0001)
                if bad.any():
                    pos=view(attrs['POSITION']).copy();idx=view(p['indices']).flatten().copy() if 'indices' in p else np.arange(len(pos))
                    faces=idx[:len(idx)//3*3].reshape(-1,3);face=np.cross(pos[faces[:,1]]-pos[faces[:,0]],pos[faces[:,2]]-pos[faces[:,0]])
                    summed=np.zeros_like(pos)
                    for k in range(3):np.add.at(summed,faces[:,k],face)
                    for ii in np.flatnonzero(bad):
                        n=normals[ii].copy() if np.isfinite(length[ii]) and length[ii]>1e-8 else summed[ii]
                        mag=np.linalg.norm(n);normals[ii]=n/mag if mag>1e-8 else [0,1,0]
                    fixed+=int(bad.sum())
                    if 'min' in j['accessors'][ni]:j['accessors'][ni]['min']=normals.min(axis=0).tolist()
                    if 'max' in j['accessors'][ni]:j['accessors'][ni]['max']=normals.max(axis=0).tolist()
                done.add(ni)
    # Drop numpy buffer views before growing the binary buffer.
    del normals
    for mesh in j['meshes']:
        for p in mesh['primitives']:
            a=p['attributes'];m=j['materials'][p['material']] if 'material'in p else {}
            if 'TEXCOORD_0' not in a and ('baseColorTexture'in m.get('pbrMetallicRoughness',{}) or 'emissiveTexture'in m):
                n=j['accessors'][a['POSITION']]['count'];off=len(b);padding=(-off)%4;b.extend(b'\0'*padding);off=len(b)
                b.extend(b'\0'*(n*8));vi=len(j['bufferViews']);j['bufferViews'].append({'buffer':0,'byteOffset':off,'byteLength':n*8,'target':34962})
                ai=len(j['accessors']);j['accessors'].append({'bufferView':vi,'componentType':5126,'count':n,'type':'VEC2'})
                a['TEXCOORD_0']=ai;uvs+=1
    j['buffers'][0]['byteLength']=len(b);j.setdefault('asset',{})['extras']={'handoff_fix':'Normalize invalid normals; explicit zero UV for previously missing texture coordinates. Source file unchanged.'}
    txt=json.dumps(j,ensure_ascii=False,separators=(',',':')).encode();txt+=b' '*((-len(txt))%4);b.extend(b'\0'*((-len(b))%4))
    total=12+8+len(txt)+8+len(b)
    dest.write_bytes(struct.pack('<III',0x46546c67,2,total)+struct.pack('<II',len(txt),0x4e4f534a)+txt+struct.pack('<II',len(b),0x004e4942)+b)
    return {'repaired_normals':fixed,'primitives_with_default_zero_uv':uvs,'source_unchanged':True}

def create_pack(validation, final_validation):
    OUT.mkdir(parents=True,exist_ok=True);create_sfx()
    models=[]
    for source in sorted((ROOT/'public/exports').glob('*.glb'))+[ROOT/'public/world/fantazia_city.glb']:
        name='models/'+source.name;dest=OUT/name;dest.parent.mkdir(exist_ok=True)
        repair=repair_city(source,dest) if source.name=='fantazia_city.glb' else None
        if not repair:shutil.copyfile(source,dest)
        j,_=glb(dest)
        info={'file':name,'source':source.relative_to(ROOT).as_posix(),'source_sha256':sha(source.read_bytes()),'meshes':len(j.get('meshes',[])),
              'animations':[a.get('name','')for a in j.get('animations',[])],'repair':repair,'external_images':[i['uri']for i in j.get('images',[])if 'uri'in i]}
        if validation:
            r=validation.get(info['source'],{}).get('issues',{})
            info['original_validation']={k:r.get(k)for k in ['numErrors','numWarnings','truncated']}
        info['archive_validation']=final_validation.get(source.name, {'status':'not_run'})
        models.append(info);register(name,kind='glb',origin=info['source'],archive_only_repair=bool(repair))
    for category in ['city','metro','music']:
        for source in sorted((ROOT/'public/audio'/category).iterdir()):
            if source.suffix not in ['.wav','.mp3']:continue
            name=f'audio/{"voice/" if category!="music" else ""}{category}/{source.name}';dest=OUT/name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(source,dest)
            register(name,kind='music' if category=='music' else 'recorded_ai_voice',loop=category=='music',origin=source.relative_to(ROOT).as_posix())
    # Read only string literals from the finite NPC dialogue data block; never execute game code.
    s=(ROOT/'public/assets/fz-v8world.js').read_text();block=s.split('const DIALOGS = {',1)[1].split('\n};',1)[0]
    lines=[]
    for role,body in re.findall(r'(\w+):\s*\[([^\]]*)\]',block):
        for i,match in enumerate(re.finditer(r"'((?:[^'\\]|\\.)*)'",body)):
            lines.append([f'npc_{role}_{i+1:02}',role,match.group(1),'','not_recorded','public/assets/fz-v8world.js:DIALOGS'])
    assert len(lines)==28
    subtitles={
      'city/welcome':'Добро пожаловать в Фантазию. Твой город. Твой маршрут.',
      'city/sky':'Небесная площадь. Новости — у сцены. Белый свет у лестницы укажет дорогу вниз.',
      'city/city':'Открой меню, чтобы выбрать место для прогулки. Павильоны M ведут в метро.',
      'city/credit':'Создано при помощи TEMKA_PLAY_OFFICIAL. Фантазия. Твой город оживает.',
      'metro/arrival':'К платформе прибывает поезд Кольцевой линии. Отойдите от края платформы.',
      'metro/close':'Осторожно, двери закрываются. Следующая станция указана на табло.',
      'metro/center':'Станция «Центральная». Городская площадь · GRAND MALL.',
      'metro/factory':'Станция «Заводская». Промышленный район.',
      'metro/park':'Станция «Парковая». Городской парк.',
      'metro/port':'Станция «Портовая». Набережная.',
      'metro/business':'Станция «Деловая». Деловой район.'}
    for key,text in subtitles.items():lines.append([key.replace('/','_'),'announcer',text,'audio/voice/'+key+'.mp3','recorded','Existing in-game subtitle; not a verbatim transcript'])
    with (OUT/'DIALOGUES.csv').open('w',encoding='utf-8-sig',newline='')as f:
        w=csv.writer(f);w.writerow(['id','role','text_or_subtitle','audio_file','voice_status','source']);w.writerows(lines)
    (OUT/'MODELS.json').write_text(json.dumps(models,ensure_ascii=False,indent=2)+'\n')
    readme='''FANTAZIA — РЕСУРСЫ ДЛЯ САМОСТОЯТЕЛЬНОГО ПЕРЕНОСА В GODOT
23.10.2026. Это НЕ готовый проект Godot и НЕ архив сайта.

150 файлов: 128 SFX WAV + 11 записей голоса MP3 + 3 музыкальные петли WAV + 4 GLB + 4 файла описаний.

models/
  player_super.glb — персонаж, скелет и 27 анимаций/поз.
  monster_super.glb — монстр, скелет и 12 анимаций/поз.
  player_hold.glb — 5 дополнительных анимаций для скелета игрока, БЕЗ меша. Это не пустой файл.
  fantazia_city.glb — имеющийся исходный GLB города (349 мешей).
  Текстуры города встроены в GLB. У персонажей используются материалы без внешних текстур.
  В копии города исправлены некорректные нормали и добавлены нулевые UV там,
  где текстурированный материал не имел UV. Это воспроизводит выбор одной точки
  текстуры, а не восстанавливает отсутствующую развёртку. Исходник игры не менялся.
  Список клипов и происхождение — MODELS.json. Проверки glTF не равны тесту импорта Godot.
  Сохранены предупреждения об иерархии skinned meshes в исходных персонажах.
  Metro v23, небесная площадь, лаборатория и другие процедурные JS-объекты
  НЕ экспортированы в эти четыре GLB. Это не полный снимок браузерной сцены.

ЗВУК
  audio/music/ — 3 оригинальные инструментальные петли: 24, 26.67 и 20 секунд.
  audio/voice/city/ — 4 записи выбранным AI-голосом; audio/voice/metro/ — 7 объявлений.
  audio/sfx/ — 128 отдельных синтезированных WAV: 32 шага (8 поверхностей × 4 дубля),
  12 UI, 16 дверей, 12 метро, 12 лаборатории, 8 движений, 8 предметов, 16 боя/монстра, 12 атмосферных петель.
  Это программный звуковой дизайн, не полевые записи. Часть — новые варианты для Godot,
  а не дословный рендер всех старых WebAudio-функций. Нет копий под разными именами.
  Новые SFX: mono PCM16 / 44100 Hz; музыка сохранена stereo PCM16 / 22050 Hz.
  Пики SFX ограничены; общий микшер/3D-затухание настраиваешь сам.
  Файлы с _loop включай в режиме loop; шаги чередуй случайно, не запускай все сразу.

ДИАЛОГИ — ВАЖНО
  DIALOGUES.csv: все 28 реплик каталога NPC DIALOGS из fz-v8world.js + 11 субтитров к записям.
  У 28 NPC-реплик ещё НЕТ озвучки: voice_status=not_recorded, audio_file пустой.
  Не выдаём эти строки за готовое аудио. Субтитры к MP3 могут быть короче произнесённой фразы.
  Некоторые старые NPC-фразы упоминают отключённые события — при переносе можешь их заменить.
  Это не выгрузка всех надписей интерфейса и квестов. Новые голоса здесь не генерировались.

В GODOT 4
  Скопируй models/ и audio/ в свой проект; дождись импорта GLB, WAV и MP3.
  Для моделей проверь масштаб и клипы в Advanced Import. player_hold — библиотека
  для совместимого скелета, его нужно связать с player_super самостоятельно.
  Для звука используй AudioStreamPlayer/AudioStreamPlayer3D. Речь — без loop.
  Коллизии, навигацию, скрипты, материалы с особыми эффектами и звуковые шины создаёшь сам.
  Готовый project.godot, .tscn, сервер, аккаунты, node_modules, APK/EXE не приложены.
  В редакторе Godot этот архив не тестировался. Не обещается автоматический перенос логики.

MANIFEST.json: состав, назначение, loop, размеры и SHA256 (кроме самого manifest).
Существующие модели и записи скопированы из проекта пользователя; права на них не переоформляются.
'''
    (OUT/'README_RU.txt').write_text(readme)
    for name in ['DIALOGUES.csv','MODELS.json','README_RU.txt']:register(name,kind='metadata')
    for name,meta in records.items():
        data=(OUT/name).read_bytes();meta.update(bytes=len(data),sha256=sha(data))
    assert len(records)==149
    (OUT/'MANIFEST.json').write_text(json.dumps({'file_count':150,'files':records},ensure_ascii=False,indent=2)+'\n')
    # Never include stale or unrelated files from a previous run.
    names=sorted([*records,'MANIFEST.json']);dest=ROOT/'dropbox/Fantazia-Assets-150.zip'
    with zipfile.ZipFile(dest,'w',zipfile.ZIP_DEFLATED,compresslevel=9)as z:
        for name in names:z.write(OUT/name,'Fantazia-Assets-150/'+name)
    with zipfile.ZipFile(dest)as z:
        assert len(z.namelist())==150 and z.testzip()is None
        for name,meta in records.items():assert sha(z.read('Fantazia-Assets-150/'+name))==meta['sha256']
    print(dest, dest.stat().st_size, 'bytes; 150 files; CRC/SHA256 verified')

if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--validation',type=Path);ap.add_argument('--final-validation',type=Path);args=ap.parse_args()
    create_pack(json.loads(args.validation.read_text()) if args.validation else {}, json.loads(args.final_validation.read_text()) if args.final_validation else {})
