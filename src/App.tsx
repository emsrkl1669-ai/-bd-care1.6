import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User } from 'firebase/auth';
import {
  ADMIN_USERS,
  AdminUser,
  PatientRecord,
  PatientStatus,
  MonthlyDelivery,
  StatusHistoryLog,
  FuneralAssistanceRecord,
  DonationDistributionRecord,
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
import {
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
  savePatientToCloud,
  saveDeliveryToCloud,
  saveFuneralToCloud,
  deleteFuneralFromCloud,
  saveDonationToCloud,
  deleteDonationFromCloud,
} from './services/firestoreSync';

function AppContent() {
  const { showToast, confirmDialog } = useUiFeedback();

  const [patients, setPatients] = useState<PatientRecord[]>(() => getStoredPatients());
  const [funerals, setFunerals] = useState<FuneralAssistanceRecord[]>(() => getStoredFunerals());
  const [donations, setDonations] = useState<DonationDistributionRecord[]>(() => getStoredDonations());
  const [currentTab, setCurrentTab] = useState<string>('list');
  const [editingPatient, setEditingPatient] = useState<PatientRecord | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  // Firebase Auth & Sync states
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [cloudStatus, setCloudStatus] = useState<'disconnected' | 'syncing' | 'synced' | 'error'>('disconnected');

  // Refs for latest state inside async callbacks
  const patientsRef = useRef<PatientRecord[]>(patients);
  const funeralsRef = useRef<FuneralAssistanceRecord[]>(funerals);
  const donationsRef = useRef<DonationDistributionRecord[]>(donations);
  const deletedFuneralsRef = useRef<Set<string>>(new Set());
  const deletedDonationsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    patientsRef.current = patients;
  }, [patients]);

  useEffect(() => {
    funeralsRef.current = funerals;
  }, [funerals]);

  useEffect(() => {
    donationsRef.current = donations;
  }, [donations]);

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

    const unsubAuth = subscribeToAuth(async (user) => {
      setFirebaseUser(user);
      if (unsubCloud) {
        unsubCloud();
        unsubCloud = null;
      }

      if (!user) {
        setCloudStatus('disconnected');
        return;
      }

      setCloudStatus('syncing');
      try {
        await ensureSuperAdminDirectory(user);

        // Migrate / upload any unsynced local records first so zero local data is lost
        const migration = await syncLocalRecordsToCloud(
          user,
          patientsRef.current,
          funeralsRef.current,
          donationsRef.current
        );
        if (migration.uploaded > 0) {
          showToast(`ซิงค์ข้อมูลจากเครื่องขึ้น Cloud Firestore สำเร็จ ${migration.uploaded} รายการ`, 'success');
        }

        unsubCloud = subscribeToCloudCollections(user, {
          onPatients: (cloudPatients) => {
            setPatients((prevLocal) => {
              const merged = mergeRecordsNonDestructively(cloudPatients, prevLocal);
              saveStoredPatients(merged);
              return merged;
            });
            setCloudStatus('synced');
          },
          onFunerals: (cloudFunerals) => {
            setFunerals((prevLocal) => {
              const merged = mergeRecordsNonDestructively(
                cloudFunerals,
                prevLocal,
                deletedFuneralsRef.current
              );
              saveStoredFunerals(merged);
              return merged;
            });
            setCloudStatus('synced');
          },
          onDonations: (cloudDonations) => {
            setDonations((prevLocal) => {
              const merged = mergeRecordsNonDestructively(
                cloudDonations,
                prevLocal,
                deletedDonationsRef.current
              );
              saveStoredDonations(merged);
              return merged;
            });
            setCloudStatus('synced');
          },
          onError: () => {
            setCloudStatus('error');
          },
        });
      } catch (err) {
        console.error('Firebase sync initialization failed:', err);
        setCloudStatus('error');
      }
    });

    return () => {
      unsubAuth();
      if (unsubCloud) unsubCloud();
    };
  }, [showToast]);

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
      const res = await syncLocalRecordsToCloud(
        firebaseUser,
        patientsRef.current,
        funeralsRef.current,
        donationsRef.current
      );
      setCloudStatus('synced');
      showToast(
        res.uploaded > 0
          ? `ซิงค์ข้อมูลขึ้น Cloud สำเร็จ ${res.uploaded} รายการ`
          : 'ข้อมูลทั้งหมดตรงกับฐานข้อมูล Cloud แล้ว',
        'success'
      );
    } catch {
      setCloudStatus('error');
      showToast('ไม่สามารถซิงค์ข้อมูลขึ้น Cloud ได้ในขณะนี้ ข้อมูลยังคงถูกบันทึกไว้ในเครื่อง', 'warning');
    }
  }, [firebaseUser, handleCloudSignIn, showToast]);

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
      savePatientToCloud(normalized, firebaseUser)
        .then(() => setCloudStatus('synced'))
        .catch(() => {
          setCloudStatus('error');
          showToast('บันทึกในเครื่องแล้ว แต่ซิงค์ขึ้น Cloud ไม่สำเร็จชั่วคราว', 'warning');
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

    setPatients((prev) => {
      const updated = prev.map((p) => (p.id === patientId ? modifiedPatient : p));
      saveStoredPatients(updated);
      return updated;
    });

    if (firebaseUser) {
      setCloudStatus('syncing');
      savePatientToCloud(modifiedPatient, firebaseUser)
        .then(() => setCloudStatus('synced'))
        .catch(() => setCloudStatus('error'));
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

    setPatients((prev) => {
      const updated = prev.map((p) => (p.id === patientId ? modifiedPatient : p));
      saveStoredPatients(updated);
      return updated;
    });

    if (firebaseUser) {
      setCloudStatus('syncing');
      savePatientToCloud(modifiedPatient, firebaseUser)
        .then(() => setCloudStatus('synced'))
        .catch(() => setCloudStatus('error'));
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

    setPatients((prev) => {
      const updated = prev.map((p) => (p.id === patientId ? modifiedPatient : p));
      saveStoredPatients(updated);
      return updated;
    });

    if (firebaseUser) {
      setCloudStatus('syncing');
      saveDeliveryToCloud(modifiedPatient, delivery, firebaseUser)
        .then(() => setCloudStatus('synced'))
        .catch(() => setCloudStatus('error'));
    }
  };

  // Save or update funeral assistance record
  const handleSaveFuneral = (savedRecord: FuneralAssistanceRecord) => {
    const normalized: FuneralAssistanceRecord = {
      ...savedRecord,
      createdAt: savedRecord.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    deletedFuneralsRef.current.delete(normalized.id);

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
      saveFuneralToCloud(normalized, firebaseUser)
        .then(() => setCloudStatus('synced'))
        .catch(() => setCloudStatus('error'));
    }
    showToast(`บันทึกคำร้องอนุเคราะห์เผาศพ (${normalized.code}) เรียบร้อยแล้ว`, 'success');
  };

  // Delete funeral assistance record
  const handleDeleteFuneral = (id: string) => {
    deletedFuneralsRef.current.add(id);
    setFunerals((prev) => {
      const updated = prev.filter((f) => f.id !== id);
      saveStoredFunerals(updated);
      return updated;
    });
    if (firebaseUser) {
      deleteFuneralFromCloud(id).catch(() => setCloudStatus('error'));
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
    deletedDonationsRef.current.delete(normalized.id);

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
      saveDonationToCloud(normalized, firebaseUser)
        .then(() => setCloudStatus('synced'))
        .catch(() => setCloudStatus('error'));
    }
    showToast(`บันทึกการบริจาคสิ่งของ (${normalized.code}) เรียบร้อยแล้ว`, 'success');
  };

  // Delete donation record
  const handleDeleteDonation = (id: string) => {
    deletedDonationsRef.current.add(id);
    setDonations((prev) => {
      const updated = prev.filter((d) => d.id !== id);
      saveStoredDonations(updated);
      return updated;
    });
    if (firebaseUser) {
      deleteDonationFromCloud(id).catch(() => setCloudStatus('error'));
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
      nextPatients = mergeRecordsNonDestructively(importedPatients, patientsRef.current);
      setPatients(nextPatients);
      saveStoredPatients(nextPatients);
    }
    if (importedFunerals && Array.isArray(importedFunerals)) {
      nextFunerals = mergeRecordsNonDestructively(importedFunerals, funeralsRef.current);
      setFunerals(nextFunerals);
      saveStoredFunerals(nextFunerals);
    }
    if (importedDonations && Array.isArray(importedDonations)) {
      nextDonations = mergeRecordsNonDestructively(importedDonations, donationsRef.current);
      setDonations(nextDonations);
      saveStoredDonations(nextDonations);
    }

    setCurrentTab('list');

    if (firebaseUser) {
      setCloudStatus('syncing');
      try {
        await syncLocalRecordsToCloud(firebaseUser, nextPatients, nextFunerals, nextDonations);
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
        onCloudSignIn={handleCloudSignIn}
        onCloudSignOut={handleCloudSignOut}
        onManualCloudSync={handleManualCloudSync}
      />

      {/* Main Content Areas */}
      <main className="flex-1 pb-16">
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
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700">BD-Care</span>
            <span>• โครงการใจถึงใจช่วยผู้ป่วยติดเตียงและยากไร้ มูลนิธิร่วมกุศลสมุทรปราการ (北欖天德善堂)</span>
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
