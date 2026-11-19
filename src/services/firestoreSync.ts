import { User } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getDocsFromServer,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  deleteDoc,
  where,
  Unsubscribe,
  Firestore,
  Query,
  QuerySnapshot,
  DocumentData,
  DocumentReference,
} from 'firebase/firestore';
import {
  db,
  defaultDb,
  SUPER_ADMIN_EMAIL,
  OperationType,
  handleFirestoreError,
  isSuperAdminUser,
  isFullAccessStaffUser,
  usernameToAuthEmail,
  findAdminUserByAuthEmail,
} from '../firebase';
import { sortPatientsByCodeAsc } from '../utils/idCard';
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
import {
  safeNum,
  safeCoord,
  asMap,
  normalizeDiaperSize,
  normalizeWaterSize,
  normalizeMobility,
  normalizePatientStatus,
  normalizePatientRecord,
  normalizeFuneralRecord,
  normalizeDonationRecord,
  mergePatientRecordsForUpdate,
  mergeFuneralRecordsForUpdate,
  mergeDonationRecordsForUpdate,
} from '../utils/normalizers';

const PATIENT_CANONICAL_KEYS = new Set([
  'id',
  'ownerUid',
  'authorizedEmails',
  'code',
  'status',
  'fullName',
  'mobilityLevel',
  'profile',
  'location',
  'medical',
  'householdEconomy',
  'assistancePlan',
  'assessment',
  'createdAt',
  'updatedAt',
  'serverCreatedAt',
  'serverUpdatedAt',
]);

const FUNERAL_CANONICAL_KEYS = new Set([
  'id',
  'ownerUid',
  'authorizedEmails',
  'code',
  'applicationDate',
  'status',
  'statusNote',
  'deceasedName',
  'applicantName',
  'deceasedInfo',
  'applicantInfo',
  'cremationAid',
  'signatories',
  'createdAt',
  'updatedAt',
  'serverCreatedAt',
  'serverUpdatedAt',
]);

const DONATION_CANONICAL_KEYS = new Set([
  'id',
  'ownerUid',
  'authorizedEmails',
  'code',
  'distributionDate',
  'status',
  'recipientType',
  'recipientInfo',
  'itemsSummary',
  'handoverAndSignatories',
  'createdAt',
  'updatedAt',
  'serverCreatedAt',
  'serverUpdatedAt',
]);

function hasLegacyFlatKeys(data: Record<string, any> | null | undefined, canonicalKeys: Set<string>): boolean {
  if (!data) return false;
  return Object.keys(data).some((k) => !canonicalKeys.has(k));
}

async function getExistingServerDocData(
  ref: DocumentReference<DocumentData>
): Promise<Record<string, any> | null> {
  try {
    const serverSnap = await getDocFromServer(ref);
    return serverSnap.exists() ? serverSnap.data() : null;
  } catch (err: any) {
    const code = String(err?.code || '').toLowerCase();
    const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
    if (code.includes('permission') || msg.includes('permission') || msg.includes('insufficient')) {
      throw err;
    }
    const cachedSnap = await getDoc(ref);
    return cachedSnap.exists() ? cachedSnap.data() : null;
  }
}

function asOptStr(val: unknown, maxLen: number): string | undefined {
  if (val === null || val === undefined) return undefined;
  return String(val).slice(0, maxLen);
}

function emailsNeedBackfill(existingEmails: unknown, targetEmails: string[]): boolean {
  if (!Array.isArray(existingEmails)) return true;
  // Firestore array-contains queries are case-sensitive, so require exact lowercase matches
  const existingExactSet = new Set(existingEmails.map((e) => String(e).trim()));
  return targetEmails.some((e) => !existingExactSet.has(e.trim().toLowerCase()));
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
  return Array.from(set).slice(0, 50);
}

function isFirestoreTimestampValue(val: unknown): boolean {
  if (!val || typeof val !== 'object') return false;
  const obj = val as Record<string, any>;
  if ('_methodName' in obj) return true;
  return (
    typeof obj.seconds === 'number' &&
    typeof obj.nanoseconds === 'number' &&
    typeof obj.toDate === 'function'
  );
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
      // Preserve Firestore FieldValue sentinels & Timestamps
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
  isAuthoritativeServerSnapshot: boolean,
  mirrorCloudAuthoritatively: boolean = false
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
    if (!isAuthoritativeServerSnapshot || (!mirrorCloudAuthoritatively && !knownSyncedIds.has(localItem.id))) {
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
    status: normalizePatientStatus(patient.status),
    fullName: ((patient.fullName || '').trim() || 'ไม่ระบุชื่อ').slice(0, 200),
    mobilityLevel: normalizeMobility(patient.mobilityLevel),
    profile: {
      admissionDate: (patient.admissionDate || nowIso.slice(0, 10)).slice(0, 32),
      statusReason: asOptStr(patient.statusReason, 1000),
      statusHistory: safeStatusHistory,
      nationalId: (patient.nationalId || '').slice(0, 30),
      title: (patient.title || '').slice(0, 30),
      birthDate: asOptStr(patient.birthDate, 32),
      age: safeNum(patient.age, 0),
      gender: patient.gender === 'หญิง' ? 'หญิง' : 'ชาย',
      phone: (patient.phone || '').slice(0, 50),
      caregiverName: (patient.caregiverName || '').slice(0, 200),
      caregiverRelation: (patient.caregiverRelation || '').slice(0, 100),
      caregiverPhone: (patient.caregiverPhone || '').slice(0, 50),
    },
    location: {
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
    },
    medical: {
      chronicDiseases: (patient.chronicDiseases || '').slice(0, 1000),
      symptomsDetail: (patient.symptomsDetail || '').slice(0, 2000),
      disabilityCard: asMap(patient.disabilityCard),
      specialNeeds: safeSpecialNeeds,
    },
    householdEconomy: {
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
    },
    assistancePlan: {
      helpCashEnabled: Boolean(patient.helpCashEnabled),
      helpCashAmount: safeNum(patient.helpCashAmount, 0),
      helpDiaperSize: normalizeDiaperSize(patient.helpDiaperSize),
      helpDiaperPacks: safeNum(patient.helpDiaperPacks, 0),
      helpRicePacks: safeNum(patient.helpRicePacks, 0),
      helpWaterSize: normalizeWaterSize(patient.helpWaterSize),
      helpWaterPacks: safeNum(patient.helpWaterPacks, 0),
      helpOtherSupplies: (patient.helpOtherSupplies || '').slice(0, 500),
    },
    assessment: {
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
    },
    createdAt: ((patient.createdAt || '').trim() || nowIso).slice(0, 64),
    updatedAt: ((patient.updatedAt || '').trim() || nowIso).slice(0, 64),
    serverCreatedAt:
      isUpdate && isFirestoreTimestampValue(existingServerCreatedAt)
        ? existingServerCreatedAt
        : serverTimestamp(),
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
    serverCreatedAt:
      isUpdate && isFirestoreTimestampValue(existingServerCreatedAt)
        ? existingServerCreatedAt
        : serverTimestamp(),
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
    serverCreatedAt:
      isUpdate && isFirestoreTimestampValue(existingServerCreatedAt)
        ? existingServerCreatedAt
        : serverTimestamp(),
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
    deceasedName: ((record.deceasedName || '').trim() || 'ไม่ระบุชื่อ').slice(0, 200),
    applicantName: ((record.applicantName || '').trim() || 'ไม่ระบุชื่อ').slice(0, 200),
    deceasedInfo: {
      deceasedTitle: (record.deceasedTitle || '').slice(0, 30),
      deceasedNationalId: (record.deceasedNationalId || '').slice(0, 30),
      deceasedAge: safeNum(record.deceasedAge, 0),
      deceasedDeathDate: (record.deceasedDeathDate || '').slice(0, 32),
      deceasedDeathTime: (record.deceasedDeathTime || '').slice(0, 16),
      causeOfDeath: (record.causeOfDeath || '').slice(0, 500),
      deathPlace: (record.deathPlace || '').slice(0, 300),
      deceasedAddress: (record.deceasedAddress || '').slice(0, 500),
    },
    applicantInfo: {
      applicantTitle: (record.applicantTitle || '').slice(0, 30),
      applicantNationalId: (record.applicantNationalId || '').slice(0, 30),
      applicantPhone: (record.applicantPhone || '').slice(0, 50),
      applicantRelation: (record.applicantRelation || '').slice(0, 100),
      applicantAddress: (record.applicantAddress || '').slice(0, 500),
      applicantPovertyReason: (record.applicantPovertyReason || '').slice(0, 1000),
    },
    cremationAid: {
      templeName: (record.templeName || '').slice(0, 300),
      cremationDate: (record.cremationDate || '').slice(0, 32),
      cremationTime: (record.cremationTime || '').slice(0, 16),
      assistanceAmount: safeNum(record.assistanceAmount, 0),
      coffinProvided: Boolean(record.coffinProvided),
      transportProvided: Boolean(record.transportProvided),
      shroudClothProvided: Boolean(record.shroudClothProvided),
      otherItems: (record.otherItems || '').slice(0, 500),
    },
    signatories: {
      officerId: (record.officerId || '').slice(0, 128),
      officerName: (record.officerName || '').slice(0, 200),
      officerPosition: (record.officerPosition || '').slice(0, 200),
      approverId: asOptStr(record.approverId, 128),
      approverName: (record.approverName || '').slice(0, 200),
      approverPosition: (record.approverPosition || '').slice(0, 200),
      approvalDate: asOptStr(record.approvalDate, 32),
    },
    createdAt: ((record.createdAt || '').trim() || nowIso).slice(0, 64),
    updatedAt: ((record.updatedAt || '').trim() || nowIso).slice(0, 64),
    serverCreatedAt:
      isUpdate && isFirestoreTimestampValue(existingServerCreatedAt)
        ? existingServerCreatedAt
        : serverTimestamp(),
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
    recipientInfo: {
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
    },
    itemsSummary: {
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
    },
    handoverAndSignatories: {
      handoverPlace: (record.handoverPlace || '').slice(0, 300),
      deliveryMethod: (record.deliveryMethod || '').slice(0, 200),
      officerId: (record.officerId || '').slice(0, 128),
      officerName: (record.officerName || '').slice(0, 200),
      officerPosition: (record.officerPosition || '').slice(0, 200),
      approverName: (record.approverName || '').slice(0, 200),
      approverPosition: (record.approverPosition || '').slice(0, 200),
    },
    createdAt: ((record.createdAt || '').trim() || nowIso).slice(0, 64),
    updatedAt: ((record.updatedAt || '').trim() || nowIso).slice(0, 64),
    serverCreatedAt:
      isUpdate && isFirestoreTimestampValue(existingServerCreatedAt)
        ? existingServerCreatedAt
        : serverTimestamp(),
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
  documents: Array<PatientDocument | FuneralDocument | DonationDocument>,
  pruneRemovedMedia: boolean = false
) {
  const superAdmin = isSuperAdminUser(user);
  const fullAccess = isFullAccessStaffUser(user);
  const mediaCol = collection(db, collectionPath, parentId, 'media');
  const mediaQuery = fullAccess
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
      await setDoc(doc(db, collectionPath, parentId, 'media', mediaId), serialized, { merge: true });
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
      await setDoc(doc(db, collectionPath, parentId, 'media', mediaId), serialized, { merge: true });
    }
  }

  // Only prune removed attachments when explicitly edited in UI (never during background sync or compacted caches)
  if (pruneRemovedMedia) {
    for (const [existingId] of existingMap.entries()) {
      if (!desiredIds.has(existingId)) {
        await deleteDoc(doc(db, collectionPath, parentId, 'media', existingId));
      }
    }
  }
}

export async function savePatientToCloud(
  patient: PatientRecord,
  user: User,
  teamEmails: string[] = [],
  options: { pruneRemovedMedia?: boolean } = {}
): Promise<void> {
  const patientId = sanitizeFirestoreId(patient.id, 'pt');
  const patientRef = doc(db, 'patients', patientId);
  const superAdmin = isSuperAdminUser(user);
  const fullAccess = isFullAccessStaffUser(user);
  const desiredEmails = normalizeAuthorizedEmails(teamEmails, user);

  try {
    const existingData = await getExistingServerDocData(patientRef);
    const ownerUid = existingData?.ownerUid || user.uid;
    const parentEmails = existingData && !superAdmin ? existingData.authorizedEmails : desiredEmails;

    const mergedPatient = existingData
      ? mergePatientRecordsForUpdate(normalizePatientRecord({ ...existingData, id: patientId }), {
          ...patient,
          id: patientId,
        })
      : normalizePatientRecord({ ...patient, id: patientId });

    const parentPayload = serializePatientParent(
      mergedPatient,
      ownerUid,
      parentEmails,
      existingData?.serverCreatedAt,
      Boolean(existingData)
    );

    const legacyFlatDoc = hasLegacyFlatKeys(existingData, PATIENT_CANONICAL_KEYS);

    // If parent does not exist yet, create parent first so subcollection security rules (exists(parent)) pass
    if (!existingData) {
      await setDoc(patientRef, parentPayload, { merge: true });
    }

    const isCompacted = Boolean((patient as any)._compactStrippedMedia);
    const hasDeliveries = (patient.deliveries?.length || 0) > 0;
    const hasMedia = (patient.photos?.length || 0) > 0 || (patient.documents?.length || 0) > 0;

    if (existingData || hasDeliveries) {
      // Non-destructive upsert of deliveries subcollection (existing deliveries on Cloud are never deleted here)
      const delCol = collection(db, 'patients', patientId, 'deliveries');
      const delQuery = fullAccess
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
        await setDoc(doc(db, 'patients', patientId, 'deliveries', delId), delPayload, {
          merge: true,
        });
      }
    }

    if ((existingData || hasMedia) && !isCompacted) {
      await syncMediaSubcollection(
        'patients',
        patientId,
        user.uid,
        user,
        desiredEmails,
        patient.photos || [],
        patient.documents || [],
        Boolean(options.pruneRemovedMedia)
      );
    }

    // Commit/touch parent AFTER subcollections so remote onSnapshot listeners hydrate complete data
    if (existingData) {
      // Migrate legacy flat docs cleanly into grouped sub-maps without losing fields, else merge
      if (legacyFlatDoc) {
        await setDoc(patientRef, parentPayload);
      } else {
        await setDoc(patientRef, parentPayload, { merge: true });
      }
    } else if (hasDeliveries || hasMedia) {
      await updateDoc(patientRef, { serverUpdatedAt: serverTimestamp() });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `patients/${patientId}`);
    throw err;
  }
}

export async function deletePatientFromCloud(id: string, user?: User | null): Promise<void> {
  const patientId = sanitizeFirestoreId(id, 'pt');
  const fullAccess = !user || isFullAccessStaffUser(user);
  const userEmail = (user?.email || '').toLowerCase();
  try {
    const delCol = collection(db, 'patients', patientId, 'deliveries');
    const delQuery = fullAccess
      ? delCol
      : query(delCol, where('authorizedEmails', 'array-contains', userEmail));
    const delSnap = await getDocs(delQuery);
    for (const d of delSnap.docs) {
      await deleteDoc(doc(db, 'patients', patientId, 'deliveries', d.id));
    }

    const mediaCol = collection(db, 'patients', patientId, 'media');
    const mediaQuery = fullAccess
      ? mediaCol
      : query(mediaCol, where('authorizedEmails', 'array-contains', userEmail));
    const mediaSnap = await getDocs(mediaQuery);
    for (const d of mediaSnap.docs) {
      await deleteDoc(doc(db, 'patients', patientId, 'media', d.id));
    }

    await deleteDoc(doc(db, 'patients', patientId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `patients/${patientId}`);
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
    const existingData = await getExistingServerDocData(patientRef);
    if (!existingData) {
      await savePatientToCloud(patient, user, teamEmails);
      return;
    }

    // Write subcollection delivery FIRST so remote onSnapshot fires after delivery doc exists
    const delRef = doc(db, 'patients', patientId, 'deliveries', delId);
    const delData = await getExistingServerDocData(delRef);
    const delEmails = delData && !superAdmin ? delData.authorizedEmails : desiredEmails;
    const payload = await serializeDeliveryDoc(
      { ...delivery, id: delId },
      patientId,
      delData?.ownerUid || user.uid,
      delEmails,
      delData?.serverCreatedAt,
      Boolean(delData)
    );
    await setDoc(delRef, payload, { merge: true });

    // Then merge & update parent doc to trigger remote hydration with the committed delivery
    const parentEmails = !superAdmin ? existingData.authorizedEmails : desiredEmails;
    const mergedPatient = mergePatientRecordsForUpdate(
      normalizePatientRecord({ ...existingData, id: patientId }),
      { ...patient, id: patientId }
    );
    const parentPayload = serializePatientParent(
      mergedPatient,
      existingData.ownerUid || user.uid,
      parentEmails,
      existingData.serverCreatedAt,
      true
    );
    if (hasLegacyFlatKeys(existingData, PATIENT_CANONICAL_KEYS)) {
      await setDoc(patientRef, parentPayload);
    } else {
      await setDoc(patientRef, parentPayload, { merge: true });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `patients/${patientId}/deliveries/${delId}`);
    throw err;
  }
}

export async function saveFuneralToCloud(
  record: FuneralAssistanceRecord,
  user: User,
  teamEmails: string[] = [],
  options: { pruneRemovedMedia?: boolean } = {}
): Promise<void> {
  const funeralId = sanitizeFirestoreId(record.id, 'funeral');
  const ref = doc(db, 'funerals', funeralId);
  const superAdmin = isSuperAdminUser(user);
  const desiredEmails = normalizeAuthorizedEmails(teamEmails, user);

  try {
    const existingData = await getExistingServerDocData(ref);
    const ownerUid = existingData?.ownerUid || user.uid;
    const parentEmails = existingData && !superAdmin ? existingData.authorizedEmails : desiredEmails;

    const mergedRecord = existingData
      ? mergeFuneralRecordsForUpdate(normalizeFuneralRecord({ ...existingData, id: funeralId }), {
          ...record,
          id: funeralId,
        })
      : normalizeFuneralRecord({ ...record, id: funeralId });

    const parentPayload = serializeFuneralParent(
      mergedRecord,
      ownerUid,
      parentEmails,
      existingData?.serverCreatedAt,
      Boolean(existingData)
    );

    if (!existingData) {
      await setDoc(ref, parentPayload, { merge: true });
    }

    const isCompacted = Boolean((record as any)._compactStrippedMedia);
    if (!isCompacted) {
      await syncMediaSubcollection(
        'funerals',
        funeralId,
        user.uid,
        user,
        desiredEmails,
        [],
        record.documents || [],
        Boolean(options.pruneRemovedMedia)
      );
    }

    if (existingData) {
      if (hasLegacyFlatKeys(existingData, FUNERAL_CANONICAL_KEYS)) {
        await setDoc(ref, parentPayload);
      } else {
        await setDoc(ref, parentPayload, { merge: true });
      }
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
      !user || isFullAccessStaffUser(user)
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
  teamEmails: string[] = [],
  options: { pruneRemovedMedia?: boolean } = {}
): Promise<void> {
  const donationId = sanitizeFirestoreId(record.id, 'donation');
  const ref = doc(db, 'donations', donationId);
  const superAdmin = isSuperAdminUser(user);
  const desiredEmails = normalizeAuthorizedEmails(teamEmails, user);

  try {
    const existingData = await getExistingServerDocData(ref);
    const ownerUid = existingData?.ownerUid || user.uid;
    const parentEmails = existingData && !superAdmin ? existingData.authorizedEmails : desiredEmails;

    const mergedRecord = existingData
      ? mergeDonationRecordsForUpdate(normalizeDonationRecord({ ...existingData, id: donationId }), {
          ...record,
          id: donationId,
        })
      : normalizeDonationRecord({ ...record, id: donationId });

    const parentPayload = serializeDonationParent(
      mergedRecord,
      ownerUid,
      parentEmails,
      existingData?.serverCreatedAt,
      Boolean(existingData)
    );

    if (!existingData) {
      await setDoc(ref, parentPayload, { merge: true });
    }

    const isCompacted = Boolean((record as any)._compactStrippedMedia);
    if (!isCompacted) {
      await syncMediaSubcollection(
        'donations',
        donationId,
        user.uid,
        user,
        desiredEmails,
        record.photos || [],
        record.documents || [],
        Boolean(options.pruneRemovedMedia)
      );
    }

    if (existingData) {
      if (hasLegacyFlatKeys(existingData, DONATION_CANONICAL_KEYS)) {
        await setDoc(ref, parentPayload);
      } else {
        await setDoc(ref, parentPayload, { merge: true });
      }
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
      !user || isFullAccessStaffUser(user)
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
    const existingData = await getExistingServerDocData(ref);
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
      serverCreatedAt: isFirestoreTimestampValue(existingData?.serverCreatedAt)
        ? existingData!.serverCreatedAt
        : serverTimestamp(),
      serverUpdatedAt: serverTimestamp(),
    });

    await setDoc(ref, payload, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'settings/delivery_plan');
    throw err;
  }
}

export async function fetchWorkspaceAuthorizedEmails(user: User): Promise<string[]> {
  try {
    const ref = doc(db, 'settings', 'workspace');
    let snap = await getDocFromServer(ref).catch(() => null);
    if (!snap) {
      snap = await getDoc(ref);
    }
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
  const cached = getStoredAuthorizedEmailsFromLocal();
  if (cached.length > 0) {
    return normalizeAuthorizedEmails(cached, isSuperAdminUser(user) ? user : null);
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

export async function registerStaffAdminMember(
  uid: string,
  email: string,
  displayName: string,
  adminUser: User
): Promise<void> {
  if (!isSuperAdminUser(adminUser)) {
    throw new Error('เฉพาะ Super Admin เท่านั้นที่สามารถเพิ่มบัญชีเจ้าหน้าที่ได้');
  }
  const cleanUid = sanitizeFirestoreId(uid, 'uid');
  const adminRef = doc(db, 'admins', cleanUid);
  try {
    const existingAdmin = await getDoc(adminRef);
    await setDoc(
      adminRef,
      {
        uid: cleanUid,
        email: email.trim().toLowerCase().slice(0, 200),
        displayName: (displayName || email).trim().slice(0, 200),
        role: 'officer',
        serverCreatedAt: existingAdmin.exists()
          ? existingAdmin.data().serverCreatedAt
          : serverTimestamp(),
        serverUpdatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `admins/${cleanUid}`);
    throw err;
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
  const normalizedSet = new Set(normalized.map((e) => e.toLowerCase()));
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

    // Revoke /admins/{uid} entries for removed custom accounts
    try {
      const adminsSnap = await getDocs(collection(db, 'admins'));
      for (const aDoc of adminsSnap.docs) {
        const aEmail = String(aDoc.data().email || '').trim().toLowerCase();
        if (
          aEmail &&
          aEmail !== SUPER_ADMIN_EMAIL.toLowerCase() &&
          !findAdminUserByAuthEmail(aEmail) &&
          !normalizedSet.has(aEmail)
        ) {
          await deleteDoc(aDoc.ref);
        }
      }
    } catch (adminCleanupErr) {
      console.warn('Admin directory cleanup skipped:', adminCleanupErr);
    }

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
      const pData = pDoc.data();
      if (hasLegacyFlatKeys(pData, PATIENT_CANONICAL_KEYS)) {
        const hydrated = await hydratePatientSafe({ ...pData, id: pDoc.id }, user, undefined, db, true);
        await savePatientToCloud(hydrated, user, normalized);
      } else {
        await updateDoc(pDoc.ref, {
          authorizedEmails: normalized,
          serverUpdatedAt: serverTimestamp(),
        });
      }
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
      const fData = fDoc.data();
      if (hasLegacyFlatKeys(fData, FUNERAL_CANONICAL_KEYS)) {
        const hydrated = await hydrateFuneral({ ...fData, id: fDoc.id }, user, undefined, db, true);
        await saveFuneralToCloud(hydrated, user, normalized);
      } else {
        await updateDoc(fDoc.ref, {
          authorizedEmails: normalized,
          serverUpdatedAt: serverTimestamp(),
        });
      }
      const mediaSnap = await getDocs(collection(db, 'funerals', fDoc.id, 'media'));
      for (const m of mediaSnap.docs) {
        await updateDoc(m.ref, { authorizedEmails: normalized, serverUpdatedAt: serverTimestamp() });
      }
    }

    for (const dDoc of dSnap.docs) {
      const dData = dDoc.data();
      if (hasLegacyFlatKeys(dData, DONATION_CANONICAL_KEYS)) {
        const hydrated = await hydrateDonation({ ...dData, id: dDoc.id }, user, undefined, db, true);
        await saveDonationToCloud(hydrated, user, normalized);
      } else {
        await updateDoc(dDoc.ref, {
          authorizedEmails: normalized,
          serverUpdatedAt: serverTimestamp(),
        });
      }
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
// Read & Hydration Helpers (delegated to shared legacy-compatible normalizers)
// ============================================================================

async function hydratePatient(
  raw: Record<string, any>,
  user: User,
  fallbackLocal?: PatientRecord,
  sourceDb: Firestore = db,
  preferServer: boolean = false
): Promise<PatientRecord> {
  const patientId = raw.id;
  const fullAccess = isFullAccessStaffUser(user);
  const userEmail = (user.email || '').trim().toLowerCase();

  const delQuery = fullAccess
    ? collection(sourceDb, 'patients', patientId, 'deliveries')
    : query(
        collection(sourceDb, 'patients', patientId, 'deliveries'),
        where('authorizedEmails', 'array-contains', userEmail)
      );

  const mediaQuery = fullAccess
    ? collection(sourceDb, 'patients', patientId, 'media')
    : query(
        collection(sourceDb, 'patients', patientId, 'media'),
        where('authorizedEmails', 'array-contains', userEmail)
      );

  const fetchSub = (q: Query<DocumentData>): Promise<QuerySnapshot<DocumentData>> =>
    preferServer ? getDocsFromServer(q).catch(() => getDocs(q)) : getDocs(q);

  const [delSnap, mediaSnap] = await Promise.all([
    fetchSub(delQuery).catch((err) => {
      console.warn(`Failed loading deliveries for patient ${patientId}:`, err);
      return null;
    }),
    fetchSub(mediaQuery).catch((err) => {
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
        diaperSize: normalizeDiaperSize(val.diaperSize),
        diaperPacks: safeNum(val.diaperPacks, 0),
        ricePacks: safeNum(val.ricePacks, 0),
        waterPacks: safeNum(val.waterPacks, 0),
        waterSize: normalizeWaterSize(val.waterSize),
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

  return normalizePatientRecord(raw, deliveries, photos, documents);
}

async function hydratePatientSafe(
  raw: Record<string, any>,
  user: User,
  fallbackLocal?: PatientRecord,
  sourceDb: Firestore = db,
  preferServer: boolean = false
): Promise<PatientRecord> {
  try {
    return await hydratePatient(raw, user, fallbackLocal, sourceDb, preferServer);
  } catch (err) {
    console.warn(`Safe hydration fallback for patient ${raw?.id}:`, err);
    return normalizePatientRecord(
      raw,
      fallbackLocal?.deliveries || [],
      fallbackLocal?.photos || [],
      fallbackLocal?.documents || []
    );
  }
}

async function hydrateFuneral(
  raw: Record<string, any>,
  user: User,
  fallbackLocal?: FuneralAssistanceRecord,
  sourceDb: Firestore = db,
  preferServer: boolean = false
): Promise<FuneralAssistanceRecord> {
  const funeralId = raw.id;
  const fullAccess = isFullAccessStaffUser(user);
  const userEmail = (user.email || '').trim().toLowerCase();
  const mediaQuery = fullAccess
    ? collection(sourceDb, 'funerals', funeralId, 'media')
    : query(
        collection(sourceDb, 'funerals', funeralId, 'media'),
        where('authorizedEmails', 'array-contains', userEmail)
      );

  const mediaSnap = await (preferServer
    ? getDocsFromServer(mediaQuery).catch(() => getDocs(mediaQuery))
    : getDocs(mediaQuery)
  ).catch((err) => {
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

  return normalizeFuneralRecord(raw, documents);
}

async function hydrateDonation(
  raw: Record<string, any>,
  user: User,
  fallbackLocal?: DonationDistributionRecord,
  sourceDb: Firestore = db,
  preferServer: boolean = false
): Promise<DonationDistributionRecord> {
  const donationId = raw.id;
  const fullAccess = isFullAccessStaffUser(user);
  const userEmail = (user.email || '').trim().toLowerCase();
  const mediaQuery = fullAccess
    ? collection(sourceDb, 'donations', donationId, 'media')
    : query(
        collection(sourceDb, 'donations', donationId, 'media'),
        where('authorizedEmails', 'array-contains', userEmail)
      );

  const mediaSnap = await (preferServer
    ? getDocsFromServer(mediaQuery).catch(() => getDocs(mediaQuery))
    : getDocs(mediaQuery)
  ).catch((err) => {
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

  return normalizeDonationRecord(raw, photos, documents);
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
  const fullAccess = isFullAccessStaffUser(user);
  const userEmail = (user.email || '').trim().toLowerCase();

  const patientsQuery = fullAccess
    ? collection(db, 'patients')
    : query(collection(db, 'patients'), where('authorizedEmails', 'array-contains', userEmail));
  const funeralsQuery = fullAccess
    ? collection(db, 'funerals')
    : query(collection(db, 'funerals'), where('authorizedEmails', 'array-contains', userEmail));
  const donationsQuery = fullAccess
    ? collection(db, 'donations')
    : query(collection(db, 'donations'), where('authorizedEmails', 'array-contains', userEmail));

  const unsubs: Unsubscribe[] = [];
  let patientSeq = 0;
  let funeralSeq = 0;
  let donationSeq = 0;

  const emitError = (err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    const isPerm = msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('insufficient');
    handlers.onError?.({ isPermissionError: isPerm, message: msg });
  };

  unsubs.push(
    onSnapshot(
      patientsQuery,
      async (snap) => {
        const seq = ++patientSeq;
        try {
          const localMap = new Map((handlers.getLocalPatients?.() || []).map((p) => [p.id, p]));
          const items = await Promise.all(
            snap.docs.map((d) =>
              hydratePatientSafe({ ...d.data(), id: d.id }, user, localMap.get(d.id))
            )
          );
          if (seq !== patientSeq) return;
          handlers.onPatients(sortPatientsByCodeAsc(items), snap.metadata.fromCache);
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
        const seq = ++funeralSeq;
        try {
          const localMap = new Map((handlers.getLocalFunerals?.() || []).map((f) => [f.id, f]));
          const items = await Promise.all(
            snap.docs.map((d) => hydrateFuneral({ ...d.data(), id: d.id }, user, localMap.get(d.id)))
          );
          if (seq !== funeralSeq) return;
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
        const seq = ++donationSeq;
        try {
          const localMap = new Map((handlers.getLocalDonations?.() || []).map((d) => [d.id, d]));
          const items = await Promise.all(
            snap.docs.map((d) => hydrateDonation({ ...d.data(), id: d.id }, user, localMap.get(d.id)))
          );
          if (seq !== donationSeq) return;
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
  const fullAccess = isFullAccessStaffUser(user);
  const userEmail = (user.email || '').toLowerCase();
  const normalizedTeamEmails = normalizeAuthorizedEmails(teamEmails, user);
  const pendingOps = getPendingOps();
  const knownSynced = getKnownSyncedIds();

  // 1. Flush pending deletes first so deleted records don't get re-uploaded
  for (const id of pendingOps.deletes.patients) {
    try {
      await deletePatientFromCloud(id, user);
      clearPendingDelete('patients', id);
      removeKnownSyncedId('patients', id);
      deleted++;
    } catch (err) {
      failed++;
      console.warn(`Pending patient delete ${id} failed:`, err);
    }
  }
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
      fullAccess
        ? collection(db, 'patients')
        : query(collection(db, 'patients'), where('authorizedEmails', 'array-contains', userEmail))
    ),
    getDocs(
      fullAccess
        ? collection(db, 'funerals')
        : query(collection(db, 'funerals'), where('authorizedEmails', 'array-contains', userEmail))
    ),
    getDocs(
      fullAccess
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
        if (hasLegacyFlatKeys(data, PATIENT_CANONICAL_KEYS)) {
          const hydrated = await hydratePatientSafe({ ...data, id: d.id }, user, undefined, db, true);
          await savePatientToCloud(hydrated, user, normalizedTeamEmails);
        } else {
          await updateDoc(d.ref, {
            authorizedEmails: normalizedTeamEmails,
            serverUpdatedAt: serverTimestamp(),
          });
        }
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
  const pendingPatientDeleteSet = new Set(pendingOps.deletes.patients);
  for (const pt of localPatients) {
    const safeId = sanitizeFirestoreId(pt.id, 'pt');
    if (pendingPatientDeleteSet.has(pt.id) || pendingPatientDeleteSet.has(safeId)) continue;
    const localTime = Date.parse(pt.updatedAt || pt.createdAt || '') || Date.now();
    const cloudTime = cloudPatientTimes.get(safeId);
    const isPending = pendingPatientSet.has(pt.id) || pendingPatientSet.has(safeId);

    const shouldUpload =
      isPending ||
      cloudTime === undefined ||
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
        if (hasLegacyFlatKeys(data, FUNERAL_CANONICAL_KEYS)) {
          const hydrated = await hydrateFuneral({ ...data, id: d.id }, user, undefined, db, true);
          await saveFuneralToCloud(hydrated, user, normalizedTeamEmails);
        } else {
          await updateDoc(d.ref, {
            authorizedEmails: normalizedTeamEmails,
            serverUpdatedAt: serverTimestamp(),
          });
        }
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
        if (hasLegacyFlatKeys(data, DONATION_CANONICAL_KEYS)) {
          const hydrated = await hydrateDonation({ ...data, id: d.id }, user, undefined, db, true);
          await saveDonationToCloud(hydrated, user, normalizedTeamEmails);
        } else {
          await updateDoc(d.ref, {
            authorizedEmails: normalizedTeamEmails,
            serverUpdatedAt: serverTimestamp(),
          });
        }
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

/**
 * Authoritative one-shot server pull so every device can guarantee identical up-to-date data.
 */
export async function pullAllFromCloudServer(
  user: User,
  localFallback?: {
    patients?: PatientRecord[];
    funerals?: FuneralAssistanceRecord[];
    donations?: DonationDistributionRecord[];
  }
): Promise<{
  patients: PatientRecord[];
  funerals: FuneralAssistanceRecord[];
  donations: DonationDistributionRecord[];
  deliverySettings: DeliveryPlanSettings | null;
  authorizedEmails: string[];
}> {
  const fullAccess = isFullAccessStaffUser(user);
  const userEmail = (user.email || '').trim().toLowerCase();

  const pQuery = fullAccess
    ? collection(db, 'patients')
    : query(collection(db, 'patients'), where('authorizedEmails', 'array-contains', userEmail));
  const fQuery = fullAccess
    ? collection(db, 'funerals')
    : query(collection(db, 'funerals'), where('authorizedEmails', 'array-contains', userEmail));
  const dQuery = fullAccess
    ? collection(db, 'donations')
    : query(collection(db, 'donations'), where('authorizedEmails', 'array-contains', userEmail));

  const fetchServerOrCache = <T,>(q: any): Promise<T> =>
    getDocsFromServer(q).catch(() => getDocs(q)) as Promise<T>;

  const [pSnap, fSnap, dSnap, dpSnap, authorizedEmails] = await Promise.all([
    fetchServerOrCache<any>(pQuery),
    fetchServerOrCache<any>(fQuery),
    fetchServerOrCache<any>(dQuery),
    getDocFromServer(doc(db, 'settings', 'delivery_plan')).catch(() =>
      getDoc(doc(db, 'settings', 'delivery_plan')).catch(() => null)
    ),
    fetchWorkspaceAuthorizedEmails(user),
  ]);

  const localPatientMap = new Map((localFallback?.patients || []).map((p) => [p.id, p]));
  const localFuneralMap = new Map((localFallback?.funerals || []).map((f) => [f.id, f]));
  const localDonationMap = new Map((localFallback?.donations || []).map((d) => [d.id, d]));

  const [patients, funerals, donations] = await Promise.all([
    Promise.all(
      pSnap.docs.map((d: any) =>
        hydratePatientSafe({ ...d.data(), id: d.id }, user, localPatientMap.get(d.id), db, true)
      )
    ),
    Promise.all(
      fSnap.docs.map((d: any) =>
        hydrateFuneral({ ...d.data(), id: d.id }, user, localFuneralMap.get(d.id), db, true)
      )
    ),
    Promise.all(
      dSnap.docs.map((d: any) =>
        hydrateDonation({ ...d.data(), id: d.id }, user, localDonationMap.get(d.id), db, true)
      )
    ),
  ]);

  let deliverySettings: DeliveryPlanSettings | null = null;
  if (dpSnap && dpSnap.exists()) {
    const data = dpSnap.data();
    const price = Number(data.ricePricePerBag);
    const customRice =
      data.customRiceCount === null || data.customRiceCount === undefined
        ? null
        : Number(data.customRiceCount);
    deliverySettings = {
      ricePricePerBag: Number.isFinite(price) && price >= 0 ? price : 0,
      customRiceCount:
        customRice !== null && Number.isFinite(customRice) && customRice >= 0 ? customRice : null,
      currentMonth: typeof data.currentMonth === 'string' ? data.currentMonth : '',
      updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : '',
    };
  }

  return {
    patients: sortPatientsByCodeAsc(patients),
    funerals,
    donations,
    deliverySettings,
    authorizedEmails,
  };
}

/**
 * Safely migrate any legacy records from the project's (default) Firestore database
 * into the provisioned BD-Care Cloud Firestore database (`db`) when missing.
 * Never throws or disrupts normal startup if (default) DB is empty or inaccessible.
 */
export async function recoverFromDefaultDatabase(
  user: User,
  teamEmails: string[] = []
): Promise<{
  recoveredPatients: PatientRecord[];
  recoveredFunerals: FuneralAssistanceRecord[];
  recoveredDonations: DonationDistributionRecord[];
  recoveredCount: number;
  defaultDbPatientCount: number;
  defaultDbAccessError: boolean;
}> {
  const recoveredPatients: PatientRecord[] = [];
  const recoveredFunerals: FuneralAssistanceRecord[] = [];
  const recoveredDonations: DonationDistributionRecord[] = [];
  let recoveredCount = 0;
  let defaultDbPatientCount = 0;
  let defaultDbAccessError = false;

  const tryReadDefaultCollection = async (
    colName: 'patients' | 'funerals' | 'donations'
  ): Promise<QuerySnapshot<DocumentData> | null> => {
    const userEmail = (user.email || '').trim().toLowerCase();
    const attempts: Array<Query<DocumentData>> = [
      collection(defaultDb, colName),
      query(collection(defaultDb, colName), where('ownerUid', '==', user.uid)),
      ...(userEmail
        ? [query(collection(defaultDb, colName), where('authorizedEmails', 'array-contains', userEmail))]
        : []),
    ];

    let sawPermError = false;
    for (const q of attempts) {
      try {
        return await getDocsFromServer(q);
      } catch (err: any) {
        const msg = String(err?.message || '').toLowerCase();
        if (msg.includes('permission') || msg.includes('insufficient')) {
          sawPermError = true;
        }
        try {
          const cachedSnap = await getDocs(q);
          if (!cachedSnap.empty) return cachedSnap;
        } catch {
          /* continue to next query strategy */
        }
      }
    }
    if (sawPermError && colName === 'patients') {
      defaultDbAccessError = true;
    }
    return null;
  };

  try {
    const fullAccess = isFullAccessStaffUser(user);
    const userEmail = (user.email || '').trim().toLowerCase();
    const normalizedEmails = normalizeAuthorizedEmails(teamEmails, user);

    // Inspect existing document IDs in target `db` first so we never overwrite newer edits
    const [targetPSnap, targetFSnap, targetDSnap] = await Promise.all([
      getDocsFromServer(
        fullAccess
          ? collection(db, 'patients')
          : query(collection(db, 'patients'), where('authorizedEmails', 'array-contains', userEmail))
      ).catch(() => getDocs(collection(db, 'patients')).catch(() => null)),
      getDocsFromServer(
        fullAccess
          ? collection(db, 'funerals')
          : query(collection(db, 'funerals'), where('authorizedEmails', 'array-contains', userEmail))
      ).catch(() => getDocs(collection(db, 'funerals')).catch(() => null)),
      getDocsFromServer(
        fullAccess
          ? collection(db, 'donations')
          : query(collection(db, 'donations'), where('authorizedEmails', 'array-contains', userEmail))
      ).catch(() => getDocs(collection(db, 'donations')).catch(() => null)),
    ]);

    const existingPatientIds = new Set<string>(targetPSnap ? targetPSnap.docs.map((d) => d.id) : []);
    const existingFuneralIds = new Set<string>(targetFSnap ? targetFSnap.docs.map((d) => d.id) : []);
    const existingDonationIds = new Set<string>(targetDSnap ? targetDSnap.docs.map((d) => d.id) : []);

    // Read (default) database collections using resilient fallbacks
    const [legacyPSnap, legacyFSnap, legacyDSnap] = await Promise.all([
      tryReadDefaultCollection('patients'),
      tryReadDefaultCollection('funerals'),
      tryReadDefaultCollection('donations'),
    ]);

    if (legacyPSnap && !legacyPSnap.empty) {
      defaultDbPatientCount = legacyPSnap.docs.length;
      for (const d of legacyPSnap.docs) {
        const safeId = sanitizeFirestoreId(d.id, 'pt');
        if (existingPatientIds.has(d.id) || existingPatientIds.has(safeId)) continue;
        try {
          const hydrated = await hydratePatientSafe(
            { ...d.data(), id: safeId },
            user,
            undefined,
            defaultDb,
            true
          );
          await savePatientToCloud(hydrated, user, normalizedEmails);
          recoveredPatients.push(hydrated);
          recoveredCount++;
        } catch (err) {
          console.warn(`Legacy patient ${d.id} recovery skipped:`, err);
        }
      }
    }

    if (legacyFSnap && !legacyFSnap.empty) {
      for (const d of legacyFSnap.docs) {
        const safeId = sanitizeFirestoreId(d.id, 'funeral');
        if (existingFuneralIds.has(d.id) || existingFuneralIds.has(safeId)) continue;
        try {
          const hydrated = await hydrateFuneral(
            { ...d.data(), id: safeId },
            user,
            undefined,
            defaultDb,
            true
          );
          await saveFuneralToCloud(hydrated, user, normalizedEmails);
          recoveredFunerals.push(hydrated);
          recoveredCount++;
        } catch (err) {
          console.warn(`Legacy funeral ${d.id} recovery skipped:`, err);
        }
      }
    }

    if (legacyDSnap && !legacyDSnap.empty) {
      for (const d of legacyDSnap.docs) {
        const safeId = sanitizeFirestoreId(d.id, 'donation');
        if (existingDonationIds.has(d.id) || existingDonationIds.has(safeId)) continue;
        try {
          const hydrated = await hydrateDonation(
            { ...d.data(), id: safeId },
            user,
            undefined,
            defaultDb,
            true
          );
          await saveDonationToCloud(hydrated, user, normalizedEmails);
          recoveredDonations.push(hydrated);
          recoveredCount++;
        } catch (err) {
          console.warn(`Legacy donation ${d.id} recovery skipped:`, err);
        }
      }
    }
  } catch {
    // Silent fallback when (default) database is unavailable or empty
  }

  return {
    recoveredPatients: sortPatientsByCodeAsc(recoveredPatients),
    recoveredFunerals,
    recoveredDonations,
    recoveredCount,
    defaultDbPatientCount,
    defaultDbAccessError,
  };
}
