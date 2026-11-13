import React from 'react';
import { 
  BarChart3, 
  Users, 
  DollarSign, 
  Package, 
  MapPin, 
  Activity, 
  TrendingUp, 
  ShieldAlert,
  Heart
} from 'lucide-react';
import { PatientRecord, SAMUT_PRAKAN_DISTRICTS, DiaperSize } from '../types';
import { formatCurrency } from '../utils/idCard';

interface DashboardProps {
  patients: PatientRecord[];
}

export const Dashboard: React.FC<DashboardProps> = ({ patients }) => {
  const activePatients = patients.filter((p) => p.status === 'active');
  const pendingPatients = patients.filter((p) => p.status === 'pending');
  const deceasedPatients = patients.filter((p) => p.status === 'deceased');
  const movedPatients = patients.filter((p) => p.status === 'moved');
  const rejectedPatients = patients.filter((p) => p.status === 'rejected');

  // Mobility counts for active
  const bedriddenCount = activePatients.filter((p) => p.mobilityLevel === 'bedridden').length;
  const semiBedriddenCount = activePatients.filter((p) => p.mobilityLevel === 'semi_bedridden').length;
  const canWalkCount = activePatients.filter((p) => p.mobilityLevel === 'can_walk').length;

  // Monthly financials
  const monthlyTotalCash = activePatients.reduce(
    (sum, p) => sum + (p.helpCashEnabled ? p.helpCashAmount : 0),
    0
  );
  const totalRicePacks = activePatients.reduce((sum, p) => sum + (p.helpRicePacks || 0), 0);
  const water15LPacks = activePatients.reduce(
    (sum, p) => (p.helpWaterSize === '1.5L' || !p.helpWaterSize ? sum + (p.helpWaterPacks || 0) : sum),
    0
  );
  const water600MLPacks = activePatients.reduce(
    (sum, p) => (p.helpWaterSize === '600ML' ? sum + (p.helpWaterPacks || 0) : sum),
    0
  );
  const totalWaterPacks = water15LPacks + water600MLPacks;

  // Diaper sizes count
  const diaperCounts: Record<DiaperSize, number> = {
    S: 0,
    M: 0,
    L: 0,
    XL: 0,
    XXL: 0,
    NONE: 0,
  };
  activePatients.forEach((p) => {
    if (p.helpDiaperSize && p.helpDiaperSize !== 'NONE') {
      diaperCounts[p.helpDiaperSize] += p.helpDiaperPacks || 0;
    }
  });

  const totalDiaperPacks = Object.values(diaperCounts).reduce((a, b) => a + b, 0);

  // District distribution
  const districtCounts: Record<string, number> = {};
  SAMUT_PRAKAN_DISTRICTS.forEach((d) => {
    districtCounts[d] = activePatients.filter((p) => p.currentAddress.district === d).length;
  });

  // Average vulnerability
  const avgVulnerability = activePatients.length > 0
    ? Math.round(activePatients.reduce((sum, p) => sum + p.vulnerabilityScore, 0) / activePatients.length)
    : 0;

  return (
    <div className="max-w-7xl mx-auto py-3 px-3 sm:px-4 space-y-3.5">
      {/* Title */}
      <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            แดชบอร์ดสรุปสถิติโครงการใจถึงใจ มูลนิธิร่วมกุศลสมุทรปราการ
          </h2>
          <p className="text-[11px] text-slate-500">
            ภาพรวมการดูแลผู้ป่วยติดเตียงและยากไร้ ยอดจัดสรรงบประมาณ และสิ่งของช่วยเหลือ
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {/* Total Active Patients */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">ในโครงการ (Active)</span>
            <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {activePatients.length} <span className="text-xs font-normal text-slate-500">คน</span>
          </div>
          <div className="text-[11px] text-amber-600 font-medium">
            + รอพิจารณาอีก {pendingPatients.length} ราย
          </div>
        </div>

        {/* Monthly Cash Grant */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">งบเงินสดช่วยเหลือ/เดือน</span>
            <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-emerald-600 mt-1">
            {formatCurrency(monthlyTotalCash)} <span className="text-xs font-normal text-slate-500">บ./ด.</span>
          </div>
          <div className="text-[11px] text-slate-400">
            (1,000 บ./คน/เดือน)
          </div>
        </div>

        {/* Diapers Monthly Requirement */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">ผ้าอ้อมผู้ใหญ่/เดือน</span>
            <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
              <Package className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-indigo-600 mt-1">
            {totalDiaperPacks} <span className="text-xs font-normal text-slate-500">ห่อ/ด.</span>
          </div>
          <div className="text-[11px] text-slate-400">
            ยอดเบิกรายเดือนรวม
          </div>
        </div>

        {/* Vulnerability Index */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">ดัชนีเปราะบางเฉลี่ย</span>
            <span className="p-1.5 bg-red-50 text-red-600 rounded-lg">
              <ShieldAlert className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-red-600 mt-1">
            {avgVulnerability} <span className="text-xs font-normal text-slate-500">/100</span>
          </div>
          <div className="text-[11px] text-red-700 font-semibold">
            เกณฑ์เปราะบางสูงมาก
          </div>
        </div>
      </div>

      {/* Grid: Mobility Breakdown & Diaper Stock Requirement */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Mobility Level */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <h3 className="font-bold text-slate-900 text-sm mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-600" />
            จำแนกตามระดับการเจ็บป่วย (Mobility ADL)
          </h3>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-xs font-bold mb-1">
                <span className="text-red-700 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  ติดเตียง 100% (ช่วยเหลือตนเองไม่ได้)
                </span>
                <span>{bedriddenCount} คน ({activePatients.length ? Math.round((bedriddenCount / activePatients.length) * 100) : 0}%)</span>
              </div>
              <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                <div
                  className="bg-red-500 h-full rounded-full transition-all"
                  style={{ width: `${activePatients.length ? (bedriddenCount / activePatients.length) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-bold mb-1">
                <span className="text-amber-700 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  กึ่งติดเตียง (ต้องมีคนช่วยพยุง)
                </span>
                <span>{semiBedriddenCount} คน ({activePatients.length ? Math.round((semiBedriddenCount / activePatients.length) * 100) : 0}%)</span>
              </div>
              <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                <div
                  className="bg-amber-500 h-full rounded-full transition-all"
                  style={{ width: `${activePatients.length ? (semiBedriddenCount / activePatients.length) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-bold mb-1">
                <span className="text-emerald-700 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  พอเดินได้ (ใช้อุปกรณ์ช่วยเดิน)
                </span>
                <span>{canWalkCount} คน ({activePatients.length ? Math.round((canWalkCount / activePatients.length) * 100) : 0}%)</span>
              </div>
              <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all"
                  style={{ width: `${activePatients.length ? (canWalkCount / activePatients.length) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Diaper Breakdown */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <h3 className="font-bold text-slate-900 text-sm mb-4 flex items-center gap-2">
            <Package className="w-4 h-4 text-indigo-600" />
            ยอดสต็อกผ้าอ้อมที่ต้องเตรียม (แยกตามขนาด)
          </h3>
          <div className="grid grid-cols-5 gap-2">
            {(['S', 'M', 'L', 'XL', 'XXL'] as DiaperSize[]).map((size) => (
              <div key={size} className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
                <div className="text-xs font-bold text-slate-600">ไซส์ {size}</div>
                <div className="text-2xl font-black text-indigo-700 mt-1">
                  {diaperCounts[size]}
                </div>
                <div className="text-[10px] text-slate-400">ห่อ/เดือน</div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-600 flex flex-wrap justify-between gap-2">
            <span>ข้าวสาร 5 กก. รวม: <b className="text-slate-900">{totalRicePacks} ถุง</b></span>
            <span>
              น้ำดื่มสิงห์รวม: <b className="text-slate-900">{totalWaterPacks} แพ็ค</b>{' '}
              <span className="text-[11px] text-slate-500">
                (1.5L: {water15LPacks} แพ็ค • 600ML: {water600MLPacks} แพ็ค)
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* District Distribution in Samut Prakan */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <h3 className="font-bold text-slate-900 text-sm mb-4 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-red-600" />
          การกระจายตัวผู้ป่วยใน 6 อำเภอ จังหวัดสมุทรปราการ
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {SAMUT_PRAKAN_DISTRICTS.map((d) => {
            const count = districtCounts[d] || 0;
            return (
              <div key={d} className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-center">
                <div className="text-xs font-semibold text-slate-700 truncate">อ.{d}</div>
                <div className="text-xl font-black text-blue-900 mt-1">
                  {count} <span className="text-xs font-normal text-slate-400">ราย</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Overall Lifecycle Stats */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <h3 className="font-bold text-slate-900 text-sm mb-3">
          สถิติประวัติและการบริหารโครงการใจถึงใจ (Lifecycle Status)
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
          <div className="p-3 bg-emerald-50 text-emerald-900 rounded-xl border border-emerald-200">
            <span className="font-bold block">อยู่ในโครงการ</span>
            <span className="text-xl font-black mt-1 block">{activePatients.length}</span>
          </div>
          <div className="p-3 bg-amber-50 text-amber-900 rounded-xl border border-amber-200">
            <span className="font-bold block">รอพิจารณา</span>
            <span className="text-xl font-black mt-1 block">{pendingPatients.length}</span>
          </div>
          <div className="p-3 bg-slate-100 text-slate-800 rounded-xl border border-slate-300">
            <span className="font-bold block">ถึงแก่กรรม (Deceased)</span>
            <span className="text-xl font-black mt-1 block">{deceasedPatients.length}</span>
          </div>
          <div className="p-3 bg-blue-50 text-blue-900 rounded-xl border border-blue-200">
            <span className="font-bold block">ย้ายที่อาศัย (Moved)</span>
            <span className="text-xl font-black mt-1 block">{movedPatients.length}</span>
          </div>
          <div className="p-3 bg-red-50 text-red-900 rounded-xl border border-red-200">
            <span className="font-bold block">ไม่ผ่านโครงการ</span>
            <span className="text-xl font-black mt-1 block">{rejectedPatients.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
