import React, { useState, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import {
  Users,
  UserPlus,
  Package,
  BarChart3,
  Archive,
  Download,
  Upload,
  FileSpreadsheet,
  Wifi,
  WifiOff,
  ChevronDown,
  HeartHandshake,
  Lock,
  Key,
  Gift,
  Cloud,
  CloudOff,
  RefreshCw,
  LogOut,
} from 'lucide-react';
import {
  AdminUser,
  PatientRecord,
  FuneralAssistanceRecord,
  DonationDistributionRecord,
  AccessRequestRecord,
} from '../types';
import {
  exportToCsv,
  exportPatientsToExcel,
  exportBackupJson,
  exportFuneralsToCsv,
  exportDonationsToCsv,
} from '../utils/storage';
import { LoginModal } from './LoginModal';
import { useUiFeedback } from './UiFeedback';
import { firebaseConfig } from '../firebase';
import { parseBackupOrExcelFile } from '../utils/csvPatientImport';

interface HeaderProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  currentAdmin: AdminUser;
  setCurrentAdmin: (admin: AdminUser) => void;
  patients: PatientRecord[];
  funerals?: FuneralAssistanceRecord[];
  donations?: DonationDistributionRecord[];
  onImportBackup: (
    importedPatients: PatientRecord[],
    importedFunerals?: FuneralAssistanceRecord[],
    importedDonations?: DonationDistributionRecord[]
  ) => void;
  isOnline: boolean;
  firebaseUser?: User | null;
  cloudStatus?: 'disconnected' | 'syncing' | 'synced' | 'error';
  cloudErrorReason?: 'permission-denied' | 'network' | null;
  authorizedEmails?: string[];
  onSaveAuthorizedEmails?: (emails: string[]) => Promise<void>;
  onRegisterCreatedStaff?: (uid: string, email: string, displayName: string) => Promise<void>;
  onSwitchUserAccount?: (username: string, password: string) => Promise<void>;
  onCloudSignOut?: () => void;
  onManualCloudSync?: () => void;
  externalLoginOpen?: boolean;
  onExternalLoginClose?: () => void;
  myAccessRequest?: AccessRequestRecord | null;
  isSubmittingRequest?: boolean;
  onSubmitAccessRequest?: (note?: string) => Promise<void>;
  pendingAccessRequests?: AccessRequestRecord[];
  onApproveAccessRequest?: (req: AccessRequestRecord) => Promise<void>;
  onRejectAccessRequest?: (req: AccessRequestRecord) => Promise<void>;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  setCurrentTab,
  currentAdmin,
  setCurrentAdmin,
  patients,
  funerals = [],
  donations = [],
  onImportBackup,
  isOnline,
  firebaseUser = null,
  cloudStatus = 'disconnected',
  cloudErrorReason = null,
  authorizedEmails,
  onSaveAuthorizedEmails,
  onRegisterCreatedStaff,
  onSwitchUserAccount,
  onCloudSignOut,
  onManualCloudSync,
  externalLoginOpen = false,
  onExternalLoginClose,
  myAccessRequest = null,
  isSubmittingRequest = false,
  onSubmitAccessRequest,
  pendingAccessRequests = [],
  onApproveAccessRequest,
  onRejectAccessRequest,
}) => {
  const { showToast } = useUiFeedback();
  const [isAdminDropdownOpen, setIsAdminDropdownOpen] = useState(false);
  const [isBackupMenuOpen, setIsBackupMenuOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const adminDropdownRef = useRef<HTMLDivElement>(null);
  const backupMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (isAdminDropdownOpen && adminDropdownRef.current && target && !adminDropdownRef.current.contains(target)) {
        setIsAdminDropdownOpen(false);
      }
      if (isBackupMenuOpen && backupMenuRef.current && target && !backupMenuRef.current.contains(target)) {
        setIsBackupMenuOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsAdminDropdownOpen(false);
        setIsBackupMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isAdminDropdownOpen, isBackupMenuOpen]);

  const activePatientsCount = patients.filter((p) => p.status === 'active').length;
  const archivedCount = patients.filter((p) =>
    ['deceased', 'moved', 'rejected'].includes(p.status)
  ).length;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      const parsed = await parseBackupOrExcelFile(file);
      const totalCount =
        parsed.patients.length +
        (parsed.funerals?.length || 0) +
        (parsed.donations?.length || 0);
      if (totalCount === 0) {
        showToast('ไม่พบข้อมูลผู้ป่วยหรือข้อมูลสำรองในไฟล์ที่เลือก', 'warning');
        return;
      }
      onImportBackup(parsed.patients, parsed.funerals, parsed.donations);
    } catch {
      showToast(
        'ไม่สามารถอ่านไฟล์สำรองได้ รองรับ .json (มาตรฐาน/LocalStorage), .xlsx, .xls และ .csv',
        'error'
      );
    }
  };

  return (
    <header className="no-print w-full bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
      <div className="w-full px-2.5 sm:px-4 lg:px-6 py-1.5 sm:py-2 flex flex-wrap items-center justify-between gap-2">
        {/* Brand & Logo */}
        <div
          onClick={() => setCurrentTab('list')}
          className="flex items-center gap-2 sm:gap-2.5 cursor-pointer group shrink-0 min-w-0"
        >
          <img
            src="/assets/aistudio/382492-Photoroom_4c9e02f3.png"
            alt="ตรามูลนิธิร่วมกุศลสมุทรปราการ"
            className="w-8 h-8 sm:w-9 sm:h-9 object-contain drop-shadow-xs group-hover:scale-105 transition-transform shrink-0"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm sm:text-base font-extrabold tracking-tight text-slate-900">
                BD-Care
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 shrink-0">
                สค.04
              </span>
              <span className="hidden 2xl:inline text-[11px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.2 rounded border border-red-200 shrink-0">
                北欖天德善堂
              </span>
            </div>
            <p className="text-[10.5px] text-slate-500 font-medium leading-none hidden sm:block truncate max-w-[260px] md:max-w-xs xl:max-w-none">
              โครงการใจถึงใจช่วยผู้ป่วยติดเตียงและยากไร้ มูลนิธิร่วมกุศลสมุทรปราการ
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="order-3 w-full xl:order-none xl:w-auto flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5 border-t border-slate-100 pt-1.5 xl:border-t-0 xl:pt-0.5">
          <button
            onClick={() => setCurrentTab('list')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
              currentTab === 'list'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>ทะเบียนผู้ป่วย</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                currentTab === 'list' ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {activePatientsCount}
            </span>
          </button>

          <button
            onClick={() => setCurrentTab('new')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
              currentTab === 'new'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>+ บันทึก สค.04</span>
          </button>

          <button
            onClick={() => setCurrentTab('funerals')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
              currentTab === 'funerals'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-amber-900 bg-amber-50/80 hover:bg-amber-100 hover:text-amber-950 border border-amber-200'
            }`}
          >
            <HeartHandshake className="w-3.5 h-3.5" />
            <span>อนุเคราะห์เผาศพ</span>
            {funerals.length > 0 && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  currentTab === 'funerals' ? 'bg-amber-700 text-white' : 'bg-amber-200 text-amber-900'
                }`}
              >
                {funerals.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setCurrentTab('donations')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
              currentTab === 'donations'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-rose-900 bg-rose-50/80 hover:bg-rose-100 hover:text-rose-950 border border-rose-200'
            }`}
          >
            <Gift className="w-3.5 h-3.5" />
            <span>บริจาคสิ่งของ</span>
            {donations.length > 0 && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  currentTab === 'donations' ? 'bg-rose-700 text-white' : 'bg-rose-200 text-rose-900'
                }`}
              >
                {donations.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setCurrentTab('deliveries')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
              currentTab === 'deliveries'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>แผนส่งมอบของ</span>
          </button>

          <button
            onClick={() => setCurrentTab('dashboard')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
              currentTab === 'dashboard'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>สถิติ/สต็อก</span>
          </button>

          <button
            onClick={() => setCurrentTab('archive')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
              currentTab === 'archive'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Archive className="w-3.5 h-3.5" />
            <span>คลังประวัติ</span>
            {archivedCount > 0 && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  currentTab === 'archive' ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {archivedCount}
              </span>
            )}
          </button>
        </nav>

        {/* Right Controls: Cloud Sync, Admin Switcher, and Backup */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Cloud Sync Quick Button */}
          {firebaseUser ? (
            <button
              type="button"
              onClick={onManualCloudSync}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition cursor-pointer ${
                cloudStatus === 'syncing'
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : cloudStatus === 'error'
                  ? 'bg-red-50 text-red-700 border-red-200'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
              }`}
              title={`ฐานข้อมูล Cloud Firestore (${firebaseConfig.projectId}) • ผู้ใช้: ${currentAdmin.username} • คลิกเพื่อซิงค์ทันที`}
            >
              {cloudStatus === 'syncing' ? (
                <RefreshCw className="w-3 h-3 animate-spin text-blue-600" />
              ) : (
                <Cloud className="w-3 h-3 text-emerald-600" />
              )}
              <span className="hidden sm:inline">
                {cloudStatus === 'syncing'
                  ? 'กำลังซิงค์...'
                  : cloudErrorReason === 'permission-denied'
                  ? 'รอสิทธิ์เข้าใช้งาน'
                  : 'Cloud ซิงค์แล้ว'}
              </span>
              {pendingAccessRequests.length > 0 && (
                <span
                  className="ml-0.5 px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[10px] font-bold"
                  title={`มีคำขอสิทธิ์จากอุปกรณ์อื่น ${pendingAccessRequests.length} รายการ`}
                >
                  {pendingAccessRequests.length}
                </span>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsLoginModalOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 transition cursor-pointer"
              title="เข้าสู่ระบบด้วย Username และ Password เพื่อซิงค์ Cloud"
            >
              <CloudOff className="w-3 h-3 text-amber-600" />
              <span className="hidden sm:inline">เชื่อมต่อ Cloud</span>
            </button>
          )}

          {/* Online badge */}
          <div className="hidden xl:flex items-center text-[11px]">
            {isOnline ? (
              <span className="flex items-center gap-1 text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                <Wifi className="w-3 h-3 text-emerald-600" /> ออนไลน์
              </span>
            ) : (
              <span className="flex items-center gap-1 text-amber-800 font-medium bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                <WifiOff className="w-3 h-3 text-amber-600" /> ออฟไลน์
              </span>
            )}
          </div>

          {/* Authenticated User Account & Login Button */}
          <div className="relative" ref={adminDropdownRef}>
            <button
              onClick={() => {
                setIsBackupMenuOpen(false);
                setIsAdminDropdownOpen(!isAdminDropdownOpen);
              }}
              className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer border border-slate-200 text-slate-800"
              title="บัญชีผู้ใช้งานปัจจุบัน • คลิกเพื่อเข้าสู่ระบบบัญชีอื่นหรือจัดการสิทธิ์"
            >
              <div className={`w-2 h-2 rounded-full shrink-0 ${currentAdmin.avatarColor}`} />
              <div className="flex flex-col text-left">
                <span className="font-bold text-[11px] sm:text-[11.5px] max-w-[84px] sm:max-w-[140px] lg:max-w-none truncate leading-tight">
                  {currentAdmin.name}
                </span>
                <span className="text-[9.5px] sm:text-[10px] text-blue-700 font-medium leading-none max-w-[84px] sm:max-w-none truncate">
                  @{currentAdmin.username} • {currentAdmin.roleTitle.replace('(Admin)', '').trim()}
                </span>
              </div>
              <ChevronDown className="w-3 h-3 text-slate-500 ml-0.5 shrink-0" />
            </button>

            {isAdminDropdownOpen && (
              <div
                className="absolute right-0 mt-2 w-[min(18rem,calc(100vw-1.5rem))] bg-white rounded-xl shadow-2xl border border-slate-200 py-2 z-50 text-slate-800"
              >
                <div className="px-3.5 py-2 border-b border-slate-100 bg-slate-50">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    บัญชีที่เข้าสู่ระบบอยู่
                  </div>
                  <div className="font-bold text-xs text-slate-900 mt-0.5 truncate">
                    {currentAdmin.name}
                  </div>
                  <div className="text-[11px] text-blue-700 font-medium truncate">
                    {currentAdmin.roleTitle}
                  </div>
                  <div className="text-[10.5px] text-slate-500 font-mono mt-0.5">
                    Username: {currentAdmin.username}
                  </div>
                </div>

                <div className="p-2 space-y-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAdminDropdownOpen(false);
                      setIsLoginModalOpen(true);
                    }}
                    className="w-full py-2 px-3 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer"
                  >
                    <Key className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span>สลับบัญชีด้วย Username / Password</span>
                  </button>

                  {onCloudSignOut && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsAdminDropdownOpen(false);
                        onCloudSignOut();
                      }}
                      className="w-full py-2 px-3 bg-white hover:bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5 shrink-0" />
                      <span>ออกจากระบบ</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Tools Menu (CSV & Backup) */}
          <div className="relative" ref={backupMenuRef}>
            <button
              onClick={() => {
                setIsAdminDropdownOpen(false);
                setIsBackupMenuOpen(!isBackupMenuOpen);
              }}
              className="p-1.5 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer border border-slate-200"
              title="สำรองข้อมูล / ส่งออก Excel"
            >
              <Download className="w-3.5 h-3.5" />
            </button>

            {isBackupMenuOpen && (
              <div
                className="absolute right-0 mt-2 w-[min(16.5rem,calc(100vw-1.5rem))] bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 text-slate-700"
              >
                {firebaseUser && onManualCloudSync && (
                  <>
                    <button
                      onClick={() => {
                        setIsBackupMenuOpen(false);
                        onManualCloudSync();
                      }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 hover:text-blue-800 flex items-center gap-2 cursor-pointer"
                    >
                      <RefreshCw className="w-4 h-4 text-blue-600" />
                      <div>
                        <div className="font-semibold text-slate-800">ซิงค์ & ดึงข้อมูลคืนจาก Cloud</div>
                        <div className="text-[10px] text-slate-500">ปรับข้อมูลทุกเครื่องให้ตรงกันล่าสุด</div>
                      </div>
                    </button>
                    <div className="border-t border-slate-100 my-1" />
                  </>
                )}

                <button
                  onClick={() => {
                    exportPatientsToExcel(patients);
                    setIsBackupMenuOpen(false);
                    showToast(`ส่งออกไฟล์ Excel (${patients.length} ราย) เรียบร้อยแล้ว`, 'success');
                  }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-emerald-50 hover:text-emerald-800 flex items-center gap-2 cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <div>
                    <div className="font-semibold text-slate-800">ส่งออก Excel ทะเบียนผู้ป่วย (.xlsx)</div>
                    <div className="text-[10px] text-slate-500">เปิดแก้ไขได้ทันทีใน Microsoft Excel</div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    exportToCsv(patients);
                    setIsBackupMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-emerald-50 hover:text-emerald-800 flex items-center gap-2 cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 text-teal-600" />
                  <div>
                    <div className="font-semibold text-slate-800">ส่งออก CSV ทะเบียนผู้ป่วย (UTF-8)</div>
                    <div className="text-[10px] text-slate-500">รองรับ UTF-8 ตัวอักษรไทยไม่เพี้ยน</div>
                  </div>
                </button>

                {funerals.length > 0 && (
                  <button
                    onClick={() => {
                      exportFuneralsToCsv(funerals);
                      setIsBackupMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-amber-50 hover:text-amber-800 flex items-center gap-2 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-amber-600" />
                    <div>
                      <div className="font-semibold text-slate-800">ส่งออก Excel อนุเคราะห์เผาศพ</div>
                      <div className="text-[10px] text-slate-500">ข้อมูลคำร้องและเอกสาร 7 รายการ</div>
                    </div>
                  </button>
                )}

                {donations.length > 0 && (
                  <button
                    onClick={() => {
                      exportDonationsToCsv(donations);
                      setIsBackupMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-rose-50 hover:text-rose-800 flex items-center gap-2 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-rose-600" />
                    <div>
                      <div className="font-semibold text-slate-800">ส่งออก Excel บริจาคสิ่งของ</div>
                      <div className="text-[10px] text-slate-500">ข้อมูลผู้รับ, สิ่งของ และหน่วยงาน</div>
                    </div>
                  </button>
                )}

                <button
                  onClick={() => {
                    exportBackupJson(patients, funerals, donations);
                    setIsBackupMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 hover:text-blue-800 flex items-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4 text-blue-600" />
                  <div>
                    <div className="font-semibold text-slate-800">สำรองฐานข้อมูลทั้งหมด (Backup JSON)</div>
                    <div className="text-[10px] text-slate-500">เก็บรูปถ่าย ประวัติ เอกสาร และบันทึกบริจาค</div>
                  </div>
                </button>

                <div className="border-t border-slate-100 my-1" />

                <button
                  onClick={() => {
                    fileInputRef.current?.click();
                    setIsBackupMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-amber-50 hover:text-amber-800 flex items-center gap-2 cursor-pointer"
                >
                  <Upload className="w-4 h-4 text-amber-600" />
                  <div>
                    <div className="font-semibold text-slate-800">นำเข้า / กู้คืน (.json / .xlsx / .csv)</div>
                    <div className="text-[10px] text-slate-500">อัปโหลดขึ้น Cloud Database อัตโนมัติ</div>
                  </div>
                </button>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        </div>
      </div>

      {/* Login / Switch Account Modal */}
      <LoginModal
        currentAdmin={currentAdmin}
        isOpen={isLoginModalOpen || externalLoginOpen}
        onClose={() => {
          setIsLoginModalOpen(false);
          onExternalLoginClose?.();
        }}
        onLoginSuccess={(newAdmin) => {
          setCurrentAdmin(newAdmin);
        }}
        firebaseUser={firebaseUser}
        cloudStatus={cloudStatus}
        cloudErrorReason={cloudErrorReason}
        authorizedEmails={authorizedEmails}
        onSaveAuthorizedEmails={onSaveAuthorizedEmails}
        onRegisterCreatedStaff={onRegisterCreatedStaff}
        onSwitchUserAccount={onSwitchUserAccount}
        onCloudSignOut={onCloudSignOut}
        onManualCloudSync={onManualCloudSync}
        myAccessRequest={myAccessRequest}
        isSubmittingRequest={isSubmittingRequest}
        onSubmitAccessRequest={onSubmitAccessRequest}
        pendingAccessRequests={pendingAccessRequests}
        onApproveAccessRequest={onApproveAccessRequest}
        onRejectAccessRequest={onRejectAccessRequest}
      />
    </header>
  );
};
