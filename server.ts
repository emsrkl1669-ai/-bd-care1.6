import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
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
      model: 'gemini-3.8-flash',
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
    const m = Math.min(25, Math.max(0, Number(parsed.dimensionScores?.mobilityScore ?? baseline.dimensionScores.mobilityScore)));
    const c = Math.min(25, Math.max(0, Number(parsed.dimensionScores?.complicationsScore ?? baseline.dimensionScores.complicationsScore)));
    const e = Math.min(25, Math.max(0, Number(parsed.dimensionScores?.economicScore ?? baseline.dimensionScores.economicScore)));
    const cg = Math.min(25, Math.max(0, Number(parsed.dimensionScores?.caregiverScore ?? baseline.dimensionScores.caregiverScore)));

    const exactTotalScore = m + c + e + cg;
    const exactLevel = exactTotalScore >= 80 ? 'เปราะบางสูงมาก (วิกฤต)' : (exactTotalScore >= 50 ? 'เปราะบางปานกลาง' : 'เปราะบางเริ่มต้น');

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
        helpCashAmount: parsed.recommendedSupplies?.helpCashAmount ?? baseline.recommendedSupplies.helpCashAmount,
        helpDiaperSize: parsed.recommendedSupplies?.helpDiaperSize ?? baseline.recommendedSupplies.helpDiaperSize,
        helpDiaperPacks: parsed.recommendedSupplies?.helpDiaperPacks ?? baseline.recommendedSupplies.helpDiaperPacks,
        helpRicePacks: parsed.recommendedSupplies?.helpRicePacks ?? baseline.recommendedSupplies.helpRicePacks,
        helpWaterSize: patientData?.helpWaterSize || '1.5L',
        helpWaterPacks: parsed.recommendedSupplies?.helpWaterPacks ?? baseline.recommendedSupplies.helpWaterPacks,
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
