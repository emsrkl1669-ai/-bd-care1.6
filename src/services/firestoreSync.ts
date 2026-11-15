import { User } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  deleteDoc,
  where,
  Unsubscribe,
} from 'firebase/firestore';
import {
  db,
  SUPER_ADMIN_EMAIL,
  OperationType,
  handleFirestoreError,
  isSuperAdminUser,
  usernameToAuthEmail,
  findAdminUserByAuthEmail,
} from '../firebase';
import {
  ADMIN_USERS,
  PatientRecord,
  MonthlyDelivery,
  PatientPhoto,
  PatientDocument,
  FuneralAssistanceRecord,
  FuneralDocument,
  DonationDistributionRecord,
  DonationPhoto,
  DonationDocument,
  DeliveryPlanSettings,
  AccessRequestRecord,
} from '../types';
import { compressImageDataUrl, sanitizeFirestoreId } from '../utils/image';
import {
  getPendingOps,
  getKnownSyncedIds,
  addKnownSyncedIds,
  removeKnownSyncedId,
  clearPendingUpsert,
  clearPendingDelete,
  setPendingDeliverySettings,
  saveStoredAuthorizedEmails,
} from '../utils/storage';

function safeNum(val: unknown, fallback: number = 0): number {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

function safeCoord(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

function asOptStr(val: unknown, maxLen: number): string | undefined {
  if (val === null || val === undefined) return undefined;
  return String(val).slice(0, maxLen);
}

function asMap(val: unknown): Record<string, any> | undefined {
  if (!val || typeof val !== 'object' || Array.isArray(val)) return undefined;
  return val as Record<string, any>;
}

function normalizeDiaperSize(val: unknown): 'S' | 'M' | 'L' | 'XL' | 'XXL' | 'NONE' {
  const s = typeof val === 'string' ? val.toUpperCase().trim() : '';
  if (s === 'S' || s === 'M' || s === 'L' || s === 'XL' || s === 'XXL' || s === 'NONE') {
    return s;
  }
  return 'NONE';
}

function normalizeWaterSize(val: unknown): '1.5L' | '600ML' | 'NONE' {
  const s = typeof val === 'string' ? val.toUpperCase().trim() : '';
  if (s === '1.5L' || s === '600ML' || s === 'NONE') {
    return s;
  }
  return '1.5L';
}

function normalizeMobility(val: unknown): 'bedridden' | 'semi_bedridden' | 'can_walk' {
  if (val === 'bedridden' || val === 'semi_bedridden' || val === 'can_walk') return val;
  return 'bedridden';
}

function normalizePatientStatus(
  val: unknown
): 'active' | 'pending' | 'deceased' | 'moved' | 'rejected' {
  if (
    val === 'active' ||
    val === 'pending' ||
    val === 'deceased' ||
    val === 'moved' ||
    val === 'rejected'
  ) {
    return val;
  }
  return 'active';
}

function emailsNeedBackfill(existingEmails: unknown, targetEmails: string[]): boolean {
  if (!Array.isArray(existingEmails)) return true;
  const existingSet = new Set(existingEmails.map((e) => String(e).trim().toLowerCase()));
  return targetEmails.some((e) => !existingSet.has(e.trim().toLowerCase()));
}

export const DEFAULT_STAFF_EMAILS = ADMIN_USERS.map((u) =>
  usernameToAuthEmail(u.username)
);

export function normalizeAuthorizedEmails(
  emails: string[] = [],
  currentUser?: User | null
): string[] {
  const set = new Set<string>([
    SUPER_ADMIN_EMAIL.toLowerCase(),
    ...DEFAULT_STAFF_EMAILS,
  ]);
  for (const e of emails) {
    const clean = (e || '').trim().toLowerCase();
    if (clean && clean.includes('@') && clean.length <= 200) {
      set.add(clean);
    }
  }
  if (currentUser?.email) {
    const uEmail = currentUser.email.trim().toLowerCase();
    if (uEmail.includes('@')) set.add(uEmail);
  }
  return Array.from(set).slice(0, 20);
}

/**
 * Recursively strip undefined values from objects (preserving null only where explicitly set, e.g. lat/lng)
 */
function stripUndefined<T extends Record<string, any>>(obj: T): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) {
      out[k] = v.map((item) =>
        item && typeof item === 'object' && !(item instanceof Date)
          ? stripUndefined(item)
          : item
      );
    } else if (v !== null && typeof v === 'object' && !(v instanceof Date)) {
      // Preserve Firestore FieldValue sentinels (like serverTimestamp())
      if ('_methodName' in v || 'isEqual' in v) {
        out[k] = v;
      } else {
        out[k] = stripUndefined(v);
      }
    } else {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Ensure admin entry exists for SuperAdmin email in /admins/{uid}
 */
export async function ensureSuperAdminDirectory(user: User): Promise<void> {
  if (!isSuperAdminUser(user)) return;
  const uid = sanitizeFirestoreId(user.uid, 'uid');
  const ref = doc(db, 'admins', uid);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        uid,
        email: user.email || '',
        displayName: user.displayName || 'Super Admin',
        role: 'superadmin',
        serverCreatedAt: serverTimestamp(),
        serverUpdatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(
        ref,
        {
          email: user.email || '',
          displayName: user.displayName || 'Super Admin',
          role: 'superadmin',
          serverUpdatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `admins/${uid}`);
  }
}

/**
 * Non-destructive merge helper for manual JSON backup imports.
 */
export function mergeRecordsNonDestructively<T extends { id: string; updatedAt?: string; createdAt?: string }>(
  cloudItems: T[],
  localItems: T[],
  deletedIds?: Set<string>
): T[] {
  const map = new Map<string, T>();

  for (const item of localItems) {
    if (deletedIds && deletedIds.has(item.id)) continue;
    map.set(item.id, item);
  }

  for (const cloudItem of cloudItems) {
    if (deletedIds && deletedIds.has(cloudItem.id)) continue;
    const existing = map.get(cloudItem.id);
    if (!existing) {
      map.set(cloudItem.id, cloudItem);
    } else {
      const cloudTime = Date.parse(cloudItem.updatedAt || cloudItem.createdAt || '') || 0;
      const localTime = Date.parse(existing.updatedAt || existing.createdAt || '') || 0;
      if (cloudTime >= localTime) {
        map.set(cloudItem.id, cloudItem);
      }
    }
  }

  return Array.from(map.values());
}

/**
 * Authoritative cross-device reconciliation:
 * - Applies Cloud updates immediately regardless of device clock skew.
 * - Removes local items that were previously synced but deleted on another device.
 * - Preserves local unsynced offline edits/creations until uploaded.
 */
export function reconcileWithCloudSnapshot<T extends { id: string; updatedAt?: string; createdAt?: string }>(
  cloudItems: T[],
  prevLocal: T[],
  pendingUpsertIds: Set<string>,
  pendingDeleteIds: Set<string>,
  knownSyncedIds: Set<string>,
  isAuthoritativeServerSnapshot: boolean
): T[] {
  const localMap = new Map<string, T>();
  for (const item of prevLocal) {
    if (pendingDeleteIds.has(item.id)) continue;
    localMap.set(item.id, item);
  }

  const resultMap = new Map<string, T>();

  for (const cloudItem of cloudItems) {
    if (pendingDeleteIds.has(cloudItem.id)) continue;
    const localItem = localMap.get(cloudItem.id);
    if (localItem && pendingUpsertIds.has(cloudItem.id)) {
      const cloudTime = Date.parse(cloudItem.updatedAt || cloudItem.createdAt || '') || 0;
      const localTime = Date.parse(localItem.updatedAt || localItem.createdAt || '') || 0;
      resultMap.set(cloudItem.id, localTime > cloudTime ? localItem : cloudItem);
    } else {
      resultMap.set(cloudItem.id, cloudItem);
    }
  }

  // Keep any local item that has NOT yet been synced to Cloud (or has pending local edits)
  for (const localItem of prevLocal) {
    if (pendingDeleteIds.has(localItem.id)) continue;
    if (resultMap.has(localItem.id)) continue;
    if (pendingUpsertIds.has(localItem.id)) {
      resultMap.set(localItem.id, localItem);
      continue;
    }
    if (!isAuthoritativeServerSnapshot || !knownSyncedIds.has(localItem.id)) {
      resultMap.set(localItem.id, localItem);
    }
  }

  return Array.from(resultMap.values());
}

// ============================================================================
// Serializers (Strictly aligned with firestore.rules allowlists)
// ============================================================================

function serializePatientParent(
  patient: PatientRecord,
  ownerUid: string,
  authorizedEmails: string[] | undefined,
  existingServerCreatedAt?: any,
  isUpdate?: boolean
) {
  const id = sanitizeFirestoreId(patient.id, 'pt');
  const nowIso = new Date().toISOString();

  const safeStatusHistory = Array.isArray(patient.statusHistory)
    ? patient.statusHistory
        .filter((h): h is NonNullable<typeof h> => Boolean(h && typeof h === 'object' && !Array.isArray(h)))
        .slice(-50)
    : undefined;

  const safeSpecialNeeds = Array.isArray(patient.specialNeeds)
    ? patient.specialNeeds.map((x) => String(x || '')).filter(Boolean).slice(0, 20)
    : [];

  const qrRaw = typeof patient.qrCodeDataUrl === 'string' ? patient.qrCodeDataUrl : '';

  const payload: Record<string, any> = {
    id,
    ownerUid,
    ...(authorizedEmails !== undefined ? { authorizedEmails } : {}),
    code: ((patient.code || '').trim() || `BDC-${id}`).slice(0, 40),
    admissionDate: (patient.admissionDate || nowIso.slice(0, 10)).slice(0, 32),
    status: normalizePatientStatus(patient.status),
    statusReason: asOptStr(patient.statusReason, 1000),
    statusHistory: safeStatusHistory,
    nationalId: (patient.nationalId || '').slice(0, 30),
    title: (patient.title || '').slice(0, 30),
    fullName: ((patient.fullName || '').trim() || 'ไม่ระบุชื่อ').slice(0, 200),
    birthDate: asOptStr(patient.birthDate, 32),
    age: safeNum(patient.age, 0),
    gender: patient.gender === 'หญิง' ? 'หญิง' : 'ชาย',
    phone: (patient.phone || '').slice(0, 50),
    caregiverName: (patient.caregiverName || '').slice(0, 200),
    caregiverRelation: (patient.caregiverRelation || '').slice(0, 100),
    caregiverPhone: (patient.caregiverPhone || '').slice(0, 50),
    idAddress: asMap(patient.idAddress),
    isSameAddress: Boolean(patient.isSameAddress),
    currentAddress: asMap(patient.currentAddress),
    latitude: safeCoord(patient.latitude),
    longitude: safeCoord(patient.longitude),
    ...(typeof patient.locationAccuracy === 'number' && Number.isFinite(patient.locationAccuracy)
      ? { locationAccuracy: patient.locationAccuracy }
      : {}),
    landmarkNote: (patient.landmarkNote || '').slice(0, 1000),
    googleMapsUrl: (patient.googleMapsUrl || '').slice(0, 500),
    qrCodeDataUrl: qrRaw.length <= 40000 ? qrRaw : '',
    mobilityLevel: normalizeMobility(patient.mobilityLevel),
    chronicDiseases: (patient.chronicDiseases || '').slice(0, 1000),
    symptomsDetail: (patient.symptomsDetail || '').slice(0, 2000),
    disabilityCard: asMap(patient.disabilityCard),
    specialNeeds: safeSpecialNeeds,
    familyMembersTotal: safeNum(patient.familyMembersTotal, 0),
    familyMembersMale: safeNum(patient.familyMembersMale, 0),
    familyMembersFemale: safeNum(patient.familyMembersFemale, 0),
    incomeSalary: safeNum(patient.incomeSalary, 0),
    incomeDisability: safeNum(patient.incomeDisability, 0),
    incomeElderly: safeNum(patient.incomeElderly, 0),
    incomeStateWelfare: safeNum(patient.incomeStateWelfare, 0),
    incomeOther: safeNum(patient.incomeOther, 0),
    expenseRentHouse:
      patient.expenseRentHouse !== undefined && patient.expenseRentHouse !== null
        ? safeNum(patient.expenseRentHouse, 0)
        : undefined,
    expenseRentLand:
      patient.expenseRentLand !== undefined && patient.expenseRentLand !== null
        ? safeNum(patient.expenseRentLand, 0)
        : undefined,
    expenseLiving:
      patient.expenseLiving !== undefined && patient.expenseLiving !== null
        ? safeNum(patient.expenseLiving, 0)
        : undefined,
    expenseMedicalTravel:
      patient.expenseMedicalTravel !== undefined && patient.expenseMedicalTravel !== null
        ? safeNum(patient.expenseMedicalTravel, 0)
        : undefined,
    expenseDebt:
      patient.expenseDebt !== undefined && patient.expenseDebt !== null
        ? safeNum(patient.expenseDebt, 0)
        : undefined,
    expenseOther:
      patient.expenseOther !== undefined && patient.expenseOther !== null
        ? safeNum(patient.expenseOther, 0)
        : undefined,
    monthlyExpense: safeNum(patient.monthlyExpense, 0),
    netIncome: safeNum(patient.netIncome, 0),
    economicNote: (patient.economicNote || '').slice(0, 1000),
    helpCashEnabled: Boolean(patient.helpCashEnabled),
    helpCashAmount: safeNum(patient.helpCashAmount, 0),
    helpDiaperSize: normalizeDiaperSize(patient.helpDiaperSize),
    helpDiaperPacks: safeNum(patient.helpDiaperPacks, 0),
    helpRicePacks: safeNum(patient.helpRicePacks, 0),
    helpWaterSize: normalizeWaterSize(patient.helpWaterSize),
    helpWaterPacks: safeNum(patient.helpWaterPacks, 0),
    helpOtherSupplies: (patient.helpOtherSupplies || '').slice(0, 500),
    vulnerabilityScore: safeNum(patient.vulnerabilityScore, 0),
    vulnerabilityLevel: (patient.vulnerabilityLevel || '').slice(0, 100),
    dimensionScores: asMap(patient.dimensionScores),
    socialWorkerOpinion: (patient.socialWorkerOpinion || '').slice(0, 3000),
    aiSuggestions: (patient.aiSuggestions || '').slice(0, 3000),
    interviewerName: (patient.interviewerName || '').slice(0, 200),
    interviewerPosition: (patient.interviewerPosition || '').slice(0, 200),
    approverName: (patient.approverName || '').slice(0, 200),
    approverPosition: (patient.approverPosition || '').slice(0, 200),
    presidentName: (patient.presidentName || '').slice(0, 200),
    presidentPosition: (patient.presidentPosition || '').slice(0, 200),
    createdAt: ((patient.createdAt || '').trim() || nowIso).slice(0, 64),
    updatedAt: ((patient.updatedAt || '').trim() || nowIso).slice(0, 64),
    serverCreatedAt: isUpdate && existingServerCreatedAt ? existingServerCreatedAt : serverTimestamp(),
    serverUpdatedAt: serverTimestamp(),
  };

  return stripUndefined(payload);
}

async function serializeDeliveryDoc(
  delivery: MonthlyDelivery,
  patientId: string,
  ownerUid: string,
  authorizedEmails: string[] | undefined,
  existingServerCreatedAt?: any,
  isUpdate?: boolean
) {
  const id = sanitizeFirestoreId(delivery.id, 'del');
  let safePhotoUrl = typeof delivery.photoUrl === 'string' ? delivery.photoUrl : undefined;
  if (safePhotoUrl && safePhotoUrl.startsWith('data:image/') && safePhotoUrl.length > 480000) {
    safePhotoUrl = await compressImageDataUrl(safePhotoUrl, {
      maxWidth: 900,
      maxHeight: 900,
      quality: 0.7,
      maxDataUrlLength: 470000,
    });
  }
  if (!safePhotoUrl || safePhotoUrl.length > 500000) {
    safePhotoUrl = undefined;
  }

  return stripUndefined({
    id,
    patientId,
    ownerUid,
    ...(authorizedEmails !== undefined ? { authorizedEmails } : {}),
    deliveryDate: ((delivery.deliveryDate || '').trim() || new Date().toISOString().slice(0, 10)).slice(0, 32),
    monthYearLabel: (delivery.monthYearLabel || '').slice(0, 80),
    cashAmount: safeNum(delivery.cashAmount, 0),
    cashGiven: Boolean(delivery.cashGiven),
    diaperSize: normalizeDiaperSize(delivery.diaperSize),
    diaperPacks: safeNum(delivery.diaperPacks, 0),
    ricePacks: safeNum(delivery.ricePacks, 0),
    waterPacks: safeNum(delivery.waterPacks, 0),
    waterSize: normalizeWaterSize(delivery.waterSize),
    otherItems: (delivery.otherItems || '').slice(0, 500),
    receivedBy: ((delivery.receivedBy || '').trim() || 'ผู้ป่วย/ผู้ดูแล').slice(0, 200),
    recipientRelation: (delivery.recipientRelation || '').slice(0, 100),
    officerName: (delivery.officerName || '').slice(0, 200),
    photoUrl: safePhotoUrl,
    notes: asOptStr(delivery.notes, 500),
    serverCreatedAt: isUpdate && existingServerCreatedAt ? existingServerCreatedAt : serverTimestamp(),
    serverUpdatedAt: serverTimestamp(),
  });
}

async function serializeMediaDoc(
  media: {
    id: string;
    category?: string;
    title?: string;
    fileName?: string;
    fileType?: string;
    dataUrl: string;
    fileSize?: number;
    caption?: string;
    timestamp?: string;
    uploadDate?: string;
  },
  parentId: string,
  kind: 'photo' | 'document',
  ownerUid: string,
  authorizedEmails: string[] | undefined,
  existingServerCreatedAt?: any,
  isUpdate?: boolean
) {
  const id = sanitizeFirestoreId(media.id, kind === 'photo' ? 'photo' : 'doc');
  let safeDataUrl = typeof media.dataUrl === 'string' ? media.dataUrl : '';
  if (safeDataUrl.startsWith('data:image/') && safeDataUrl.length > 820000) {
    safeDataUrl = await compressImageDataUrl(safeDataUrl, {
      maxWidth: 1100,
      maxHeight: 1100,
      quality: 0.72,
      maxDataUrlLength: 800000,
    });
  }
  if (!safeDataUrl || safeDataUrl.length > 850000) {
    return null;
  }

  return stripUndefined({
    id,
    parentId,
    ownerUid,
    ...(authorizedEmails !== undefined ? { authorizedEmails } : {}),
    kind,
    category: asOptStr(media.category, 64),
    title: asOptStr(media.title, 200),
    fileName: asOptStr(media.fileName, 255),
    fileType: asOptStr(media.fileType, 120),
    dataUrl: safeDataUrl,
    fileSize: typeof media.fileSize === 'number' && Number.isFinite(media.fileSize) ? media.fileSize : undefined,
    caption: asOptStr(media.caption, 500),
    timestamp: asOptStr(media.timestamp, 100),
    uploadDate: asOptStr(media.uploadDate, 64),
    serverCreatedAt: isUpdate && existingServerCreatedAt ? existingServerCreatedAt : serverTimestamp(),
    serverUpdatedAt: serverTimestamp(),
  });
}

function serializeFuneralParent(
  record: FuneralAssistanceRecord,
  ownerUid: string,
  authorizedEmails: string[] | undefined,
  existingServerCreatedAt?: any,
  isUpdate?: boolean
) {
  const id = sanitizeFirestoreId(record.id, 'funeral');
  const nowIso = new Date().toISOString();
  const safeStatus =
    record.status === 'pending' ||
    record.status === 'approved' ||
    record.status === 'completed' ||
    record.status === 'rejected'
      ? record.status
      : 'pending';

  return stripUndefined({
    id,
    ownerUid,
    ...(authorizedEmails !== undefined ? { authorizedEmails } : {}),
    code: ((record.code || '').trim() || `ศพ-${id}`).slice(0, 40),
    applicationDate: (record.applicationDate || nowIso.slice(0, 10)).slice(0, 32),
    status: safeStatus,
    statusNote: asOptStr(record.statusNote, 1000),
    deceasedTitle: (record.deceasedTitle || '').slice(0, 30),
    deceasedName: ((record.deceasedName || '').trim() || 'ไม่ระบุชื่อ').slice(0, 200),
    deceasedNationalId: (record.deceasedNationalId || '').slice(0, 30),
    deceasedAge: safeNum(record.deceasedAge, 0),
    deceasedDeathDate: (record.deceasedDeathDate || '').slice(0, 32),
    deceasedDeathTime: (record.deceasedDeathTime || '').slice(0, 16),
    causeOfDeath: (record.causeOfDeath || '').slice(0, 500),
    deathPlace: (record.deathPlace || '').slice(0, 300),
    deceasedAddress: (record.deceasedAddress || '').slice(0, 500),
    applicantTitle: (record.applicantTitle || '').slice(0, 30),
    applicantName: ((record.applicantName || '').trim() || 'ไม่ระบุชื่อ').slice(0, 200),
    applicantNationalId: (record.applicantNationalId || '').slice(0, 30),
    applicantPhone: (record.applicantPhone || '').slice(0, 50),
    applicantRelation: (record.applicantRelation || '').slice(0, 100),
    applicantAddress: (record.applicantAddress || '').slice(0, 500),
    applicantPovertyReason: (record.applicantPovertyReason || '').slice(0, 1000),
    templeName: (record.templeName || '').slice(0, 300),
    cremationDate: (record.cremationDate || '').slice(0, 32),
    cremationTime: (record.cremationTime || '').slice(0, 16),
    assistanceAmount: safeNum(record.assistanceAmount, 0),
    coffinProvided: Boolean(record.coffinProvided),
    transportProvided: Boolean(record.transportProvided),
    shroudClothProvided: Boolean(record.shroudClothProvided),
    otherItems: (record.otherItems || '').slice(0, 500),
    officerId: (record.officerId || '').slice(0, 128),
    officerName: (record.officerName || '').slice(0, 200),
    officerPosition: (record.officerPosition || '').slice(0, 200),
    approverId: asOptStr(record.approverId, 128),
    approverName: (record.approverName || '').slice(0, 200),
    approverPosition: (record.approverPosition || '').slice(0, 200),
    approvalDate: asOptStr(record.approvalDate, 32),
    createdAt: ((record.createdAt || '').trim() || nowIso).slice(0, 64),
    updatedAt: ((record.updatedAt || '').trim() || nowIso).slice(0, 64),
    serverCreatedAt: isUpdate && existingServerCreatedAt ? existingServerCreatedAt : serverTimestamp(),
    serverUpdatedAt: serverTimestamp(),
  });
}

function serializeDonationParent(
  record: DonationDistributionRecord,
  ownerUid: string,
  authorizedEmails: string[] | undefined,
  existingServerCreatedAt?: any,
  isUpdate?: boolean
) {
  const id = sanitizeFirestoreId(record.id, 'donation');
  const nowIso = new Date().toISOString();
  const safeStatus =
    record.status === 'completed' || record.status === 'pending' || record.status === 'cancelled'
      ? record.status
      : 'completed';
  const safeRecipientType =
    record.recipientType === 'individual' || record.recipientType === 'government'
      ? record.recipientType
      : 'individual';

  const safeOtherItems = Array.isArray(record.otherItems)
    ? record.otherItems.slice(0, 30).map((item) => ({
        id: String(item?.id || ''),
        name: String(item?.name || '').slice(0, 200),
        quantity: safeNum(item?.quantity, 0),
        unit: String(item?.unit || '').slice(0, 40),
      }))
    : [];

  return stripUndefined({
    id,
    ownerUid,
    ...(authorizedEmails !== undefined ? { authorizedEmails } : {}),
    code: ((record.code || '').trim() || `บริจาค-${id}`).slice(0, 40),
    distributionDate: (record.distributionDate || nowIso.slice(0, 10)).slice(0, 32),
    status: safeStatus,
    recipientType: safeRecipientType,
    individualTitle: (record.individualTitle || '').slice(0, 30),
    individualName: (record.individualName || '').slice(0, 200),
    individualNationalId: (record.individualNationalId || '').slice(0, 30),
    individualPhone: (record.individualPhone || '').slice(0, 50),
    individualAddress: (record.individualAddress || '').slice(0, 500),
    individualCategory: (record.individualCategory || '').slice(0, 100),
    individualNeedReason: (record.individualNeedReason || '').slice(0, 1000),
    agencyName: (record.agencyName || '').slice(0, 300),
    agencyType: (record.agencyType || '').slice(0, 120),
    agencyContactPerson: (record.agencyContactPerson || '').slice(0, 200),
    agencyContactPosition: (record.agencyContactPosition || '').slice(0, 200),
    agencyPhone: (record.agencyPhone || '').slice(0, 50),
    agencyAddress: (record.agencyAddress || '').slice(0, 500),
    agencyRequestPurpose: (record.agencyRequestPurpose || '').slice(0, 1000),
    officialLetterNo: (record.officialLetterNo || '').slice(0, 100),
    waterPacks: safeNum(record.waterPacks, 0),
    waterUnit: (record.waterUnit || 'แพ็ค').slice(0, 40),
    dryFoodCount: safeNum(record.dryFoodCount, 0),
    dryFoodUnit: (record.dryFoodUnit || 'ชุด').slice(0, 40),
    riceBags: safeNum(record.riceBags, 0),
    riceKg: safeNum(record.riceKg, 0),
    diaperPacks: safeNum(record.diaperPacks, 0),
    diaperSize: (record.diaperSize || '').slice(0, 40),
    otherItems: safeOtherItems,
    notes: (record.notes || '').slice(0, 1000),
    handoverPlace: (record.handoverPlace || '').slice(0, 300),
    deliveryMethod: (record.deliveryMethod || '').slice(0, 200),
    officerId: (record.officerId || '').slice(0, 128),
    officerName: (record.officerName || '').slice(0, 200),
    officerPosition: (record.officerPosition || '').slice(0, 200),
    approverName: (record.approverName || '').slice(0, 200),
    approverPosition: (record.approverPosition || '').slice(0, 200),
    createdAt: ((record.createdAt || '').trim() || nowIso).slice(0, 64),
    updatedAt: ((record.updatedAt || '').trim() || nowIso).slice(0, 64),
    serverCreatedAt: isUpdate && existingServerCreatedAt ? existingServerCreatedAt : serverTimestamp(),
    serverUpdatedAt: serverTimestamp(),
  });
}

// ============================================================================
// Write Operations (Parent Doc + Subcollections with Zero Hydration Race)
// ============================================================================

async function syncMediaSubcollection(
  collectionPath: 'patients' | 'funerals' | 'donations',
  parentId: string,
  ownerUid: string,
  user: User,
  desiredAuthorizedEmails: string[],
  photos: Array<PatientPhoto | DonationPhoto>,
  documents: Array<PatientDocument | FuneralDocument | DonationDocument>
) {
  const superAdmin = isSuperAdminUser(user);
  const mediaCol = collection(db, collectionPath, parentId, 'media');
  const mediaQuery = superAdmin
    ? mediaCol
    : query(mediaCol, where('authorizedEmails', 'array-contains', (user.email || '').toLowerCase()));
  const existingSnap = await getDocs(mediaQuery);
  const existingMap = new Map<string, any>();
  existingSnap.forEach((d) => existingMap.set(d.id, d.data()));

  const desiredIds = new Set<string>();

  for (const p of photos) {
    const mediaId = sanitizeFirestoreId(p.id, 'photo');
    desiredIds.add(mediaId);
    const existing = existingMap.get(mediaId);
    const effectiveEmails = existing && !superAdmin ? existing.authorizedEmails : desiredAuthorizedEmails;
    const serialized = await serializeMediaDoc(
      {
        id: mediaId,
        category: 'category' in p ? p.category : 'donation',
        dataUrl: p.dataUrl,
        caption: p.caption,
        timestamp: p.timestamp,
      },
      parentId,
      'photo',
      existing?.ownerUid || ownerUid,
      effectiveEmails,
      existing?.serverCreatedAt,
      Boolean(existing)
    );
    if (serialized) {
      await setDoc(doc(db, collectionPath, parentId, 'media', mediaId), serialized);
    }
  }

  for (const d of documents) {
    const mediaId = sanitizeFirestoreId(d.id, 'doc');
    desiredIds.add(mediaId);
    const existing = existingMap.get(mediaId);
    const effectiveEmails = existing && !superAdmin ? existing.authorizedEmails : desiredAuthorizedEmails;
    const serialized = await serializeMediaDoc(
      {
        id: mediaId,
        category: 'category' in d ? d.category : 'other',
        title: d.title,
        fileName: d.fileName,
        fileType: d.fileType,
        dataUrl: d.dataUrl,
        fileSize: d.fileSize,
        uploadDate: d.uploadDate,
      },
      parentId,
      'document',
      existing?.ownerUid || ownerUid,
      effectiveEmails,
      existing?.serverCreatedAt,
      Boolean(existing)
    );
    if (serialized) {
      await setDoc(doc(db, collectionPath, parentId, 'media', mediaId), serialized);
    }
  }

  // Clean up removed media items
  for (const [existingId] of existingMap.entries()) {
    if (!desiredIds.has(existingId)) {
      await deleteDoc(doc(db, collectionPath, parentId, 'media', existingId));
    }
  }
}

export async function savePatientToCloud(
  patient: PatientRecord,
  user: User,
  teamEmails: string[] = []
): Promise<void> {
  const patientId = sanitizeFirestoreId(patient.id, 'pt');
  const patientRef = doc(db, 'patients', patientId);
  const superAdmin = isSuperAdminUser(user);
  const desiredEmails = normalizeAuthorizedEmails(teamEmails, user);

  try {
    const existingSnap = await getDoc(patientRef);
    const existingData = existingSnap.exists() ? existingSnap.data() : null;
    const ownerUid = existingData?.ownerUid || user.uid;
    const parentEmails = existingData && !superAdmin ? existingData.authorizedEmails : desiredEmails;

    const parentPayload = serializePatientParent(
      {
        ...patient,
        id: patientId,
        createdAt: existingData?.createdAt || patient.createdAt,
      },
      ownerUid,
      parentEmails,
      existingData?.serverCreatedAt,
      Boolean(existingData)
    );

    // If parent does not exist yet, create parent first so subcollection security rules (exists(parent)) pass
    if (!existingData) {
      await setDoc(patientRef, parentPayload);
    }

    // Sync deliveries subcollection
    const delCol = collection(db, 'patients', patientId, 'deliveries');
    const delQuery = superAdmin
      ? delCol
      : query(delCol, where('authorizedEmails', 'array-contains', (user.email || '').toLowerCase()));
    const existingDelSnap = await getDocs(delQuery);
    const existingDelMap = new Map<string, any>();
    existingDelSnap.forEach((d) => existingDelMap.set(d.id, d.data()));

    for (const del of patient.deliveries || []) {
      const delId = sanitizeFirestoreId(del.id, 'del');
      const prevDel = existingDelMap.get(delId);
      const delEmails = prevDel && !superAdmin ? prevDel.authorizedEmails : desiredEmails;
      const delPayload = await serializeDeliveryDoc(
        { ...del, id: delId },
        patientId,
        prevDel?.ownerUid || user.uid,
        delEmails,
        prevDel?.serverCreatedAt,
        Boolean(prevDel)
      );
      await setDoc(doc(db, 'patients', patientId, 'deliveries', delId), delPayload);
    }

    // Sync media subcollection (photos + documents)
    await syncMediaSubcollection(
      'patients',
      patientId,
      user.uid,
      user,
      desiredEmails,
      patient.photos || [],
      patient.documents || []
    );

    // Commit/touch parent AFTER subcollections so remote onSnapshot listeners hydrate complete data
    if (existingData) {
      await setDoc(patientRef, parentPayload);
    } else if ((patient.deliveries?.length || 0) > 0 || (patient.photos?.length || 0) > 0 || (patient.documents?.length || 0) > 0) {
      await updateDoc(patientRef, { serverUpdatedAt: serverTimestamp() });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `patients/${patientId}`);
    throw err;
  }
}

export async function saveDeliveryToCloud(
  patient: PatientRecord,
  delivery: MonthlyDelivery,
  user: User,
  teamEmails: string[] = []
): Promise<void> {
  const patientId = sanitizeFirestoreId(patient.id, 'pt');
  const delId = sanitizeFirestoreId(delivery.id, 'del');
  const superAdmin = isSuperAdminUser(user);
  const desiredEmails = normalizeAuthorizedEmails(teamEmails, user);

  try {
    const patientRef = doc(db, 'patients', patientId);
    const pSnap = await getDoc(patientRef);
    if (!pSnap.exists()) {
      await savePatientToCloud(patient, user, teamEmails);
      return;
    }
    const existingData = pSnap.data();

    // Write subcollection delivery FIRST so remote onSnapshot fires after delivery doc exists
    const delRef = doc(db, 'patients', patientId, 'deliveries', delId);
    const delSnap = await getDoc(delRef);
    const delData = delSnap.exists() ? delSnap.data() : null;
    const delEmails = delData && !superAdmin ? delData.authorizedEmails : desiredEmails;
    const payload = await serializeDeliveryDoc(
      { ...delivery, id: delId },
      patientId,
      delData?.ownerUid || user.uid,
      delEmails,
      delData?.serverCreatedAt,
      Boolean(delData)
    );
    await setDoc(delRef, payload);

    // Then update parent doc to trigger remote hydration with the committed delivery
    const parentEmails = !superAdmin ? existingData.authorizedEmails : desiredEmails;
    await setDoc(
      patientRef,
      serializePatientParent(
        { ...patient, id: patientId, createdAt: existingData.createdAt },
        existingData.ownerUid,
        parentEmails,
        existingData.serverCreatedAt,
        true
      )
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `patients/${patientId}/deliveries/${delId}`);
    throw err;
  }
}

export async function saveFuneralToCloud(
  record: FuneralAssistanceRecord,
  user: User,
  teamEmails: string[] = []
): Promise<void> {
  const funeralId = sanitizeFirestoreId(record.id, 'funeral');
  const ref = doc(db, 'funerals', funeralId);
  const superAdmin = isSuperAdminUser(user);
  const desiredEmails = normalizeAuthorizedEmails(teamEmails, user);

  try {
    const snap = await getDoc(ref);
    const existingData = snap.exists() ? snap.data() : null;
    const ownerUid = existingData?.ownerUid || user.uid;
    const parentEmails = existingData && !superAdmin ? existingData.authorizedEmails : desiredEmails;

    const parentPayload = serializeFuneralParent(
      {
        ...record,
        id: funeralId,
        createdAt: existingData?.createdAt || record.createdAt,
      },
      ownerUid,
      parentEmails,
      existingData?.serverCreatedAt,
      Boolean(existingData)
    );

    if (!existingData) {
      await setDoc(ref, parentPayload);
    }

    await syncMediaSubcollection(
      'funerals',
      funeralId,
      user.uid,
      user,
      desiredEmails,
      [],
      record.documents || []
    );

    if (existingData) {
      await setDoc(ref, parentPayload);
    } else if ((record.documents?.length || 0) > 0) {
      await updateDoc(ref, { serverUpdatedAt: serverTimestamp() });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `funerals/${funeralId}`);
    throw err;
  }
}

export async function deleteFuneralFromCloud(id: string, user?: User | null): Promise<void> {
  const funeralId = sanitizeFirestoreId(id, 'funeral');
  try {
    const mediaCol = collection(db, 'funerals', funeralId, 'media');
    const mediaQuery =
      !user || isSuperAdminUser(user)
        ? mediaCol
        : query(mediaCol, where('authorizedEmails', 'array-contains', (user.email || '').toLowerCase()));
    const mediaSnap = await getDocs(mediaQuery);
    for (const d of mediaSnap.docs) {
      await deleteDoc(doc(db, 'funerals', funeralId, 'media', d.id));
    }
    await deleteDoc(doc(db, 'funerals', funeralId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `funerals/${funeralId}`);
    throw err;
  }
}

export async function saveDonationToCloud(
  record: DonationDistributionRecord,
  user: User,
  teamEmails: string[] = []
): Promise<void> {
  const donationId = sanitizeFirestoreId(record.id, 'donation');
  const ref = doc(db, 'donations', donationId);
  const superAdmin = isSuperAdminUser(user);
  const desiredEmails = normalizeAuthorizedEmails(teamEmails, user);

  try {
    const snap = await getDoc(ref);
    const existingData = snap.exists() ? snap.data() : null;
    const ownerUid = existingData?.ownerUid || user.uid;
    const parentEmails = existingData && !superAdmin ? existingData.authorizedEmails : desiredEmails;

    const parentPayload = serializeDonationParent(
      {
        ...record,
        id: donationId,
        createdAt: existingData?.createdAt || record.createdAt,
      },
      ownerUid,
      parentEmails,
      existingData?.serverCreatedAt,
      Boolean(existingData)
    );

    if (!existingData) {
      await setDoc(ref, parentPayload);
    }

    await syncMediaSubcollection(
      'donations',
      donationId,
      user.uid,
      user,
      desiredEmails,
      record.photos || [],
      record.documents || []
    );

    if (existingData) {
      await setDoc(ref, parentPayload);
    } else if ((record.photos?.length || 0) > 0 || (record.documents?.length || 0) > 0) {
      await updateDoc(ref, { serverUpdatedAt: serverTimestamp() });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `donations/${donationId}`);
    throw err;
  }
}

export async function deleteDonationFromCloud(id: string, user?: User | null): Promise<void> {
  const donationId = sanitizeFirestoreId(id, 'donation');
  try {
    const mediaCol = collection(db, 'donations', donationId, 'media');
    const mediaQuery =
      !user || isSuperAdminUser(user)
        ? mediaCol
        : query(mediaCol, where('authorizedEmails', 'array-contains', (user.email || '').toLowerCase()));
    const mediaSnap = await getDocs(mediaQuery);
    for (const d of mediaSnap.docs) {
      await deleteDoc(doc(db, 'donations', donationId, 'media', d.id));
    }
    await deleteDoc(doc(db, 'donations', donationId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `donations/${donationId}`);
    throw err;
  }
}

// ============================================================================
// Shared Settings Sync (/settings/delivery_plan & /settings/workspace)
// ============================================================================

export async function saveDeliveryPlanSettingsToCloud(
  settings: DeliveryPlanSettings,
  user: User,
  teamEmails: string[] = []
): Promise<void> {
  const ref = doc(db, 'settings', 'delivery_plan');
  const superAdmin = isSuperAdminUser(user);
  const desiredEmails = normalizeAuthorizedEmails(teamEmails, user);

  try {
    const snap = await getDoc(ref);
    const existingData = snap.exists() ? snap.data() : null;
    const ownerUid = existingData?.ownerUid || user.uid;
    const emails = existingData && !superAdmin ? existingData.authorizedEmails : desiredEmails;

    const payload = stripUndefined({
      id: 'delivery_plan',
      ownerUid,
      ...(emails !== undefined ? { authorizedEmails: emails } : {}),
      ricePricePerBag: safeNum(settings.ricePricePerBag, 0),
      customRiceCount:
        settings.customRiceCount === null || settings.customRiceCount === undefined
          ? null
          : safeNum(settings.customRiceCount, 0),
      currentMonth: (settings.currentMonth || '').slice(0, 100),
      updatedAt: (settings.updatedAt || new Date().toISOString()).slice(0, 64),
      serverCreatedAt: existingData ? existingData.serverCreatedAt : serverTimestamp(),
      serverUpdatedAt: serverTimestamp(),
    });

    await setDoc(ref, payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'settings/delivery_plan');
    throw err;
  }
}

export async function fetchWorkspaceAuthorizedEmails(user: User): Promise<string[]> {
  try {
    const ref = doc(db, 'settings', 'workspace');
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data();
      if (Array.isArray(data.authorizedEmails)) {
        const clean = normalizeAuthorizedEmails(data.authorizedEmails);
        saveStoredAuthorizedEmails(clean);
        return clean;
      }
    } else if (isSuperAdminUser(user)) {
      const initial = normalizeAuthorizedEmails([], user);
      await setDoc(ref, {
        id: 'workspace',
        authorizedEmails: initial,
        updatedAt: new Date().toISOString(),
        updatedBy: (user.email || '').slice(0, 200),
        serverCreatedAt: serverTimestamp(),
        serverUpdatedAt: serverTimestamp(),
      });
      saveStoredAuthorizedEmails(initial);
      return initial;
    }
  } catch {
    // Non-authorized or non-existent workspace config falls back gracefully
  }
  return normalizeAuthorizedEmails([], isSuperAdminUser(user) ? user : null);
}

export async function verifyWorkspaceAccess(user: User): Promise<{
  allowed: boolean;
  emails: string[];
  reason?: 'permission-denied' | 'network';
}> {
  if (!user.email) {
    return { allowed: false, emails: [], reason: 'permission-denied' };
  }
  const emailLower = user.email.trim().toLowerCase();

  if (isSuperAdminUser(user) || Boolean(findAdminUserByAuthEmail(emailLower))) {
    const emails = await fetchWorkspaceAuthorizedEmails(user);
    return { allowed: true, emails };
  }

  try {
    const wsSnap = await getDocFromServer(doc(db, 'settings', 'workspace'));
    if (wsSnap.exists()) {
      const data = wsSnap.data();
      const emails = normalizeAuthorizedEmails(
        Array.isArray(data.authorizedEmails) ? data.authorizedEmails : []
      );
      if (emails.includes(emailLower)) {
        saveStoredAuthorizedEmails(emails);
        return { allowed: true, emails };
      }
    }
    const uid = sanitizeFirestoreId(user.uid, 'uid');
    const adminSnap = await getDocFromServer(doc(db, 'admins', uid));
    if (adminSnap.exists()) {
      return { allowed: true, emails: normalizeAuthorizedEmails([], user) };
    }
    return { allowed: false, emails: [], reason: 'permission-denied' };
  } catch (err: any) {
    const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
    const isPerm = msg.includes('permission') || msg.includes('insufficient');
    if (isPerm) {
      return { allowed: false, emails: [], reason: 'permission-denied' };
    }
    // Offline fallback only if email was already locally cached from prior approval
    const cached = getStoredAuthorizedEmailsFromLocal();
    if (cached.includes(emailLower)) {
      return { allowed: true, emails: cached };
    }
    return { allowed: false, emails: [], reason: 'network' };
  }
}

function getStoredAuthorizedEmailsFromLocal(): string[] {
  try {
    const raw = localStorage.getItem('bdcare_authorized_emails_v1');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.map((e) => String(e).trim().toLowerCase())
      : [];
  } catch {
    return [];
  }
}

/**
 * Super Admin: Update authorized staff email allowlist and propagate to all existing Cloud docs
 * so authorized staff devices immediately see and edit identical data.
 */
export async function saveWorkspaceAuthorizedEmails(
  emails: string[],
  user: User
): Promise<string[]> {
  if (!isSuperAdminUser(user)) {
    throw new Error('เฉพาะ Super Admin เท่านั้นที่สามารถจัดการสิทธิ์บัญชีร่วมกันได้');
  }
  const normalized = normalizeAuthorizedEmails(emails, user);
  const ref = doc(db, 'settings', 'workspace');
  try {
    const snap = await getDoc(ref);
    const existingData = snap.exists() ? snap.data() : null;
    await setDoc(ref, {
      id: 'workspace',
      authorizedEmails: normalized,
      updatedAt: new Date().toISOString(),
      updatedBy: (user.email || '').slice(0, 200),
      serverCreatedAt: existingData?.serverCreatedAt || serverTimestamp(),
      serverUpdatedAt: serverTimestamp(),
    });
    saveStoredAuthorizedEmails(normalized);

    // Propagate updated authorizedEmails to delivery_plan and existing records + subcollections
    const dpRef = doc(db, 'settings', 'delivery_plan');
    const dpSnap = await getDoc(dpRef);
    if (dpSnap.exists()) {
      await updateDoc(dpRef, {
        authorizedEmails: normalized,
        serverUpdatedAt: serverTimestamp(),
      });
    }

    const [pSnap, fSnap, dSnap] = await Promise.all([
      getDocs(collection(db, 'patients')),
      getDocs(collection(db, 'funerals')),
      getDocs(collection(db, 'donations')),
    ]);

    for (const pDoc of pSnap.docs) {
      await updateDoc(pDoc.ref, {
        authorizedEmails: normalized,
        serverUpdatedAt: serverTimestamp(),
      });
      const [delSnap, mediaSnap] = await Promise.all([
        getDocs(collection(db, 'patients', pDoc.id, 'deliveries')),
        getDocs(collection(db, 'patients', pDoc.id, 'media')),
      ]);
      for (const d of delSnap.docs) {
        await updateDoc(d.ref, { authorizedEmails: normalized, serverUpdatedAt: serverTimestamp() });
      }
      for (const m of mediaSnap.docs) {
        await updateDoc(m.ref, { authorizedEmails: normalized, serverUpdatedAt: serverTimestamp() });
      }
    }

    for (const fDoc of fSnap.docs) {
      await updateDoc(fDoc.ref, {
        authorizedEmails: normalized,
        serverUpdatedAt: serverTimestamp(),
      });
      const mediaSnap = await getDocs(collection(db, 'funerals', fDoc.id, 'media'));
      for (const m of mediaSnap.docs) {
        await updateDoc(m.ref, { authorizedEmails: normalized, serverUpdatedAt: serverTimestamp() });
      }
    }

    for (const dDoc of dSnap.docs) {
      await updateDoc(dDoc.ref, {
        authorizedEmails: normalized,
        serverUpdatedAt: serverTimestamp(),
      });
      const mediaSnap = await getDocs(collection(db, 'donations', dDoc.id, 'media'));
      for (const m of mediaSnap.docs) {
        await updateDoc(m.ref, { authorizedEmails: normalized, serverUpdatedAt: serverTimestamp() });
      }
    }

    return normalized;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'settings/workspace');
    throw err;
  }
}

// ============================================================================
// Cross-Device Team Access Requests (/access_requests/{uid})
// ============================================================================

export async function submitAccessRequest(user: User, note?: string): Promise<void> {
  const uid = sanitizeFirestoreId(user.uid, 'uid');
  const ref = doc(db, 'access_requests', uid);
  try {
    const snap = await getDoc(ref);
    const existingData = snap.exists() ? snap.data() : null;
    await setDoc(
      ref,
      stripUndefined({
        uid,
        email: (user.email || '').trim().toLowerCase().slice(0, 200),
        displayName: (user.displayName || user.email || 'ผู้ใช้งาน BD-Care').slice(0, 200),
        note: (note || 'ขอสิทธิ์เข้าดูและแก้ไขข้อมูล BD-Care จากอุปกรณ์อื่น').slice(0, 300),
        status: 'pending',
        ...(existingData?.reviewedBy ? { reviewedBy: existingData.reviewedBy } : {}),
        serverCreatedAt: existingData?.serverCreatedAt || serverTimestamp(),
        serverUpdatedAt: serverTimestamp(),
      })
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `access_requests/${uid}`);
    throw err;
  }
}

export function subscribeToMyAccessRequest(
  user: User,
  onUpdate: (req: AccessRequestRecord | null) => void
): () => void {
  const uid = sanitizeFirestoreId(user.uid, 'uid');
  return onSnapshot(
    doc(db, 'access_requests', uid),
    (snap) => {
      if (!snap.exists()) {
        onUpdate(null);
        return;
      }
      const d = snap.data();
      onUpdate({
        uid: d.uid || uid,
        email: d.email || '',
        displayName: d.displayName,
        note: d.note,
        status: d.status || 'pending',
        reviewedBy: d.reviewedBy,
      });
    },
    () => {
      onUpdate(null);
    }
  );
}

export function subscribeToPendingAccessRequests(
  user: User,
  onRequests: (reqs: AccessRequestRecord[]) => void
): () => void {
  if (!isSuperAdminUser(user)) {
    onRequests([]);
    return () => {};
  }
  return onSnapshot(
    collection(db, 'access_requests'),
    (snap) => {
      const pending: AccessRequestRecord[] = [];
      snap.forEach((d) => {
        const val = d.data();
        if (val.status === 'pending' && val.email) {
          pending.push({
            uid: val.uid || d.id,
            email: val.email,
            displayName: val.displayName,
            note: val.note,
            status: val.status,
            reviewedBy: val.reviewedBy,
          });
        }
      });
      onRequests(pending);
    },
    () => {
      onRequests([]);
    }
  );
}

export async function approveAccessRequest(
  req: AccessRequestRecord,
  adminUser: User,
  currentTeamEmails: string[]
): Promise<string[]> {
  if (!isSuperAdminUser(adminUser)) {
    throw new Error('เฉพาะ Super Admin เท่านั้นที่อนุมัติคำขอได้');
  }
  const targetUid = sanitizeFirestoreId(req.uid, 'uid');
  const adminRef = doc(db, 'admins', targetUid);
  const reqRef = doc(db, 'access_requests', targetUid);

  try {
    // 1. Grant officer entry in /admins/{uid}
    const existingAdmin = await getDoc(adminRef);
    await setDoc(adminRef, {
      uid: targetUid,
      email: req.email.trim().toLowerCase().slice(0, 200),
      displayName: (req.displayName || req.email).slice(0, 200),
      role: 'officer',
      serverCreatedAt: existingAdmin.exists()
        ? existingAdmin.data().serverCreatedAt
        : serverTimestamp(),
      serverUpdatedAt: serverTimestamp(),
    });

    // 2. Mark request approved
    await updateDoc(reqRef, {
      status: 'approved',
      reviewedBy: (adminUser.email || '').slice(0, 200),
      serverUpdatedAt: serverTimestamp(),
    });

    // 3. Add to workspace allowlist and propagate across ALL records & subcollections
    const updatedEmails = await saveWorkspaceAuthorizedEmails(
      [...currentTeamEmails, req.email],
      adminUser
    );
    return updatedEmails;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `access_requests/${targetUid}`);
    throw err;
  }
}

export async function rejectAccessRequest(
  req: AccessRequestRecord,
  adminUser: User
): Promise<void> {
  if (!isSuperAdminUser(adminUser)) return;
  const targetUid = sanitizeFirestoreId(req.uid, 'uid');
  try {
    await updateDoc(doc(db, 'access_requests', targetUid), {
      status: 'rejected',
      reviewedBy: (adminUser.email || '').slice(0, 200),
      serverUpdatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `access_requests/${targetUid}`);
    throw err;
  }
}

// ============================================================================
// Read & Hydration Helpers
// ============================================================================

async function hydratePatient(
  raw: Record<string, any>,
  user: User,
  fallbackLocal?: PatientRecord
): Promise<PatientRecord> {
  const patientId = raw.id;
  const superAdmin = isSuperAdminUser(user);
  const userEmail = (user.email || '').toLowerCase();

  const delQuery = superAdmin
    ? collection(db, 'patients', patientId, 'deliveries')
    : query(
        collection(db, 'patients', patientId, 'deliveries'),
        where('authorizedEmails', 'array-contains', userEmail)
      );

  const mediaQuery = superAdmin
    ? collection(db, 'patients', patientId, 'media')
    : query(
        collection(db, 'patients', patientId, 'media'),
        where('authorizedEmails', 'array-contains', userEmail)
      );

  const [delSnap, mediaSnap] = await Promise.all([
    getDocs(delQuery).catch((err) => {
      console.warn(`Failed loading deliveries for patient ${patientId}:`, err);
      return null;
    }),
    getDocs(mediaQuery).catch((err) => {
      console.warn(`Failed loading media for patient ${patientId}:`, err);
      return null;
    }),
  ]);

  let deliveries: MonthlyDelivery[] = [];
  if (delSnap) {
    delSnap.forEach((d) => {
      const val = d.data();
      deliveries.push({
        id: val.id || d.id,
        deliveryDate: val.deliveryDate || '',
        monthYearLabel: val.monthYearLabel || '',
        cashAmount: safeNum(val.cashAmount, 0),
        cashGiven: Boolean(val.cashGiven),
        diaperSize: val.diaperSize || 'NONE',
        diaperPacks: safeNum(val.diaperPacks, 0),
        ricePacks: safeNum(val.ricePacks, 0),
        waterPacks: safeNum(val.waterPacks, 0),
        waterSize: val.waterSize || '1.5L',
        otherItems: val.otherItems || '',
        receivedBy: val.receivedBy || '',
        recipientRelation: val.recipientRelation || '',
        officerName: val.officerName || '',
        photoUrl: val.photoUrl,
        notes: val.notes,
      });
    });
    deliveries.sort((a, b) => (b.deliveryDate || '').localeCompare(a.deliveryDate || ''));
  } else if (fallbackLocal?.deliveries) {
    deliveries = fallbackLocal.deliveries;
  }

  let photos: PatientPhoto[] = [];
  let documents: PatientDocument[] = [];

  if (mediaSnap) {
    mediaSnap.forEach((d) => {
      const val = d.data();
      if (val.kind === 'photo') {
        photos.push({
          id: val.id || d.id,
          category: val.category || 'patient',
          dataUrl: val.dataUrl,
          caption: val.caption || '',
          timestamp: val.timestamp || '',
        });
      } else {
        documents.push({
          id: val.id || d.id,
          category: val.category || 'other',
          title: val.title || val.fileName || 'เอกสารแนบ',
          fileName: val.fileName || 'document',
          fileType: val.fileType || 'application/octet-stream',
          dataUrl: val.dataUrl,
          fileSize: safeNum(val.fileSize, 0),
          uploadDate: val.uploadDate || '',
        });
      }
    });
  } else if (fallbackLocal) {
    photos = fallbackLocal.photos || [];
    documents = fallbackLocal.documents || [];
  }

  const { serverCreatedAt: _sc, serverUpdatedAt: _su, ownerUid: _ou, authorizedEmails: _ae, ...rest } = raw;
  return {
    ...(rest as PatientRecord),
    deliveries,
    photos,
    documents,
  };
}

async function hydrateFuneral(
  raw: Record<string, any>,
  user: User,
  fallbackLocal?: FuneralAssistanceRecord
): Promise<FuneralAssistanceRecord> {
  const funeralId = raw.id;
  const superAdmin = isSuperAdminUser(user);
  const userEmail = (user.email || '').toLowerCase();
  const mediaQuery = superAdmin
    ? collection(db, 'funerals', funeralId, 'media')
    : query(
        collection(db, 'funerals', funeralId, 'media'),
        where('authorizedEmails', 'array-contains', userEmail)
      );

  const mediaSnap = await getDocs(mediaQuery).catch((err) => {
    console.warn(`Failed loading media for funeral ${funeralId}:`, err);
    return null;
  });

  let documents: FuneralDocument[] = [];
  if (mediaSnap) {
    mediaSnap.forEach((d) => {
      const val = d.data();
      documents.push({
        id: val.id || d.id,
        category: val.category || 'other',
        title: val.title || val.fileName || 'เอกสารแนบ',
        fileName: val.fileName || 'document',
        fileType: val.fileType || 'application/octet-stream',
        dataUrl: val.dataUrl,
        fileSize: safeNum(val.fileSize, 0),
        uploadDate: val.uploadDate || '',
      });
    });
  } else if (fallbackLocal?.documents) {
    documents = fallbackLocal.documents;
  }

  const { serverCreatedAt: _sc, serverUpdatedAt: _su, ownerUid: _ou, authorizedEmails: _ae, ...rest } = raw;
  return {
    ...(rest as FuneralAssistanceRecord),
    documents,
  };
}

async function hydrateDonation(
  raw: Record<string, any>,
  user: User,
  fallbackLocal?: DonationDistributionRecord
): Promise<DonationDistributionRecord> {
  const donationId = raw.id;
  const superAdmin = isSuperAdminUser(user);
  const userEmail = (user.email || '').toLowerCase();
  const mediaQuery = superAdmin
    ? collection(db, 'donations', donationId, 'media')
    : query(
        collection(db, 'donations', donationId, 'media'),
        where('authorizedEmails', 'array-contains', userEmail)
      );

  const mediaSnap = await getDocs(mediaQuery).catch((err) => {
    console.warn(`Failed loading media for donation ${donationId}:`, err);
    return null;
  });

  let photos: DonationPhoto[] = [];
  let documents: DonationDocument[] = [];
  if (mediaSnap) {
    mediaSnap.forEach((d) => {
      const val = d.data();
      if (val.kind === 'photo') {
        photos.push({
          id: val.id || d.id,
          dataUrl: val.dataUrl,
          caption: val.caption || '',
          timestamp: val.timestamp || '',
        });
      } else {
        documents.push({
          id: val.id || d.id,
          title: val.title || val.fileName || 'เอกสารแนบ',
          fileName: val.fileName || 'document',
          fileType: val.fileType || 'application/octet-stream',
          dataUrl: val.dataUrl,
          fileSize: safeNum(val.fileSize, 0),
          uploadDate: val.uploadDate || '',
        });
      }
    });
  } else if (fallbackLocal) {
    photos = fallbackLocal.photos || [];
    documents = fallbackLocal.documents || [];
  }

  const { serverCreatedAt: _sc, serverUpdatedAt: _su, ownerUid: _ou, authorizedEmails: _ae, ...rest } = raw;
  return {
    ...(rest as DonationDistributionRecord),
    photos,
    documents,
  };
}

export interface CloudErrorDetail {
  isPermissionError: boolean;
  message: string;
}

/**
 * Subscribe to real-time updates on patients, funerals, donations, delivery settings, and workspace config.
 */
export function subscribeToCloudCollections(
  user: User,
  handlers: {
    getLocalPatients?: () => PatientRecord[];
    getLocalFunerals?: () => FuneralAssistanceRecord[];
    getLocalDonations?: () => DonationDistributionRecord[];
    onPatients: (items: PatientRecord[], fromCache: boolean) => void;
    onFunerals: (items: FuneralAssistanceRecord[], fromCache: boolean) => void;
    onDonations: (items: DonationDistributionRecord[], fromCache: boolean) => void;
    onDeliverySettings?: (settings: DeliveryPlanSettings, fromCache: boolean) => void;
    onAuthorizedEmails?: (emails: string[]) => void;
    onError?: (err: CloudErrorDetail) => void;
  }
): () => void {
  const superAdmin = isSuperAdminUser(user);
  const userEmail = (user.email || '').toLowerCase();

  const patientsQuery = superAdmin
    ? collection(db, 'patients')
    : query(collection(db, 'patients'), where('authorizedEmails', 'array-contains', userEmail));
  const funeralsQuery = superAdmin
    ? collection(db, 'funerals')
    : query(collection(db, 'funerals'), where('authorizedEmails', 'array-contains', userEmail));
  const donationsQuery = superAdmin
    ? collection(db, 'donations')
    : query(collection(db, 'donations'), where('authorizedEmails', 'array-contains', userEmail));

  const unsubs: Unsubscribe[] = [];

  const emitError = (err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    const isPerm = msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('insufficient');
    handlers.onError?.({ isPermissionError: isPerm, message: msg });
  };

  unsubs.push(
    onSnapshot(
      patientsQuery,
      async (snap) => {
        try {
          const localMap = new Map((handlers.getLocalPatients?.() || []).map((p) => [p.id, p]));
          const items = await Promise.all(
            snap.docs.map((d) => hydratePatient({ id: d.id, ...d.data() }, user, localMap.get(d.id)))
          );
          handlers.onPatients(items, snap.metadata.fromCache);
        } catch (err) {
          emitError(err);
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'patients');
        emitError(err);
      }
    )
  );

  unsubs.push(
    onSnapshot(
      funeralsQuery,
      async (snap) => {
        try {
          const localMap = new Map((handlers.getLocalFunerals?.() || []).map((f) => [f.id, f]));
          const items = await Promise.all(
            snap.docs.map((d) => hydrateFuneral({ id: d.id, ...d.data() }, user, localMap.get(d.id)))
          );
          handlers.onFunerals(items, snap.metadata.fromCache);
        } catch (err) {
          emitError(err);
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'funerals');
        emitError(err);
      }
    )
  );

  unsubs.push(
    onSnapshot(
      donationsQuery,
      async (snap) => {
        try {
          const localMap = new Map((handlers.getLocalDonations?.() || []).map((d) => [d.id, d]));
          const items = await Promise.all(
            snap.docs.map((d) => hydrateDonation({ id: d.id, ...d.data() }, user, localMap.get(d.id)))
          );
          handlers.onDonations(items, snap.metadata.fromCache);
        } catch (err) {
          emitError(err);
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'donations');
        emitError(err);
      }
    )
  );

  if (handlers.onDeliverySettings) {
    unsubs.push(
      onSnapshot(
        doc(db, 'settings', 'delivery_plan'),
        (snap) => {
          if (!snap.exists()) return;
          const data = snap.data();
          const price = Number(data.ricePricePerBag);
          const customRice =
            data.customRiceCount === null || data.customRiceCount === undefined
              ? null
              : Number(data.customRiceCount);
          handlers.onDeliverySettings?.(
            {
              ricePricePerBag: Number.isFinite(price) && price >= 0 ? price : 0,
              customRiceCount:
                customRice !== null && Number.isFinite(customRice) && customRice >= 0
                  ? customRice
                  : null,
              currentMonth: typeof data.currentMonth === 'string' ? data.currentMonth : '',
              updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : '',
            },
            snap.metadata.fromCache
          );
        },
        (err) => {
          // Missing delivery_plan doc on initial boot is expected; permission errors report cleanly
          const msg = err instanceof Error ? err.message : String(err);
          if (!msg.toLowerCase().includes('permission')) {
            console.warn('Delivery settings snapshot warning:', msg);
          }
        }
      )
    );
  }

  if (handlers.onAuthorizedEmails) {
    unsubs.push(
      onSnapshot(
        doc(db, 'settings', 'workspace'),
        (snap) => {
          if (!snap.exists()) return;
          const data = snap.data();
          if (Array.isArray(data.authorizedEmails)) {
            const clean = normalizeAuthorizedEmails(data.authorizedEmails);
            saveStoredAuthorizedEmails(clean);
            handlers.onAuthorizedEmails?.(clean);
          }
        },
        () => {
          /* ignore if user isn't authorized for workspace settings */
        }
      )
    );
  }

  return () => {
    unsubs.forEach((u) => u());
  };
}

/**
 * Flush pending offline deletes & push unsynced local records cleanly up to Cloud Firestore.
 * Never resurrects records that were already synced and deleted on another device.
 */
export async function syncLocalRecordsToCloud(
  user: User,
  localPatients: PatientRecord[],
  localFunerals: FuneralAssistanceRecord[],
  localDonations: DonationDistributionRecord[],
  localDeliverySettings?: DeliveryPlanSettings,
  teamEmails: string[] = []
): Promise<{ uploaded: number; deleted: number; failed: number }> {
  let uploaded = 0;
  let deleted = 0;
  let failed = 0;
  const superAdmin = isSuperAdminUser(user);
  const userEmail = (user.email || '').toLowerCase();
  const normalizedTeamEmails = normalizeAuthorizedEmails(teamEmails, superAdmin ? user : null);
  const pendingOps = getPendingOps();
  const knownSynced = getKnownSyncedIds();

  // 1. Flush pending deletes first so deleted records don't get re-uploaded
  for (const id of pendingOps.deletes.funerals) {
    try {
      await deleteFuneralFromCloud(id, user);
      clearPendingDelete('funerals', id);
      removeKnownSyncedId('funerals', id);
      deleted++;
    } catch (err) {
      failed++;
      console.warn(`Pending funeral delete ${id} failed:`, err);
    }
  }
  for (const id of pendingOps.deletes.donations) {
    try {
      await deleteDonationFromCloud(id, user);
      clearPendingDelete('donations', id);
      removeKnownSyncedId('donations', id);
      deleted++;
    } catch (err) {
      failed++;
      console.warn(`Pending donation delete ${id} failed:`, err);
    }
  }

  // 2. Fetch existing Cloud timestamps & inspect shared team allowlists
  const [pSnap, fSnap, dSnap] = await Promise.all([
    getDocs(
      superAdmin
        ? collection(db, 'patients')
        : query(collection(db, 'patients'), where('authorizedEmails', 'array-contains', userEmail))
    ),
    getDocs(
      superAdmin
        ? collection(db, 'funerals')
        : query(collection(db, 'funerals'), where('authorizedEmails', 'array-contains', userEmail))
    ),
    getDocs(
      superAdmin
        ? collection(db, 'donations')
        : query(collection(db, 'donations'), where('authorizedEmails', 'array-contains', userEmail))
    ),
  ]);

  const cloudPatientTimes = new Map<string, number>();
  for (const d of pSnap.docs) {
    const data = d.data();
    cloudPatientTimes.set(d.id, Date.parse(data.updatedAt || data.createdAt || '') || 0);
    if (superAdmin && emailsNeedBackfill(data.authorizedEmails, normalizedTeamEmails)) {
      try {
        await updateDoc(d.ref, {
          authorizedEmails: normalizedTeamEmails,
          serverUpdatedAt: serverTimestamp(),
        });
        const [delSnap, mediaSnap] = await Promise.all([
          getDocs(collection(db, 'patients', d.id, 'deliveries')),
          getDocs(collection(db, 'patients', d.id, 'media')),
        ]);
        for (const sub of delSnap.docs) {
          if (emailsNeedBackfill(sub.data().authorizedEmails, normalizedTeamEmails)) {
            await updateDoc(sub.ref, {
              authorizedEmails: normalizedTeamEmails,
              serverUpdatedAt: serverTimestamp(),
            });
          }
        }
        for (const sub of mediaSnap.docs) {
          if (emailsNeedBackfill(sub.data().authorizedEmails, normalizedTeamEmails)) {
            await updateDoc(sub.ref, {
              authorizedEmails: normalizedTeamEmails,
              serverUpdatedAt: serverTimestamp(),
            });
          }
        }
      } catch (err) {
        console.warn(`Backfill patient ${d.id} emails skipped:`, err);
      }
    }
  }

  const uploadedPatientIds: string[] = [];
  const pendingPatientSet = new Set(pendingOps.upserts.patients);
  const knownPatientSet = new Set(knownSynced.patients);
  for (const pt of localPatients) {
    const safeId = sanitizeFirestoreId(pt.id, 'pt');
    const localTime = Date.parse(pt.updatedAt || pt.createdAt || '') || Date.now();
    const cloudTime = cloudPatientTimes.get(safeId);
    const isPending = pendingPatientSet.has(pt.id) || pendingPatientSet.has(safeId);
    const wasPreviouslySynced = knownPatientSet.has(pt.id) || knownPatientSet.has(safeId);

    const shouldUpload =
      isPending ||
      (cloudTime === undefined && !wasPreviouslySynced) ||
      (cloudTime !== undefined && localTime > cloudTime && isPending);

    if (shouldUpload) {
      try {
        await savePatientToCloud(pt, user, normalizedTeamEmails);
        clearPendingUpsert('patients', pt.id);
        clearPendingUpsert('patients', safeId);
        addKnownSyncedIds('patients', [pt.id, safeId]);
        uploadedPatientIds.push(pt.id, safeId);
        uploaded++;
      } catch (err) {
        failed++;
        console.warn(`Failed syncing patient ${pt.id}:`, err);
      }
    }
  }

  const cloudFuneralTimes = new Map<string, number>();
  for (const d of fSnap.docs) {
    const data = d.data();
    cloudFuneralTimes.set(d.id, Date.parse(data.updatedAt || data.createdAt || '') || 0);
    if (superAdmin && emailsNeedBackfill(data.authorizedEmails, normalizedTeamEmails)) {
      try {
        await updateDoc(d.ref, {
          authorizedEmails: normalizedTeamEmails,
          serverUpdatedAt: serverTimestamp(),
        });
        const mediaSnap = await getDocs(collection(db, 'funerals', d.id, 'media'));
        for (const sub of mediaSnap.docs) {
          if (emailsNeedBackfill(sub.data().authorizedEmails, normalizedTeamEmails)) {
            await updateDoc(sub.ref, {
              authorizedEmails: normalizedTeamEmails,
              serverUpdatedAt: serverTimestamp(),
            });
          }
        }
      } catch (err) {
        console.warn(`Backfill funeral ${d.id} emails skipped:`, err);
      }
    }
  }

  const uploadedFuneralIds: string[] = [];
  const pendingFuneralSet = new Set(pendingOps.upserts.funerals);
  const knownFuneralSet = new Set(knownSynced.funerals);
  for (const f of localFunerals) {
    const safeId = sanitizeFirestoreId(f.id, 'funeral');
    const localTime = Date.parse(f.updatedAt || f.createdAt || '') || Date.now();
    const cloudTime = cloudFuneralTimes.get(safeId);
    const isPending = pendingFuneralSet.has(f.id) || pendingFuneralSet.has(safeId);
    const wasPreviouslySynced = knownFuneralSet.has(f.id) || knownFuneralSet.has(safeId);

    const shouldUpload =
      isPending ||
      (cloudTime === undefined && !wasPreviouslySynced) ||
      (cloudTime !== undefined && localTime > cloudTime && isPending);

    if (shouldUpload) {
      try {
        await saveFuneralToCloud(f, user, normalizedTeamEmails);
        clearPendingUpsert('funerals', f.id);
        clearPendingUpsert('funerals', safeId);
        addKnownSyncedIds('funerals', [f.id, safeId]);
        uploadedFuneralIds.push(f.id, safeId);
        uploaded++;
      } catch (err) {
        failed++;
        console.warn(`Failed syncing funeral ${f.id}:`, err);
      }
    }
  }

  const cloudDonationTimes = new Map<string, number>();
  for (const d of dSnap.docs) {
    const data = d.data();
    cloudDonationTimes.set(d.id, Date.parse(data.updatedAt || data.createdAt || '') || 0);
    if (superAdmin && emailsNeedBackfill(data.authorizedEmails, normalizedTeamEmails)) {
      try {
        await updateDoc(d.ref, {
          authorizedEmails: normalizedTeamEmails,
          serverUpdatedAt: serverTimestamp(),
        });
        const mediaSnap = await getDocs(collection(db, 'donations', d.id, 'media'));
        for (const sub of mediaSnap.docs) {
          if (emailsNeedBackfill(sub.data().authorizedEmails, normalizedTeamEmails)) {
            await updateDoc(sub.ref, {
              authorizedEmails: normalizedTeamEmails,
              serverUpdatedAt: serverTimestamp(),
            });
          }
        }
      } catch (err) {
        console.warn(`Backfill donation ${d.id} emails skipped:`, err);
      }
    }
  }

  const uploadedDonationIds: string[] = [];
  const pendingDonationSet = new Set(pendingOps.upserts.donations);
  const knownDonationSet = new Set(knownSynced.donations);
  for (const don of localDonations) {
    const safeId = sanitizeFirestoreId(don.id, 'donation');
    const localTime = Date.parse(don.updatedAt || don.createdAt || '') || Date.now();
    const cloudTime = cloudDonationTimes.get(safeId);
    const isPending = pendingDonationSet.has(don.id) || pendingDonationSet.has(safeId);
    const wasPreviouslySynced = knownDonationSet.has(don.id) || knownDonationSet.has(safeId);

    const shouldUpload =
      isPending ||
      (cloudTime === undefined && !wasPreviouslySynced) ||
      (cloudTime !== undefined && localTime > cloudTime && isPending);

    if (shouldUpload) {
      try {
        await saveDonationToCloud(don, user, normalizedTeamEmails);
        clearPendingUpsert('donations', don.id);
        clearPendingUpsert('donations', safeId);
        addKnownSyncedIds('donations', [don.id, safeId]);
        uploadedDonationIds.push(don.id, safeId);
        uploaded++;
      } catch (err) {
        failed++;
        console.warn(`Failed syncing donation ${don.id}:`, err);
      }
    }
  }

  // 3. Sync delivery plan settings if pending, missing in Cloud, or missing authorizedEmails
  if (localDeliverySettings) {
    try {
      const dpRef = doc(db, 'settings', 'delivery_plan');
      const dpSnap = await getDoc(dpRef);
      if (
        pendingOps.upserts.deliverySettings ||
        (!dpSnap.exists() &&
          (localDeliverySettings.ricePricePerBag > 0 || localDeliverySettings.customRiceCount !== null))
      ) {
        await saveDeliveryPlanSettingsToCloud(localDeliverySettings, user, normalizedTeamEmails);
        setPendingDeliverySettings(false);
        uploaded++;
      } else if (
        superAdmin &&
        dpSnap.exists() &&
        emailsNeedBackfill(dpSnap.data().authorizedEmails, normalizedTeamEmails)
      ) {
        await updateDoc(dpRef, {
          authorizedEmails: normalizedTeamEmails,
          serverUpdatedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      console.warn('Delivery plan settings sync skipped:', err);
    }
  }

  // Record confirmed Cloud & newly uploaded IDs as known synced (keep previously synced IDs until authoritative snapshot reconciles deletions)
  addKnownSyncedIds('patients', [...cloudPatientTimes.keys(), ...uploadedPatientIds]);
  addKnownSyncedIds('funerals', [...cloudFuneralTimes.keys(), ...uploadedFuneralIds]);
  addKnownSyncedIds('donations', [...cloudDonationTimes.keys(), ...uploadedDonationIds]);

  return { uploaded, deleted, failed };
}
