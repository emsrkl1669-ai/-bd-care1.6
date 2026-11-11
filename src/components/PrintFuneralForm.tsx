import React, { useEffect, useState } from 'react';
import { 
  Printer, 
  X, 
  ArrowLeft, 
  CheckCircle2, 
  FileText, 
  Minimize2, 
  ZoomIn, 
  ZoomOut,
  Building2,
  Calendar,
  Layers
} from 'lucide-react';
import { FuneralAssistanceRecord, FUNERAL_DOC_DEFINITIONS } from '../types';
import { formatNationalId, formatPhone, formatThaiDate, formatCurrency } from '../utils/idCard';

interface PrintFuneralFormProps {
  record: FuneralAssistanceRecord;
  onClose: () => void;
}

export const PrintFuneralForm: React.FC<PrintFuneralFormProps> = ({ record, onClose }) => {
  const [scale, setScale] = useState<number>(0.8);

  useEffect(() => {
    document.body.classList.add('is-printing-sk04');
    return () => {
      document.body.classList.remove('is-printing-sk04');
    };
  }, []);

  useEffect(() => {
    const updateFitScale = () => {
      const availableHeight = window.innerHeight - 150;
      const fit = Math.min(1, Math.max(0.4, availableHeight / 1150));
      setScale(parseFloat(fit.toFixed(2)));
    };

    updateFitScale();
    window.addEventListener('resize', updateFitScale);
    return () => window.removeEventListener('resize', updateFitScale);
  }, []);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="a4-print-modal sk04-print-modal fixed inset-0 z-50 overflow-y-auto bg-slate-900/85 backdrop-blur-xs flex flex-col items-center p-2 sm:p-4">
      {/* Control Bar - Hidden when printing */}
      <div className="no-print w-full max-w-4xl bg-white rounded-xl shadow-xl p-3 mb-3 sticky top-2 z-50 border border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                  แบบฟอร์มขอรับการสงเคราะห์ฌาปนกิจ (A4)
                </h3>
                <span className="text-xs bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-md font-mono">
                  {record.code}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                ผู้เสียชีวิต: <strong className="text-slate-800">{record.deceasedTitle}{record.deceasedName}</strong> • วัด: {record.templeName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Zoom Controls */}
            <div className="hidden sm:flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-semibold">
              <button
                type="button"
                onClick={() => setScale(0.8)}
                className="px-2 py-1 bg-white hover:bg-slate-50 text-slate-700 rounded shadow-2xs border border-slate-200 transition cursor-pointer flex items-center gap-1"
              >
                <Minimize2 className="w-3 h-3 text-blue-600" />
                <span>พอดีจอ</span>
              </button>
              <button
                type="button"
                onClick={() => setScale(1)}
                className={`px-2 py-1 rounded transition cursor-pointer ${
                  scale === 1 ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-white'
                }`}
              >
                100%
              </button>
              <div className="flex items-center border-l border-slate-200 pl-1">
                <button
                  type="button"
                  onClick={() => setScale((s) => Math.max(0.4, parseFloat((s - 0.1).toFixed(2))))}
                  className="p-1 text-slate-600 hover:text-slate-900 rounded"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono text-[11px] w-9 text-center">{Math.round(scale * 100)}%</span>
                <button
                  type="button"
                  onClick={() => setScale((s) => Math.min(1.3, parseFloat((s + 0.1).toFixed(2))))}
                  className="p-1 text-slate-600 hover:text-slate-900 rounded"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs sm:text-sm font-bold shadow-md transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>สั่งพิมพ์ / บันทึก PDF (A4)</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-800 rounded-lg hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* A4 Container */}
      <div
        className="w-full flex flex-col items-center a4-container transition-all duration-150 origin-top pb-10"
        style={{
          transform: `scale(${scale})`,
          transformOrigin: 'top center',
          marginBottom: scale < 1 ? `-${Math.round((1 - scale) * 1150)}px` : undefined,
        }}
      >
        {/* A4 Page: ใบคำร้องขอรับการอนุเคราะห์เผาศพ */}
        <div className="a4-sheet bg-white text-black shadow-2xl rounded-xs p-6 sm:p-[14mm] border border-slate-300 relative font-['Sarabun',sans-serif] flex flex-col justify-between">
          <div>
            {/* Header with Organization Logo & Title */}
            <div className="flex items-center justify-between border-b-2 border-slate-900 pb-2 mb-3">
              <div className="flex items-center gap-3">
                <img
                  src="/assets/aistudio/382492-Photoroom_4c9e02f3.png"
                  alt="ตรามูลนิธิร่วมกุศลสมุทรปราการ"
                  className="w-14 h-14 object-contain"
                />
                <div>
                  <h1 className="text-base font-bold text-slate-900 tracking-tight leading-tight">
                    มูลนิธิร่วมกุศลสมุทรปราการ (北欖天德善堂)
                  </h1>
                  <p className="text-[12px] font-semibold text-slate-800">
                    โครงการสงเคราะห์ฌาปนกิจผู้ยากไร้และอนุเคราะห์เผาศพ
                  </p>
                  <p className="text-[10px] text-slate-600">
                    เลขที่ 170/3 ถนนสุขุมวิท ตำบลปากน้ำ อำเภอเมืองสมุทรปราการ จังหวัดสมุทรปราการ 10270 โทร. 02-395-0118
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="inline-block border-2 border-slate-900 px-3 py-0.5 text-xs font-bold bg-slate-50">
                  แบบฟอร์ม ฌศ.01
                </div>
                <div className="text-[11px] font-medium text-slate-700 mt-1">
                  รหัสคำร้อง: <span className="font-bold text-slate-900">{record.code}</span>
                </div>
                <div className="text-[10px] text-slate-500">
                  วันที่ยื่น: {formatThaiDate(record.applicationDate)}
                </div>
              </div>
            </div>

            <div className="text-center font-bold text-sm mb-2.5 underline underline-offset-4">
              คำร้องขอรับความช่วยเหลืออนุเคราะห์เผาศพ (ฌาปนกิจสงเคราะห์)
            </div>

            {/* Section 1: ข้อมูลผู้เสียชีวิต */}
            <div className="border border-slate-900 p-2.5 bg-slate-50/40 mb-2.5 text-[11.5px] space-y-1">
              <div className="font-bold text-xs text-slate-900 border-b border-slate-300 pb-0.5 mb-1">
                1. ข้อมูลผู้เสียชีวิต:
              </div>
              <div className="grid grid-cols-12 gap-1.5">
                <div className="col-span-7">
                  <span className="font-bold">ชื่อ-นามสกุล:</span> {record.deceasedTitle} {record.deceasedName}
                </div>
                <div className="col-span-2">
                  <span className="font-bold">อายุ:</span> {record.deceasedAge} ปี
                </div>
                <div className="col-span-3">
                  <span className="font-bold">วันที่เสียชีวิต:</span> {formatThaiDate(record.deceasedDeathDate)}
                </div>
              </div>
              <div className="grid grid-cols-12 gap-1.5">
                <div className="col-span-6">
                  <span className="font-bold">เลขประจำตัวประชาชน:</span>{' '}
                  <span className="font-mono font-semibold">{formatNationalId(record.deceasedNationalId) || '-'}</span>
                </div>
                <div className="col-span-6">
                  <span className="font-bold">สาเหตุการเสียชีวิต:</span> {record.causeOfDeath || '-'}
                </div>
              </div>
              <div className="grid grid-cols-12 gap-1.5">
                <div className="col-span-6">
                  <span className="font-bold">สถานที่เสียชีวิต:</span> {record.deathPlace || '-'}
                </div>
                <div className="col-span-6">
                  <span className="font-bold">ที่อยู่ตามทะเบียนบ้าน:</span> {record.deceasedAddress || '-'}
                </div>
              </div>
            </div>

            {/* Section 2: ข้อมูลผู้ยื่นคำร้อง */}
            <div className="border border-slate-900 p-2.5 bg-slate-50/40 mb-2.5 text-[11.5px] space-y-1">
              <div className="font-bold text-xs text-slate-900 border-b border-slate-300 pb-0.5 mb-1">
                2. ข้อมูลผู้ยื่นคำร้อง (ญาติ / ผู้จัดการศพ):
              </div>
              <div className="grid grid-cols-12 gap-1.5">
                <div className="col-span-5">
                  <span className="font-bold">ชื่อ-สกุล ผู้ยื่นคำร้อง:</span> {record.applicantTitle} {record.applicantName}
                </div>
                <div className="col-span-4">
                  <span className="font-bold">ความสัมพันธ์:</span> {record.applicantRelation}
                </div>
                <div className="col-span-3">
                  <span className="font-bold">โทรศัพท์:</span> {formatPhone(record.applicantPhone) || '-'}
                </div>
              </div>
              <div>
                <span className="font-bold">เลขประจำตัวประชาชน:</span>{' '}
                <span className="font-mono font-semibold">{formatNationalId(record.applicantNationalId) || '-'}</span>
                <span className="mx-2">•</span>
                <span className="font-bold">ที่อยู่ปัจจุบัน:</span> {record.applicantAddress || '-'}
              </div>
              <div>
                <span className="font-bold">เหตุผลความจำเป็น/สภาพความยากไร้:</span> {record.applicantPovertyReason || '-'}
              </div>
            </div>

            {/* Section 3: รายการการอนุเคราะห์ & ข้อมูลวัด */}
            <div className="border-2 border-slate-900 p-2.5 bg-amber-50/30 mb-2.5 text-[11.5px] space-y-1.5">
              <div className="font-bold text-xs text-slate-900 flex items-center justify-between border-b border-slate-300 pb-0.5">
                <span>3. ข้อมูลพิธีฌาปนกิจ และรายการที่มูลนิธิร่วมกุศลสมุทรปราการ ให้การอนุเคราะห์:</span>
                <span className="font-bold text-emerald-800">
                  {record.status === 'approved' ? 'อนุมัติการช่วยเหลือแล้ว' : 'อยู่ระหว่างรอการพิจารณา'}
                </span>
              </div>
              <div className="grid grid-cols-12 gap-1.5">
                <div className="col-span-7">
                  <span className="font-bold">วัดที่จัดพิธีฌาปนกิจ:</span>{' '}
                  <span className="font-semibold underline">{record.templeName}</span>
                </div>
                <div className="col-span-5">
                  <span className="font-bold">กำหนดการวันฌาปนกิจ (เผาศพ):</span>{' '}
                  <span className="font-semibold">{formatThaiDate(record.cremationDate)}</span> (เวลา {record.cremationTime || '16:00'} น.)
                </div>
              </div>

              {/* Assistance Amount Box */}
              <div className="bg-white border border-slate-900 p-2 rounded-xs flex items-center justify-between">
                <div>
                  <span className="font-bold text-xs text-slate-900">
                    1. เงินสดอนุเคราะห์ค่าจัดพิธีฌาปนกิจศพ:
                  </span>
                  <div className="text-[10px] text-slate-500">
                    (จำนวนเงินอนุเคราะห์ที่เจ้าหน้าที่และมูลนิธิฯ พิจารณาอนุมัติ)
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-slate-900">
                    {formatCurrency(record.assistanceAmount)} บาท
                  </div>
                  <div className="text-[10px] text-slate-600 font-semibold">
                    (จ่ายเป็นเงินสดเพื่อบรรเทาภาระค่าใช้จ่ายในการจัดพิธีศพ)
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] pt-1">
                <div>
                  2. หีบศพ (โลงศพ) ฟรี:{' '}
                  <span className="font-bold">{record.coffinProvided ? '✓ มูลนิธิฯ อนุเคราะห์หีบศพ' : 'ไม่รับ'}</span>
                </div>
                <div>
                  3. ยานพาหนะรับ-ส่งร่าง:{' '}
                  <span className="font-bold">{record.transportProvided ? '✓ บริการรถรับ-ส่งของมูลนิธิฯ' : 'ไม่รับ'}</span>
                </div>
                <div>
                  4. ผ้าขาวห่อศพ:{' '}
                  <span className="font-bold">{record.shroudClothProvided ? '✓ มี' : 'ไม่มี'}</span>
                </div>
                <div>
                  5. สิ่งของอื่นๆ เพิ่มเติม: {record.otherItems || '-'}
                </div>
              </div>
            </div>

            {/* Section 4: ตรวจสอบเอกสารแนบ 7 รายการ */}
            <div className="border border-slate-900 p-2 bg-slate-50 mb-3 text-[11px]">
              <div className="font-bold text-[11.5px] text-slate-900 mb-1 flex items-center justify-between">
                <span>4. บันทึกการตรวจสอบเอกสารหลักฐานสำคัญครบ 7 รายการ (ตามระเบียบมูลนิธิฯ):</span>
                <span className="text-[10px] text-slate-600 font-medium">
                  แนบแล้ว {record.documents?.length || 0} / 7 รายการ
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                {FUNERAL_DOC_DEFINITIONS.map((def) => {
                  const isAttached = record.documents?.some((d) => d.category === def.category);
                  return (
                    <div key={def.category} className="flex items-center gap-1.5">
                      <span className={`w-3.5 h-3.5 border border-slate-700 flex items-center justify-center font-bold text-[10px] ${
                        isAttached ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'
                      }`}>
                        {isAttached ? '✓' : ''}
                      </span>
                      <span className={isAttached ? 'font-semibold text-slate-900' : 'text-slate-600'}>
                        {def.number}. {def.title}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Signatures Section - 4 Parties */}
          <div className="pt-2 border-t border-slate-300">
            <div className="grid grid-cols-4 gap-2 text-center text-[10.5px]">
              {/* 1. Applicant */}
              <div className="flex flex-col items-center">
                <div className="text-slate-400 mb-3">...................................................</div>
                <div className="font-bold text-slate-900">({record.applicantTitle}{record.applicantName})</div>
                <div className="text-slate-600 text-[10px]">ผู้ยื่นคำร้องขอรับการอนุเคราะห์</div>
                <div className="text-slate-400 text-[9.5px]">วันที่ ........./........./............</div>
              </div>

              {/* 2. Receiving Officer */}
              <div className="flex flex-col items-center">
                <div className="text-slate-400 mb-3">...................................................</div>
                <div className="font-bold text-slate-900">({record.officerName || 'นายกริชพิพัฒน์ สลับทอง'})</div>
                <div className="text-slate-600 text-[10px]">{record.officerPosition || 'เจ้าหน้าที่รับคำร้อง'}</div>
                <div className="text-slate-400 text-[9.5px]">วันที่ ........./........./............</div>
              </div>

              {/* 3. Approver / Foundation Manager */}
              <div className="flex flex-col items-center">
                <div className="text-slate-400 mb-3">...................................................</div>
                <div className="font-bold text-slate-900">({record.approverName || 'นางสาวศาตพร ภูมิโคกรักษ์'})</div>
                <div className="text-slate-600 text-[10px]">{record.approverPosition || 'ผู้จัดการมูลนิธิฯ (ผู้อนุมัติ)'}</div>
                <div className="text-slate-400 text-[9.5px]">วันที่ ........./........./............</div>
              </div>

              {/* 4. Foundation President */}
              <div className="flex flex-col items-center">
                <div className="text-slate-400 mb-3">...................................................</div>
                <div className="font-bold text-slate-900">(นายไพวงศ์ ชำนินาวากุล)</div>
                <div className="text-slate-600 text-[10px]">ประธานมูลนิธิร่วมกุศลสมุทรปราการ</div>
                <div className="text-slate-400 text-[9.5px]">ประธานโครงการ/ผู้อนุมัติ</div>
              </div>
            </div>

            <div className="text-center text-[10px] text-slate-400 mt-2 border-t border-slate-200 pt-1">
              มูลนิธิร่วมกุศลสมุทรปราการ (北欖天德善堂) • โครงการสงเคราะห์ฌาปนกิจผู้ยากไร้และช่วยอนุเคราะห์เผาศพ
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
