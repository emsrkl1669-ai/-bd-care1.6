import React, { useState, useEffect, useMemo } from 'react';
import { 
  Printer, 
  X, 
  ArrowLeft, 
  FileText, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Minimize2,
  ChevronLeft,
  ChevronRight,
  Download,
  Info,
  CheckCircle2,
  Layers,
  FileCheck
} from 'lucide-react';
import { PatientRecord } from '../types';
import { formatThaiDate, formatCurrency, formatNationalId, formatPhone } from '../utils/idCard';

interface PrintFormSK04Props {
  patient: PatientRecord;
  onClose: () => void;
}

export const PrintFormSK04: React.FC<PrintFormSK04Props> = ({ patient, onClose }) => {
  // Preview mode: 'all' = continuous 3 pages, 1 = page 1, 2 = page 2, 3 = page 3
  const [activePage, setActivePage] = useState<'all' | 1 | 2 | 3>('all');
  
  // Scale factor for on-screen viewport fit
  const [scale, setScale] = useState<number>(0.75);

  // Mark body with printing class so only this modal prints
  useEffect(() => {
    document.body.classList.add('is-printing-sk04');
    return () => {
      document.body.classList.remove('is-printing-sk04');
    };
  }, []);

  // Auto-calculate best scale to fit comfortably on screen
  useEffect(() => {
    const updateFitScale = () => {
      const availableHeight = window.innerHeight - 150;
      // In single-page mode or initial view, fit one A4 page (~1123px)
      const targetHeight = activePage === 'all' ? 1123 : 1123;
      const fit = Math.min(1, Math.max(0.4, availableHeight / targetHeight));
      setScale(parseFloat(fit.toFixed(2)));
    };

    updateFitScale();
    window.addEventListener('resize', updateFitScale);
    return () => window.removeEventListener('resize', updateFitScale);
  }, [activePage]);

  const handlePrint = () => {
    window.print();
  };

  const netIncome = patient.netIncome;

  // Watermark for deceased ('ตาย'), moved ('ย้ายที่อยู่'), rejected ('ไม่ผ่านโครงการ')
  const watermarkText = useMemo(() => {
    if (patient.status === 'deceased') return 'ตาย';
    if (patient.status === 'moved') return 'ย้ายที่อยู่';
    if (patient.status === 'rejected') return 'ไม่ผ่านโครงการ';
    return null;
  }, [patient.status]);

  return (
    <div className="a4-print-modal sk04-print-modal fixed inset-0 z-50 overflow-y-auto bg-slate-900/85 backdrop-blur-xs flex flex-col items-center p-2 sm:p-4">
      {/* Control Bar - Hidden when printing */}
      <div className="no-print w-full max-w-5xl bg-white rounded-xl shadow-2xl p-3 mb-3 sticky top-2 z-50 border border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2.5 border-b border-slate-100">
          {/* Back & Title */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              title="ย้อนกลับ"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-1.5">
                  <span>ตัวอย่างก่อนพิมพ์ แบบ สค.04</span>
                  <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-md">
                    ครบ 3 หน้า A4
                  </span>
                </h2>
                <span className="text-[11px] bg-blue-100 text-blue-800 font-semibold px-2 py-0.5 rounded-full">
                  {patient.code}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                ผู้ป่วย: <span className="font-semibold text-slate-700">{patient.title} {patient.fullName}</span> • เลขบัตร: {formatNationalId(patient.nationalId)}
              </p>
            </div>
          </div>

          {/* Action Buttons: Print All 3 Pages & Close */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition cursor-pointer"
              title="สั่งพิมพ์ออกกระดาษ หรือบันทึกเป็นไฟล์ PDF (ออกครบทั้ง 3 หน้าอัตโนมัติ)"
            >
              <Printer className="w-4 h-4" />
              <span>สั่งพิมพ์ / บันทึก PDF (3 หน้า)</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-800 rounded-lg hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Second Row: Page Selection Tabs & Zoom Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          {/* Page Preview Switcher */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActivePage('all')}
              className={`flex items-center gap-1 px-3 py-1 rounded-md transition cursor-pointer ${
                activePage === 'all'
                  ? 'bg-white text-blue-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>ดูทั้งหมด 3 หน้า (ต่อเนื่อง)</span>
            </button>

            <button
              type="button"
              onClick={() => setActivePage(1)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition cursor-pointer ${
                activePage === 1
                  ? 'bg-white text-blue-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>หน้า 1 (ประวัติ)</span>
            </button>

            <button
              type="button"
              onClick={() => setActivePage(2)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition cursor-pointer ${
                activePage === 2
                  ? 'bg-white text-blue-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>หน้า 2 (ภาพ&QR)</span>
            </button>

            <button
              type="button"
              onClick={() => setActivePage(3)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition cursor-pointer ${
                activePage === 3
                  ? 'bg-white text-blue-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>หน้า 3 (เอกสาร)</span>
            </button>
          </div>

          {/* Quick Page Prev / Next (when in single page mode) */}
          {activePage !== 'all' && (
            <div className="flex items-center gap-1 text-xs">
              <button
                type="button"
                disabled={activePage === 1}
                onClick={() => setActivePage((p) => ((p as number) > 1 ? ((p as number) - 1 as 1 | 2 | 3) : 1))}
                className="p-1 px-2 border border-slate-200 rounded text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-0.5 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>หน้าก่อน</span>
              </button>
              <span className="font-bold text-slate-800 px-1">
                หน้า {activePage} / 3
              </span>
              <button
                type="button"
                disabled={activePage === 3}
                onClick={() => setActivePage((p) => ((p as number) < 3 ? ((p as number) + 1 as 1 | 2 | 3) : 3))}
                className="p-1 px-2 border border-slate-200 rounded text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-0.5 cursor-pointer"
              >
                <span>หน้าถัดไป</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Zoom / Scale Controls */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                const availableHeight = window.innerHeight - 150;
                const fit = Math.min(1, Math.max(0.4, availableHeight / 1150));
                setScale(parseFloat(fit.toFixed(2)));
              }}
              className="px-2 py-1 bg-white hover:bg-slate-50 text-slate-800 rounded shadow-2xs border border-slate-200 transition cursor-pointer flex items-center gap-1"
              title="ย่อขนาดให้เห็นพอดีหน้าจอ"
            >
              <Minimize2 className="w-3 h-3 text-blue-600" />
              <span>พอดีหน้าจอ</span>
            </button>

            <button
              type="button"
              onClick={() => setScale(1)}
              className={`px-2 py-1 rounded transition cursor-pointer ${
                scale === 1 ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-white'
              }`}
              title="ขนาดจริง 100% (A4)"
            >
              100%
            </button>

            <div className="flex items-center gap-0.5 border-l border-slate-200 pl-1">
              <button
                type="button"
                onClick={() => setScale((s) => Math.max(0.35, parseFloat((s - 0.1).toFixed(2))))}
                className="p-1 text-slate-600 hover:text-slate-900 rounded cursor-pointer"
                title="ย่อ (-)"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] font-mono w-9 text-center text-slate-700">
                {Math.round(scale * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setScale((s) => Math.min(1.4, parseFloat((s + 0.1).toFixed(2))))}
                className="p-1 text-slate-600 hover:text-slate-900 rounded cursor-pointer"
                title="ขยาย (+)"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Helpful Print Instruction Banner */}
        <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600">
          <div className="flex items-center gap-1.5 text-blue-800 font-medium">
            <Info className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span>
              ระบบตั้งค่าการพิมพ์มาตรฐาน <strong>A4 Portrait (ครบทั้ง 3 หน้า)</strong>: เมื่อกดพิมพ์ให้เลือก <strong>Destination: Save as PDF (บันทึกเป็น PDF)</strong> และติ๊กถูก <strong>Background graphics (กราฟิกพื้นหลัง)</strong>
            </span>
          </div>
          <span className="text-emerald-700 font-bold shrink-0 hidden sm:inline-flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> พร้อมพิมพ์ครบทั้ง 3 หน้า
          </span>
        </div>
      </div>

      {/* Scaled A4 Container (The Selected Focus Element) */}
      <div 
        className="w-full flex flex-col items-center gap-6 a4-container transition-all duration-150 origin-top pb-12"
        style={{
          transform: `scale(${scale})`,
          transformOrigin: 'top center',
          // Accurately compute bottom margin so that the entire document scrolls cleanly without clipping
          marginBottom: scale < 1 ? `-${Math.round((1 - scale) * (activePage === 'all' ? 3420 : 1150))}px` : undefined,
        }}
      >
        
        {/* ============================================================== */}
        {/* PAGE 1: ข้อมูลประวัติผู้ป่วยยากไร้, สภาพเศรษฐกิจ, รายการช่วยเหลือ, ลายเซ็น */}
        {/* ============================================================== */}
        <div 
          className={`a4-sheet bg-white text-black shadow-2xl rounded-xs p-6 sm:p-[14mm] border border-slate-300 relative font-['Sarabun',sans-serif] ${
            activePage !== 'all' && activePage !== 1 ? 'hidden print:flex' : 'flex'
          } flex-col justify-between`}
        >
          {/* Screen indicator tab */}
          <div className="no-print absolute -top-3 left-6 bg-slate-800 text-white text-[10px] font-bold px-3 py-0.5 rounded-full shadow-xs flex items-center gap-1.5">
            <FileText className="w-3 h-3 text-blue-400" />
            หน้าที่ 1 จาก 3: ประวัติผู้ป่วย สภาพเศรษฐกิจ และรายการช่วยเหลือ (มาตรฐาน A4)
          </div>

          {/* Status Watermark for Deceased ('ตาย') / Moved ('ย้ายที่อยู่') */}
          {watermarkText && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 select-none overflow-hidden">
              <div 
                className={`font-black tracking-widest uppercase border-[10px] rounded-3xl px-16 py-6 transform -rotate-30 select-none text-center ${
                  patient.status === 'deceased'
                    ? 'text-red-600/18 border-red-600/18 text-8xl sm:text-9xl'
                    : patient.status === 'moved'
                    ? 'text-amber-600/18 border-amber-600/18 text-7xl sm:text-8xl'
                    : 'text-slate-600/18 border-slate-600/18 text-7xl sm:text-8xl'
                }`}
                style={{ letterSpacing: '0.2em' }}
              >
                {watermarkText}
              </div>
            </div>
          )}

          <div>
            {/* Header with Organization Logo & Title */}
            <div className="flex items-center justify-between border-b-2 border-slate-900 pb-2.5 mb-3">
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
                    โครงการใจถึงใจช่วยผู้ป่วยยากไร้และติดเตียง
                  </p>
                  <p className="text-[10px] text-slate-600">
                    เลขที่ 170/3 ถนนสุขุมวิท ตำบลปากน้ำ อำเภอเมืองสมุทรปราการ จังหวัดสมุทรปราการ 10270
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="inline-block border-2 border-slate-900 px-3 py-0.5 text-sm font-bold bg-slate-50">
                  แบบ สค.04
                </div>
                <div className="text-[11px] font-medium text-slate-700 mt-1">
                  รหัสโครงการ: <span className="font-bold text-slate-900">{patient.code}</span>
                </div>
                <div className="text-[10.5px] text-slate-600 font-semibold">
                  หน้าที่ 1 จาก 3
                </div>
              </div>
            </div>

            <div className="text-center font-bold text-sm mb-2.5 underline underline-offset-4">
              ประวัติผู้ป่วยยากไร้
            </div>

            {/* Section 1: Personal Data */}
            <div className="space-y-1.5 mb-3 text-[12px]">
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="font-bold">วันที่รับเข้าโครงการ:</span>{' '}
                  <span>{formatThaiDate(patient.admissionDate)}</span>
                </div>
                <div>
                  <span className="font-bold">สถานะ:</span>{' '}
                  <span className="font-semibold">
                    {patient.status === 'active' ? 'อยู่ในโครงการ' :
                     patient.status === 'pending' ? 'รอพิจารณา' :
                     patient.status === 'deceased' ? 'ถึงแก่กรรม' :
                     patient.status === 'moved' ? 'ย้ายที่อยู่' : 'ไม่ผ่านโครงการ'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-12 gap-1.5">
                <div className="col-span-6">
                  <span className="font-bold">ชื่อ-สกุล:</span> {patient.title} {patient.fullName}
                </div>
                <div className="col-span-2">
                  <span className="font-bold">อายุ:</span> {patient.age} ปี
                </div>
                <div className="col-span-4">
                  <span className="font-bold">เกิดวันที่:</span> {formatThaiDate(patient.birthDate)}
                </div>
              </div>

              <div>
                <span className="font-bold">เลขที่บัตรประจำตัวประชาชน:</span>{' '}
                <span className="font-mono tracking-wider font-semibold">
                  {formatNationalId(patient.nationalId)}
                </span>
              </div>

              <div className="grid grid-cols-12 gap-1.5">
                <div className="col-span-6">
                  <span className="font-bold">เบอร์โทรศัพท์ผู้ป่วย:</span>{' '}
                  {formatPhone(patient.phone) || '-'}
                </div>
                <div className="col-span-6">
                  <span className="font-bold">ผู้ประสานงาน/ผู้ดูแล:</span>{' '}
                  {patient.caregiverName || '-'}{' '}
                  {patient.caregiverRelation ? `(${patient.caregiverRelation})` : ''}{' '}
                  {patient.caregiverPhone ? `โทร ${formatPhone(patient.caregiverPhone)}` : ''}
                </div>
              </div>

              {/* ID Address */}
              <div>
                <span className="font-bold">ที่อยู่ตามบัตรประชาชน:</span> เลขที่ {patient.idAddress.houseNo || '-'} ม.{patient.idAddress.moo || '-'} ตรอก {patient.idAddress.trok || '-'} ซอย {patient.idAddress.soi || '-'} ถนน {patient.idAddress.road || '-'} ตำบล {patient.idAddress.subdistrict || '-'} อำเภอ {patient.idAddress.district || '-'} จังหวัด {patient.idAddress.province || '-'}
              </div>

              {/* Current Address */}
              <div>
                <span className="font-bold">ที่อยู่ปัจจุบัน:</span>{' '}
                {patient.isSameAddress ? '(ที่อยู่เดียวกันกับบัตรประชาชน/ทะเบียนบ้าน) ' : ''}
                เลขที่ {patient.currentAddress.houseNo} ตึก/อาคาร/หมู่บ้าน {patient.currentAddress.buildingVillage || '-'} ตรอก {patient.currentAddress.trok || '-'} ซอย {patient.currentAddress.soi || '-'} ถนน {patient.currentAddress.road || '-'} ตำบล {patient.currentAddress.subdistrict} อำเภอ {patient.currentAddress.district} จังหวัด {patient.currentAddress.province}
              </div>

              {/* Illness & Disability */}
              <div>
                <span className="font-bold">ระดับการเจ็บป่วย:</span>{' '}
                <span className="font-semibold underline">
                  {patient.mobilityLevel === 'bedridden' ? 'ติดเตียง 100%' :
                   patient.mobilityLevel === 'semi_bedridden' ? 'กึ่งติดเตียง' : 'พอเดินได้'}
                </span>
                <span className="mx-2">•</span>
                <span className="font-bold">โรคประจำตัว/อาการเจ็บป่วย:</span>{' '}
                {patient.chronicDiseases || '-'}
                {patient.symptomsDetail ? ` (${patient.symptomsDetail})` : ''}
              </div>

              <div className="grid grid-cols-12 gap-1.5">
                <div className="col-span-7">
                  <span className="font-bold">บัตรประจำตัวผู้พิการ:</span>{' '}
                  {patient.disabilityCard.hasCard ? (
                    <span>
                      {patient.disabilityCard.type || 'ประเภท 3'}{' '}
                      เลขที่: {patient.disabilityCard.cardNumber || '-'}
                    </span>
                  ) : (
                    <span>ไม่มีบัตรประจำตัวผู้พิการ</span>
                  )}
                </div>
                <div className="col-span-5 text-right">
                  <span className="font-bold">สมาชิกในครอบครัว:</span>{' '}
                  {patient.familyMembersTotal} คน (ชาย {patient.familyMembersMale}, หญิง {patient.familyMembersFemale})
                </div>
              </div>
            </div>

            {/* Section 2: Economics Table */}
            <div className="mb-3">
              <div className="font-bold text-[12px] mb-1">สภาพเศรษฐกิจครอบครัว:</div>
              <table className="w-full border-collapse border border-slate-900 text-[11.5px]">
                <tbody>
                  <tr>
                    <td className="border border-slate-900 px-2 py-1 font-medium w-1/2">
                      รายได้ครอบครัวต่อเดือน:
                    </td>
                    <td className="border border-slate-900 px-2 py-1 text-right font-medium">
                      {formatCurrency(patient.incomeSalary)} บาท
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-slate-900 px-2 py-0.5">เบี้ยผู้พิการ:</td>
                    <td className="border border-slate-900 px-2 py-0.5 text-right">
                      {formatCurrency(patient.incomeDisability)} บาท
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-slate-900 px-2 py-0.5">เบี้ยชราภาพ:</td>
                    <td className="border border-slate-900 px-2 py-0.5 text-right">
                      {formatCurrency(patient.incomeElderly)} บาท
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-slate-900 px-2 py-0.5">บัตรสวัสดิการแห่งรัฐ:</td>
                    <td className="border border-slate-900 px-2 py-0.5 text-right">
                      {formatCurrency(patient.incomeStateWelfare)} บาท
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-slate-900 px-2 py-0.5">รายได้อื่นๆ:</td>
                    <td className="border border-slate-900 px-2 py-0.5 text-right">
                      {formatCurrency(patient.incomeOther)} บาท
                    </td>
                  </tr>
                  {/* รายการสำรวจค่าใช้จ่ายผู้ป่วย & หนี้สิน */}
                  <tr>
                    <td colSpan={2} className="border border-slate-900 bg-slate-50 px-2 py-0.5 font-bold text-[11px] text-slate-800">
                      รายการสำรวจค่าใช้จ่ายผู้ป่วย & ภาระหนี้สิน:
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-slate-900 px-2 py-0.5 pl-4 text-slate-700">
                      - ค่าเช่าบ้าน / ที่อยู่อาศัย:
                    </td>
                    <td className="border border-slate-900 px-2 py-0.5 text-right font-medium">
                      {formatCurrency(patient.expenseRentHouse || 0)} บาท
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-slate-900 px-2 py-0.5 pl-4 text-slate-700">
                      - ค่าเช่าที่ดิน:
                    </td>
                    <td className="border border-slate-900 px-2 py-0.5 text-right font-medium">
                      {formatCurrency(patient.expenseRentLand || 0)} บาท
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-slate-900 px-2 py-0.5 pl-4 text-slate-700">
                      - ค่าดำรงชีพ (อาหารและของใช้จำเป็น):
                    </td>
                    <td className="border border-slate-900 px-2 py-0.5 text-right font-medium">
                      {formatCurrency(patient.expenseLiving || 0)} บาท
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-slate-900 px-2 py-0.5 pl-4 text-slate-700">
                      - ค่าเดินทาง (แพทย์นัด/ไปโรงพยาบาล):
                    </td>
                    <td className="border border-slate-900 px-2 py-0.5 text-right font-medium">
                      {formatCurrency(patient.expenseMedicalTravel || 0)} บาท
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-slate-900 px-2 py-0.5 pl-4 text-slate-700">
                      - หนี้สิน / ภาระหนี้:
                    </td>
                    <td className="border border-slate-900 px-2 py-0.5 text-right font-medium">
                      {formatCurrency(patient.expenseDebt || 0)} บาท
                    </td>
                  </tr>
                  {patient.expenseOther ? (
                    <tr>
                      <td className="border border-slate-900 px-2 py-0.5 pl-4 text-slate-700">
                        - ค่าใช้จ่ายอื่นๆ:
                      </td>
                      <td className="border border-slate-900 px-2 py-0.5 text-right font-medium">
                        {formatCurrency(patient.expenseOther)} บาท
                      </td>
                    </tr>
                  ) : null}
                  <tr className="bg-red-50/60">
                    <td className="border border-slate-900 px-2 py-1 font-bold">
                      รวมค่าใช้จ่ายต่อเดือน:
                    </td>
                    <td className="border border-slate-900 px-2 py-1 text-right font-bold text-red-700">
                      {formatCurrency(patient.monthlyExpense)} บาท
                    </td>
                  </tr>
                  <tr className="bg-slate-100">
                    <td className="border border-slate-900 px-2 py-1 font-bold">
                      รายได้สุทธิประจำเดือน (คำนวณอัตโนมัติ):
                    </td>
                    <td className={`border border-slate-900 px-2 py-1 text-right font-bold ${netIncome < 0 ? 'text-red-700' : 'text-slate-900'}`}>
                      {formatCurrency(netIncome)} บาท {netIncome < 0 ? '(ขาดดุล/ติดลบ)' : ''}
                    </td>
                  </tr>
                </tbody>
              </table>
              {patient.economicNote && (
                <div className="text-[10.5px] text-slate-700 mt-0.5 italic">
                  * หมายเหตุเศรษฐกิจ: {patient.economicNote}
                </div>
              )}
            </div>

            {/* Section 3: Relief Package */}
            <div className="border border-slate-900 p-2.5 bg-slate-50/50 mb-3 text-[11.5px]">
              <div className="font-bold text-xs mb-1.5 text-slate-900">
                มูลนิธิร่วมกุศลสมุทรปราการ ให้การช่วยเหลือดังนี้:
              </div>
              <div className="grid grid-cols-2 gap-y-1.5 gap-x-2">
                <div>
                  1. เงินสดช่วยเหลือ:{' '}
                  <span className="font-bold">
                    {patient.helpCashEnabled ? formatCurrency(patient.helpCashAmount) : '0.00'}
                  </span>{' '}
                  บาท/เดือน
                </div>
                <div>
                  2. ผ้าอ้อมผู้ใหญ่ขนาด:{' '}
                  <span className="font-bold">
                    {patient.helpDiaperSize === 'NONE' ? '-' : patient.helpDiaperSize}
                  </span>{' '}
                  จำนวน <span className="font-bold">{patient.helpDiaperPacks}</span> ห่อ/เดือน
                </div>
                <div>
                  3. ข้าวสารถุงละ 5 กก. จำนวน:{' '}
                  <span className="font-bold">{patient.helpRicePacks}</span> ถุง/เดือน
                </div>
                <div>
                  4. น้ำดื่มสิงห์{patient.helpWaterSize === '600ML' ? 'ขนาด 600 ML. (แพ็ค 12 ขวด)' : patient.helpWaterSize === 'NONE' ? ' (ไม่รับ)' : 'ขนาด 1.5L (แพ็ค 6 ขวด)'} จำนวน:{' '}
                  <span className="font-bold">{patient.helpWaterSize === 'NONE' ? 0 : patient.helpWaterPacks}</span> แพ็ค/เดือน
                </div>
                <div className="col-span-2">
                  5. อื่นๆ:{' '}
                  <span className="font-semibold">{patient.helpOtherSupplies || '-'}</span>
                </div>
              </div>
            </div>

            {/* Social Worker Opinion & Vulnerability Score */}
            {(patient.socialWorkerOpinion || patient.vulnerabilityScore) && (
              <div className="text-[11px] mb-2 leading-snug bg-slate-50/70 p-2 rounded border border-slate-200">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="font-bold text-slate-900">การประเมิน 4 มิติ & ความเห็นเจ้าหน้าที่ฝ่ายสังคมสงเคราะห์:</span>
                  <span className="font-bold text-slate-900 font-mono text-[10.5px]">
                    ดัชนีความเปราะบาง: {patient.vulnerabilityScore}/100 ({patient.vulnerabilityLevel || 'เปราะบางปานกลาง'})
                  </span>
                </div>
                <div className="text-slate-800">{patient.socialWorkerOpinion || 'เห็นสมควรรับเข้าโครงการเพื่อสงเคราะห์สิ่งของยังชีพประจำเดือน'}</div>
              </div>
            )}
          </div>

          {/* Signatures Section - 3 Officials */}
          <div className="pt-3 border-t border-slate-300">
            <div className="grid grid-cols-3 gap-3 text-center text-[11.5px]">
              {/* Interviewer */}
              <div className="flex flex-col items-center">
                <div className="text-slate-400 mb-4">...................................................</div>
                <div className="font-bold text-slate-900">({patient.interviewerName || 'นายกริชพิพัฒน์ สลับทอง'})</div>
                <div className="text-slate-600 text-[10.5px]">
                  {patient.interviewerPosition || 'เจ้าหน้าที่ฝ่ายสังคมสงเคราะห์'}
                </div>
                <div className="text-slate-500 text-[10px]">ผู้สัมภาษณ์และลงพื้นที่</div>
              </div>

              {/* Approver */}
              <div className="flex flex-col items-center">
                <div className="text-slate-400 mb-4">...................................................</div>
                <div className="font-bold text-slate-900">({patient.approverName || 'นางสาวศาตพร ภูมิโคกรักษ์'})</div>
                <div className="text-slate-600 text-[10.5px]">
                  {patient.approverPosition || 'ผู้จัดการมูลนิธิร่วมกุศลสมุทรปราการ'}
                </div>
                <div className="text-slate-500 text-[10px]">ผู้พิจารณาอนุมัติ</div>
              </div>

              {/* President */}
              <div className="flex flex-col items-center">
                <div className="text-slate-400 mb-4">...................................................</div>
                <div className="font-bold text-slate-900">({patient.presidentName || 'นายไพวงศ์ ชำนินาวากุล'})</div>
                <div className="text-slate-600 text-[10.5px]">
                  {patient.presidentPosition || 'ประธานมูลนิธิร่วมกุศลสมุทรปราการ'}
                </div>
                <div className="text-slate-500 text-[10px]">ประธานโครงการ/ผู้อนุมัติ</div>
              </div>
            </div>
          </div>
        </div>

        {/* Visual Page Break Indicator on Screen */}
        <div className={`no-print flex items-center justify-center gap-2 text-xs font-semibold text-slate-400 my-1 ${
          activePage !== 'all' ? 'hidden' : 'flex'
        }`}>
          <span className="w-16 h-px bg-slate-300" />
          <span>สิ้นสุดหน้าที่ 1 • ขึ้นหน้าที่ 2 (Page Break)</span>
          <span className="w-16 h-px bg-slate-300" />
        </div>

        {/* ============================================================== */}
        {/* PAGE 2: ภาพผู้ป่วย / บ้านผู้ป่วย / พิกัด Google Maps & QR Code */}
        {/* ============================================================== */}
        <div 
          className={`a4-sheet bg-white text-black shadow-2xl rounded-xs p-6 sm:p-[14mm] border border-slate-300 relative font-['Sarabun',sans-serif] ${
            activePage !== 'all' && activePage !== 2 ? 'hidden print:flex' : 'flex'
          } flex-col justify-between`}
        >
          {/* Screen indicator tab */}
          <div className="no-print absolute -top-3 left-6 bg-slate-800 text-white text-[10px] font-bold px-3 py-0.5 rounded-full shadow-xs flex items-center gap-1.5">
            <FileText className="w-3 h-3 text-blue-400" />
            หน้าที่ 2 จาก 3: ภาพถ่ายผู้ป่วย/สภาพบ้าน และพิกัด QR Code นำทาง (มาตรฐาน A4)
          </div>

          {/* Status Watermark for Deceased ('ตาย') / Moved ('ย้ายที่อยู่') */}
          {watermarkText && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 select-none overflow-hidden">
              <div 
                className={`font-black tracking-widest uppercase border-[10px] rounded-3xl px-16 py-6 transform -rotate-30 select-none text-center ${
                  patient.status === 'deceased'
                    ? 'text-red-600/18 border-red-600/18 text-8xl sm:text-9xl'
                    : patient.status === 'moved'
                    ? 'text-amber-600/18 border-amber-600/18 text-7xl sm:text-8xl'
                    : 'text-slate-600/18 border-slate-600/18 text-7xl sm:text-8xl'
                }`}
                style={{ letterSpacing: '0.2em' }}
              >
                {watermarkText}
              </div>
            </div>
          )}

          <div>
            {/* Header Page 2 */}
            <div className="flex items-center justify-between border-b-2 border-slate-900 pb-2 mb-3">
              <div className="flex items-center gap-2">
                <img
                  src="/assets/aistudio/382492-Photoroom_4c9e02f3.png"
                  alt="ตรามูลนิธิ"
                  className="w-10 h-10 object-contain"
                />
                <div>
                  <h2 className="text-sm font-bold text-slate-900 leading-tight">
                    ภาพผู้ป่วย/บ้านผู้ป่วย/พิกัดบ้านผู้ป่วย
                  </h2>
                  <p className="text-[11px] text-slate-600">
                    โครงการใจถึงใจช่วยผู้ป่วยยากไร้และติดเตียง มูลนิธิร่วมกุศลสมุทรปราการ
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="inline-block border border-slate-900 px-2 py-0.5 text-xs font-bold bg-slate-50">
                  แบบ สค.04
                </div>
                <div className="text-[11px] text-slate-700">
                  หน้าที่ 2 จาก 3 • รหัส: <span className="font-bold text-slate-900">{patient.code}</span>
                </div>
              </div>
            </div>

            <div className="text-xs mb-3 font-medium">
              <span className="font-bold">ผู้ป่วย:</span> {patient.title} {patient.fullName} |{' '}
              <span className="font-bold">ที่อยู่:</span> เลขที่ {patient.currentAddress.houseNo} ต.{patient.currentAddress.subdistrict} อ.{patient.currentAddress.district} จ.{patient.currentAddress.province}
            </div>

            {/* Photos Grid: Patient & House/Wound */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              {/* Photo 1: Patient */}
              <div className="border border-slate-300 p-2 rounded-sm bg-slate-50 flex flex-col items-center">
                <div className="w-full h-44 bg-slate-200 border border-slate-300 flex items-center justify-center overflow-hidden">
                  {patient.photos?.[0] ? (
                    <img
                      src={patient.photos[0].dataUrl}
                      alt="ภาพผู้ป่วย"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-slate-400 text-xs italic">[พื้นที่ติดภาพถ่ายผู้ป่วย / อาการเจ็บป่วย]</span>
                  )}
                </div>
                <div className="text-xs font-semibold text-slate-800 mt-1.5 text-center">
                  ภาพถ่ายผู้ป่วย / อาการเจ็บป่วย
                </div>
                {patient.photos?.[0]?.caption && (
                  <div className="text-[11px] text-slate-600 text-center mt-0.5 truncate max-w-full">
                    {patient.photos[0].caption}
                  </div>
                )}
              </div>

              {/* Photo 2: House */}
              <div className="border border-slate-300 p-2 rounded-sm bg-slate-50 flex flex-col items-center">
                <div className="w-full h-44 bg-slate-200 border border-slate-300 flex items-center justify-center overflow-hidden">
                  {patient.photos?.[1] ? (
                    <img
                      src={patient.photos[1].dataUrl}
                      alt="ภาพบ้าน"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-slate-400 text-xs italic">[พื้นที่ติดภาพบ้าน / ทางเข้าที่อยู่อาศัย]</span>
                  )}
                </div>
                <div className="text-xs font-semibold text-slate-800 mt-1.5 text-center">
                  ภาพสภาพบ้าน / สภาพแวดล้อมที่อยู่อาศัย
                </div>
                {patient.photos?.[1]?.caption && (
                  <div className="text-[11px] text-slate-600 text-center mt-0.5 truncate max-w-full">
                    {patient.photos[1].caption}
                  </div>
                )}
              </div>
            </div>

            {/* Location & QR Code Section */}
            <div className="border-2 border-slate-800 p-3.5 bg-slate-50 rounded-sm">
              <div className="text-xs font-bold text-slate-900 border-b border-slate-300 pb-1 mb-2.5 flex items-center justify-between">
                <span>พิกัดบ้านผู้ป่วย (GPS) และ QR Code สำหรับนำทาง Google Maps</span>
                <span className="text-[11px] font-normal text-blue-700">สแกนด้วยกล้องมือถือเพื่อเปิดแผนที่</span>
              </div>

              <div className="grid grid-cols-12 gap-3 items-center">
                {/* QR Code */}
                <div className="col-span-5 flex flex-col items-center justify-center p-2 bg-white border border-slate-300 rounded-sm">
                  {patient.qrCodeDataUrl ? (
                    <img
                      src={patient.qrCodeDataUrl}
                      alt="QR Code พิกัดบ้านผู้ป่วย"
                      className="w-36 h-36 object-contain"
                    />
                  ) : (
                    <div className="w-36 h-36 border border-dashed border-slate-400 flex items-center justify-center text-xs text-slate-400 text-center p-2">
                      ยังไม่ได้ระบุพิกัด GPS
                    </div>
                  )}
                  <span className="text-[10px] font-bold text-slate-700 mt-1">
                    Google Maps พิกัดบ้านผู้ป่วย
                  </span>
                </div>

                {/* GPS Info & Landmark */}
                <div className="col-span-7 space-y-1.5 text-xs">
                  <div>
                    <span className="font-bold">พิกัดละติจูด (Lat):</span>{' '}
                    <span className="font-mono">{patient.latitude ? patient.latitude.toFixed(6) : '-'}</span>
                  </div>
                  <div>
                    <span className="font-bold">พิกัดลองจิจูด (Lng):</span>{' '}
                    <span className="font-mono">{patient.longitude ? patient.longitude.toFixed(6) : '-'}</span>
                  </div>
                  <div>
                    <span className="font-bold">ลิงก์ Google Maps:</span>{' '}
                    <div className="text-[10.5px] font-mono text-blue-700 break-all select-all">
                      {patient.googleMapsUrl || '-'}
                    </div>
                  </div>
                  <div className="pt-1.5 border-t border-slate-200">
                    <span className="font-bold">จุดสังเกตและเส้นทางเข้าบ้าน:</span>
                    <p className="text-slate-800 text-xs mt-0.5 leading-relaxed bg-white p-2 border border-slate-200 rounded-sm">
                      {patient.landmarkNote || 'ไม่มีข้อมูลจุดสังเกต'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center text-[10.5px] text-slate-500 pt-3 border-t border-slate-200">
            เอกสารโครงการใจถึงใจช่วยผู้ป่วยติดเตียงและยากไร้ มูลนิธิร่วมกุศลสมุทรปราการ (北欖天德善堂)
          </div>
        </div>

        {/* Visual Page Break Indicator on Screen */}
        <div className={`no-print flex items-center justify-center gap-2 text-xs font-semibold text-slate-400 my-1 ${
          activePage !== 'all' ? 'hidden' : 'flex'
        }`}>
          <span className="w-16 h-px bg-slate-300" />
          <span>สิ้นสุดหน้าที่ 2 • ขึ้นหน้าที่ 3 (Page Break)</span>
          <span className="w-16 h-px bg-slate-300" />
        </div>

        {/* ============================================================== */}
        {/* PAGE 3: เอกสารประกอบของผู้ป่วย (ครบถ้วนสมบูรณ์) */}
        {/* ============================================================== */}
        <div 
          className={`a4-sheet bg-white text-black shadow-2xl rounded-xs p-6 sm:p-[14mm] border border-slate-300 relative font-['Sarabun',sans-serif] ${
            activePage !== 'all' && activePage !== 3 ? 'hidden print:flex' : 'flex'
          } flex-col justify-between`}
        >
          {/* Screen indicator tab */}
          <div className="no-print absolute -top-3 left-6 bg-slate-800 text-white text-[10px] font-bold px-3 py-0.5 rounded-full shadow-xs flex items-center gap-1.5">
            <FileText className="w-3 h-3 text-blue-400" />
            หน้าที่ 3 จาก 3: สำเนาเอกสารหลักฐานประกอบของผู้ป่วย (มาตรฐาน A4)
          </div>

          {/* Status Watermark for Deceased ('ตาย') / Moved ('ย้ายที่อยู่') */}
          {watermarkText && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 select-none overflow-hidden">
              <div 
                className={`font-black tracking-widest uppercase border-[10px] rounded-3xl px-16 py-6 transform -rotate-30 select-none text-center ${
                  patient.status === 'deceased'
                    ? 'text-red-600/18 border-red-600/18 text-8xl sm:text-9xl'
                    : patient.status === 'moved'
                    ? 'text-amber-600/18 border-amber-600/18 text-7xl sm:text-8xl'
                    : 'text-slate-600/18 border-slate-600/18 text-7xl sm:text-8xl'
                }`}
                style={{ letterSpacing: '0.2em' }}
              >
                {watermarkText}
              </div>
            </div>
          )}

          <div>
            {/* Header Page 3 */}
            <div className="flex items-center justify-between border-b-2 border-slate-900 pb-2 mb-3">
              <div className="flex items-center gap-2">
                <img
                  src="/assets/aistudio/382492-Photoroom_4c9e02f3.png"
                  alt="ตรามูลนิธิ"
                  className="w-10 h-10 object-contain"
                />
                <div>
                  <h2 className="text-sm font-bold text-slate-900 leading-tight">
                    เอกสารประกอบของผู้ป่วย
                  </h2>
                  <p className="text-[11px] text-slate-600">
                    โครงการใจถึงใจช่วยผู้ป่วยยากไร้และติดเตียง มูลนิธิร่วมกุศลสมุทรปราการ
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="inline-block border border-slate-900 px-2 py-0.5 text-xs font-bold bg-slate-50">
                  แบบ สค.04
                </div>
                <div className="text-[11px] text-slate-700">
                  หน้าที่ 3 จาก 3 • รหัส: <span className="font-bold text-slate-900">{patient.code}</span>
                </div>
              </div>
            </div>

            <div className="text-xs mb-3">
              <span className="font-bold">ผู้ป่วย:</span> {patient.title} {patient.fullName} |{' '}
              <span className="font-bold">เลขประจำตัวประชาชน:</span> {formatNationalId(patient.nationalId)}
            </div>

            {/* Document Checklist */}
            <div className="border border-slate-900 p-2.5 bg-slate-50 mb-3 text-xs">
              <div className="font-bold mb-1.5 text-slate-900">
                รายการเอกสารหลักฐานสำคัญ 4 รายการ (ตรวจสอบความถูกต้อง):
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <div className="flex items-center gap-1.5">
                  <span className={`w-3.5 h-3.5 border border-slate-700 flex items-center justify-center font-bold text-[10px] ${
                    patient.documents?.some((d) => d.category === 'id_card') ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'
                  }`}>
                    {patient.documents?.some((d) => d.category === 'id_card') ? '✓' : ''}
                  </span>
                  <span>1. สำเนาบัตรประจำตัวประชาชน</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`w-3.5 h-3.5 border border-slate-700 flex items-center justify-center font-bold text-[10px] ${
                    patient.documents?.some((d) => d.category === 'house_reg') ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'
                  }`}>
                    {patient.documents?.some((d) => d.category === 'house_reg') ? '✓' : ''}
                  </span>
                  <span>2. สำเนาทะเบียนบ้าน</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`w-3.5 h-3.5 border border-slate-700 flex items-center justify-center font-bold text-[10px] ${
                    patient.documents?.some((d) => d.category === 'disability_card') ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'
                  }`}>
                    {patient.documents?.some((d) => d.category === 'disability_card') ? '✓' : ''}
                  </span>
                  <span>3. สำเนาสมุด/บัตรประจำตัวคนพิการ</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`w-3.5 h-3.5 border border-slate-700 flex items-center justify-center font-bold text-[10px] ${
                    patient.documents?.some((d) => d.category === 'medical_cert') ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'
                  }`}>
                    {patient.documents?.some((d) => d.category === 'medical_cert') ? '✓' : ''}
                  </span>
                  <span>4. ใบรับรองแพทย์ / ประวัติการรักษา</span>
                </div>
              </div>
            </div>

            {/* 4 Official Document Frames (Rendering uploaded files or official attachment frames) */}
            <div className="grid grid-cols-2 gap-3 mb-2">
              {/* Frame 1: ID Card */}
              {(() => {
                const doc = patient.documents?.find((d) => d.category === 'id_card');
                return (
                  <div className="border border-slate-300 p-2 bg-slate-50/70 rounded-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-800 mb-1">
                      <span>1. สำเนาบัตรประจำตัวประชาชน</span>
                      {doc ? (
                        <span className="text-[10px] font-normal text-emerald-700 flex items-center gap-0.5">
                          <CheckCircle2 className="w-3 h-3" /> แนบแล้ว
                        </span>
                      ) : (
                        <span className="text-[10px] font-normal text-slate-400">ติดสำเนาจริง</span>
                      )}
                    </div>
                    <div className="h-36 bg-white border border-slate-200 flex flex-col items-center justify-center overflow-hidden p-1">
                      {doc?.dataUrl && doc.fileType.includes('image') ? (
                        <img
                          src={doc.dataUrl}
                          alt="สำเนาบัตรประชาชน"
                          className="max-h-full max-w-full object-contain"
                        />
                      ) : doc ? (
                        <div className="text-center p-2 text-slate-600 text-xs">
                          <FileCheck className="w-7 h-7 mx-auto text-blue-600 mb-1" />
                          <div className="font-semibold truncate max-w-[150px]">{doc.fileName}</div>
                          <div className="text-[10px] text-slate-400">ไฟล์แนบอิเล็กทรอนิกส์ในระบบ</div>
                        </div>
                      ) : (
                        <div className="text-center p-3 text-slate-400 text-xs flex flex-col items-center justify-center h-full">
                          <div className="border border-dashed border-slate-300 w-full h-full flex flex-col items-center justify-center p-2">
                            <span className="font-medium text-slate-500">ช่องสำหรับติดสำเนาบัตรประชาชน</span>
                            <span className="text-[10px] text-slate-400 mt-1">(พร้อมรับรองสำเนาถูกต้อง)</span>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500 text-center mt-1">
                      รับรองสำเนาถูกต้อง: ....................................................
                    </div>
                  </div>
                );
              })()}

              {/* Frame 2: House Registration */}
              {(() => {
                const doc = patient.documents?.find((d) => d.category === 'house_reg');
                return (
                  <div className="border border-slate-300 p-2 bg-slate-50/70 rounded-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-800 mb-1">
                      <span>2. สำเนาทะเบียนบ้าน</span>
                      {doc ? (
                        <span className="text-[10px] font-normal text-emerald-700 flex items-center gap-0.5">
                          <CheckCircle2 className="w-3 h-3" /> แนบแล้ว
                        </span>
                      ) : (
                        <span className="text-[10px] font-normal text-slate-400">ติดสำเนาจริง</span>
                      )}
                    </div>
                    <div className="h-36 bg-white border border-slate-200 flex flex-col items-center justify-center overflow-hidden p-1">
                      {doc?.dataUrl && doc.fileType.includes('image') ? (
                        <img
                          src={doc.dataUrl}
                          alt="สำเนาทะเบียนบ้าน"
                          className="max-h-full max-w-full object-contain"
                        />
                      ) : doc ? (
                        <div className="text-center p-2 text-slate-600 text-xs">
                          <FileCheck className="w-7 h-7 mx-auto text-blue-600 mb-1" />
                          <div className="font-semibold truncate max-w-[150px]">{doc.fileName}</div>
                          <div className="text-[10px] text-slate-400">ไฟล์แนบอิเล็กทรอนิกส์ในระบบ</div>
                        </div>
                      ) : (
                        <div className="text-center p-3 text-slate-400 text-xs flex flex-col items-center justify-center h-full">
                          <div className="border border-dashed border-slate-300 w-full h-full flex flex-col items-center justify-center p-2">
                            <span className="font-medium text-slate-500">ช่องสำหรับติดสำเนาทะเบียนบ้าน</span>
                            <span className="text-[10px] text-slate-400 mt-1">(พร้อมรับรองสำเนาถูกต้อง)</span>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500 text-center mt-1">
                      รับรองสำเนาถูกต้อง: ....................................................
                    </div>
                  </div>
                );
              })()}

              {/* Frame 3: Disability Card */}
              {(() => {
                const doc = patient.documents?.find((d) => d.category === 'disability_card');
                return (
                  <div className="border border-slate-300 p-2 bg-slate-50/70 rounded-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-800 mb-1">
                      <span>3. สำเนาสมุด/บัตรคนพิการ</span>
                      {doc ? (
                        <span className="text-[10px] font-normal text-emerald-700 flex items-center gap-0.5">
                          <CheckCircle2 className="w-3 h-3" /> แนบแล้ว
                        </span>
                      ) : (
                        <span className="text-[10px] font-normal text-slate-400">ติดสำเนาจริง</span>
                      )}
                    </div>
                    <div className="h-36 bg-white border border-slate-200 flex flex-col items-center justify-center overflow-hidden p-1">
                      {doc?.dataUrl && doc.fileType.includes('image') ? (
                        <img
                          src={doc.dataUrl}
                          alt="สำเนาสมุดคนพิการ"
                          className="max-h-full max-w-full object-contain"
                        />
                      ) : doc ? (
                        <div className="text-center p-2 text-slate-600 text-xs">
                          <FileCheck className="w-7 h-7 mx-auto text-blue-600 mb-1" />
                          <div className="font-semibold truncate max-w-[150px]">{doc.fileName}</div>
                          <div className="text-[10px] text-slate-400">ไฟล์แนบอิเล็กทรอนิกส์ในระบบ</div>
                        </div>
                      ) : (
                        <div className="text-center p-3 text-slate-400 text-xs flex flex-col items-center justify-center h-full">
                          <div className="border border-dashed border-slate-300 w-full h-full flex flex-col items-center justify-center p-2">
                            <span className="font-medium text-slate-500">ช่องสำหรับติดสำเนาบัตรคนพิการ</span>
                            <span className="text-[10px] text-slate-400 mt-1">(หากมี / พร้อมรับรองสำเนาถูกต้อง)</span>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500 text-center mt-1">
                      รับรองสำเนาถูกต้อง: ....................................................
                    </div>
                  </div>
                );
              })()}

              {/* Frame 4: Medical Cert or Other Documents */}
              {(() => {
                const doc = patient.documents?.find((d) => d.category === 'medical_cert' || d.category === 'other');
                return (
                  <div className="border border-slate-300 p-2 bg-slate-50/70 rounded-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-800 mb-1">
                      <span>4. ใบรับรองแพทย์ / ประวัติการรักษา</span>
                      {doc ? (
                        <span className="text-[10px] font-normal text-emerald-700 flex items-center gap-0.5">
                          <CheckCircle2 className="w-3 h-3" /> แนบแล้ว
                        </span>
                      ) : (
                        <span className="text-[10px] font-normal text-slate-400">ติดสำเนาจริง</span>
                      )}
                    </div>
                    <div className="h-36 bg-white border border-slate-200 flex flex-col items-center justify-center overflow-hidden p-1">
                      {doc?.dataUrl && doc.fileType.includes('image') ? (
                        <img
                          src={doc.dataUrl}
                          alt="ใบรับรองแพทย์"
                          className="max-h-full max-w-full object-contain"
                        />
                      ) : doc ? (
                        <div className="text-center p-2 text-slate-600 text-xs">
                          <FileCheck className="w-7 h-7 mx-auto text-blue-600 mb-1" />
                          <div className="font-semibold truncate max-w-[150px]">{doc.fileName}</div>
                          <div className="text-[10px] text-slate-400">ไฟล์แนบอิเล็กทรอนิกส์ในระบบ</div>
                        </div>
                      ) : (
                        <div className="text-center p-3 text-slate-400 text-xs flex flex-col items-center justify-center h-full">
                          <div className="border border-dashed border-slate-300 w-full h-full flex flex-col items-center justify-center p-2">
                            <span className="font-medium text-slate-500">ช่องสำหรับติดใบรับรองแพทย์</span>
                            <span className="text-[10px] text-slate-400 mt-1">(หรือเอกสารรับรองจากผู้นำชุมชน)</span>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500 text-center mt-1">
                      รับรองสำเนาถูกต้อง: ....................................................
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Official Verification & Archival Seal */}
          <div className="pt-3 border-t-2 border-slate-900 text-center text-xs">
            <div className="font-bold text-slate-900">
              แบบฟอร์ม สค.04 ได้รับการตรวจสอบและรับรองความถูกต้องโดย มูลนิธิร่วมกุศลสมุทรปราการ (北欖天德善堂)
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-600 mt-2 px-6">
              <div>
                ผู้ตรวจสอบเอกสาร: <span className="font-semibold text-slate-800">{patient.interviewerName || 'เจ้าหน้าที่ฝ่ายสังคมสงเคราะห์'}</span>
              </div>
              <div>
                ลงชื่อ: .................................................... ผู้ตรวจสอบ
              </div>
              <div>
                วันที่จัดพิมพ์: <span className="font-semibold text-slate-800">{formatThaiDate(new Date().toISOString().slice(0, 10))}</span>
              </div>
            </div>
            <div className="text-[10px] mt-2 text-slate-400">
              ระบบฐานข้อมูลดิจิทัล BD-Care • มูลนิธิร่วมกุศลสมุทรปราการ โทร. 02-395-0118, 02-387-1111
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
