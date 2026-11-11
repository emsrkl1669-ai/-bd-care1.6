import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

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

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasApiKey: !!process.env.GEMINI_API_KEY,
    appName: 'BD-Care โครงการใจถึงใจ มูลนิธิร่วมกุศลสมุทรปราการ',
  });
});

// AI Evaluation Endpoint for Social Worker Assessment & Vulnerability Scoring
app.post('/api/ai/evaluate', async (req, res) => {
  try {
    const { patientData, interviewNotes } = req.body;

    if (!ai) {
      // Fallback response if GEMINI_API_KEY is not configured
      return res.json({
        fallback: true,
        vulnerabilityScore: calculateLocalScore(patientData),
        summaryOpinion: generateLocalOpinion(patientData),
        recommendedSupplies: generateLocalSupplies(patientData),
        missingNotice: 'การวิเคราะห์แบบออฟไลน์/ระบบมาตรฐาน (แนะนำตรวจสอบข้อมูลเอกสารแนบ)',
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
4. น้ำดื่ม 1.5 ลิตร แพ็ค 6 ขวด (จำนวน 2 แพ็ค/เดือน)
5. สิ่งของพิเศษอื่นๆ เช่น แผ่นรองซับ, ที่นอนลมป้องกันแผลกดทับ, รถเข็นวีลแชร์, วอล์คเกอร์, เครื่องดูดเสมหะ

ให้ประเมิน 4 มิติเชิงลึก:
1. มิติการเคลื่อนไหวและการช่วยเหลือตนเอง (ADL)
2. มิติภาวะแทรกซ้อนและความรุนแรงของโรค
3. มิติภาระค่าใช้จ่ายและเศรษฐกิจครัวเรือน
4. มิติสภาพผู้ดูแลและความพร้อมทางจิตสังคม

ตอบกลับเป็น JSON ตาม schema ที่กำหนด`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            vulnerabilityScore: {
              type: Type.INTEGER,
              description: 'คะแนนดัชนีความเปราะบาง 0 - 100',
            },
            vulnerabilityLevel: {
              type: Type.STRING,
              description: 'เปราะบางสูงมาก (วิกฤต) / เปราะบางปานกลาง / เปราะบางเริ่มต้น',
            },
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
            'vulnerabilityScore',
            'vulnerabilityLevel',
            'dimensionScores',
            'socialWorkerOpinion',
            'recommendedSupplies',
          ],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json(parsed);
  } catch (error: any) {
    console.error('Error generating AI evaluation:', error);
    // Graceful fallback on error
    const fallbackScore = calculateLocalScore(req.body.patientData);
    res.json({
      fallback: true,
      error: error.message,
      vulnerabilityScore: fallbackScore,
      socialWorkerOpinion: generateLocalOpinion(req.body.patientData),
      recommendedSupplies: generateLocalSupplies(req.body.patientData),
    });
  }
});

function calculateLocalScore(data: any): number {
  if (!data) return 50;
  let score = 30;
  if (data.mobilityLevel === 'bedridden') score += 35;
  else if (data.mobilityLevel === 'semi_bedridden') score += 20;
  else score += 10;

  const netIncome = (Number(data.incomeSalary || 0) + Number(data.incomeDisability || 0) + Number(data.incomeElderly || 0) + Number(data.incomeStateWelfare || 0) + Number(data.incomeOther || 0)) - Number(data.monthlyExpense || 0);
  if (netIncome < 0) score += 20;
  else if (netIncome < 2000) score += 10;

  if (data.disabilityCard?.hasCard) score += 10;
  if (data.specialMedicalNeeds && data.specialMedicalNeeds.length > 0) score += 15;

  return Math.min(100, Math.max(10, score));
}

function generateLocalOpinion(data: any): string {
  if (!data) return 'เห็นควรพิจารณาให้ความช่วยเหลือตามระเบียบโครงการใจถึงใจ มูลนิธิร่วมกุศลสมุทรปราการ';
  const mobility = data.mobilityLevel === 'bedridden' ? 'ผู้ป่วยมีภาวะติดเตียง 100% ไม่สามารถช่วยเหลือตนเองได้' : data.mobilityLevel === 'semi_bedridden' ? 'ผู้ป่วยมีภาวะกึ่งติดเตียง จำเป็นต้องมีผู้ดูแลประคับประคอง' : 'ผู้ป่วยพอเดินได้บ้างแต่มีโรคประจำตัวเรื้อรัง';
  return `จากการลงพื้นที่สำรวจข้อเท็จจริง พบว่า${mobility} ครอบครัวมีภาระค่าใช้จ่ายในการดูแลต่อเนื่องและมีรายได้ไม่เพียงพอต่อค่าครองชีพ เห็นสมควรรับเข้าโครงการ "ใจถึงใจช่วยผู้ป่วยติดเตียงและยากไร้" มูลนิธิร่วมกุศลสมุทรปราการ เพื่อบรรเทาความเดือดร้อนเร่งด่วน`;
}

function generateLocalSupplies(data: any): any {
  return {
    helpCashEnabled: true,
    helpCashAmount: 1000,
    helpDiaperSize: data?.helpDiaperSize || 'L',
    helpDiaperPacks: data?.mobilityLevel === 'bedridden' ? 2 : 1,
    helpRicePacks: 2,
    helpWaterPacks: 2,
    otherSupplies: data?.mobilityLevel === 'bedridden' ? 'แผ่นรองซับสิ่งขับถ่าย' : '-',
  };
}

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
