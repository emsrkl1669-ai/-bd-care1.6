import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User } from 'firebase/auth';
import { Cloud, CloudOff, AlertTriangle, RefreshCw } from 'lucide-react';
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
} from './types';
import {
  getStoredPatients,
  saveStoredPatients,
  clearAllStoredPatients,
  getStoredFunerals,
  saveStoredFunerals,
  clearAllStoredFunerals,
  getStoredDonations,
  saveStoredDonations,
  clearAllStoredDonations,
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
import { formatThaiDate } from './utils/idCard';
import { sanitizeFirestoreId } from './utils/image';
import {
  SUPER_ADMIN_EMAIL,
  subscribeToAuth,
  testFirestoreConnection,
  signInWithGoogle,
  signOutFirebase,
} from './firebase';
import {
  ensureSuperAdminDirectory,
  subscribeToCloudCollections,
  syncLocalRecordsToCloud,
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
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [cloudStatus, setCloudStatus] = useState<'disconnected' | 'syncing' | 'synced' | 'error'>('disconnected');
  const [cloudErrorReason, setCloudErrorReason] = useState<'permission-denied' | 'network' | null>(null);
  const [initialCloudLoaded, setInitialCloudLoaded] = useState<boolean>(false);

  // Refs for latest state inside async callbacks
  const patientsRef = useRef<PatientRecord[]>(patients);
  const funeralsRef = useRef<FuneralAssistanceRecord[]>(funerals);
  const donationsRef = useRef<DonationDistributionRecord[]>(donations);
  const deliverySettingsRef = useRef<DeliveryPlanSettings>(deliverySettings);
  const authorizedEmailsRef = useRef<string[]>(authorizedEmails);
  const deliverySyncTimerRef = useRef<number | null>(null);

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
    return found || ADMIN_USERS[0];
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
      setFirebaseUser(user);
      if (unsubCloud) {
        unsubCloud();
        unsubCloud = null;
      }

      if (!user) {
        setCloudStatus('disconnected');
        setCloudErrorReason(null);
        setInitialCloudLoaded(false);
        return;
      }

      setCloudStatus('syncing');
      setCloudErrorReason(null);
      setInitialCloudLoaded(false);

      try {
        await ensureSuperAdminDirectory(user);
        const teamEmails = await fetchWorkspaceAuthorizedEmails(user);
        if (cancelled) return;
        setAuthorizedEmails(teamEmails);
        authorizedEmailsRef.current = teamEmails;

        // Flush pending offline deletes & upload any unsynced local records first
        const migration = await syncLocalRecordsToCloud(
          user,
          patientsRef.current,
          funeralsRef.current,
          donationsRef.current,
          deliverySettingsRef.current,
          teamEmails
        );
        if (cancelled) return;

        if (migration.uploaded > 0 || migration.deleted > 0) {
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
              const next = reconcileWithCloudSnapshot(
                cloudPatients,
                prevLocal,
                pendingUpsertSet,
                new Set(),
                knownSet,
                !fromCache
              );
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
            setInitialCloudLoaded(true);
          },
        });
      } catch (err: any) {
        if (cancelled) return;
        console.error('Firebase sync initialization failed:', err);
        const msg = err instanceof Error ? err.message : String(err);
        const isPerm =
          msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('insufficient');
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
  }, [showToast]);

  // Auto-flush queued offline operations whenever network connection returns
  useEffect(() => {
    if (!isOnline || !firebaseUser) return;
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
    syncLocalRecordsToCloud(
      firebaseUser,
      patientsRef.current,
      funeralsRef.current,
      donationsRef.current,
      deliverySettingsRef.current,
      authorizedEmailsRef.current
    )
      .then((res) => {
        setCloudStatus('synced');
        setCloudErrorReason(null);
        if (res.uploaded > 0 || res.deleted > 0) {
          showToast(
            `ซิงค์รายการที่ค้างอยู่ขึ้น Cloud สำเร็จ (${res.uploaded + res.deleted} รายการ)`,
            'success'
          );
        }
      })
      .catch(() => {
        setCloudStatus('error');
      });
  }, [isOnline, firebaseUser, showToast]);

  const handleCloudSignIn = useCallback(async () => {
    try {
      const user = await signInWithGoogle();
      showToast(`เชื่อมต่อ Cloud สำเร็จ: ${user.email || user.displayName}`, 'success');
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        showToast('ไม่สามารถเชื่อมต่อบัญชี Google ได้ กรุณาลองใหม่อีกครั้ง', 'error');
      }
    }
  }, [showToast]);

  const handleCloudSignOut = useCallback(async () => {
    try {
      await signOutFirebase();
      showToast('ออกจากระบบ Cloud แล้ว (ข้อมูลในเครื่องยังคงอยู่ครบถ้วน)', 'info');
    } catch {
      showToast('เกิดข้อผิดพลาดในการออกจากระบบ Cloud', 'error');
    }
  }, [showToast]);

  const handleManualCloudSync = useCallback(async () => {
    if (!firebaseUser) {
      await handleCloudSignIn();
      return;
    }
    setCloudStatus('syncing');
    try {
      const teamEmails = await fetchWorkspaceAuthorizedEmails(firebaseUser);
      setAuthorizedEmails(teamEmails);
      authorizedEmailsRef.current = teamEmails;

      const res = await syncLocalRecordsToCloud(
        firebaseUser,
        patientsRef.current,
        funeralsRef.current,
        donationsRef.current,
        deliverySettingsRef.current,
        teamEmails
      );
      setCloudStatus('synced');
      setCloudErrorReason(null);
      showToast(
        res.uploaded > 0 || res.deleted > 0
          ? `ซิงค์ข้อมูลกับ Cloud สำเร็จ (อัปโหลด ${res.uploaded} / ลบ ${res.deleted} รายการ)`
          : 'ข้อมูลทั้งหมดตรงกับฐานข้อมูล Cloud แล้ว',
        'success'
      );
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : String(err);
      const isPerm =
        msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('insufficient');
      setCloudStatus('error');
      setCloudErrorReason(isPerm ? 'permission-denied' : 'network');
      showToast(
        isPerm
          ? 'บัญชี Google นี้ยังไม่ได้รับสิทธิ์เข้าถึงข้อมูลกลาง กรุณาใช้บัญชีหลักหรือติดต่อผู้ดูแลระบบ'
          : 'ไม่สามารถซิงค์ข้อมูลขึ้น Cloud ได้ในขณะนี้ ข้อมูลยังคงถูกบันทึกไว้ในเครื่อง',
        isPerm ? 'error' : 'warning'
      );
    }
  }, [firebaseUser, handleCloudSignIn, showToast]);

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

      if (!firebaseUser) return;
      if (deliverySyncTimerRef.current) {
        window.clearTimeout(deliverySyncTimerRef.current);
      }
      setCloudStatus('syncing');
      deliverySyncTimerRef.current = window.setTimeout(() => {
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
    const normalized: PatientRecord = {
      ...savedPatient,
      createdAt: savedPatient.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const safeId = sanitizeFirestoreId(normalized.id, 'pt');
    markPendingUpsert('patients', normalized.id);

    setPatients((prev) => {
      const existsIndex = prev.findIndex((p) => p.id === normalized.id);
      let updated: PatientRecord[];
      if (existsIndex >= 0) {
        updated = [...prev];
        updated[existsIndex] = normalized;
      } else {
        updated = [normalized, ...prev];
      }
      saveStoredPatients(updated);
      return updated;
    });

    if (firebaseUser) {
      setCloudStatus('syncing');
      savePatientToCloud(normalized, firebaseUser, authorizedEmailsRef.current)
        .then(() => {
          clearPendingUpsert('patients', normalized.id);
          clearPendingUpsert('patients', safeId);
          addKnownSyncedIds('patients', [normalized.id, safeId]);
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
    const existing = patients.find((p) => p.id === patientId);
    if (!existing) return;

    const historyEntry: StatusHistoryLog = {
      previousStatus: existing.status,
      newStatus,
      changeDate: todayStr,
      reason,
      officerName: currentAdmin.name,
    };

    const modifiedPatient: PatientRecord = {
      ...existing,
      status: newStatus,
      statusReason: `${reason} (บันทึกโดย ${currentAdmin.name} ณ ${formatThaiDate(todayStr)})`,
      statusHistory: [...(existing.statusHistory || []), historyEntry],
      updatedAt: nowIso,
    };

    const safeId = sanitizeFirestoreId(patientId, 'pt');
    markPendingUpsert('patients', patientId);

    setPatients((prev) => {
      const updated = prev.map((p) => (p.id === patientId ? modifiedPatient : p));
      saveStoredPatients(updated);
      return updated;
    });

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
    const existing = patients.find((p) => p.id === patientId);
    if (!existing) return;

    const historyEntry: StatusHistoryLog = {
      previousStatus: existing.status,
      newStatus: 'active',
      changeDate: todayStr,
      reason: 'กู้คืนสถานะกลับเข้าสู่โครงการ',
      officerName: currentAdmin.name,
    };

    const modifiedPatient: PatientRecord = {
      ...existing,
      status: 'active',
      statusReason: `กู้คืนสถานะกลับเข้าสู่โครงการโดย ${currentAdmin.name} ณ ${formatThaiDate(todayStr)}`,
      statusHistory: [...(existing.statusHistory || []), historyEntry],
      updatedAt: nowIso,
    };

    const safeId = sanitizeFirestoreId(patientId, 'pt');
    markPendingUpsert('patients', patientId);

    setPatients((prev) => {
      const updated = prev.map((p) => (p.id === patientId ? modifiedPatient : p));
      saveStoredPatients(updated);
      return updated;
    });

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
    const existing = patients.find((p) => p.id === patientId);
    if (!existing) return;

    const modifiedPatient: PatientRecord = {
      ...existing,
      deliveries: [delivery, ...(existing.deliveries || [])],
      updatedAt: nowIso,
    };

    const safeId = sanitizeFirestoreId(patientId, 'pt');
    markPendingUpsert('patients', patientId);

    setPatients((prev) => {
      const updated = prev.map((p) => (p.id === patientId ? modifiedPatient : p));
      saveStoredPatients(updated);
      return updated;
    });

    if (firebaseUser) {
      setCloudStatus('syncing');
      saveDeliveryToCloud(modifiedPatient, delivery, firebaseUser, authorizedEmailsRef.current)
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
    const normalized: FuneralAssistanceRecord = {
      ...savedRecord,
      createdAt: savedRecord.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const safeId = sanitizeFirestoreId(normalized.id, 'funeral');
    clearPendingDelete('funerals', normalized.id);
    clearPendingDelete('funerals', safeId);
    markPendingUpsert('funerals', normalized.id);

    setFunerals((prev) => {
      const idx = prev.findIndex((f) => f.id === normalized.id);
      let updated: FuneralAssistanceRecord[];
      if (idx >= 0) {
        updated = [...prev];
        updated[idx] = normalized;
      } else {
        updated = [normalized, ...prev];
      }
      saveStoredFunerals(updated);
      return updated;
    });

    if (firebaseUser) {
      setCloudStatus('syncing');
      saveFuneralToCloud(normalized, firebaseUser, authorizedEmailsRef.current)
        .then(() => {
          clearPendingUpsert('funerals', normalized.id);
          clearPendingUpsert('funerals', safeId);
          addKnownSyncedIds('funerals', [normalized.id, safeId]);
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

    setFunerals((prev) => {
      const updated = prev.filter((f) => f.id !== id);
      saveStoredFunerals(updated);
      return updated;
    });
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
    const normalized: DonationDistributionRecord = {
      ...savedRecord,
      createdAt: savedRecord.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const safeId = sanitizeFirestoreId(normalized.id, 'donation');
    clearPendingDelete('donations', normalized.id);
    clearPendingDelete('donations', safeId);
    markPendingUpsert('donations', normalized.id);

    setDonations((prev) => {
      const idx = prev.findIndex((d) => d.id === normalized.id);
      let updated: DonationDistributionRecord[];
      if (idx >= 0) {
        updated = [...prev];
        updated[idx] = normalized;
      } else {
        updated = [normalized, ...prev];
      }
      saveStoredDonations(updated);
      return updated;
    });

    if (firebaseUser) {
      setCloudStatus('syncing');
      saveDonationToCloud(normalized, firebaseUser, authorizedEmailsRef.current)
        .then(() => {
          clearPendingUpsert('donations', normalized.id);
          clearPendingUpsert('donations', safeId);
          addKnownSyncedIds('donations', [normalized.id, safeId]);
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

    setDonations((prev) => {
      const updated = prev.filter((d) => d.id !== id);
      saveStoredDonations(updated);
      return updated;
    });
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
      importedPatients.forEach((p) => markPendingUpsert('patients', p.id));
      nextPatients = mergeRecordsNonDestructively(importedPatients, patientsRef.current);
      setPatients(nextPatients);
      saveStoredPatients(nextPatients);
    }
    if (importedFunerals && Array.isArray(importedFunerals)) {
      importedFunerals.forEach((f) => markPendingUpsert('funerals', f.id));
      nextFunerals = mergeRecordsNonDestructively(importedFunerals, funeralsRef.current);
      setFunerals(nextFunerals);
      saveStoredFunerals(nextFunerals);
    }
    if (importedDonations && Array.isArray(importedDonations)) {
      importedDonations.forEach((d) => markPendingUpsert('donations', d.id));
      nextDonations = mergeRecordsNonDestructively(importedDonations, donationsRef.current);
      setDonations(nextDonations);
      saveStoredDonations(nextDonations);
    }

    setCurrentTab('list');

    if (firebaseUser) {
      setCloudStatus('syncing');
      try {
        await syncLocalRecordsToCloud(
          firebaseUser,
          nextPatients,
          nextFunerals,
          nextDonations,
          deliverySettingsRef.current,
          authorizedEmailsRef.current
        );
        setCloudStatus('synced');
        showToast('นำเข้าและซิงค์ข้อมูลสำรองขึ้น Cloud สำเร็จแล้ว', 'success');
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
      clearAllStoredPatients();
      clearAllStoredFunerals();
      clearAllStoredDonations();
      clearAllPendingOps();
      clearAllKnownSyncedIds();
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
        onCloudSignIn={handleCloudSignIn}
        onCloudSignOut={handleCloudSignOut}
        onManualCloudSync={handleManualCloudSync}
        externalLoginOpen={isCloudModalOpen}
        onExternalLoginClose={() => setIsCloudModalOpen(false)}
      />

      {/* Main Content Areas */}
      <main className="flex-1 pb-16">
        {/* Cross-Device Cloud Sync Onboarding & Diagnostic Banners */}
        {!firebaseUser && (
          <div className="no-print max-w-7xl mx-auto px-3 sm:px-4 pt-4">
            <div className="bg-amber-50 border border-amber-300 rounded-2xl p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3 shadow-xs">
              <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                <div className="p-2 bg-amber-100 text-amber-700 rounded-xl shrink-0">
                  <CloudOff className="w-5 h-5" />
                </div>
                <div className="text-xs text-amber-950">
                  <div className="font-bold text-sm">
                    เครื่องนี้ยังไม่ได้เชื่อมต่อฐานข้อมูลกลาง Cloud Firestore
                  </div>
                  <p className="text-amber-800 mt-0.5 leading-relaxed">
                    หากต้องการให้ข้อมูลผู้ป่วย คำร้องเผาศพ แผนส่งมอบ และสิ่งของบริจาคแสดงผลตรงกันและแก้ไขร่วมกันได้ทุกเครื่อง กรุณาเข้าสู่ระบบด้วยบัญชี Google ({SUPER_ADMIN_EMAIL} หรือบัญชีทีมที่ได้รับอนุญาต)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloudSignIn}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-2 cursor-pointer shrink-0"
              >
                <Cloud className="w-4 h-4" />
                <span>เชื่อมต่อ Google เพื่อซิงค์ข้อมูลข้ามเครื่อง</span>
              </button>
            </div>
          </div>
        )}

        {firebaseUser && cloudErrorReason === 'permission-denied' && (
          <div className="no-print max-w-7xl mx-auto px-3 sm:px-4 pt-4">
            <div className="bg-red-50 border border-red-300 rounded-2xl p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3 shadow-xs">
              <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                <div className="p-2 bg-red-100 text-red-700 rounded-xl shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="text-xs text-red-950">
                  <div className="font-bold text-sm">
                    บัญชี {firebaseUser.email} ยังไม่ได้รับสิทธิ์เข้าถึงฐานข้อมูลกลาง
                  </div>
                  <p className="text-red-800 mt-0.5 leading-relaxed">
                    กรุณาสลับไปใช้บัญชีหลัก ({SUPER_ADMIN_EMAIL}) หรือให้ผู้ดูแลระบบเพิ่มอีเมลนี้ในหน้าจัดการสิทธิ์ Cloud
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCloudModalOpen(true)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer shrink-0"
              >
                สลับบัญชี / จัดการสิทธิ์ Cloud
              </button>
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
