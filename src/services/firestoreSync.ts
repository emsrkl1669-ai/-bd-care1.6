import { User } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  deleteDoc,
  where,
  Unsubscribe,
} from 'firebase/firestore';
import {
  db,
  OperationType,
  handleFirestoreError,
  isSuperAdminUser,
} from '../firebase';
import {
  PatientRecord,
  MonthlyDelivery,
  PatientPhoto,
  PatientDocument,
  FuneralAssistanceRecord,
  FuneralDocument,
  DonationDistributionRecord,
  DonationPhoto,
  DonationDocument,
} from '../types';
import { compressImageDataUrl, sanitizeFirestoreId } from '../utils/image';

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
 * Non-destructive merge helper combining Cloud + Local arrays by `id`.
 * Keeps the record with the newer `updatedAt` ISO string, and always retains
 * records present on only one side (never deletes existing local data).
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

// ============================================================================
// Serializers (Strictly aligned with firestore.rules allowlists)
// ============================================================================

function serializePatientParent(
  patient: PatientRecord,
  ownerUid: string,
  existingServerCreatedAt?: any,
  isUpdate?: boolean
) {
  const id = sanitizeFirestoreId(patient.id, 'pt');
  const nowIso = new Date().toISOString();

  const payload: Record<string, any> = {
    id,
    ownerUid,
    code: (patient.code || `BDC-${id}`).slice(0, 40),
    admissionDate: patient.admissionDate || nowIso.slice(0, 10),
    status: patient.status || 'active',
    statusReason: patient.statusReason,
    statusHistory: patient.statusHistory,
    nationalId: patient.nationalId || '',
    title: patient.title || '',
    fullName: (patient.fullName || 'ไม่ระบุชื่อ').slice(0, 200),
    birthDate: patient.birthDate,
    age: Number(patient.age || 0),
    gender: patient.gender === 'หญิง' ? 'หญิง' : 'ชาย',
    phone: patient.phone || '',
    caregiverName: patient.caregiverName || '',
    caregiverRelation: patient.caregiverRelation || '',
    caregiverPhone: patient.caregiverPhone || '',
    idAddress: patient.idAddress,
    isSameAddress: Boolean(patient.isSameAddress),
    currentAddress: patient.currentAddress,
    latitude: patient.latitude ?? null,
    longitude: patient.longitude ?? null,
    ...(typeof patient.locationAccuracy === 'number' && !isNaN(patient.locationAccuracy)
      ? { locationAccuracy: patient.locationAccuracy }
      : {}),
    landmarkNote: patient.landmarkNote || '',
    googleMapsUrl: patient.googleMapsUrl || '',
    qrCodeDataUrl:
      patient.qrCodeDataUrl && patient.qrCodeDataUrl.length <= 40000
        ? patient.qrCodeDataUrl
        : '',
    mobilityLevel: patient.mobilityLevel || 'bedridden',
    chronicDiseases: patient.chronicDiseases || '',
    symptomsDetail: patient.symptomsDetail || '',
    disabilityCard: patient.disabilityCard,
    specialNeeds: patient.specialNeeds || [],
    familyMembersTotal: Number(patient.familyMembersTotal || 0),
    familyMembersMale: Number(patient.familyMembersMale || 0),
    familyMembersFemale: Number(patient.familyMembersFemale || 0),
    incomeSalary: Number(patient.incomeSalary || 0),
    incomeDisability: Number(patient.incomeDisability || 0),
    incomeElderly: Number(patient.incomeElderly || 0),
    incomeStateWelfare: Number(patient.incomeStateWelfare || 0),
    incomeOther: Number(patient.incomeOther || 0),
    expenseRentHouse: Number(patient.expenseRentHouse || 0),
    expenseRentLand: Number(patient.expenseRentLand || 0),
    expenseLiving: Number(patient.expenseLiving || 0),
    expenseMedicalTravel: Number(patient.expenseMedicalTravel || 0),
    expenseDebt: Number(patient.expenseDebt || 0),
    expenseOther: Number(patient.expenseOther || 0),
    monthlyExpense: Number(patient.monthlyExpense || 0),
    netIncome: Number(patient.netIncome || 0),
    economicNote: patient.economicNote || '',
    helpCashEnabled: Boolean(patient.helpCashEnabled),
    helpCashAmount: Number(patient.helpCashAmount || 0),
    helpDiaperSize: patient.helpDiaperSize || 'NONE',
    helpDiaperPacks: Number(patient.helpDiaperPacks || 0),
    helpRicePacks: Number(patient.helpRicePacks || 0),
    helpWaterSize: patient.helpWaterSize || '1.5L',
    helpWaterPacks: Number(patient.helpWaterPacks || 0),
    helpOtherSupplies: patient.helpOtherSupplies || '',
    vulnerabilityScore: Number(patient.vulnerabilityScore || 0),
    vulnerabilityLevel: patient.vulnerabilityLevel || '',
    dimensionScores: patient.dimensionScores,
    socialWorkerOpinion: patient.socialWorkerOpinion || '',
    aiSuggestions: patient.aiSuggestions || '',
    interviewerName: patient.interviewerName || '',
    interviewerPosition: patient.interviewerPosition || '',
    approverName: patient.approverName || '',
    approverPosition: patient.approverPosition || '',
    presidentName: patient.presidentName || '',
    presidentPosition: patient.presidentPosition || '',
    createdAt: patient.createdAt || nowIso,
    updatedAt: patient.updatedAt || nowIso,
    serverCreatedAt: isUpdate && existingServerCreatedAt ? existingServerCreatedAt : serverTimestamp(),
    serverUpdatedAt: serverTimestamp(),
  };

  return stripUndefined(payload);
}

async function serializeDeliveryDoc(
  delivery: MonthlyDelivery,
  patientId: string,
  ownerUid: string,
  existingServerCreatedAt?: any,
  isUpdate?: boolean
) {
  const id = sanitizeFirestoreId(delivery.id, 'del');
  let safePhotoUrl = delivery.photoUrl;
  if (safePhotoUrl && safePhotoUrl.startsWith('data:image/') && safePhotoUrl.length > 480000) {
    safePhotoUrl = await compressImageDataUrl(safePhotoUrl, {
      maxWidth: 900,
      maxHeight: 900,
      quality: 0.7,
      maxDataUrlLength: 470000,
    });
  }
  if (safePhotoUrl && safePhotoUrl.length > 500000) {
    safePhotoUrl = undefined;
  }

  return stripUndefined({
    id,
    patientId,
    ownerUid,
    deliveryDate: delivery.deliveryDate || new Date().toISOString().slice(0, 10),
    monthYearLabel: delivery.monthYearLabel || '',
    cashAmount: Number(delivery.cashAmount || 0),
    cashGiven: Boolean(delivery.cashGiven),
    diaperSize: delivery.diaperSize || 'NONE',
    diaperPacks: Number(delivery.diaperPacks || 0),
    ricePacks: Number(delivery.ricePacks || 0),
    waterPacks: Number(delivery.waterPacks || 0),
    waterSize: delivery.waterSize || '1.5L',
    otherItems: delivery.otherItems || '',
    receivedBy: (delivery.receivedBy || 'ผู้ป่วย/ผู้ดูแล').slice(0, 200),
    recipientRelation: delivery.recipientRelation || '',
    officerName: delivery.officerName || '',
    photoUrl: safePhotoUrl,
    notes: delivery.notes || '',
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
  existingServerCreatedAt?: any,
  isUpdate?: boolean
) {
  const id = sanitizeFirestoreId(media.id, kind === 'photo' ? 'photo' : 'doc');
  let safeDataUrl = media.dataUrl || '';
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
    kind,
    category: media.category,
    title: media.title?.slice(0, 200),
    fileName: media.fileName?.slice(0, 255),
    fileType: media.fileType?.slice(0, 120),
    dataUrl: safeDataUrl,
    fileSize: typeof media.fileSize === 'number' ? media.fileSize : undefined,
    caption: media.caption?.slice(0, 500),
    timestamp: media.timestamp?.slice(0, 100),
    uploadDate: media.uploadDate?.slice(0, 64),
    serverCreatedAt: isUpdate && existingServerCreatedAt ? existingServerCreatedAt : serverTimestamp(),
    serverUpdatedAt: serverTimestamp(),
  });
}

function serializeFuneralParent(
  record: FuneralAssistanceRecord,
  ownerUid: string,
  existingServerCreatedAt?: any,
  isUpdate?: boolean
) {
  const id = sanitizeFirestoreId(record.id, 'funeral');
  const nowIso = new Date().toISOString();

  return stripUndefined({
    id,
    ownerUid,
    code: (record.code || `ศพ-${id}`).slice(0, 40),
    applicationDate: record.applicationDate || nowIso.slice(0, 10),
    status: record.status || 'pending',
    statusNote: record.statusNote,
    deceasedTitle: record.deceasedTitle || '',
    deceasedName: (record.deceasedName || 'ไม่ระบุชื่อ').slice(0, 200),
    deceasedNationalId: record.deceasedNationalId || '',
    deceasedAge: Number(record.deceasedAge || 0),
    deceasedDeathDate: record.deceasedDeathDate || '',
    deceasedDeathTime: record.deceasedDeathTime || '',
    causeOfDeath: record.causeOfDeath || '',
    deathPlace: record.deathPlace || '',
    deceasedAddress: record.deceasedAddress || '',
    applicantTitle: record.applicantTitle || '',
    applicantName: (record.applicantName || 'ไม่ระบุชื่อ').slice(0, 200),
    applicantNationalId: record.applicantNationalId || '',
    applicantPhone: record.applicantPhone || '',
    applicantRelation: record.applicantRelation || '',
    applicantAddress: record.applicantAddress || '',
    applicantPovertyReason: record.applicantPovertyReason || '',
    templeName: record.templeName || '',
    cremationDate: record.cremationDate || '',
    cremationTime: record.cremationTime || '',
    assistanceAmount: Number(record.assistanceAmount || 0),
    coffinProvided: Boolean(record.coffinProvided),
    transportProvided: Boolean(record.transportProvided),
    shroudClothProvided: Boolean(record.shroudClothProvided),
    otherItems: record.otherItems || '',
    officerId: record.officerId || '',
    officerName: record.officerName || '',
    officerPosition: record.officerPosition || '',
    approverId: record.approverId,
    approverName: record.approverName || '',
    approverPosition: record.approverPosition || '',
    approvalDate: record.approvalDate,
    createdAt: record.createdAt || nowIso,
    updatedAt: record.updatedAt || nowIso,
    serverCreatedAt: isUpdate && existingServerCreatedAt ? existingServerCreatedAt : serverTimestamp(),
    serverUpdatedAt: serverTimestamp(),
  });
}

function serializeDonationParent(
  record: DonationDistributionRecord,
  ownerUid: string,
  existingServerCreatedAt?: any,
  isUpdate?: boolean
) {
  const id = sanitizeFirestoreId(record.id, 'donation');
  const nowIso = new Date().toISOString();

  // NOTE: explicitly omits deprecated sandalwoodFlowersCount, photos, documents
  return stripUndefined({
    id,
    ownerUid,
    code: (record.code || `บริจาค-${id}`).slice(0, 40),
    distributionDate: record.distributionDate || nowIso.slice(0, 10),
    status: record.status || 'completed',
    recipientType: record.recipientType || 'individual',
    individualTitle: record.individualTitle || '',
    individualName: record.individualName || '',
    individualNationalId: record.individualNationalId || '',
    individualPhone: record.individualPhone || '',
    individualAddress: record.individualAddress || '',
    individualCategory: record.individualCategory || '',
    individualNeedReason: record.individualNeedReason || '',
    agencyName: record.agencyName || '',
    agencyType: record.agencyType || '',
    agencyContactPerson: record.agencyContactPerson || '',
    agencyContactPosition: record.agencyContactPosition || '',
    agencyPhone: record.agencyPhone || '',
    agencyAddress: record.agencyAddress || '',
    agencyRequestPurpose: record.agencyRequestPurpose || '',
    officialLetterNo: record.officialLetterNo || '',
    waterPacks: Number(record.waterPacks || 0),
    waterUnit: record.waterUnit || 'แพ็ค',
    dryFoodCount: Number(record.dryFoodCount || 0),
    dryFoodUnit: record.dryFoodUnit || 'ชุด',
    riceBags: Number(record.riceBags || 0),
    riceKg: Number(record.riceKg || 0),
    diaperPacks: Number(record.diaperPacks || 0),
    diaperSize: record.diaperSize || '',
    otherItems: (record.otherItems || []).slice(0, 30),
    notes: record.notes || '',
    handoverPlace: record.handoverPlace || '',
    deliveryMethod: record.deliveryMethod || '',
    officerId: record.officerId || '',
    officerName: record.officerName || '',
    officerPosition: record.officerPosition || '',
    approverName: record.approverName || '',
    approverPosition: record.approverPosition || '',
    createdAt: record.createdAt || nowIso,
    updatedAt: record.updatedAt || nowIso,
    serverCreatedAt: isUpdate && existingServerCreatedAt ? existingServerCreatedAt : serverTimestamp(),
    serverUpdatedAt: serverTimestamp(),
  });
}

// ============================================================================
// Write Operations (Parent Doc + Subcollections)
// ============================================================================

async function syncMediaSubcollection(
  collectionPath: 'patients' | 'funerals' | 'donations',
  parentId: string,
  ownerUid: string,
  photos: Array<PatientPhoto | DonationPhoto>,
  documents: Array<PatientDocument | FuneralDocument | DonationDocument>
) {
  const mediaCol = collection(db, collectionPath, parentId, 'media');
  const existingSnap = await getDocs(mediaCol);
  const existingMap = new Map<string, any>();
  existingSnap.forEach((d) => existingMap.set(d.id, d.data()));

  const desiredIds = new Set<string>();

  for (const p of photos) {
    const mediaId = sanitizeFirestoreId(p.id, 'photo');
    desiredIds.add(mediaId);
    const existing = existingMap.get(mediaId);
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

export async function savePatientToCloud(patient: PatientRecord, user: User): Promise<void> {
  const patientId = sanitizeFirestoreId(patient.id, 'pt');
  const patientRef = doc(db, 'patients', patientId);

  try {
    const existingSnap = await getDoc(patientRef);
    const existingData = existingSnap.exists() ? existingSnap.data() : null;
    const ownerUid = existingData?.ownerUid || user.uid;

    const parentPayload = serializePatientParent(
      {
        ...patient,
        id: patientId,
        createdAt: existingData?.createdAt || patient.createdAt,
      },
      ownerUid,
      existingData?.serverCreatedAt,
      Boolean(existingData)
    );

    await setDoc(patientRef, parentPayload);

    // Sync deliveries subcollection
    const delCol = collection(db, 'patients', patientId, 'deliveries');
    const existingDelSnap = await getDocs(delCol);
    const existingDelMap = new Map<string, any>();
    existingDelSnap.forEach((d) => existingDelMap.set(d.id, d.data()));

    for (const del of patient.deliveries || []) {
      const delId = sanitizeFirestoreId(del.id, 'del');
      const prevDel = existingDelMap.get(delId);
      const delPayload = await serializeDeliveryDoc(
        { ...del, id: delId },
        patientId,
        prevDel?.ownerUid || user.uid,
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
      patient.photos || [],
      patient.documents || []
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `patients/${patientId}`);
    throw err;
  }
}

export async function saveDeliveryToCloud(
  patient: PatientRecord,
  delivery: MonthlyDelivery,
  user: User
): Promise<void> {
  const patientId = sanitizeFirestoreId(patient.id, 'pt');
  const delId = sanitizeFirestoreId(delivery.id, 'del');
  try {
    const patientRef = doc(db, 'patients', patientId);
    const pSnap = await getDoc(patientRef);
    if (!pSnap.exists()) {
      await savePatientToCloud(patient, user);
      return;
    }
    const existingData = pSnap.data();
    await setDoc(
      patientRef,
      serializePatientParent(
        { ...patient, id: patientId, createdAt: existingData.createdAt },
        existingData.ownerUid,
        existingData.serverCreatedAt,
        true
      )
    );

    const delRef = doc(db, 'patients', patientId, 'deliveries', delId);
    const delSnap = await getDoc(delRef);
    const delData = delSnap.exists() ? delSnap.data() : null;
    const payload = await serializeDeliveryDoc(
      { ...delivery, id: delId },
      patientId,
      delData?.ownerUid || user.uid,
      delData?.serverCreatedAt,
      Boolean(delData)
    );
    await setDoc(delRef, payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `patients/${patientId}/deliveries/${delId}`);
    throw err;
  }
}

export async function saveFuneralToCloud(
  record: FuneralAssistanceRecord,
  user: User
): Promise<void> {
  const funeralId = sanitizeFirestoreId(record.id, 'funeral');
  const ref = doc(db, 'funerals', funeralId);
  try {
    const snap = await getDoc(ref);
    const existingData = snap.exists() ? snap.data() : null;
    const ownerUid = existingData?.ownerUid || user.uid;

    await setDoc(
      ref,
      serializeFuneralParent(
        {
          ...record,
          id: funeralId,
          createdAt: existingData?.createdAt || record.createdAt,
        },
        ownerUid,
        existingData?.serverCreatedAt,
        Boolean(existingData)
      )
    );

    await syncMediaSubcollection('funerals', funeralId, user.uid, [], record.documents || []);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `funerals/${funeralId}`);
    throw err;
  }
}

export async function deleteFuneralFromCloud(id: string): Promise<void> {
  const funeralId = sanitizeFirestoreId(id, 'funeral');
  try {
    const mediaSnap = await getDocs(collection(db, 'funerals', funeralId, 'media'));
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
  user: User
): Promise<void> {
  const donationId = sanitizeFirestoreId(record.id, 'donation');
  const ref = doc(db, 'donations', donationId);
  try {
    const snap = await getDoc(ref);
    const existingData = snap.exists() ? snap.data() : null;
    const ownerUid = existingData?.ownerUid || user.uid;

    await setDoc(
      ref,
      serializeDonationParent(
        {
          ...record,
          id: donationId,
          createdAt: existingData?.createdAt || record.createdAt,
        },
        ownerUid,
        existingData?.serverCreatedAt,
        Boolean(existingData)
      )
    );

    await syncMediaSubcollection(
      'donations',
      donationId,
      user.uid,
      record.photos || [],
      record.documents || []
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `donations/${donationId}`);
    throw err;
  }
}

export async function deleteDonationFromCloud(id: string): Promise<void> {
  const donationId = sanitizeFirestoreId(id, 'donation');
  try {
    const mediaSnap = await getDocs(collection(db, 'donations', donationId, 'media'));
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
// Read & Hydration Helpers
// ============================================================================

async function hydratePatient(raw: Record<string, any>, user: User): Promise<PatientRecord> {
  const patientId = raw.id;
  const superAdmin = isSuperAdminUser(user);

  const delQuery = superAdmin
    ? collection(db, 'patients', patientId, 'deliveries')
    : query(
        collection(db, 'patients', patientId, 'deliveries'),
        where('ownerUid', '==', user.uid)
      );

  const mediaQuery = superAdmin
    ? collection(db, 'patients', patientId, 'media')
    : query(
        collection(db, 'patients', patientId, 'media'),
        where('ownerUid', '==', user.uid)
      );

  const [delSnap, mediaSnap] = await Promise.all([
    getDocs(delQuery).catch(() => null),
    getDocs(mediaQuery).catch(() => null),
  ]);

  const deliveries: MonthlyDelivery[] = [];
  delSnap?.forEach((d) => {
    const val = d.data();
    deliveries.push({
      id: val.id || d.id,
      deliveryDate: val.deliveryDate || '',
      monthYearLabel: val.monthYearLabel || '',
      cashAmount: Number(val.cashAmount || 0),
      cashGiven: Boolean(val.cashGiven),
      diaperSize: val.diaperSize || 'NONE',
      diaperPacks: Number(val.diaperPacks || 0),
      ricePacks: Number(val.ricePacks || 0),
      waterPacks: Number(val.waterPacks || 0),
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

  const photos: PatientPhoto[] = [];
  const documents: PatientDocument[] = [];

  mediaSnap?.forEach((d) => {
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
        fileSize: Number(val.fileSize || 0),
        uploadDate: val.uploadDate || '',
      });
    }
  });

  const { serverCreatedAt: _sc, serverUpdatedAt: _su, ownerUid: _ou, ...rest } = raw;
  return {
    ...(rest as PatientRecord),
    deliveries,
    photos,
    documents,
  };
}

async function hydrateFuneral(raw: Record<string, any>, user: User): Promise<FuneralAssistanceRecord> {
  const funeralId = raw.id;
  const superAdmin = isSuperAdminUser(user);
  const mediaQuery = superAdmin
    ? collection(db, 'funerals', funeralId, 'media')
    : query(
        collection(db, 'funerals', funeralId, 'media'),
        where('ownerUid', '==', user.uid)
      );

  const mediaSnap = await getDocs(mediaQuery).catch(() => null);
  const documents: FuneralDocument[] = [];
  mediaSnap?.forEach((d) => {
    const val = d.data();
    documents.push({
      id: val.id || d.id,
      category: val.category || 'other',
      title: val.title || val.fileName || 'เอกสารแนบ',
      fileName: val.fileName || 'document',
      fileType: val.fileType || 'application/octet-stream',
      dataUrl: val.dataUrl,
      fileSize: Number(val.fileSize || 0),
      uploadDate: val.uploadDate || '',
    });
  });

  const { serverCreatedAt: _sc, serverUpdatedAt: _su, ownerUid: _ou, ...rest } = raw;
  return {
    ...(rest as FuneralAssistanceRecord),
    documents,
  };
}

async function hydrateDonation(raw: Record<string, any>, user: User): Promise<DonationDistributionRecord> {
  const donationId = raw.id;
  const superAdmin = isSuperAdminUser(user);
  const mediaQuery = superAdmin
    ? collection(db, 'donations', donationId, 'media')
    : query(
        collection(db, 'donations', donationId, 'media'),
        where('ownerUid', '==', user.uid)
      );

  const mediaSnap = await getDocs(mediaQuery).catch(() => null);
  const photos: DonationPhoto[] = [];
  const documents: DonationDocument[] = [];
  mediaSnap?.forEach((d) => {
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
        fileSize: Number(val.fileSize || 0),
        uploadDate: val.uploadDate || '',
      });
    }
  });

  const { serverCreatedAt: _sc, serverUpdatedAt: _su, ownerUid: _ou, ...rest } = raw;
  return {
    ...(rest as DonationDistributionRecord),
    photos,
    documents,
  };
}

/**
 * Subscribe to real-time updates on patients, funerals, and donations.
 */
export function subscribeToCloudCollections(
  user: User,
  handlers: {
    onPatients: (items: PatientRecord[]) => void;
    onFunerals: (items: FuneralAssistanceRecord[]) => void;
    onDonations: (items: DonationDistributionRecord[]) => void;
    onError?: (err: unknown) => void;
  }
): () => void {
  const superAdmin = isSuperAdminUser(user);

  const patientsQuery = superAdmin
    ? collection(db, 'patients')
    : query(collection(db, 'patients'), where('ownerUid', '==', user.uid));
  const funeralsQuery = superAdmin
    ? collection(db, 'funerals')
    : query(collection(db, 'funerals'), where('ownerUid', '==', user.uid));
  const donationsQuery = superAdmin
    ? collection(db, 'donations')
    : query(collection(db, 'donations'), where('ownerUid', '==', user.uid));

  const unsubs: Unsubscribe[] = [];

  unsubs.push(
    onSnapshot(
      patientsQuery,
      async (snap) => {
        try {
          const items = await Promise.all(
            snap.docs.map((d) => hydratePatient({ id: d.id, ...d.data() }, user))
          );
          handlers.onPatients(items);
        } catch (err) {
          handlers.onError?.(err);
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'patients');
        handlers.onError?.(err);
      }
    )
  );

  unsubs.push(
    onSnapshot(
      funeralsQuery,
      async (snap) => {
        try {
          const items = await Promise.all(
            snap.docs.map((d) => hydrateFuneral({ id: d.id, ...d.data() }, user))
          );
          handlers.onFunerals(items);
        } catch (err) {
          handlers.onError?.(err);
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'funerals');
        handlers.onError?.(err);
      }
    )
  );

  unsubs.push(
    onSnapshot(
      donationsQuery,
      async (snap) => {
        try {
          const items = await Promise.all(
            snap.docs.map((d) => hydrateDonation({ id: d.id, ...d.data() }, user))
          );
          handlers.onDonations(items);
        } catch (err) {
          handlers.onError?.(err);
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'donations');
        handlers.onError?.(err);
      }
    )
  );

  return () => {
    unsubs.forEach((u) => u());
  };
}

/**
 * Push any local records that don't exist in Firestore (or have newer updatedAt timestamps)
 * up to Cloud Firestore cleanly, ensuring zero data loss upon migration or edits.
 */
export async function syncLocalRecordsToCloud(
  user: User,
  localPatients: PatientRecord[],
  localFunerals: FuneralAssistanceRecord[],
  localDonations: DonationDistributionRecord[]
): Promise<{ uploaded: number }> {
  let uploaded = 0;
  const superAdmin = isSuperAdminUser(user);

  const [pSnap, fSnap, dSnap] = await Promise.all([
    getDocs(
      superAdmin
        ? collection(db, 'patients')
        : query(collection(db, 'patients'), where('ownerUid', '==', user.uid))
    ),
    getDocs(
      superAdmin
        ? collection(db, 'funerals')
        : query(collection(db, 'funerals'), where('ownerUid', '==', user.uid))
    ),
    getDocs(
      superAdmin
        ? collection(db, 'donations')
        : query(collection(db, 'donations'), where('ownerUid', '==', user.uid))
    ),
  ]);

  const cloudPatientTimes = new Map<string, number>();
  pSnap.forEach((d) => {
    const data = d.data();
    cloudPatientTimes.set(d.id, Date.parse(data.updatedAt || data.createdAt || '') || 0);
  });

  for (const pt of localPatients) {
    const safeId = sanitizeFirestoreId(pt.id, 'pt');
    const localTime = Date.parse(pt.updatedAt || pt.createdAt || '') || Date.now();
    const cloudTime = cloudPatientTimes.get(safeId);
    if (cloudTime === undefined || localTime > cloudTime) {
      await savePatientToCloud(pt, user);
      uploaded++;
    }
  }

  const cloudFuneralTimes = new Map<string, number>();
  fSnap.forEach((d) => {
    const data = d.data();
    cloudFuneralTimes.set(d.id, Date.parse(data.updatedAt || data.createdAt || '') || 0);
  });

  for (const f of localFunerals) {
    const safeId = sanitizeFirestoreId(f.id, 'funeral');
    const localTime = Date.parse(f.updatedAt || f.createdAt || '') || Date.now();
    const cloudTime = cloudFuneralTimes.get(safeId);
    if (cloudTime === undefined || localTime > cloudTime) {
      await saveFuneralToCloud(f, user);
      uploaded++;
    }
  }

  const cloudDonationTimes = new Map<string, number>();
  dSnap.forEach((d) => {
    const data = d.data();
    cloudDonationTimes.set(d.id, Date.parse(data.updatedAt || data.createdAt || '') || 0);
  });

  for (const don of localDonations) {
    const safeId = sanitizeFirestoreId(don.id, 'donation');
    const localTime = Date.parse(don.updatedAt || don.createdAt || '') || Date.now();
    const cloudTime = cloudDonationTimes.get(safeId);
    if (cloudTime === undefined || localTime > cloudTime) {
      await saveDonationToCloud(don, user);
      uploaded++;
    }
  }

  return { uploaded };
}
