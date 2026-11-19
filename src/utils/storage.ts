import * as XLSX from 'xlsx';
import {
  PatientRecord,
  FuneralAssistanceRecord,
  DonationDistributionRecord,
  DeliveryPlanSettings,
  PendingOpsState,
} from '../types';
import { generateQrCodeDataUrl, makeGoogleMapsUrl } from './qrcode';
import { formatThaiMonthYear, sortPatientsByCodeAsc } from './idCard';
import {
  normalizeDonationRecord,
  normalizeFuneralRecord,
  normalizePatientRecord,
} from './normalizers';
import firebaseConfig from '../../firebase-applet-config.json';

const STORAGE_KEY = 'bdcare_patients_v1';
const RECOVERY_PATIENTS_KEY = 'bdcare_patients_recovery_v1';
const FUNERAL_STORAGE_KEY = 'bdcare_funerals_v1';
const RECOVERY_FUNERALS_KEY = 'bdcare_funerals_recovery_v1';
const DONATION_STORAGE_KEY = 'bdcare_donations_v1';
const RECOVERY_DONATIONS_KEY = 'bdcare_donations_recovery_v1';
const CURRENT_ADMIN_KEY = 'bdcare_current_admin_id';
const DELIVERY_SETTINGS_KEY = 'bdcare_delivery_settings_v1';
const LEGACY_RICE_PRICE_KEY = 'bdcare_rice_price_per_bag';
const PENDING_OPS_KEY = 'bdcare_pending_ops_v1';
const KNOWN_SYNCED_KEY = 'bdcare_known_synced_v1';
const KNOWN_SYNCED_SCOPE = `${firebaseConfig.projectId}:${firebaseConfig.firestoreDatabaseId || '(default)'}`;
const AUTHORIZED_EMAILS_KEY = 'bdcare_authorized_emails_v1';
const LAST_AUTH_UID_KEY = 'bdcare_last_auth_uid_v1';
const DISMISSED_SEED_KEY = 'bdcare_dismissed_seed_ids_v1';

// Empty default list - demo data removed per user request
export const INITIAL_DEMO_PATIENTS: PatientRecord[] = [];

export async function loadInitialDataWithQRCodes(): Promise<PatientRecord[]> {
  return [];
}

export function getStoredPatients(): PatientRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const normalized = parsed
      .filter((item): item is Record<string, any> => Boolean(item && typeof item === 'object'))
      .map((item) => normalizePatientRecord(item));
    return sortPatientsByCodeAsc(normalized);
  } catch (err) {
    console.error('Failed to load patients from localStorage:', err);
    return [];
  }
}

export function getRecoveryPatients(): PatientRecord[] {
  try {
    const raw = localStorage.getItem(RECOVERY_PATIENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const normalized = parsed
      .filter((item): item is Record<string, any> => Boolean(item && typeof item === 'object'))
      .map((item) => normalizePatientRecord(item));
    return sortPatientsByCodeAsc(normalized);
  } catch {
    return [];
  }
}

export function saveStoredPatients(patients: PatientRecord[]): void {
  const sorted = sortPatientsByCodeAsc(patients);
  const saveToKey = (key: string) => {
    try {
      localStorage.setItem(key, JSON.stringify(sorted));
    } catch (err) {
      console.warn(`localStorage quota exceeded when saving ${key}, retrying with compact cache:`, err);
      try {
        const compact = sorted.map((p) => ({
          ...p,
          _compactStrippedMedia: true,
          photos: [],
          documents: [],
          deliveries: (p.deliveries || []).map((d) => ({ ...d, photoUrl: undefined })),
        }));
        localStorage.setItem(key, JSON.stringify(compact));
      } catch (innerErr) {
        console.error(`Failed to save compact patients to ${key}:`, innerErr);
      }
    }
  };

  saveToKey(STORAGE_KEY);
  // Preserve non-empty recovery snapshot so sign-out or database migration never loses patient records
  if (sorted.length > 0) {
    saveToKey(RECOVERY_PATIENTS_KEY);
  }
}

export function saveExactStoredPatients(patients: PatientRecord[]): void {
  // Never delete recovery backup even if synced state is temporarily empty
  saveStoredPatients(patients);
}

export function getStoredAdminId(): string {
  return localStorage.getItem(CURRENT_ADMIN_KEY) || 'officer-gritpipat';
}

export function saveStoredAdminId(id: string): void {
  localStorage.setItem(CURRENT_ADMIN_KEY, id);
}

// Export to Thai-compatible CSV with UTF-8 BOM
export function exportToCsv(patients: PatientRecord[]): void {
  const headers = [
    'รหัสผู้ป่วย',
    'สถานะ',
    'วันที่รับเข้าโครงการ',
    'เลขประจำตัวประชาชน',
    'คำนำหน้า',
    'ชื่อ-นามสกุล',
    'อายุ (ปี)',
    'เพศ',
    'เบอร์โทรศัพท์',
    'ผู้ดูแล/ผู้ประสานงาน',
    'เบอร์โทรผู้ดูแล',
    'ที่อยู่ปัจจุบัน (บ้านเลขที่)',
    'หมู่บ้าน/อาคาร',
    'ซอย',
    'ถนน',
    'ตำบล',
    'อำเภอ',
    'จังหวัด',
    'พิกัด ละติจูด',
    'พิกัด ลองจิจูด',
    'ลิงก์ Google Maps',
    'ระดับการเจ็บป่วย',
    'โรคประจำตัว',
    'อาการเจ็บป่วย',
    'มีบัตรคนพิการ',
    'ประเภทคนพิการ',
    'รายได้สุทธิต่อเดือน (บาท)',
    'เงินสดช่วยเหลือ (บาท/เดือน)',
    'ขนาดผ้าอ้อม',
    'จำนวนผ้าอ้อม (ห่อ/เดือน)',
    'ข้าวสาร 5 กก. (ถุง/เดือน)',
    'น้ำดื่ม 1.5L (แพ็ค/เดือน)',
    'อุปกรณ์พิเศษอื่นๆ',
    'คะแนนความเปราะบาง (0-100)',
    'เจ้าหน้าที่สัมภาษณ์',
    'ผู้พิจารณาอนุมัติ',
    'ผู้อนุมัติโครงการ',
  ];

  const sortedPatients = sortPatientsByCodeAsc(patients);
  const rows = sortedPatients.map((p) => [
    p.code,
    p.status,
    p.admissionDate,
    `'${p.nationalId}`,
    p.title,
    p.fullName,
    p.age,
    p.gender,
    `'${p.phone}`,
    p.caregiverName,
    `'${p.caregiverPhone}`,
    p.currentAddress?.houseNo || '',
    p.currentAddress?.buildingVillage || '-',
    p.currentAddress?.soi || '-',
    p.currentAddress?.road || '-',
    p.currentAddress?.subdistrict || '',
    p.currentAddress?.district || '',
    p.currentAddress?.province || '',
    p.latitude || '',
    p.longitude || '',
    `"${(p.googleMapsUrl || '').replace(/"/g, '""')}"`,
    p.mobilityLevel === 'bedridden' ? 'ติดเตียง 100%' : p.mobilityLevel === 'semi_bedridden' ? 'กึ่งติดเตียง' : 'พอเดินได้',
    `"${(p.chronicDiseases || '').replace(/"/g, '""')}"`,
    `"${(p.symptomsDetail || '').replace(/"/g, '""')}"`,
    p.disabilityCard?.hasCard ? 'มี' : 'ไม่มี',
    `"${p.disabilityCard?.type || '-'}"`,
    p.netIncome,
    p.helpCashEnabled ? p.helpCashAmount : 0,
    p.helpDiaperSize,
    p.helpDiaperPacks,
    p.helpRicePacks,
    p.helpWaterPacks,
    `"${(p.helpOtherSupplies || '').replace(/"/g, '""')}"`,
    p.vulnerabilityScore,
    p.interviewerName,
    p.approverName,
    p.presidentName,
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.join(',')),
  ].join('\r\n');

  // Add UTF-8 BOM \uFEFF to render Thai accurately in Excel
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `BD-Care_ข้อมูลผู้ป่วยมูลนิธิร่วมกุศล_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Export all patients to a native Excel (.xlsx) workbook
export function exportPatientsToExcel(patients: PatientRecord[]): void {
  const headers = [
    'รหัสผู้ป่วย',
    'สถานะ',
    'วันที่รับเข้าโครงการ',
    'เลขประจำตัวประชาชน',
    'คำนำหน้า',
    'ชื่อ-นามสกุล',
    'อายุ (ปี)',
    'เพศ',
    'เบอร์โทรศัพท์',
    'ผู้ดูแล/ผู้ประสานงาน',
    'เบอร์โทรผู้ดูแล',
    'ที่อยู่ปัจจุบัน (บ้านเลขที่)',
    'หมู่บ้าน/อาคาร',
    'ซอย',
    'ถนน',
    'ตำบล',
    'อำเภอ',
    'จังหวัด',
    'พิกัด ละติจูด',
    'พิกัด ลองจิจูด',
    'ลิงก์ Google Maps',
    'ระดับการเจ็บป่วย',
    'โรคประจำตัว',
    'อาการเจ็บป่วย',
    'มีบัตรคนพิการ',
    'ประเภทคนพิการ',
    'รายได้สุทธิต่อเดือน (บาท)',
    'เงินสดช่วยเหลือ (บาท/เดือน)',
    'ขนาดผ้าอ้อม',
    'จำนวนผ้าอ้อม (ห่อ/เดือน)',
    'ข้าวสาร 5 กก. (ถุง/เดือน)',
    'น้ำดื่ม 1.5L (แพ็ค/เดือน)',
    'อุปกรณ์พิเศษอื่นๆ',
    'คะแนนความเปราะบาง (0-100)',
    'เจ้าหน้าที่สัมภาษณ์',
    'ผู้พิจารณาอนุมัติ',
    'ผู้อนุมัติโครงการ',
  ];

  const sortedPatients = sortPatientsByCodeAsc(patients);
  const dataRows = sortedPatients.map((p) => [
    p.code || '',
    p.status || 'active',
    p.admissionDate || '',
    p.nationalId || '',
    p.title || '',
    p.fullName || '',
    p.age ?? 0,
    p.gender || '',
    p.phone || '',
    p.caregiverName || '',
    p.caregiverPhone || '',
    p.currentAddress?.houseNo || '',
    p.currentAddress?.buildingVillage || '-',
    p.currentAddress?.soi || '-',
    p.currentAddress?.road || '-',
    p.currentAddress?.subdistrict || '',
    p.currentAddress?.district || '',
    p.currentAddress?.province || '',
    p.latitude ?? '',
    p.longitude ?? '',
    p.googleMapsUrl || '',
    p.mobilityLevel === 'bedridden'
      ? 'ติดเตียง 100%'
      : p.mobilityLevel === 'semi_bedridden'
      ? 'กึ่งติดเตียง'
      : 'พอเดินได้',
    p.chronicDiseases || '',
    p.symptomsDetail || '',
    p.disabilityCard?.hasCard ? 'มี' : 'ไม่มี',
    p.disabilityCard?.type || '-',
    p.netIncome ?? 0,
    p.helpCashEnabled ? p.helpCashAmount ?? 0 : 0,
    p.helpDiaperSize || 'NONE',
    p.helpDiaperPacks ?? 0,
    p.helpRicePacks ?? 0,
    p.helpWaterPacks ?? 0,
    p.helpOtherSupplies || '-',
    p.vulnerabilityScore ?? 0,
    p.interviewerName || '',
    p.approverName || '',
    p.presidentName || '',
  ]);

  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
  worksheet['!cols'] = headers.map((h, i) => {
    if (i === 5 || i === 22 || i === 23) return { wch: 28 };
    if (i === 20) return { wch: 42 };
    if (i === 3 || i === 0) return { wch: 20 };
    return { wch: Math.max(14, h.length + 4) };
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'ทะเบียนผู้ป่วย สค.04');
  XLSX.writeFile(
    workbook,
    `BD-Care_ข้อมูลผู้ป่วยมูลนิธิร่วมกุศล_${new Date().toISOString().slice(0, 10)}.xlsx`
  );
}

export function getStoredFunerals(): FuneralAssistanceRecord[] {
  try {
    const raw = localStorage.getItem(FUNERAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is Record<string, any> => Boolean(item && typeof item === 'object'))
      .map((item) => normalizeFuneralRecord(item));
  } catch (err) {
    console.error('Failed to load funerals from localStorage:', err);
    return [];
  }
}

export function getRecoveryFunerals(): FuneralAssistanceRecord[] {
  try {
    const raw = localStorage.getItem(RECOVERY_FUNERALS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is Record<string, any> => Boolean(item && typeof item === 'object'))
      .map((item) => normalizeFuneralRecord(item));
  } catch {
    return [];
  }
}

export function saveStoredFunerals(records: FuneralAssistanceRecord[]): void {
  const saveToKey = (key: string) => {
    try {
      localStorage.setItem(key, JSON.stringify(records));
    } catch (err) {
      console.warn(`localStorage quota exceeded when saving ${key}, retrying without embedded files:`, err);
      try {
        const compact = records.map((r) => ({
          ...r,
          _compactStrippedMedia: true,
          documents: [],
        }));
        localStorage.setItem(key, JSON.stringify(compact));
      } catch (innerErr) {
        console.error(`Failed to save compact funerals to ${key}:`, innerErr);
      }
    }
  };
  saveToKey(FUNERAL_STORAGE_KEY);
  if (records.length > 0) {
    saveToKey(RECOVERY_FUNERALS_KEY);
  }
}

export function saveExactStoredFunerals(records: FuneralAssistanceRecord[]): void {
  saveStoredFunerals(records);
}

export function generateFuneralCode(existingCount: number): string {
  const currentYear = new Date().getFullYear() + 543;
  const shortYear = currentYear.toString().slice(-2);
  const nextNum = (existingCount + 1).toString().padStart(3, '0');
  return `ศพ-${shortYear}-${nextNum}`;
}

// Export Funeral records to CSV
export function exportFuneralsToCsv(records: FuneralAssistanceRecord[]): void {
  const headers = [
    'รหัสคำร้อง',
    'สถานะ',
    'วันที่ยื่นคำร้อง',
    'ชื่อ-สกุลผู้เสียชีวิต',
    'เลขบัตรประชาชนผู้เสียชีวิต',
    'อายุผู้เสียชีวิต (ปี)',
    'วันที่เสียชีวิต',
    'สาเหตุการเสียชีวิต',
    'สถานที่เสียชีวิต',
    'ที่อยู่ผู้เสียชีวิต',
    'ชื่อผู้ยื่นคำร้อง',
    'ความสัมพันธ์',
    'เบอร์โทรผู้ยื่นคำร้อง',
    'เลขบัตรประชาชนผู้ยื่นคำร้อง',
    'วัดที่จัดพิธีฌาปนกิจ',
    'กำหนดการวันฌาปนกิจ',
    'จำนวนเงินอนุเคราะห์ (บาท)',
    'การอนุเคราะห์หีบศพ',
    'บริการรถรับส่งร่าง',
    'ผ้าขาวห่อศพ',
    'เอกสารแนบครบ 7 รายการ',
    'เจ้าหน้าที่ผู้รับคำร้อง',
    'ผู้พิจารณาอนุมัติ',
  ];

  const rows = records.map((r) => [
    r.code,
    r.status === 'approved' ? 'อนุมัติแล้ว' : r.status === 'completed' ? 'ฌาปนกิจเสร็จสิ้น' : r.status === 'rejected' ? 'ไม่อนุมัติ' : 'รอพิจารณา',
    r.applicationDate,
    `${r.deceasedTitle || ''}${r.deceasedName}`,
    `'${r.deceasedNationalId}`,
    r.deceasedAge,
    r.deceasedDeathDate,
    `"${(r.causeOfDeath || '').replace(/"/g, '""')}"`,
    `"${(r.deathPlace || '').replace(/"/g, '""')}"`,
    `"${(r.deceasedAddress || '').replace(/"/g, '""')}"`,
    `${r.applicantTitle || ''}${r.applicantName}`,
    r.applicantRelation,
    `'${r.applicantPhone}`,
    `'${r.applicantNationalId}`,
    `"${(r.templeName || '').replace(/"/g, '""')}"`,
    r.cremationDate,
    r.assistanceAmount,
    r.coffinProvided ? 'รับหีบศพ' : 'ไม่รับ',
    r.transportProvided ? 'มีรถรับส่ง' : 'ไม่มี',
    r.shroudClothProvided ? 'มี' : 'ไม่มี',
    `${r.documents.length}/7 รายการ`,
    r.officerName,
    r.approverName || '-',
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.join(',')),
  ].join('\r\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `BD-Care_คำร้องอนุเคราะห์เผาศพ_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ==========================================
// การบริจาคสิ่งของ (Donations Storage)
// ==========================================
export function getStoredDonations(): DonationDistributionRecord[] {
  try {
    const raw = localStorage.getItem(DONATION_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is Record<string, any> => Boolean(item && typeof item === 'object'))
      .map((item) => normalizeDonationRecord(item));
  } catch (err) {
    console.error('Failed to load donations from localStorage:', err);
    return [];
  }
}

export function getRecoveryDonations(): DonationDistributionRecord[] {
  try {
    const raw = localStorage.getItem(RECOVERY_DONATIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is Record<string, any> => Boolean(item && typeof item === 'object'))
      .map((item) => normalizeDonationRecord(item));
  } catch {
    return [];
  }
}

export function saveStoredDonations(donations: DonationDistributionRecord[]): void {
  const saveToKey = (key: string) => {
    try {
      localStorage.setItem(key, JSON.stringify(donations));
    } catch (err) {
      console.warn(`localStorage quota exceeded when saving ${key}, retrying without embedded media:`, err);
      try {
        const compact = donations.map((d) => ({
          ...d,
          _compactStrippedMedia: true,
          photos: [],
          documents: [],
        }));
        localStorage.setItem(key, JSON.stringify(compact));
      } catch (innerErr) {
        console.error(`Failed to save compact donations to ${key}:`, innerErr);
      }
    }
  };
  saveToKey(DONATION_STORAGE_KEY);
  if (donations.length > 0) {
    saveToKey(RECOVERY_DONATIONS_KEY);
  }
}

export function saveExactStoredDonations(donations: DonationDistributionRecord[]): void {
  saveStoredDonations(donations);
}

// Export Donations to CSV with UTF-8 BOM
export function exportDonationsToCsv(records: DonationDistributionRecord[]): void {
  const headers = [
    'เลขที่บันทึกบริจาค',
    'สถานะ',
    'วันที่ส่งมอบ',
    'ประเภทผู้รับ',
    'ชื่อผู้รับ/หน่วยงาน',
    'ประเภทหน่วยงาน/กลุ่มเป้าหมาย',
    'ผู้แทน/ผู้รับมอบ',
    'ตำแหน่ง',
    'เบอร์โทรศัพท์',
    'เลขบัตรประชาชน (กรณีบุคคล)',
    'ที่อยู่/สถานที่ตั้ง',
    'เหตุผลความจำเป็น/วัตถุประสงค์',
    'เลขที่หนังสือขอความอนุเคราะห์',
    'น้ำดื่ม (แพ็ค)',
    'อาหารแห้ง (ชุด)',
    'ข้าวสาร (ถุง 5 กก.)',
    'แพมเพิส (แพ็ค)',
    'ขนาดแพมเพิส',
    'รายการสิ่งของอื่นๆ เพิ่มเติม',
    'สถานที่ส่งมอบ',
    'วิธีการส่งมอบ',
    'เจ้าหน้าที่ผู้ส่งมอบ',
    'ผู้อนุมัติ',
  ];

  const rows = records.map((r) => {
    const isIndiv = r.recipientType === 'individual';
    const recipientTitleName = isIndiv
      ? `${r.individualTitle || ''}${r.individualName || ''}`
      : r.agencyName || '';
    const categoryOrType = isIndiv
      ? r.individualCategory || 'ประชาชนทั่วไป'
      : r.agencyType || 'หน่วยงานราชการ';
    const contactRep = isIndiv ? '-' : r.agencyContactPerson || '-';
    const contactPos = isIndiv ? '-' : r.agencyContactPosition || '-';
    const phone = isIndiv ? r.individualPhone || '' : r.agencyPhone || '';
    const nationalId = isIndiv ? r.individualNationalId || '' : '';
    const address = isIndiv ? r.individualAddress || '' : r.agencyAddress || '';
    const reasonOrPurpose = isIndiv
      ? r.individualNeedReason || ''
      : r.agencyRequestPurpose || '';
    const otherSummary = (r.otherItems || [])
      .map((item) => `${item.name} (${item.quantity} ${item.unit})`)
      .join('; ');

    return [
      r.code,
      r.status === 'completed'
        ? 'ส่งมอบเรียบร้อย'
        : r.status === 'pending'
        ? 'รอส่งมอบ'
        : 'ยกเลิก',
      r.distributionDate,
      isIndiv ? 'ประชาชนทั่วไป' : 'หน่วยงานราชการ',
      `"${recipientTitleName.replace(/"/g, '""')}"`,
      `"${categoryOrType.replace(/"/g, '""')}"`,
      `"${contactRep.replace(/"/g, '""')}"`,
      `"${contactPos.replace(/"/g, '""')}"`,
      `'${phone}`,
      nationalId ? `'${nationalId}` : '-',
      `"${address.replace(/"/g, '""')}"`,
      `"${reasonOrPurpose.replace(/"/g, '""')}"`,
      `"${(r.officialLetterNo || '-').replace(/"/g, '""')}"`,
      r.waterPacks || 0,
      r.dryFoodCount || 0,
      r.riceBags || 0,
      r.diaperPacks || 0,
      r.diaperSize || '-',
      `"${otherSummary.replace(/"/g, '""')}"`,
      `"${(r.handoverPlace || '').replace(/"/g, '""')}"`,
      r.deliveryMethod || '',
      r.officerName || '',
      r.approverName || '',
    ];
  });

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.join(',')),
  ].join('\r\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `BD-Care_บันทึกการบริจาคสิ่งของ_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Export Complete Backup JSON
export function exportBackupJson(
  patients: PatientRecord[], 
  funerals: FuneralAssistanceRecord[] = [],
  donations: DonationDistributionRecord[] = []
): void {
  const sortedPatients = sortPatientsByCodeAsc(patients);
  const data = {
    exportedAt: new Date().toISOString(),
    system: 'BD-Care โครงการใจถึงใจ บริจาคสิ่งของ และอนุเคราะห์เผาศพ มูลนิธิร่วมกุศลสมุทรปราการ',
    version: '1.2.0',
    totalPatients: sortedPatients.length,
    totalFunerals: funerals.length,
    totalDonations: donations.length,
    patients: sortedPatients,
    funerals,
    donations,
  };
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `BD-Care_Backup_Full_${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ==========================================
// Cross-Device Sync & Delivery Plan Settings
// ==========================================

export function getDefaultDeliverySettings(): DeliveryPlanSettings {
  let legacyPrice = 0;
  try {
    const saved = localStorage.getItem(LEGACY_RICE_PRICE_KEY);
    const parsed = saved ? parseFloat(saved) : 0;
    if (Number.isFinite(parsed) && parsed >= 0) {
      legacyPrice = parsed;
    }
  } catch {
    /* ignore */
  }
  return {
    ricePricePerBag: legacyPrice,
    customRiceCount: null,
    currentMonth: formatThaiMonthYear(new Date().toISOString().slice(0, 10)) || 'พฤศจิกายน พ.ศ. 2569',
    updatedAt: '',
  };
}

export function getStoredDeliverySettings(): DeliveryPlanSettings {
  const defaults = getDefaultDeliverySettings();
  try {
    const raw = localStorage.getItem(DELIVERY_SETTINGS_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return defaults;
    const price = Number(parsed.ricePricePerBag);
    const customRice =
      parsed.customRiceCount === null || parsed.customRiceCount === undefined
        ? null
        : Number(parsed.customRiceCount);
    return {
      ricePricePerBag: Number.isFinite(price) && price >= 0 ? price : defaults.ricePricePerBag,
      customRiceCount:
        customRice !== null && Number.isFinite(customRice) && customRice >= 0 ? customRice : null,
      currentMonth:
        typeof parsed.currentMonth === 'string' && parsed.currentMonth.trim()
          ? parsed.currentMonth
          : defaults.currentMonth,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : '',
    };
  } catch {
    return defaults;
  }
}

export function saveStoredDeliverySettings(settings: DeliveryPlanSettings): void {
  try {
    localStorage.setItem(DELIVERY_SETTINGS_KEY, JSON.stringify(settings));
    localStorage.setItem(LEGACY_RICE_PRICE_KEY, String(settings.ricePricePerBag || 0));
  } catch (err) {
    console.error('Failed to save delivery settings to localStorage:', err);
  }
}

const EMPTY_PENDING_OPS: PendingOpsState = {
  upserts: { patients: [], funerals: [], donations: [], deliverySettings: false },
  deletes: { patients: [], funerals: [], donations: [] },
};

export function getPendingOps(): PendingOpsState {
  try {
    const raw = localStorage.getItem(PENDING_OPS_KEY);
    if (!raw) return structuredClone(EMPTY_PENDING_OPS);
    const parsed = JSON.parse(raw);
    return {
      upserts: {
        patients: Array.isArray(parsed?.upserts?.patients) ? parsed.upserts.patients : [],
        funerals: Array.isArray(parsed?.upserts?.funerals) ? parsed.upserts.funerals : [],
        donations: Array.isArray(parsed?.upserts?.donations) ? parsed.upserts.donations : [],
        deliverySettings: Boolean(parsed?.upserts?.deliverySettings),
      },
      deletes: {
        patients: Array.isArray(parsed?.deletes?.patients) ? parsed.deletes.patients : [],
        funerals: Array.isArray(parsed?.deletes?.funerals) ? parsed.deletes.funerals : [],
        donations: Array.isArray(parsed?.deletes?.donations) ? parsed.deletes.donations : [],
      },
    };
  } catch {
    return structuredClone(EMPTY_PENDING_OPS);
  }
}

export function savePendingOps(ops: PendingOpsState): void {
  try {
    localStorage.setItem(PENDING_OPS_KEY, JSON.stringify(ops));
  } catch (err) {
    console.error('Failed to save pendingOps:', err);
  }
}

export function markPendingUpsert(kind: 'patients' | 'funerals' | 'donations', id: string): void {
  const ops = getPendingOps();
  if (!ops.upserts[kind].includes(id)) {
    ops.upserts[kind].push(id);
  }
  ops.deletes[kind] = ops.deletes[kind].filter((x) => x !== id);
  savePendingOps(ops);
}

export function clearPendingUpsert(kind: 'patients' | 'funerals' | 'donations', id: string): void {
  const ops = getPendingOps();
  ops.upserts[kind] = ops.upserts[kind].filter((x) => x !== id);
  savePendingOps(ops);
}

export function markPendingDelete(kind: 'patients' | 'funerals' | 'donations', id: string): void {
  const ops = getPendingOps();
  if (!ops.deletes[kind].includes(id)) {
    ops.deletes[kind].push(id);
  }
  ops.upserts[kind] = ops.upserts[kind].filter((x) => x !== id);
  savePendingOps(ops);
}

export function clearPendingDelete(kind: 'patients' | 'funerals' | 'donations', id: string): void {
  const ops = getPendingOps();
  ops.deletes[kind] = ops.deletes[kind].filter((x) => x !== id);
  savePendingOps(ops);
}

export function setPendingDeliverySettings(pending: boolean): void {
  const ops = getPendingOps();
  ops.upserts.deliverySettings = pending;
  savePendingOps(ops);
}

export function clearAllPendingOps(): void {
  savePendingOps(structuredClone(EMPTY_PENDING_OPS));
}

export interface KnownSyncedIds {
  patients: string[];
  funerals: string[];
  donations: string[];
}

export function getKnownSyncedIds(): KnownSyncedIds {
  try {
    const raw = localStorage.getItem(KNOWN_SYNCED_KEY);
    if (!raw) return { patients: [], funerals: [], donations: [] };
    const parsed = JSON.parse(raw);
    // Invalidate known-synced list if stored under a different Firebase project/database
    // so local records are safely uploaded rather than wiped by an empty new DB snapshot
    if (parsed?.dbScope !== KNOWN_SYNCED_SCOPE) {
      return { patients: [], funerals: [], donations: [] };
    }
    return {
      patients: Array.isArray(parsed?.patients) ? parsed.patients : [],
      funerals: Array.isArray(parsed?.funerals) ? parsed.funerals : [],
      donations: Array.isArray(parsed?.donations) ? parsed.donations : [],
    };
  } catch {
    return { patients: [], funerals: [], donations: [] };
  }
}

export function saveKnownSyncedIds(ids: KnownSyncedIds): void {
  try {
    localStorage.setItem(
      KNOWN_SYNCED_KEY,
      JSON.stringify({ ...ids, dbScope: KNOWN_SYNCED_SCOPE })
    );
  } catch {
    /* ignore */
  }
}

export function addKnownSyncedIds(
  kind: 'patients' | 'funerals' | 'donations',
  ids: string[]
): void {
  if (!ids.length) return;
  const current = getKnownSyncedIds();
  const merged = Array.from(new Set([...current[kind], ...ids]));
  current[kind] = merged;
  saveKnownSyncedIds(current);
}

export function replaceKnownSyncedIds(
  kind: 'patients' | 'funerals' | 'donations',
  ids: string[]
): void {
  const current = getKnownSyncedIds();
  current[kind] = Array.from(new Set(ids));
  saveKnownSyncedIds(current);
}

export function removeKnownSyncedId(
  kind: 'patients' | 'funerals' | 'donations',
  id: string
): void {
  const current = getKnownSyncedIds();
  current[kind] = current[kind].filter((x) => x !== id);
  saveKnownSyncedIds(current);
}

export function clearAllKnownSyncedIds(): void {
  saveKnownSyncedIds({ patients: [], funerals: [], donations: [] });
}

export function getStoredAuthorizedEmails(): string[] {
  try {
    const raw = localStorage.getItem(AUTHORIZED_EMAILS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((e): e is string => typeof e === 'string' && e.includes('@'))
      : [];
  } catch {
    return [];
  }
}

export function saveStoredAuthorizedEmails(emails: string[]): void {
  try {
    localStorage.setItem(AUTHORIZED_EMAILS_KEY, JSON.stringify(emails));
  } catch {
    /* ignore */
  }
}

export function getStoredLastAuthUid(): string | null {
  try {
    return localStorage.getItem(LAST_AUTH_UID_KEY);
  } catch {
    return null;
  }
}

export function saveStoredLastAuthUid(uid: string | null): void {
  try {
    if (!uid) {
      localStorage.removeItem(LAST_AUTH_UID_KEY);
    } else {
      localStorage.setItem(LAST_AUTH_UID_KEY, uid);
    }
  } catch {
    /* ignore */
  }
}

export function getDismissedSeedIds(): string[] {
  try {
    const raw = localStorage.getItem(DISMISSED_SEED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function markDismissedSeedId(id: string): void {
  if (!id) return;
  try {
    const current = getDismissedSeedIds();
    if (!current.includes(id)) {
      localStorage.setItem(DISMISSED_SEED_KEY, JSON.stringify([...current, id]));
    }
  } catch {
    /* ignore */
  }
}

export function clearDismissedSeedId(id: string): void {
  if (!id) return;
  try {
    const current = getDismissedSeedIds();
    if (current.includes(id)) {
      localStorage.setItem(
        DISMISSED_SEED_KEY,
        JSON.stringify(current.filter((x) => x !== id))
      );
    }
  } catch {
    /* ignore */
  }
}
