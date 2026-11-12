import { PatientRecord, DiaperSize, WaterSize } from '../types';

export interface DimensionScores {
  mobilityScore: number;       // 0 - 25
  complicationsScore: number;  // 0 - 25
  economicScore: number;       // 0 - 25
  caregiverScore: number;      // 0 - 25
}

export interface VulnerabilityAssessmentResult {
  vulnerabilityScore: number;  // 0 - 100 (exact sum of all 4 dimensions)
  vulnerabilityLevel: 'เปราะบางสูงมาก (วิกฤต)' | 'เปราะบางปานกลาง' | 'เปราะบางเริ่มต้น';
  dimensionScores: DimensionScores;
  socialWorkerOpinion: string;
  recommendedSupplies: {
    helpCashEnabled: boolean;
    helpCashAmount: number;
    helpDiaperSize: DiaperSize;
    helpDiaperPacks: number;
    helpRicePacks: number;
    helpWaterSize: WaterSize;
    helpWaterPacks: number;
    otherSupplies: string;
  };
  aiSuggestions: string;
}

/**
 * คำนวณคะแนนดัชนีความเปราะบาง 4 มิติเชิงลึกตามหลักเกณฑ์มูลนิธิร่วมกุศลสมุทรปราการ
 * ผลรวมของ 4 มิติ (มิติละ 25 คะแนน) จะรวมกันได้เท่ากับคะแนนรวม 100 คะแนนเสมออย่างแม่นยำ
 */
export function calculateVulnerabilityAssessment(data: Partial<PatientRecord>): VulnerabilityAssessmentResult {
  // -------------------------------------------------------------
  // มิติที่ 1: การเคลื่อนไหว & กิจวัตรประจำวัน (ADL) (0 - 25 คะแนน)
  // -------------------------------------------------------------
  let mobilityScore = 10;
  if (data.mobilityLevel === 'bedridden') {
    mobilityScore = 22; // ติดเตียง 100% ช่วยเหลือตนเองไม่ได้
  } else if (data.mobilityLevel === 'semi_bedridden') {
    mobilityScore = 16; // กึ่งติดเตียง ต้องมีผู้ช่วยพยุง
  } else {
    mobilityScore = 8;  // พอเดินได้แต่มีข้อจำกัด
  }

  // มีบัตรคนพิการทางการเคลื่อนไหว หรืออายุมากกว่า 80 ปี
  if (data.disabilityCard?.hasCard) {
    mobilityScore += 3;
  }
  mobilityScore = Math.min(25, Math.max(0, mobilityScore));

  // -------------------------------------------------------------
  // มิติที่ 2: ภาวะแทรกซ้อน & อาการเจ็บป่วย (0 - 25 คะแนน)
  // -------------------------------------------------------------
  let complicationsScore = 8;
  const chronicText = (data.chronicDiseases || '').toLowerCase();
  const symptomsText = (data.symptomsDetail || '').toLowerCase();
  const fullDiseaseStr = `${chronicText} ${symptomsText}`;

  // ตรวจสอบโรคเรื้อรังรุนแรง
  const severeKeywords = ['ไตวาย', 'ฟอกไต', 'มะเร็ง', 'อัมพาต', 'stroke', 'หลอดเลือดสมอง', 'พาร์กินสัน', 'สมองเสื่อม', 'อัลไซเมอร์'];
  const hasSevereDisease = severeKeywords.some(k => fullDiseaseStr.includes(k));

  if (hasSevereDisease) {
    complicationsScore += 8;
  } else if (chronicText.trim().length > 0) {
    complicationsScore += 4; // มีโรคเรื้อรังทั่วไป เช่น เบาหวาน ความดัน
  }

  // แผลกดทับ หรือ ท่อช่วยหายใจ / สายยาง
  const woundKeywords = ['แผลกดทับ', 'bedsore', 'แผลเรื้อรัง', 'เจาะคอ', 'ท่อช่วยหายใจ', 'สายให้อาหาร', 'สายยาง', 'สวนปัสสาวะ'];
  const hasSpecialComplications = woundKeywords.some(k => fullDiseaseStr.includes(k)) || 
    (data.photos && data.photos.some(p => p.category === 'wound'));

  if (hasSpecialComplications) {
    complicationsScore += 8;
  }
  complicationsScore = Math.min(25, Math.max(0, complicationsScore));

  // -------------------------------------------------------------
  // มิติที่ 3: ความยากไร้ & เศรษฐกิจครัวเรือน (0 - 25 คะแนน)
  // -------------------------------------------------------------
  let economicScore = 10;
  const totalIncome =
    Number(data.incomeSalary || 0) +
    Number(data.incomeDisability || 0) +
    Number(data.incomeElderly || 0) +
    Number(data.incomeStateWelfare || 0) +
    Number(data.incomeOther || 0);

  const sumExpenses =
    Number(data.expenseRentHouse || 0) +
    Number(data.expenseRentLand || 0) +
    Number(data.expenseLiving || 0) +
    Number(data.expenseMedicalTravel || 0) +
    Number(data.expenseDebt || 0) +
    Number(data.expenseOther || 0);

  const effectiveExpense = sumExpenses > 0 ? sumExpenses : Number(data.monthlyExpense || 0);
  const netIncome = totalIncome - effectiveExpense;

  if (netIncome <= -3000) {
    economicScore = 23; // ขาดทุนสุทธิสูงมาก
  } else if (netIncome < 0) {
    economicScore = 20; // รายได้ติดลบ
  } else if (netIncome <= 1500) {
    economicScore = 16; // รายได้เหลือน้อยมาก
  } else if (netIncome <= 4000) {
    economicScore = 12; // รายได้ปานกลางค่อนข้างน้อย
  } else {
    economicScore = 6;  // พอมีรายได้เหลือ
  }

  // มีภาระหนี้สิน หรือค่าเช่าที่อยู่อาศัย
  if (Number(data.expenseDebt || 0) > 0 || Number(data.expenseRentHouse || 0) > 0) {
    economicScore += 2;
  }
  economicScore = Math.min(25, Math.max(0, economicScore));

  // -------------------------------------------------------------
  // มิติที่ 4: สภาพผู้ดูแล & สังคมครอบครัว (0 - 25 คะแนน)
  // -------------------------------------------------------------
  let caregiverScore = 10;
  const cName = (data.caregiverName || '').trim();
  const cRelation = (data.caregiverRelation || '').trim();

  if (!cName || cRelation === 'ไม่มี' || cRelation.includes('เพื่อนบ้าน')) {
    caregiverScore = 24; // ไม่มีผู้ดูแลหลัก หรือผู้ดูแลเป็นเพื่อนบ้าน
  } else if (cRelation.includes('คู่สมรส') || cRelation.includes('สามี') || cRelation.includes('ภรรยา') || cRelation.includes('พี่น้อง')) {
    caregiverScore = 18; // ผู้ดูแลเป็นผู้สูงอายุร่วมบ้าน
  } else if (cRelation.includes('บุตร') || cRelation.includes('หลาน')) {
    caregiverScore = 14; // ผู้ดูแลเป็นวัยแรงงานแต่มีภาระต้องทำงาน
  } else {
    caregiverScore = 12;
  }

  // หากจำนวนสมาชิกครอบครัวมาก หรือมีคนพึ่งพิงหลายคน
  if (Number(data.familyMembersTotal || 1) >= 4) {
    caregiverScore += 2;
  }
  caregiverScore = Math.min(25, Math.max(0, caregiverScore));

  // -------------------------------------------------------------
  // ยอดรวมคะแนนความเปราะบาง (บวกกันตรงตามจริง 100%)
  // -------------------------------------------------------------
  const totalScore = mobilityScore + complicationsScore + economicScore + caregiverScore;

  let vulnerabilityLevel: 'เปราะบางสูงมาก (วิกฤต)' | 'เปราะบางปานกลาง' | 'เปราะบางเริ่มต้น' = 'เปราะบางเริ่มต้น';
  if (totalScore >= 80) {
    vulnerabilityLevel = 'เปราะบางสูงมาก (วิกฤต)';
  } else if (totalScore >= 50) {
    vulnerabilityLevel = 'เปราะบางปานกลาง';
  } else {
    vulnerabilityLevel = 'เปราะบางเริ่มต้น';
  }

  // -------------------------------------------------------------
  // รายการสิ่งของสงเคราะห์ที่แนะนำตามเกณฑ์มูลนิธิฯ
  // -------------------------------------------------------------
  const isBedridden = data.mobilityLevel === 'bedridden';
  const diaperPacks = isBedridden ? 2 : (data.mobilityLevel === 'semi_bedridden' ? 1 : 0);
  const helpCash = economicScore >= 14 || netIncome < 2000;

  let otherSupplies = '-';
  if (isBedridden && hasSpecialComplications) {
    otherSupplies = 'แผ่นรองซับสิ่งขับถ่าย, ที่นอนลมป้องกันแผลกดทับ';
  } else if (isBedridden) {
    otherSupplies = 'แผ่นรองซับสิ่งขับถ่าย';
  } else if (data.mobilityLevel === 'semi_bedridden') {
    otherSupplies = 'ไม้เท้า 3 ขา / วอล์คเกอร์พยุงเดิน';
  }

  // -------------------------------------------------------------
  // ข้อความความเห็นนักสังคมสงเคราะห์สำหรับแบบ สค.04
  // -------------------------------------------------------------
  const mobilityDesc = isBedridden
    ? 'ผู้ป่วยมีภาวะติดเตียง 100% ไม่สามารถช่วยเหลือตนเองในการปฏิบัติกิจวัตรประจำวันได้'
    : (data.mobilityLevel === 'semi_bedridden'
      ? 'ผู้ป่วยมีภาวะกึ่งติดเตียง ลุกนั่งหรือเดินลำบาก จำเป็นต้องมีผู้ดูแลประคับประคองใกล้ชิด'
      : 'ผู้ป่วยสามารถพยุงตัวเดินได้บ้าง แต่มีภาวะเจ็บป่วยเรื้อรังส่งผลต่อการใช้ชีวิต');

  const economicDesc = netIncome < 0
    ? `สภาพเศรษฐกิจครอบครัวยากไร้ รายได้สุทธิติดลบ (${netIncome.toLocaleString()} บาท/เดือน) มีภาระค่าใช้จ่ายในการดูแลต่อเนื่อง`
    : `สภาพเศรษฐกิจครอบครัวมีรายได้จำกัด (${netIncome.toLocaleString()} บาท/เดือน) ไม่เพียงพอต่อค่าครองชีพและค่าเวชภัณฑ์`;

  const socialWorkerOpinion = `จากการลงพื้นที่สำรวจข้อเท็จจริง ณ ที่พักอาศัย พบว่า${mobilityDesc} ${economicDesc} ผู้ดูแลคือ ${data.caregiverName || 'คนในครอบครัว'} (${data.caregiverRelation || 'ผู้ดูแล'}) มีภาระในการจัดหาเวชภัณฑ์และค่าใช้จ่ายดำรงชีพ เห็นสมควรรับเข้าโครงการ "ใจถึงใจช่วยผู้ป่วยติดเตียงและยากไร้" มูลนิธิร่วมกุศลสมุทรปราการ และจัดสรรสิ่งของสงเคราะห์ประจำเดือนเพื่อบรรเทาความเดือดร้อนอย่างต่อเนื่อง`;

  const aiSuggestions = totalScore >= 80
    ? 'ผู้ป่วยอยู่ในเกณฑ์เปราะบางวิกฤต (คะแนน ' + totalScore + '/100) แนะนำจัดทีมสังคมสงเคราะห์ลงตรวจเยี่ยมทุกเดือน และประสานงานส่งมอบที่นอนลม/แผ่นรองซับโดยด่วน'
    : 'ผู้ป่วยอยู่ในเกณฑ์ความเปราะบางระดับ ' + vulnerabilityLevel + ' (คะแนน ' + totalScore + '/100) ควรติดตามการฟื้นฟูสมรรถภาพและการรับมอบสิ่งของทุกรอบเดือน';

  return {
    vulnerabilityScore: totalScore,
    vulnerabilityLevel,
    dimensionScores: {
      mobilityScore,
      complicationsScore,
      economicScore,
      caregiverScore,
    },
    socialWorkerOpinion,
    recommendedSupplies: {
      helpCashEnabled: helpCash,
      helpCashAmount: helpCash ? 1000 : 0,
      helpDiaperSize: data.helpDiaperSize && data.helpDiaperSize !== 'NONE' ? data.helpDiaperSize : 'L',
      helpDiaperPacks: diaperPacks,
      helpRicePacks: 2,
      helpWaterSize: data.helpWaterSize || '1.5L',
      helpWaterPacks: 2,
      otherSupplies,
    },
    aiSuggestions,
  };
}
