import React, { useState, useRef } from 'react';
import { 
  X, 
  Save, 
  Upload, 
  Trash2, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  FileCheck, 
  Image as ImageIcon,
  DollarSign,
  HeartHandshake,
  User,
  Calendar,
  Building,
  Phone,
  FileSpreadsheet,
  Layers,
  Sparkles
} from 'lucide-react';
import { 
  FuneralAssistanceRecord, 
  FuneralDocument, 
  FuneralDocCategory, 
  FUNERAL_DOC_DEFINITIONS, 
  AdminUser,
  ADMIN_USERS
} from '../types';
import { formatNationalId, formatPhone, formatThaiDateShort } from '../utils/idCard';
import { ThaiDateInput } from './ThaiDateInput';
import { getNextFuneralCode, processFileForUpload } from '../utils/image';
import { useUiFeedback } from './UiFeedback';

interface FuneralFormModalProps {
  initialRecord: FuneralAssistanceRecord | null;
  currentAdmin: AdminUser;
  isOpen: boolean;
  onClose: () => void;
  onSave: (record: FuneralAssistanceRecord) => void;
  existingCount: number;
  existingCodes?: string[];
}

export const FuneralFormModal: React.FC<FuneralFormModalProps> = ({
  initialRecord,
  currentAdmin,
  isOpen,
  onClose,
  onSave,
  existingCount,
  existingCodes,
}) => {
  const { showToast } = useUiFeedback();
  const [formData, setFormData] = useState<Partial<FuneralAssistanceRecord>>(() => {
    if (initialRecord) return { ...initialRecord };

    const currentYear = new Date().getFullYear() + 543;
    const shortYear = currentYear.toString().slice(-2);
    const code = existingCodes
      ? getNextFuneralCode(existingCodes)
      : `ศพ-${shortYear}-${(existingCount + 1).toString().padStart(3, '0')}`;

    return {
      id: `funeral-${Date.now()}`,
      code,
      applicationDate: new Date().toISOString().slice(0, 10),
      status: 'pending',
      
      deceasedTitle: 'นาย',
      deceasedName: '',
      deceasedNationalId: '',
      deceasedAge: 60,
      deceasedDeathDate: new Date().toISOString().slice(0, 10),
      deceasedDeathTime: '08:30',
      causeOfDeath: '',
      deathPlace: 'โรงพยาบาลสมุทรปราการ',
      deceasedAddress: '',

      applicantTitle: 'นาย',
      applicantName: '',
      applicantNationalId: '',
      applicantPhone: '',
      applicantRelation: 'บุตร',
      applicantAddress: '',
      applicantPovertyReason: 'ครอบครัวมีฐานะยากจน รายได้ไม่เพียงพอ และไม่มีค่าใช้จ่ายในการจัดพิธีฌาปนกิจศพ',

      templeName: 'วัดกลาง (สมุทรปราการ)',
      cremationDate: new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10),
      cremationTime: '16:00',
      assistanceAmount: 5000, // ค่าเริ่มต้น 5,000 บาท สามารถปรับเปลี่ยนได้อิสระ
      coffinProvided: true,
      transportProvided: true,
      shroudClothProvided: true,
      otherItems: 'พวงหรีดมูลนิธิฯ และของใช้ประกอบพิธีฌาปนกิจ',

      officerId: currentAdmin.id,
      officerName: currentAdmin.name,
      officerPosition: currentAdmin.position,
      approverName: 'นางสาวศาตพร ภูมิโคกรักษ์',
      approverPosition: 'ผู้จัดการมูลนิธิร่วมกุศลสมุทรปราการ (ผู้อนุมัติ)',

      documents: [],
    };
  });

  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [targetCategory, setTargetCategory] = useState<FuneralDocCategory>('deceased_id_card');

  if (!isOpen) return null;

  // Handle single field change
  const handleChange = (field: keyof FuneralAssistanceRecord, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Upload document file handler with automatic compression
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      try {
        const processed = await processFileForUpload(file, 780000);
        if (processed.tooLargeForCloud) {
          showToast(
            `ไฟล์ "${file.name}" มีขนาดใหญ่เกิน ~600KB จึงเก็บในเครื่องได้ชั่วคราวแต่ไม่สามารถซิงค์ขึ้น Cloud ได้`,
            'warning'
          );
        }
        const def = FUNERAL_DOC_DEFINITIONS.find((d) => d.category === targetCategory);

        const newDoc: FuneralDocument = {
          id: `fdoc-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          category: targetCategory,
          title: def ? def.title : file.name,
          fileName: file.name,
          fileType: processed.fileType,
          dataUrl: processed.dataUrl,
          fileSize: processed.fileSize,
          uploadDate: new Date().toISOString(),
        };

        setFormData((prev) => {
          const filtered = (prev.documents || []).filter((d) => d.category !== targetCategory);
          return {
            ...prev,
            documents: [...filtered, newDoc],
          };
        });
      } catch {
        showToast(`ไม่สามารถอัปโหลดไฟล์ ${file.name} ได้`, 'error');
      }
    }

    e.target.value = '';
  };

  const handleRemoveDoc = (docId: string) => {
    setFormData((prev) => ({
      ...prev,
      documents: (prev.documents || []).filter((d) => d.id !== docId),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!formData.deceasedName?.trim()) {
      setErrorMsg('กรุณากรอกชื่อ-นามสกุลของผู้เสียชีวิต');
      return;
    }

    if (!formData.applicantName?.trim()) {
      setErrorMsg('กรุณากรอกชื่อ-นามสกุลของผู้ยื่นคำร้อง');
      return;
    }

    if (formData.assistanceAmount === undefined || Number(formData.assistanceAmount) < 0) {
      setErrorMsg('กรุณาระบุจำนวนเงินอนุเคราะห์');
      return;
    }

    const completedRecord: FuneralAssistanceRecord = {
      ...(formData as FuneralAssistanceRecord),
      updatedAt: new Date().toISOString(),
      createdAt: formData.createdAt || new Date().toISOString(),
    };

    onSave(completedRecord);
    onClose();
  };

  const documentsCount = (formData.documents || []).length;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex flex-col items-center p-2 sm:p-4">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center">
              <HeartHandshake className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base sm:text-lg text-white">
                  {initialRecord ? 'แก้ไขคำร้องขอรับความช่วยเหลืออนุเคราะห์เผาศพ' : 'ยื่นคำร้องขอรับการอนุเคราะห์เผาศพ / ฌาปนกิจสงเคราะห์'}
                </h3>
                <span className="text-xs bg-amber-500/30 text-amber-200 font-mono font-bold px-2 py-0.5 rounded-md border border-amber-400/40">
                  {formData.code}
                </span>
              </div>
              <p className="text-xs text-slate-300">
                มูลนิธิร่วมกุศลสมุทรปราการ (北欖天德善堂) • โครงการสงเคราะห์ฌาปนกิจผู้ยากไร้
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto max-h-[75vh] space-y-6">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* SECTION 1: ข้อมูลผู้เสียชีวิต */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs">
                      1
                    </span>
                    <span>ข้อมูลผู้เสียชีวิต</span>
                  </h4>
                  <span className="text-xs text-slate-500">ข้อมูลตามใบแจ้งตาย/มรณะบัตร</span>
                </div>

                <div className="grid grid-cols-12 gap-3 text-xs">
                  <div className="col-span-12 sm:col-span-2">
                    <label className="block font-bold text-slate-700 mb-1">คำนำหน้า</label>
                    <select
                      value={formData.deceasedTitle || 'นาย'}
                      onChange={(e) => handleChange('deceasedTitle', e.target.value)}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                    >
                      <option value="นาย">นาย</option>
                      <option value="นาง">นาง</option>
                      <option value="นางสาว">นางสาว</option>
                      <option value="ด.ช.">ด.ช.</option>
                      <option value="ด.ญ.">ด.ญ.</option>
                    </select>
                  </div>

                  <div className="col-span-12 sm:col-span-6">
                    <label className="block font-bold text-slate-700 mb-1">ชื่อ-นามสกุล ผู้เสียชีวิต *</label>
                    <input
                      type="text"
                      value={formData.deceasedName || ''}
                      onChange={(e) => handleChange('deceasedName', e.target.value)}
                      placeholder="ระบุชื่อและนามสกุล"
                      required
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold"
                    />
                  </div>

                  <div className="col-span-12 sm:col-span-4">
                    <label className="block font-bold text-slate-700 mb-1">เลขประจำตัวประชาชน (13 หลัก)</label>
                    <input
                      type="text"
                      maxLength={17}
                      value={formData.deceasedNationalId || ''}
                      onChange={(e) => handleChange('deceasedNationalId', e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="x-xxxx-xxxxx-xx-x"
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                    />
                  </div>

                  <div className="col-span-6 sm:col-span-3">
                    <label className="block font-bold text-slate-700 mb-1">อายุ (ปี)</label>
                    <input
                      type="number"
                      min={0}
                      max={130}
                      value={formData.deceasedAge || 0}
                      onChange={(e) => handleChange('deceasedAge', Number(e.target.value))}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold"
                    />
                  </div>

                  <div className="col-span-12 sm:col-span-6">
                    <label className="block font-bold text-slate-700 mb-1">วันที่เสียชีวิต (วัน เดือน พ.ศ.)</label>
                    <ThaiDateInput
                      value={formData.deceasedDeathDate || ''}
                      onChange={(val) => handleChange('deceasedDeathDate', val)}
                      minYearBE={2540}
                      maxYearBE={new Date().getFullYear() + 543}
                    />
                  </div>

                  <div className="col-span-12 sm:col-span-5">
                    <label className="block font-bold text-slate-700 mb-1">สาเหตุการเสียชีวิต</label>
                    <input
                      type="text"
                      value={formData.causeOfDeath || ''}
                      onChange={(e) => handleChange('causeOfDeath', e.target.value)}
                      placeholder="เช่น โรคชรา, ภาวะหัวใจล้มเหลว, ติดเชื้อในกระแสเลือด"
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                    />
                  </div>

                  <div className="col-span-12 sm:col-span-6">
                    <label className="block font-bold text-slate-700 mb-1">สถานที่เสียชีวิต</label>
                    <input
                      type="text"
                      value={formData.deathPlace || ''}
                      onChange={(e) => handleChange('deathPlace', e.target.value)}
                      placeholder="เช่น โรงพยาบาลสมุทรปราการ, บ้านพัก"
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                    />
                  </div>

                  <div className="col-span-12 sm:col-span-6">
                    <label className="block font-bold text-slate-700 mb-1">ที่อยู่ตามทะเบียนบ้านผู้เสียชีวิต</label>
                    <input
                      type="text"
                      value={formData.deceasedAddress || ''}
                      onChange={(e) => handleChange('deceasedAddress', e.target.value)}
                      placeholder="เลขที่ หมู่ ซอย ถนน ตำบล อำเภอ จังหวัด"
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 2: ข้อมูลผู้ยื่นคำร้อง */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-blue-700 text-white flex items-center justify-center text-xs">
                      2
                    </span>
                    <span>ข้อมูลผู้ยื่นคำร้อง (ญาติ / ผู้จัดการศพ)</span>
                  </h4>
                  <span className="text-xs text-slate-500">ผู้ขอรับการสงเคราะห์</span>
                </div>

                <div className="grid grid-cols-12 gap-3 text-xs">
                  <div className="col-span-12 sm:col-span-2">
                    <label className="block font-bold text-slate-700 mb-1">คำนำหน้า</label>
                    <select
                      value={formData.applicantTitle || 'นาย'}
                      onChange={(e) => handleChange('applicantTitle', e.target.value)}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                    >
                      <option value="นาย">นาย</option>
                      <option value="นาง">นาง</option>
                      <option value="นางสาว">นางสาว</option>
                    </select>
                  </div>

                  <div className="col-span-12 sm:col-span-5">
                    <label className="block font-bold text-slate-700 mb-1">ชื่อ-นามสกุล ผู้ยื่นคำร้อง *</label>
                    <input
                      type="text"
                      value={formData.applicantName || ''}
                      onChange={(e) => handleChange('applicantName', e.target.value)}
                      placeholder="ระบุชื่อและนามสกุลผู้ยื่นคำร้อง"
                      required
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold"
                    />
                  </div>

                  <div className="col-span-12 sm:col-span-3">
                    <label className="block font-bold text-slate-700 mb-1">ความสัมพันธ์กับผู้เสียชีวิต</label>
                    <select
                      value={formData.applicantRelation || 'บุตร'}
                      onChange={(e) => handleChange('applicantRelation', e.target.value)}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                    >
                      <option value="บุตร">บุตร (ลูก)</option>
                      <option value="คู่สมรส">คู่สมรส (สามี/ภรรยา)</option>
                      <option value="บิดา/มารดา">บิดา/มารดา (พ่อ/แม่)</option>
                      <option value="พี่น้อง">พี่น้องร่วมบิดามารดา</option>
                      <option value="ญาติ">ญาติสนิท</option>
                      <option value="ผู้นำชุมชน/ผู้ดูแล">ผู้นำชุมชน / ผู้ดูแล</option>
                    </select>
                  </div>

                  <div className="col-span-12 sm:col-span-2">
                    <label className="block font-bold text-slate-700 mb-1">เบอร์โทรศัพท์</label>
                    <input
                      type="tel"
                      value={formData.applicantPhone || ''}
                      onChange={(e) => handleChange('applicantPhone', e.target.value)}
                      placeholder="08x-xxxxxxx"
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                    />
                  </div>

                  <div className="col-span-12 sm:col-span-6">
                    <label className="block font-bold text-slate-700 mb-1">เลขประจำตัวประชาชน ผู้ยื่นคำร้อง</label>
                    <input
                      type="text"
                      maxLength={17}
                      value={formData.applicantNationalId || ''}
                      onChange={(e) => handleChange('applicantNationalId', e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="เลขบัตร 13 หลัก"
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                    />
                  </div>

                  <div className="col-span-12 sm:col-span-6">
                    <label className="block font-bold text-slate-700 mb-1">ที่อยู่ปัจจุบันของผู้ยื่นคำร้อง</label>
                    <input
                      type="text"
                      value={formData.applicantAddress || ''}
                      onChange={(e) => handleChange('applicantAddress', e.target.value)}
                      placeholder="ที่อยู่สำหรับติดต่อ"
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                    />
                  </div>

                  <div className="col-span-12">
                    <label className="block font-bold text-slate-700 mb-1">
                      สภาพปัญหาความยากไร้ / เหตุผลความจำเป็นในการขอรับการอนุเคราะห์
                    </label>
                    <textarea
                      rows={2}
                      value={formData.applicantPovertyReason || ''}
                      onChange={(e) => handleChange('applicantPovertyReason', e.target.value)}
                      placeholder="ระบุสภาพความยากไร้ของครอบครัว..."
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 3: ข้อมูลพิธีฌาปนกิจ & รายการอนุเคราะห์ (จำนวนเงินอนุเคราะห์แก้ไขได้) */}
              <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-4 space-y-4">
                <div className="flex items-center justify-between border-b border-amber-200/80 pb-2">
                  <h4 className="font-bold text-sm text-amber-900 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-amber-600 text-white flex items-center justify-center text-xs">
                      3
                    </span>
                    <span>ข้อมูลพิธีฌาปนกิจ & รายการการอนุเคราะห์ (กำหนดโดยเจ้าหน้าที่)</span>
                  </h4>
                  <span className="text-xs text-amber-800 font-semibold">
                    มูลนิธิร่วมกุศลสมุทรปราการ
                  </span>
                </div>

                <div className="grid grid-cols-12 gap-3 text-xs">
                  <div className="col-span-12 sm:col-span-6">
                    <label className="block font-bold text-slate-800 mb-1">วัดที่จัดพิธีฌาปนกิจ (เผาศพ)</label>
                    <input
                      type="text"
                      value={formData.templeName || ''}
                      onChange={(e) => handleChange('templeName', e.target.value)}
                      placeholder="เช่น วัดกลาง, วัดพิชัยสงคราม, วัดอโศการาม, วัดบางพลีใหญ่"
                      className="w-full p-2 bg-white border border-amber-300 rounded-lg text-xs font-semibold text-slate-900"
                    />
                  </div>

                  <div className="col-span-12 sm:col-span-8">
                    <label className="block font-bold text-slate-800 mb-1">กำหนดการวันฌาปนกิจ (วัน เดือน พ.ศ.)</label>
                    <ThaiDateInput
                      value={formData.cremationDate || ''}
                      onChange={(val) => handleChange('cremationDate', val)}
                      minYearBE={2560}
                      maxYearBE={new Date().getFullYear() + 543 + 10}
                    />
                  </div>

                  <div className="col-span-6 sm:col-span-3">
                    <label className="block font-bold text-slate-800 mb-1">เวลาประชุมเพลิง</label>
                    <input
                      type="time"
                      value={formData.cremationTime || '16:00'}
                      onChange={(e) => handleChange('cremationTime', e.target.value)}
                      className="w-full p-2 bg-white border border-amber-300 rounded-lg text-xs"
                    />
                  </div>

                  {/* Highlight: Financial Assistance Amount (สามารถเพิ่ม/ระบุได้โดยเจ้าหน้าที่) */}
                  <div className="col-span-12 p-3 bg-white rounded-xl border-2 border-emerald-500 shadow-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-emerald-600" />
                        <div>
                          <label className="block font-bold text-sm text-slate-900">
                            จำนวนเงินอนุเคราะห์ค่าจัดพิธีศพ (บาท) *
                          </label>
                          <p className="text-[11px] text-slate-500">
                            เจ้าหน้าที่สามารถกำหนดและปรับเปลี่ยนจำนวนเงินอนุเคราะห์ได้ตามความเหมาะสม
                          </p>
                        </div>
                      </div>
                      
                      {/* Quick Presets */}
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="text-slate-500 text-[11px]">เลือกด่วน:</span>
                        {[3000, 5000, 10000].map((amt) => (
                          <button
                            key={amt}
                            type="button"
                            onClick={() => handleChange('assistanceAmount', amt)}
                            className={`px-2.5 py-1 rounded-md font-bold transition cursor-pointer ${
                              formData.assistanceAmount === amt
                                ? 'bg-emerald-600 text-white'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            }`}
                          >
                            {amt.toLocaleString()} บ.
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        step={500}
                        value={formData.assistanceAmount || 0}
                        onChange={(e) => handleChange('assistanceAmount', Number(e.target.value))}
                        className="w-full p-2.5 text-base font-bold text-emerald-800 bg-emerald-50/50 border border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-mono"
                      />
                      <span className="font-bold text-sm text-slate-700 shrink-0">บาท</span>
                    </div>
                  </div>

                  {/* Material Aid Checkboxes */}
                  <div className="col-span-12 grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                    <label className="p-2.5 bg-white border border-slate-200 rounded-lg flex items-center gap-2 cursor-pointer hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={!!formData.coffinProvided}
                        onChange={(e) => handleChange('coffinProvided', e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <span className="font-semibold text-slate-800">อนุเคราะห์หีบศพฟรี (โลงศพ)</span>
                    </label>

                    <label className="p-2.5 bg-white border border-slate-200 rounded-lg flex items-center gap-2 cursor-pointer hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={!!formData.transportProvided}
                        onChange={(e) => handleChange('transportProvided', e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <span className="font-semibold text-slate-800">รถรับ-ส่งร่างผู้เสียชีวิต</span>
                    </label>

                    <label className="p-2.5 bg-white border border-slate-200 rounded-lg flex items-center gap-2 cursor-pointer hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={!!formData.shroudClothProvided}
                        onChange={(e) => handleChange('shroudClothProvided', e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <span className="font-semibold text-slate-800">ผ้าขาวห่อศพ</span>
                    </label>
                  </div>

                  <div className="col-span-12">
                    <label className="block font-bold text-slate-700 mb-1">สิ่งของช่วยเหลือเพิ่มเติม</label>
                    <input
                      type="text"
                      value={formData.otherItems || ''}
                      onChange={(e) => handleChange('otherItems', e.target.value)}
                      placeholder="เช่น พวงหรีดมูลนิธิฯ, ธูปเทียน"
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 4: เอกสารแนบสำคัญ 7 รายการ อยู่บนหน้าคำร้อง */}
              <div className="bg-blue-50/40 border border-blue-200/80 rounded-xl p-4 space-y-3.5">
                <div className="flex flex-wrap items-center justify-between border-b border-blue-200/80 pb-2.5 gap-2">
                  <div>
                    <h4 className="font-bold text-sm text-blue-950 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-blue-700 text-white flex items-center justify-center text-xs">
                        4
                      </span>
                      <span>เอกสารหลักฐานประกอบคำร้องสำคัญ 7 รายการ (แนบได้ทันทีบนหน้าคำร้อง)</span>
                    </h4>
                    <p className="text-slate-600 text-[11.5px] mt-0.5">
                      แนบภาพถ่ายหรือไฟล์เอกสาร (JPG, PNG หรือ PDF) ตามระเบียบของมูลนิธิร่วมกุศลสมุทรปราการ
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${
                      documentsCount >= 7 
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                        : 'bg-amber-100 text-amber-800 border-amber-300'
                    }`}>
                      แนบแล้ว {documentsCount} จาก 7 รายการ
                    </span>
                  </div>
                </div>

                {/* 7 Required Document Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {FUNERAL_DOC_DEFINITIONS.map((def) => {
                    const attachedDoc = (formData.documents || []).find((d) => d.category === def.category);

                    return (
                      <div 
                        key={def.category} 
                        className={`p-3 rounded-xl border transition-all ${
                          attachedDoc 
                            ? 'border-emerald-300 bg-emerald-50/50' 
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <div className="flex items-start gap-2">
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                              attachedDoc ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
                            }`}>
                              {def.number}
                            </span>
                            <div>
                              <div className="font-bold text-xs text-slate-900">{def.title}</div>
                              <div className="text-[10.5px] text-slate-500 leading-tight mt-0.5">{def.description}</div>
                            </div>
                          </div>

                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                            attachedDoc 
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1' 
                              : 'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}>
                            {attachedDoc ? (
                              <>
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                แนบแล้ว
                              </>
                            ) : (
                              'รอแนบ'
                            )}
                          </span>
                        </div>

                        {/* Preview or Upload Zone */}
                        {attachedDoc ? (
                          <div className="mt-2 p-2 bg-white rounded-lg border border-emerald-200 flex items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-2 min-w-0">
                              {attachedDoc.fileType.includes('image') ? (
                                <img
                                  src={attachedDoc.dataUrl}
                                  alt={attachedDoc.title}
                                  className="w-10 h-10 object-cover rounded border border-slate-200 shrink-0"
                                />
                              ) : (
                                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded flex items-center justify-center shrink-0 border border-blue-200">
                                  <FileText className="w-5 h-5" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="font-bold text-slate-800 truncate text-[11.5px]">
                                  {attachedDoc.fileName}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  {(attachedDoc.fileSize / 1024).toFixed(1)} KB • {formatThaiDateShort(attachedDoc.uploadDate.slice(0, 10))}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setTargetCategory(def.category);
                                  fileInputRef.current?.click();
                                }}
                                className="px-2 py-1 text-[11px] text-blue-700 hover:bg-blue-50 rounded cursor-pointer font-semibold"
                              >
                                เปลี่ยน
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveDoc(attachedDoc.id)}
                                className="p-1 text-red-500 hover:bg-red-50 rounded cursor-pointer"
                                title="ลบเอกสาร"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setTargetCategory(def.category);
                              fileInputRef.current?.click();
                            }}
                            className="mt-2 w-full py-2.5 px-3 border border-dashed border-slate-300 hover:border-blue-500 rounded-lg bg-slate-50/70 hover:bg-blue-50/40 text-slate-600 hover:text-blue-700 text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>อัปโหลด {def.shortLabel}</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>

              {/* SECTION 5: เจ้าหน้าที่รับคำร้อง & สถานะ */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs">
                      5
                    </span>
                    <span>เจ้าหน้าที่ผู้รับคำร้อง & การพิจารณาอนุมัติ</span>
                  </h4>
                  <span className="text-xs text-slate-500">บันทึกโดยระบบ</span>
                </div>

                <div className="grid grid-cols-12 gap-3 text-xs">
                  <div className="col-span-12 sm:col-span-4">
                    <label className="block font-bold text-slate-700 mb-1">เจ้าหน้าที่ผู้รับคำร้อง</label>
                    <select
                      value={formData.officerName || currentAdmin.name}
                      onChange={(e) => {
                        const sel = ADMIN_USERS.find((u) => u.name === e.target.value);
                        if (sel) {
                          handleChange('officerId', sel.id);
                          handleChange('officerName', sel.name);
                          handleChange('officerPosition', sel.position);
                        }
                      }}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800"
                    >
                      {ADMIN_USERS.filter((u) => u.role === 'officer' || u.roleTitle.includes('รับคำร้อง')).map((admin) => (
                        <option key={admin.id} value={admin.name}>
                          {admin.name} ({admin.roleTitle})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-12 sm:col-span-4">
                    <label className="block font-bold text-slate-700 mb-1">ผู้พิจารณาอนุมัติ</label>
                    <input
                      type="text"
                      disabled
                      value={formData.approverName || 'นางสาวศาตพร ภูมิโคกรักษ์'}
                      className="w-full p-2 bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-600 font-semibold"
                    />
                  </div>

                  <div className="col-span-12 sm:col-span-4">
                    <label className="block font-bold text-slate-700 mb-1">สถานะคำร้อง</label>
                    <select
                      value={formData.status || 'pending'}
                      onChange={(e) => handleChange('status', e.target.value)}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-bold"
                    >
                      <option value="pending">รอพิจารณา (Pending)</option>
                      <option value="approved">อนุมัติการช่วยเหลือ (Approved)</option>
                      <option value="completed">ฌาปนกิจเสร็จสิ้น (Completed)</option>
                      <option value="rejected">ไม่อนุมัติ (Rejected)</option>
                    </select>
                  </div>
                </div>
              </div>

          {/* Form Actions */}
          <div className="border-t border-slate-200 pt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <FileCheck className="w-4 h-4 text-blue-600" />
              <span>เอกสารแนบในคำร้อง: <b className="text-slate-800 font-bold">{documentsCount} จาก 7 รายการ</b></span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition cursor-pointer flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                <span>บันทึกคำร้องอนุเคราะห์</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
