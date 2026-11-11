import React, { useState } from 'react';
import { 
  Package, 
  Printer, 
  MapPin, 
  CheckCircle2, 
  Calendar, 
  Filter, 
  FileCheck, 
  Send,
  HeartHandshake
} from 'lucide-react';
import { PatientRecord, SAMUT_PRAKAN_DISTRICTS, DiaperSize, MonthlyDelivery, AdminUser } from '../types';
import { formatCurrency, formatPhone, formatThaiMonthYear } from '../utils/idCard';
import { PrintDeliveryPlanModal } from './PrintDeliveryPlanModal';

interface DeliveryPlanProps {
  patients: PatientRecord[];
  onRecordDelivery: (patientId: string, delivery: MonthlyDelivery) => void;
  currentAdmin: AdminUser;
}

export const DeliveryPlan: React.FC<DeliveryPlanProps> = ({
  patients,
  onRecordDelivery,
  currentAdmin,
}) => {
  const [selectedDistrict, setSelectedDistrict] = useState<string>('all');
  const [currentMonth, setCurrentMonth] = useState<string>(() => 
    formatThaiMonthYear(new Date().toISOString().slice(0, 10)) || 'พฤศจิกายน พ.ศ. 2569'
  );
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Only active patients receive monthly supplies
  const activePatients = patients.filter((p) => p.status === 'active');
  const displayedPatients = activePatients.filter(
    (p) => selectedDistrict === 'all' || p.currentAddress.district === selectedDistrict
  );

  // Totals calculations
  const totalCash = displayedPatients.reduce(
    (sum, p) => sum + (p.helpCashEnabled ? p.helpCashAmount : 0),
    0
  );
  const totalRice = displayedPatients.reduce((sum, p) => sum + p.helpRicePacks, 0);
  const totalWater = displayedPatients.reduce((sum, p) => sum + p.helpWaterPacks, 0);

  // Diaper sizes count
  const diaperCounts: Record<DiaperSize, number> = {
    S: 0,
    M: 0,
    L: 0,
    XL: 0,
    XXL: 0,
    NONE: 0,
  };
  displayedPatients.forEach((p) => {
    if (p.helpDiaperSize && p.helpDiaperSize !== 'NONE') {
      diaperCounts[p.helpDiaperSize] += p.helpDiaperPacks || 0;
    }
  });

  const handlePrintSignSheet = () => {
    setShowPrintModal(true);
  };

  const handleQuickDeliver = (patient: PatientRecord) => {
    const receiver = prompt('ชื่อผู้รับมอบสิ่งของ:', patient.caregiverName || patient.fullName);
    if (!receiver) return;

    const delivery: MonthlyDelivery = {
      id: 'del_' + Date.now(),
      deliveryDate: new Date().toISOString().slice(0, 10),
      monthYearLabel: currentMonth,
      cashAmount: patient.helpCashEnabled ? patient.helpCashAmount : 0,
      cashGiven: patient.helpCashEnabled,
      diaperSize: patient.helpDiaperSize,
      diaperPacks: patient.helpDiaperPacks,
      ricePacks: patient.helpRicePacks,
      waterPacks: patient.helpWaterSize === 'NONE' ? 0 : patient.helpWaterPacks,
      waterSize: patient.helpWaterSize || '1.5L',
      otherItems: patient.helpOtherSupplies || '-',
      receivedBy: receiver,
      recipientRelation: patient.caregiverRelation || 'ผู้ดูแล',
      officerName: currentAdmin.name,
      notes: 'ส่งมอบเรียบร้อยตามมาตรฐานโครงการ',
    };

    onRecordDelivery(patient.id, delivery);
    alert(`บันทึกการส่งมอบสิ่งของให้ ${patient.fullName} เรียบร้อยแล้ว`);
  };

  return (
    <div className="max-w-7xl mx-auto py-6 px-4">
      {/* Title & Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-blue-100 text-blue-800 rounded-xl">
              <Package className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold text-slate-900">
              📦 แผนการส่งมอบสิ่งของ & เยี่ยมบ้านประจำเดือน
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            โครงการใจถึงใจช่วยผู้ป่วยติดเตียงและยากไร้ มูลนิธิร่วมกุศลสมุทรปราการ
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* District Selector */}
          <select
            value={selectedDistrict}
            onChange={(e) => setSelectedDistrict(e.target.value)}
            className="text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-800"
          >
            <option value="all">📍 จัดสายส่งมอบ: ทุกอำเภอ</option>
            {SAMUT_PRAKAN_DISTRICTS.map((d) => (
              <option key={d} value={d}>
                สายส่งมอบ: อำเภอ{d}
              </option>
            ))}
          </select>

          {/* Month Input */}
          <input
            type="text"
            value={currentMonth}
            onChange={(e) => setCurrentMonth(e.target.value)}
            className="text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium w-40 text-center"
            placeholder="รอบเดือน เช่น พฤศจิกายน พ.ศ. 2569"
          />

          {/* Print Sign-off Sheet Button (A4 Modal) */}
          <button
            type="button"
            onClick={handlePrintSignSheet}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition cursor-pointer"
            title="พิมพ์แผนการส่งมอบสิ่งของ A4 พร้อมลายเซ็นผู้รับมอบและเจ้าหน้าที่ท้ายกระดาษ"
          >
            <Printer className="w-4 h-4" />
            <span>พิมพ์แผนการส่งมอบ A4 (พร้อมช่องลายเซ็น)</span>
          </button>
        </div>
      </div>

      {/* Aggregate Stock Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">รวมผู้ป่วยที่จะส่งมอบ</div>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {displayedPatients.length} <span className="text-sm font-normal text-slate-500">ราย</span>
          </div>
          <div className="text-[11px] text-blue-600 font-medium mt-1">
            สาย: {selectedDistrict === 'all' ? 'ทุกอำเภอ' : selectedDistrict}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">ยอดเงินสดที่ต้องเตรียม</div>
          <div className="text-2xl font-black text-emerald-600 mt-1">
            {formatCurrency(totalCash)} <span className="text-sm font-normal text-slate-500">บ.</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">1,000 บ./ราย/เดือน</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">ข้าวสาร 5 กก.</div>
          <div className="text-2xl font-black text-amber-600 mt-1">
            {totalRice} <span className="text-sm font-normal text-slate-500">ถุง</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">({totalRice * 5} กิโลกรัม)</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">น้ำดื่ม 1.5L (แพ็ค 6 ขวด)</div>
          <div className="text-2xl font-black text-blue-600 mt-1">
            {totalWater} <span className="text-sm font-normal text-slate-500">แพ็ค</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">({totalWater * 6} ขวด)</div>
        </div>
      </div>

      {/* Diaper Breakdown Pill Cards */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs mb-6">
        <div className="text-xs font-bold text-slate-800 mb-2.5 flex items-center gap-2">
          <span>🩲 ยอดรวมผ้าอ้อมผู้ใหญ่ที่ต้องเบิกจากคลัง (แยกตามไซส์):</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {(['S', 'M', 'L', 'XL', 'XXL'] as DiaperSize[]).map((size) => (
            <div key={size} className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-center">
              <span className="text-xs font-bold text-slate-600 block">ไซส์ {size}</span>
              <span className="text-xl font-black text-blue-900 block mt-0.5">
                {diaperCounts[size]}
              </span>
              <span className="text-[10px] text-slate-500">ห่อ</span>
            </div>
          ))}
        </div>
      </div>

      {/* Printable Delivery Dispatch Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-900">
            ตารางลงชื่อรับมอบสิ่งของ (รอบเดือน: {currentMonth})
          </h3>
          <span className="text-xs text-slate-500">
            เจ้าหน้าที่ลงพื้นที่: <span className="font-semibold text-slate-800">{currentAdmin.name}</span>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                <th className="p-3 w-12 text-center">ลำดับ</th>
                <th className="p-3">รหัส/ชื่อผู้ป่วย</th>
                <th className="p-3">ที่อยู่ & พิกัด</th>
                <th className="p-3">รายการสิ่งของที่ต้องมอบ</th>
                <th className="p-3">ผู้ดูแล/เบอร์โทร</th>
                <th className="p-3 w-40 text-center">ลายมือชื่อผู้รับมอบ</th>
                <th className="p-3 w-28 text-center no-print">การดำเนินการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedPatients.map((patient, idx) => (
                <tr key={patient.id} className="hover:bg-slate-50/80 transition">
                  <td className="p-3 text-center font-bold text-slate-500">{idx + 1}</td>
                  <td className="p-3">
                    <div className="font-bold text-slate-900">{patient.fullName}</div>
                    <div className="text-[11px] font-mono text-blue-700 font-semibold">{patient.code}</div>
                    <div className="text-[10px] text-slate-500">
                      {patient.mobilityLevel === 'bedridden' ? 'ติดเตียง 100%' :
                       patient.mobilityLevel === 'semi_bedridden' ? 'กึ่งติดเตียง' : 'พอเดินได้'}
                    </div>
                  </td>
                  <td className="p-3 max-w-xs">
                    <div className="text-slate-800 line-clamp-2">
                      เลขที่ {patient.currentAddress.houseNo} ต.{patient.currentAddress.subdistrict} อ.{patient.currentAddress.district}
                    </div>
                    {patient.landmarkNote && (
                      <div className="text-[10px] text-slate-500 italic mt-0.5 line-clamp-1">
                        จุดสังเกต: {patient.landmarkNote}
                      </div>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="space-y-0.5 text-[11px]">
                      {patient.helpCashEnabled && (
                        <div className="font-semibold text-emerald-800">
                          • เงินสด {formatCurrency(patient.helpCashAmount)} บ.
                        </div>
                      )}
                      {patient.helpDiaperSize !== 'NONE' && (
                        <div>
                          • ผ้าอ้อมไซส์ {patient.helpDiaperSize} ({patient.helpDiaperPacks} ห่อ)
                        </div>
                      )}
                      <div>• ข้าวสาร 5 กก. ({patient.helpRicePacks} ถุง)</div>
                      {patient.helpWaterSize === 'NONE' || patient.helpWaterPacks === 0 ? null : (
                        <div>
                          • น้ำสิงห์ {patient.helpWaterSize === '600ML' ? '600 ML. (12 ขวด)' : '1.5L (6 ขวด)'} ({patient.helpWaterPacks} แพ็ค)
                        </div>
                      )}
                      {patient.helpOtherSupplies && (
                        <div className="text-slate-500 text-[10px]">
                          • {patient.helpOtherSupplies}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="font-medium text-slate-800">{patient.caregiverName || '-'}</div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      {formatPhone(patient.caregiverPhone) || formatPhone(patient.phone) || '-'}
                    </div>
                  </td>
                  <td className="p-3 text-center bg-slate-50/50 align-middle">
                    <div className="py-2">
                      <div className="border-b border-dashed border-slate-500 w-32 mx-auto"></div>
                    </div>
                  </td>
                  <td className="p-3 text-center no-print">
                    <button
                      type="button"
                      onClick={() => handleQuickDeliver(patient)}
                      className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 mx-auto"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      ส่งมอบแล้ว
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Official Foundation Signatures Footer */}
        <div className="p-5 bg-slate-50 border-t border-slate-200">
          <div className="text-center font-bold text-xs text-slate-700 mb-3">
            ลายมือชื่อผู้รับผิดชอบและผู้อนุมัติการส่งมอบสิ่งของสงเคราะห์ (ท้ายเอกสาร)
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
            {/* Left: Officer Signature */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs text-center space-y-1">
              <div className="text-xs font-bold text-slate-900">ผู้ส่งมอบ / ผู้จัดทำแผนการส่งมอบ</div>
              <div className="pt-7 border-b border-dotted border-slate-700 w-52 mx-auto"></div>
              <div className="text-xs font-black text-slate-900 mt-1">
                ( นายกริชพิพัฒน์  สลับทอง )
              </div>
              <div className="text-[11px] font-semibold text-slate-700">
                เจ้าหน้าที่ฝ่ายสังคมสงเคราะห์
              </div>
              <div className="text-[10px] text-slate-500">
                วันที่ .......... เดือน .................... พ.ศ. ................
              </div>
            </div>

            {/* Right: Foundation Manager Approval */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs text-center space-y-1">
              <div className="text-xs font-bold text-slate-900">ผู้ตรวจสอบและอนุมัติการส่งมอบ</div>
              <div className="pt-7 border-b border-dotted border-slate-700 w-52 mx-auto"></div>
              <div className="text-xs font-black text-slate-900 mt-1">
                ( นางสาวศาตพร  ภูมิโคกรักษ์ )
              </div>
              <div className="text-[11px] font-semibold text-slate-700">
                ผู้จัดการมูลนิธิร่วมกุศลสมุทรปราการ
              </div>
              <div className="text-[10px] text-slate-500">
                วันที่ .......... เดือน .................... พ.ศ. ................
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* A4 Print Modal */}
      {showPrintModal && (
        <PrintDeliveryPlanModal
          patients={displayedPatients}
          selectedDistrict={selectedDistrict}
          currentMonth={currentMonth}
          currentAdmin={currentAdmin}
          onClose={() => setShowPrintModal(false)}
        />
      )}
    </div>
  );
};
