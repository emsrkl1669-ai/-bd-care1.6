# BD-Care Security Specification (Firestore Zero-Trust Architecture)

## 1. Data Invariants
1. **Authentication & Verification Required**: All reads and writes require `request.auth != null && request.auth.token.email_verified == true`.
2. **Ownership & Role Integrity**:
   - Super Admin is bootstrapped exclusively from verified email `emsrkl1669@gmail.com`.
   - Additional staff permissions live in `/admins/{uid}` and may only be created, updated, or deleted by the Super Admin.
   - Every root record in `/patients/{patientId}`, `/funerals/{funeralId}`, and `/donations/{donationId}` MUST contain an immutable `ownerUid` matching `request.auth.uid` on creation.
3. **Master Gate on Subcollections**:
   - Subcollection documents (`/patients/{patientId}/deliveries/{deliveryId}`, `/patients/{patientId}/media/{mediaId}`, `/funerals/{funeralId}/media/{mediaId}`, `/donations/{donationId}/media/{mediaId}`) MUST verify parent existence and parent ownership (`get(...).data.ownerUid == request.auth.uid || isSuperAdmin()`).
4. **Temporal & Immutable Fields**:
   - `serverCreatedAt == request.time` and `serverUpdatedAt == request.time` on `create`.
   - `serverCreatedAt == resource.data.serverCreatedAt`, `ownerUid == resource.data.ownerUid`, `id == resource.data.id`, and `serverUpdatedAt == request.time` on `update`.
5. **PII & Resource Boundaries**:
   - Zero blanket reads (`allow read: if isSignedIn()` is forbidden).
   - `allow list` validates `isSuperAdmin() || resource.data.ownerUid == request.auth.uid` directly on `resource.data` without `get()`/`exists()`.
   - Every string and list enforces explicit `.size()` boundaries; all attachment binaries live in `/media/{mediaId}` subcollections bounded under 850 KB per document so no Firestore document ever hits the 1 MiB limit.
6. **Terminal State Protection**:
   - Funeral and Donation records reaching terminal states (`completed`, `rejected`, `cancelled`) block non-superadmin mutations (`isSuperAdmin()` override exists for authorized administrative corrections).

## 2. The "Dirty Dozen" Attack Payloads (All Must Return PERMISSION_DENIED)
1. **Unauthenticated Read/Write**: Read `/patients/pt_1` with `auth == null`.
2. **Unverified Email Admin Spoof**: Write `/patients/pt_1` with `{ email: 'emsrkl1669@gmail.com', email_verified: false }`.
3. **Privilege Escalation**: Non-superadmin user creates `/admins/{theirUid}` with `{ role: 'superadmin' }`.
4. **Identity Spoofing on Create**: User `uid_A` creates `/patients/pt_1` with `ownerUid: 'uid_B'`.
5. **Owner Hijack on Update**: User `uid_A` updates `/patients/pt_1` changing `ownerUid` to `'uid_B'`.
6. **Shadow / Ghost Field Injection**: Creating `/patients/pt_1` with extra unexpected key `isVerifiedAdmin: true`.
7. **ID Poisoning**: Creating `/patients/bad$id..with*invalid/chars` or > 128 chars.
8. **1 MiB Resource Exhaustion**: Writing `landmarkNote` with a 500 KB string on `/patients/pt_1`.
9. **Timestamp Tampering**: Creating `/patients/pt_1` with `serverCreatedAt` in the past instead of `request.time`.
10. **Immutable Field Modification**: Updating `createdAt` or `serverCreatedAt` on `/funerals/fn_1`.
11. **Orphaned Subcollection Write**: Creating `/patients/nonexistent_parent/deliveries/del_1` without parent document.
12. **Blanket Query Scraping**: Non-superadmin user running `collection('patients')` query without `where('ownerUid', '==', auth.uid)`.
