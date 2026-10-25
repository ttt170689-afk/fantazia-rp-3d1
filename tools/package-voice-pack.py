#!/usr/bin/env python3
"""Pack separate voice assets and extend the existing asset-only handoff.
Requires mutagen for MP3 metadata. Does not alter the original 150-file ZIP.
"""
from pathlib import Path
import argparse, csv, hashlib, io, json, zipfile
from mutagen.mp3 import MP3
ROOT=Path(__file__).resolve().parents[1]
SRC=ROOT/'resources/voice-pack-01'
BASE=ROOT/'dropbox/Fantazia-Assets-150.zip'
DEST=ROOT/'dropbox'

def sha(b):return hashlib.sha256(b).hexdigest()
def csv_bytes(rows, fields):
    stream=io.StringIO(newline='');w=csv.DictWriter(stream,fieldnames=fields);w.writeheader();w.writerows(rows)
    return stream.getvalue().encode('utf-8-sig')
def package(name,prefix,payload,metadata):
    manifest={n:{'bytes':len(b),'sha256':sha(b),**metadata.get(n,{})}for n,b in payload.items()}
    payload={**payload,'MANIFEST.json':json.dumps({'file_count':len(payload)+1,'files':manifest},ensure_ascii=False,indent=2).encode()}
    path=DEST/name
    with zipfile.ZipFile(path,'w',zipfile.ZIP_DEFLATED,compresslevel=9)as z:
        for n,b in sorted(payload.items()):z.writestr(prefix+'/'+n,b)
    with zipfile.ZipFile(path)as z:
        assert z.testzip() is None and len(z.namelist())==len(payload)
        for n,m in manifest.items():assert sha(z.read(prefix+'/'+n))==m['sha256']
    print(name, len(payload),'files;',path.stat().st_size,'bytes; CRC/SHA256 verified')
    return path

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--revoice',action='store_true');args=parser.parse_args()
    source=ROOT/'resources/voice-pack-01-revoice' if args.revoice else SRC
    small_name='Fantazia-Voice-Pack-01-NEW-VOICES' if args.revoice else 'Fantazia-Voice-Pack-01'
    full_name='Fantazia-Assets-NEW-VOICES' if args.revoice else 'Fantazia-Assets-Voice01'
    male='voice-04' if args.revoice else 'voice-02'
    female='voice-05' if args.revoice else 'voice-03'
    clips=json.loads((source/'catalog.json').read_text())['clips'];assert len(clips)==10
    rows=[];new_audio={};duration=0
    for c in clips:
        p=source/'audio'/(c['id']+'.mp3');data=p.read_bytes();d=MP3(p).info.length;assert d>2
        assert data not in new_audio.values()
        duration+=d;name='audio/'+p.name;new_audio[name]=data
        rows.append({'id':c['id'],'role':c['role'],'voice_id':c['voice_id'],'direction':c['direction'],'original_id':c['original_id'] or '',
                     'text':c['text'],'audio_file':name,'duration_seconds':round(d,3),'loop':'false'})
    fields=list(rows[0]);table=csv_bytes(rows,fields)
    readme=f'''FANTAZIA — ДИАЛОГИ С ХАРАКТЕРОМ, ПАКЕТ 01
23.10.2026. Только ресурсы для самостоятельного подключения в Godot.

10 отдельных MP3, суммарно {duration:.1f} секунды. Не аудиокнига и не один длинный трек.
Мужской голос {male} и женский голос {female} выбраны пользователем в отдельных пробах.
voice-01 из прежних объявлений метро не заменён.

8 расширенных NPC-реплик: торговец (2), рабочий (2), покупатель (1), турист (2), прохожий (1).
2 новых сценических реплики: предупреждение у лаборатории и облегчение после выхода.
Тексты специально расширены и расставлены паузы/вопросы/восклицания.
Направления исполнения: восторг, усталость, ирония, загадочность, тревога, забота, облегчение.
Это сгенерированный AI-голос; направления в таблице — творческое намерение,
не измеренная гарантия актёрской эмоции. Отдельного параметра управления эмоцией у генератора нет.

DIALOGUES.csv: ID, роль, выбранный голос, направление, исходный NPC ID,
полный текст записи, путь, длительность и loop=false. Для новых сцен original_id пуст.
Для голоса — AudioStreamPlayer/AudioStreamPlayer3D, без зацикливания.
Воспроизводи одну реплику за раз, субтитры бери из text. Игровой код не подключался.

В пакете 13 файлов: 10 MP3 + DIALOGUES.csv + README_RU.txt + MANIFEST.json.
Это первая партия, а НЕ озвучка всех текстов игры: из исходных 28 NPC-реплик
озвучены 8 расширенных вариантов, ещё 20 остаются без записи.
Лабораторное предупреждение — новый сценарный текст, не обещание существующей механики.
Исходные 11 записей/музыка/SFX/GLB не дублируются в этом маленьком ZIP;
они сохранены в отдельном общем {full_name}.zip.
Готового Godot-проекта, сайта, сервера и установщиков здесь нет.
Все MP3 проверены декодированием на ненулевой сигнал; эмоциональность проверяй прослушиванием.
MANIFEST.json содержит SHA256 и размеры файлов, кроме самого manifest.
'''
    if args.revoice:
        readme=readme.replace('Тексты специально расширены и расставлены паузы/вопросы/восклицания.', 'Тексты переписаны в более сдержанной разговорной манере.')
        readme=readme.replace('Направления исполнения: восторг, усталость, ирония, загадочность, тревога, забота, облегчение.', 'Направления исполнения: спокойный интерес, усталость, сухая ирония, осторожность, забота, облегчение.')
        readme='''НОВАЯ ОЗВУЧКА — ЗАМЕНА ПРЕЖНИХ 10 РЕПЛИК
Голоса voice-02/voice-03 в этот ZIP НЕ входят.
Имена MP3 и ID сохранены: заменяй соответствующие старые файлы, а не добавляй их вторыми копиями.

'''+readme
    standalone={**new_audio,'DIALOGUES.csv':table,'README_RU.txt':readme.encode()}
    meta={r['audio_file']:{'kind':'recorded_ai_voice','voice_id':r['voice_id'],'duration':r['duration_seconds'],'loop':False}for r in rows}
    package(small_name+'.zip',small_name,standalone,meta)
    with zipfile.ZipFile(BASE)as z:
        assert z.testzip() is None
        pref='Fantazia-Assets-150/';payload={n[len(pref):]:z.read(n)for n in z.namelist() if n.startswith(pref)}
    original_manifest=json.loads(payload.pop('MANIFEST.json'))
    for n,m in original_manifest['files'].items():assert sha(payload[n])==m['sha256']
    old_rows=list(csv.DictReader(io.StringIO(payload['DIALOGUES.csv'].decode('utf-8-sig'))))
    byid={r['id']:r for r in old_rows}
    for r in old_rows:
        r['original_text']=r['text_or_subtitle'];r['voice_id']='voice-01' if r['voice_status']=='recorded' else '';r['direction']=''
    final_meta={n:{k:v for k,v in m.items()if k not in ['sha256','bytes']}for n,m in original_manifest['files'].items()}
    full_rows=[]
    for r in rows:
        name='audio/voice/dialogues/pack01/'+r['id']+'.mp3';payload[name]=new_audio[r['audio_file']]
        final_meta[name]={**meta[r['audio_file']],'origin':'New selected character voice; pack01'}
        full_rows.append({**r,'audio_file':name})
        old=byid.get(r['original_id'])
        if old is None:
            old={'id':r['id'],'role':r['role'],'original_text':''};old_rows.append(old)
        old.update(text_or_subtitle=r['text'],audio_file=name,voice_status='recorded_expanded' if r['original_id'] else 'recorded_new_scene',
                   source='Voice pack 01; expanded original NPC line' if r['original_id'] else 'Voice pack 01; new optional scene',voice_id=r['voice_id'],direction=r['direction'])
    assert len(old_rows)==41 and sum(r['voice_status']=='not_recorded' for r in old_rows)==20
    payload['DIALOGUES.csv']=csv_bytes(old_rows,['id','role','text_or_subtitle','audio_file','voice_status','source','original_text','voice_id','direction'])
    payload['VOICE_PACK_01.csv']=csv_bytes(full_rows,fields)
    payload['VOICE_PACK_01.txt']=readme.encode()
    text=payload['README_RU.txt'].decode()
    text=text.replace('150 файлов: 128 SFX WAV + 11 записей голоса MP3 + 3 музыкальные петли WAV + 4 GLB + 4 файла описаний.',
                      '162 файла: 128 SFX WAV + 21 запись голоса MP3 + 3 музыкальные петли WAV + 4 GLB + 6 файлов описаний.')
    start=text.index('ДИАЛОГИ — ВАЖНО');end=text.index('\nВ GODOT 4',start)
    text=text[:start]+'''ДИАЛОГИ — ВАЖНО
  Добавлен VOICE PACK 01: 10 новых MP3 в audio/voice/dialogues/pack01/.
  8 расширенных реплик исходных NPC + 2 новых сценических реплики.
  VOICE_PACK_01.csv содержит полные тексты новых записей, голоса и направления исполнения.
  DIALOGUES.csv: 41 строка — 28 исходных NPC ID, 11 прежних объявлений, 2 новых сцены.
  У 20 NPC-реплик всё ещё НЕТ озвучки: voice_status=not_recorded, audio_file пустой.
  Поле original_text сохраняет прежнюю строку, text_or_subtitle — новый текст/субтитр.
  Прежние 11 субтитров могут быть короче произнесённой фразы.
  Это не все надписи интерфейса/квестов. Механики новых сцен нужно реализовать самостоятельно.
''' +text[end:]
    if args.revoice:text='НОВАЯ ПАРА ГОЛОСОВ — 10 РЕПЛИК ЗАМЕНЕНЫ, НЕ ПРОДУБЛИРОВАНЫ.\nПрежние voice-02/voice-03 исключены, использованы voice-04/voice-05.\n\n'+text
    payload['README_RU.txt']=text.encode()
    assert len(payload)==161
    assert sum(n.endswith('.mp3')for n in payload)==21
    for r in old_rows:
        if r['audio_file']:assert r['audio_file'] in payload
    package(full_name+'.zip',full_name,payload,final_meta)
    print('New speech:',round(duration,2),'seconds; NPC coverage 8/28; remaining 20 explicitly unrecorded.')

if __name__=='__main__':main()
