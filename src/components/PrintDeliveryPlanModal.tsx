import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  Printer, 
  X, 
  ArrowLeft, 
  ZoomIn, 
  ZoomOut, 
  Minimize2, 
  FileText, 
  Layers,
  MapPin,
  Calendar,
  CheckCircle2,
  Package
} from 'lucide-react';
import { PatientRecord, AdminUser, DiaperSize } from '../types';
import { formatCurrency, formatPhone, formatThaiDate } from '../utils/idCard';

interface PrintDeliveryPlanModalProps {
  patients: PatientRecord[];
  selectedDistrict: string;
  currentMonth: string;
  currentAdmin: AdminUser;
  onClose: () => void;
}

export const PrintDeliveryPlanModal: React.FC<PrintDeliveryPlanModalProps> = ({
  patients,
  selectedDistrict,
  currentMonth,
  currentAdmin,
  onClose,
}) => {
  const [scale, setScale] = useState<number>(0.75);
  const [activeTab, setActiveTab] = useState<'all' | number>('all');

  // Mark body for print stylesheet
  useEffect(() => {
    document.body.classList.add('is-printing-sk04');
    return () => {
      document.body.classList.remove('is-printing-sk04');
    };
  }, []);

  // Auto-fit scale on viewport resize
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

  // Calculate totals
  const totalCash = useMemo(() => {
    return patients.reduce((sum, p) => sum + (p.helpCashEnabled ? p.helpCashAmount : 0), 0);
  }, [patients]);

  const totalRice = useMemo(() => {
    return patients.reduce((sum, p) => sum + (p.helpRicePacks || 0), 0);
  }, [patients]);

  const waterCounts = useMemo(() => {
    let size15L = 0;
    let size600ML = 0;
    patients.forEach((p) => {
      if (p.helpWaterSize === '600ML') {
        size600ML += p.helpWaterPacks || 0;
      } else if (p.helpWaterSize !== 'NONE') {
        size15L += p.helpWaterPacks || 0;
      }
    });
    return { size15L, size600ML, total: size15L + size600ML };
  }, [patients]);

  const diaperCounts = useMemo(() => {
    const counts: Record<DiaperSize, number> = {
      S: 0,
      M: 0,
      L: 0,
      XL: 0,
      XXL: 0,
      NONE: 0,
    };
    patients.forEach((p) => {
      if (p.helpDiaperSize && p.helpDiaperSize !== 'NONE') {
        counts[p.helpDiaperSize] += p.helpDiaperPacks || 0;
      }
    });
    return counts;
  }, [patients]);

  const totalDiapers = useMemo(() => {
    return Object.entries(diaperCounts).reduce((sum, [size, qty]) => {
      return size === 'NONE' ? sum : sum + qty;
    }, 0);
  }, [diaperCounts]);

  // Chunk patients into pages of 5 per A4 sheet
  const ITEMS_PER_PAGE = 5;
  const pages = useMemo(() => {
    if (patients.length === 0) return [[]];
    const chunked: PatientRecord[][] = [];
    for (let i = 0; i < patients.length; i += ITEMS_PER_PAGE) {
      chunked.push(patients.slice(i, i + ITEMS_PER_PAGE));
    }
    return chunked;
  }, [patients]);

  const totalPages = pages.length;

  const handlePrint = () => {
    window.print();
  };

  const districtLabel = selectedDistrict === 'all' 
    ? 'ทุกอำเภอ ในจังหวัดสมุทรปราการ' 
    : `อำเภอ${selectedDistrict} จังหวัดสมุทรปราการ`;

  return createPortal(
    <div className="a4-print-modal sk04-print-modal fixed inset-0 z-50 overflow-y-auto bg-slate-900/85 backdrop-blur-xs flex flex-col items-center p-2 sm:p-4">
      {/* Top Floating Control Bar - Hidden in Print */}
      <div className="no-print w-full max-w-5xl bg-white rounded-2xl shadow-2xl p-3 sm:p-4 mb-3 sticky top-2 z-50 border border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
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
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span>ตัวอย่างก่อนพิมพ์: แผนการส่งมอบสิ่งของ & บัญชีลงชื่อรับมอบ</span>
                  <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-md">
                    ขนาด A4 ({totalPages} หน้า)
                  </span>
                </h2>
              </div>
              <p className="text-xs text-slate-500">
                รอบเดือน: <span className="font-semibold text-slate-700">{currentMonth}</span> • สายส่งมอบ: <span className="font-semibold text-slate-700">{districtLabel}</span> • ผู้ป่วยทั้งหมด: <span className="font-bold text-blue-700">{patients.length}</span> ราย
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {/* Zoom Controls */}
            <div className="hidden sm:flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
              <button
                onClick={() => setScale((s) => Math.max(0.4, parseFloat((s - 0.05).toFixed(2))))}
                className="p-1 hover:bg-white rounded text-slate-600 hover:text-slate-900 transition"
                title="ย่อขนาด"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-[11px] font-mono px-1 font-semibold text-slate-700 min-w-10 text-center">
                {Math.round(scale * 100)}%
              </span>
              <button
                onClick={() => setScale((s) => Math.min(1.2, parseFloat((s + 0.05).toFixed(2))))}
                className="p-1 hover:bg-white rounded text-slate-600 hover:text-slate-900 transition"
                title="ขยายขนาด"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={() => setScale(0.75)}
                className="p-1 hover:bg-white rounded text-slate-600 hover:text-slate-900 transition"
                title="ขนาดพอดี"
              >
                <Minimize2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Print Button */}
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-bold transition shadow-md cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>สั่งพิมพ์เอกสาร A4 (Print / บันทึก PDF)</span>
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Page Switcher Tabs */}
        {totalPages > 1 && (
          <div className="flex items-center gap-1.5 pt-2.5 overflow-x-auto text-xs">
            <span className="text-slate-500 font-medium shrink-0 mr-1">เลือกดูหน้า:</span>
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1 rounded-lg font-semibold transition cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              ดูทั้งหมด ({totalPages} หน้า)
            </button>
            {pages.map((_, pIdx) => (
              <button
                key={pIdx}
                onClick={() => setActiveTab(pIdx)}
                className={`px-3 py-1 rounded-lg font-semibold transition cursor-pointer ${
                  activeTab === pIdx
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                หน้าที่ {pIdx + 1}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Printable A4 Container */}
      <div
        className="a4-container transition-transform duration-150 origin-top flex flex-col items-center gap-6 pb-10"
        style={{
          transform: `scale(${scale})`,
          transformOrigin: 'top center',
          marginBottom: scale < 1 ? `-${Math.round((1 - scale) * (totalPages * 1140))}px` : undefined,
        }}
      >
        {pages.map((pagePatients, pageIdx) => {
          // If viewing a specific tab and it's not this page, hide on screen (visible in print via CSS)
          const isHiddenOnScreen = activeTab !== 'all' && activeTab !== pageIdx;
          const isLastPage = pageIdx === totalPages - 1;

          return (
            <div
              key={pageIdx}
              className={`a4-sheet bg-white text-slate-900 shadow-2xl relative flex flex-col justify-between p-5 sm:py-[11mm] sm:px-[13mm] border border-slate-300 font-['Sarabun',sans-serif] ${
                isHiddenOnScreen ? 'hidden print:flex' : 'flex'
              } ${isLastPage ? 'last-sheet' : ''}`}
            >
              {/* Top Section: Header & Summary */}
              <div className="space-y-3">
                {/* Official Foundation Header */}
                <div className="flex items-start justify-between border-b-2 border-slate-900 pb-3">
                  <div className="flex items-center gap-3">
                    <img
                      src="/assets/aistudio/382492-Photoroom_4c9e02f3.png"
                      alt="ตรามูลนิธิร่วมกุศลสมุทรปราการ"
                      className="w-16 h-16 object-contain shrink-0"
                    />
                    <div>
                      <div className="text-base font-black text-slate-900 tracking-tight leading-tight">
                        มูลนิธิร่วมกุศลสมุทรปราการ (北欖天德善堂)
                      </div>
                      <div className="text-xs font-bold text-blue-900 mt-0.5">
                        โครงการใจถึงใจช่วยผู้ป่วยติดเตียงและยากไร้
                      </div>
                      <div className="text-xs font-semibold text-slate-800 mt-0.5">
                        แผนการส่งมอบสิ่งของสงเคราะห์ & บัญชีลงลายมือชื่อรับมอบสิ่งของประจำเดือน
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="inline-block border border-slate-900 rounded px-2.5 py-1 text-[11px] font-bold text-slate-900 bg-slate-50">
                      เอกสารโครงการใจถึงใจ
                    </div>
                    <div className="text-[11px] font-semibold text-slate-700 mt-1">
                      รอบเดือน: <span className="text-blue-900 font-bold">{currentMonth}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      หน้า {pageIdx + 1} จาก {totalPages}
                    </div>
                  </div>
                </div>

                {/* Sub-header: District & Officer */}
                <div className="flex flex-wrap items-center justify-between text-xs bg-slate-50 p-2 rounded-lg border border-slate-200">
                  <div className="flex items-center gap-1.5 font-medium text-slate-800">
                    <MapPin className="w-3.5 h-3.5 text-red-600 shrink-0" />
                    <span>สายส่งมอบ: <strong className="text-slate-900">{districtLabel}</strong></span>
                  </div>
                  <div className="text-[11.5px] text-slate-700">
                    เจ้าหน้าที่ผู้จัดทำ/ลงพื้นที่: <strong className="text-slate-900">นายกริชพิพัฒน์  สลับทอง</strong> (เจ้าหน้าที่ฝ่ายสังคมสงเคราะห์)
                  </div>
                </div>

                {/* Page 1 Summary Card */}
                {pageIdx === 0 && (
                  <div className="grid grid-cols-5 gap-2 text-center text-[10.5px] border border-blue-200 bg-blue-50/60 p-2 rounded-lg">
                    <div className="border-r border-blue-200/80 pr-1">
                      <div className="text-slate-500 text-[10px]">ผู้ป่วยรับมอบ</div>
                      <div className="font-black text-sm text-slate-900">{patients.length} ราย</div>
                    </div>
                    <div className="border-r border-blue-200/80 pr-1">
                      <div className="text-slate-500 text-[10px]">เงินสดรวม</div>
                      <div className="font-black text-sm text-emerald-700">{formatCurrency(totalCash)} บ.</div>
                    </div>
                    <div className="border-r border-blue-200/80 pr-1">
                      <div className="text-slate-500 text-[10px]">ข้าวสาร (5 กก.)</div>
                      <div className="font-black text-sm text-amber-800">{totalRice} ถุง</div>
                    </div>
                    <div className="border-r border-blue-200/80 pr-1">
                      <div className="text-slate-500 text-[10px]">น้ำดื่มสิงห์รวม</div>
                      <div className="font-black text-sm text-cyan-800">{waterCounts.total} แพ็ค</div>
                      <div className="text-[8.5px] text-slate-600 leading-none">
                        (1.5L:{waterCounts.size15L} • 600ML:{waterCounts.size600ML})
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-[10px]">ผ้าอ้อมผู้ใหญ่</div>
                      <div className="font-black text-sm text-indigo-800">
                        {totalDiapers} ห่อ
                      </div>
                      <div className="text-[8.5px] text-slate-600 leading-none">
                        (M:{diaperCounts.M} L:{diaperCounts.L} XL:{diaperCounts.XL} XXL:{diaperCounts.XXL})
                      </div>
                    </div>
                  </div>
                )}

                {/* Patient Delivery Dispatch Table */}
                <div className="border border-slate-900 rounded overflow-hidden">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className="bg-slate-800 text-white font-bold text-center border-b border-slate-900">
                        <th className="p-2 w-10 border-r border-slate-700">ลำดับ</th>
                        <th className="p-2 w-48 text-left border-r border-slate-700">รหัส / ชื่อผู้ป่วย</th>
                        <th className="p-2 border-r border-slate-700 text-left">ที่อยู่ส่งมอบ & เบอร์ติดต่อ</th>
                        <th className="p-2 w-52 border-r border-slate-700 text-left">รายการสิ่งของส่งมอบ</th>
                        <th className="p-2 w-44 text-center">ลายมือชื่อผู้รับมอบ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-300">
                      {pagePatients.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-6 text-center text-slate-400 italic">
                            ไม่มีรายการผู้ป่วยที่จะส่งมอบในสายนี้
                          </td>
                        </tr>
                      ) : (
                        pagePatients.map((patient, pRowIdx) => {
                          const globalIdx = pageIdx * ITEMS_PER_PAGE + pRowIdx + 1;
                          const mobilityText = 
                            patient.mobilityLevel === 'bedridden' ? 'ติดเตียง 100%' :
                            patient.mobilityLevel === 'semi_bedridden' ? 'กึ่งติดเตียง' : 'พอเดินได้';

                          return (
                            <tr key={patient.id} className="align-top hover:bg-slate-50">
                              {/* No. */}
                              <td className="p-2 text-center font-bold text-slate-800 border-r border-slate-300">
                                {globalIdx}
                              </td>

                              {/* Patient ID & Name */}
                              <td className="p-2 border-r border-slate-300">
                                <div className="font-bold text-slate-900 text-[11.5px] leading-tight">
                                  {patient.fullName}
                                </div>
                                <div className="text-[10px] font-mono font-bold text-blue-800 mt-0.5">
                                  รหัส: {patient.code}
                                </div>
                                <div className="text-[9.5px] text-slate-600 mt-0.5">
                                  สภาพ: <span className="font-semibold text-slate-800">{mobilityText}</span>
                                </div>
                                <div className="text-[9.5px] text-slate-500 font-mono">
                                  เลขบัตร: {patient.nationalId ? patient.nationalId.slice(0, 10) + '...' : '-'}
                                </div>
                              </td>

                              {/* Address, Landmark & Contact */}
                              <td className="p-2 border-r border-slate-300">
                                <div className="font-medium text-slate-800 text-[10.5px] leading-tight">
                                  เลขที่ {patient.currentAddress.houseNo} 
                                  {patient.currentAddress.buildingVillage && ` ${patient.currentAddress.buildingVillage}`}
                                  {patient.currentAddress.road && ` ถ.${patient.currentAddress.road}`}
                                </div>
                                <div className="text-[10px] text-slate-600">
                                  ต.{patient.currentAddress.subdistrict} อ.{patient.currentAddress.district}
                                </div>
                                {patient.landmarkNote && (
                                  <div className="text-[9.5px] text-amber-900 italic mt-0.5">
                                    จุดสังเกต: {patient.landmarkNote}
                                  </div>
                                )}
                                <div className="text-[9.5px] text-slate-700 mt-1">
                                  ผู้ดูแล: <span className="font-semibold">{patient.caregiverName || patient.fullName}</span> 
                                  {patient.caregiverPhone && ` (${formatPhone(patient.caregiverPhone)})`}
                                </div>
                              </td>

                              {/* Items to Deliver */}
                              <td className="p-2 border-r border-slate-300">
                                <div className="space-y-0.5 text-[10.5px]">
                                  {patient.helpCashEnabled && (
                                    <div className="font-bold text-emerald-900">
                                      [✓] เงินสด: <strong>{formatCurrency(patient.helpCashAmount)}</strong> บาท
                                    </div>
                                  )}
                                  {patient.helpDiaperSize && patient.helpDiaperSize !== 'NONE' && (
                                    <div className="font-semibold text-blue-950">
                                      [✓] ผ้าอ้อม: ไซส์ <strong>{patient.helpDiaperSize}</strong> ({patient.helpDiaperPacks} ห่อ)
                                    </div>
                                  )}
                                  <div>
                                    [✓] ข้าวสาร 5 กก. ({patient.helpRicePacks} ถุง)
                                  </div>
                                  {patient.helpWaterSize !== 'NONE' && (patient.helpWaterPacks || 0) > 0 && (
                                    <div>
                                      [✓] น้ำดื่มสิงห์ {patient.helpWaterSize === '600ML' ? 'ขนาด 600 ML. (12 ขวด)' : 'ขนาด 1.5L (6 ขวด)'} ({patient.helpWaterPacks} แพ็ค)
                                    </div>
                                  )}
                                  {patient.helpOtherSupplies && (
                                    <div className="text-[9.5px] text-slate-600">
                                      [✓] อื่นๆ: {patient.helpOtherSupplies}
                                    </div>
                                  )}
                                </div>
                              </td>

                              {/* Recipient Signature Box */}
                              <td className="p-2 text-center bg-slate-50/50 align-middle">
                                <div className="py-3">
                                  <div className="border-b border-dotted border-slate-700 w-36 mx-auto"></div>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bottom Section: Official Foundation Signatures (Mandatory Requirement) */}
              <div className="mt-4 pt-3 border-t-2 border-slate-900 space-y-3">
                {/* Sign-off Boxes */}
                <div className="grid grid-cols-2 gap-8 text-center">
                  {/* Left: Officer Signature (นายกริชพิพัฒน์  สลับทอง) */}
                  <div className="space-y-1 p-2 bg-slate-50/80 rounded border border-slate-200">
                    <div className="text-[11.5px] font-bold text-slate-900">
                      ผู้ส่งมอบ / ผู้จัดทำแผนการส่งมอบ
                    </div>
                    <div className="pt-8 border-b border-dotted border-slate-700 w-56 mx-auto"></div>
                    <div className="text-xs font-black text-slate-900 mt-1">
                      ( นายกริชพิพัฒน์  สลับทอง )
                    </div>
                    <div className="text-[11px] font-semibold text-slate-700">
                      เจ้าหน้าที่ฝ่ายสังคมสงเคราะห์
                    </div>
                    <div className="text-[10px] text-slate-500">
                      วันที่ .......... เดือน .............................. พ.ศ. ................
                    </div>
                  </div>

                  {/* Right: Foundation Manager Approval (นางสาวศาตพร ภูมิโคกรักษ์) */}
                  <div className="space-y-1 p-2 bg-slate-50/80 rounded border border-slate-200">
                    <div className="text-[11.5px] font-bold text-slate-900">
                      ผู้ตรวจสอบและอนุมัติการส่งมอบ
                    </div>
                    <div className="pt-8 border-b border-dotted border-slate-700 w-56 mx-auto"></div>
                    <div className="text-xs font-black text-slate-900 mt-1">
                      ( นางสาวศาตพร  ภูมิโคกรักษ์ )
                    </div>
                    <div className="text-[11px] font-semibold text-slate-700">
                      ผู้จัดการมูลนิธิร่วมกุศลสมุทรปราการ
                    </div>
                    <div className="text-[10px] text-slate-500">
                      วันที่ .......... เดือน .............................. พ.ศ. ................
                    </div>
                  </div>
                </div>

                {/* Footer Watermark */}
                <div className="flex items-center justify-between text-[9.5px] text-slate-500 border-t border-slate-200 pt-1.5">
                  <div>
                    ระบบดิจิทัล BD-Care • มูลนิธิร่วมกุศลสมุทรปราการ (北欖天德善堂) • โทร. 02-395-0118, 02-387-1111
                  </div>
                  <div>
                    พิมพ์เมื่อ: {formatThaiDate(new Date().toISOString().slice(0, 10))} เวลา {new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>,
    document.body
  );
};
