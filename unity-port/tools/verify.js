// ═══════════════════════════════════════════════════════════════════════════
//  ГЛУБОКАЯ ПРОВЕРКА C# БЕЗ КОМПИЛЯТОРА
//  Ловим то, что реально ломает сборку: обращения к несуществующим
//  членам, неверные namespace, поля JSON без пары в C#, битые типы.
// ═══════════════════════════════════════════════════════════════════════════
const fs=require('fs'), path=require('path');
const ROOT=path.join(__dirname,'..','Assets','Scripts');
const SA=path.join(__dirname,'..','Assets','StreamingAssets');
let err=0, warn=0;

const files={};
(function walk(d){for(const f of fs.readdirSync(d)){const p=path.join(d,f);
  if(fs.statSync(p).isDirectory())walk(p); else if(f.endsWith('.cs'))files[p]=fs.readFileSync(p,'utf8');}})(ROOT);

function strip(src){
  let o='',i=0;
  while(i<src.length){const c=src[i],n=src[i+1];
    if(c==='/'&&n==='/'){while(i<src.length&&src[i]!=='\n')i++;continue;}
    if(c==='/'&&n==='*'){i+=2;while(i<src.length&&!(src[i]==='*'&&src[i+1]==='/'))i++;i+=2;continue;}
    if(c==='"'){i++;while(i<src.length){if(src[i]==='\\'){i+=2;continue;}if(src[i]==='"'){i++;break;}i++;}o+='""';continue;}
    if(c==="'"){i++;while(i<src.length){if(src[i]==='\\'){i+=2;continue;}if(src[i]==="'"){i++;break;}i++;}o+="''";continue;}
    o+=c;i++;}
  return o;
}

const all=Object.entries(files).map(([p,s])=>[p,strip(s)]);
const allCode=all.map(x=>x[1]).join('\n');

// ── 1. Собираем всё объявленное ──
const declared=new Set();
for(const m of allCode.matchAll(/\bclass\s+(\w+)/g))declared.add(m[1]);
for(const m of allCode.matchAll(/\bpublic\s+(?:static\s+)?(?:readonly\s+)?[\w<>\[\],\.\s]+?\s+(\w+)\s*[;=({]/g))declared.add(m[1]);
for(const m of allCode.matchAll(/\bpublic\s+[\w<>\[\]\.]+\s+(\w+)\s*=>/g))declared.add(m[1]);
for(const m of allCode.matchAll(/\bpublic\s+[\w<>\[\]\.]+\s+(\w+)\s*\{\s*get/g))declared.add(m[1]);
for(const m of allCode.matchAll(/\bvoid\s+(\w+)\s*\(/g))declared.add(m[1]);
for(const m of allCode.matchAll(/\bIEnumerator\s+(\w+)\s*\(/g))declared.add(m[1]);
for(const m of allCode.matchAll(/\bpublic\s+event\s+[\w<>]+\s+(\w+)/g))declared.add(m[1]);
for(const m of allCode.matchAll(/\benum\s+(\w+)/g))declared.add(m[1]);
// значения enum: enum WeatherType { Sunny, Rain, ... } — каждое имя
// внутри фигурных скобок тоже объявлено, иначе валидатор ругался
// на WeatherType.Sunny как на несуществующий член
for(const m of allCode.matchAll(/\benum\s+\w+\s*\{([^}]*)\}/g)){
  m[1].split(',').forEach(v=>{
    const name=v.trim().split(/[\s=]/)[0];
    if(name)declared.add(name);
  });
}

// ── 2. Проверяем обращения вида Класс.Член ──
const known=new Set(['I','Instance','Count','Length','transform','gameObject','position',
 'rotation','localPosition','localScale','localEulerAngles','eulerAngles','name','color',
 'text','main','deltaTime','time','identity','zero','one','up','forward','right','black',
 'white','isMobilePlatform','streamingAssetsPath','Success','Log','LogWarning','LogError',
 'FromJson','ToJson','Find','Destroy','Instantiate','CreatePrimitive','Lerp','Slerp',
 'Clamp','Clamp01','Min','Max','Abs','Sqrt','Sin','Cos','Exp','Atan2','Round','Floor',
 'RoundToInt','FloorToInt','PI','Deg2Rad','Rad2Deg','magnitude','sqrMagnitude','normalized',
 'x','y','z','w','a','r','g','b','activeSelf','enabled','sharedMesh','sharedMaterial',
 'material','materials','bounds','vertices','triangles','parameters','type','realtimeSinceStartup',
 'GetHex','getHex','SetActive','AddComponent','GetComponent','GetComponentInChildren',
 'GetComponentsInChildren','SetParent','LookAt','Rotate','Translate','Move','isGrounded',
 'height','radius','center','size','result','downloadHandler','error','Get','SendWebRequest',
 'Exists','ReadAllText','Combine','HasKey','GetString','SetString','Save','Contains',
 'Add','Remove','Clear','TryGetValue','ContainsKey','Keys','Values','ToArray','ConvertAll',
 'Invoke','AddListener','onClick','alpha','sortingOrder','renderMode','anchorMin','anchorMax',
 'offsetMin','offsetMax','pivot','anchoredPosition','sizeDelta','font','fontSize','alignment',
 'targetGraphic','showMaskGraphic','viewport','content','horizontal','scrollSensitivity',
 'spacing','childAlignment','childControlHeight','childForceExpandHeight','verticalFit',
 'uiScaleMode','referenceResolution','matchWidthOrHeight','shadows','intensity','isStatic',
 'indexFormat','UInt32','layer','blocksRaycasts','horizontalOverflow','verticalOverflow',
 'TryParseHtmlString','GetBuiltinResource','worldCamera','localToWorldMatrix','matrixWorld',
 'phase','fingerId','touchCount','GetTouch','width','height','lockState','visible']);

let checked=0;
for(const [p,code] of all){
  for(const m of code.matchAll(/\b([A-Z]\w+)\.(\w+)/g)){
    const [,cls,mem]=m;
    // интересуют только НАШИ классы
    if(!declared.has(cls))continue;
    if(known.has(mem))continue;
    // методы стандартных коллекций (List/Dictionary) — не наши члены
    if(/^(AddRange|FindAll|FindIndex|Sort|Reverse|Insert|RemoveAt|RemoveAll|Exists|IndexOf|CopyTo|GetRange|TrueForAll|ForEach|BinarySearch|AsReadOnly)$/.test(mem))continue;
    checked++;
    if(!declared.has(mem)){
      console.log(`  ✗ ${path.relative(ROOT,p)}: ${cls}.${mem} — член не объявлен`);
      err++;
    }
  }
}
console.log(`  проверено обращений Класс.Член: ${checked}`);

// ── 3. namespace vs using ──
const ns=new Set();
for(const m of allCode.matchAll(/namespace\s+([\w.]+)/g))ns.add(m[1]);
for(const [p,code] of all){
  for(const m of code.matchAll(/using\s+(Fantazia[\w.]*)\s*;/g)){
    if(!ns.has(m[1])){console.log(`  ✗ ${path.relative(ROOT,p)}: using ${m[1]} — нет такого namespace`);err++;}
  }
}

// ── 4. JSON ↔ C# модели ──
function checkModel(jsonFile, csFile, cls){
  const jp=path.join(SA,jsonFile);
  if(!fs.existsSync(jp))return;
  let data=JSON.parse(fs.readFileSync(jp,'utf8'));
  if(!Array.isArray(data))data=[data];
  if(!data.length)return;
  const cs=fs.readFileSync(path.join(ROOT,csFile),'utf8');
  const body=cs.slice(cs.indexOf('class '+cls));
  const end=body.indexOf('\n    }');
  const decl=body.slice(0,end>0?end:2000);
  const missing=Object.keys(data[0]).filter(k=>!new RegExp('\\b'+k+'\\b').test(decl));
  if(missing.length){
    console.log(`  ✗ ${jsonFile} → ${cls}: нет полей ${missing.join(', ')}`);err++;
  } else console.log(`  ✓ ${jsonFile} ↔ ${cls} (${Object.keys(data[0]).length} полей)`);
}

console.log('\nСООТВЕТСТВИЕ JSON И C#:');
checkModel('city_part0.json','World/WorldBuilder.cs','MeshRec');
checkModel('city_colliders.json','World/WorldBuilder.cs','BuildingRec');
checkModel('city_interactables.json','World/WorldBuilder.cs','InterRec');
checkModel('cosmetics.json','Core/GameData.cs','CosmeticItem');
checkModel('rarities.json','Core/GameData.cs','RarityDef');
checkModel('world.json','Core/GameData.cs','WorldCfg');

// ── 5. размеры данных ──
console.log('\nОБЪЁМ ДАННЫХ:');
let total=0;
for(const f of fs.readdirSync(SA)){
  const sz=fs.statSync(path.join(SA,f)).size;
  total+=sz;
  if(sz>200000)console.log(`  ${f.padEnd(26)} ${(sz/1024).toFixed(0)} КБ`);
}
console.log(`  всего: ${(total/1024/1024).toFixed(2)} МБ`);

console.log(`\nОшибок: ${err}, предупреждений: ${warn}`);
process.exit(err?1:0);
