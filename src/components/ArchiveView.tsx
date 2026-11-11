import React, { useState } from 'react';
import { 
  Archive, 
  RotateCcw, 
  Printer, 
  Search, 
  AlertCircle, 
  Calendar, 
  UserCheck, 
  MapPin, 
  Phone, 
  FileText 
} from 'lucide-react';
import { PatientRecord, PatientStatus, AdminUser } from '../types';
import { formatNationalId, formatThaiDate } from '../utils/idCard';
import { PrintFormSK04 } from './PrintFormSK04';

interface ArchiveViewProps {
  patients: PatientRecord[];
  onRestorePatient: (patientId: string) => void;
  currentAdmin: AdminUser;
}

export const ArchiveView: React.FC<ArchiveViewProps> = ({
  patients,
  onRestorePatient,
  currentAdmin,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'deceased' | 'moved' | 'rejected'>('all');
  const [printingPatient, setPrintingPatient] = useState<PatientRecord | null>(null);

  // Filter archived patients
  const archivedPatients = patients.filter((p) =>
    ['deceased', 'moved', 'rejected'].includes(p.status)
  );

  const displayedPatients = archivedPatients.filter((p) => {
    const matchType = filterType === 'all' || p.status === filterType;
    const term = searchTerm.toLowerCase().replace(/[- ]/g, '');
    const cleanId = p.nationalId.replace(/[- ]/g, '');
    const cleanPhone = (p.phone || '').replace(/[- ]/g, '');

    const matchSearch =
      !term ||
      p.fullName.toLowerCase().includes(term) ||
      p.code.toLowerCase().includes(term) ||
      cleanId.includes(term) ||
      cleanPhone.includes(term) ||
      (p.statusReason && p.statusReason.toLowerCase().includes(term));

    return matchType && matchSearch;
  });

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-slate-100 text-slate-800 rounded-xl">
              <Archive className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold text-slate-900">
              🗄️ คลังประวัติผู้ป่วย (Patient History Archive)
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            ข้อมูลผู้ป่วยที่ย้ายที่อยู่ ถึงแก่กรรม หรือไม่ผ่านโครงการ ถูกจัดเก็บถาวรเพื่อเป็นหลักฐานทางสังคมสงเคราะห์
          </p>
        </div>

        {/* Status Category Pills */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              filterType === 'all' ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            ทั้งหมด ({archivedPatients.length})
          </button>
          <button
            onClick={() => setFilterType('deceased')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              filterType === 'deceased' ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            ถึงแก่กรรม ({archivedPatients.filter((p) => p.status === 'deceased').length})
          </button>
          <button
            onClick={() => setFilterType('moved')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              filterType === 'moved' ? 'bg-blue-700 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            ย้ายที่อยู่ ({archivedPatients.filter((p) => p.status === 'moved').length})
          </button>
          <button
            onClick={() => setFilterType('rejected')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              filterType === 'rejected' ? 'bg-red-700 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            ไม่ผ่านโครงการ ({archivedPatients.filter((p) => p.status === 'rejected').length})
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="ค้นหาในคลังประวัติ: ชื่อ-สกุล / เลข ปชช. / รหัสผู้ป่วย / สาเหตุ..."
          className="w-full text-xs pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl shadow-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
        />
      </div>

      {/* Archived Patients List */}
      {displayedPatients.length > 0 ? (
        <div className="space-y-4">
          {displayedPatients.map((patient) => (
            <div
              key={patient.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-md transition flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-1.5 min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono font-bold text-xs bg-slate-100 text-slate-800 px-2 py-0.5 rounded">
                    {patient.code}
                  </span>
                  <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                    patient.status === 'deceased' ? 'bg-slate-200 text-slate-800' :
                    patient.status === 'moved' ? 'bg-blue-100 text-blue-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {patient.status === 'deceased' ? 'ผู้ป่วยถึงแก่กรรม (Deceased)' :
                     patient.status === 'moved' ? 'ย้ายที่อาศัย (Moved)' : 'ไม่ผ่านโครงการ (Rejected)'}
                  </span>
                  <span className="text-xs text-slate-400">
                    รับเข้าโครงการเมื่อ: {formatThaiDate(patient.admissionDate)}
                  </span>
                </div>

                <h3 className="font-bold text-base text-slate-900">
                  {patient.title} {patient.fullName} (อายุ {patient.age} ปี)
                </h3>

                <p className="text-xs text-slate-500 font-mono">
                  เลข ปชช.: {formatNationalId(patient.nationalId)} • ที่อยู่: ต.{patient.currentAddress.subdistrict} อ.{patient.currentAddress.district}
                </p>

                {/* Stored Reason Log */}
                <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs text-slate-700 mt-2">
                  <div className="font-bold text-slate-800 mb-0.5 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-slate-500" />
                    บันทึกสาเหตุการย้ายสถานะ/ปิดเคส:
                  </div>
                  <p className="leading-relaxed">
                    {patient.statusReason || 'ไม่มีบันทึกสาเหตุเพิ่มเติม'}
                  </p>
                </div>
              </div>

              {/* Action Controls */}
              <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                <button
                  type="button"
                  onClick={() => setPrintingPatient(patient)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
                  title="สั่งพิมพ์ประวัติ สค.04 ย้อนหลัง"
                >
                  <Printer className="w-3.5 h-3.5" />
                  พิมพ์ประวัติย้อนหลัง
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`คุณต้องการกู้คืนสถานะของ ${patient.fullName} กลับเข้าสู่โครงการหรือไม่?`)) {
                      onRestorePatient(patient.id);
                    }
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer"
                  title="กู้คืนสถานะกลับเข้าสู่โครงการ"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  กู้คืนสถานะ
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-xs">
          <Archive className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h3 className="font-bold text-slate-700 text-sm">ไม่พบประวัติในคลัง</h3>
          <p className="text-xs text-slate-400 mt-1">ผู้ป่วยที่ถูกย้ายสถานะจะแสดงในหน้านี้</p>
        </div>
      )}

      {printingPatient && (
        <PrintFormSK04
          patient={printingPatient}
          onClose={() => setPrintingPatient(null)}
        />
      )}
    </div>
  );
};
