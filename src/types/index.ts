export type PatientStatus = 'active' | 'pending' | 'deceased' | 'moved' | 'rejected';

export type MobilityLevel = 'bedridden' | 'semi_bedridden' | 'can_walk';

export type DiaperSize = 'S' | 'M' | 'L' | 'XL' | 'XXL' | 'NONE';

export type WaterSize = '1.5L' | '600ML' | 'NONE';

export interface AdminUser {
  id: string;
  username: string;
  password?: string;
  name: string;
  roleTitle: string;
  position: string;
  responsibility: string;
  avatarColor: string;
  role: 'officer' | 'approver' | 'president';
}

export interface PatientPhoto {
  id: string;
  category: 'patient' | 'wound' | 'house' | 'visit';
  dataUrl: string;
  caption?: string;
  timestamp: string;
}

export interface PatientDocument {
  id: string;
  category: 'id_card' | 'house_reg' | 'disability_card' | 'medical_cert' | 'other';
  title: string;
  fileName: string;
  fileType: string;
  dataUrl: string;
  fileSize: number;
  uploadDate: string;
}

export interface MonthlyDelivery {
  id: string;
  deliveryDate: string;
  monthYearLabel: string;
  cashAmount: number;
  cashGiven: boolean;
  diaperSize: DiaperSize;
  diaperPacks: number;
  ricePacks: number;
  waterPacks: number;
  waterSize?: WaterSize;
  otherItems: string;
  receivedBy: string;
  recipientRelation: string;
  officerName: string;
  photoUrl?: string;
  notes?: string;
}

export interface StatusHistoryLog {
  previousStatus: PatientStatus;
  newStatus: PatientStatus;
  changeDate: string;
  reason: string;
  officerName: string;
}

export interface PatientRecord {
  id: string;
  code: string; // e.g. BDC-68-001
  admissionDate: string; // YYYY-MM-DD
  status: PatientStatus;
  statusReason?: string;
  statusHistory?: StatusHistoryLog[];
  
  // 1. ประวัติส่วนตัว
  nationalId: string; // 13 digits (formatted x-xxxx-xxxxx-xx-x)
  title: string; // นาย / นาง / นางสาว / ด.ช. / ด.ญ.
  fullName: string;
  birthDate: string; // YYYY-MM-DD
  age: number; // คำนวณอัตโนมัติ
  gender: 'ชาย' | 'หญิง';
  phone: string;
  caregiverName: string; // ผู้ประสานงาน/ผู้ดูแล
  caregiverRelation: string; // ความสัมพันธ์
  caregiverPhone: string;

  // 2. ข้อมูลที่อยู่
  idAddress: {
    houseNo: string;
    moo: string;
    trok: string;
    soi: string;
    road: string;
    subdistrict: string;
    district: string;
    province: string;
  };
  isSameAddress: boolean;
  currentAddress: {
    houseNo: string;
    buildingVillage: string;
    trok: string;
    soi: string;
    road: string;
    subdistrict: string;
    district: string; // เมืองสมุทรปราการ, บางพลี, พระประแดง, พระสมุทรเจดีย์, บางบ่อ, บางเสาธง
    province: string;
  };

  // 3. พิกัด GPS & นำทาง
  latitude: number | null;
  longitude: number | null;
  locationAccuracy?: number;
  landmarkNote: string;
  googleMapsUrl?: string;
  qrCodeDataUrl?: string;

  // 4. ข้อมูลการเจ็บป่วย & สุขภาพ
  mobilityLevel: MobilityLevel;
  chronicDiseases: string;
  symptomsDetail: string;
  disabilityCard: {
    hasCard: boolean;
    type: string;
    cardNumber: string;
  };
  specialNeeds: string[]; // เช่น 'แผลกดทับ', 'สายให้อาหาร', 'สายสวนปัสสาวะ', 'เสมหะ', 'ออกซิเจน'

  // 5. สภาพเศรษฐกิจครอบครัว
  familyMembersTotal: number;
  familyMembersMale: number;
  familyMembersFemale: number;
  incomeSalary: number;
  incomeDisability: number;
  incomeElderly: number;
  incomeStateWelfare: number;
  incomeOther: number;
  // สำรวจค่าใช้จ่ายผู้ป่วย: ค่าเช่าบ้าน/ค่าเช่าที่/ค่าดำรงชีพ/ค่าเดินทาง(แพทย์นัด)/หนี้สิน
  expenseRentHouse?: number;
  expenseRentLand?: number;
  expenseLiving?: number;
  expenseMedicalTravel?: number;
  expenseDebt?: number;
  expenseOther?: number;
  monthlyExpense: number;
  netIncome: number; // คำนวณอัตโนมัติ (รายได้รวม - ค่าใช้จ่าย)
  economicNote: string;

  // 6. รายการการให้ความช่วยเหลือตามระเบียบมูลนิธิร่วมกุศลสมุทรปราการ
  helpCashEnabled: boolean;
  helpCashAmount: number; // 1,000.00 บาท/เดือน
  helpDiaperSize: DiaperSize; // S, M, L, XL, XXL, NONE
  helpDiaperPacks: number; // จำนวนห่อ/เดือน
  helpRicePacks: number; // ข้าวสาร 5 กก. ค่าเริ่มต้น 2 ถุง/เดือน
  helpWaterSize?: WaterSize; // ขนาดน้ำสิงห์: '1.5L' (แพ็ค 6 ขวด) หรือ '600ML' (แพ็ค 12 ขวด)
  helpWaterPacks: number; // จำนวนแพ็ค/เดือน
  helpOtherSupplies: string; // อุปกรณ์พิเศษอื่นๆ

  // 7. การประเมินและลายเซ็น (แบบ สค.04)
  vulnerabilityScore: number; // 0 - 100
  vulnerabilityLevel?: string;
  dimensionScores?: {
    mobilityScore: number;
    complicationsScore: number;
    economicScore: number;
    caregiverScore: number;
  };
  socialWorkerOpinion: string;
  aiSuggestions?: string;
  interviewerName: string; // นายกริชพิพัฒน์ สลับทอง
  interviewerPosition: string; // เจ้าหน้าที่สังคมสงเคราะห์
  approverName: string; // นางสาวศาตพร ภูมิโคกรักษ์
  approverPosition: string; // ผู้จัดการมูลนิธิร่วมกุศลสมุทรปราการ
  presidentName: string; // นายไพวงศ์ ชำนินาวากุล
  presidentPosition: string; // ประธานมูลนิธิร่วมกุศลสมุทรปราการ (ประธานโครงการ)

  // 8. รูปภาพและเอกสาร
  photos: PatientPhoto[];
  documents: PatientDocument[];

  // 9. ประวัติการส่งมอบของประจำเดือน
  deliveries: MonthlyDelivery[];

  createdAt: string;
  updatedAt: string;
}

export const ADMIN_USERS: AdminUser[] = [
  {
    id: 'officer-gritpipat',
    username: 'gritpipat',
    password: 'password1',
    name: 'นายกริชพิพัฒน์ สลับทอง',
    roleTitle: 'เจ้าหน้าที่รับคำร้อง (Admin)',
    position: 'เจ้าหน้าที่ฝ่ายสังคมสงเคราะห์ / เจ้าหน้าที่รับคำร้อง',
    responsibility: 'รับคำร้อง, ตรวจสอบเอกสารหลักฐาน, สำรวจข้อเท็จจริง และลงพื้นที่',
    avatarColor: 'bg-emerald-600',
    role: 'officer',
  },
  {
    id: 'officer-aleena',
    username: 'aleena',
    password: 'password2',
    name: 'นางสาวอลีนา กล่ำแสง',
    roleTitle: 'เจ้าหน้าที่รับคำร้อง (Admin)',
    position: 'เจ้าหน้าที่รับคำร้อง / สงเคราะห์',
    responsibility: 'รับคำร้องขอรับความช่วยเหลือ, ตรวจสอบเอกสาร และประสานงานฌาปนกิจ',
    avatarColor: 'bg-indigo-600',
    role: 'officer',
  },
  {
    id: 'officer-muanruethai',
    username: 'muanruethai',
    password: 'password3',
    name: 'นางสาวเหมือนฤทัย มนัสน้อม',
    roleTitle: 'เจ้าหน้าที่รับคำร้อง (Admin)',
    position: 'เจ้าหน้าที่รับคำร้อง / สงเคราะห์',
    responsibility: 'รับคำร้องขอรับความช่วยเหลือ, บันทึกข้อมูล และประสานงานส่งมอบสิ่งของ',
    avatarColor: 'bg-purple-600',
    role: 'officer',
  },
  {
    id: 'manager-sataporn',
    username: 'sataporn',
    password: 'password4',
    name: 'นางสาวศาตพร ภูมิโคกรักษ์',
    roleTitle: 'ผู้จัดการมูลนิธิร่วมกุศลสมุทรปราการ ผู้อนุมัติ (Admin)',
    position: 'ผู้จัดการมูลนิธิร่วมกุศลสมุทรปราการ (ผู้อนุมัติ)',
    responsibility: 'ตรวจสอบความถูกต้องตามระเบียบมูลนิธิฯ และพิจารณาอนุมัติคำร้อง',
    avatarColor: 'bg-blue-600',
    role: 'approver',
  },
  {
    id: 'president-paiwong',
    username: 'paiwong',
    password: 'password5',
    name: 'นายไพวงศ์ ชำนินาวากุล',
    roleTitle: 'ประธานมูลนิธิร่วมกุศลสมุทรปราการ (ผู้อนุมัติ)',
    position: 'ประธานมูลนิธิร่วมกุศลสมุทรปราการ (ประธานโครงการ/ผู้อนุมัติสูงสุด)',
    responsibility: 'ลงนามอนุมัติคำร้องและกำกับดูแลภาพรวมงบประมาณสงเคราะห์',
    avatarColor: 'bg-red-700',
    role: 'president',
  },
];

// ประเภทเอกสารแนบ 7 รายการ สำหรับการขอรับความช่วยเหลืออนุเคราะห์เผาศพ
export type FuneralDocCategory =
  | 'deceased_id_card'       // 1. บัตรประชาชนผู้เสียชีวิต
  | 'deceased_house_reg'     // 2. สำเนาทะเบียนบ้านผู้เสียชีวิต
  | 'death_notification'     // 3. สำเนาใบแจ้งตาย
  | 'death_certificate'      // 4. สำเนาใบมรณะบัตร
  | 'police_report'          // 5. สำเนาใบแจ้งความ/สำเนาใบบันทึกประจำวัน
  | 'applicant_id_card'      // 6. สำเนาบัตรประชาชนผู้ยื่นคำร้อง
  | 'applicant_house_reg'    // 7. สำเนาทะเบียนบ้านผู้ยื่นคำร้อง
  | 'other';                 // เอกสารเพิ่มเติมอื่นๆ

export interface FuneralDocument {
  id: string;
  category: FuneralDocCategory;
  title: string;
  fileName: string;
  fileType: string;
  dataUrl: string;
  fileSize: number;
  uploadDate: string;
}

export interface FuneralAssistanceRecord {
  id: string;
  code: string; // e.g. "ศพ-68-001"
  applicationDate: string; // YYYY-MM-DD
  status: 'pending' | 'approved' | 'completed' | 'rejected';
  statusNote?: string;
  
  // 1. ข้อมูลผู้เสียชีวิต
  deceasedTitle: string; // นาย / นาง / นางสาว / ด.ช. / ด.ญ.
  deceasedName: string;
  deceasedNationalId: string; // 13 หลัก
  deceasedAge: number;
  deceasedDeathDate: string; // YYYY-MM-DD
  deceasedDeathTime?: string; // HH:MM
  causeOfDeath: string; // สาเหตุการเสียชีวิต
  deathPlace: string; // สถานที่เสียชีวิต (เช่น รพ.สมุทรปราการ, บ้านพัก)
  deceasedAddress: string; // ที่อยู่ตามทะเบียนบ้าน

  // 2. ข้อมูลผู้ยื่นคำร้อง (ญาติ/ผู้จัดการศพ)
  applicantTitle: string;
  applicantName: string;
  applicantNationalId: string; // 13 หลัก
  applicantPhone: string;
  applicantRelation: string; // ความสัมพันธ์กับผู้เสียชีวิต (บุตร, บิดา/มารดา, คู่สมรส, ญาติ, ผู้นำชุมชน)
  applicantAddress: string;
  applicantPovertyReason: string; // สภาพความยากจน/เหตุผลความจำเป็นในการขอรับการอนุเคราะห์

  // 3. ข้อมูลการจัดพิธีฌาปนกิจและรายการอนุเคราะห์
  templeName: string; // วัดที่จัดพิธีฌาปนกิจ
  cremationDate: string; // วันที่ทำพิธีฌาปนกิจ/เผาศพ
  cremationTime?: string;
  assistanceAmount: number; // จำนวนเงินอนุเคราะห์ (สามารถเพิ่ม/แก้ไขได้โดยเจ้าหน้าที่)
  coffinProvided: boolean; // การอนุเคราะห์หีบศพฟรีของมูลนิธิฯ
  transportProvided: boolean; // รถตู้/รถพยาบาลรับ-ส่งร่างผู้เสียชีวิต
  shroudClothProvided: boolean; // ผ้าขาวห่อศพ
  sandalwoodFlowersCount?: number; // (ลบออกจากรายการแล้ว)
  otherItems?: string; // รายการช่วยเหลืออื่นๆ เพิ่มเติม

  // 4. เจ้าหน้าที่รับคำร้อง & ผู้อนุมัติ
  officerId: string;
  officerName: string; // นายกริชพิพัฒน์ / น.ส.อลีนา / น.ส.เหมือนฤทัย
  officerPosition: string;
  approverId?: string;
  approverName?: string; // น.ส.ศาตพร ภูมิโคกรักษ์
  approverPosition?: string;
  approvalDate?: string;

  // 5. เอกสารแนบ 7 รายการ
  documents: FuneralDocument[];

  createdAt: string;
  updatedAt: string;
}

export const FUNERAL_DOC_DEFINITIONS: {
  category: FuneralDocCategory;
  number: number;
  title: string;
  shortLabel: string;
  description: string;
  isRequired: boolean;
}[] = [
  {
    category: 'deceased_id_card',
    number: 1,
    title: 'บัตรประชาชนผู้เสียชีวิต',
    shortLabel: 'บัตรผู้เสียชีวิต',
    description: 'ภาพถ่ายหรือสำเนาบัตรประจำตัวประชาชนของผู้เสียชีวิต',
    isRequired: true,
  },
  {
    category: 'deceased_house_reg',
    number: 2,
    title: 'สำเนาทะเบียนบ้านผู้เสียชีวิต',
    shortLabel: 'ทะเบียนบ้านผู้เสียชีวิต',
    description: 'สำเนาทะเบียนบ้านหน้าที่มีชื่อของผู้เสียชีวิต (หรือจำหน่ายตาย)',
    isRequired: true,
  },
  {
    category: 'death_notification',
    number: 3,
    title: 'สำเนาใบแจ้งตาย',
    shortLabel: 'ใบแจ้งตาย',
    description: 'ใบแจ้งตายที่ออกโดยแพทย์/โรงพยาบาล หรือผู้ใหญ่บ้าน/ผู้นำชุมชน',
    isRequired: true,
  },
  {
    category: 'death_certificate',
    number: 4,
    title: 'สำเนาใบมรณะบัตร',
    shortLabel: 'ใบมรณะบัตร',
    description: 'ใบมรณะบัตรที่ออกโดยสำนักทะเบียนท้องถิ่น/อำเภอ',
    isRequired: true,
  },
  {
    category: 'police_report',
    number: 5,
    title: 'สำเนาใบแจ้งความ/สำเนาใบบันทึกประจำวัน',
    shortLabel: 'ใบแจ้งความ/ประจำวัน',
    description: 'ใบบันทึกประจำวันจากสถานีตำรวจ (กรณีเสียชีวิตผิดธรรมชาติ หรือนำส่งชันสูตร)',
    isRequired: true,
  },
  {
    category: 'applicant_id_card',
    number: 6,
    title: 'สำเนาบัตรประชาชนผู้ยื่นคำร้อง',
    shortLabel: 'บัตรผู้ยื่นคำร้อง',
    description: 'บัตรประจำตัวประชาชนของญาติ/ผู้ยื่นคำร้องขอรับความช่วยเหลือ',
    isRequired: true,
  },
  {
    category: 'applicant_house_reg',
    number: 7,
    title: 'สำเนาทะเบียนบ้านผู้ยื่นคำร้อง',
    shortLabel: 'ทะเบียนบ้านผู้ยื่นคำร้อง',
    description: 'สำเนาทะเบียนบ้านของผู้ยื่นคำร้อง เพื่อยืนยันความสัมพันธ์และถิ่นที่อยู่',
    isRequired: true,
  },
];

export const SAMUT_PRAKAN_DISTRICTS = [
  'เมืองสมุทรปราการ',
  'บางพลี',
  'พระประแดง',
  'พระสมุทรเจดีย์',
  'บางบ่อ',
  'บางเสาธง',
] as const;

export const DISABILITY_TYPES = [
  'ประเภท 1 ทางการเห็น',
  'ประเภท 2 ทางการได้ยินหรือสื่อความหมาย',
  'ประเภท 3 ทางการเคลื่อนไหวหรือทางร่างกาย',
  'ประเภท 4 ทางจิตใจหรือพฤติกรรม',
  'ประเภท 5 ทางสติปัญญา',
  'ประเภท 6 ทางการเรียนรู้',
  'ประเภท 7 ทางออทิสติก',
  'พิการซ้ำซ้อน / อื่นๆ',
];

// ==========================================
// การบริจาคสิ่งของให้ประชาชนและหน่วยงานราชการ
// ==========================================
export type DonationRecipientType = 'individual' | 'government';
export type DonationStatus = 'completed' | 'pending' | 'cancelled';

export interface DonationOtherItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
}

export interface DonationPhoto {
  id: string;
  dataUrl: string;
  caption?: string;
  timestamp: string;
}

export interface DonationDocument {
  id: string;
  title: string;
  fileName: string;
  fileType: string;
  dataUrl: string;
  fileSize: number;
  uploadDate: string;
}

export interface DonationDistributionRecord {
  id: string;
  code: string; // e.g. บริจาค-68-001
  distributionDate: string; // YYYY-MM-DD
  status: DonationStatus;
  recipientType: DonationRecipientType;

  // 1. กรณีประชาชนทั่วไป (individual)
  individualTitle?: string;
  individualName?: string;
  individualNationalId?: string;
  individualPhone?: string;
  individualAddress?: string;
  individualCategory?: string;
  individualNeedReason?: string;

  // 2. กรณีหน่วยงานราชการ (government)
  agencyName?: string;
  agencyType?: string;
  agencyContactPerson?: string;
  agencyContactPosition?: string;
  agencyPhone?: string;
  agencyAddress?: string;
  agencyRequestPurpose?: string;
  officialLetterNo?: string;

  // 3. รายการสิ่งของบริจาค
  waterPacks: number;
  waterUnit?: string;
  dryFoodCount: number;
  dryFoodUnit?: string;
  riceBags: number;
  riceKg?: number;
  diaperPacks: number;
  diaperSize?: string;
  otherItems: DonationOtherItem[];
  notes?: string;

  // 4. สถานที่และวิธีการส่งมอบ
  handoverPlace: string;
  deliveryMethod: string;

  // 5. เจ้าหน้าที่ผู้ดำเนินการ
  officerId: string;
  officerName: string;
  officerPosition: string;
  approverName: string;
  approverPosition: string;

  // 6. รูปถ่ายและเอกสารแนบ
  photos: DonationPhoto[];
  documents: DonationDocument[];

  createdAt: string;
  updatedAt: string;
}

