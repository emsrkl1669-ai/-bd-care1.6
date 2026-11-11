import React, { useState, useEffect } from 'react';
import { 
  ADMIN_USERS, 
  AdminUser, 
  PatientRecord, 
  PatientStatus, 
  MonthlyDelivery,
  FuneralAssistanceRecord,
  DonationDistributionRecord
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
  saveStoredAdminId 
} from './utils/storage';
import { Header } from './components/Header';
import { PatientList } from './components/PatientList';
import { PatientForm } from './components/PatientForm';
import { DeliveryPlan } from './components/DeliveryPlan';
import { Dashboard } from './components/Dashboard';
import { ArchiveView } from './components/ArchiveView';
import { FuneralAssistanceView } from './components/FuneralAssistanceView';
import { DonationView } from './components/DonationView';
import { formatThaiDate } from './utils/idCard';

export default function App() {
  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [funerals, setFunerals] = useState<FuneralAssistanceRecord[]>([]);
  const [donations, setDonations] = useState<DonationDistributionRecord[]>([]);
  const [currentTab, setCurrentTab] = useState<string>('list');
  const [editingPatient, setEditingPatient] = useState<PatientRecord | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

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

  // Save current admin change
  const handleChangeAdmin = (admin: AdminUser) => {
    setCurrentAdmin(admin);
    saveStoredAdminId(admin.id);
  };

  // Load stored patients, funerals, and donations
  useEffect(() => {
    const localData = getStoredPatients();
    setPatients(localData);
    saveStoredPatients(localData);

    const localFunerals = getStoredFunerals();
    setFunerals(localFunerals);

    const localDonations = getStoredDonations();
    setDonations(localDonations);
  }, []);

  // Save or update a patient
  const handleSavePatient = (savedPatient: PatientRecord) => {
    setPatients((prev) => {
      const existsIndex = prev.findIndex((p) => p.id === savedPatient.id);
      let updated: PatientRecord[];
      if (existsIndex >= 0) {
        updated = [...prev];
        updated[existsIndex] = savedPatient;
      } else {
        updated = [savedPatient, ...prev];
      }
      saveStoredPatients(updated);
      return updated;
    });

    setEditingPatient(null);
    setCurrentTab('list');
  };

  // Archive a patient (change status to deceased/moved/rejected with recorded reason)
  const handleArchivePatient = (
    patientId: string,
    newStatus: PatientStatus,
    reason: string
  ) => {
    setPatients((prev) => {
      const updated = prev.map((p) => {
        if (p.id === patientId) {
          return {
            ...p,
            status: newStatus,
            statusReason: `${reason} (บันทึกโดย ${currentAdmin.name} ณ ${formatThaiDate(new Date().toISOString().slice(0, 10))})`,
            updatedAt: new Date().toISOString(),
          };
        }
        return p;
      });
      saveStoredPatients(updated);
      return updated;
    });
  };

  // Restore patient from archive back to active
  const handleRestorePatient = (patientId: string) => {
    setPatients((prev) => {
      const updated = prev.map((p) => {
        if (p.id === patientId) {
          return {
            ...p,
            status: 'active' as PatientStatus,
            statusReason: `กู้คืนสถานะกลับเข้าสู่โครงการโดย ${currentAdmin.name} ณ ${formatThaiDate(new Date().toISOString().slice(0, 10))}`,
            updatedAt: new Date().toISOString(),
          };
        }
        return p;
      });
      saveStoredPatients(updated);
      return updated;
    });
  };

  // Record a monthly delivery
  const handleRecordDelivery = (patientId: string, delivery: MonthlyDelivery) => {
    setPatients((prev) => {
      const updated = prev.map((p) => {
        if (p.id === patientId) {
          return {
            ...p,
            deliveries: [delivery, ...(p.deliveries || [])],
            updatedAt: new Date().toISOString(),
          };
        }
        return p;
      });
      saveStoredPatients(updated);
      return updated;
    });
  };

  // Save or update funeral assistance record
  const handleSaveFuneral = (savedRecord: FuneralAssistanceRecord) => {
    setFunerals((prev) => {
      const idx = prev.findIndex((f) => f.id === savedRecord.id);
      let updated: FuneralAssistanceRecord[];
      if (idx >= 0) {
        updated = [...prev];
        updated[idx] = savedRecord;
      } else {
        updated = [savedRecord, ...prev];
      }
      saveStoredFunerals(updated);
      return updated;
    });
  };

  // Delete funeral assistance record
  const handleDeleteFuneral = (id: string) => {
    setFunerals((prev) => {
      const updated = prev.filter((f) => f.id !== id);
      saveStoredFunerals(updated);
      return updated;
    });
  };

  // Save or update donation record
  const handleSaveDonation = (savedRecord: DonationDistributionRecord) => {
    setDonations((prev) => {
      const idx = prev.findIndex((d) => d.id === savedRecord.id);
      let updated: DonationDistributionRecord[];
      if (idx >= 0) {
        updated = [...prev];
        updated[idx] = savedRecord;
      } else {
        updated = [savedRecord, ...prev];
      }
      saveStoredDonations(updated);
      return updated;
    });
  };

  // Delete donation record
  const handleDeleteDonation = (id: string) => {
    setDonations((prev) => {
      const updated = prev.filter((d) => d.id !== id);
      saveStoredDonations(updated);
      return updated;
    });
  };

  // Import full JSON backup
  const handleImportBackup = (
    importedPatients: PatientRecord[], 
    importedFunerals?: FuneralAssistanceRecord[],
    importedDonations?: DonationDistributionRecord[]
  ) => {
    if (importedPatients && Array.isArray(importedPatients)) {
      setPatients(importedPatients);
      saveStoredPatients(importedPatients);
    }
    if (importedFunerals && Array.isArray(importedFunerals)) {
      setFunerals(importedFunerals);
      saveStoredFunerals(importedFunerals);
    }
    if (importedDonations && Array.isArray(importedDonations)) {
      setDonations(importedDonations);
      saveStoredDonations(importedDonations);
    }
    setCurrentTab('list');
  };

  // Clear all data
  const handleClearAll = () => {
    if (confirm('คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลทั้งหมดในระบบ? การกระทำนี้ไม่สามารถย้อนกลับได้')) {
      clearAllStoredPatients();
      clearAllStoredFunerals();
      clearAllStoredDonations();
      setPatients([]);
      setFunerals([]);
      setDonations([]);
      alert('ลบข้อมูลทั้งหมดเรียบร้อยแล้ว');
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

        {currentTab === 'dashboard' && (
          <Dashboard patients={patients} />
        )}

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
            ระบบแบบฟอร์ม สค.04 ดิจิทัล • ฐานข้อมูลพร้อมใช้งาน
          </div>
        </div>
      </footer>
    </div>
  );
}
