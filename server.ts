import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import { calculateVulnerabilityAssessment } from './src/utils/assessment.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Support CLI --port argument, prioritize port 3000, and never bind to 8080 (which is used by the Nginx proxy)
const portArgIndex = process.argv.indexOf('--port');
const portFromArgs = portArgIndex !== -1 && process.argv[portArgIndex + 1] ? Number(process.argv[portArgIndex + 1]) : null;
const PORT = portFromArgs || (process.env.PORT && process.env.PORT !== '8080' ? Number(process.env.PORT) : 3000);

// Middleware for JSON bodies with generous limit for images and documents
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Initialize GoogleGenAI server-side with telemetry header
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;
if (apiKey) {
  ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// ============================================================================
// Local LAN Server Persistent Storage (e.g. when hosted on 192.168.1.45)
// ============================================================================
const LAN_DATA_DIR = process.env.BDCARE_DATA_DIR
  ? path.resolve(process.env.BDCARE_DATA_DIR)
  : path.join(__dirname, 'bdcare-data');
const LAN_DB_FILE = path.join(LAN_DATA_DIR, 'bdcare-db.json');
const LAN_BACKUP_FILE = path.join(LAN_DATA_DIR, 'bdcare-db.backup.json');
const LAN_TEMP_FILE = path.join(LAN_DATA_DIR, 'bdcare-db.tmp.json');

interface LanDbState {
  version: number;
  revision: number;
  updatedAt: string;
  patients: any[];
  funerals: any[];
  donations: any[];
  deliverySettings: any | null;
  deletedFunerals: string[];
  deletedDonations: string[];
}

const DEFAULT_LAN_DB: LanDbState = {
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

let lanWriteChain: Promise<void> = Promise.resolve();

function getLocalLanIps(): string[] {
  const ips: string[] = [];
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push(net.address);
      }
    }
  }
  return ips;
}

async function readLanDb(): Promise<LanDbState> {
  try {
    const raw = await fs.readFile(LAN_DB_FILE, 'utf-8');
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
    return { ...DEFAULT_LAN_DB };
  }
}

async function writeLanDb(nextState: LanDbState): Promise<void> {
  const task = lanWriteChain.then(async () => {
    await fs.mkdir(LAN_DATA_DIR, { recursive: true });
    try {
      await fs.copyFile(LAN_DB_FILE, LAN_BACKUP_FILE);
    } catch {
      // No existing DB yet
    }
    await fs.writeFile(LAN_TEMP_FILE, JSON.stringify(nextState, null, 2), 'utf-8');
    await fs.rename(LAN_TEMP_FILE, LAN_DB_FILE);
  });
  lanWriteChain = task.catch(() => {});
  await task;
}

function mergeByTimestamp<T extends { id: string; updatedAt?: string; createdAt?: string }>(
  existing: T[],
  incoming: T[],
  deletedSet: Set<string>
): T[] {
  const map = new Map<string, T>();
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
      if (nextTime >= prevTime) {
        map.set(item.id, item);
      }
    }
  }
  return Array.from(map.values());
}

// Allow LAN browsers (including Private Network Access) to connect to /api/lan/*
app.use('/api/lan', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasApiKey: !!process.env.GEMINI_API_KEY,
    appName: 'BD-Care โครงการใจถึงใจ มูลนิธิร่วมกุศลสมุทรปราการ',
  });
});

app.get('/api/lan/status', async (_req, res) => {
  const db = await readLanDb();
  res.json({
    ok: true,
    serverName: 'BD-Care LAN Storage Server',
    hostIps: getLocalLanIps(),
    dataFilePath: LAN_DB_FILE,
    revision: db.revision,
    updatedAt: db.updatedAt,
    counts: {
      patients: db.patients.length,
      funerals: db.funerals.length,
      donations: db.donations.length,
    },
  });
});

app.get('/api/lan/data', async (_req, res) => {
  const db = await readLanDb();
  res.json({ ok: true, ...db });
});

app.post('/api/lan/sync', async (req, res) => {
  try {
    const body = req.body || {};
    const current = await readLanDb();

    const deletedFunerals = Array.from(
      new Set([
        ...current.deletedFunerals,
        ...(Array.isArray(body.deletedFunerals) ? body.deletedFunerals : []),
      ])
    ).slice(-500);

    const deletedDonations = Array.from(
      new Set([
        ...current.deletedDonations,
        ...(Array.isArray(body.deletedDonations) ? body.deletedDonations : []),
      ])
    ).slice(-500);

    const inPatients = Array.isArray(body.patients) ? body.patients : [];
    const inFunerals = Array.isArray(body.funerals) ? body.funerals : [];
    const inDonations = Array.isArray(body.donations) ? body.donations : [];

    // If an ID is explicitly recreated/restored via incoming array with newer timestamp, keep delete list clean
    const delFuneralSet = new Set(deletedFunerals);
    for (const f of inFunerals) {
      if (f?.id && delFuneralSet.has(f.id) && body.forceRestoreFunerals?.includes?.(f.id)) {
        delFuneralSet.delete(f.id);
      }
    }
    const delDonationSet = new Set(deletedDonations);
    for (const d of inDonations) {
      if (d?.id && delDonationSet.has(d.id) && body.forceRestoreDonations?.includes?.(d.id)) {
        delDonationSet.delete(d.id);
      }
    }

    const mergedPatients = mergeByTimestamp(current.patients, inPatients, new Set());
    const mergedFunerals = mergeByTimestamp(current.funerals, inFunerals, delFuneralSet);
    const mergedDonations = mergeByTimestamp(current.donations, inDonations, delDonationSet);

    let mergedSettings = current.deliverySettings;
    if (body.deliverySettings && typeof body.deliverySettings === 'object') {
      const curTime = Date.parse(current.deliverySettings?.updatedAt || '') || 0;
      const inTime = Date.parse(body.deliverySettings.updatedAt || '') || 0;
      if (!mergedSettings || inTime >= curTime) {
        mergedSettings = body.deliverySettings;
      }
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

    const nextState: LanDbState = {
      version: 1,
      revision: changed ? current.revision + 1 : current.revision,
      updatedAt: changed ? new Date().toISOString() : current.updatedAt,
      ...nextCore,
    };

    if (changed || current.revision === 0) {
      await writeLanDb(nextState);
    }

    res.json({ ok: true, changed, dataFilePath: LAN_DB_FILE, ...nextState });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || 'LAN sync failed' });
  }
});

app.put('/api/lan/data', async (req, res) => {
  try {
    const body = req.body || {};
    const current = await readLanDb();
    const nextState: LanDbState = {
      version: 1,
      revision: current.revision + 1,
      updatedAt: new Date().toISOString(),
      patients: Array.isArray(body.patients) ? body.patients : [],
      funerals: Array.isArray(body.funerals) ? body.funerals : [],
      donations: Array.isArray(body.donations) ? body.donations : [],
      deliverySettings: body.deliverySettings && typeof body.deliverySettings === 'object' ? body.deliverySettings : null,
      deletedFunerals: Array.isArray(body.deletedFunerals) ? body.deletedFunerals : [],
      deletedDonations: Array.isArray(body.deletedDonations) ? body.deletedDonations : [],
    };
    await writeLanDb(nextState);
    res.json({ ok: true, dataFilePath: LAN_DB_FILE, ...nextState });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || 'LAN write failed' });
  }
});

// AI Evaluation Endpoint for Social Worker Assessment & Vulnerability Scoring
app.post('/api/ai/evaluate', async (req, res) => {
  const { patientData, interviewNotes } = req.body;
  const baseline = calculateVulnerabilityAssessment(patientData || {});

  try {
    if (!ai) {
      // Return accurate rule-based calculation if GEMINI_API_KEY is not configured
      return res.json({
        fallback: true,
        ...baseline,
        missingNotice: 'การวิเคราะห์ออฟไลน์ตามเกณฑ์มาตรฐานมูลนิธิร่วมกุศลสมุทรปราการ',
      });
    }

    const prompt = `คุณคือผู้เชี่ยวชาญด้านสังคมสงเคราะห์ทางการแพทย์และการดูแลผู้ป่วยระยะท้าย ประจำมูลนิธิร่วมกุศลสมุทรปราการ (北欖天德善堂)
กรุณาวิเคราะห์ข้อมูลผู้ป่วยในโครงการ "ใจถึงใจช่วยผู้ป่วยติดเตียงและยากไร้" เพื่อจัดทำแบบประเมิน สค.04 อย่างเป็นทางการ

ข้อมูลผู้ป่วย:
${JSON.stringify(patientData, null, 2)}

บันทึกการสัมภาษณ์เพิ่มเติม:
${interviewNotes || 'ไม่มีบันทึกเพิ่มเติม'}

เกณฑ์การช่วยเหลือของมูลนิธิร่วมกุศลสมุทรปราการ:
1. เงินสดช่วยเหลือ 1,000 บาท/เดือน (สำหรับครอบครัวยากไร้ รายได้สุทธิติดลบ หรือมีภาระค่าใช้จ่ายสูง)
2. ผ้าอ้อมผู้ใหญ่ (ไซส์ S, M, L, XL, XXL) และจำนวนห่อ/เดือน (1-3 ห่อ)
3. ข้าวสาร 5 กก. (จำนวน 2 ถุง/เดือน)
4. น้ำดื่ม 1.5 ลิตร แพ็ค 6 ขวด หรือ 600 ML แพ็ค 12 ขวด (จำนวน 2 แพ็ค/เดือน)
5. สิ่งของพิเศษอื่นๆ เช่น แผ่นรองซับ, ที่นอนลมป้องกันแผลกดทับ, รถเข็นวีลแชร์, วอล์คเกอร์, เครื่องดูดเสมหะ

กฎการคำนวณคะแนนความเปราะบาง (สำคัญมาก):
- ประเมิน 4 มิติเชิงลึก แต่ละมิติมีคะแนน 0 - 25 คะแนน:
  1. mobilityScore: มิติการเคลื่อนไหวและการช่วยเหลือตนเอง (ADL) (0-25)
  2. complicationsScore: มิติภาวะแทรกซ้อนและความรุนแรงของโรค (0-25)
  3. economicScore: มิติภาระค่าใช้จ่ายและเศรษฐกิจครัวเรือน (0-25)
  4. caregiverScore: มิติสภาพผู้ดูแลและความพร้อมทางจิตสังคม (0-25)
- ผลรวมคะแนนดัชนีความเปราะบาง (vulnerabilityScore) ต้องมีค่าเท่ากับผลบวกของทั้ง 4 มิติพอดีเป๊ะ (mobilityScore + complicationsScore + economicScore + caregiverScore = vulnerabilityScore)
- ระดับความเปราะบาง (vulnerabilityLevel): คะแนน >= 80 คือ "เปราะบางสูงมาก (วิกฤต)", คะแนน 50-79 คือ "เปราะบางปานกลาง", ต่ำกว่า 50 คือ "เปราะบางเริ่มต้น"

ตอบกลับเป็น JSON ตาม schema ที่กำหนด`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            dimensionScores: {
              type: Type.OBJECT,
              properties: {
                mobilityScore: { type: Type.INTEGER, description: 'คะแนนด้านการเคลื่อนไหว 0-25' },
                complicationsScore: { type: Type.INTEGER, description: 'คะแนนภาวะแทรกซ้อน 0-25' },
                economicScore: { type: Type.INTEGER, description: 'คะแนนความยากไร้ทางเศรษฐกิจ 0-25' },
                caregiverScore: { type: Type.INTEGER, description: 'คะแนนภาระและสภาพผู้ดูแล 0-25' },
              },
              required: ['mobilityScore', 'complicationsScore', 'economicScore', 'caregiverScore'],
            },
            socialWorkerOpinion: {
              type: Type.STRING,
              description: 'ข้อความสรุปความเห็นของนักสังคมสงเคราะห์อย่างเป็นทางการสำหรับใส่ในแบบ สค.04',
            },
            recommendedSupplies: {
              type: Type.OBJECT,
              properties: {
                helpCashEnabled: { type: Type.BOOLEAN },
                helpCashAmount: { type: Type.NUMBER },
                helpDiaperSize: { type: Type.STRING, description: 'S, M, L, XL, XXL หรือ NONE' },
                helpDiaperPacks: { type: Type.INTEGER },
                helpRicePacks: { type: Type.INTEGER },
                helpWaterPacks: { type: Type.INTEGER },
                otherSupplies: { type: Type.STRING },
              },
              required: ['helpCashEnabled', 'helpCashAmount', 'helpDiaperSize', 'helpDiaperPacks', 'helpRicePacks', 'helpWaterPacks', 'otherSupplies'],
            },
            missingFieldsAdvice: {
              type: Type.STRING,
              description: 'คำแนะนำส่วนที่ขาดหรือควรสอบถามเพิ่มเติมในการลงพื้นที่ครั้งถัดไป',
            },
          },
          required: [
            'dimensionScores',
            'socialWorkerOpinion',
            'recommendedSupplies',
          ],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');

    // Enforce exact mathematical integrity for dimension scores and sum
    const m = Math.round(Math.min(25, Math.max(0, Number(parsed.dimensionScores?.mobilityScore ?? baseline.dimensionScores.mobilityScore))));
    const c = Math.round(Math.min(25, Math.max(0, Number(parsed.dimensionScores?.complicationsScore ?? baseline.dimensionScores.complicationsScore))));
    const e = Math.round(Math.min(25, Math.max(0, Number(parsed.dimensionScores?.economicScore ?? baseline.dimensionScores.economicScore))));
    const cg = Math.round(Math.min(25, Math.max(0, Number(parsed.dimensionScores?.caregiverScore ?? baseline.dimensionScores.caregiverScore))));

    const exactTotalScore = m + c + e + cg;
    const exactLevel = exactTotalScore >= 80 ? 'เปราะบางสูงมาก (วิกฤต)' : (exactTotalScore >= 50 ? 'เปราะบางปานกลาง' : 'เปราะบางเริ่มต้น');
    const validDiaperSizes = ['S', 'M', 'L', 'XL', 'XXL', 'NONE'];
    const rawDiaper = String(parsed.recommendedSupplies?.helpDiaperSize || '').toUpperCase();
    const safeDiaperSize = validDiaperSizes.includes(rawDiaper) ? rawDiaper : baseline.recommendedSupplies.helpDiaperSize;

    res.json({
      fallback: false,
      vulnerabilityScore: exactTotalScore,
      vulnerabilityLevel: exactLevel,
      dimensionScores: {
        mobilityScore: m,
        complicationsScore: c,
        economicScore: e,
        caregiverScore: cg,
      },
      socialWorkerOpinion: parsed.socialWorkerOpinion || baseline.socialWorkerOpinion,
      recommendedSupplies: {
        helpCashEnabled: parsed.recommendedSupplies?.helpCashEnabled ?? baseline.recommendedSupplies.helpCashEnabled,
        helpCashAmount: Number(parsed.recommendedSupplies?.helpCashAmount ?? baseline.recommendedSupplies.helpCashAmount),
        helpDiaperSize: safeDiaperSize,
        helpDiaperPacks: Math.max(0, Math.round(Number(parsed.recommendedSupplies?.helpDiaperPacks ?? baseline.recommendedSupplies.helpDiaperPacks))),
        helpRicePacks: Math.max(0, Math.round(Number(parsed.recommendedSupplies?.helpRicePacks ?? baseline.recommendedSupplies.helpRicePacks))),
        helpWaterSize: patientData?.helpWaterSize || '1.5L',
        helpWaterPacks: Math.max(0, Math.round(Number(parsed.recommendedSupplies?.helpWaterPacks ?? baseline.recommendedSupplies.helpWaterPacks))),
        otherSupplies: parsed.recommendedSupplies?.otherSupplies ?? baseline.recommendedSupplies.otherSupplies,
      },
      aiSuggestions: parsed.missingFieldsAdvice || baseline.aiSuggestions,
    });
  } catch (error: any) {
    console.error('Error generating AI evaluation, using baseline assessment:', error);
    res.json({
      fallback: true,
      error: error.message,
      ...baseline,
    });
  }
});

// Start Server or mount Vite
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : undefined,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server started on http://0.0.0.0:${PORT}`);
  });
}

startServer();
