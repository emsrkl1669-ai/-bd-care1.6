/**
 * Security Rules Verification Suite (Phase 0 - Payload-First Security TDD)
 * Documents and validates the 12 "Dirty Dozen" adversarial payloads against firestore.rules.
 * Note: Standalone TypeScript definitions so project typechecking remains dependency-free.
 */

export interface SecurityTestCase {
  id: number;
  name: string;
  collectionPath: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  auth: { uid: string; email: string; email_verified: boolean } | null;
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED' | 'ALLOWED';
}

export const DIRTY_DOZEN_TESTS: SecurityTestCase[] = [
  {
    id: 1,
    name: 'Unauthenticated Read of Patient PII',
    collectionPath: 'patients/pt_1',
    operation: 'get',
    auth: null,
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Unverified Email Admin Spoof',
    collectionPath: 'patients/pt_1',
    operation: 'create',
    auth: { uid: 'attacker_1', email: 'emsrkl1669@gmail.com', email_verified: false },
    payload: { id: 'pt_1', ownerUid: 'attacker_1', code: 'BDC-69-001', fullName: 'Test' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Privilege Escalation into /admins',
    collectionPath: 'admins/attacker_1',
    operation: 'create',
    auth: { uid: 'attacker_1', email: 'evil@example.com', email_verified: true },
    payload: { uid: 'attacker_1', email: 'evil@example.com', role: 'superadmin' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Identity Spoofing on Patient Create',
    collectionPath: 'patients/pt_2',
    operation: 'create',
    auth: { uid: 'user_a', email: 'usera@example.com', email_verified: true },
    payload: { id: 'pt_2', ownerUid: 'victim_uid', code: 'BDC-69-002', fullName: 'Patient A' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Owner Hijack on Update',
    collectionPath: 'patients/pt_2',
    operation: 'update',
    auth: { uid: 'user_a', email: 'usera@example.com', email_verified: true },
    payload: { ownerUid: 'other_uid' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Shadow Ghost Field Injection',
    collectionPath: 'patients/pt_3',
    operation: 'create',
    auth: { uid: 'user_a', email: 'usera@example.com', email_verified: true },
    payload: { id: 'pt_3', ownerUid: 'user_a', isVerifiedAdmin: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Document ID Poisoning',
    collectionPath: 'patients/bad.id$with*illegal!chars',
    operation: 'create',
    auth: { uid: 'user_a', email: 'usera@example.com', email_verified: true },
    payload: { id: 'bad.id', ownerUid: 'user_a' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Oversized String Value Poisoning',
    collectionPath: 'patients/pt_4',
    operation: 'update',
    auth: { uid: 'user_a', email: 'usera@example.com', email_verified: true },
    payload: { landmarkNote: 'X'.repeat(50000) },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Timestamp Tampering on Create',
    collectionPath: 'funerals/fn_1',
    operation: 'create',
    auth: { uid: 'user_a', email: 'usera@example.com', email_verified: true },
    payload: { id: 'fn_1', ownerUid: 'user_a', serverCreatedAt: '2020-01-01T00:00:00Z' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Immutable Field Mutation (createdAt)',
    collectionPath: 'funerals/fn_1',
    operation: 'update',
    auth: { uid: 'user_a', email: 'usera@example.com', email_verified: true },
    payload: { createdAt: '1999-01-01T00:00:00Z' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Orphaned Subcollection Delivery Write',
    collectionPath: 'patients/non_existent_patient/deliveries/del_1',
    operation: 'create',
    auth: { uid: 'user_a', email: 'usera@example.com', email_verified: true },
    payload: { id: 'del_1', patientId: 'non_existent_patient', ownerUid: 'user_a' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Blanket Collection List Query Scraping',
    collectionPath: 'patients',
    operation: 'list',
    auth: { uid: 'random_user', email: 'random@example.com', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
  },
];
