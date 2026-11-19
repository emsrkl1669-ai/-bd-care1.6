import * as XLSX from 'xlsx';
import {
  DiaperSize,
  DonationDistributionRecord,
  FuneralAssistanceRecord,
  MobilityLevel,
  PatientRecord,
  PatientStatus,
} from '../types';
import { calculateVulnerabilityAssessment, DimensionScores } from './assessment';
import { formatNationalId, sortPatientsByCodeAsc } from './idCard';
import { sanitizeFirestoreId } from './image';
import {
  normalizeDonationRecord,
  normalizeFuneralRecord,
  normalizePatientRecord,
} from './normalizers';
import { generateQrCodeDataUrl, makeGoogleMapsUrl } from './qrcode';

export const SEEDED_PATIENT_CSV = `รหัสผู้ป่วย,สถานะ,วันที่รับเข้าโครงการ,เลขประจำตัวประชาชน,คำนำหน้า,ชื่อ-นามสกุล,อายุ (ปี),เพศ,เบอร์โทรศัพท์,ผู้ดูแล/ผู้ประสานงาน,เบอร์โทรผู้ดูแล,ที่อยู่ปัจจุบัน (บ้านเลขที่),หมู่บ้าน/อาคาร,ซอย,ถนน,ตำบล,อำเภอ,จังหวัด,พิกัด ละติจูด,พิกัด ลองจิจูด,ลิงก์ Google Maps,ระดับการเจ็บป่วย,โรคประจำตัว,อาการเจ็บป่วย,มีบัตรคนพิการ,ประเภทคนพิการ,รายได้สุทธิต่อเดือน (บาท),เงินสดช่วยเหลือ (บาท/เดือน),ขนาดผ้าอ้อม,จำนวนผ้าอ้อม (ห่อ/เดือน),ข้าวสาร 5 กก. (ถุง/เดือน),น้ำดื่ม 1.5L (แพ็ค/เดือน),อุปกรณ์พิเศษอื่นๆ,คะแนนความเปราะบาง (0-100),เจ้าหน้าที่สัมภาษณ์,ผู้พิจารณาอนุมัติ,ผู้อนุมัติโครงการ
BDC-69-003,active,2026-10-14,'3-6409-00114-45-6,นาง,เบญจมาศ  แท่นทอง,70,หญิง,'090-131-4504,อสม,'090-131-4504,302/24,ชุมชนโรงเหล็ก 3 เอส,โรงเหล็ก 3 เอส,ท้ายบ้าน,ท้ายบ้าน,เมืองสมุทรปราการ,สมุทรปราการ,13.572179,100.588715,https://www.google.com/maps?q=13.572179,100.588715,กึ่งติดเตียง,"กล้ามเนื้ออ่อนแรง","",ไม่มี,"ประเภท 3 ทางการเคลื่อนไหวหรือทางร่างกาย",0,1000,L,1,2,2,"-",56,นายกริชพิพัฒน์ สลับทอง,นางสาวศาตพร ภูมิโคกรักษ์,นายไพวงศ์ ชำนินาวากุล
BDC - 69-018,active,2026-03-22,'3-1101-01056-37-4,นาง,สมร  ทองสำฤทธิ์,60,หญิง,',ผู้ใหญ่จุก,'085-949-3738,7/1,-,วัดใหญ่,สุขสวัสดิ์,ในคลองบางปลากด,พระสมุทรเจดีย์,สมุทรปราการ,13.5873929,100.5645043,https://www.google.com/maps?q=13.587393,100.564504,ติดเตียง 100%,"ความดัน,เบาหวาน","ติดเตียง,เดินไม่ได้",ไม่มี,"ประเภท 3 ทางการเคลื่อนไหวหรือทางร่างกาย",0,1000,L,1,2,2,"-",58,นายกริชพิพัฒน์ สลับทอง,นางสาวศาตพร ภูมิโคกรักษ์,นายไพวงศ์ ชำนินาวากุล
BDC - 66-017,active,2023-02-14,'3-3601-00447-36-0,นาง,ยุพา  ช้างเยาว์,70,หญิง,'099-082-9946,สามี,'084-123-1798,134/6,-,เปี่ยมเจริญ,ขจรวิทย์,บางพลีใหญ่,บางพลี,สมุทรปราการ,13.6042269,100.6718605,https://www.google.com/maps?q=13.604227,100.671860,ติดเตียง 100%,"ความดัน","ติดเตียงช่วยเหลือตัวเองไม่ได้",ไม่มี,"ประเภท 3 ทางการเคลื่อนไหวหรือทางร่างกาย",0,1000,L,1,2,2,"-",70,นายกริชพิพัฒน์ สลับทอง,นางสาวศาตพร ภูมิโคกรักษ์,นายไพวงศ์ ชำนินาวากุล
BDC - 68-016,active,2025-05-28,'3-1005-01183-73-0,นาย,สนิจ  อำไธสง,68,ชาย,'083-442-7839,นางรุจิรา ยกเลือน,'083-442-7839,606/90,-,วัดศรีจันทร์ประดิษฐ์(ตรอกขี้หมา),สุขุมวิท,บางปู,เมืองสมุทรปราการ,สมุทรปราการ,13.519424,100.64415,https://www.google.com/maps?q=13.519424,100.644150,ติดเตียง 100%,"ความดัน","พิการจากอุบัติเหตุ,ติดเตียง",มี,"ประเภท 3 ทางการเคลื่อนไหวหรือทางร่างกาย",0,1000,L,1,2,2,"-",73,นายกริชพิพัฒน์ สลับทอง,นางสาวศาตพร ภูมิโคกรักษ์,นายไพวงศ์ ชำนินาวากุล
BDC - 66-015,active,2023-07-21,'3-1101-00569-25-4,นาย,ประเสริฐ  สุขเกิด,48,ชาย,'096-893-3758,หลานสาว,'096-893-3758,78/17,-,วัดศรีจันประดิษฐ์,สุขุมวิท,ปากน้ำ,เมืองสมุทรปราการ,สมุทรปราการ,13.5991,100.5972,https://www.google.com/maps?q=13.599100,100.597200,ติดเตียง 100%,"พิการตาบอด2 ข้างติดเตียงไม่สามารถช่วยเหลือตัวเองได้","",มี,"ประเภท 3 ทางการเคลื่อนไหวหรือทางร่างกาย",0,1000,L,1,2,2,"-",65,นายกริชพิพัฒน์ สลับทอง,นางสาวศาตพร ภูมิโคกรักษ์,นายไพวงศ์ ชำนินาวากุล
BDC - 68-014,active,2025-07-17,'3-7207-00577-81-3,นาง,เกษร  สีทอง,69,หญิง,',บุตรสาว,'084-906-8937,612,-,ซอยวัดศรีจันทรประดิษฐ์,สุขุมวิท,ท้ายบ้านใหม่,เมืองสมุทรปราการ,สมุทรปราการ,13.5742055,100.6107029,https://www.google.com/maps?q=13.574205,100.610703,ติดเตียง 100%,"เบาหวาน,ความดัน,มะเร็งลำไส้","",ไม่มี,"ประเภท 3 ทางการเคลื่อนไหวหรือทางร่างกาย",0,1000,L,1,2,2,"-",70,นายกริชพิพัฒน์ สลับทอง,นางสาวศาตพร ภูมิโคกรักษ์,นายไพวงศ์ ชำนินาวากุล
BDC - 66-013,active,2023-03-25,'3-1101-01729-76-0,นางสาว,วาสนา  แก้วบริสุทธิ์,61,หญิง,',ผู้ใหญ่กบ,'089-774-4100,556/1,-,เทศบาลบางปู 43 (ตากบ),สุขุมวิท,ท้ายบ้านใหม่,เมืองสมุทรปราการ,สมุทรปราการ,13.5742055,100.6107029,https://www.google.com/maps?q=13.574205,100.610703,ติดเตียง 100%,"โรคอ้วน,สะเก็ดเงิน,ความดัน","",มี,"ประเภท 3 ทางการเคลื่อนไหวหรือทางร่างกาย",0,1000,L,1,2,2,"-",65,นายกริชพิพัฒน์ สลับทอง,นางสาวศาตพร ภูมิโคกรักษ์,นายไพวงศ์ ชำนินาวากุล
BDC - 69-012,active,2026-02-02,'1-1199-02836-76-1,ด.ญ.,เกวรินทร์  เพ็งเสถียร,11,หญิง,'088-670-0835,ย่า,'088-67-0835,100/421,-,ทรัพย์ชัย 27,ศรีนครินทร์,ปากน้ำ,เมืองสมุทรปราการ,สมุทรปราการ,13.6008392,100.6216344,https://www.google.com/maps?q=13.600839,100.621634,ติดเตียง 100%,"พิการประเภท 3,5,7","",มี,"ประเภท 3 ทางการเคลื่อนไหวหรือทางร่างกาย",0,1000,L,1,2,2,"แผ่นรองซับสิ่งขับถ่าย",67,นายกริชพิพัฒน์ สลับทอง,นางสาวศาตพร ภูมิโคกรักษ์,นายไพวงศ์ ชำนินาวากุล
BDC - 68-011,active,2025-11-08,'3-1101-01629-59-1,นาง,เปา คล่องแคล่ว,96,หญิง,'082-998-7390,บุตรสาว,'082-998-7390,224,-,ใต้สะพานวัดมหาวงษ์,สุขุมวิท,ปากน้ำ,เมืองสมุทรปราการ,สมุทรปราการ,13.6029153,100.5967562,https://www.google.com/maps?q=13.602915,100.596756,ติดเตียง 100%,"ความดัน,ชราภาพ,อัลไซเมอร์","",ไม่มี,"ประเภท 3 ทางการเคลื่อนไหวหรือทางร่างกาย",0,1000,L,1,2,2,"-",68,นายกริชพิพัฒน์ สลับทอง,นางสาวศาตพร ภูมิโคกรักษ์,นายไพวงศ์ ชำนินาวากุล
BDC - 66-010,active,2023-10-02,'1-1007-01138-62-6,นาย,ทรงธรรม  พานทอง,36,ชาย,'085-318-8492,ย่า,'085-318-8492,24,ซอยข้างโรงเรียนเฉลิมวิทยา,1 (ทหารประดิษฐ์),วัดกลาง,ปากน้ำ,เมืองสมุทรปราการ,สมุทรปราการ,13.5931084,100.5989633,https://www.google.com/maps?q=13.593108,100.598963,ติดเตียง 100%,"ดาวน์ซินโดม,สะเก็ดเงิน,หูนวก,พิการซ้ำซ้อน","",มี,"ประเภท 3 ทางการเคลื่อนไหวหรือทางร่างกาย",0,1000,L,1,2,2,"-",65,นายกริชพิพัฒน์ สลับทอง,นางสาวศาตพร ภูมิโคกรักษ์,นายไพวงศ์ ชำนินาวากุล
BDC - 68-009,active,2025-08-30,'3-3212-00115-48-3,นาย,สุบิน  ดาบจันทร์,69,ชาย,'084-007-8882,ภรรยา,'084-007-8882,ไม่มีเลขที่,ซอยจินดา32 สุดซอย,ท้ายบ้าน 32 (จินดา32),ท้ายบ้าน,ปากน้ำ,เมืองสมุทรปราการ,สมุทรปราการ,13.5806959,100.5907475,https://www.google.com/maps?q=13.580696,100.590748,ติดเตียง 100%,"หลอดเลือดสมอง (Old CVA), ไขมัน,ความดัน","",มี,"ประเภท 3 ทางการเคลื่อนไหวหรือทางร่างกาย",0,1000,L,1,2,2,"-",77,นายกริชพิพัฒน์ สลับทอง,นางสาวศาตพร ภูมิโคกรักษ์,นายไพวงศ์ ชำนินาวากุล
BDC - 68-008,active,2025-10-01,'3-1199-00127-65-3,นาง,เซียมฮวย ยีผาสุข,72,หญิง,'065-956-8581,นางสาวสุพัชรกานต์ ยีผาสุข,'065-956-8581,1/1,-,ท้ายบ้าน 32 (จินดา32),ท้ายบ้าน,ปากน้ำ,เมืองสมุทรปราการ,สมุทรปราการ,13.5799516,100.5921951,https://www.google.com/maps?q=13.579952,100.592195,ติดเตียง 100%,"เบาหวาน,ความดัน","ประสบอุบัติเหตุ",มี,"ประเภท 3 ทางการเคลื่อนไหวหรือทางร่างกาย",1775,1000,L,1,2,2,"-",65,นายกริชพิพัฒน์ สลับทอง,นางสาวศาตพร ภูมิโคกรักษ์,นายไพวงศ์ ชำนินาวากุล
BDC - 68-007,active,2025-11-01,'3-7402-00427-43-0,นางสาว,ตะวัน  ทิมเงิน,57,หญิง,',อสม.(คุณจอย),'081-336-5853,ไม่มีเลขที่,คลองข้างบ้านขาว,ท้ายบ้าน 28,ท้ายบ้าน,ปากน้ำ,เมืองสมุทรปราการ,สมุทรปราการ,13.5815813,100.5924694,https://www.google.com/maps?q=13.581581,100.592469,ติดเตียง 100%,"ความดัน,ไขมัน","หมอนรองกระดูกทับเส้นประสาท",มี,"ประเภท 3 ทางการเคลื่อนไหวหรือทางร่างกาย",0,1000,L,1,2,2,"-",65,นายกริชพิพัฒน์ สลับทอง,นางสาวศาตพร ภูมิโคกรักษ์,นายไพวงศ์ ชำนินาวากุล
BDC - 66-006,active,2023-07-14,'3-1104-01218-23-0,นาง,ฮุยจิง  แซ่แต้,75,หญิง,'065-956-8581,น้องสาว,'065-956-8581,4,-,ท้ายบ้าน 15,ท้ายบ้าน,ท้ายบ้าน,เมืองสมุทรปราการ,สมุทรปราการ,13.579515,106.593059,https://www.google.com/maps?q=13.579515,106.593059,ติดเตียง 100%,"อุบัติเหตุสะโพกหัก,ไทรอยด์,เบาหวาน,ความดัน","",มี,"ประเภท 3 ทางการเคลื่อนไหวหรือทางร่างกาย",0,1000,L,1,2,2,"-",58,นายกริชพิพัฒน์ สลับทอง,นางสาวศาตพร ภูมิโคกรักษ์,นายไพวงศ์ ชำนินาวากุล
BDC - 66-005,active,2023-07-20,'3-1101-01964-07-6,นาง,กี  ลอยวิบูลย์,85,หญิง,',ผู้ใหญ่สังข์,'086-789-6089,302/296,ชุมชนโรงเหล็ก 3 เอส,โรงเหล็ก 3 เอส,ท้ายบ้าน,ท้ายบ้าน,เมืองสมุทรปราการ,สมุทรปราการ,13.5715628,100.5898612,https://www.google.com/maps?q=13.571563,100.589861,ติดเตียง 100%,"กล้ามเนื้ออ่อนแรง","",ไม่มี,"ประเภท 3 ทางการเคลื่อนไหวหรือทางร่างกาย",0,1000,L,1,2,2,"-",62,นายกริชพิพัฒน์ สลับทอง,นางสาวศาตพร ภูมิโคกรักษ์,นายไพวงศ์ ชำนินาวากุล
BDC - 69-004,active,2026-10-11,'3-1199-00338-21-2,นาง,กนกนุช  พบเจริญ,69,หญิง,'090-131-4504,อสม.(ป้าน้อย),'090-131-4504,965,ชุมชนโรงเหล็ก 3 เอส,โรงเหล็ก 3 เอส,ท้ายบ้าน,ท้ายบ้าน,เมืองสมุทรปราการ,สมุทรปราการ,13.572626,100.587831,https://www.google.com/maps?q=13.572626,100.587831,ติดเตียง 100%,"กล้ามเนื้ออ่อนแรง","",ไม่มี,"ประเภท 3 ทางการเคลื่อนไหวหรือทางร่างกาย",0,1000,L,1,2,2,"-",62,นายกริชพิพัฒน์ สลับทอง,นางสาวศาตพร ภูมิโคกรักษ์,นายไพวงศ์ ชำนินาวากุล`;

export function normalizePatientCodeKey(code?: string): string {
  return (code || '').replace(/[\s\-]/g, '').toUpperCase();
}

export function cleanDigitsKey(val?: string): string {
  return (val || '').replace(/\D/g, '');
}

/**
 * Quote unquoted Google Maps query coordinates produced by BD-Care `exportToCsv`
 * (e.g. `https://www.google.com/maps?q=13.572179,100.588715`) so CSV splitting preserves 37 columns.
 */
function preprocessBdCareCsvText(raw: string): string {
  const withoutBom = raw.replace(/^\uFEFF/, '');
  return withoutBom.replace(
    /(^|,)(https?:\/\/www\.google\.com\/maps\?q=[-+]?\d+(?:\.\d+)?,[-+]?\d+(?:\.\d+)?)(?=,|$|\r|\n)/gm,
    '$1"$2"'
  );
}

/**
 * Standard RFC-4180 CSV parser supporting quoted commas, newlines, and escaped double quotes.
 */
export function parseCsvRows(csvText: string): string[][] {
  const normalized = preprocessBdCareCsvText(csvText);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    if (inQuotes) {
      if (ch === '"') {
        if (normalized[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(cell);
        cell = '';
      } else if (ch === '\r') {
        if (normalized[i + 1] === '\n') i++;
        row.push(cell);
        rows.push(row);
        row = [];
        cell = '';
      } else if (ch === '\n') {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = '';
      } else {
        cell += ch;
      }
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((r) => r.some((c) => c.trim().length > 0));
}

function stripExcelQuote(val?: string): string {
  return (val || '').trim().replace(/^'+/, '').trim();
}

function normalizeHyphenPlaceholder(val?: string): string {
  const clean = (val || '').trim();
  return clean === '-' ? '' : clean;
}

function parseCsvStatus(val?: string): PatientStatus {
  const s = (val || '').trim().toLowerCase();
  if (s === 'active' || s.includes('ในโครงการ')) return 'active';
  if (s === 'pending' || s.includes('รอพิจารณา')) return 'pending';
  if (s === 'deceased' || s.includes('เสียชีวิต')) return 'deceased';
  if (s === 'moved' || s.includes('ย้าย')) return 'moved';
  if (s === 'rejected' || s.includes('ไม่ผ่าน')) return 'rejected';
  return 'active';
}

function parseCsvMobility(val?: string): MobilityLevel {
  const s = (val || '').trim().toLowerCase();
  if (s.includes('กึ่ง') || s === 'semi_bedridden') return 'semi_bedridden';
  if (s.includes('เดิน') || s === 'can_walk') return 'can_walk';
  return 'bedridden';
}

function parseCsvDiaperSize(val?: string): DiaperSize {
  const s = (val || '').trim().toUpperCase();
  if (s === 'S' || s === 'M' || s === 'L' || s === 'XL' || s === 'XXL' || s === 'NONE') {
    return s;
  }
  return 'L';
}

function matchTargetVulnerabilityScore(
  targetScore: number,
  baseline: DimensionScores
): DimensionScores {
  const dims: DimensionScores = {
    mobilityScore: Math.max(0, Math.min(25, Math.round(baseline.mobilityScore))),
    complicationsScore: Math.max(0, Math.min(25, Math.round(baseline.complicationsScore))),
    economicScore: Math.max(0, Math.min(25, Math.round(baseline.economicScore))),
    caregiverScore: Math.max(0, Math.min(25, Math.round(baseline.caregiverScore))),
  };

  const clampedTarget = Math.max(0, Math.min(100, Math.round(targetScore)));
  let current =
    dims.mobilityScore + dims.complicationsScore + dims.economicScore + dims.caregiverScore;

  const keys: Array<keyof DimensionScores> = [
    'economicScore',
    'caregiverScore',
    'complicationsScore',
    'mobilityScore',
  ];

  let guard = 0;
  while (current !== clampedTarget && guard < 200) {
    let changed = false;
    for (const k of keys) {
      if (current === clampedTarget) break;
      if (current < clampedTarget && dims[k] < 25) {
        dims[k]++;
        current++;
        changed = true;
      } else if (current > clampedTarget && dims[k] > 0) {
        dims[k]--;
        current--;
        changed = true;
      }
    }
    if (!changed) break;
    guard++;
  }

  return dims;
}

export function parsePatientsFromTableRows(rawRows: unknown[][]): PatientRecord[] {
  const rows = rawRows
    .map((r) => (Array.isArray(r) ? r.map((cell) => String(cell ?? '')) : []))
    .filter((r) => r.some((c) => c.trim().length > 0));
  if (rows.length < 2) return [];

  const headerRow = rows[0].map((h) => h.trim());
  const hasHeader =
    headerRow[0]?.includes('รหัสผู้ป่วย') || headerRow.some((h) => h.includes('ชื่อ-นามสกุล'));
  const dataRows = hasHeader ? rows.slice(1) : rows;

  const nowIso = new Date().toISOString();
  const parsed: PatientRecord[] = [];

  for (let idx = 0; idx < dataRows.length; idx++) {
    let cols = [...dataRows[idx]];
    // Safety fallback if any row still split a Google Maps URL into 2 cells (38 cols instead of 37)
    if (
      cols.length === 38 &&
      typeof cols[20] === 'string' &&
      cols[20].includes('maps?q=') &&
      /^-?\d+(?:\.\d+)?$/.test((cols[21] || '').trim())
    ) {
      cols = [
        ...cols.slice(0, 20),
        `${cols[20]},${cols[21]}`,
        ...cols.slice(22),
      ];
    }

    const code = (cols[0] || '').trim();
    const rawFullName = (cols[5] || '').replace(/\s+/g, ' ').trim();
    if (!code && !rawFullName) continue;

    const status = parseCsvStatus(cols[1]);
    const admissionDate = (cols[2] || '').trim() || nowIso.slice(0, 10);
    const rawIdDigits = cleanDigitsKey(stripExcelQuote(cols[3]));
    const nationalId =
      rawIdDigits.length === 13
        ? formatNationalId(rawIdDigits)
        : stripExcelQuote(cols[3]);

    const title = (cols[4] || '').trim() || 'นาย';
    const age = Math.max(0, Number.parseInt((cols[6] || '').trim(), 10) || 0);
    const gender: 'ชาย' | 'หญิง' = (cols[7] || '').trim() === 'หญิง' ? 'หญิง' : 'ชาย';
    const phone = stripExcelQuote(cols[8]);
    const caregiverName = (cols[9] || '').trim();
    const caregiverPhone = stripExcelQuote(cols[10]);

    const houseNo = (cols[11] || '').trim();
    const buildingVillage = normalizeHyphenPlaceholder(cols[12]);
    const soi = normalizeHyphenPlaceholder(cols[13]);
    const road = normalizeHyphenPlaceholder(cols[14]);
    const subdistrict = (cols[15] || '').trim();
    const district = (cols[16] || '').trim() || 'เมืองสมุทรปราการ';
    const province = (cols[17] || '').trim() || 'สมุทรปราการ';

    const latParsed = Number.parseFloat((cols[18] || '').trim());
    const lngParsed = Number.parseFloat((cols[19] || '').trim());
    const latitude = Number.isFinite(latParsed) ? latParsed : null;
    const longitude = Number.isFinite(lngParsed) ? lngParsed : null;
    const googleMapsUrl =
      (cols[20] || '').trim() ||
      (latitude !== null && longitude !== null ? makeGoogleMapsUrl(latitude, longitude) : '');

    const mobilityLevel = parseCsvMobility(cols[21]);
    const chronicDiseases = (cols[22] || '').trim();
    const symptomsDetail = (cols[23] || '').trim();
    const hasDisabilityCard = (cols[24] || '').trim() === 'มี';
    const disabilityType =
      (cols[25] || '').trim() || 'ประเภท 3 ทางการเคลื่อนไหวหรือทางร่างกาย';

    const netIncomeVal = Number.parseFloat((cols[26] || '0').replace(/,/g, '').trim()) || 0;
    const helpCashAmount = Number.parseFloat((cols[27] || '0').replace(/,/g, '').trim()) || 0;
    const helpCashEnabled = helpCashAmount > 0;
    const helpDiaperSize = parseCsvDiaperSize(cols[28]);
    const helpDiaperPacks = Math.max(0, Number.parseInt((cols[29] || '0').trim(), 10) || 0);
    const helpRicePacks = Math.max(0, Number.parseInt((cols[30] || '0').trim(), 10) || 0);
    const helpWaterPacks = Math.max(0, Number.parseInt((cols[31] || '0').trim(), 10) || 0);
    const helpOtherSupplies = (cols[32] || '').trim() || '-';

    const csvScore = Number.parseInt((cols[33] || '').trim(), 10);
    const interviewerName = (cols[34] || '').trim() || 'นายกริชพิพัฒน์ สลับทอง';
    const approverName = (cols[35] || '').trim() || 'นางสาวศาตพร ภูมิโคกรักษ์';
    const presidentName = (cols[36] || '').trim() || 'นายไพวงศ์ ชำนินาวากุล';

    const codeKey = normalizePatientCodeKey(code) || `ROW${idx + 1}`;
    const deterministicId = sanitizeFirestoreId(`pt_${codeKey.toLowerCase()}`, 'pt');

    const baseDraft: Partial<PatientRecord> = {
      mobilityLevel,
      chronicDiseases,
      symptomsDetail,
      disabilityCard: {
        hasCard: hasDisabilityCard,
        type: disabilityType,
        cardNumber: '',
      },
      incomeSalary: netIncomeVal > 0 ? netIncomeVal : 0,
      monthlyExpense: 0,
      netIncome: netIncomeVal,
      caregiverName,
      caregiverRelation: caregiverName || 'ผู้ดูแล',
      familyMembersTotal: 2,
      helpDiaperSize,
      helpWaterSize: helpWaterPacks > 0 ? '1.5L' : 'NONE',
    };

    const assessment = calculateVulnerabilityAssessment(baseDraft);
    const vulnerabilityScore = Number.isFinite(csvScore)
      ? Math.max(0, Math.min(100, csvScore))
      : assessment.vulnerabilityScore;
    const dimensionScores = matchTargetVulnerabilityScore(
      vulnerabilityScore,
      assessment.dimensionScores
    );
    const vulnerabilityLevel =
      vulnerabilityScore >= 80
        ? 'เปราะบางสูงมาก (วิกฤต)'
        : vulnerabilityScore >= 50
        ? 'เปราะบางปานกลาง'
        : 'เปราะบางเริ่มต้น';

    const createdTimestamp = admissionDate
      ? `${admissionDate}T09:00:00.000Z`
      : nowIso;

    const record: PatientRecord = {
      id: deterministicId,
      code,
      admissionDate,
      status,
      nationalId,
      title,
      fullName: rawFullName,
      birthDate: '',
      age,
      gender,
      phone,
      caregiverName,
      caregiverRelation: caregiverName,
      caregiverPhone,
      idAddress: {
        houseNo,
        moo: '',
        trok: '',
        soi,
        road,
        subdistrict,
        district,
        province,
      },
      isSameAddress: true,
      currentAddress: {
        houseNo,
        buildingVillage,
        trok: '',
        soi,
        road,
        subdistrict,
        district,
        province,
      },
      latitude,
      longitude,
      landmarkNote: '',
      googleMapsUrl,
      qrCodeDataUrl: '',
      mobilityLevel,
      chronicDiseases,
      symptomsDetail,
      disabilityCard: {
        hasCard: hasDisabilityCard,
        type: disabilityType,
        cardNumber: '',
      },
      specialNeeds: [],
      familyMembersTotal: 2,
      familyMembersMale: gender === 'ชาย' ? 1 : 0,
      familyMembersFemale: gender === 'หญิง' ? 1 : 0,
      incomeSalary: netIncomeVal > 0 ? netIncomeVal : 0,
      incomeDisability: 0,
      incomeElderly: 0,
      incomeStateWelfare: 0,
      incomeOther: 0,
      monthlyExpense: 0,
      netIncome: netIncomeVal,
      economicNote: '',
      helpCashEnabled,
      helpCashAmount,
      helpDiaperSize,
      helpDiaperPacks,
      helpRicePacks,
      helpWaterSize: helpWaterPacks > 0 ? '1.5L' : 'NONE',
      helpWaterPacks,
      helpOtherSupplies,
      vulnerabilityScore,
      vulnerabilityLevel,
      dimensionScores,
      socialWorkerOpinion: assessment.socialWorkerOpinion,
      aiSuggestions: assessment.aiSuggestions,
      interviewerName,
      interviewerPosition: 'เจ้าหน้าที่สังคมสงเคราะห์',
      approverName,
      approverPosition: 'ผู้จัดการมูลนิธิร่วมกุศลสมุทรปราการ',
      presidentName,
      presidentPosition: 'ประธานมูลนิธิร่วมกุศลสมุทรปราการ (ประธานโครงการ)',
      photos: [],
      documents: [],
      deliveries: [],
      createdAt: createdTimestamp,
      updatedAt: createdTimestamp,
    };

    parsed.push(record);
  }

  return sortPatientsByCodeAsc(parsed);
}

export function parsePatientsFromCsv(csvText: string): PatientRecord[] {
  return parsePatientsFromTableRows(parseCsvRows(csvText));
}

export function parsePatientsFromExcelBuffer(buffer: ArrayBuffer): PatientRecord[] {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];
  const sheet = workbook.Sheets[firstSheetName];
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
  return parsePatientsFromTableRows(rows);
}

export interface ParsedBackupPayload {
  patients: PatientRecord[];
  funerals?: FuneralAssistanceRecord[];
  donations?: DonationDistributionRecord[];
  formatLabel: 'JSON สำรองระบบ' | 'JSON LocalStorage Backup' | 'ไฟล์ Excel (.xlsx/.xls)' | 'ไฟล์ CSV';
}

function tryParseJsonArray<T>(val: unknown): T[] | null {
  if (Array.isArray(val)) return val as T[];
  if (typeof val === 'string' && val.trim().startsWith('[')) {
    try {
      const inner = JSON.parse(val);
      return Array.isArray(inner) ? (inner as T[]) : null;
    } catch {
      return null;
    }
  }
  return null;
}

function normalizePatientList(list: unknown[]): PatientRecord[] {
  return sortPatientsByCodeAsc(
    list
      .filter((item): item is Record<string, any> => Boolean(item && typeof item === 'object'))
      .map((item) => normalizePatientRecord(item))
  );
}

function normalizeFuneralList(list: unknown[] | null | undefined): FuneralAssistanceRecord[] | undefined {
  if (!Array.isArray(list)) return undefined;
  return list
    .filter((item): item is Record<string, any> => Boolean(item && typeof item === 'object'))
    .map((item) => normalizeFuneralRecord(item));
}

function normalizeDonationList(list: unknown[] | null | undefined): DonationDistributionRecord[] | undefined {
  if (!Array.isArray(list)) return undefined;
  return list
    .filter((item): item is Record<string, any> => Boolean(item && typeof item === 'object'))
    .map((item) => normalizeDonationRecord(item));
}

export function parseBackupJsonText(jsonText: string): ParsedBackupPayload {
  const parsed = JSON.parse(jsonText);

  // 1. Standard BD-Care full backup object
  if (parsed && !Array.isArray(parsed) && Array.isArray(parsed.patients)) {
    return {
      patients: normalizePatientList(parsed.patients),
      funerals: normalizeFuneralList(parsed.funerals),
      donations: normalizeDonationList(parsed.donations),
      formatLabel: 'JSON สำรองระบบ',
    };
  }

  // 2. Direct array of PatientRecord (or legacy JSON export)
  if (Array.isArray(parsed)) {
    return {
      patients: normalizePatientList(parsed),
      formatLabel: 'JSON สำรองระบบ',
    };
  }

  // 3. Raw localStorage dump JSON (e.g. `bd-care-backup.json` from browser console snippet)
  if (parsed && typeof parsed === 'object') {
    const mainPatients = tryParseJsonArray<Record<string, any>>(parsed.bdcare_patients_v1);
    const recoveryPatients = tryParseJsonArray<Record<string, any>>(parsed.bdcare_patients_recovery_v1);
    const patientsRaw =
      mainPatients && mainPatients.length > 0
        ? mainPatients
        : recoveryPatients || mainPatients || [];

    const mainFunerals = tryParseJsonArray<Record<string, any>>(parsed.bdcare_funerals_v1);
    const recoveryFunerals = tryParseJsonArray<Record<string, any>>(parsed.bdcare_funerals_recovery_v1);
    const funeralsRaw =
      mainFunerals && mainFunerals.length > 0 ? mainFunerals : recoveryFunerals || mainFunerals;

    const mainDonations = tryParseJsonArray<Record<string, any>>(parsed.bdcare_donations_v1);
    const recoveryDonations = tryParseJsonArray<Record<string, any>>(
      parsed.bdcare_donations_recovery_v1
    );
    const donationsRaw =
      mainDonations && mainDonations.length > 0
        ? mainDonations
        : recoveryDonations || mainDonations;

    const hasAnyKnownKey =
      'bdcare_patients_v1' in parsed ||
      'bdcare_patients_recovery_v1' in parsed ||
      'bdcare_funerals_v1' in parsed ||
      'bdcare_funerals_recovery_v1' in parsed ||
      'bdcare_donations_v1' in parsed ||
      'bdcare_donations_recovery_v1' in parsed;

    if (hasAnyKnownKey) {
      return {
        patients: normalizePatientList(patientsRaw),
        funerals: normalizeFuneralList(funeralsRaw),
        donations: normalizeDonationList(donationsRaw),
        formatLabel: 'JSON LocalStorage Backup',
      };
    }
  }

  throw new Error('INVALID_JSON_FORMAT');
}

export async function parseBackupOrExcelFile(file: File): Promise<ParsedBackupPayload> {
  const nameLower = (file.name || '').toLowerCase();
  if (nameLower.endsWith('.xlsx') || nameLower.endsWith('.xls')) {
    const buffer = await file.arrayBuffer();
    return {
      patients: parsePatientsFromExcelBuffer(buffer),
      formatLabel: 'ไฟล์ Excel (.xlsx/.xls)',
    };
  }

  if (nameLower.endsWith('.csv')) {
    const text = await file.text();
    return {
      patients: parsePatientsFromCsv(text),
      formatLabel: 'ไฟล์ CSV',
    };
  }

  const text = await file.text();
  return parseBackupJsonText(text);
}

let cachedSeedPatients: PatientRecord[] | null = null;

export function getSeededCsvPatients(): PatientRecord[] {
  if (!cachedSeedPatients) {
    cachedSeedPatients = parsePatientsFromCsv(SEEDED_PATIENT_CSV);
  }
  return cachedSeedPatients;
}

/**
 * Merge seed records non-destructively into existing patients:
 * matches by id, normalized patient code (e.g. BDC69003), or 13-digit nationalId
 * so existing/edited Cloud patients (including 001/002) are NEVER duplicated or overwritten.
 */
export function mergeSeedPatientsIfMissing(
  existing: PatientRecord[],
  dismissedIds: string[] = []
): {
  merged: PatientRecord[];
  added: PatientRecord[];
} {
  const dismissedSet = new Set(dismissedIds);
  const existingIds = new Set<string>();
  const existingCodes = new Set<string>();
  const existingNatIds = new Set<string>();

  for (const p of existing) {
    if (p.id) existingIds.add(p.id);
    const codeKey = normalizePatientCodeKey(p.code);
    if (codeKey) existingCodes.add(codeKey);
    const nidKey = cleanDigitsKey(p.nationalId);
    if (nidKey.length === 13) existingNatIds.add(nidKey);
  }

  const seeds = getSeededCsvPatients();
  const added: PatientRecord[] = [];

  for (const seed of seeds) {
    if (dismissedSet.has(seed.id)) continue;
    const seedCodeKey = normalizePatientCodeKey(seed.code);
    const seedNidKey = cleanDigitsKey(seed.nationalId);
    const alreadyExists =
      existingIds.has(seed.id) ||
      (seedCodeKey && existingCodes.has(seedCodeKey)) ||
      (seedNidKey.length === 13 && existingNatIds.has(seedNidKey));

    if (!alreadyExists) {
      added.push(seed);
      existingIds.add(seed.id);
      if (seedCodeKey) existingCodes.add(seedCodeKey);
      if (seedNidKey.length === 13) existingNatIds.add(seedNidKey);
    }
  }

  if (added.length === 0) {
    return { merged: existing, added: [] };
  }

  return {
    merged: sortPatientsByCodeAsc([...existing, ...added]),
    added,
  };
}

/**
 * Populate missing QR codes for newly imported CSV patient records so house QR labels render immediately.
 */
export async function attachQrCodesToPatients(patients: PatientRecord[]): Promise<PatientRecord[]> {
  return Promise.all(
    patients.map(async (p) => {
      if (p.qrCodeDataUrl || !p.googleMapsUrl) return p;
      const qr = await generateQrCodeDataUrl(p.googleMapsUrl);
      return qr ? { ...p, qrCodeDataUrl: qr } : p;
    })
  );
}
