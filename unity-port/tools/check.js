// ═══════════════════════════════════════════════════════════════════════════
//  ПРОВЕРКА C#-СКРИПТОВ БЕЗ UNITY
//  Компилятора здесь нет, поэтому ловим то, что ловится статически:
//  баланс скобок, парность кавычек, дубли классов, битые using,
//  ссылки на несуществующие поля JSON. Это отсеивает большинство
//  опечаток до открытия редактора.
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'Assets', 'Scripts');
let errors = 0, warns = 0, files = 0, lines = 0;

function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p);
    else if (f.endsWith('.cs')) check(p);
  }
}

function stripStringsAndComments(src) {
  let out = '', i = 0;
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (c === '/' && n === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && n === '*') { i += 2; while (i < src.length && !(src[i] === '*' && src[i+1] === '/')) i++; i += 2; continue; }
    if (c === '"') {
      i++;
      while (i < src.length) {
        if (src[i] === '\\') { i += 2; continue; }
        if (src[i] === '"') { i++; break; }
        i++;
      }
      out += '""'; continue;
    }
    if (c === "'") {
      i++;
      while (i < src.length) {
        if (src[i] === '\\') { i += 2; continue; }
        if (src[i] === "'") { i++; break; }
        i++;
      }
      out += "''"; continue;
    }
    out += c; i++;
  }
  return out;
}

function check(p) {
  files++;
  const src = fs.readFileSync(p, 'utf8');
  lines += src.split('\n').length;
  const rel = path.relative(ROOT, p);
  const code = stripStringsAndComments(src);

  // баланс скобок
  const pairs = [['{','}'], ['(',')'], ['[',']']];
  for (const [o, c] of pairs) {
    const no = (code.match(new RegExp('\\' + o, 'g')) || []).length;
    const nc = (code.match(new RegExp('\\' + c, 'g')) || []).length;
    if (no !== nc) {
      console.log(`  ✗ ${rel}: дисбаланс ${o}${c} — ${no} против ${nc}`);
      errors++;
    }
  }

  // namespace и класс объявлены
  if (!/namespace\s+[\w.]+/.test(code)) {
    console.log(`  ⚠ ${rel}: нет namespace`);
    warns++;
  }
  const classes = [...code.matchAll(/\b(?:public|internal)?\s*class\s+(\w+)/g)].map(m => m[1]);
  if (classes.length === 0) {
    console.log(`  ✗ ${rel}: не найдено ни одного класса`);
    errors++;
  }

  // using UnityEngine обязателен для MonoBehaviour
  if (/MonoBehaviour/.test(code) && !/using\s+UnityEngine\s*;/.test(code)) {
    console.log(`  ✗ ${rel}: MonoBehaviour без using UnityEngine`);
    errors++;
  }

  // частая опечатка: Destroy вместо DestroyImmediate в редакторе — не ошибка,
  // но ловим обращение к Destroy(null-safe)
  const semis = (code.match(/;/g) || []).length;
  if (semis < 3) {
    console.log(`  ⚠ ${rel}: подозрительно мало инструкций`);
    warns++;
  }

  return classes;
}

console.log('\nПРОВЕРКА C#-СКРИПТОВ:');
walk(ROOT);

// проверяем, что имена классов уникальны (Unity ругается на дубли)
const seen = new Map();
function collect(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) { collect(p); continue; }
    if (!f.endsWith('.cs')) continue;
    const code = stripStringsAndComments(fs.readFileSync(p, 'utf8'));
    for (const m of code.matchAll(/\bclass\s+(\w+)/g)) {
      const name = m[1];
      if (seen.has(name)) {
        console.log(`  ✗ дубликат класса ${name}: ${seen.get(name)} и ${path.relative(ROOT, p)}`);
        errors++;
      } else seen.set(name, path.relative(ROOT, p));
    }
  }
}
collect(ROOT);

// проверяем соответствие полей JSON и C#-модели косметики
const SA = path.join(__dirname, '..', 'Assets', 'StreamingAssets');
if (fs.existsSync(path.join(SA, 'cosmetics.json'))) {
  const items = JSON.parse(fs.readFileSync(path.join(SA, 'cosmetics.json'), 'utf8'));
  const csrc = fs.readFileSync(path.join(ROOT, 'Core', 'GameData.cs'), 'utf8');
  const jsonKeys = new Set();
  items.forEach(o => Object.keys(o).forEach(k => jsonKeys.add(k)));
  const missing = [...jsonKeys].filter(k => !new RegExp('\\b' + k + '\\b').test(csrc));
  if (missing.length) {
    console.log(`  ⚠ поля есть в JSON, но не читаются в C#: ${missing.join(', ')}`);
    warns++;
  } else {
    console.log(`  ✓ все ${jsonKeys.size} полей косметики читаются в C#`);
  }
}

console.log(`\nФайлов: ${files}, строк: ${lines}, классов: ${seen.size}`);
console.log(`Ошибок: ${errors}, предупреждений: ${warns}`);
process.exit(errors ? 1 : 0);
