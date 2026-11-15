import {
  PatientRecord,
  FuneralAssistanceRecord,
  DonationDistributionRecord,
  DeliveryPlanSettings,
  LanStorageConfig,
} from '../types';

export const DEFAULT_LAN_IP = '192.168.1.45';
export const DEFAULT_LAN_PORT = 3000;
export const DEFAULT_LAN_SERVER_URL = `http://${DEFAULT_LAN_IP}:${DEFAULT_LAN_PORT}`;

const LAN_CONFIG_STORAGE_KEY = 'bdcare_lan_config_v1';

export interface LanServerStatus {
  ok: boolean;
  serverName?: string;
  hostIps?: string[];
  dataFilePath?: string;
  revision?: number;
  updatedAt?: string;
  counts?: {
    patients: number;
    funerals: number;
    donations: number;
  };
  errorKind?: 'mixed-content' | 'unreachable' | 'http-error';
  errorMessage?: string;
}

export interface LanSyncPayload {
  patients: PatientRecord[];
  funerals: FuneralAssistanceRecord[];
  donations: DonationDistributionRecord[];
  deliverySettings: DeliveryPlanSettings;
  deletedFunerals: string[];
  deletedDonations: string[];
  forceRestoreFunerals?: string[];
  forceRestoreDonations?: string[];
}

export interface LanSyncResult {
  ok: boolean;
  changed: boolean;
  revision: number;
  updatedAt: string;
  dataFilePath?: string;
  patients: PatientRecord[];
  funerals: FuneralAssistanceRecord[];
  donations: DonationDistributionRecord[];
  deliverySettings: DeliveryPlanSettings | null;
  deletedFunerals: string[];
  deletedDonations: string[];
}

export function isHostedOnTargetLanIp(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.hostname === DEFAULT_LAN_IP;
}

export function normalizeLanServerUrl(rawInput: string): string {
  const trimmed = (rawInput || '').trim().replace(/\/+$/, '');
  if (!trimmed) {
    return isHostedOnTargetLanIp() ? window.location.origin : DEFAULT_LAN_SERVER_URL;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  // If bare IP/hostname without port, default to :3000
  if (!trimmed.includes(':')) {
    return `http://${trimmed}:${DEFAULT_LAN_PORT}`;
  }
  return `http://${trimmed}`;
}

export function getStoredLanConfig(): LanStorageConfig {
  const defaultUrl = isHostedOnTargetLanIp() ? window.location.origin : DEFAULT_LAN_SERVER_URL;
  try {
    const raw = localStorage.getItem(LAN_CONFIG_STORAGE_KEY);
    if (!raw) {
      return {
        enabled: isHostedOnTargetLanIp(),
        serverUrl: defaultUrl,
        autoSync: true,
        lastSyncedAt: '',
        lastRevision: 0,
      };
    }
    const parsed = JSON.parse(raw);
    return {
      enabled: isHostedOnTargetLanIp() ? true : Boolean(parsed?.enabled),
      serverUrl: normalizeLanServerUrl(parsed?.serverUrl || defaultUrl),
      autoSync: parsed?.autoSync !== false,
      lastSyncedAt: typeof parsed?.lastSyncedAt === 'string' ? parsed.lastSyncedAt : '',
      lastRevision: typeof parsed?.lastRevision === 'number' ? parsed.lastRevision : 0,
    };
  } catch {
    return {
      enabled: isHostedOnTargetLanIp(),
      serverUrl: defaultUrl,
      autoSync: true,
      lastSyncedAt: '',
      lastRevision: 0,
    };
  }
}

export function saveStoredLanConfig(config: LanStorageConfig): LanStorageConfig {
  const normalized: LanStorageConfig = {
    enabled: Boolean(config.enabled),
    serverUrl: normalizeLanServerUrl(config.serverUrl),
    autoSync: config.autoSync !== false,
    lastSyncedAt: config.lastSyncedAt || '',
    lastRevision: typeof config.lastRevision === 'number' ? config.lastRevision : 0,
  };
  try {
    localStorage.setItem(LAN_CONFIG_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    /* ignore */
  }
  return normalized;
}

export function isMixedContentBlockedUrl(serverUrl: string): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.location.protocol === 'https:' &&
    normalizeLanServerUrl(serverUrl).toLowerCase().startsWith('http://')
  );
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 5000
): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timer);
  }
}

export async function testLanConnection(serverUrl: string): Promise<LanServerStatus> {
  const baseUrl = normalizeLanServerUrl(serverUrl);
  try {
    const res = await fetchWithTimeout(`${baseUrl}/api/lan/status`, { method: 'GET' }, 4500);
    if (!res.ok) {
      return {
        ok: false,
        errorKind: 'http-error',
        errorMessage: `เซิร์ฟเวอร์ ${baseUrl} ตอบกลับรหัสข้อผิดพลาด HTTP ${res.status}`,
      };
    }
    const data = await res.json();
    if (!data?.ok) {
      return {
        ok: false,
        errorKind: 'http-error',
        errorMessage: data?.error || 'เซิร์ฟเวอร์ตอบกลับรูปแบบไม่ถูกต้อง',
      };
    }
    return data as LanServerStatus;
  } catch (err: any) {
    if (isMixedContentBlockedUrl(baseUrl)) {
      return {
        ok: false,
        errorKind: 'mixed-content',
        errorMessage:
          `เบราว์เซอร์เปิดผ่าน HTTPS จึงบล็อกการเชื่อมต่อไปยัง ${baseUrl} (HTTP) อัตโนมัติ กรุณาเปิดแอปผ่าน ${baseUrl} โดยตรงบนเครื่องในวง LAN หรือตั้งค่าเบราว์เซอร์ให้อนุญาตเนื้อหาไม่ปลอดภัย (Insecure content) หรือใช้ HTTPS บน ${DEFAULT_LAN_IP}`,
      };
    }
    const isAbort = err?.name === 'AbortError';
    return {
      ok: false,
      errorKind: 'unreachable',
      errorMessage: isAbort
        ? `หมดเวลาการเชื่อมต่อกับ ${baseUrl} กรุณาตรวจสอบว่าเปิดเซิร์ฟเวอร์เก็บข้อมูลบนเครื่อง ${DEFAULT_LAN_IP} และอยู่ในวง LAN เดียวกันแล้ว`
        : `ไม่สามารถติดต่อ ${baseUrl} ได้ กรุณาตรวจสอบว่าเครื่อง ${DEFAULT_LAN_IP} เปิดตัวรับข้อมูล BD-Care LAN Server อยู่`,
    };
  }
}

export async function syncWithLanServer(
  serverUrl: string,
  payload: LanSyncPayload
): Promise<LanSyncResult> {
  const baseUrl = normalizeLanServerUrl(serverUrl);
  const res = await fetchWithTimeout(
    `${baseUrl}/api/lan/sync`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    12000
  );
  if (!res.ok) {
    throw new Error(`LAN sync HTTP ${res.status}`);
  }
  const data = await res.json();
  if (!data?.ok) {
    throw new Error(data?.error || 'LAN sync failed');
  }
  return data as LanSyncResult;
}

export function downloadStandaloneLanServerScript(): void {
  const scriptContent = `#!/usr/bin/env node
/**
 * BD-Care Standalone LAN Storage Server for ${DEFAULT_LAN_IP}
 * Zero-dependency Node.js server (Node 18+) storing all BD-Care data locally on disk.
 *
 * Usage on ${DEFAULT_LAN_IP}:
 *   node bdcare-lan-server.mjs
 *
 * Custom port / folder:
 *   PORT=3000 BDCARE_DATA_DIR=./bdcare-data node bdcare-lan-server.mjs
 */
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || ${DEFAULT_LAN_PORT});
const DATA_DIR = process.env.BDCARE_DATA_DIR
  ? path.resolve(process.env.BDCARE_DATA_DIR)
  : path.join(__dirname, 'bdcare-data');
const DB_FILE = path.join(DATA_DIR, 'bdcare-db.json');
const BACKUP_FILE = path.join(DATA_DIR, 'bdcare-db.backup.json');
const TEMP_FILE = path.join(DATA_DIR, 'bdcare-db.tmp.json');

let writeChain = Promise.resolve();

function getLocalIps() {
  const ips = [];
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) ips.push(net.address);
    }
  }
  return ips;
}

async function readDb() {
  try {
    const raw = await fs.readFile(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      version: Number(parsed?.version) || 1,
      revision: Number(parsed?.revision) || 0,
      updatedAt: typeof parsed?.updatedAt === 'string' ? parsed.updatedAt : '',
      patients: Array.isArray(parsed?.patients) ? parsed.patients : [],
      funerals: Array.isArray(parsed?.funerals) ? parsed.funerals : [],
      donations: Array.isArray(parsed?.donations) ? parsed.donations : [],
      deliverySettings: parsed?.deliverySettings && typeof parsed.deliverySettings === 'object' ? parsed.deliverySettings : null,
      deletedFunerals: Array.isArray(parsed?.deletedFunerals) ? parsed.deletedFunerals : [],
      deletedDonations: Array.isArray(parsed?.deletedDonations) ? parsed.deletedDonations : [],
    };
  } catch {
    return {
      version: 1,
      revision: 0,
      updatedAt: '',
      patients: [],
      funerals: [],
      donations: [],
      deliverySettings: null,
      deletedFunerals: [],
      deletedDonations: [],
    };
  }
}

async function writeDb(nextState) {
  const task = writeChain.then(async () => {
    await fs.mkdir(DATA_DIR, { recursive: true });
    try {
      await fs.copyFile(DB_FILE, BACKUP_FILE);
    } catch {}
    await fs.writeFile(TEMP_FILE, JSON.stringify(nextState, null, 2), 'utf-8');
    await fs.rename(TEMP_FILE, DB_FILE);
  });
  writeChain = task.catch(() => {});
  await task;
}

function mergeByTimestamp(existing, incoming, deletedSet) {
  const map = new Map();
  for (const item of existing) {
    if (!item || !item.id || deletedSet.has(item.id)) continue;
    map.set(item.id, item);
  }
  for (const item of incoming) {
    if (!item || !item.id || deletedSet.has(item.id)) continue;
    const prev = map.get(item.id);
    if (!prev) {
      map.set(item.id, item);
    } else {
      const prevTime = Date.parse(prev.updatedAt || prev.createdAt || '') || 0;
      const nextTime = Date.parse(item.updatedAt || item.createdAt || '') || 0;
      if (nextTime >= prevTime) map.set(item.id, item);
    }
  }
  return Array.from(map.values());
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Private-Network': 'true',
  });
  res.end(JSON.stringify(data));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 60 * 1024 * 1024) {
        reject(new Error('Payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf-8');
        resolve(text ? JSON.parse(text) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Private-Network': 'true',
    });
    return res.end();
  }

  const url = (req.url || '/').split('?')[0];

  if (req.method === 'GET' && url === '/api/lan/status') {
    const db = await readDb();
    return sendJson(res, 200, {
      ok: true,
      serverName: 'BD-Care LAN Storage Server',
      hostIps: getLocalIps(),
      dataFilePath: DB_FILE,
      revision: db.revision,
      updatedAt: db.updatedAt,
      counts: {
        patients: db.patients.length,
        funerals: db.funerals.length,
        donations: db.donations.length,
      },
    });
  }

  if (req.method === 'GET' && url === '/api/lan/data') {
    const db = await readDb();
    return sendJson(res, 200, { ok: true, dataFilePath: DB_FILE, ...db });
  }

  if (req.method === 'POST' && url === '/api/lan/sync') {
    try {
      const body = await readJsonBody(req);
      const current = await readDb();
      const deletedFunerals = Array.from(new Set([...current.deletedFunerals, ...(Array.isArray(body.deletedFunerals) ? body.deletedFunerals : [])])).slice(-500);
      const deletedDonations = Array.from(new Set([...current.deletedDonations, ...(Array.isArray(body.deletedDonations) ? body.deletedDonations : [])])).slice(-500);

      const delFuneralSet = new Set(deletedFunerals);
      const delDonationSet = new Set(deletedDonations);
      const mergedPatients = mergeByTimestamp(current.patients, Array.isArray(body.patients) ? body.patients : [], new Set());
      const mergedFunerals = mergeByTimestamp(current.funerals, Array.isArray(body.funerals) ? body.funerals : [], delFuneralSet);
      const mergedDonations = mergeByTimestamp(current.donations, Array.isArray(body.donations) ? body.donations : [], delDonationSet);

      let mergedSettings = current.deliverySettings;
      if (body.deliverySettings && typeof body.deliverySettings === 'object') {
        const curTime = Date.parse(current.deliverySettings?.updatedAt || '') || 0;
        const inTime = Date.parse(body.deliverySettings.updatedAt || '') || 0;
        if (!mergedSettings || inTime >= curTime) mergedSettings = body.deliverySettings;
      }

      const prevJson = JSON.stringify({
        patients: current.patients,
        funerals: current.funerals,
        donations: current.donations,
        deliverySettings: current.deliverySettings,
        deletedFunerals: current.deletedFunerals,
        deletedDonations: current.deletedDonations,
      });
      const nextCore = {
        patients: mergedPatients,
        funerals: mergedFunerals,
        donations: mergedDonations,
        deliverySettings: mergedSettings,
        deletedFunerals: Array.from(delFuneralSet),
        deletedDonations: Array.from(delDonationSet),
      };
      const changed = JSON.stringify(nextCore) !== prevJson;
      const nextState = {
        version: 1,
        revision: changed ? current.revision + 1 : current.revision,
        updatedAt: changed ? new Date().toISOString() : current.updatedAt,
        ...nextCore,
      };
      if (changed || current.revision === 0) await writeDb(nextState);
      return sendJson(res, 200, { ok: true, changed, dataFilePath: DB_FILE, ...nextState });
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: err?.message || 'Sync error' });
    }
  }

  return sendJson(res, 404, { ok: false, error: 'Not found' });
});

server.listen(PORT, '0.0.0.0', async () => {
  await fs.mkdir(DATA_DIR, { recursive: true });
  console.log('====================================================');
  console.log('BD-Care LAN Storage Server started!');
  console.log('Listening on: http://0.0.0.0:' + PORT);
  console.log('LAN IPs:      ' + (getLocalIps().join(', ') || '${DEFAULT_LAN_IP}'));
  console.log('Data file:    ' + DB_FILE);
  console.log('====================================================');
});
`;

  const blob = new Blob([scriptContent], { type: 'text/javascript;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'bdcare-lan-server.mjs';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
