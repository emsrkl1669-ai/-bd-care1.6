import {
  DiaperSize,
  DonationDistributionRecord,
  DonationDocument,
  DonationOtherItem,
  DonationPhoto,
  FuneralAssistanceRecord,
  FuneralDocument,
  MobilityLevel,
  MonthlyDelivery,
  PatientDocument,
  PatientPhoto,
  PatientRecord,
  PatientStatus,
  StatusHistoryLog,
  WaterSize,
} from '../types';

export function safeNum(val: unknown, fallback: number = 0): number {
  if (val === null || val === undefined || val === '') return fallback;
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

export function safeOptNum(val: unknown): number | undefined {
  if (val === null || val === undefined || val === '') return undefined;
  const n = Number(val);
  return Number.isFinite(n) ? n : undefined;
}

export function safeCoord(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

export function asMap(val: unknown): Record<string, any> | undefined {
  if (!val || typeof val !== 'object' || Array.isArray(val)) return undefined;
  return val as Record<string, any>;
}

export function normalizeDiaperSize(val: unknown): DiaperSize {
  const s = typeof val === 'string' ? val.toUpperCase().trim() : '';
  if (s === 'S' || s === 'M' || s === 'L' || s === 'XL' || s === 'XXL' || s === 'NONE') {
    return s;
  }
  return 'NONE';
}

export function normalizeWaterSize(val: unknown): WaterSize {
  const s = typeof val === 'string' ? val.toUpperCase().trim() : '';
  if (s === '1.5L' || s === '600ML' || s === 'NONE') {
    return s;
  }
  return '1.5L';
}

export function normalizeMobility(val: unknown): MobilityLevel {
  if (val === 'bedridden' || val === 'semi_bedridden' || val === 'can_walk') return val;
  return 'bedridden';
}

export function normalizePatientStatus(val: unknown): PatientStatus {
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

export function normalizeIdAddress(
  val: unknown,
  fallback?: Record<string, any>
): PatientRecord['idAddress'] {
  const m = asMap(val) || {};
  const fb = fallback || {};
  return {
    houseNo: String(m.houseNo ?? fb.houseNo ?? ''),
    moo: typeof m.moo === 'string' ? m.moo : String(m.moo ?? fb.moo ?? ''),
    trok: typeof m.trok === 'string' ? m.trok : String(m.trok ?? fb.trok ?? ''),
    soi: typeof m.soi === 'string' ? m.soi : String(m.soi ?? fb.soi ?? ''),
    road: typeof m.road === 'string' ? m.road : String(m.road ?? fb.road ?? ''),
    subdistrict: typeof m.subdistrict === 'string' ? m.subdistrict : String(m.subdistrict ?? fb.subdistrict ?? ''),
    district:
      typeof m.district === 'string' && m.district
        ? m.district
        : typeof fb.district === 'string' && fb.district
        ? fb.district
        : 'เมืองสมุทรปราการ',
    province:
      typeof m.province === 'string' && m.province
        ? m.province
        : typeof fb.province === 'string' && fb.province
        ? fb.province
        : 'สมุทรปราการ',
  };
}

export function normalizeCurrentAddress(
  val: unknown,
  fallback?: Record<string, any>
): PatientRecord['currentAddress'] {
  const m = asMap(val) || {};
  const fb = fallback || {};
  return {
    houseNo: String(m.houseNo ?? fb.houseNo ?? ''),
    buildingVillage:
      typeof m.buildingVillage === 'string'
        ? m.buildingVillage
        : String(m.buildingVillage ?? fb.buildingVillage ?? ''),
    trok: typeof m.trok === 'string' ? m.trok : String(m.trok ?? fb.trok ?? ''),
    soi: typeof m.soi === 'string' ? m.soi : String(m.soi ?? fb.soi ?? ''),
    road: typeof m.road === 'string' ? m.road : String(m.road ?? fb.road ?? ''),
    subdistrict: typeof m.subdistrict === 'string' ? m.subdistrict : String(m.subdistrict ?? fb.subdistrict ?? ''),
    district:
      typeof m.district === 'string' && m.district
        ? m.district
        : typeof fb.district === 'string' && fb.district
        ? fb.district
        : 'เมืองสมุทรปราการ',
    province:
      typeof m.province === 'string' && m.province
        ? m.province
        : typeof fb.province === 'string' && fb.province
        ? fb.province
        : 'สมุทรปราการ',
  };
}

export function normalizeMonthlyDelivery(raw: unknown): MonthlyDelivery {
  const d = asMap(raw) || {};
  return {
    id: String(d.id || `del_${Date.now()}`),
    deliveryDate: String(d.deliveryDate || ''),
    monthYearLabel: String(d.monthYearLabel || ''),
    cashAmount: safeNum(d.cashAmount, 0),
    cashGiven: Boolean(d.cashGiven),
    diaperSize: normalizeDiaperSize(d.diaperSize),
    diaperPacks: safeNum(d.diaperPacks, 0),
    ricePacks: safeNum(d.ricePacks, 0),
    waterPacks: safeNum(d.waterPacks, 0),
    waterSize: normalizeWaterSize(d.waterSize),
    otherItems: String(d.otherItems || ''),
    receivedBy: String(d.receivedBy || ''),
    recipientRelation: String(d.recipientRelation || ''),
    officerName: String(d.officerName || ''),
    ...(typeof d.photoUrl === 'string' && d.photoUrl ? { photoUrl: d.photoUrl } : {}),
    ...(typeof d.notes === 'string' && d.notes ? { notes: d.notes } : {}),
  };
}

/**
 * Normalize a PatientRecord from any supported schema:
 * - Current grouped Cloud sub-map format (profile, location, medical, householdEconomy, assistancePlan, assessment)
 * - Legacy flat Firestore or LocalStorage/JSON backup format
 * - Incomplete/partial legacy objects missing newer optional fields
 */
export function normalizePatientRecord(
  raw: Record<string, any>,
  overrideDeliveries?: MonthlyDelivery[],
  overridePhotos?: PatientPhoto[],
  overrideDocuments?: PatientDocument[]
): PatientRecord {
  const {
    serverCreatedAt: _sc,
    serverUpdatedAt: _su,
    ownerUid: _ou,
    authorizedEmails: _ae,
    profile: rawProfile,
    caregiver: rawCaregiver,
    location: rawLocation,
    medical: rawMedical,
    householdEconomy: rawEconomy,
    assistancePlan: rawAid,
    assessment: rawAssessmentMain,
    assessmentNotes: rawAssessmentNotes,
    ...rest
  } = raw || {};

  const profile = asMap(rawProfile) || {};
  const caregiver = asMap(rawCaregiver) || {};
  const location = asMap(rawLocation) || {};
  const medical = asMap(rawMedical) || {};
  const economy = asMap(rawEconomy) || {};
  const aid = asMap(rawAid) || {};
  const assessment = asMap(rawAssessmentMain) || asMap(rawAssessmentNotes) || {};

  const disabilityMap = asMap(medical.disabilityCard ?? rest.disabilityCard) || {};
  const dimMap = asMap(assessment.dimensionScores ?? rest.dimensionScores) || {};

  const rawIdAddr = location.idAddress ?? rest.idAddress;
  const rawCurrAddr = location.currentAddress ?? rest.currentAddress;
  const idAddress = normalizeIdAddress(rawIdAddr, asMap(rawCurrAddr));
  const currentAddress = normalizeCurrentAddress(rawCurrAddr, asMap(rawIdAddr));

  const rawSpecialNeeds = medical.specialNeeds ?? rest.specialNeeds;
  const rawStatusHistory = profile.statusHistory ?? rest.statusHistory;
  const rawStatusReason = profile.statusReason ?? rest.statusReason;
  const locAccRaw = location.locationAccuracy ?? rest.locationAccuracy;

  const rawDeliveries = overrideDeliveries ?? rest.deliveries;
  const deliveries: MonthlyDelivery[] = Array.isArray(rawDeliveries)
    ? rawDeliveries.filter((item) => Boolean(item && typeof item === 'object')).map(normalizeMonthlyDelivery)
    : [];

  const rawPhotos = overridePhotos ?? rest.photos;
  const photos: PatientPhoto[] = Array.isArray(rawPhotos)
    ? rawPhotos.filter((item) => Boolean(item && typeof item === 'object'))
    : [];

  const rawDocuments = overrideDocuments ?? rest.documents;
  const documents: PatientDocument[] = Array.isArray(rawDocuments)
    ? rawDocuments.filter((item) => Boolean(item && typeof item === 'object'))
    : [];

  const safeStatusHistory: StatusHistoryLog[] | undefined = Array.isArray(rawStatusHistory)
    ? rawStatusHistory.filter(
        (h): h is StatusHistoryLog => Boolean(h && typeof h === 'object' && !Array.isArray(h))
      )
    : undefined;

  return {
    ...(rest as PatientRecord),
    id: String(rest.id || ''),
    code: String(rest.code || ''),
    admissionDate: String(profile.admissionDate ?? rest.admissionDate ?? ''),
    status: normalizePatientStatus(rest.status),
    ...(rawStatusReason !== undefined ? { statusReason: String(rawStatusReason || '') } : {}),
    ...(safeStatusHistory !== undefined ? { statusHistory: safeStatusHistory } : {}),
    nationalId: String(profile.nationalId ?? rest.nationalId ?? ''),
    title: String(profile.title ?? rest.title ?? ''),
    fullName: String(rest.fullName || 'ไม่ระบุชื่อ'),
    birthDate: String(profile.birthDate ?? rest.birthDate ?? ''),
    age: safeNum(profile.age ?? rest.age, 0),
    gender: (profile.gender ?? rest.gender) === 'หญิง' ? 'หญิง' : 'ชาย',
    phone: String(profile.phone ?? rest.phone ?? ''),
    caregiverName: String(profile.caregiverName ?? caregiver.name ?? rest.caregiverName ?? ''),
    caregiverRelation: String(
      profile.caregiverRelation ?? caregiver.relation ?? rest.caregiverRelation ?? ''
    ),
    caregiverPhone: String(profile.caregiverPhone ?? caregiver.phone ?? rest.caregiverPhone ?? ''),
    idAddress,
    isSameAddress: Boolean(location.isSameAddress ?? rest.isSameAddress ?? true),
    currentAddress,
    latitude: safeCoord(location.latitude ?? rest.latitude),
    longitude: safeCoord(location.longitude ?? rest.longitude),
    ...(safeOptNum(locAccRaw) !== undefined ? { locationAccuracy: safeOptNum(locAccRaw) } : {}),
    landmarkNote: String(location.landmarkNote ?? rest.landmarkNote ?? ''),
    googleMapsUrl: String(location.googleMapsUrl ?? rest.googleMapsUrl ?? ''),
    qrCodeDataUrl: String(location.qrCodeDataUrl ?? rest.qrCodeDataUrl ?? ''),
    mobilityLevel: normalizeMobility(rest.mobilityLevel),
    chronicDiseases: String(medical.chronicDiseases ?? rest.chronicDiseases ?? ''),
    symptomsDetail: String(medical.symptomsDetail ?? rest.symptomsDetail ?? ''),
    disabilityCard: {
      hasCard: Boolean(disabilityMap.hasCard),
      type: typeof disabilityMap.type === 'string' ? disabilityMap.type : '',
      cardNumber: typeof disabilityMap.cardNumber === 'string' ? disabilityMap.cardNumber : '',
    },
    specialNeeds: Array.isArray(rawSpecialNeeds) ? rawSpecialNeeds.map((x) => String(x || '')).filter(Boolean) : [],
    familyMembersTotal: safeNum(economy.familyMembersTotal ?? rest.familyMembersTotal, 0),
    familyMembersMale: safeNum(economy.familyMembersMale ?? rest.familyMembersMale, 0),
    familyMembersFemale: safeNum(economy.familyMembersFemale ?? rest.familyMembersFemale, 0),
    incomeSalary: safeNum(economy.incomeSalary ?? rest.incomeSalary, 0),
    incomeDisability: safeNum(economy.incomeDisability ?? rest.incomeDisability, 0),
    incomeElderly: safeNum(economy.incomeElderly ?? rest.incomeElderly, 0),
    incomeStateWelfare: safeNum(economy.incomeStateWelfare ?? rest.incomeStateWelfare, 0),
    incomeOther: safeNum(economy.incomeOther ?? rest.incomeOther, 0),
    expenseRentHouse: safeOptNum(economy.expenseRentHouse ?? rest.expenseRentHouse),
    expenseRentLand: safeOptNum(economy.expenseRentLand ?? rest.expenseRentLand),
    expenseLiving: safeOptNum(economy.expenseLiving ?? rest.expenseLiving),
    expenseMedicalTravel: safeOptNum(economy.expenseMedicalTravel ?? rest.expenseMedicalTravel),
    expenseDebt: safeOptNum(economy.expenseDebt ?? rest.expenseDebt),
    expenseOther: safeOptNum(economy.expenseOther ?? rest.expenseOther),
    monthlyExpense: safeNum(economy.monthlyExpense ?? rest.monthlyExpense, 0),
    netIncome: safeNum(economy.netIncome ?? rest.netIncome, 0),
    economicNote: String(economy.economicNote ?? rest.economicNote ?? ''),
    helpCashEnabled: Boolean(aid.helpCashEnabled ?? rest.helpCashEnabled),
    helpCashAmount: safeNum(aid.helpCashAmount ?? rest.helpCashAmount, 0),
    helpDiaperSize: normalizeDiaperSize(aid.helpDiaperSize ?? rest.helpDiaperSize),
    helpDiaperPacks: safeNum(aid.helpDiaperPacks ?? rest.helpDiaperPacks, 0),
    helpRicePacks: safeNum(aid.helpRicePacks ?? rest.helpRicePacks, 0),
    helpWaterSize: normalizeWaterSize(aid.helpWaterSize ?? rest.helpWaterSize),
    helpWaterPacks: safeNum(aid.helpWaterPacks ?? rest.helpWaterPacks, 0),
    helpOtherSupplies: String(aid.helpOtherSupplies ?? rest.helpOtherSupplies ?? ''),
    vulnerabilityScore: safeNum(assessment.vulnerabilityScore ?? rest.vulnerabilityScore, 0),
    vulnerabilityLevel: String(assessment.vulnerabilityLevel ?? rest.vulnerabilityLevel ?? ''),
    dimensionScores: {
      mobilityScore: safeNum(dimMap.mobilityScore, 0),
      complicationsScore: safeNum(dimMap.complicationsScore, 0),
      economicScore: safeNum(dimMap.economicScore, 0),
      caregiverScore: safeNum(dimMap.caregiverScore, 0),
    },
    socialWorkerOpinion: String(assessment.socialWorkerOpinion ?? rest.socialWorkerOpinion ?? ''),
    aiSuggestions: String(assessment.aiSuggestions ?? rest.aiSuggestions ?? ''),
    interviewerName: String(assessment.interviewerName ?? rest.interviewerName ?? ''),
    interviewerPosition: String(assessment.interviewerPosition ?? rest.interviewerPosition ?? ''),
    approverName: String(assessment.approverName ?? rest.approverName ?? ''),
    approverPosition: String(assessment.approverPosition ?? rest.approverPosition ?? ''),
    presidentName: String(assessment.presidentName ?? rest.presidentName ?? ''),
    presidentPosition: String(assessment.presidentPosition ?? rest.presidentPosition ?? ''),
    deliveries,
    photos,
    documents,
    createdAt: String(rest.createdAt || ''),
    updatedAt: String(rest.updatedAt || rest.createdAt || ''),
  };
}

export function normalizeFuneralRecord(
  raw: Record<string, any>,
  overrideDocuments?: FuneralDocument[]
): FuneralAssistanceRecord {
  const {
    serverCreatedAt: _sc,
    serverUpdatedAt: _su,
    ownerUid: _ou,
    authorizedEmails: _ae,
    deceasedInfo: rawDeceased,
    applicantInfo: rawApplicant,
    cremationAid: rawAid,
    signatories: rawSignatories,
    ...rest
  } = raw || {};

  const deceasedInfo = asMap(rawDeceased) || {};
  const applicantInfo = asMap(rawApplicant) || {};
  const cremationAid = asMap(rawAid) || {};
  const signatories = asMap(rawSignatories) || {};

  const safeStatus =
    rest.status === 'pending' ||
    rest.status === 'approved' ||
    rest.status === 'completed' ||
    rest.status === 'rejected'
      ? rest.status
      : 'pending';

  const optStr = (val: unknown): string | undefined =>
    val === undefined || val === null || val === '' ? undefined : String(val);

  const rawDocuments = overrideDocuments ?? rest.documents;
  const documents: FuneralDocument[] = Array.isArray(rawDocuments)
    ? rawDocuments.filter((item) => Boolean(item && typeof item === 'object'))
    : [];

  return {
    ...(rest as FuneralAssistanceRecord),
    id: String(rest.id || ''),
    code: String(rest.code || ''),
    applicationDate: String(rest.applicationDate || ''),
    status: safeStatus,
    ...(rest.statusNote !== undefined ? { statusNote: String(rest.statusNote || '') } : {}),
    deceasedTitle: String(deceasedInfo.deceasedTitle ?? rest.deceasedTitle ?? ''),
    deceasedName: String(rest.deceasedName || 'ไม่ระบุชื่อ'),
    deceasedNationalId: String(deceasedInfo.deceasedNationalId ?? rest.deceasedNationalId ?? ''),
    deceasedAge: safeNum(deceasedInfo.deceasedAge ?? rest.deceasedAge, 0),
    deceasedDeathDate: String(deceasedInfo.deceasedDeathDate ?? rest.deceasedDeathDate ?? ''),
    deceasedDeathTime: String(deceasedInfo.deceasedDeathTime ?? rest.deceasedDeathTime ?? ''),
    causeOfDeath: String(deceasedInfo.causeOfDeath ?? rest.causeOfDeath ?? ''),
    deathPlace: String(deceasedInfo.deathPlace ?? rest.deathPlace ?? ''),
    deceasedAddress: String(deceasedInfo.deceasedAddress ?? rest.deceasedAddress ?? ''),
    applicantTitle: String(applicantInfo.applicantTitle ?? rest.applicantTitle ?? ''),
    applicantName: String(rest.applicantName || 'ไม่ระบุชื่อ'),
    applicantNationalId: String(applicantInfo.applicantNationalId ?? rest.applicantNationalId ?? ''),
    applicantPhone: String(applicantInfo.applicantPhone ?? rest.applicantPhone ?? ''),
    applicantRelation: String(applicantInfo.applicantRelation ?? rest.applicantRelation ?? ''),
    applicantAddress: String(applicantInfo.applicantAddress ?? rest.applicantAddress ?? ''),
    applicantPovertyReason: String(
      applicantInfo.applicantPovertyReason ?? rest.applicantPovertyReason ?? ''
    ),
    templeName: String(cremationAid.templeName ?? rest.templeName ?? ''),
    cremationDate: String(cremationAid.cremationDate ?? rest.cremationDate ?? ''),
    cremationTime: String(cremationAid.cremationTime ?? rest.cremationTime ?? ''),
    assistanceAmount: safeNum(cremationAid.assistanceAmount ?? rest.assistanceAmount, 0),
    coffinProvided: Boolean(cremationAid.coffinProvided ?? rest.coffinProvided),
    transportProvided: Boolean(cremationAid.transportProvided ?? rest.transportProvided),
    shroudClothProvided: Boolean(cremationAid.shroudClothProvided ?? rest.shroudClothProvided),
    otherItems: String(cremationAid.otherItems ?? rest.otherItems ?? ''),
    officerId: String(signatories.officerId ?? rest.officerId ?? ''),
    officerName: String(signatories.officerName ?? rest.officerName ?? ''),
    officerPosition: String(signatories.officerPosition ?? rest.officerPosition ?? ''),
    ...(optStr(signatories.approverId ?? rest.approverId) !== undefined
      ? { approverId: optStr(signatories.approverId ?? rest.approverId) }
      : {}),
    approverName: String(signatories.approverName ?? rest.approverName ?? ''),
    approverPosition: String(signatories.approverPosition ?? rest.approverPosition ?? ''),
    ...(optStr(signatories.approvalDate ?? rest.approvalDate) !== undefined
      ? { approvalDate: optStr(signatories.approvalDate ?? rest.approvalDate) }
      : {}),
    documents,
    createdAt: String(rest.createdAt || ''),
    updatedAt: String(rest.updatedAt || rest.createdAt || ''),
  };
}

export function normalizeDonationRecord(
  raw: Record<string, any>,
  overridePhotos?: DonationPhoto[],
  overrideDocuments?: DonationDocument[]
): DonationDistributionRecord {
  const {
    serverCreatedAt: _sc,
    serverUpdatedAt: _su,
    ownerUid: _ou,
    authorizedEmails: _ae,
    recipientInfo: rawRecipient,
    itemsSummary: rawItems,
    handoverAndSignatories: rawHandover,
    ...rest
  } = raw || {};

  const recipientInfo = asMap(rawRecipient) || {};
  const itemsSummary = asMap(rawItems) || {};
  const handover = asMap(rawHandover) || {};

  const safeStatus =
    rest.status === 'completed' || rest.status === 'pending' || rest.status === 'cancelled'
      ? rest.status
      : 'completed';
  const safeRecipientType =
    rest.recipientType === 'individual' || rest.recipientType === 'government'
      ? rest.recipientType
      : 'individual';

  const rawOtherItems = itemsSummary.otherItems ?? rest.otherItems;
  const otherItems: DonationOtherItem[] = Array.isArray(rawOtherItems)
    ? rawOtherItems
        .filter((item) => Boolean(item && typeof item === 'object'))
        .map((item, idx) => ({
          id: String(item.id || `item_${idx}`),
          name: String(item.name || ''),
          quantity: safeNum(item.quantity, 0),
          unit: String(item.unit || ''),
        }))
    : [];

  const rawPhotos = overridePhotos ?? rest.photos;
  const photos: DonationPhoto[] = Array.isArray(rawPhotos)
    ? rawPhotos.filter((item) => Boolean(item && typeof item === 'object'))
    : [];

  const rawDocuments = overrideDocuments ?? rest.documents;
  const documents: DonationDocument[] = Array.isArray(rawDocuments)
    ? rawDocuments.filter((item) => Boolean(item && typeof item === 'object'))
    : [];

  return {
    ...(rest as DonationDistributionRecord),
    id: String(rest.id || ''),
    code: String(rest.code || ''),
    distributionDate: String(rest.distributionDate || ''),
    status: safeStatus,
    recipientType: safeRecipientType,
    individualTitle: String(recipientInfo.individualTitle ?? rest.individualTitle ?? ''),
    individualName: String(recipientInfo.individualName ?? rest.individualName ?? ''),
    individualNationalId: String(
      recipientInfo.individualNationalId ?? rest.individualNationalId ?? ''
    ),
    individualPhone: String(recipientInfo.individualPhone ?? rest.individualPhone ?? ''),
    individualAddress: String(recipientInfo.individualAddress ?? rest.individualAddress ?? ''),
    individualCategory: String(recipientInfo.individualCategory ?? rest.individualCategory ?? ''),
    individualNeedReason: String(
      recipientInfo.individualNeedReason ?? rest.individualNeedReason ?? ''
    ),
    agencyName: String(recipientInfo.agencyName ?? rest.agencyName ?? ''),
    agencyType: String(recipientInfo.agencyType ?? rest.agencyType ?? ''),
    agencyContactPerson: String(
      recipientInfo.agencyContactPerson ?? rest.agencyContactPerson ?? ''
    ),
    agencyContactPosition: String(
      recipientInfo.agencyContactPosition ?? rest.agencyContactPosition ?? ''
    ),
    agencyPhone: String(recipientInfo.agencyPhone ?? rest.agencyPhone ?? ''),
    agencyAddress: String(recipientInfo.agencyAddress ?? rest.agencyAddress ?? ''),
    agencyRequestPurpose: String(
      recipientInfo.agencyRequestPurpose ?? rest.agencyRequestPurpose ?? ''
    ),
    officialLetterNo: String(recipientInfo.officialLetterNo ?? rest.officialLetterNo ?? ''),
    waterPacks: safeNum(itemsSummary.waterPacks ?? rest.waterPacks, 0),
    waterUnit: String(itemsSummary.waterUnit ?? rest.waterUnit ?? 'แพ็ค'),
    dryFoodCount: safeNum(itemsSummary.dryFoodCount ?? rest.dryFoodCount, 0),
    dryFoodUnit: String(itemsSummary.dryFoodUnit ?? rest.dryFoodUnit ?? 'ชุด'),
    riceBags: safeNum(itemsSummary.riceBags ?? rest.riceBags, 0),
    riceKg: safeNum(itemsSummary.riceKg ?? rest.riceKg, 0),
    diaperPacks: safeNum(itemsSummary.diaperPacks ?? rest.diaperPacks, 0),
    diaperSize: String(itemsSummary.diaperSize ?? rest.diaperSize ?? ''),
    otherItems,
    notes: String(itemsSummary.notes ?? rest.notes ?? ''),
    handoverPlace: String(handover.handoverPlace ?? rest.handoverPlace ?? ''),
    deliveryMethod: String(handover.deliveryMethod ?? rest.deliveryMethod ?? ''),
    officerId: String(handover.officerId ?? rest.officerId ?? ''),
    officerName: String(handover.officerName ?? rest.officerName ?? ''),
    officerPosition: String(handover.officerPosition ?? rest.officerPosition ?? ''),
    approverName: String(handover.approverName ?? rest.approverName ?? ''),
    approverPosition: String(handover.approverPosition ?? rest.approverPosition ?? ''),
    photos,
    documents,
    createdAt: String(rest.createdAt || ''),
    updatedAt: String(rest.updatedAt || rest.createdAt || ''),
  };
}

function mergeStatusHistory(
  existing?: StatusHistoryLog[],
  incoming?: StatusHistoryLog[]
): StatusHistoryLog[] | undefined {
  const combined = [...(existing || []), ...(incoming || [])];
  if (combined.length === 0) return undefined;
  const seen = new Set<string>();
  const deduped: StatusHistoryLog[] = [];
  for (const h of combined) {
    const key = `${h.changeDate}|${h.previousStatus}|${h.newStatus}|${h.reason}|${h.officerName}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(h);
    }
  }
  return deduped;
}

/**
 * Safely merge existing Cloud/Local PatientRecord with incoming edits so omitted or legacy fields are never lost.
 */
export function mergePatientRecordsForUpdate(
  existingNormalized: PatientRecord,
  incoming: PatientRecord
): PatientRecord {
  const mergedHistory = mergeStatusHistory(
    existingNormalized.statusHistory,
    incoming.statusHistory
  );

  return normalizePatientRecord({
    ...existingNormalized,
    ...incoming,
    id: incoming.id || existingNormalized.id,
    createdAt: existingNormalized.createdAt || incoming.createdAt,
    qrCodeDataUrl: incoming.qrCodeDataUrl || existingNormalized.qrCodeDataUrl || '',
    idAddress: {
      ...existingNormalized.idAddress,
      ...(incoming.idAddress || {}),
    },
    currentAddress: {
      ...existingNormalized.currentAddress,
      ...(incoming.currentAddress || {}),
    },
    disabilityCard: {
      ...existingNormalized.disabilityCard,
      ...(incoming.disabilityCard || {}),
    },
    dimensionScores: {
      ...(existingNormalized.dimensionScores || {
        mobilityScore: 0,
        complicationsScore: 0,
        economicScore: 0,
        caregiverScore: 0,
      }),
      ...(incoming.dimensionScores || {}),
    },
    ...(mergedHistory ? { statusHistory: mergedHistory } : {}),
  });
}

export function mergeFuneralRecordsForUpdate(
  existingNormalized: FuneralAssistanceRecord,
  incoming: FuneralAssistanceRecord
): FuneralAssistanceRecord {
  return normalizeFuneralRecord({
    ...existingNormalized,
    ...incoming,
    id: incoming.id || existingNormalized.id,
    createdAt: existingNormalized.createdAt || incoming.createdAt,
  });
}

export function mergeDonationRecordsForUpdate(
  existingNormalized: DonationDistributionRecord,
  incoming: DonationDistributionRecord
): DonationDistributionRecord {
  return normalizeDonationRecord({
    ...existingNormalized,
    ...incoming,
    id: incoming.id || existingNormalized.id,
    createdAt: existingNormalized.createdAt || incoming.createdAt,
  });
}
