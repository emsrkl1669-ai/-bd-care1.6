import React, { useState } from 'react';
import { 
  Search, 
  MapPin, 
  Phone, 
  ExternalLink, 
  Printer, 
  QrCode, 
  Edit3, 
  Archive, 
  Filter, 
  Eye, 
  AlertTriangle,
  LayoutGrid,
  List,
  Sparkles,
  Navigation,
  UserPlus,
  RefreshCw,
  Upload,
  Download,
  FileSpreadsheet,
  Trash2,
} from 'lucide-react';
import {
  PatientRecord,
  SAMUT_PRAKAN_DISTRICTS,
  MobilityLevel,
  PatientStatus,
  AdminUser,
  FuneralAssistanceRecord,
  DonationDistributionRecord,
} from '../types';
import {
  formatNationalId,
  formatPhone,
  formatCurrency,
  formatThaiDate,
  formatThaiDateShort,
  formatThaiDateCompact,
  sortPatientsByCodeAsc,
} from '../utils/idCard';
import { PrintFormSK04 } from './PrintFormSK04';
import { PrintHouseQrLabel } from './PrintHouseQrLabel';
import { PrintRosterModal } from './PrintRosterModal';
import { useUiFeedback } from './UiFeedback';
import { parseBackupOrExcelFile } from '../utils/csvPatientImport';
import { exportBackupJson, exportPatientsToExcel } from '../utils/storage';

function formatRosterCode(code: string): string {
  return (code || '')
    .replace(/\s+/g, ' ')
    .replace(/^(BDC)\s*-\s*/i, '$1 ')
    .trim();
}

function stripAddrPrefix(val: string | undefined, prefixes: string[]): string {
  let clean = (val || '').trim();
  if (!clean) return '';
  for (const p of prefixes) {
    if (clean.startsWith(p)) {
      clean = clean.slice(p.length).trim();
      break;
    }
  }
  return clean;
}

interface PatientListProps {
  patients: PatientRecord[];
  funerals?: FuneralAssistanceRecord[];
  donations?: DonationDistributionRecord[];
  onEditPatient: (patient: PatientRecord) => void;
  onArchivePatient: (patientId: string, newStatus: PatientStatus, reason: string) => void;
  onDeletePatient?: (patientId: string) => void;
  onAddNew?: () => void;
  onManualCloudSync?: () => void;
  onImportBackup?: (
    importedPatients: PatientRecord[],
    importedFunerals?: FuneralAssistanceRecord[],
    importedDonations?: DonationDistributionRecord[]
  ) => void;
  currentAdmin: AdminUser;
}

export const PatientList: React.FC<PatientListProps> = ({
  patients,
  funerals = [],
  donations = [],
  onEditPatient,
  onArchivePatient,
  onDeletePatient,
  onAddNew,
  onManualCloudSync,
  onImportBackup,
  currentAdmin,
}) => {
  const { showToast, confirmDialog } = useUiFeedback();
  const restoreFileRef = React.useRef<HTMLInputElement>(null);
  const toolbarImportRef = React.useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('all');
  const [selectedMobility, setSelectedMobility] = useState<string>('all');
  const [statusTab, setStatusTab] = useState<'all' | 'active' | 'pending'>('active');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table');

  // Print modals
  const [printingFormPatient, setPrintingFormPatient] = useState<PatientRecord | null>(null);
  const [printingLabelPatient, setPrintingLabelPatient] = useState<PatientRecord | null>(null);
  const [isPrintingRoster, setIsPrintingRoster] = useState(false);

  // Archive modal
  const [archiveTarget, setArchiveTarget] = useState<PatientRecord | null>(null);
  const [archiveReason, setArchiveReason] = useState('');
  const [archiveStatusType, setArchiveStatusType] = useState<PatientStatus>('deceased');

  // Filter logic
  const activeOrPending = patients.filter((p) => {
    if (statusTab === 'active') return p.status === 'active';
    if (statusTab === 'pending') return p.status === 'pending';
    return p.status === 'active' || p.status === 'pending';
  });

  const filteredPatients = sortPatientsByCodeAsc(
    activeOrPending.filter((p) => {
      const term = searchTerm.toLowerCase().replace(/[- ]/g, '');
      const cleanId = p.nationalId.replace(/[- ]/g, '');
      const cleanPhone = (p.phone || '').replace(/[- ]/g, '');
      const cleanCaregiverPhone = (p.caregiverPhone || '').replace(/[- ]/g, '');

      const matchSearch =
        !term ||
        p.fullName.toLowerCase().includes(term) ||
        p.code.toLowerCase().includes(term) ||
        cleanId.includes(term) ||
        cleanPhone.includes(term) ||
        cleanCaregiverPhone.includes(term) ||
        (p.caregiverName && p.caregiverName.toLowerCase().includes(term));

      const matchDistrict =
        selectedDistrict === 'all' || p.currentAddress?.district === selectedDistrict;

      const matchMobility =
        selectedMobility === 'all' || p.mobilityLevel === selectedMobility;

      return matchSearch && matchDistrict && matchMobility;
    })
  );

  const handleImportFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !onImportBackup) return;
    try {
      const result = await parseBackupOrExcelFile(file);
      const totalCount =
        result.patients.length +
        (result.funerals?.length || 0) +
        (result.donations?.length || 0);
      if (totalCount === 0) {
        showToast('ไม่พบข้อมูลผู้ป่วยหรือรายการสำรองในไฟล์ที่เลือก', 'warning');
        return;
      }
      onImportBackup(result.patients, result.funerals, result.donations);
    } catch {
      showToast(
        'ไม่สามารถอ่านไฟล์ได้ กรุณาเลือกไฟล์ .json, .xlsx, .xls หรือ .csv ที่ถูกต้อง',
        'error'
      );
    }
  };

  const handleConfirmArchive = () => {
    if (!archiveTarget) return;
    if (!archiveReason.trim()) {
      showToast('กรุณาระบุเหตุผล เช่น ผู้ป่วยถึงแก่กรรมอย่างสงบ หรือ ย้ายที่อยู่ไปอยู่กับบุตร', 'warning');
      return;
    }
    onArchivePatient(archiveTarget.id, archiveStatusType, archiveReason.trim());
    setArchiveTarget(null);
    setArchiveReason('');
  };

  const handleConfirmDeletePatient = async (patient: PatientRecord) => {
    if (!onDeletePatient) return;
    const ok = await confirmDialog({
      title: 'ยืนยันการลบข้อมูลผู้ป่วย',
      message: `คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลของ "${patient.title || ''}${patient.fullName}" (${patient.code}) ออกจากระบบและฐานข้อมูล Cloud?`,
      confirmLabel: 'ลบข้อมูล',
      cancelLabel: 'ยกเลิก',
      variant: 'danger',
    });
    if (ok) {
      onDeletePatient(patient.id);
    }
  };

  return (
    <div className="w-full py-3 px-2.5 sm:px-4 lg:px-6">
      {/* Compact Search & Filter Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 p-2.5 sm:p-3 shadow-xs mb-3 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs font-semibold overflow-x-auto no-scrollbar max-w-full">
            <button
              onClick={() => setStatusTab('active')}
              className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                statusTab === 'active'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ในโครงการ ({patients.filter((p) => p.status === 'active').length})
            </button>
            <button
              onClick={() => setStatusTab('pending')}
              className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                statusTab === 'pending'
                  ? 'bg-amber-500 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              รอพิจารณา ({patients.filter((p) => p.status === 'pending').length})
            </button>
            <button
              onClick={() => setStatusTab('all')}
              className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                statusTab === 'all'
                  ? 'bg-slate-800 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              รวม ({activeOrPending.length})
            </button>
          </div>

          {/* View Mode Switcher, Backup Actions & A4 Print Button */}
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="hidden md:flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs font-semibold">
              <button
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-white text-blue-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="มุมมองตารางภาพรวม (เห็นข้อมูลทั้งหมดในหน้าเดียว)"
              >
                <List className="w-3.5 h-3.5" />
                <span>ตาราง</span>
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition cursor-pointer ${
                  viewMode === 'cards'
                    ? 'bg-white text-blue-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="มุมมองการ์ด (Card View)"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>การ์ด</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                exportBackupJson(patients, funerals, donations);
                showToast(`ดาวน์โหลดไฟล์สำรอง JSON (${patients.length} ราย) เรียบร้อยแล้ว`, 'success');
              }}
              className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-lg text-xs font-semibold transition cursor-pointer"
              title="ดาวน์โหลดข้อมูลทั้งหมดเป็นไฟล์สำรอง JSON"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              <span>Export JSON</span>
            </button>

            <button
              type="button"
              onClick={() => {
                exportPatientsToExcel(patients);
                showToast(`ดาวน์โหลดไฟล์ Excel (${patients.length} ราย) เรียบร้อยแล้ว`, 'success');
              }}
              className="flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-semibold transition cursor-pointer"
              title="ดาวน์โหลดรายชื่อผู้ป่วยทั้งหมดเป็นไฟล์ Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Export Excel</span>
            </button>

            {onImportBackup && (
              <>
                <button
                  type="button"
                  onClick={() => toolbarImportRef.current?.click()}
                  className="flex items-center gap-1 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xs font-semibold transition cursor-pointer"
                  title="นำเข้าข้อมูลจากไฟล์ JSON, Excel (.xlsx/.xls) หรือ CSV และอัปโหลดขึ้น Cloud อัตโนมัติ"
                >
                  <Upload className="w-3.5 h-3.5 text-amber-600" />
                  <span>Import JSON/Excel</span>
                </button>
                <input
                  ref={toolbarImportRef}
                  type="file"
                  accept=".json,.xlsx,.xls,.csv"
                  onChange={handleImportFileSelected}
                  className="hidden"
                />
              </>
            )}

            <button
              onClick={() => setIsPrintingRoster(true)}
              className="flex items-center gap-1.5 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
              title="พิมพ์รายงานบัญชีรายชื่อผู้ป่วย A4"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>พิมพ์รายงาน A4 ({filteredPatients.length})</span>
            </button>
          </div>
        </div>

        {/* Compact Filters Row */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs">
          {/* Search Input */}
          <div className="sm:col-span-6 relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ค้นหาด่วน: เลข ปชช. 13 หลัก / ชื่อ-สกุล / เบอร์โทร / รหัส..."
              className="w-full text-xs pl-8 pr-4 py-1.5 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* District Filter */}
          <div className="sm:col-span-3">
            <select
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
              className="w-full text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 font-medium"
            >
              <option value="all">📍 ทุกอำเภอในสมุทรปราการ</option>
              {SAMUT_PRAKAN_DISTRICTS.map((d) => (
                <option key={d} value={d}>
                  อ.{d}
                </option>
              ))}
            </select>
          </div>

          {/* Mobility Filter */}
          <div className="sm:col-span-3">
            <select
              value={selectedMobility}
              onChange={(e) => setSelectedMobility(e.target.value)}
              className="w-full text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 font-medium"
            >
              <option value="all">🩺 ทุกระดับการเจ็บป่วย</option>
              <option value="bedridden">🔴 ติดเตียง 100%</option>
              <option value="semi_bedridden">🟡 กึ่งติดเตียง</option>
              <option value="can_walk">🟢 พอเดินได้</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results Count & View Content */}
      <div className="mb-2 flex items-center justify-between text-xs text-slate-500 px-1">
        <span>
          พบผู้ป่วย <span className="font-bold text-slate-800">{filteredPatients.length}</span> ราย
        </span>
      </div>

      {filteredPatients.length > 0 ? (
        <>
          {viewMode === 'table' && (
          /* ============================================================== */
          /* COMPACT OVERVIEW TABLE VIEW (Desktop / Tablet md+)             */
          /* ============================================================== */
          <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                    <th className="py-2.5 px-3 w-28">รหัสโครงการ</th>
                    <th className="py-2.5 px-3">ชื่อ-นามสกุล / เลข ปชช.</th>
                    <th className="py-2.5 px-3 w-28 text-center">ระดับเจ็บป่วย</th>
                    <th className="py-2.5 px-3">ที่อยู่ (อำเภอ)</th>
                    <th className="py-2.5 px-3">สิ่งของช่วยเหลือประจำเดือน</th>
                    <th className="py-2.5 px-3 w-20 text-center">ความเปราะบาง</th>
                    <th className="py-2.5 px-3 w-56 text-center">จัดการ / พิมพ์</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPatients.map((patient) => (
                    <tr key={patient.id} className="hover:bg-blue-50/50 transition">
                      {/* Code & Status */}
                      <td className="py-2 px-3 align-top">
                        <div className="font-mono font-bold text-blue-900">{patient.code}</div>
                        <span className={`inline-block mt-0.5 text-[10px] font-bold px-1.5 py-0.2 rounded ${
                          patient.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {patient.status === 'active' ? 'ในโครงการ' : 'รอพิจารณา'}
                        </span>
                        {patient.admissionDate && (
                          <div className="text-[10px] text-slate-500 mt-1 whitespace-nowrap">
                            รับเข้า: {formatThaiDateShort(patient.admissionDate)}
                          </div>
                        )}
                      </td>

                      {/* Name & ID */}
                      <td className="py-2 px-3 align-top">
                        <div className="font-bold text-slate-900">
                          {patient.title} {patient.fullName} <span className="font-normal text-slate-500">({patient.age} ปี)</span>
                        </div>
                        <div className="text-[11px] font-mono text-slate-500">
                          {formatNationalId(patient.nationalId)}
                        </div>
                        <div className="text-[10.5px] text-slate-500">
                          ผู้ดูแล: {patient.caregiverName || '-'} ({formatPhone(patient.caregiverPhone) || '-'})
                        </div>
                      </td>

                      {/* Mobility */}
                      <td className="py-2 px-3 text-center align-top">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${
                          patient.mobilityLevel === 'bedridden'
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : patient.mobilityLevel === 'semi_bedridden'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            patient.mobilityLevel === 'bedridden' ? 'bg-red-500' :
                            patient.mobilityLevel === 'semi_bedridden' ? 'bg-amber-500' : 'bg-emerald-500'
                          }`} />
                          {patient.mobilityLevel === 'bedridden' ? 'ติดเตียง 100%' :
                           patient.mobilityLevel === 'semi_bedridden' ? 'กึ่งติดเตียง' : 'พอเดินได้'}
                        </span>
                      </td>

                      {/* Address */}
                      <td className="py-2 px-3 align-top max-w-xs">
                        <div className="font-medium text-slate-800 line-clamp-1">
                          ต.{patient.currentAddress?.subdistrict || '-'} อ.{patient.currentAddress?.district || '-'}
                        </div>
                        <div className="text-[11px] text-slate-500 line-clamp-1">
                          เลขที่ {patient.currentAddress?.houseNo || '-'} {patient.currentAddress?.soi && `ซ.${patient.currentAddress.soi}`}
                        </div>
                      </td>

                      {/* Supplies */}
                      <td className="py-2 px-3 align-top">
                        <div className="flex flex-wrap gap-1 text-[10.5px]">
                          {patient.helpCashEnabled && (
                            <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.2 rounded font-semibold">
                              💵 {formatCurrency(patient.helpCashAmount)} บ.
                            </span>
                          )}
                          {patient.helpDiaperSize !== 'NONE' && (
                            <span className="bg-blue-50 text-blue-800 border border-blue-200 px-1.5 py-0.2 rounded font-semibold">
                              🩲 ไซส์ {patient.helpDiaperSize} ({patient.helpDiaperPacks} ห่อ)
                            </span>
                          )}
                          <span className="bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded">
                            🌾 ข้าว {patient.helpRicePacks} ถุง
                          </span>
                          {patient.helpWaterSize !== 'NONE' && (patient.helpWaterPacks || 0) > 0 && (
                            <span className="bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded" title={patient.helpWaterSize === '600ML' ? 'น้ำสิงห์ 600 ML. (12 ขวด)' : 'น้ำสิงห์ 1.5L (6 ขวด)'}>
                              💧 น้ำ {patient.helpWaterSize === '600ML' ? '600ML' : '1.5L'} ({patient.helpWaterPacks})
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Score */}
                      <td className="py-2 px-3 text-center align-top">
                        <div className="font-black text-indigo-700 text-sm">
                          {patient.vulnerabilityScore}
                        </div>
                        <div className="text-[9px] text-slate-400">/ 100</div>
                      </td>

                      {/* Actions */}
                      <td className="py-2 px-3 text-center align-top">
                        <div className="flex items-center justify-center gap-1">
                          {patient.googleMapsUrl && (
                            <a
                              href={patient.googleMapsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 text-blue-700 hover:bg-blue-100 rounded-md transition"
                              title="เปิด Google Maps นำทาง"
                            >
                              <Navigation className="w-3.5 h-3.5" />
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => setPrintingLabelPatient(patient)}
                            className="p-1.5 text-slate-700 hover:bg-slate-100 rounded-md transition cursor-pointer"
                            title="พิมพ์ป้าย QR Code บ้าน"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setPrintingFormPatient(patient)}
                            className="p-1.5 text-indigo-700 hover:bg-indigo-100 rounded-md transition cursor-pointer"
                            title="พิมพ์ สค.04 (3 หน้า A4)"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setArchiveTarget(patient)}
                            className="p-1.5 text-amber-700 hover:bg-amber-50 rounded-md transition cursor-pointer"
                            title="ย้ายสถานะ / ปิดเคสเข้าคลังประวัติ"
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onEditPatient(patient)}
                            className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-[11px] font-semibold transition cursor-pointer flex items-center gap-1"
                          >
                            <Edit3 className="w-3 h-3" />
                            แก้ไข
                          </button>
                          {onDeletePatient && (
                            <button
                              type="button"
                              onClick={() => handleConfirmDeletePatient(patient)}
                              className="p-1.5 text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 rounded-md transition cursor-pointer"
                              title="ลบข้อมูลผู้ป่วย"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          )}

          {/* ============================================================== */}
          {/* CARD VIEW: Always shown on mobile (< md), or when selected     */}
          {/* ============================================================== */}
          <div className={`${viewMode === 'table' ? 'md:hidden ' : ''}grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-3.5`}>
            {filteredPatients.map((patient) => {
              const primaryPhoto = patient.photos?.[0]?.dataUrl;
              return (
                <div
                  key={patient.id}
                  className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition flex flex-col justify-between"
                >
                  <div>
                    {/* Card Header */}
                    <div className="p-3 bg-slate-50 border-b border-slate-100 flex items-start justify-between gap-2.5">
                      <div className="flex items-center gap-2.5">
                        {primaryPhoto ? (
                          <img
                            src={primaryPhoto}
                            alt={patient.fullName}
                            className="w-10 h-10 rounded-lg object-cover border border-slate-200"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-800 font-bold flex items-center justify-center text-xs border border-blue-200">
                            {patient.title}
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-mono font-bold bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded">
                              {patient.code}
                            </span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                              patient.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {patient.status === 'active' ? 'ในโครงการ' : 'รอพิจารณา'}
                            </span>
                          </div>
                          <h3 className="font-bold text-slate-900 text-xs mt-0.5">
                            {patient.title} {patient.fullName} ({patient.age} ปี)
                          </h3>
                          {patient.admissionDate && (
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              รับเข้าโครงการ: {formatThaiDate(patient.admissionDate)}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-sm font-black text-indigo-600">
                          {patient.vulnerabilityScore}
                          <span className="text-[9px] font-normal text-slate-400">/100</span>
                        </div>
                      </div>
                    </div>

                    {/* Body */}
                    <div className="p-3 space-y-2 text-xs">
                      <div>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${
                          patient.mobilityLevel === 'bedridden'
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : patient.mobilityLevel === 'semi_bedridden'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            patient.mobilityLevel === 'bedridden' ? 'bg-red-500' :
                            patient.mobilityLevel === 'semi_bedridden' ? 'bg-amber-500' : 'bg-emerald-500'
                          }`} />
                          {patient.mobilityLevel === 'bedridden' ? 'ติดเตียง 100%' :
                           patient.mobilityLevel === 'semi_bedridden' ? 'กึ่งติดเตียง' : 'พอเดินได้'}
                        </span>
                      </div>

                      <div className="flex items-start gap-1 text-slate-600">
                        <MapPin className="w-3 h-3 text-blue-600 shrink-0 mt-0.5" />
                        <span className="line-clamp-1">
                          เลขที่ {patient.currentAddress?.houseNo || '-'} ต.{patient.currentAddress?.subdistrict || '-'} อ.{patient.currentAddress?.district || '-'}
                        </span>
                      </div>

                      {/* Relief summary */}
                      <div className="p-2 bg-blue-50/60 rounded-lg border border-blue-100 flex flex-wrap gap-1 text-[10px]">
                        {patient.helpCashEnabled && (
                          <span className="bg-white px-1.5 py-0.2 rounded border border-blue-200 font-medium">
                            💵 {formatCurrency(patient.helpCashAmount)} บ.
                          </span>
                        )}
                        {patient.helpDiaperSize !== 'NONE' && (
                          <span className="bg-white px-1.5 py-0.2 rounded border border-blue-200 font-medium">
                            🩲 ผ้าอ้อม {patient.helpDiaperSize} ({patient.helpDiaperPacks})
                          </span>
                        )}
                        <span className="bg-white px-1.5 py-0.2 rounded border border-blue-200">
                          🌾 ข้าว {patient.helpRicePacks}
                        </span>
                        {patient.helpWaterSize !== 'NONE' && (patient.helpWaterPacks || 0) > 0 && (
                          <span className="bg-white px-1.5 py-0.2 rounded border border-blue-200" title={patient.helpWaterSize === '600ML' ? 'น้ำสิงห์ 600 ML. (12 ขวด)' : 'น้ำสิงห์ 1.5L (6 ขวด)'}>
                            💧 น้ำ {patient.helpWaterSize === '600ML' ? '600ML' : '1.5L'} ({patient.helpWaterPacks})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="p-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      {patient.googleMapsUrl && (
                        <a
                          href={patient.googleMapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 text-blue-700 hover:bg-blue-100 rounded-md"
                          title="Google Maps"
                        >
                          <Navigation className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => setPrintingLabelPatient(patient)}
                        className="p-1.5 text-slate-700 hover:bg-slate-200 rounded-md cursor-pointer"
                        title="พิมพ์ป้าย QR Code"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPrintingFormPatient(patient)}
                        className="p-1.5 text-indigo-700 hover:bg-indigo-100 rounded-md cursor-pointer"
                        title="พิมพ์ สค.04 (3 หน้า)"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setArchiveTarget(patient)}
                        className="px-2 py-1 text-[10px] text-slate-500 hover:text-amber-800 hover:bg-amber-50 rounded"
                      >
                        ย้ายสถานะ
                      </button>
                      <button
                        type="button"
                        onClick={() => onEditPatient(patient)}
                        className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 className="w-3 h-3" />
                        แก้ไข
                      </button>
                      {onDeletePatient && (
                        <button
                          type="button"
                          onClick={() => handleConfirmDeletePatient(patient)}
                          className="p-1.5 text-red-600 hover:bg-red-50 border border-red-200 rounded transition cursor-pointer"
                          title="ลบข้อมูลผู้ป่วย"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="p-10 text-center bg-white rounded-xl border border-slate-200 shadow-xs max-w-md mx-auto my-6">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-2.5">
            {patients.length > 0 ? <Filter className="w-6 h-6" /> : <UserPlus className="w-6 h-6" />}
          </div>
          <h3 className="font-bold text-slate-800 text-sm">
            {patients.length > 0
              ? 'ไม่พบผู้ป่วยตามตัวกรองที่เลือก'
              : 'ยังไม่มีข้อมูลผู้ป่วยในเครื่องนี้'}
          </h3>
          <p className="text-xs text-slate-500 mt-1 mb-4 leading-relaxed">
            {patients.length > 0
              ? `มีข้อมูลผู้ป่วยในระบบทั้งหมด ${patients.length} ราย (อาจอยู่ในสถานะอื่นหรือตัวกรองอำเภอ/คำค้นหา)`
              : 'หากเคยบันทึกข้อมูลไว้ในฐานข้อมูล Cloud หรือเครื่องอื่น สามารถกดปุ่มดึงข้อมูลคืนจาก Cloud หรือบันทึกข้อมูลใหม่ได้ทันที'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {patients.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setStatusTab('all');
                  setSelectedDistrict('all');
                  setSelectedMobility('all');
                  setSearchTerm('');
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer"
              >
                <Filter className="w-3.5 h-3.5" />
                แสดงทุกสถานะ / ล้างตัวกรอง
              </button>
            )}
            {onManualCloudSync && (
              <button
                type="button"
                onClick={onManualCloudSync}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                ดึงข้อมูลคืน / ซิงค์ Cloud
              </button>
            )}
            {patients.length === 0 && onImportBackup && (
              <>
                <button
                  type="button"
                  onClick={() => restoreFileRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  นำเข้า JSON / Excel (.json / .xlsx / .csv)
                </button>
                <input
                  ref={restoreFileRef}
                  type="file"
                  accept=".json,.xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleImportFileSelected}
                />
              </>
            )}
            {onAddNew && (
              <button
                type="button"
                onClick={onAddNew}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                + บันทึกข้อมูลผู้ป่วยใหม่ (สค.04)
              </button>
            )}
          </div>
        </div>
      )}

      {/* Archive Modal Dialog */}
      {archiveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full p-4 sm:p-5 shadow-2xl my-auto">
            <h3 className="font-bold text-slate-900 text-base mb-1.5">
              🗄️ ย้ายประวัติผู้ป่วยเข้าคลังประวัติ (Archive)
            </h3>
            <p className="text-xs text-slate-600 mb-3">
              ผู้ป่วย <span className="font-bold text-slate-900">{archiveTarget.fullName}</span> จะถูกย้ายไปเก็บไว้ในคลังประวัติของมูลนิธิฯ
            </p>

            <div className="space-y-2.5 mb-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  เลือกสถานะใหม่ *
                </label>
                <select
                  value={archiveStatusType}
                  onChange={(e) => setArchiveStatusType(e.target.value as PatientStatus)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-medium"
                >
                  <option value="deceased">ผู้ป่วยเสียชีวิต (Deceased)</option>
                  <option value="moved">ผู้ป่วยย้ายที่อาศัย (Moved)</option>
                  <option value="rejected">ไม่ผ่านโครงการ (Rejected)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  สาเหตุและรายละเอียด *
                </label>
                <textarea
                  rows={2}
                  value={archiveReason}
                  onChange={(e) => setArchiveReason(e.target.value)}
                  placeholder="ระบุสาเหตุการย้ายสถานะ/ปิดเคส..."
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setArchiveTarget(null)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmArchive}
                className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg"
              >
                ยืนยันย้ายเข้าคลัง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Modals */}
      {printingFormPatient && (
        <PrintFormSK04
          patient={printingFormPatient}
          onClose={() => setPrintingFormPatient(null)}
        />
      )}

      {printingLabelPatient && (
        <PrintHouseQrLabel
          patient={printingLabelPatient}
          onClose={() => setPrintingLabelPatient(null)}
        />
      )}

      {/* A4 Landscape Patient Roster Report Modal (แบบ สค.04-R) */}
      {isPrintingRoster && (
        <PrintRosterModal
          title="รายงานบัญชีรายชื่อผู้ป่วยในโครงการใจถึงใจช่วยผู้ป่วยติดเตียงและยากไร้"
          subtitle={`สายส่งมอบ: ${selectedDistrict === 'all' ? 'ทุกอำเภอในจังหวัดสมุทรปราการ' : 'อำเภอ' + selectedDistrict} • สถานะ: ${statusTab === 'active' ? 'ในโครงการ' : statusTab === 'pending' ? 'รอพิจารณา' : 'ทั้งหมด'}`}
          documentCode="แบบ สค.04-R"
          orientation="landscape"
          indexColWidth="4%"
          items={filteredPatients}
          onClose={() => setIsPrintingRoster(false)}
          summaryItems={[
            { label: 'ติดเตียง 100%', value: `${filteredPatients.filter(p => p.mobilityLevel === 'bedridden').length} ราย` },
            { label: 'กึ่งติดเตียง', value: `${filteredPatients.filter(p => p.mobilityLevel === 'semi_bedridden').length} ราย` },
            { label: 'เงินสงเคราะห์รวม', value: `${formatCurrency(filteredPatients.reduce((s, p) => s + (p.helpCashEnabled ? p.helpCashAmount : 0), 0))} บ.` },
            { label: 'ข้าวสารรวม (5 กก.)', value: `${filteredPatients.reduce((s, p) => s + (p.helpRicePacks || 0), 0)} ถุง` },
            { label: 'น้ำดื่มสิงห์รวม', value: `${filteredPatients.reduce((s, p) => s + (p.helpWaterPacks || 0), 0)} แพ็ค` },
          ]}
          columns={[
            {
              header: 'รหัสโครงการ',
              colWidth: '10%',
              align: 'center',
              noWrap: true,
              render: (p) => (
                <span className="inline-block font-mono font-bold text-blue-900 text-[10px] whitespace-nowrap">
                  {formatRosterCode(p.code)}
                </span>
              ),
            },
            {
              header: 'ชื่อ-สกุล / เลข ปชช.',
              colWidth: '16%',
              render: (p) => (
                <div>
                  <div className="font-bold text-slate-900 text-[10.5px] leading-snug">
                    {p.title}{p.fullName}
                  </div>
                  <div className="font-mono text-[9px] text-slate-600 whitespace-nowrap mt-0.5">
                    {formatNationalId(p.nationalId)}
                  </div>
                </div>
              ),
            },
            {
              header: 'ระดับเจ็บป่วย',
              colWidth: '8%',
              align: 'center',
              noWrap: true,
              render: (p) => (
                <span className="inline-block text-[9px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 whitespace-nowrap">
                  {p.mobilityLevel === 'bedridden' ? 'ติดเตียง' : p.mobilityLevel === 'semi_bedridden' ? 'กึ่งติดเตียง' : 'พอเดินได้'}
                </span>
              ),
            },
            {
              header: 'ที่อยู่ / พื้นที่',
              colWidth: '23%',
              render: (p) => {
                const soi = stripAddrPrefix(p.currentAddress?.soi, ['ซอย', 'ซ.']);
                const road = stripAddrPrefix(p.currentAddress?.road, ['ถนน', 'ถ.']);
                const subdistrict = stripAddrPrefix(p.currentAddress?.subdistrict, ['ตำบล', 'ต.', 'แขวง']);
                const district = stripAddrPrefix(p.currentAddress?.district, ['อำเภอ', 'อ.', 'เขต']);
                const province = stripAddrPrefix(p.currentAddress?.province || 'สมุทรปราการ', ['จังหวัด', 'จ.']);
                return (
                  <div className="text-[9.5px] text-slate-800 leading-snug">
                    <div>
                      เลขที่ {p.currentAddress?.houseNo || '-'}
                      {p.currentAddress?.buildingVillage ? ` (${p.currentAddress.buildingVillage})` : ''}
                      {soi ? ` ซ.${soi}` : ''}
                      {road ? ` ถ.${road}` : ''}
                    </div>
                    <div className="text-slate-600">
                      ต.{subdistrict} อ.{district} จ.{province}
                    </div>
                  </div>
                );
              },
            },
            {
              header: 'สิ่งของสงเคราะห์ประจำเดือน',
              colWidth: '18%',
              render: (p) => (
                <div className="text-[9.5px] text-slate-800 leading-snug flex flex-wrap gap-x-2 gap-y-0.5">
                  {p.helpCashEnabled && (
                    <span className="font-bold text-emerald-800 whitespace-nowrap">
                      • เงิน {formatCurrency(p.helpCashAmount)} บ.
                    </span>
                  )}
                  <span className="whitespace-nowrap">• ข้าว {p.helpRicePacks || 0} ถุง</span>
                  {p.helpWaterPacks > 0 && (
                    <span className="whitespace-nowrap">
                      • น้ำ {p.helpWaterPacks} พ. ({p.helpWaterSize === '600ML' ? '600ML' : '1.5L'})
                    </span>
                  )}
                  {p.helpDiaperSize !== 'NONE' && (
                    <span className="font-semibold text-blue-900 whitespace-nowrap">
                      • แพมเพิส {p.helpDiaperSize} ({p.helpDiaperPacks} ห่อ)
                    </span>
                  )}
                </div>
              ),
            },
            {
              header: 'ผู้ดูแล / ติดต่อ',
              colWidth: '11%',
              render: (p) => (
                <div className="text-[9.5px] text-slate-800 leading-snug">
                  <div className="font-medium">
                    {p.caregiverName || '-'}
                    {p.caregiverRelation ? ` (${p.caregiverRelation})` : ''}
                  </div>
                  {p.caregiverPhone && (
                    <div className="font-mono text-slate-600 mt-0.5 space-y-0.5">
                      {p.caregiverPhone
                        .split(/[,/]+/)
                        .map((ph) => ph.trim())
                        .filter(Boolean)
                        .map((ph, idx) => (
                          <div key={idx} className="whitespace-nowrap">
                            {formatPhone(ph)}
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              ),
            },
            {
              header: 'รับเข้าโครงการ',
              colWidth: '10%',
              align: 'center',
              noWrap: true,
              render: (p) => (
                <div className="text-[9.5px] text-slate-700 font-mono whitespace-nowrap">
                  {formatThaiDateCompact(p.admissionDate)}
                </div>
              ),
            },
          ]}
        />
      )}
    </div>
  );
};
