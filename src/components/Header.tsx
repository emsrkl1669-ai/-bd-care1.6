import React, { useState } from 'react';
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
  Trash2, 
  Lock, 
  Key, 
  ShieldCheck, 
  UserCheck,
  Gift 
} from 'lucide-react';
import { ADMIN_USERS, AdminUser, PatientRecord, FuneralAssistanceRecord, DonationDistributionRecord } from '../types';
import { exportToCsv, exportBackupJson, exportFuneralsToCsv, exportDonationsToCsv } from '../utils/storage';
import { LoginModal } from './LoginModal';

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
  onClearAll?: () => void;
  isOnline: boolean;
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
  onClearAll,
  isOnline,
}) => {
  const [isAdminDropdownOpen, setIsAdminDropdownOpen] = useState(false);
  const [isBackupMenuOpen, setIsBackupMenuOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const activePatientsCount = patients.filter((p) => p.status === 'active').length;
  const archivedCount = patients.filter((p) => ['deceased', 'moved', 'rejected'].includes(p.status)).length;
  const pendingFuneralsCount = funerals.filter((f) => f.status === 'pending').length;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        if (parsed && Array.isArray(parsed.patients)) {
          onImportBackup(parsed.patients, parsed.funerals, parsed.donations);
          alert(`นำเข้าข้อมูลสำเร็จ: ผู้ป่วย ${parsed.patients.length} ราย, อนุเคราะห์เผาศพ ${parsed.funerals?.length || 0} ราย, บริจาคสิ่งของ ${parsed.donations?.length || 0} ราย`);
        } else if (Array.isArray(parsed)) {
          onImportBackup(parsed);
          alert(`นำเข้าข้อมูลสำเร็จ ${parsed.length} รายการ`);
        } else {
          alert('รูปแบบไฟล์ JSON ไม่ถูกต้อง');
        }
      } catch (err) {
        alert('เกิดข้อผิดพลาดในการอ่านไฟล์สำรองข้อมูล');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <header className="no-print bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
      {/* Sleek, Compact Unified Bar */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-2.5">
        
        {/* Brand & Logo */}
        <div 
          onClick={() => setCurrentTab('list')}
          className="flex items-center gap-2.5 cursor-pointer group shrink-0"
        >
          <img 
            src="/assets/aistudio/382492-Photoroom_4c9e02f3.png" 
            alt="ตรามูลนิธิร่วมกุศลสมุทรปราการ" 
            className="w-9 h-9 object-contain drop-shadow-xs group-hover:scale-105 transition-transform"
          />
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-base font-extrabold tracking-tight text-slate-900">
                BD-Care
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-100 text-blue-800">
                สค.04
              </span>
              <span className="hidden xl:inline text-[11px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.2 rounded border border-red-200">
                北欖天德善堂
              </span>
            </div>
            <p className="text-[10.5px] text-slate-500 font-medium leading-none hidden sm:block">
              โครงการใจถึงใจช่วยผู้ป่วยติดเตียงและยากไร้ มูลนิธิร่วมกุศลสมุทรปราการ
            </p>
          </div>
        </div>

        {/* Navigation Tabs - Sleek & Compact */}
        <nav className="flex items-center gap-1 overflow-x-auto py-0.5">
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
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
              currentTab === 'list' ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
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
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                currentTab === 'funerals' ? 'bg-amber-700 text-white' : 'bg-amber-200 text-amber-900'
              }`}>
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
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                currentTab === 'donations' ? 'bg-rose-700 text-white' : 'bg-rose-200 text-rose-900'
              }`}>
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
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                currentTab === 'archive' ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {archivedCount}
              </span>
            )}
          </button>
        </nav>

        {/* Right Controls: Online Status, Admin Login & Switcher, and Backup */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Online badge */}
          <div className="hidden xl:flex items-center text-[11px]">
            {isOnline ? (
              <span className="flex items-center gap-1 text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                <Wifi className="w-3 h-3 text-emerald-600" /> พร้อมซิงค์
              </span>
            ) : (
              <span className="flex items-center gap-1 text-amber-800 font-medium bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                <WifiOff className="w-3 h-3 text-amber-600" /> ออฟไลน์
              </span>
            )}
          </div>

          {/* Admin Switcher & Login Button */}
          <div className="relative">
            <button
              onClick={() => setIsAdminDropdownOpen(!isAdminDropdownOpen)}
              className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer border border-slate-200 text-slate-800"
              title="คลิกเพื่อสลับผู้ดูแลระบบหรือดูข้อมูลรหัสผ่าน"
            >
              <div className={`w-2 h-2 rounded-full ${currentAdmin.avatarColor}`} />
              <div className="flex flex-col text-left">
                <span className="font-bold text-[11.5px] max-w-[120px] sm:max-w-none truncate leading-tight">
                  {currentAdmin.name}
                </span>
                <span className="text-[10px] text-blue-700 font-medium leading-none">
                  {currentAdmin.roleTitle.replace('(Admin)', '').trim()}
                </span>
              </div>
              <ChevronDown className="w-3 h-3 text-slate-500 ml-0.5" />
            </button>

            {isAdminDropdownOpen && (
              <div 
                className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 py-1.5 z-50 text-slate-800"
                onMouseLeave={() => setIsAdminDropdownOpen(false)}
              >
                <div className="px-3 py-2 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                  <p className="text-[10.5px] font-bold text-slate-600 uppercase tracking-wider">
                    สลับบัญชีผู้ดูแลระบบ (Admin)
                  </p>
                  <button
                    onClick={() => {
                      setIsAdminDropdownOpen(false);
                      setIsLoginModalOpen(true);
                    }}
                    className="text-[11px] text-blue-600 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Key className="w-3 h-3" />
                    <span>ล็อกอินด้วยรหัสผ่าน</span>
                  </button>
                </div>
                {ADMIN_USERS.map((admin) => (
                  <button
                    key={admin.id}
                    onClick={() => {
                      setCurrentAdmin(admin);
                      setIsAdminDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 flex items-start gap-2.5 hover:bg-blue-50 transition cursor-pointer ${
                      currentAdmin.id === admin.id ? 'bg-blue-50/80 border-l-4 border-blue-600' : ''
                    }`}
                  >
                    <div className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 ${admin.avatarColor}`} />
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-slate-900">
                        {admin.name}
                      </div>
                      <div className="text-[11px] text-blue-700 font-medium">
                        {admin.roleTitle}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        User: {admin.username} • Pass: {admin.password}
                      </div>
                    </div>
                  </button>
                ))}

                <div className="border-t border-slate-100 pt-1.5 px-3 pb-1">
                  <button
                    onClick={() => {
                      setIsAdminDropdownOpen(false);
                      setIsLoginModalOpen(true);
                    }}
                    className="w-full py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>เข้าสู่ระบบด้วย Username / Password</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Tools Menu (CSV & Backup) */}
          <div className="relative">
            <button
              onClick={() => setIsBackupMenuOpen(!isBackupMenuOpen)}
              className="p-1.5 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer border border-slate-200"
              title="สำรองข้อมูล / ส่งออก Excel"
            >
              <Download className="w-3.5 h-3.5" />
            </button>

            {isBackupMenuOpen && (
              <div 
                className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 text-slate-700"
                onMouseLeave={() => setIsBackupMenuOpen(false)}
              >
                <button
                  onClick={() => {
                    exportToCsv(patients);
                    setIsBackupMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-emerald-50 hover:text-emerald-800 flex items-center gap-2 cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <div>
                    <div className="font-semibold text-slate-800">ส่งออก Excel ทะเบียนผู้ป่วย (สค.04)</div>
                    <div className="text-[10px] text-slate-500">รองรับ UTF-8 ตัวอักษรไม่เพี้ยน</div>
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
                    <div className="font-semibold text-slate-800">กู้คืนฐานข้อมูล (Restore JSON)</div>
                  </div>
                </button>

                {onClearAll && (
                  <>
                    <div className="border-t border-slate-100 my-1" />
                    <button
                      onClick={() => {
                        setIsBackupMenuOpen(false);
                        onClearAll();
                      }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-red-50 hover:text-red-700 text-red-600 flex items-center gap-2 cursor-pointer font-medium"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                      <div>
                        <div>ลบข้อมูลทั้งหมดในระบบ</div>
                        <div className="text-[10px] text-red-400">ล้างฐานข้อมูลเพื่อเริ่มใหม่</div>
                      </div>
                    </button>
                  </>
                )}
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        </div>

      </div>

      {/* Login / Switch Account Modal */}
      <LoginModal
        currentAdmin={currentAdmin}
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={(newAdmin) => {
          setCurrentAdmin(newAdmin);
        }}
      />
    </header>
  );
};
