import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import * as fzstd from 'fzstd';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const BOT_TOKEN = (process.env.BOT_TOKEN || '').trim();
const DIST_DIR = path.join(__dirname, 'dist');
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
const CACHE_DIR = path.join(DATA_DIR, 'asset-cache');

const MAX_DAILY_LIMIT = 10;
const MAX_INIT_DATA_AGE_SEC = 86400;
const MAX_ASSET_BYTES = 15 * 1024 * 1024;
const MAX_JSON_BYTES = 2 * 1024 * 1024;
const MAX_MEM_CACHE_ITEMS = 1200;
const MAX_MEM_CACHE_BYTES = 256 * 1024 * 1024;
const MAX_CONCURRENT_UPSTREAM = 8;
const NEGATIVE_CACHE_TTL_MS = 60_000;

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

await fsp.mkdir(DATA_DIR, { recursive: true });
await fsp.mkdir(CACHE_DIR, { recursive: true });

function decompressZstdBuffer(compBuf) {
  if (typeof zlib.zstdDecompressSync === 'function') {
    return Buffer.from(zlib.zstdDecompressSync(compBuf));
  }
  return Buffer.from(fzstd.decompress(new Uint8Array(compBuf.buffer, compBuf.byteOffset, compBuf.byteLength)));
}

function normalizeRobloxBinaryModelBuffer(rawBuf) {
  if (!Buffer.isBuffer(rawBuf) || rawBuf.byteLength < 32) return rawBuf;
  if (rawBuf.subarray(0, 8).toString('ascii') !== '<roblox!') return rawBuf;

  let offset = 32;
  let hasZstd = false;
  const parts = [rawBuf.subarray(0, 32)];

  while (offset + 16 <= rawBuf.byteLength) {
    const chunkHeader = Buffer.from(rawBuf.subarray(offset, offset + 16));
    const chunkName = chunkHeader.subarray(0, 4).toString('ascii');
    const compressedLen = chunkHeader.readUInt32LE(4);
    const uncompressedLen = chunkHeader.readUInt32LE(8);
    offset += 16;

    if (chunkName === 'END\0') {
      parts.push(chunkHeader);
      if (offset < rawBuf.byteLength) {
        parts.push(rawBuf.subarray(offset));
      }
      break;
    }

    if (compressedLen === 0) {
      if (offset + uncompressedLen > rawBuf.byteLength) return rawBuf;
      parts.push(chunkHeader, rawBuf.subarray(offset, offset + uncompressedLen));
      offset += uncompressedLen;
    } else {
      if (offset + compressedLen > rawBuf.byteLength) return rawBuf;
      const compSlice = rawBuf.subarray(offset, offset + compressedLen);
      offset += compressedLen;

      if (
        compSlice.length >= 4 &&
        compSlice[0] === 0x28 &&
        compSlice[1] === 0xb5 &&
        compSlice[2] === 0x2f &&
        compSlice[3] === 0xfd
      ) {
        hasZstd = true;
        const rawChunk = decompressZstdBuffer(compSlice);
        const newHeader = Buffer.alloc(16);
        chunkHeader.subarray(0, 4).copy(newHeader, 0);
        newHeader.writeUInt32LE(0, 4);
        newHeader.writeUInt32LE(rawChunk.byteLength, 8);
        newHeader.writeUInt32LE(0, 12);
        parts.push(newHeader, rawChunk);
      } else {
        parts.push(chunkHeader, compSlice);
      }
    }
  }

  return hasZstd ? Buffer.concat(parts) : rawBuf;
}

let sqliteDb = null;
const jsonDbFile = path.join(DATA_DIR, 'users_db.json');
let jsonStore = {};

try {
  const { DatabaseSync } = await import('node:sqlite');
  sqliteDb = new DatabaseSync(path.join(DATA_DIR, 'rbx_studio.sqlite'));
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS users (
      tg_user_id TEXT PRIMARY KEY,
      saved_outfits TEXT NOT NULL DEFAULT '[]',
      daily_used INTEGER NOT NULL DEFAULT 0,
      daily_date TEXT NOT NULL DEFAULT '',
      linked_roblox_user TEXT NOT NULL DEFAULT '',
      updated_at INTEGER NOT NULL DEFAULT 0
    );
  `);
  console.log('[DB] SQLite (node:sqlite) initialized');
} catch {
  try {
    if (fs.existsSync(jsonDbFile)) {
      jsonStore = JSON.parse(await fsp.readFile(jsonDbFile, 'utf8'));
    }
  } catch {
    jsonStore = {};
  }
  console.log('[DB] Using persistent file store:', jsonDbFile);
}

const getTodayUtc = () => new Date().toISOString().slice(0, 10);

function getUserRecord(tgUserId) {
  const today = getTodayUtc();
  if (sqliteDb) {
    let row = sqliteDb.prepare('SELECT * FROM users WHERE tg_user_id = ?').get(tgUserId);
    if (!row) {
      sqliteDb
        .prepare(
          'INSERT INTO users (tg_user_id, saved_outfits, daily_used, daily_date, linked_roblox_user, updated_at) VALUES (?, ?, 0, ?, ?, ?)'
        )
        .run(tgUserId, '[]', today, '', Date.now());
      row = {
        tg_user_id: tgUserId,
        saved_outfits: '[]',
        daily_used: 0,
        daily_date: today,
        linked_roblox_user: ''
      };
    }
    const dailyUsed = row.daily_date === today ? Number(row.daily_used || 0) : 0;
    if (row.daily_date !== today) {
      sqliteDb
        .prepare('UPDATE users SET daily_used = 0, daily_date = ?, updated_at = ? WHERE tg_user_id = ?')
        .run(today, Date.now(), tgUserId);
    }
    let savedOutfits = [];
    try {
      savedOutfits = JSON.parse(row.saved_outfits || '[]');
    } catch {
      savedOutfits = [];
    }
    return {
      tgUserId,
      savedOutfits,
      remainingGens: Math.max(0, MAX_DAILY_LIMIT - dailyUsed),
      linkedRobloxUser: row.linked_roblox_user || ''
    };
  }

  if (!jsonStore[tgUserId]) {
    jsonStore[tgUserId] = {
      savedOutfits: [],
      dailyUsed: 0,
      dailyDate: today,
      linkedRobloxUser: ''
    };
  }
  const rec = jsonStore[tgUserId];
  if (rec.dailyDate !== today) {
    rec.dailyDate = today;
    rec.dailyUsed = 0;
  }
  return {
    tgUserId,
    savedOutfits: Array.isArray(rec.savedOutfits) ? rec.savedOutfits : [],
    remainingGens: Math.max(0, MAX_DAILY_LIMIT - Number(rec.dailyUsed || 0)),
    linkedRobloxUser: rec.linkedRobloxUser || ''
  };
}

async function saveUserRecord(tgUserId, patch) {
  const current = getUserRecord(tgUserId);
  const today = getTodayUtc();
  const nextSaved = Array.isArray(patch.savedOutfits)
    ? patch.savedOutfits.slice(0, 50)
    : current.savedOutfits;
  const nextRemaining =
    typeof patch.remainingGens === 'number'
      ? Math.max(0, Math.min(MAX_DAILY_LIMIT, patch.remainingGens))
      : current.remainingGens;
  const nextDailyUsed = MAX_DAILY_LIMIT - nextRemaining;
  const nextLinked =
    typeof patch.linkedRobloxUser === 'string'
      ? patch.linkedRobloxUser.slice(0, 40)
      : current.linkedRobloxUser;

  if (sqliteDb) {
    sqliteDb
      .prepare(
        'UPDATE users SET saved_outfits = ?, daily_used = ?, daily_date = ?, linked_roblox_user = ?, updated_at = ? WHERE tg_user_id = ?'
      )
      .run(JSON.stringify(nextSaved), nextDailyUsed, today, nextLinked, Date.now(), tgUserId);
  } else {
    jsonStore[tgUserId] = {
      savedOutfits: nextSaved,
      dailyUsed: nextDailyUsed,
      dailyDate: today,
      linkedRobloxUser: nextLinked
    };
    const tmpFile = `${jsonDbFile}.tmp`;
    await fsp.writeFile(tmpFile, JSON.stringify(jsonStore), 'utf8');
    await fsp.rename(tmpFile, jsonDbFile);
  }

  return getUserRecord(tgUserId);
}

function verifyTelegramInitData(initDataRaw) {
  if (!BOT_TOKEN) {
    return { ok: false, status: 500, error: 'На сервере не задана переменная окружения BOT_TOKEN' };
  }
  if (!initDataRaw || typeof initDataRaw !== 'string') {
    return {
      ok: false,
      status: 401,
      error: 'Доступ разрешён только внутри Telegram Mini App (отсутствует initData)'
    };
  }

  const params = new URLSearchParams(initDataRaw);
  const hash = params.get('hash');
  if (!hash || !/^[a-f0-9]{64}$/i.test(hash)) {
    return { ok: false, status: 401, error: 'Некорректная подпись Telegram initData' };
  }

  const authDate = Number(params.get('auth_date') || 0);
  const nowSec = Math.floor(Date.now() / 1000);
  if (!authDate || Math.abs(nowSec - authDate) > MAX_INIT_DATA_AGE_SEC) {
    return { ok: false, status: 401, error: 'Срок действия сессии Telegram initData истёк' };
  }

  const pairs = [];
  for (const [k, v] of params.entries()) {
    if (k !== 'hash') pairs.push([k, v]);
  }
  pairs.sort((a, b) => a[0].localeCompare(b[0]));
  const dataCheckString = pairs.map(([k, v]) => `${k}=${v}`).join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const computedHex = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  const hashBuf = Buffer.from(hash, 'hex');
  const compBuf = Buffer.from(computedHex, 'hex');
  if (hashBuf.length !== compBuf.length || !crypto.timingSafeEqual(hashBuf, compBuf)) {
    return { ok: false, status: 401, error: 'Подпись Telegram initData не прошла проверку' };
  }

  let tgUser = null;
  try {
    tgUser = JSON.parse(params.get('user') || 'null');
  } catch {
    tgUser = null;
  }
  if (!tgUser?.id) {
    return { ok: false, status: 401, error: 'В initData отсутствует пользователь Telegram' };
  }

  return { ok: true, user: tgUser };
}

const ipBuckets = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of ipBuckets.entries()) {
    if (entry.resetAt <= now) ipBuckets.delete(ip);
  }
}, 60_000).unref();

function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) {
    return fwd.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

function checkRateLimit(ip, maxRequests = 150, windowMs = 60_000) {
  const now = Date.now();
  let bucket = ipBuckets.get(ip);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    ipBuckets.set(ip, bucket);
  }
  bucket.count += 1;
  if (bucket.count > maxRequests) {
    return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  }
  return { allowed: true, retryAfterSec: 0 };
}

function assertAllowedAssetUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    const err = new Error('Некорректный URL редиректа Roblox');
    err.statusCode = 502;
    throw err;
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
    const err = new Error('Запрещённый протокол или параметры URL');
    err.statusCode = 403;
    throw err;
  }
  const host = parsed.hostname.toLowerCase();
  const isAllowed =
    host === 'assetdelivery.roblox.com' ||
    host === 'rbxcdn.com' ||
    host.endsWith('.rbxcdn.com');
  if (!isAllowed) {
    const err = new Error(`Домен ${host} запрещён политикой безопасности прокси`);
    err.statusCode = 403;
    throw err;
  }
  return parsed.toString();
}

async function readResponseWithLimit(response, maxBytes) {
  const declaredLen = Number(response.headers.get('content-length') || 0);
  if (declaredLen > maxBytes) {
    const err = new Error(`Размер файла (${declaredLen} байт) превышает лимит ${maxBytes} байт`);
    err.statusCode = 413;
    throw err;
  }

  if (!response.body) {
    return Buffer.alloc(0);
  }

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      const err = new Error(`Превышен лимит размера ответа (${maxBytes} байт)`);
      err.statusCode = 413;
      throw err;
    }
    chunks.push(Buffer.from(value));
  }

  return Buffer.concat(chunks, total);
}

let activeUpstreamFetches = 0;
const upstreamWaiters = [];

function acquireUpstreamSlot() {
  if (activeUpstreamFetches < MAX_CONCURRENT_UPSTREAM) {
    activeUpstreamFetches += 1;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    upstreamWaiters.push(() => {
      activeUpstreamFetches += 1;
      resolve();
    });
  });
}

function releaseUpstreamSlot() {
  activeUpstreamFetches = Math.max(0, activeUpstreamFetches - 1);
  const next = upstreamWaiters.shift();
  if (next) next();
}

const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchWithUpstreamRetry(url, init = {}, maxAttempts = 3) {
  let lastRes = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    await acquireUpstreamSlot();
    try {
      lastRes = await fetch(url, init);
    } finally {
      releaseUpstreamSlot();
    }

    if (
      lastRes.status !== 429 &&
      lastRes.status !== 502 &&
      lastRes.status !== 503 &&
      lastRes.status !== 504
    ) {
      return lastRes;
    }

    if (attempt < maxAttempts) {
      const retryAfterSec = Number(lastRes.headers.get('retry-after') || 0);
      const backoffMs =
        retryAfterSec > 0 ? Math.min(5000, retryAfterSec * 1000) : 450 * Math.pow(2, attempt - 1);
      await sleepMs(backoffMs);
    }
  }
  return lastRes;
}

async function fetchRobloxAssetSafely(startUrl) {
  let currentUrl = assertAllowedAssetUrl(startUrl);
  for (let hop = 0; hop < 5; hop += 1) {
    const res = await fetchWithUpstreamRetry(currentUrl, {
      redirect: 'manual',
      credentials: 'omit',
      headers: {
        'User-Agent': BROWSER_UA,
        Accept: '*/*'
      }
    });

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) {
        const err = new Error('Пустой заголовок Location при редиректе Roblox');
        err.statusCode = 502;
        throw err;
      }
      const nextResolved = new URL(loc, currentUrl).toString();
      currentUrl = assertAllowedAssetUrl(nextResolved);
      continue;
    }

    if (!res.ok) {
      const errBuf = await readResponseWithLimit(res, 65536).catch(() => Buffer.alloc(0));
      let detail = errBuf.toString('utf8').trim();
      try {
        const parsed = JSON.parse(detail);
        if (Array.isArray(parsed?.errors) && parsed.errors[0]?.message) {
          detail = parsed.errors[0].message;
        } else if (parsed?.message) {
          detail = parsed.message;
        }
      } catch {
      }
      const err = new Error(detail || `HTTP ${res.status} от Roblox`);
      err.statusCode = res.status;
      throw err;
    }

    const contentType = res.headers.get('content-type') || 'application/octet-stream';
    const rawBuf = await readResponseWithLimit(res, MAX_ASSET_BYTES);

    if (contentType.includes('application/json') || rawBuf[0] === 0x7b) {
      let jsonMeta = null;
      try {
        jsonMeta = JSON.parse(rawBuf.toString('utf8'));
      } catch {
        jsonMeta = null;
      }
      if (jsonMeta?.location) {
        currentUrl = assertAllowedAssetUrl(jsonMeta.location);
        continue;
      }
      if (Array.isArray(jsonMeta?.errors) && jsonMeta.errors[0]?.message) {
        const err = new Error(jsonMeta.errors[0].message);
        err.statusCode = 403;
        throw err;
      }
    }

    const normalizedBuf = normalizeRobloxBinaryModelBuffer(rawBuf);
    return { buffer: normalizedBuf, contentType };
  }

  const err = new Error('Слишком много редиректов при загрузке ассета Roblox');
  err.statusCode = 502;
  throw err;
}

const memAssetCache = new Map();
let memCacheBytes = 0;
const inFlightAssets = new Map();
const negativeAssetCache = new Map();

function putMemCache(id, entry) {
  if (memAssetCache.has(id)) {
    const old = memAssetCache.get(id);
    memCacheBytes -= old.buffer.byteLength;
    memAssetCache.delete(id);
  }
  while (
    (memAssetCache.size >= MAX_MEM_CACHE_ITEMS ||
      memCacheBytes + entry.buffer.byteLength > MAX_MEM_CACHE_BYTES) &&
    memAssetCache.size > 0
  ) {
    const oldestKey = memAssetCache.keys().next().value;
    const oldestVal = memAssetCache.get(oldestKey);
    memCacheBytes -= oldestVal.buffer.byteLength;
    memAssetCache.delete(oldestKey);
  }
  memAssetCache.set(id, entry);
  memCacheBytes += entry.buffer.byteLength;
}

async function getCachedOrFetchAsset(assetId) {
  const neg = negativeAssetCache.get(assetId);
  if (neg && neg.expiresAt > Date.now()) {
    const err = new Error(neg.message);
    err.statusCode = neg.statusCode;
    throw err;
  }

  if (memAssetCache.has(assetId)) {
    const hit = memAssetCache.get(assetId);
    memAssetCache.delete(assetId);
    memAssetCache.set(assetId, hit);
    return hit;
  }

  const binPath = path.join(CACHE_DIR, `${assetId}.bin`);
  const metaPath = path.join(CACHE_DIR, `${assetId}.meta.json`);
  try {
    if (fs.existsSync(binPath) && fs.existsSync(metaPath)) {
      const [rawBuffer, metaRaw] = await Promise.all([
        fsp.readFile(binPath),
        fsp.readFile(metaPath, 'utf8')
      ]);
      const meta = JSON.parse(metaRaw);
      const buffer = normalizeRobloxBinaryModelBuffer(rawBuffer);
      const entry = {
        buffer,
        contentType: meta.contentType || 'application/octet-stream'
      };
      putMemCache(assetId, entry);
      return entry;
    }
  } catch {
  }

  if (inFlightAssets.has(assetId)) {
    return inFlightAssets.get(assetId);
  }

  const promise = (async () => {
    try {
      const target = `https://assetdelivery.roblox.com/v1/asset/?id=${assetId}`;
      const fetched = await fetchRobloxAssetSafely(target);
      putMemCache(assetId, fetched);

      const tmpBin = `${binPath}.${process.pid}.tmp`;
      const tmpMeta = `${metaPath}.${process.pid}.tmp`;
      await fsp.writeFile(tmpBin, fetched.buffer);
      await fsp.writeFile(
        tmpMeta,
        JSON.stringify({ contentType: fetched.contentType, size: fetched.buffer.byteLength })
      );
      await fsp.rename(tmpBin, binPath);
      await fsp.rename(tmpMeta, metaPath);

      return fetched;
    } catch (err) {
      const code = Number(err?.statusCode) || 0;
      if (code === 401 || code === 403 || code === 404) {
        negativeAssetCache.set(assetId, {
          statusCode: code,
          message: String(err?.message || err),
          expiresAt: Date.now() + NEGATIVE_CACHE_TTL_MS
        });
      }
      throw err;
    } finally {
      inFlightAssets.delete(assetId);
    }
  })();

  inFlightAssets.set(assetId, promise);
  return promise;
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2'
};

const sendJson = (res, status, payload, extraHeaders = {}) => {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    ...extraHeaders
  });
  res.end(JSON.stringify(payload));
};

async function readJsonBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 131072) {
      const err = new Error('Тело запроса слишком большое');
      err.statusCode = 413;
      throw err;
    }
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function serveStaticFrontend(req, res, pathname) {
  const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  let filePath = path.join(DIST_DIR, safePath === '/' ? 'index.html' : safePath);

  if (!filePath.startsWith(DIST_DIR)) {
    return sendJson(res, 403, { error: 'Forbidden' });
  }

  let stat = fs.existsSync(filePath) ? fs.statSync(filePath) : null;
  if (!stat || stat.isDirectory()) {
    filePath = path.join(DIST_DIR, 'index.html');
    stat = fs.existsSync(filePath) ? fs.statSync(filePath) : null;
  }

  if (!stat) {
    res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Сборка фронтенда не найдена. Выполните npm run build перед запуском.');
  }

  const ext = path.extname(filePath).toLowerCase();
  const isHashedAsset = pathname.startsWith('/assets/');
  res.writeHead(200, {
    'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
    'Content-Length': stat.size,
    'Cache-Control': isHashedAsset ? 'public, max-age=31536000, immutable' : 'no-cache'
  });
  fs.createReadStream(filePath).pipe(res);
}

http
  .createServer(async (req, res) => {
    const urlObj = new URL(req.url, `http://localhost:${PORT}`);
    const pathname = urlObj.pathname;

    if (pathname === '/api/health' && req.method === 'GET') {
      return sendJson(res, 200, {
        ok: true,
        zstdSupported: true,
        memCacheItems: memAssetCache.size,
        memCacheMB: Math.round((memCacheBytes / (1024 * 1024)) * 10) / 10
      });
    }

    if (pathname !== '/asset' && !pathname.startsWith('/api/')) {
      return serveStaticFrontend(req, res, pathname);
    }

    const clientIp = getClientIp(req);
    const rl = checkRateLimit(clientIp, pathname === '/asset' ? 240 : 90, 60_000);
    if (!rl.allowed) {
      return sendJson(
        res,
        429,
        { error: 'Слишком много запросов. Повторите позже.' },
        { 'Retry-After': String(rl.retryAfterSec) }
      );
    }

    const initDataRaw = req.headers['x-telegram-init-data'];
    const auth = verifyTelegramInitData(initDataRaw);
    if (!auth.ok) {
      return sendJson(res, auth.status, { error: auth.error });
    }
    const tgUserId = String(auth.user.id);

    try {
      if (pathname === '/asset' && req.method === 'GET') {
        const assetId = (urlObj.searchParams.get('id') || '').trim();
        if (!/^\d{1,20}$/.test(assetId)) {
          return sendJson(res, 400, { error: 'Параметр id должен содержать только цифры' });
        }

        const etag = `"rbx-asset-${assetId}"`;
        if (req.headers['if-none-match'] === etag) {
          res.writeHead(304, {
            ETag: etag,
            'Cache-Control': 'public, max-age=604800, immutable'
          });
          return res.end();
        }

        const asset = await getCachedOrFetchAsset(assetId);
        res.writeHead(200, {
          'Content-Type': asset.contentType,
          'Content-Length': asset.buffer.byteLength,
          'Cache-Control': 'public, max-age=604800, immutable',
          ETag: etag,
          'X-Content-Type-Options': 'nosniff'
        });
        return res.end(asset.buffer);
      }

      if (pathname === '/api/user' && req.method === 'GET') {
        return sendJson(res, 200, getUserRecord(tgUserId));
      }

      if (pathname === '/api/user/sync' && req.method === 'POST') {
        const body = await readJsonBody(req);
        const updated = await saveUserRecord(tgUserId, body);
        return sendJson(res, 200, updated);
      }

      if (pathname === '/api/catalog' && req.method === 'GET') {
        const allowedParams = new URLSearchParams();
        for (const key of [
          'Category',
          'Subcategory',
          'Keyword',
          'MinPrice',
          'MaxPrice',
          'Limit',
          'SortType',
          'SalesTypeFilter'
        ]) {
          const v = urlObj.searchParams.get(key);
          if (v !== null) allowedParams.set(key, v);
        }
        const up = await fetch(
          `https://catalog.roblox.com/v1/search/items/details?${allowedParams.toString()}`,
          { credentials: 'omit', headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' } }
        );
        const buf = await readResponseWithLimit(up, MAX_JSON_BYTES);
        res.writeHead(up.status, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'public, max-age=120'
        });
        return res.end(buf);
      }

      if (pathname === '/api/thumbnails' && req.method === 'GET') {
        const assetIds = (urlObj.searchParams.get('assetIds') || '').trim();
        if (!/^\d+(,\d+)*$/.test(assetIds)) {
          return sendJson(res, 400, { error: 'Некорректный список assetIds' });
        }
        const up = await fetch(
          `https://thumbnails.roblox.com/v1/assets?assetIds=${encodeURIComponent(
            assetIds
          )}&returnPolicy=PlaceHolder&size=150x150&format=Png&isCircular=false`,
          { credentials: 'omit', headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' } }
        );
        const buf = await readResponseWithLimit(up, MAX_JSON_BYTES);
        res.writeHead(up.status, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'public, max-age=3600'
        });
        return res.end(buf);
      }

      if (pathname === '/api/inventory' && req.method === 'GET') {
        const username = (urlObj.searchParams.get('username') || '').trim();
        if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
          return sendJson(res, 400, { error: 'Некорректный никнейм Roblox' });
        }
        const uRes = await fetch('https://users.roblox.com/v1/usernames/users', {
          method: 'POST',
          credentials: 'omit',
          headers: {
            'User-Agent': BROWSER_UA,
            'Content-Type': 'application/json',
            Accept: 'application/json'
          },
          body: JSON.stringify({ usernames: [username], excludeBannedUsers: false })
        });
        const uJson = JSON.parse((await readResponseWithLimit(uRes, MAX_JSON_BYTES)).toString('utf8'));
        const found = uJson?.data?.[0];
        if (!found?.id) {
          return sendJson(res, 404, { error: `Игрок "${username}" не найден в Roblox` });
        }
        const avRes = await fetch(`https://avatar.roblox.com/v1/users/${found.id}/avatar`, {
          credentials: 'omit',
          headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' }
        });
        const avBuf = await readResponseWithLimit(avRes, MAX_JSON_BYTES);
        const avJson = JSON.parse(avBuf.toString('utf8'));
        return sendJson(
          res,
          200,
          { user: { id: found.id, name: found.name }, assets: avJson.assets || [] },
          { 'Cache-Control': 'public, max-age=120' }
        );
      }

      return sendJson(res, 404, { error: 'API маршрут не найден' });
    } catch (err) {
      const status = Number(err?.statusCode) || 502;
      return sendJson(res, status, { error: String(err?.message || err) });
    }
  })
  .listen(PORT, '0.0.0.0', () => {
    console.log(`[RBX STUDIO TMA] Server listening on http://0.0.0.0:${PORT}`);
  });