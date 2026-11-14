'use strict';
const crypto = require('node:crypto');
const {cookieCodec} = require('./closed-runtime.cjs');
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const UID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const denied = () => Object.assign(Error('launcher_code_denied'), {status: 403});
function normalizeCode(raw) {
  if (typeof raw !== 'string' || raw.length > 64) throw denied();
  const code = raw.trim().toUpperCase().replace(/[\s-]/g, '');
  if (!/^FZ[A-HJ-NP-Z2-9]{16}$/.test(code)) throw denied();
  return code;
}
function validToken(token) {
  return typeof token === 'string' && token.length <= 5000 && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token);
}
class LauncherCodes {
  constructor({store, access, secret, randomBytes = crypto.randomBytes}) {
    this.store = store; this.access = access; this.secret = secret;
    this.codec = cookieCodec(secret); this.randomBytes = randomBytes;
  }
  hash(code) { return crypto.createHmac('sha256', this.secret).update('fantazia-launcher-login-v1\0' + code).digest('hex'); }
  available() { if (this.store.failed) throw Object.assign(Error('store_unavailable'), {status:503}); }
  async issue(token) {
    this.available();
    if (!validToken(token)) throw denied();
    // Fresh GoTrue identity + MAIN profile + approval/owner checks. Never trust client UID/role.
    const who = await this.access.check({access_token:token}, {fresh:true});
    if (!UID.test(who.id)) throw denied();
    const raw = Array.from(this.randomBytes(16), b => ALPHABET[b & 31]).join('');
    const code = 'FZ-' + raw.match(/.{4}/g).join('-');
    // No refresh token is copied from the launcher: its MAIN session stays independent.
    const sealed = this.codec.seal({access_token:token, main_uid:who.id});
    if (sealed.length > 3800) throw denied(); // Fit the existing secure browser cookie.
    const result = await this.store.rpc('fantazia_launcher_code_issue', {
      p_main_uid:who.id, p_code_hash:this.hash(normalizeCode(code)), p_sealed_session:sealed,
    });
    if (!result || !Number.isFinite(Date.parse(result.expires_at))) throw Error('Invalid code-store response');
    return {ok:true, code, expires_at:result.expires_at, expires_in:120};
  }
  async redeem(raw) {
    this.available();
    const code = normalizeCode(raw);
    const result = await this.store.rpc('fantazia_launcher_code_consume', {p_code_hash:this.hash(code)});
    if (!result || !UID.test(result.main_uid)) throw denied();
    const session = this.codec.read(result.sealed_session);
    if (!session || session.main_uid !== result.main_uid || !validToken(session.access_token)) throw denied();
    // A revoked/expired MAIN session or a changed approval cannot be replayed from the code.
    const who = await this.access.check({access_token:session.access_token}, {fresh:true});
    if (who.id !== result.main_uid) throw denied();
    return {access_token:session.access_token};
  }
}
function installLauncherLogin({app, codes, ownOrigin, setCookie, now = Date.now}) {
  const limits = new Map();
  function limited(req, res, scope, maximum) {
    const t = now();
    for (const [key, row] of limits) if (t-row.since >= 300000) limits.delete(key);
    const key = scope + ':' + req.ip;
    if (!limits.has(key) && limits.size >= 500) { res.status(429).send('Повтори позже.'); return true; }
    const row = limits.get(key) || {since:t,count:0}; row.count++; limits.set(key,row);
    if (row.count > maximum) { res.setHeader('Retry-After','300'); res.status(429).send('Слишком много попыток. Подожди пять минут.'); return true; }
    return false;
  }
  // Only this bearer-token endpoint permits cross-origin launcher requests. Cookies are not credentials here.
  const cors = (_req,res,next) => {
    res.setHeader('Access-Control-Allow-Origin','*');
    res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');
    res.setHeader('Cache-Control','no-store'); next();
  };
  app.options('/closed/launcher-code', cors, (_req,res) => res.sendStatus(204));
  app.post('/closed/launcher-code', cors, async (req,res) => {
    if (limited(req,res,'issue',12)) return;
    const match = /^Bearer ([^\s]+)$/.exec(req.headers.authorization || '');
    if (!match || !validToken(match[1])) return res.status(401).json({ok:false,error:'main_session_required'});
    try { res.json(await codes.issue(match[1])); }
    catch { res.status(403).json({ok:false,error:'Выдача кода не подтверждена. Проверь MAIN-вход и допуск Fantazia; повторный код можно получить через 30 секунд.'}); }
  });
  app.post('/closed/launcher-login', async (req,res) => {
    if (!ownOrigin(req)) return res.status(403).send('origin_denied');
    if (limited(req,res,'redeem',8)) return;
    try { const session = await codes.redeem(req.body?.code); setCookie(res,session); res.redirect(303,'/'); }
    catch { res.status(403).type('text').send('Код недействителен, уже использован или допуск отозван. Получи новый код в TemkaLauncher и введи его в течение двух минут.'); }
  });
}
module.exports = {LauncherCodes, installLauncherLogin, normalizeCode, validToken};
