import { PatientRecord, FuneralAssistanceRecord, DonationDistributionRecord } from '../types';
import { generateQrCodeDataUrl, makeGoogleMapsUrl } from './qrcode';

const STORAGE_KEY = 'bdcare_patients_v1';
const FUNERAL_STORAGE_KEY = 'bdcare_funerals_v1';
const DONATION_STORAGE_KEY = 'bdcare_donations_v1';
const CURRENT_ADMIN_KEY = 'bdcare_current_admin_id';

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
    return parsed;
  } catch (err) {
    console.error('Failed to load patients from localStorage:', err);
    return [];
  }
}

export function saveStoredPatients(patients: PatientRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(patients));
  } catch (err) {
    console.warn('localStorage quota exceeded when saving patients, retrying with compressed media cache:', err);
    try {
      const compact = patients.map((p) => ({
        ...p,
        photos: [],
        documents: [],
        deliveries: (p.deliveries || []).map((d) => ({ ...d, photoUrl: undefined })),
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(compact));
    } catch (innerErr) {
      console.error('Failed to save compact patients to localStorage:', innerErr);
    }
  }
}

export function clearAllStoredPatients(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
  } catch (err) {
    console.error('Failed to clear patients in localStorage:', err);
  }
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

  const rows = patients.map((p) => [
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
    p.currentAddress.houseNo,
    p.currentAddress.buildingVillage || '-',
    p.currentAddress.soi || '-',
    p.currentAddress.road || '-',
    p.currentAddress.subdistrict,
    p.currentAddress.district,
    p.currentAddress.province,
    p.latitude || '',
    p.longitude || '',
    p.googleMapsUrl || '',
    p.mobilityLevel === 'bedridden' ? 'ติดเตียง 100%' : p.mobilityLevel === 'semi_bedridden' ? 'กึ่งติดเตียง' : 'พอเดินได้',
    `"${(p.chronicDiseases || '').replace(/"/g, '""')}"`,
    `"${(p.symptomsDetail || '').replace(/"/g, '""')}"`,
    p.disabilityCard.hasCard ? 'มี' : 'ไม่มี',
    `"${p.disabilityCard.type || '-'}"`,
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
}

export function getStoredFunerals(): FuneralAssistanceRecord[] {
  try {
    const raw = localStorage.getItem(FUNERAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Failed to load funerals from localStorage:', err);
    return [];
  }
}

export function saveStoredFunerals(records: FuneralAssistanceRecord[]): void {
  try {
    localStorage.setItem(FUNERAL_STORAGE_KEY, JSON.stringify(records));
  } catch (err) {
    console.warn('localStorage quota exceeded when saving funerals, retrying without embedded files:', err);
    try {
      const compact = records.map((r) => ({ ...r, documents: [] }));
      localStorage.setItem(FUNERAL_STORAGE_KEY, JSON.stringify(compact));
    } catch (innerErr) {
      console.error('Failed to save compact funerals to localStorage:', innerErr);
    }
  }
}

export function clearAllStoredFunerals(): void {
  try {
    localStorage.setItem(FUNERAL_STORAGE_KEY, JSON.stringify([]));
  } catch (err) {
    console.error('Failed to clear funerals in localStorage:', err);
  }
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
    return parsed;
  } catch (err) {
    console.error('Failed to load donations from localStorage:', err);
    return [];
  }
}

export function saveStoredDonations(donations: DonationDistributionRecord[]): void {
  try {
    localStorage.setItem(DONATION_STORAGE_KEY, JSON.stringify(donations));
  } catch (err) {
    console.warn('localStorage quota exceeded when saving donations, retrying without embedded media:', err);
    try {
      const compact = donations.map((d) => ({ ...d, photos: [], documents: [] }));
      localStorage.setItem(DONATION_STORAGE_KEY, JSON.stringify(compact));
    } catch (innerErr) {
      console.error('Failed to save compact donations to localStorage:', innerErr);
    }
  }
}

export function clearAllStoredDonations(): void {
  try {
    localStorage.setItem(DONATION_STORAGE_KEY, JSON.stringify([]));
  } catch (err) {
    console.error('Failed to clear donations in localStorage:', err);
  }
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
  const data = {
    exportedAt: new Date().toISOString(),
    system: 'BD-Care โครงการใจถึงใจ บริจาคสิ่งของ และอนุเคราะห์เผาศพ มูลนิธิร่วมกุศลสมุทรปราการ',
    version: '1.2.0',
    totalPatients: patients.length,
    totalFunerals: funerals.length,
    totalDonations: donations.length,
    patients,
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

