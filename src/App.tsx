import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User } from 'firebase/auth';
import {
  Cloud,
  CloudOff,
  AlertTriangle,
  RefreshCw,
  UserPlus,
  Check,
  Clock,
  ShieldCheck,
  LogOut,
  Lock,
  User as UserIcon,
  Key,
  Eye,
  EyeOff,
  ExternalLink,
} from 'lucide-react';
import {
  ADMIN_USERS,
  AdminUser,
  PatientRecord,
  PatientStatus,
  MonthlyDelivery,
  StatusHistoryLog,
  FuneralAssistanceRecord,
  DonationDistributionRecord,
  DeliveryPlanSettings,
  AccessRequestRecord,
} from './types';
import {
  getStoredPatients,
  saveStoredPatients,
  clearAllStoredPatients,
  getRecoveryPatients,
  getStoredFunerals,
  saveStoredFunerals,
  clearAllStoredFunerals,
  getRecoveryFunerals,
  getStoredDonations,
  saveStoredDonations,
  clearAllStoredDonations,
  getRecoveryDonations,
  getStoredAdminId,
  saveStoredAdminId,
  getStoredDeliverySettings,
  saveStoredDeliverySettings,
  getStoredAuthorizedEmails,
  getPendingOps,
  markPendingUpsert,
  clearPendingUpsert,
  markPendingDelete,
  clearPendingDelete,
  setPendingDeliverySettings,
  clearAllPendingOps,
  getKnownSyncedIds,
  addKnownSyncedIds,
  replaceKnownSyncedIds,
  removeKnownSyncedId,
  clearAllKnownSyncedIds,
  getStoredLastAuthUid,
  saveStoredLastAuthUid,
} from './utils/storage';
import { Header } from './components/Header';
import { PatientList } from './components/PatientList';
import { PatientForm } from './components/PatientForm';
import { DeliveryPlan } from './components/DeliveryPlan';
import { Dashboard } from './components/Dashboard';
import { ArchiveView } from './components/ArchiveView';
import { FuneralAssistanceView } from './components/FuneralAssistanceView';
import { DonationView } from './components/DonationView';
import { UiFeedbackProvider, useUiFeedback } from './components/UiFeedback';
import { formatThaiDate, sortPatientsByCodeAsc } from './utils/idCard';
import { sanitizeFirestoreId } from './utils/image';
import {
  SUPER_ADMIN_USERNAME,
  firebaseConfig,
  isSuperAdminUser,
  isProviderDisabledError,
  getAuthSignInErrorMessage,
  findAdminUserByAuthEmail,
  authEmailToUsername,
  subscribeToAuth,
  testFirestoreConnection,
  signInWithUsernamePassword,
  signOutFirebase,
} from './firebase';
import {
  ensureSuperAdminDirectory,
  subscribeToCloudCollections,
  syncLocalRecordsToCloud,
  pullAllFromCloudServer,
  recoverFromDefaultDatabase,
  mergeRecordsNonDestructively,
  reconcileWithCloudSnapshot,
  savePatientToCloud,
  saveDeliveryToCloud,
  saveFuneralToCloud,
  deleteFuneralFromCloud,
  saveDonationToCloud,
  deleteDonationFromCloud,
  saveDeliveryPlanSettingsToCloud,
  fetchWorkspaceAuthorizedEmails,
  saveWorkspaceAuthorizedEmails,
  registerStaffAdminMember,
  submitAccessRequest,
  subscribeToMyAccessRequest,
  subscribeToPendingAccessRequests,
  approveAccessRequest,
  rejectAccessRequest,
  verifyWorkspaceAccess,
} from './services/firestoreSync';

function AppContent() {
  const { showToast, confirmDialog } = useUiFeedback();

  const [patients, setPatients] = useState<PatientRecord[]>(() => getStoredPatients());
  const [funerals, setFunerals] = useState<FuneralAssistanceRecord[]>(() => getStoredFunerals());
  const [donations, setDonations] = useState<DonationDistributionRecord[]>(() => getStoredDonations());
  const [deliverySettings, setDeliverySettings] = useState<DeliveryPlanSettings>(() =>
    getStoredDeliverySettings()
  );
  const [authorizedEmails, setAuthorizedEmails] = useState<string[]>(() =>
    getStoredAuthorizedEmails()
  );
  const [currentTab, setCurrentTab] = useState<string>('list');
  const [editingPatient, setEditingPatient] = useState<PatientRecord | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [isCloudModalOpen, setIsCloudModalOpen] = useState<boolean>(false);

  // Firebase Auth & Sync states
  const [authInitialized, setAuthInitialized] = useState<boolean>(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [accessVerified, setAccessVerified] = useState<'checking' | 'granted' | 'denied'>('checking');
  const [cloudStatus, setCloudStatus] = useState<'disconnected' | 'syncing' | 'synced' | 'error'>('disconnected');
  const [cloudErrorReason, setCloudErrorReason] = useState<'permission-denied' | 'network' | null>(null);
  const [initialCloudLoaded, setInitialCloudLoaded] = useState<boolean>(false);
  const [cloudRefreshNonce, setCloudRefreshNonce] = useState<number>(0);
  const [myAccessRequest, setMyAccessRequest] = useState<AccessRequestRecord | null>(null);
  const [pendingAccessRequests, setPendingAccessRequests] = useState<AccessRequestRecord[]>([]);
  const [isSubmittingRequest, setIsSubmittingRequest] = useState<boolean>(false);
  const [processingReqUid, setProcessingReqUid] = useState<string | null>(null);

  // Username & Password login gate states
  const [loginUsername, setLoginUsername] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [showLoginPassword, setShowLoginPassword] = useState<boolean>(false);
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [needsEmailProviderEnable, setNeedsEmailProviderEnable] = useState<boolean>(false);

  // Refs for latest state inside async callbacks
  const patientsRef = useRef<PatientRecord[]>(patients);
  const funeralsRef = useRef<FuneralAssistanceRecord[]>(funerals);
  const donationsRef = useRef<DonationDistributionRecord[]>(donations);
  const deliverySettingsRef = useRef<DeliveryPlanSettings>(deliverySettings);
  const authorizedEmailsRef = useRef<string[]>(authorizedEmails);
  const deliverySyncTimerRef = useRef<number | null>(null);
  const autoReloadedApprovalRef = useRef<boolean>(false);

  useEffect(() => {
    patientsRef.current = patients;
  }, [patients]);

  useEffect(() => {
    funeralsRef.current = funerals;
  }, [funerals]);

  useEffect(() => {
    donationsRef.current = donations;
  }, [donations]);

  useEffect(() => {
    deliverySettingsRef.current = deliverySettings;
  }, [deliverySettings]);

  useEffect(() => {
    authorizedEmailsRef.current = authorizedEmails;
  }, [authorizedEmails]);

  // Current logged in admin / staff role
  const [currentAdmin, setCurrentAdmin] = useState<AdminUser>(() => {
    const savedId = getStoredAdminId();
    const found = ADMIN_USERS.find((u) => u.id === savedId);
    return found || ADMIN_USERS[1] || ADMIN_USERS[0];
  });

  // Track network status for offline support
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Verify Firestore connection on boot
  useEffect(() => {
    testFirestoreConnection();
  }, []);

  // Subscribe to Firebase Auth & Realtime Cloud Firestore Sync
  useEffect(() => {
    let unsubCloud: (() => void) | null = null;
    let cancelled = false;

    const unsubAuth = subscribeToAuth(async (user) => {
      setAuthInitialized(true);
      setFirebaseUser(user);
      if (unsubCloud) {
        unsubCloud();
        unsubCloud = null;
      }

      if (!user) {
        setAccessVerified('denied');
        setCloudStatus('disconnected');
        setCloudErrorReason(null);
        setInitialCloudLoaded(false);
        return;
      }

      setAccessVerified('checking');
      setCloudStatus('syncing');
      setCloudErrorReason(null);
      setInitialCloudLoaded(false);

      // On account switch, reset knownSyncedIds scope so local/unsynced records upload cleanly instead of being dropped
      const lastAuthUid = getStoredLastAuthUid();
      if (lastAuthUid && lastAuthUid !== user.uid) {
        clearAllKnownSyncedIds();
      }

      try {
        await ensureSuperAdminDirectory(user);
        const access = await verifyWorkspaceAccess(user);
        if (cancelled) return;

        if (!access.allowed) {
          setAccessVerified('denied');
          setCloudStatus('error');
          setCloudErrorReason(access.reason || 'permission-denied');
          setInitialCloudLoaded(true);
          return;
        }

        saveStoredLastAuthUid(user.uid);
        setAccessVerified('granted');
        const matchedAdmin = findAdminUserByAuthEmail(user.email);
        if (matchedAdmin) {
          setCurrentAdmin(matchedAdmin);
          saveStoredAdminId(matchedAdmin.id);
        } else {
          const uname = authEmailToUsername(user.email);
          const customAdmin: AdminUser = {
            id: `staff-${uname}`,
            username: uname,
            name: user.displayName || uname,
            roleTitle: 'เจ้าหน้าที่ BD-Care',
            position: 'เจ้าหน้าที่ปฏิบัติงาน',
            responsibility: 'บันทึกและดูแลข้อมูลผู้ป่วยในระบบ BD-Care',
            avatarColor: 'bg-sky-600',
            role: 'officer',
          };
          setCurrentAdmin(customAdmin);
          saveStoredAdminId(customAdmin.id);
        }
        const teamEmails = access.emails;
        setAuthorizedEmails(teamEmails);
        authorizedEmailsRef.current = teamEmails;

        // Recover any locally preserved snapshots (e.g. from prior session / DB transition) before syncing
        const pendingDeletes = getPendingOps().deletes;
        const recoveryPatients = getRecoveryPatients();
        if (recoveryPatients.length > 0) {
          const mergedLocalPatients = sortPatientsByCodeAsc(
            mergeRecordsNonDestructively(recoveryPatients, patientsRef.current)
          );
          patientsRef.current = mergedLocalPatients;
          setPatients(mergedLocalPatients);
          saveStoredPatients(mergedLocalPatients);
        }
        const recoveryFunerals = getRecoveryFunerals();
        if (recoveryFunerals.length > 0) {
          const mergedLocalFunerals = mergeRecordsNonDestructively(
            recoveryFunerals,
            funeralsRef.current,
            new Set(pendingDeletes.funerals)
          );
          funeralsRef.current = mergedLocalFunerals;
          setFunerals(mergedLocalFunerals);
          saveStoredFunerals(mergedLocalFunerals);
        }
        const recoveryDonations = getRecoveryDonations();
        if (recoveryDonations.length > 0) {
          const mergedLocalDonations = mergeRecordsNonDestructively(
            recoveryDonations,
            donationsRef.current,
            new Set(pendingDeletes.donations)
          );
          donationsRef.current = mergedLocalDonations;
          setDonations(mergedLocalDonations);
          saveStoredDonations(mergedLocalDonations);
        }

        // Migrate any legacy records stored on the project's (default) Firestore database
        const legacyRecovery = await recoverFromDefaultDatabase(user, teamEmails);
        if (cancelled) return;
        if (legacyRecovery.recoveredCount > 0) {
          if (legacyRecovery.recoveredPatients.length > 0) {
            const nextP = sortPatientsByCodeAsc(
              mergeRecordsNonDestructively(legacyRecovery.recoveredPatients, patientsRef.current)
            );
            patientsRef.current = nextP;
            setPatients(nextP);
            saveStoredPatients(nextP);
          }
          if (legacyRecovery.recoveredFunerals.length > 0) {
            const nextF = mergeRecordsNonDestructively(
              legacyRecovery.recoveredFunerals,
              funeralsRef.current,
              new Set(pendingDeletes.funerals)
            );
            funeralsRef.current = nextF;
            setFunerals(nextF);
            saveStoredFunerals(nextF);
          }
          if (legacyRecovery.recoveredDonations.length > 0) {
            const nextD = mergeRecordsNonDestructively(
              legacyRecovery.recoveredDonations,
              donationsRef.current,
              new Set(pendingDeletes.donations)
            );
            donationsRef.current = nextD;
            setDonations(nextD);
            saveStoredDonations(nextD);
          }
          showToast(
            `กู้คืนข้อมูลจากฐานข้อมูลเดิมสำเร็จ ${legacyRecovery.recoveredCount} รายการ`,
            'success'
          );
        }

        // Flush pending offline deletes & upload any unsynced local/recovered records first
        const migration = await syncLocalRecordsToCloud(
          user,
          patientsRef.current,
          funeralsRef.current,
          donationsRef.current,
          deliverySettingsRef.current,
          teamEmails
        );
        if (cancelled) return;

        // Immediately pull authoritative dataset from Cloud Server so all devices see identical data
        try {
          const serverSnapshot = await pullAllFromCloudServer(user, {
            patients: patientsRef.current,
            funerals: funeralsRef.current,
            donations: donationsRef.current,
          });
          if (cancelled) return;

          const latestPending = getPendingOps();
          const latestKnown = getKnownSyncedIds();

          const reconciledPatients = sortPatientsByCodeAsc(
            reconcileWithCloudSnapshot(
              serverSnapshot.patients,
              patientsRef.current,
              new Set(latestPending.upserts.patients),
              new Set(),
              new Set(latestKnown.patients),
              true
            )
          );
          patientsRef.current = reconciledPatients;
          setPatients(reconciledPatients);
          saveStoredPatients(reconciledPatients);
          replaceKnownSyncedIds('patients', serverSnapshot.patients.map((p) => p.id));

          const reconciledFunerals = reconcileWithCloudSnapshot(
            serverSnapshot.funerals,
            funeralsRef.current,
            new Set(latestPending.upserts.funerals),
            new Set(latestPending.deletes.funerals),
            new Set(latestKnown.funerals),
            true
          );
          funeralsRef.current = reconciledFunerals;
          setFunerals(reconciledFunerals);
          saveStoredFunerals(reconciledFunerals);
          replaceKnownSyncedIds('funerals', serverSnapshot.funerals.map((f) => f.id));

          const reconciledDonations = reconcileWithCloudSnapshot(
            serverSnapshot.donations,
            donationsRef.current,
            new Set(latestPending.upserts.donations),
            new Set(latestPending.deletes.donations),
            new Set(latestKnown.donations),
            true
          );
          donationsRef.current = reconciledDonations;
          setDonations(reconciledDonations);
          saveStoredDonations(reconciledDonations);
          replaceKnownSyncedIds('donations', serverSnapshot.donations.map((d) => d.id));

          if (serverSnapshot.deliverySettings && !latestPending.upserts.deliverySettings) {
            setDeliverySettings(serverSnapshot.deliverySettings);
            deliverySettingsRef.current = serverSnapshot.deliverySettings;
            saveStoredDeliverySettings(serverSnapshot.deliverySettings);
          }

          setAuthorizedEmails(serverSnapshot.authorizedEmails);
          authorizedEmailsRef.current = serverSnapshot.authorizedEmails;
          setInitialCloudLoaded(true);
          setCloudErrorReason(null);
          setCloudStatus(migration.failed > 0 ? 'error' : 'synced');
        } catch (pullErr) {
          console.warn('Initial authoritative pull deferred to real-time listener:', pullErr);
        }

        if (migration.failed > 0) {
          setCloudStatus('error');
          showToast(
            `ซิงค์ขึ้น Cloud ไม่สำเร็จ ${migration.failed} รายการ ระบบจะลองซิงค์ใหม่อัตโนมัติ`,
            'warning'
          );
        } else if (migration.uploaded > 0 || migration.deleted > 0) {
          showToast(
            `ซิงค์ข้อมูลกับ Cloud Firestore สำเร็จ (อัปโหลด ${migration.uploaded} / ลบ ${migration.deleted} รายการ)`,
            'success'
          );
        }

        unsubCloud = subscribeToCloudCollections(user, {
          getLocalPatients: () => patientsRef.current,
          getLocalFunerals: () => funeralsRef.current,
          getLocalDonations: () => donationsRef.current,
          onPatients: (cloudPatients, fromCache) => {
            const pending = getPendingOps();
            const known = getKnownSyncedIds();
            const pendingUpsertSet = new Set(pending.upserts.patients);
            const knownSet = new Set(known.patients);

            setPatients((prevLocal) => {
              const next = sortPatientsByCodeAsc(
                reconcileWithCloudSnapshot(
                  cloudPatients,
                  prevLocal,
                  pendingUpsertSet,
                  new Set(),
                  knownSet,
                  !fromCache
                )
              );
              patientsRef.current = next;
              saveStoredPatients(next);
              return next;
            });

            if (!fromCache) {
              replaceKnownSyncedIds(
                'patients',
                cloudPatients.map((p) => p.id)
              );
              setInitialCloudLoaded(true);
            }
            setCloudErrorReason(null);
            setCloudStatus('synced');
          },
          onFunerals: (cloudFunerals, fromCache) => {
            const pending = getPendingOps();
            const known = getKnownSyncedIds();
            const pendingUpsertSet = new Set(pending.upserts.funerals);
            const pendingDeleteSet = new Set(pending.deletes.funerals);
            const knownSet = new Set(known.funerals);

            setFunerals((prevLocal) => {
              const next = reconcileWithCloudSnapshot(
                cloudFunerals,
                prevLocal,
                pendingUpsertSet,
                pendingDeleteSet,
                knownSet,
                !fromCache
              );
              funeralsRef.current = next;
              saveStoredFunerals(next);
              return next;
            });

            if (!fromCache) {
              replaceKnownSyncedIds(
                'funerals',
                cloudFunerals.map((f) => f.id)
              );
              setInitialCloudLoaded(true);
            }
            setCloudErrorReason(null);
            setCloudStatus('synced');
          },
          onDonations: (cloudDonations, fromCache) => {
            const pending = getPendingOps();
            const known = getKnownSyncedIds();
            const pendingUpsertSet = new Set(pending.upserts.donations);
            const pendingDeleteSet = new Set(pending.deletes.donations);
            const knownSet = new Set(known.donations);

            setDonations((prevLocal) => {
              const next = reconcileWithCloudSnapshot(
                cloudDonations,
                prevLocal,
                pendingUpsertSet,
                pendingDeleteSet,
                knownSet,
                !fromCache
              );
              donationsRef.current = next;
              saveStoredDonations(next);
              return next;
            });

            if (!fromCache) {
              replaceKnownSyncedIds(
                'donations',
                cloudDonations.map((d) => d.id)
              );
              setInitialCloudLoaded(true);
            }
            setCloudErrorReason(null);
            setCloudStatus('synced');
          },
          onDeliverySettings: (cloudSettings, fromCache) => {
            const pending = getPendingOps();
            if (!pending.upserts.deliverySettings) {
              setDeliverySettings(cloudSettings);
              deliverySettingsRef.current = cloudSettings;
              saveStoredDeliverySettings(cloudSettings);
            } else if (!fromCache) {
              const cloudTime = Date.parse(cloudSettings.updatedAt || '') || 0;
              const localTime = Date.parse(deliverySettingsRef.current.updatedAt || '') || 0;
              if (cloudTime > localTime) {
                setDeliverySettings(cloudSettings);
                deliverySettingsRef.current = cloudSettings;
                saveStoredDeliverySettings(cloudSettings);
                setPendingDeliverySettings(false);
              }
            }
          },
          onAuthorizedEmails: (emails) => {
            setAuthorizedEmails(emails);
            authorizedEmailsRef.current = emails;
          },
          onError: (errDetail) => {
            setCloudStatus('error');
            setCloudErrorReason(errDetail.isPermissionError ? 'permission-denied' : 'network');
            if (errDetail.isPermissionError) {
              setAccessVerified('denied');
            }
            setInitialCloudLoaded(true);
          },
        });
      } catch (err: any) {
        if (cancelled) return;
        console.error('Firebase sync initialization failed:', err);
        const msg = err instanceof Error ? err.message : String(err);
        const isPerm =
          msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('insufficient');
        setAccessVerified('denied');
        setCloudStatus('error');
        setCloudErrorReason(isPerm ? 'permission-denied' : 'network');
        setInitialCloudLoaded(true);
      }
    });

    return () => {
      cancelled = true;
      unsubAuth();
      if (unsubCloud) unsubCloud();
    };
  }, [showToast, cloudRefreshNonce]);

  // Subscribe to cross-device access request status (requester vs Super Admin)
  useEffect(() => {
    if (!firebaseUser) {
      setMyAccessRequest(null);
      setPendingAccessRequests([]);
      autoReloadedApprovalRef.current = false;
      return;
    }
    if (isSuperAdminUser(firebaseUser)) {
      setMyAccessRequest(null);
      return subscribeToPendingAccessRequests(firebaseUser, (reqs) => {
        setPendingAccessRequests(reqs);
      });
    }
    setPendingAccessRequests([]);
    return subscribeToMyAccessRequest(firebaseUser, (req) => {
      setMyAccessRequest(req);
    });
  }, [firebaseUser]);

  // Automatically unlock & reload cloud data as soon as Super Admin approves this device
  useEffect(() => {
    if (!firebaseUser || myAccessRequest?.status !== 'approved') {
      autoReloadedApprovalRef.current = false;
      return;
    }
    if ((cloudErrorReason === 'permission-denied' || accessVerified === 'denied') && !autoReloadedApprovalRef.current) {
      autoReloadedApprovalRef.current = true;
      showToast('ผู้ดูแลระบบอนุมัติสิทธิ์แล้ว กำลังโหลดข้อมูลทั้งหมดจาก Cloud...', 'success');
      setCloudRefreshNonce((n) => n + 1);
    }
  }, [firebaseUser, myAccessRequest?.status, cloudErrorReason, accessVerified, showToast]);

  // Auto-flush queued offline operations on reconnect & periodically retry pending sync
  useEffect(() => {
    if (!isOnline || !firebaseUser || accessVerified !== 'granted') return;

    const flushPending = async (silent: boolean) => {
      const pending = getPendingOps();
      const hasPending =
        pending.upserts.patients.length > 0 ||
        pending.upserts.funerals.length > 0 ||
        pending.upserts.donations.length > 0 ||
        pending.upserts.deliverySettings ||
        pending.deletes.funerals.length > 0 ||
        pending.deletes.donations.length > 0;

      if (!hasPending) return;

      setCloudStatus('syncing');
      try {
        const latestEmails = await fetchWorkspaceAuthorizedEmails(firebaseUser);
        setAuthorizedEmails(latestEmails);
        authorizedEmailsRef.current = latestEmails;

        const res = await syncLocalRecordsToCloud(
          firebaseUser,
          patientsRef.current,
          funeralsRef.current,
          donationsRef.current,
          deliverySettingsRef.current,
          latestEmails
        );
        if (res.failed > 0) {
          setCloudStatus('error');
          if (!silent) {
            showToast(
              `ซิงค์รายการที่ค้างอยู่ไม่สำเร็จ ${res.failed} รายการ ระบบจะลองซิงค์ใหม่อัตโนมัติ`,
              'warning'
            );
          }
        } else {
          setCloudStatus('synced');
          setCloudErrorReason(null);
          if (res.uploaded > 0 || res.deleted > 0) {
            showToast(
              `ซิงค์รายการที่ค้างอยู่ขึ้น Cloud สำเร็จ (${res.uploaded + res.deleted} รายการ)`,
              'success'
            );
          }
        }
      } catch {
        setCloudStatus('error');
      }
    };

    void flushPending(false);
    const intervalId = window.setInterval(() => {
      void flushPending(true);
    }, 15000);

    return () => window.clearInterval(intervalId);
  }, [isOnline, firebaseUser, accessVerified, showToast]);

  const handleUsernamePasswordLogin = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const uname = loginUsername.trim();
      if (!uname || !loginPassword) {
        setLoginError('กรุณากรอกชื่อผู้ใช้งาน (Username) และรหัสผ่าน (Password) ให้ครบถ้วน');
        return;
      }
      setIsSigningIn(true);
      setLoginError(null);
      setNeedsEmailProviderEnable(false);
      try {
        const user = await signInWithUsernamePassword(uname, loginPassword);
        setLoginPassword('');
        showToast(
          `เข้าสู่ระบบสำเร็จ: ${user.displayName || authEmailToUsername(user.email)}`,
          'success'
        );
      } catch (err: any) {
        setNeedsEmailProviderEnable(isProviderDisabledError(err));
        setLoginError(getAuthSignInErrorMessage(err));
      } finally {
        setIsSigningIn(false);
      }
    },
    [loginUsername, loginPassword, showToast]
  );

  const handleSwitchUserAccount = useCallback(
    async (username: string, password: string) => {
      const user = await signInWithUsernamePassword(username, password);
      showToast(
        `สลับบัญชีผู้ใช้งานสำเร็จ: ${user.displayName || authEmailToUsername(user.email)}`,
        'success'
      );
    },
    [showToast]
  );

  const handleCloudSignOut = useCallback(async () => {
    try {
      const pending = getPendingOps();
      const hasPending =
        pending.upserts.patients.length > 0 ||
        pending.upserts.funerals.length > 0 ||
        pending.upserts.donations.length > 0 ||
        pending.upserts.deliverySettings ||
        pending.deletes.funerals.length > 0 ||
        pending.deletes.donations.length > 0;

      await signOutFirebase();

      if (!hasPending) {
        clearAllStoredPatients();
        clearAllStoredFunerals();
        clearAllStoredDonations();
        clearAllKnownSyncedIds();
        saveStoredLastAuthUid(null);
      }
      patientsRef.current = [];
      funeralsRef.current = [];
      donationsRef.current = [];
      setPatients([]);
      setFunerals([]);
      setDonations([]);
      setEditingPatient(null);
      showToast('ออกจากระบบแล้ว', 'info');
    } catch {
      showToast('เกิดข้อผิดพลาดในการออกจากระบบ', 'error');
    }
  }, [showToast]);

  const handleManualCloudSync = useCallback(async () => {
    if (!firebaseUser) {
      setIsCloudModalOpen(true);
      return;
    }
    setCloudStatus('syncing');
    try {
      const teamEmails = await fetchWorkspaceAuthorizedEmails(firebaseUser);
      setAuthorizedEmails(teamEmails);
      authorizedEmailsRef.current = teamEmails;

      // Include local recovery snapshot patients if any are missing from state
      const pendingDeletes = getPendingOps().deletes;
      const recoveryPatients = getRecoveryPatients();
      if (recoveryPatients.length > 0) {
        const mergedLocal = sortPatientsByCodeAsc(
          mergeRecordsNonDestructively(recoveryPatients, patientsRef.current)
        );
        patientsRef.current = mergedLocal;
        setPatients(mergedLocal);
        saveStoredPatients(mergedLocal);
      }

      // Check (default) Firestore DB for any legacy unmigrated records
      const legacyRecovery = await recoverFromDefaultDatabase(firebaseUser, teamEmails);
      if (legacyRecovery.recoveredPatients.length > 0) {
        const mergedP = sortPatientsByCodeAsc(
          mergeRecordsNonDestructively(legacyRecovery.recoveredPatients, patientsRef.current)
        );
        patientsRef.current = mergedP;
        setPatients(mergedP);
        saveStoredPatients(mergedP);
      }
      if (legacyRecovery.recoveredFunerals.length > 0) {
        const mergedF = mergeRecordsNonDestructively(
          legacyRecovery.recoveredFunerals,
          funeralsRef.current,
          new Set(pendingDeletes.funerals)
        );
        funeralsRef.current = mergedF;
        setFunerals(mergedF);
        saveStoredFunerals(mergedF);
      }
      if (legacyRecovery.recoveredDonations.length > 0) {
        const mergedD = mergeRecordsNonDestructively(
          legacyRecovery.recoveredDonations,
          donationsRef.current,
          new Set(pendingDeletes.donations)
        );
        donationsRef.current = mergedD;
        setDonations(mergedD);
        saveStoredDonations(mergedD);
      }

      const res = await syncLocalRecordsToCloud(
        firebaseUser,
        patientsRef.current,
        funeralsRef.current,
        donationsRef.current,
        deliverySettingsRef.current,
        teamEmails
      );

      // Pull fresh authoritative server data so this device immediately matches all other devices
      const serverSnapshot = await pullAllFromCloudServer(firebaseUser, {
        patients: patientsRef.current,
        funerals: funeralsRef.current,
        donations: donationsRef.current,
      });

      const latestPending = getPendingOps();
      const latestKnown = getKnownSyncedIds();

      const nextPatients = sortPatientsByCodeAsc(
        reconcileWithCloudSnapshot(
          serverSnapshot.patients,
          patientsRef.current,
          new Set(latestPending.upserts.patients),
          new Set(),
          new Set(latestKnown.patients),
          true
        )
      );
      patientsRef.current = nextPatients;
      setPatients(nextPatients);
      saveStoredPatients(nextPatients);
      replaceKnownSyncedIds('patients', serverSnapshot.patients.map((p) => p.id));

      const nextFunerals = reconcileWithCloudSnapshot(
        serverSnapshot.funerals,
        funeralsRef.current,
        new Set(latestPending.upserts.funerals),
        new Set(latestPending.deletes.funerals),
        new Set(latestKnown.funerals),
        true
      );
      funeralsRef.current = nextFunerals;
      setFunerals(nextFunerals);
      saveStoredFunerals(nextFunerals);
      replaceKnownSyncedIds('funerals', serverSnapshot.funerals.map((f) => f.id));

      const nextDonations = reconcileWithCloudSnapshot(
        serverSnapshot.donations,
        donationsRef.current,
        new Set(latestPending.upserts.donations),
        new Set(latestPending.deletes.donations),
        new Set(latestKnown.donations),
        true
      );
      donationsRef.current = nextDonations;
      setDonations(nextDonations);
      saveStoredDonations(nextDonations);
      replaceKnownSyncedIds('donations', serverSnapshot.donations.map((d) => d.id));

      if (serverSnapshot.deliverySettings && !latestPending.upserts.deliverySettings) {
        setDeliverySettings(serverSnapshot.deliverySettings);
        deliverySettingsRef.current = serverSnapshot.deliverySettings;
        saveStoredDeliverySettings(serverSnapshot.deliverySettings);
      }

      setInitialCloudLoaded(true);

      if (res.failed > 0) {
        setCloudStatus('error');
        showToast(
          `ซิงค์ขึ้น Cloud ไม่สำเร็จ ${res.failed} รายการ แต่ดึงข้อมูลล่าสุดจาก Server (${nextPatients.length} ราย) เรียบร้อยแล้ว`,
          'warning'
        );
      } else {
        setCloudStatus('synced');
        setCloudErrorReason(null);
        const recoveredMsg =
          legacyRecovery.recoveredCount > 0 ? `กู้คืน ${legacyRecovery.recoveredCount} รายการ • ` : '';
        showToast(
          res.uploaded > 0 || res.deleted > 0 || legacyRecovery.recoveredCount > 0
            ? `${recoveredMsg}ซิงค์ข้อมูลตรงกันทุกเครื่องแล้ว (ผู้ป่วย ${nextPatients.length} ราย)`
            : `ดึงข้อมูลล่าสุดตรงกับ Cloud ทุกเครื่องแล้ว (ผู้ป่วย ${nextPatients.length} ราย)`,
          'success'
        );
      }
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : String(err);
      const isPerm =
        msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('insufficient');
      setCloudStatus('error');
      setCloudErrorReason(isPerm ? 'permission-denied' : 'network');
      showToast(
        isPerm
          ? 'บัญชีผู้ใช้งานนี้ยังไม่ได้รับสิทธิ์เข้าถึงข้อมูลกลาง กรุณาใช้บัญชี Admin หลักหรือกดส่งคำขอสิทธิ์'
          : 'ไม่สามารถซิงค์ข้อมูลขึ้น Cloud ได้ในขณะนี้ ข้อมูลยังคงถูกบันทึกไว้ในเครื่อง',
        isPerm ? 'error' : 'warning'
      );
    }
  }, [firebaseUser, showToast]);

  const handleSaveAuthorizedEmails = useCallback(
    async (nextEmails: string[]) => {
      if (!firebaseUser) return;
      const updated = await saveWorkspaceAuthorizedEmails(nextEmails, firebaseUser);
      setAuthorizedEmails(updated);
      authorizedEmailsRef.current = updated;
      showToast('อัปเดตรายชื่อบัญชีที่ใช้งานข้ามเครื่องสำเร็จแล้ว', 'success');
    },
    [firebaseUser, showToast]
  );

  const handleRegisterCreatedStaff = useCallback(
    async (uid: string, email: string, displayName: string) => {
      if (!firebaseUser) return;
      await registerStaffAdminMember(uid, email, displayName, firebaseUser);
      const updated = await saveWorkspaceAuthorizedEmails(
        [...authorizedEmailsRef.current, email],
        firebaseUser
      );
      setAuthorizedEmails(updated);
      authorizedEmailsRef.current = updated;
    },
    [firebaseUser]
  );

  const handleSubmitAccessRequest = useCallback(
    async (note?: string) => {
      if (!firebaseUser) return;
      setIsSubmittingRequest(true);
      try {
        await submitAccessRequest(firebaseUser, note);
        showToast('ส่งคำขอสิทธิ์เข้าใช้งานแล้ว กรุณารอผู้ดูแลระบบอนุมัติ', 'success');
      } catch {
        showToast('ไม่สามารถส่งคำขอสิทธิ์ได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง', 'error');
      } finally {
        setIsSubmittingRequest(false);
      }
    },
    [firebaseUser, showToast]
  );

  const handleApproveAccessRequest = useCallback(
    async (req: AccessRequestRecord) => {
      if (!firebaseUser) return;
      setProcessingReqUid(req.uid);
      try {
        const updated = await approveAccessRequest(
          req,
          firebaseUser,
          authorizedEmailsRef.current
        );
        setAuthorizedEmails(updated);
        authorizedEmailsRef.current = updated;
        showToast(`อนุมัติสิทธิ์ให้ ${req.email} และซิงค์ข้อมูลทุกชุดเรียบร้อยแล้ว`, 'success');
      } catch {
        showToast(`ไม่สามารถอนุมัติสิทธิ์ให้ ${req.email} ได้`, 'error');
      } finally {
        setProcessingReqUid(null);
      }
    },
    [firebaseUser, showToast]
  );

  const handleRejectAccessRequest = useCallback(
    async (req: AccessRequestRecord) => {
      if (!firebaseUser) return;
      setProcessingReqUid(req.uid);
      try {
        await rejectAccessRequest(req, firebaseUser);
        showToast(`ปฏิเสธคำขอของ ${req.email} แล้ว`, 'info');
      } catch {
        showToast('ไม่สามารถปฏิเสธคำขอได้', 'error');
      } finally {
        setProcessingReqUid(null);
      }
    },
    [firebaseUser, showToast]
  );

  // Update Delivery Plan shared settings (immediate local + debounced Cloud save)
  const handleUpdateDeliverySettings = useCallback(
    (partial: Partial<DeliveryPlanSettings>) => {
      const nextSettings: DeliveryPlanSettings = {
        ...deliverySettingsRef.current,
        ...partial,
        updatedAt: new Date().toISOString(),
      };
      setDeliverySettings(nextSettings);
      deliverySettingsRef.current = nextSettings;
      saveStoredDeliverySettings(nextSettings);
      setPendingDeliverySettings(true);

      if (deliverySyncTimerRef.current) {
        window.clearTimeout(deliverySyncTimerRef.current);
      }
      if (firebaseUser) {
        setCloudStatus('syncing');
      }
      deliverySyncTimerRef.current = window.setTimeout(() => {
        if (!firebaseUser) return;
        saveDeliveryPlanSettingsToCloud(
          deliverySettingsRef.current,
          firebaseUser,
          authorizedEmailsRef.current
        )
          .then(() => {
            setPendingDeliverySettings(false);
            setCloudStatus('synced');
            setCloudErrorReason(null);
          })
          .catch(() => {
            setCloudStatus('error');
          });
      }, 450);
    },
    [firebaseUser]
  );

  // Save current admin change
  const handleChangeAdmin = (admin: AdminUser) => {
    setCurrentAdmin(admin);
    saveStoredAdminId(admin.id);
  };

  // Save or update a patient
  const handleSavePatient = (savedPatient: PatientRecord) => {
    const safeId = sanitizeFirestoreId(savedPatient.id, 'pt');
    const normalized: PatientRecord = {
      ...savedPatient,
      id: safeId,
      createdAt: savedPatient.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    markPendingUpsert('patients', safeId);

    const existsIndex = patientsRef.current.findIndex(
      (p) => p.id === safeId || p.id === savedPatient.id
    );
    const updatedPatients = sortPatientsByCodeAsc(
      existsIndex >= 0
        ? patientsRef.current.map((p, i) => (i === existsIndex ? normalized : p))
        : [normalized, ...patientsRef.current]
    );

    setPatients(updatedPatients);
    patientsRef.current = updatedPatients;
    saveStoredPatients(updatedPatients);

    if (firebaseUser) {
      setCloudStatus('syncing');
      savePatientToCloud(normalized, firebaseUser, authorizedEmailsRef.current)
        .then(() => {
          clearPendingUpsert('patients', savedPatient.id);
          clearPendingUpsert('patients', safeId);
          addKnownSyncedIds('patients', [safeId]);
          setCloudStatus('synced');
          setCloudErrorReason(null);
        })
        .catch(() => {
          setCloudStatus('error');
          showToast('บันทึกในเครื่องแล้ว (รอซิงค์ขึ้น Cloud อัตโนมัติเมื่อเชื่อมต่อสำเร็จ)', 'warning');
        });
    }

    setEditingPatient(null);
    setCurrentTab('list');
    showToast(`บันทึกข้อมูล ${normalized.title}${normalized.fullName} เรียบร้อยแล้ว`, 'success');
  };

  // Archive a patient (change status to deceased/moved/rejected with recorded reason)
  const handleArchivePatient = (
    patientId: string,
    newStatus: PatientStatus,
    reason: string
  ) => {
    const nowIso = new Date().toISOString();
    const todayStr = nowIso.slice(0, 10);
    const existing = patientsRef.current.find((p) => p.id === patientId);
    if (!existing) return;

    const historyEntry: StatusHistoryLog = {
      previousStatus: existing.status,
      newStatus,
      changeDate: todayStr,
      reason,
      officerName: currentAdmin.name,
    };

    const safeId = sanitizeFirestoreId(patientId, 'pt');
    const modifiedPatient: PatientRecord = {
      ...existing,
      id: safeId,
      status: newStatus,
      statusReason: `${reason} (บันทึกโดย ${currentAdmin.name} ณ ${formatThaiDate(todayStr)})`,
      statusHistory: [...(existing.statusHistory || []), historyEntry],
      updatedAt: nowIso,
    };

    markPendingUpsert('patients', safeId);

    const updatedPatients = sortPatientsByCodeAsc(
      patientsRef.current.map((p) => (p.id === patientId ? modifiedPatient : p))
    );
    setPatients(updatedPatients);
    patientsRef.current = updatedPatients;
    saveStoredPatients(updatedPatients);

    if (firebaseUser) {
      setCloudStatus('syncing');
      savePatientToCloud(modifiedPatient, firebaseUser, authorizedEmailsRef.current)
        .then(() => {
          clearPendingUpsert('patients', patientId);
          clearPendingUpsert('patients', safeId);
          addKnownSyncedIds('patients', [patientId, safeId]);
          setCloudStatus('synced');
          setCloudErrorReason(null);
        })
        .catch(() => {
          setCloudStatus('error');
          showToast('บันทึกสถานะในเครื่องแล้ว (รอซิงค์ขึ้น Cloud อัตโนมัติ)', 'warning');
        });
    }
    showToast('ปรับสถานะผู้ป่วยเรียบร้อยแล้ว', 'info');
  };

  // Restore patient from archive back to active
  const handleRestorePatient = (patientId: string) => {
    const nowIso = new Date().toISOString();
    const todayStr = nowIso.slice(0, 10);
    const existing = patientsRef.current.find((p) => p.id === patientId);
    if (!existing) return;

    const historyEntry: StatusHistoryLog = {
      previousStatus: existing.status,
      newStatus: 'active',
      changeDate: todayStr,
      reason: 'กู้คืนสถานะกลับเข้าสู่โครงการ',
      officerName: currentAdmin.name,
    };

    const safeId = sanitizeFirestoreId(patientId, 'pt');
    const modifiedPatient: PatientRecord = {
      ...existing,
      id: safeId,
      status: 'active',
      statusReason: `กู้คืนสถานะกลับเข้าสู่โครงการโดย ${currentAdmin.name} ณ ${formatThaiDate(todayStr)}`,
      statusHistory: [...(existing.statusHistory || []), historyEntry],
      updatedAt: nowIso,
    };

    markPendingUpsert('patients', safeId);

    const updatedPatients = sortPatientsByCodeAsc(
      patientsRef.current.map((p) => (p.id === patientId ? modifiedPatient : p))
    );
    setPatients(updatedPatients);
    patientsRef.current = updatedPatients;
    saveStoredPatients(updatedPatients);

    if (firebaseUser) {
      setCloudStatus('syncing');
      savePatientToCloud(modifiedPatient, firebaseUser, authorizedEmailsRef.current)
        .then(() => {
          clearPendingUpsert('patients', patientId);
          clearPendingUpsert('patients', safeId);
          addKnownSyncedIds('patients', [patientId, safeId]);
          setCloudStatus('synced');
          setCloudErrorReason(null);
        })
        .catch(() => {
          setCloudStatus('error');
          showToast('กู้คืนในเครื่องแล้ว (รอซิงค์ขึ้น Cloud อัตโนมัติ)', 'warning');
        });
    }
    showToast('กู้คืนผู้ป่วยกลับเข้าสู่โครงการเรียบร้อยแล้ว', 'success');
  };

  // Record a monthly delivery
  const handleRecordDelivery = (patientId: string, delivery: MonthlyDelivery) => {
    const nowIso = new Date().toISOString();
    const existing = patientsRef.current.find((p) => p.id === patientId);
    if (!existing) return;

    const safeId = sanitizeFirestoreId(patientId, 'pt');
    const safeDelivery: MonthlyDelivery = {
      ...delivery,
      id: sanitizeFirestoreId(delivery.id, 'del'),
    };
    const modifiedPatient: PatientRecord = {
      ...existing,
      id: safeId,
      deliveries: [safeDelivery, ...(existing.deliveries || [])],
      updatedAt: nowIso,
    };

    markPendingUpsert('patients', safeId);

    const updatedPatients = sortPatientsByCodeAsc(
      patientsRef.current.map((p) => (p.id === patientId ? modifiedPatient : p))
    );
    setPatients(updatedPatients);
    patientsRef.current = updatedPatients;
    saveStoredPatients(updatedPatients);

    if (firebaseUser) {
      setCloudStatus('syncing');
      saveDeliveryToCloud(modifiedPatient, safeDelivery, firebaseUser, authorizedEmailsRef.current)
        .then(() => {
          clearPendingUpsert('patients', patientId);
          clearPendingUpsert('patients', safeId);
          addKnownSyncedIds('patients', [patientId, safeId]);
          setCloudStatus('synced');
          setCloudErrorReason(null);
        })
        .catch(() => {
          setCloudStatus('error');
          showToast('บันทึกส่งมอบในเครื่องแล้ว (รอซิงค์ขึ้น Cloud อัตโนมัติ)', 'warning');
        });
    }
  };

  // Save or update funeral assistance record
  const handleSaveFuneral = (savedRecord: FuneralAssistanceRecord) => {
    const safeId = sanitizeFirestoreId(savedRecord.id, 'funeral');
    const normalized: FuneralAssistanceRecord = {
      ...savedRecord,
      id: safeId,
      createdAt: savedRecord.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    clearPendingDelete('funerals', savedRecord.id);
    clearPendingDelete('funerals', safeId);
    markPendingUpsert('funerals', safeId);

    const idx = funeralsRef.current.findIndex(
      (f) => f.id === safeId || f.id === savedRecord.id
    );
    const updatedFunerals =
      idx >= 0
        ? funeralsRef.current.map((f, i) => (i === idx ? normalized : f))
        : [normalized, ...funeralsRef.current];

    setFunerals(updatedFunerals);
    funeralsRef.current = updatedFunerals;
    saveStoredFunerals(updatedFunerals);

    if (firebaseUser) {
      setCloudStatus('syncing');
      saveFuneralToCloud(normalized, firebaseUser, authorizedEmailsRef.current)
        .then(() => {
          clearPendingUpsert('funerals', savedRecord.id);
          clearPendingUpsert('funerals', safeId);
          addKnownSyncedIds('funerals', [safeId]);
          setCloudStatus('synced');
          setCloudErrorReason(null);
        })
        .catch(() => {
          setCloudStatus('error');
          showToast('บันทึกคำร้องในเครื่องแล้ว (รอซิงค์ขึ้น Cloud อัตโนมัติ)', 'warning');
        });
    }
    showToast(`บันทึกคำร้องอนุเคราะห์เผาศพ (${normalized.code}) เรียบร้อยแล้ว`, 'success');
  };

  // Delete funeral assistance record
  const handleDeleteFuneral = (id: string) => {
    const safeId = sanitizeFirestoreId(id, 'funeral');
    clearPendingUpsert('funerals', id);
    clearPendingUpsert('funerals', safeId);
    markPendingDelete('funerals', id);

    const updatedFunerals = funeralsRef.current.filter((f) => f.id !== id);
    setFunerals(updatedFunerals);
    funeralsRef.current = updatedFunerals;
    saveStoredFunerals(updatedFunerals);

    if (firebaseUser) {
      setCloudStatus('syncing');
      deleteFuneralFromCloud(id, firebaseUser)
        .then(() => {
          clearPendingDelete('funerals', id);
          clearPendingDelete('funerals', safeId);
          removeKnownSyncedId('funerals', id);
          removeKnownSyncedId('funerals', safeId);
          setCloudStatus('synced');
          setCloudErrorReason(null);
        })
        .catch(() => {
          setCloudStatus('error');
          showToast('ลบในเครื่องแล้ว (รออัปเดตการลบบน Cloud เมื่อเชื่อมต่อสำเร็จ)', 'warning');
        });
    }
    showToast('ลบรายการอนุเคราะห์เผาศพเรียบร้อยแล้ว', 'info');
  };

  // Save or update donation record
  const handleSaveDonation = (savedRecord: DonationDistributionRecord) => {
    const safeId = sanitizeFirestoreId(savedRecord.id, 'donation');
    const normalized: DonationDistributionRecord = {
      ...savedRecord,
      id: safeId,
      createdAt: savedRecord.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    clearPendingDelete('donations', savedRecord.id);
    clearPendingDelete('donations', safeId);
    markPendingUpsert('donations', safeId);

    const idx = donationsRef.current.findIndex(
      (d) => d.id === safeId || d.id === savedRecord.id
    );
    const updatedDonations =
      idx >= 0
        ? donationsRef.current.map((d, i) => (i === idx ? normalized : d))
        : [normalized, ...donationsRef.current];

    setDonations(updatedDonations);
    donationsRef.current = updatedDonations;
    saveStoredDonations(updatedDonations);

    if (firebaseUser) {
      setCloudStatus('syncing');
      saveDonationToCloud(normalized, firebaseUser, authorizedEmailsRef.current)
        .then(() => {
          clearPendingUpsert('donations', savedRecord.id);
          clearPendingUpsert('donations', safeId);
          addKnownSyncedIds('donations', [safeId]);
          setCloudStatus('synced');
          setCloudErrorReason(null);
        })
        .catch(() => {
          setCloudStatus('error');
          showToast('บันทึกบริจาคในเครื่องแล้ว (รอซิงค์ขึ้น Cloud อัตโนมัติ)', 'warning');
        });
    }
    showToast(`บันทึกการบริจาคสิ่งของ (${normalized.code}) เรียบร้อยแล้ว`, 'success');
  };

  // Delete donation record
  const handleDeleteDonation = (id: string) => {
    const safeId = sanitizeFirestoreId(id, 'donation');
    clearPendingUpsert('donations', id);
    clearPendingUpsert('donations', safeId);
    markPendingDelete('donations', id);

    const updatedDonations = donationsRef.current.filter((d) => d.id !== id);
    setDonations(updatedDonations);
    donationsRef.current = updatedDonations;
    saveStoredDonations(updatedDonations);

    if (firebaseUser) {
      setCloudStatus('syncing');
      deleteDonationFromCloud(id, firebaseUser)
        .then(() => {
          clearPendingDelete('donations', id);
          clearPendingDelete('donations', safeId);
          removeKnownSyncedId('donations', id);
          removeKnownSyncedId('donations', safeId);
          setCloudStatus('synced');
          setCloudErrorReason(null);
        })
        .catch(() => {
          setCloudStatus('error');
          showToast('ลบในเครื่องแล้ว (รออัปเดตการลบบน Cloud เมื่อเชื่อมต่อสำเร็จ)', 'warning');
        });
    }
    showToast('ลบรายการบริจาคเรียบร้อยแล้ว', 'info');
  };

  // Import full JSON backup (non-destructive merge so existing data is never lost)
  const handleImportBackup = async (
    importedPatients: PatientRecord[],
    importedFunerals?: FuneralAssistanceRecord[],
    importedDonations?: DonationDistributionRecord[]
  ) => {
    let nextPatients = patientsRef.current;
    let nextFunerals = funeralsRef.current;
    let nextDonations = donationsRef.current;

    if (importedPatients && Array.isArray(importedPatients)) {
      const sanitizedPatients = importedPatients.map((p) => ({
        ...p,
        id: sanitizeFirestoreId(p.id, 'pt'),
      }));
      sanitizedPatients.forEach((p) => markPendingUpsert('patients', p.id));
      nextPatients = sortPatientsByCodeAsc(
        mergeRecordsNonDestructively(sanitizedPatients, patientsRef.current)
      );
      setPatients(nextPatients);
      patientsRef.current = nextPatients;
      saveStoredPatients(nextPatients);
    }
    if (importedFunerals && Array.isArray(importedFunerals)) {
      const sanitizedFunerals = importedFunerals.map((f) => ({
        ...f,
        id: sanitizeFirestoreId(f.id, 'funeral'),
      }));
      sanitizedFunerals.forEach((f) => markPendingUpsert('funerals', f.id));
      nextFunerals = mergeRecordsNonDestructively(sanitizedFunerals, funeralsRef.current);
      setFunerals(nextFunerals);
      funeralsRef.current = nextFunerals;
      saveStoredFunerals(nextFunerals);
    }
    if (importedDonations && Array.isArray(importedDonations)) {
      const sanitizedDonations = importedDonations.map((d) => ({
        ...d,
        id: sanitizeFirestoreId(d.id, 'donation'),
      }));
      sanitizedDonations.forEach((d) => markPendingUpsert('donations', d.id));
      nextDonations = mergeRecordsNonDestructively(sanitizedDonations, donationsRef.current);
      setDonations(nextDonations);
      donationsRef.current = nextDonations;
      saveStoredDonations(nextDonations);
    }

    setCurrentTab('list');

    if (firebaseUser) {
      setCloudStatus('syncing');
      try {
        const res = await syncLocalRecordsToCloud(
          firebaseUser,
          nextPatients,
          nextFunerals,
          nextDonations,
          deliverySettingsRef.current,
          authorizedEmailsRef.current
        );
        if (res.failed > 0) {
          setCloudStatus('error');
          showToast(
            `นำเข้าแล้ว แต่ซิงค์ขึ้น Cloud ไม่สำเร็จ ${res.failed} รายการ ระบบจะลองซิงค์ใหม่อัตโนมัติ`,
            'warning'
          );
        } else {
          setCloudStatus('synced');
          showToast('นำเข้าและซิงค์ข้อมูลสำรองขึ้น Cloud สำเร็จแล้ว', 'success');
        }
      } catch {
        setCloudStatus('error');
      }
    }
  };

  // Clear local cache safely with confirmation
  const handleClearAll = async () => {
    const confirmed = await confirmDialog({
      title: 'ยืนยันล้างข้อมูลในเครื่องนี้',
      message: firebaseUser
        ? 'การล้างข้อมูลนี้จะลบแคชในเบราว์เซอร์เครื่องนี้เท่านั้น (ข้อมูลที่ซิงค์ขึ้น Cloud Firestore จะยังอยู่ปลอดภัยและโหลดกลับมาได้เมื่อรีเฟรช)'
        : 'คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลทั้งหมดที่จัดเก็บในเบราว์เซอร์เครื่องนี้? แนะนำให้สำรองไฟล์ JSON หรือเชื่อมต่อ Cloud ก่อนดำเนินการ',
      confirmLabel: 'ยืนยันการล้างข้อมูล',
      cancelLabel: 'ยกเลิก',
      variant: 'danger',
    });

    if (confirmed) {
      clearAllStoredPatients(true);
      clearAllStoredFunerals(true);
      clearAllStoredDonations(true);
      clearAllPendingOps();
      clearAllKnownSyncedIds();
      patientsRef.current = [];
      funeralsRef.current = [];
      donationsRef.current = [];
      setPatients([]);
      setFunerals([]);
      setDonations([]);
      showToast('ล้างข้อมูลในเบราว์เซอร์เรียบร้อยแล้ว', 'info');
    }
  };

  // Edit patient action
  const handleStartEdit = (patient: PatientRecord) => {
    setEditingPatient(patient);
    setCurrentTab('edit');
  };

  // Mandatory Gate 1: Wait for Firebase Auth session check on initial page load
  if (!authInitialized) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-lg p-8 max-w-md w-full text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center">
            <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">BD-Care • โครงการใจถึงใจ</h1>
            <p className="text-xs text-slate-600 mt-1">กำลังตรวจสอบสถานะการลงชื่อเข้าใช้งาน...</p>
          </div>
        </div>
      </div>
    );
  }

  // Mandatory Gate 2: Require Username & Password Sign-In for EVERY user before exposing data
  if (!firebaseUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50/40 to-slate-100 flex flex-col justify-between p-4">
        <div className="flex-1 flex items-center justify-center">
          <div className="bg-white border border-slate-200 rounded-3xl shadow-xl max-w-md w-full overflow-hidden">
            <div className="bg-slate-900 text-white px-6 py-6 text-center space-y-2">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center">
                <ShieldCheck className="w-8 h-8 text-blue-300" />
              </div>
              <h1 className="text-xl font-bold tracking-tight">ระบบฐานข้อมูล BD-Care</h1>
              <p className="text-xs text-slate-300 leading-relaxed">
                โครงการใจถึงใจช่วยผู้ป่วยติดเตียงและยากไร้
                <br />
                มูลนิธิร่วมกุศลสมุทรปราการ (北欖天德善堂)
              </p>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-[11px] text-emerald-300 font-mono">
                <Cloud className="w-3.5 h-3.5 shrink-0" />
                <span>Firebase: {firebaseConfig.projectId}</span>
              </div>
            </div>

            <form onSubmit={handleUsernamePasswordLogin} className="p-6 space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3.5 text-xs text-blue-950 space-y-1 leading-relaxed">
                <div className="font-bold flex items-center gap-1.5 text-blue-900">
                  <Lock className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>เข้าสู่ระบบด้วย Username และ Password เท่านั้น</span>
                </div>
                <p>
                  ผู้ใช้งานทุกคนต้องลงชื่อเข้าใช้ด้วยชื่อผู้ใช้งานและรหัสผ่านที่ได้รับอนุญาตจากผู้ดูแลระบบ (Admin) ก่อนเข้าถึงข้อมูล
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ชื่อผู้ใช้งาน (Username)
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={loginUsername}
                      onChange={(e) => setLoginUsername(e.target.value)}
                      autoComplete="username"
                      placeholder="เช่น Kitphiphat03 หรือชื่อผู้ใช้เจ้าหน้าที่"
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    รหัสผ่าน (Password)
                  </label>
                  <div className="relative">
                    <Key className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type={showLoginPassword ? 'text' : 'password'}
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      autoComplete="current-password"
                      placeholder="กรอกรหัสผ่าน"
                      className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword((prev) => !prev)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                      aria-label={showLoginPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                    >
                      {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {loginError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-800 flex items-start gap-2 leading-relaxed">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{loginError}</span>
                </div>
              )}

              {needsEmailProviderEnable && (
                <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 text-xs text-amber-950 space-y-2 leading-relaxed">
                  <div className="font-bold text-amber-900">
                    ขั้นตอนเปิดใช้งาน Login ด้วย Username/Password ใน Firebase Console
                  </div>
                  <p>
                    เข้าไปที่โปรเจกต์ <strong>{firebaseConfig.projectId}</strong> &rarr; <strong>Authentication</strong> &rarr; <strong>Sign-in method</strong> &rarr; กดเปิด <strong>Email/Password</strong> แล้วกด Save จากนั้นลองเข้าสู่ระบบอีกครั้ง
                  </p>
                  <a
                    href={`https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/providers`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 font-bold text-blue-700 hover:text-blue-900 underline"
                  >
                    <span>เปิดหน้าตั้งค่า Authentication ใน Firebase Console</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}

              <button
                type="submit"
                disabled={isSigningIn}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-60 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSigningIn ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>กำลังตรวจสอบและเข้าสู่ระบบ...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>เข้าสู่ระบบด้วย Username & Password</span>
                  </>
                )}
              </button>

              <p className="text-[11px] text-center text-slate-500 leading-relaxed">
                ผู้ดูแลระบบหลัก (Admin): นายกริชพิพัฒน์ สัลบทอง (Username: <span className="font-mono font-semibold text-slate-700">{SUPER_ADMIN_USERNAME}</span>)
                <br />
                เจ้าหน้าที่ใหม่สามารถขอ Username และ Password ได้จากผู้ดูแลระบบหลัก
              </p>
            </form>
          </div>
        </div>

        <footer className="py-3 text-center text-[11px] text-slate-500">
          57/1 ซอยท้ายบ้าน 17 (ซอยมูลนิธิ) ถนนท้ายบ้าน ตำบลปากน้ำ อำเภอเมืองสมุทรปราการ จังหวัดสมุทรปราการ 10270 โทร.02 175 8668, 02 175 8789
        </footer>
      </div>
    );
  }

  // Mandatory Gate 3: Checking workspace authorization against Firestore server
  if (accessVerified === 'checking') {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-lg p-8 max-w-md w-full text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center">
            <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">กำลังตรวจสอบสิทธิ์การเข้าใช้งาน</h2>
            <p className="text-xs text-slate-600 mt-1">
              บัญชีผู้ใช้งาน:{' '}
              <span className="font-mono font-semibold text-slate-800">
                @{authEmailToUsername(firebaseUser.email)}
              </span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Mandatory Gate 4: Signed in, waiting for Admin approval (or retry on network error)
  if (accessVerified === 'denied') {
    const isNetworkErr = cloudErrorReason === 'network';
    const currentUname = authEmailToUsername(firebaseUser.email);
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 via-amber-50/30 to-slate-100 flex flex-col justify-between p-4">
        <div className="flex-1 flex items-center justify-center">
          <div className="bg-white border border-slate-200 rounded-3xl shadow-xl max-w-lg w-full overflow-hidden">
            <div className={`px-6 py-5 text-white flex items-center justify-between ${isNetworkErr ? 'bg-slate-800' : 'bg-amber-700'}`}>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center">
                  {isNetworkErr ? <CloudOff className="w-6 h-6" /> : <Lock className="w-6 h-6" />}
                </div>
                <div>
                  <h1 className="text-base font-bold">
                    {isNetworkErr ? 'ไม่สามารถเชื่อมต่อฐานข้อมูลกลางได้' : 'รอผู้ดูแลระบบเปิดอนุญาตสิทธิ์'}
                  </h1>
                  <p className="text-xs text-white/85">BD-Care • มูลนิธิร่วมกุศลสมุทรปราการ</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs text-slate-500">ลงชื่อเข้าใช้ด้วย Username</div>
                  <div className="font-bold text-sm text-slate-900 truncate">
                    {firebaseUser.displayName || currentUname || 'ผู้ใช้งาน'}
                  </div>
                  <div className="text-xs font-mono text-slate-600 truncate">
                    @{currentUname} ({firebaseUser.email})
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 ${
                  myAccessRequest?.status === 'pending'
                    ? 'bg-amber-100 text-amber-900'
                    : isNetworkErr
                    ? 'bg-slate-200 text-slate-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {myAccessRequest?.status === 'pending'
                    ? 'รออนุมัติ'
                    : isNetworkErr
                    ? 'ออฟไลน์'
                    : 'ยังไม่มีสิทธิ์'}
                </span>
              </div>

              {isNetworkErr ? (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-700 leading-relaxed space-y-3">
                  <p>ไม่สามารถตรวจสอบสิทธิ์กับฐานข้อมูลกลางในขณะนี้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่อีกครั้ง</p>
                  <button
                    type="button"
                    onClick={() => setCloudRefreshNonce((n) => n + 1)}
                    className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>ตรวจสอบสิทธิ์อีกครั้ง</span>
                  </button>
                </div>
              ) : myAccessRequest?.status === 'pending' ? (
                <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl text-xs text-amber-950 space-y-2 leading-relaxed">
                  <div className="font-bold flex items-center gap-2 text-amber-900">
                    <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>ส่งคำขอเปิดสิทธิ์เข้าใช้งานเรียบร้อยแล้ว</span>
                  </div>
                  <p>
                    กรุณารอผู้ดูแลระบบ (นายกริชพิพัฒน์ สัลบทอง • Username: <span className="font-mono font-semibold">{SUPER_ADMIN_USERNAME}</span>) กดอนุมัติสิทธิ์ให้บัญชีของคุณ เมื่ออนุมัติแล้วระบบจะเปิดเข้าใช้งานให้อัตโนมัติทันที
                  </p>
                </div>
              ) : (
                <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-900 space-y-3 leading-relaxed">
                  <div className="font-bold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                    <span>บัญชีผู้ใช้งานนี้ยังไม่ได้รับการเปิดอนุญาตสิทธิ์จากแอดมิน</span>
                  </div>
                  {myAccessRequest?.status === 'rejected' && (
                    <p className="font-semibold text-red-700">
                      คำขอก่อนหน้าถูกปฏิเสธ กรุณาติดต่อผู้ดูแลระบบหรือกดส่งคำขอใหม่อีกครั้ง
                    </p>
                  )}
                  <p>
                    กดปุ่มด้านล่างเพื่อส่งคำขอเปิดสิทธิ์ไปยังผู้ดูแลระบบ (Username: <span className="font-mono font-semibold">{SUPER_ADMIN_USERNAME}</span>) เพื่ออนุมัติให้บัญชีนี้เข้าดูและแก้ไขข้อมูล BD-Care
                  </p>
                  <button
                    type="button"
                    disabled={isSubmittingRequest}
                    onClick={() => handleSubmitAccessRequest()}
                    className="w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>{isSubmittingRequest ? 'กำลังส่งคำขอ...' : 'ส่งคำขอเปิดสิทธิ์ให้แอดมินอนุมัติ'}</span>
                  </button>
                </div>
              )}

              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCloudRefreshNonce((n) => n + 1)}
                  className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>รีเฟรชตรวจสอบสิทธิ์</span>
                </button>
                <button
                  type="button"
                  onClick={handleCloudSignOut}
                  className="flex-1 py-2 px-3 bg-white hover:bg-red-50 text-red-600 border border-red-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>เปลี่ยนบัญชีผู้ใช้งาน / ออกจากระบบ</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <footer className="py-3 text-center text-[11px] text-slate-500">
          57/1 ซอยท้ายบ้าน 17 (ซอยมูลนิธิ) ถนนท้ายบ้าน ตำบลปากน้ำ อำเภอเมืองสมุทรปราการ จังหวัดสมุทรปราการ 10270 โทร.02 175 8668, 02 175 8789
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col selection:bg-blue-600 selection:text-white">
      {/* Navigation Header */}
      <Header
        currentTab={currentTab}
        setCurrentTab={(tab) => {
          if (tab === 'new') {
            setEditingPatient(null);
          }
          setCurrentTab(tab);
        }}
        currentAdmin={currentAdmin}
        setCurrentAdmin={handleChangeAdmin}
        patients={patients}
        funerals={funerals}
        donations={donations}
        onImportBackup={handleImportBackup}
        onClearAll={handleClearAll}
        isOnline={isOnline}
        firebaseUser={firebaseUser}
        cloudStatus={cloudStatus}
        cloudErrorReason={cloudErrorReason}
        authorizedEmails={authorizedEmails}
        onSaveAuthorizedEmails={handleSaveAuthorizedEmails}
        onRegisterCreatedStaff={handleRegisterCreatedStaff}
        onSwitchUserAccount={handleSwitchUserAccount}
        onCloudSignOut={handleCloudSignOut}
        onManualCloudSync={handleManualCloudSync}
        externalLoginOpen={isCloudModalOpen}
        onExternalLoginClose={() => setIsCloudModalOpen(false)}
        myAccessRequest={myAccessRequest}
        isSubmittingRequest={isSubmittingRequest}
        onSubmitAccessRequest={handleSubmitAccessRequest}
        pendingAccessRequests={pendingAccessRequests}
        onApproveAccessRequest={handleApproveAccessRequest}
        onRejectAccessRequest={handleRejectAccessRequest}
      />

      {/* Main Content Areas */}
      <main className="flex-1 pb-16">
        {firebaseUser && cloudErrorReason === 'permission-denied' && (
          <div className="no-print max-w-7xl mx-auto px-3 sm:px-4 pt-4">
            <div className="bg-red-50 border border-red-300 rounded-2xl p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3 shadow-xs">
              <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                <div className="p-2 bg-red-100 text-red-700 rounded-xl shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="text-xs text-red-950">
                  <div className="font-bold text-sm">
                    บัญชี @{authEmailToUsername(firebaseUser.email)} ({firebaseUser.email}) ยังไม่ได้รับสิทธิ์เข้าถึงฐานข้อมูลกลาง
                  </div>
                  {myAccessRequest?.status === 'pending' ? (
                    <p className="text-amber-800 font-semibold mt-0.5 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>ส่งคำขอสิทธิ์แล้ว กำลังรอผู้ดูแลระบบ ({SUPER_ADMIN_USERNAME}) อนุมัติ — หน้าจอจะโหลดข้อมูลทั้งหมดให้อัตโนมัติทันที</span>
                    </p>
                  ) : (
                    <p className="text-red-800 mt-0.5 leading-relaxed">
                      กดปุ่ม "ส่งคำขอสิทธิ์เข้าใช้งาน" เพื่อให้ผู้ดูแลระบบอนุมัติได้ทันที หรือสลับไปใช้บัญชีหลัก ({SUPER_ADMIN_USERNAME})
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {myAccessRequest?.status !== 'pending' && (
                  <button
                    type="button"
                    disabled={isSubmittingRequest}
                    onClick={() => handleSubmitAccessRequest()}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>
                      {isSubmittingRequest ? 'กำลังส่งคำขอ...' : 'ส่งคำขอสิทธิ์เข้าใช้งาน'}
                    </span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsCloudModalOpen(true)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                >
                  สลับบัญชีผู้ใช้งาน
                </button>
              </div>
            </div>
          </div>
        )}

        {firebaseUser && isSuperAdminUser(firebaseUser) && pendingAccessRequests.length > 0 && (
          <div className="no-print max-w-7xl mx-auto px-3 sm:px-4 pt-4">
            <div className="bg-amber-50 border border-amber-300 rounded-2xl p-3.5 sm:p-4 space-y-2.5 shadow-xs">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-950">
                <UserPlus className="w-4 h-4 text-amber-700 shrink-0" />
                <span>
                  มีอุปกรณ์อื่นขอสิทธิ์เข้าดูและแก้ไขข้อมูล BD-Care ({pendingAccessRequests.length} รายการ)
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {pendingAccessRequests.map((req) => (
                  <div
                    key={req.uid}
                    className="bg-white border border-amber-200 rounded-xl p-2.5 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 truncate">
                        {req.displayName || req.email}
                      </div>
                      <div className="font-mono text-[11px] text-slate-600 truncate">{req.email}</div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        disabled={processingReqUid === req.uid}
                        onClick={() => handleApproveAccessRequest(req)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>อนุมัติทันที</span>
                      </button>
                      <button
                        type="button"
                        disabled={processingReqUid === req.uid}
                        onClick={() => handleRejectAccessRequest(req)}
                        className="px-2.5 py-1.5 bg-white hover:bg-red-50 text-red-600 border border-red-200 rounded-lg font-semibold cursor-pointer"
                      >
                        ปฏิเสธ
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {firebaseUser && !initialCloudLoaded && cloudStatus === 'syncing' && (
          <div className="no-print max-w-7xl mx-auto px-3 sm:px-4 pt-4">
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 flex items-center gap-2.5 text-xs font-semibold text-blue-900">
              <RefreshCw className="w-4 h-4 animate-spin text-blue-600 shrink-0" />
              <span>กำลังดาวน์โหลดและปรับข้อมูลล่าสุดจาก Cloud Firestore ให้ตรงกันทุกเครื่อง...</span>
            </div>
          </div>
        )}

        {currentTab === 'list' && (
          <PatientList
            patients={patients}
            onEditPatient={handleStartEdit}
            onArchivePatient={handleArchivePatient}
            onAddNew={() => {
              setEditingPatient(null);
              setCurrentTab('new');
            }}
            onManualCloudSync={handleManualCloudSync}
            currentAdmin={currentAdmin}
          />
        )}

        {(currentTab === 'new' || currentTab === 'edit') && (
          <PatientForm
            initialPatient={editingPatient}
            currentAdmin={currentAdmin}
            onSave={handleSavePatient}
            onCancel={() => {
              setEditingPatient(null);
              setCurrentTab('list');
            }}
            existingCount={patients.length}
            existingCodes={patients.map((p) => p.code)}
          />
        )}

        {currentTab === 'funerals' && (
          <FuneralAssistanceView
            funerals={funerals}
            onSaveFuneral={handleSaveFuneral}
            onDeleteFuneral={handleDeleteFuneral}
            currentAdmin={currentAdmin}
          />
        )}

        {currentTab === 'donations' && (
          <DonationView
            donations={donations}
            onSaveDonation={handleSaveDonation}
            onDeleteDonation={handleDeleteDonation}
            currentAdmin={currentAdmin}
          />
        )}

        {currentTab === 'deliveries' && (
          <DeliveryPlan
            patients={patients}
            onRecordDelivery={handleRecordDelivery}
            currentAdmin={currentAdmin}
            deliverySettings={deliverySettings}
            onUpdateDeliverySettings={handleUpdateDeliverySettings}
          />
        )}

        {currentTab === 'dashboard' && <Dashboard patients={patients} />}

        {currentTab === 'archive' && (
          <ArchiveView
            patients={patients}
            onRestorePatient={handleRestorePatient}
            currentAdmin={currentAdmin}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="no-print bg-white border-t border-slate-200 py-3 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-left">
            <span className="font-bold text-slate-700">BD-Care</span>
            <span>
              • โครงการใจถึงใจช่วยผู้ป่วยติดเตียงและยากไร้ มูลนิธิร่วมกุศลสมุทรปราการ (北欖天德善堂) • 57/1 ซอยท้ายบ้าน 17 (ซอยมูลนิธิ) ถนนท้ายบ้าน ตำบลปากน้ำ อำเภอเมืองสมุทรปราการ จังหวัดสมุทรปราการ 10270 โทร.02 175 8668, 02 175 8789
            </span>
          </div>
          <div className="text-slate-400 text-[11px]">
            ระบบแบบฟอร์ม สค.04 ดิจิทัล • เชื่อมต่อฐานข้อมูล Firebase Cloud Firestore & Local Storage
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <UiFeedbackProvider>
      <AppContent />
    </UiFeedbackProvider>
  );
}
