import React, { useState } from 'react';
import { 
  HeartHandshake, 
  Search, 
  Plus, 
  Printer, 
  Edit3, 
  Trash2, 
  FileText, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  DollarSign, 
  Building2, 
  Calendar, 
  Phone, 
  User, 
  FileSpreadsheet, 
  Eye, 
  ShieldCheck,
  Check,
  X
} from 'lucide-react';
import { 
  FuneralAssistanceRecord, 
  AdminUser, 
  FUNERAL_DOC_DEFINITIONS,
  ADMIN_USERS 
} from '../types';
import { formatNationalId, formatPhone, formatThaiDate, formatCurrency } from '../utils/idCard';
import { exportFuneralsToCsv } from '../utils/storage';
import { FuneralFormModal } from './FuneralFormModal';
import { PrintFuneralForm } from './PrintFuneralForm';
import { PrintRosterModal } from './PrintRosterModal';

interface FuneralAssistanceViewProps {
  funerals: FuneralAssistanceRecord[];
  onSaveFuneral: (record: FuneralAssistanceRecord) => void;
  onDeleteFuneral: (id: string) => void;
  currentAdmin: AdminUser;
}

export const FuneralAssistanceView: React.FC<FuneralAssistanceViewProps> = ({
  funerals,
  onSaveFuneral,
  onDeleteFuneral,
  currentAdmin,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'completed' | 'rejected'>('all');
  
  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<FuneralAssistanceRecord | null>(null);
  const [printingRecord, setPrintingRecord] = useState<FuneralAssistanceRecord | null>(null);
  const [isPrintingRoster, setIsPrintingRoster] = useState(false);
  const [viewingDocsRecord, setViewingDocsRecord] = useState<FuneralAssistanceRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FuneralAssistanceRecord | null>(null);

  // Quick Amount Edit Modal
  const [amountEditRecord, setAmountEditRecord] = useState<FuneralAssistanceRecord | null>(null);
  const [tempAmount, setTempAmount] = useState<number>(5000);

  // Filtered List
  const filteredRecords = funerals.filter((r) => {
    const term = searchTerm.toLowerCase().replace(/[- ]/g, '');
    const cleanDeceasedId = (r.deceasedNationalId || '').replace(/[- ]/g, '');
    const cleanApplicantId = (r.applicantNationalId || '').replace(/[- ]/g, '');
    const cleanPhone = (r.applicantPhone || '').replace(/[- ]/g, '');

    const matchSearch =
      !term ||
      r.code.toLowerCase().includes(term) ||
      r.deceasedName.toLowerCase().includes(term) ||
      r.applicantName.toLowerCase().includes(term) ||
      r.templeName.toLowerCase().includes(term) ||
      cleanDeceasedId.includes(term) ||
      cleanApplicantId.includes(term) ||
      cleanPhone.includes(term);

    const matchStatus = statusFilter === 'all' || r.status === statusFilter;

    return matchSearch && matchStatus;
  });

  // KPI Calculations
  const totalCount = funerals.length;
  const pendingCount = funerals.filter((f) => f.status === 'pending').length;
  const approvedCount = funerals.filter((f) => f.status === 'approved' || f.status === 'completed').length;
  const totalAidAmount = funerals
    .filter((f) => f.status === 'approved' || f.status === 'completed')
    .reduce((sum, f) => sum + (Number(f.assistanceAmount) || 0), 0);

  // Quick approve action (for manager or president)
  const handleQuickApprove = (record: FuneralAssistanceRecord) => {
    const updated: FuneralAssistanceRecord = {
      ...record,
      status: 'approved',
      approverId: currentAdmin.id,
      approverName: currentAdmin.name,
      approverPosition: currentAdmin.position,
      approvalDate: new Date().toISOString().slice(0, 10),
      updatedAt: new Date().toISOString(),
    };
    onSaveFuneral(updated);
  };

  // Quick Amount Update handler
  const handleSaveAmount = () => {
    if (!amountEditRecord) return;
    const updated: FuneralAssistanceRecord = {
      ...amountEditRecord,
      assistanceAmount: Number(tempAmount),
      updatedAt: new Date().toISOString(),
    };
    onSaveFuneral(updated);
    setAmountEditRecord(null);
  };

  return (
    <div className="max-w-7xl mx-auto py-3 px-3 sm:px-4 space-y-4">
      {/* Page Title & Top Actions */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
            <HeartHandshake className="w-7 h-7 text-amber-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                การช่วยอนุเคราะห์เผาศพ / ฌาปนกิจสงเคราะห์
              </h2>
              <span className="text-xs bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-md">
                มูลนิธิร่วมกุศลสมุทรปราการ
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              ระบบรับคำร้อง สงเคราะห์หีบศพ ยานพาหนะ เงินช่วยเหลือ และตรวจสอบเอกสารแนบสำคัญ 7 รายการ
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPrintingRoster(true)}
            disabled={filteredRecords.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer disabled:opacity-50"
            title="พิมพ์รายงานสรุปคำร้องอนุเคราะห์เผาศพ ขนาด A4"
          >
            <Printer className="w-4 h-4" />
            <span>พิมพ์รายงาน A4 ({filteredRecords.length})</span>
          </button>

          <button
            onClick={() => exportFuneralsToCsv(funerals)}
            disabled={funerals.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer disabled:opacity-50"
            title="ส่งออกรายงานคำร้องเป็น Excel (CSV)"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span className="hidden sm:inline">ส่งออก Excel</span>
          </button>

          <button
            onClick={() => {
              setEditingRecord(null);
              setIsFormOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ ยื่นคำร้องอนุเคราะห์เผาศพ</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs">
          <div className="text-xs text-slate-500 font-medium">คำร้องทั้งหมด</div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono mt-0.5">
            {totalCount.toLocaleString()} <span className="text-xs font-normal text-slate-500">ราย</span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-amber-200 p-3.5 shadow-2xs bg-amber-50/20">
          <div className="text-xs text-amber-800 font-medium flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>รอพิจารณา</span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-800 font-mono mt-0.5">
            {pendingCount.toLocaleString()} <span className="text-xs font-normal text-amber-700">ราย</span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-emerald-200 p-3.5 shadow-2xs bg-emerald-50/20">
          <div className="text-xs text-emerald-800 font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>อนุมัติการช่วยเหลือแล้ว</span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-800 font-mono mt-0.5">
            {approvedCount.toLocaleString()} <span className="text-xs font-normal text-emerald-700">ราย</span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-blue-200 p-3.5 shadow-2xs bg-blue-50/20">
          <div className="text-xs text-blue-800 font-medium flex items-center gap-1">
            <DollarSign className="w-3.5 h-3.5 text-blue-600" />
            <span>ยอดเงินอนุเคราะห์รวม</span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-blue-800 font-mono mt-0.5">
            {formatCurrency(totalAidAmount)} <span className="text-xs font-normal text-blue-700">บาท</span>
          </div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Search bar */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ค้นหาด้วยชื่อผู้เสียชีวิต, ผู้ยื่นคำร้อง, เลขบัตร 13 หลัก, หรือชื่อวัด..."
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white"
            />
          </div>

          {/* Status Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-semibold">
            {[
              { id: 'all', label: 'ทั้งหมด' },
              { id: 'pending', label: 'รอพิจารณา' },
              { id: 'approved', label: 'อนุมัติแล้ว' },
              { id: 'completed', label: 'ฌาปนกิจเสร็จสิ้น' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id as any)}
                className={`px-3 py-1 rounded-md transition cursor-pointer ${
                  statusFilter === tab.id
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Records List / Table */}
      {filteredRecords.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center space-y-3">
          <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto border border-amber-200">
            <HeartHandshake className="w-8 h-8" />
          </div>
          <h3 className="font-bold text-slate-800 text-base">ยังไม่มีรายการคำร้องขอรับการอนุเคราะห์เผาศพ</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            เจ้าหน้าที่สามารถคลิกปุ่ม "+ ยื่นคำร้องอนุเคราะห์เผาศพ" เพื่อบันทึกข้อมูลผู้เสียชีวิต ผู้ยื่นคำร้อง วัดที่จัดพิธี และแนบเอกสารหลักฐานทั้ง 7 รายการ
          </p>
          <button
            onClick={() => {
              setEditingRecord(null);
              setIsFormOpen(true);
            }}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm transition inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>ยื่นคำร้องรายการแรก</span>
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                  <th className="py-3 px-3 w-14 text-center">รหัส</th>
                  <th className="py-3 px-3">ผู้เสียชีวิต & วันที่เสียชีวิต</th>
                  <th className="py-3 px-3">ผู้ยื่นคำร้อง & ความสัมพันธ์</th>
                  <th className="py-3 px-3">วัด & กำหนดการฌาปนกิจ</th>
                  <th className="py-3 px-3">เงินอนุเคราะห์ & สิ่งของ</th>
                  <th className="py-3 px-3 text-center">เอกสารแนบ 7 รายการ</th>
                  <th className="py-3 px-3 text-center">สถานะคำร้อง</th>
                  <th className="py-3 px-3 text-right">การจัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.map((record) => {
                  const docCount = (record.documents || []).length;
                  const isDocsComplete = docCount >= 7;

                  return (
                    <tr key={record.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Code */}
                      <td className="py-3 px-3 text-center">
                        <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                          {record.code}
                        </span>
                        <div className="text-[10px] text-slate-400 mt-1">
                          {formatThaiDate(record.applicationDate)}
                        </div>
                      </td>

                      {/* Deceased */}
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900 text-[13px]">
                          {record.deceasedTitle}{record.deceasedName}
                        </div>
                        <div className="text-[11px] text-slate-600">
                          อายุ {record.deceasedAge} ปี • เสียชีวิต: {formatThaiDate(record.deceasedDeathDate)}
                        </div>
                        <div className="text-[10.5px] text-slate-500 truncate max-w-[200px]" title={record.causeOfDeath}>
                          สาเหตุ: {record.causeOfDeath || '-'}
                        </div>
                        <div className="text-[10.5px] font-mono text-slate-400">
                          ID: {formatNationalId(record.deceasedNationalId)}
                        </div>
                      </td>

                      {/* Applicant */}
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-800">
                          {record.applicantTitle}{record.applicantName}
                        </div>
                        <div className="text-[11px] text-blue-700 font-medium">
                          ความสัมพันธ์: {record.applicantRelation}
                        </div>
                        <div className="text-[11px] text-slate-600 flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{formatPhone(record.applicantPhone) || '-'}</span>
                        </div>
                      </td>

                      {/* Temple & Cremation */}
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900 flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span className="truncate max-w-[170px]" title={record.templeName}>
                            {record.templeName}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-600 flex items-center gap-1 mt-0.5">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>เผาศพ: {formatThaiDate(record.cremationDate)}</span>
                        </div>
                        {record.cremationTime && (
                          <div className="text-[10.5px] text-slate-500">
                            เวลา {record.cremationTime} น.
                          </div>
                        )}
                      </td>

                      {/* Assistance & Amount */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-sm text-emerald-700 font-mono">
                            {formatCurrency(record.assistanceAmount)} บ.
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setAmountEditRecord(record);
                              setTempAmount(record.assistanceAmount);
                            }}
                            className="p-0.5 text-slate-400 hover:text-emerald-700 rounded cursor-pointer"
                            title="เจ้าหน้าที่แก้ไขจำนวนเงินอนุเคราะห์"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="text-[10.5px] text-slate-600 flex flex-wrap gap-1 mt-1">
                          {record.coffinProvided && (
                            <span className="bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded font-medium">
                              หีบศพฟรี
                            </span>
                          )}
                          {record.transportProvided && (
                            <span className="bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded font-medium">
                              รถรับ-ส่ง
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 7 Documents Checklist Badge */}
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => setViewingDocsRecord(record)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition cursor-pointer ${
                            isDocsComplete
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                          }`}
                          title="คลิกเพื่อตรวจสอบเอกสารแนบ"
                        >
                          <FileText className="w-3 h-3" />
                          <span>{docCount}/7 รายการ</span>
                        </button>
                        <div className="text-[10px] text-slate-400 mt-1">
                          {isDocsComplete ? 'เอกสารครบถ้วน' : 'ขาดบางรายการ'}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 text-center">
                        <span className={`inline-block px-2.5 py-1 rounded-md text-[11px] font-bold ${
                          record.status === 'approved'
                            ? 'bg-emerald-100 text-emerald-800'
                            : record.status === 'completed'
                            ? 'bg-blue-100 text-blue-800'
                            : record.status === 'rejected'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {record.status === 'approved' ? 'อนุมัติแล้ว' :
                           record.status === 'completed' ? 'ฌาปนกิจเสร็จสิ้น' :
                           record.status === 'rejected' ? 'ไม่อนุมัติ' : 'รอพิจารณา'}
                        </span>

                        {/* Quick approve button if pending */}
                        {record.status === 'pending' && (
                          <div className="mt-1">
                            <button
                              type="button"
                              onClick={() => handleQuickApprove(record)}
                              className="text-[10px] font-bold text-emerald-700 hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                              title="อนุมัติการช่วยเหลือ"
                            >
                              <Check className="w-3 h-3" />
                              <span>อนุมัติ</span>
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setPrintingRecord(record)}
                            className="p-1.5 text-blue-700 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                            title="พิมพ์ใบคำร้องขอรับการสงเคราะห์ A4"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setEditingRecord(record);
                              setIsFormOpen(true);
                            }}
                            className="p-1.5 text-amber-700 hover:bg-amber-50 rounded-lg transition cursor-pointer"
                            title="แก้ไขข้อมูลคำร้อง / แนบเอกสาร"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setDeleteTarget(record)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                            title="ลบคำร้อง"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: Form Modal (Add / Edit) */}
      {isFormOpen && (
        <FuneralFormModal
          initialRecord={editingRecord}
          currentAdmin={currentAdmin}
          isOpen={isFormOpen}
          onClose={() => {
            setIsFormOpen(false);
            setEditingRecord(null);
          }}
          onSave={onSaveFuneral}
          existingCount={funerals.length}
          existingCodes={funerals.map((f) => f.code)}
        />
      )}

      {/* MODAL 2: Print A4 Official Form */}
      {printingRecord && (
        <PrintFuneralForm
          record={printingRecord}
          onClose={() => setPrintingRecord(null)}
        />
      )}

      {/* MODAL 3: View Attached Documents Inspector */}
      {viewingDocsRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm sm:text-base flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-400" />
                  <span>ตรวจสอบเอกสารแนบ 7 รายการ • {viewingDocsRecord.code}</span>
                </h3>
                <p className="text-xs text-slate-400">
                  ผู้เสียชีวิต: {viewingDocsRecord.deceasedTitle}{viewingDocsRecord.deceasedName}
                </p>
              </div>
              <button
                onClick={() => setViewingDocsRecord(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto space-y-3">
              {FUNERAL_DOC_DEFINITIONS.map((def) => {
                const doc = (viewingDocsRecord.documents || []).find((d) => d.category === def.category);

                return (
                  <div key={def.category} className="p-3 border rounded-xl bg-slate-50 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className={`w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center shrink-0 ${
                        doc ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                      }`}>
                        {def.number}
                      </span>
                      <div>
                        <div className="font-bold text-xs text-slate-900">{def.title}</div>
                        <div className="text-[11px] text-slate-500">{doc ? doc.fileName : 'ยังไม่ได้แนบเอกสาร'}</div>
                      </div>
                    </div>

                    {doc ? (
                      <div className="flex items-center gap-2">
                        {doc.fileType.includes('image') ? (
                          <a
                            href={doc.dataUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-100 text-blue-700 rounded-lg text-xs font-bold inline-flex items-center gap-1 shadow-2xs"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>ดูรูปภาพ</span>
                          </a>
                        ) : (
                          <span className="text-xs text-emerald-700 font-bold">แนบไฟล์แล้ว</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        รอเอกสาร
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="bg-slate-50 border-t border-slate-200 p-3 text-right">
              <button
                type="button"
                onClick={() => setViewingDocsRecord(null)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-semibold cursor-pointer"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Quick Adjust Assistance Amount Modal */}
      {amountEditRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-600" />
                <span>กำหนดจำนวนเงินอนุเคราะห์</span>
              </h3>
              <button
                onClick={() => setAmountEditRecord(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <p className="text-xs text-slate-600 mb-2">
                คำร้อง: <strong>{amountEditRecord.code}</strong> • ผู้เสียชีวิต: <strong>{amountEditRecord.deceasedTitle}{amountEditRecord.deceasedName}</strong>
              </p>
              
              <label className="block text-xs font-bold text-slate-700 mb-1">
                จำนวนเงินอนุเคราะห์เผาศพ (บาท)
              </label>
              <input
                type="number"
                min={0}
                step={500}
                value={tempAmount}
                onChange={(e) => setTempAmount(Number(e.target.value))}
                className="w-full p-2.5 text-base font-bold text-emerald-800 bg-emerald-50/50 border border-emerald-300 rounded-lg font-mono"
              />
            </div>

            {/* Presets */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-500 text-[11px]">เลือกด่วน:</span>
              {[3000, 5000, 10000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setTempAmount(amt)}
                  className={`px-3 py-1 rounded-md font-bold transition cursor-pointer ${
                    tempAmount === amt
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {amt.toLocaleString()} บ.
                </button>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setAmountEditRecord(null)}
                className="px-3 py-1.5 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-semibold cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleSaveAmount}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                บันทึกจำนวนเงิน
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">ยืนยันการลบคำร้อง</h3>
                <p className="text-xs text-slate-500">รหัส {deleteTarget.code}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              คุณต้องการลบคำร้องขอรับการอนุเคราะห์เผาศพของผู้เสียชีวิต <strong>"{deleteTarget.deceasedTitle}{deleteTarget.deceasedName}"</strong> ใช่หรือไม่? ข้อมูลและเอกสารแนบจะถูกลบออกจากระบบ
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-3.5 py-1.5 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-semibold cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteFuneral(deleteTarget.id);
                  setDeleteTarget(null);
                }}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                ยืนยันลบคำร้อง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* A4 Funeral Assistance Summary Report Modal */}
      {isPrintingRoster && (
        <PrintRosterModal
          title="รายงานสรุปคำร้องขอรับการอนุเคราะห์เผาศพ (ฌาปนกิจสงเคราะห์)"
          subtitle={`สถานะ: ${statusFilter === 'all' ? 'ทุกสถานะคำร้อง' : statusFilter} • มูลนิธิร่วมกุศลสมุทรปราการ (北欖天德善堂)`}
          documentCode="แบบ ฌศ.01-R"
          items={filteredRecords}
          itemsPerPage={9}
          onClose={() => setIsPrintingRoster(false)}
          summaryItems={[
            { label: 'คำร้องตามตัวกรอง', value: `${filteredRecords.length} เคส` },
            { label: 'อนุมัติแล้ว', value: `${filteredRecords.filter(f => f.status === 'approved' || f.status === 'completed').length} เคส` },
            { label: 'รอพิจารณา', value: `${filteredRecords.filter(f => f.status === 'pending').length} เคส` },
            { label: 'เงินสงเคราะห์รวม', value: `${formatCurrency(filteredRecords.reduce((s, f) => s + (Number(f.assistanceAmount) || 0), 0))} บ.` },
            { label: 'อนุเคราะห์หีบศพ', value: `${filteredRecords.filter(f => f.coffinProvided).length} หีบ` },
            { label: 'ยานพาหนะรับ-ส่ง', value: `${filteredRecords.filter(f => f.transportProvided).length} ครั้ง` },
          ]}
          columns={[
            {
              header: 'รหัสคำร้อง',
              width: 'w-24',
              align: 'center',
              render: (r) => (
                <div className="font-mono font-bold text-blue-900 text-[10.5px]">{r.code}</div>
              ),
            },
            {
              header: 'ผู้เสียชีวิต / อายุ / สาเหตุ',
              width: 'w-48',
              render: (r) => (
                <div>
                  <div className="font-bold text-slate-900 text-[11px] leading-tight">{r.deceasedTitle}{r.deceasedName} ({r.deceasedAge} ปี)</div>
                  <div className="text-[9.5px] text-slate-500 font-mono">ปชช: {formatNationalId(r.deceasedNationalId)}</div>
                  {r.causeOfDeath && <div className="text-[9px] text-slate-600">สาเหตุ: {r.causeOfDeath}</div>}
                </div>
              ),
            },
            {
              header: 'ผู้ยื่นคำร้อง (ญาติ) / ติดต่อ',
              width: 'w-40',
              render: (r) => (
                <div className="text-[10px] text-slate-800 leading-tight">
                  <div className="font-semibold">{r.applicantTitle}{r.applicantName}</div>
                  <div className="text-slate-500 text-[9px]">ความสัมพันธ์: {r.applicantRelation}</div>
                  {r.applicantPhone && <div className="font-mono text-[9px] text-slate-600">{formatPhone(r.applicantPhone)}</div>}
                </div>
              ),
            },
            {
              header: 'วัดที่จัดพิธี / กำหนดเผา',
              render: (r) => (
                <div className="text-[10px] text-slate-800 leading-tight">
                  <div className="font-bold text-slate-900">{r.templeName}</div>
                  <div className="text-slate-600 text-[9.5px]">วันเผา: {formatThaiDate(r.cremationDate)}</div>
                </div>
              ),
            },
            {
              header: 'เงินสดสงเคราะห์',
              width: 'w-28',
              align: 'right',
              render: (r) => (
                <div className="font-bold text-slate-900 font-mono text-xs">
                  {formatCurrency(r.assistanceAmount)} บ.
                </div>
              ),
            },
            {
              header: 'สิ่งของ/บริการ',
              width: 'w-28',
              render: (r) => (
                <div className="text-[9.5px] text-slate-700 space-y-0.5">
                  <div>หีบศพ: <strong className={r.coffinProvided ? 'text-emerald-700' : 'text-slate-400'}>{r.coffinProvided ? '✓ มี' : '-'}</strong></div>
                  <div>รถรับส่ง: <strong className={r.transportProvided ? 'text-emerald-700' : 'text-slate-400'}>{r.transportProvided ? '✓ มี' : '-'}</strong></div>
                </div>
              ),
            },
            {
              header: 'สถานะ',
              width: 'w-24',
              align: 'center',
              render: (r) => (
                <span className={`text-[9.5px] font-semibold px-2 py-0.5 rounded-full ${
                  r.status === 'approved' || r.status === 'completed'
                    ? 'bg-emerald-100 text-emerald-800'
                    : r.status === 'pending'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {r.status === 'approved' ? 'อนุมัติแล้ว' : r.status === 'completed' ? 'เสร็จสิ้น' : r.status === 'pending' ? 'รอพิจารณา' : 'ไม่อนุมัติ'}
                </span>
              ),
            },
          ]}
        />
      )}
    </div>
  );
};
