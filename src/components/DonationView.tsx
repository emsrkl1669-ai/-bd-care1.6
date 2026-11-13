import React, { useState, useMemo } from 'react';
import { 
  Gift, 
  Building2, 
  User, 
  Plus, 
  Search, 
  FileSpreadsheet, 
  Printer, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  FileText,
  Camera,
  Layers,
  Sparkles,
  Phone,
  MapPin,
  Calendar,
  X,
  Droplets,
  Utensils,
  Wheat,
  Heart
} from 'lucide-react';
import { 
  DonationDistributionRecord, 
  DonationRecipientType, 
  AdminUser 
} from '../types';
import { exportDonationsToCsv } from '../utils/storage';
import { formatNationalId, formatPhone, formatThaiDate, formatThaiDateShort } from '../utils/idCard';
import { DonationFormModal } from './DonationFormModal';
import { PrintDonationForm } from './PrintDonationForm';
import { PrintRosterModal } from './PrintRosterModal';
import { useUiFeedback } from './UiFeedback';

interface DonationViewProps {
  donations: DonationDistributionRecord[];
  onSaveDonation: (record: DonationDistributionRecord) => void;
  onDeleteDonation: (id: string) => void;
  currentAdmin: AdminUser;
}

export const DonationView: React.FC<DonationViewProps> = ({
  donations,
  onSaveDonation,
  onDeleteDonation,
  currentAdmin,
}) => {
  const { confirmDialog } = useUiFeedback();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'individual' | 'government' | 'completed' | 'pending'>('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<DonationDistributionRecord | null>(null);
  const [printingRecord, setPrintingRecord] = useState<DonationDistributionRecord | null>(null);
  const [isPrintingRoster, setIsPrintingRoster] = useState(false);
  const [previewingPhoto, setPreviewingPhoto] = useState<string | null>(null);

  // Computed Totals & Metrics
  const totalCount = donations.length;
  const individualCount = donations.filter((d) => d.recipientType === 'individual').length;
  const governmentCount = donations.filter((d) => d.recipientType === 'government').length;

  const totalWater = useMemo(() => donations.reduce((sum, d) => sum + (d.waterPacks || 0), 0), [donations]);
  const totalDryFood = useMemo(() => donations.reduce((sum, d) => sum + (d.dryFoodCount || 0), 0), [donations]);
  const totalRiceBags = useMemo(() => donations.reduce((sum, d) => sum + (d.riceBags || 0), 0), [donations]);
  const totalRiceKg = useMemo(() => totalRiceBags * 5, [totalRiceBags]);
  const totalDiapers = useMemo(() => donations.reduce((sum, d) => sum + (d.diaperPacks || 0), 0), [donations]);

  // Filtered donations
  const filteredDonations = useMemo(() => {
    return donations.filter((record) => {
      // Type/Status filter
      if (filterType === 'individual' && record.recipientType !== 'individual') return false;
      if (filterType === 'government' && record.recipientType !== 'government') return false;
      if (filterType === 'completed' && record.status !== 'completed') return false;
      if (filterType === 'pending' && record.status !== 'pending') return false;

      // Search term
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();

      const indivName = (record.individualName || '').toLowerCase();
      const indivId = (record.individualNationalId || '').replace(/[^0-9]/g, '');
      const agencyName = (record.agencyName || '').toLowerCase();
      const contactPerson = (record.agencyContactPerson || '').toLowerCase();
      const phone = (record.individualPhone || record.agencyPhone || '').toLowerCase();
      const place = (record.handoverPlace || '').toLowerCase();
      const code = (record.code || '').toLowerCase();

      return (
        indivName.includes(term) ||
        indivId.includes(term) ||
        agencyName.includes(term) ||
        contactPerson.includes(term) ||
        phone.includes(term) ||
        place.includes(term) ||
        code.includes(term)
      );
    });
  }, [donations, filterType, searchTerm]);

  const handleDelete = async (id: string, name: string) => {
    const ok = await confirmDialog({
      title: 'ยืนยันการลบรายการบริจาค',
      message: `คุณแน่ใจหรือไม่ว่าต้องการลบรายการบริจาคของ "${name}"?`,
      confirmLabel: 'ลบรายการ',
      cancelLabel: 'ยกเลิก',
      variant: 'danger',
    });
    if (ok) {
      onDeleteDonation(id);
    }
  };


  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4">
      {/* Top Banner / Hero */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 rounded-2xl p-4 sm:p-6 text-white shadow-lg flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-400/30">
              <Gift className="w-5 h-5 sm:w-6 sm:h-6" />
            </span>
            <h2 className="text-lg sm:text-xl font-black tracking-tight">
              ระบบบริจาคสิ่งของสงเคราะห์ (ประชาชนทั่วไป & หน่วยงานราชการ)
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-300">
            มูลนิธิร่วมกุศลสมุทรปราการ (北欖天德善堂) • บันทึกการแจกจ่ายน้ำดื่ม อาหารแห้ง ข้าวสาร แพมเพิส และสิ่งของยังชีพ
          </p>
        </div>

        <div className="flex items-center gap-2">
          {donations.length > 0 && (
            <>
              <button
                onClick={() => setIsPrintingRoster(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer"
                title="พิมพ์รายงานการส่งมอบสิ่งของบริจาค ขนาด A4"
              >
                <Printer className="w-4 h-4" />
                <span>พิมพ์รายงาน A4 ({filteredDonations.length})</span>
              </button>

              <button
                onClick={() => exportDonationsToCsv(donations)}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 transition cursor-pointer"
                title="ส่งออกไฟล์ Excel/CSV พร้อมภาษาไทย UTF-8 BOM"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span>ส่งออก CSV</span>
              </button>
            </>
          )}

          <button
            onClick={() => {
              setEditingRecord(null);
              setIsFormOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ บันทึกการบริจาคสิ่งของ</span>
          </button>
        </div>
      </div>

      {/* KPI Cumulative Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Total & Types */}
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs">
          <div className="text-xs text-slate-500 font-medium flex items-center justify-between">
            <span>รายการบริจาคทั้งหมด</span>
            <span className="text-[10.5px] bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded font-bold">
              {totalCount} ครั้ง
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 font-mono">
              {totalCount.toLocaleString()}
            </span>
            <span className="text-xs text-slate-500">บันทึก</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2">
            <span className="text-blue-700 font-semibold">ประชาชน {individualCount}</span>
            <span>•</span>
            <span className="text-emerald-700 font-semibold">หน่วยงาน {governmentCount}</span>
          </div>
        </div>

        {/* Card 2: Water */}
        <div className="bg-white rounded-xl border border-blue-200 p-3.5 shadow-2xs bg-blue-50/20">
          <div className="text-xs text-blue-800 font-medium flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Droplets className="w-3.5 h-3.5 text-blue-600" />
              <span>น้ำดื่มสะสม</span>
            </span>
            <span className="text-[10px] text-blue-600 font-bold">สะอาด/ขวด</span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-blue-900 font-mono">
              {totalWater.toLocaleString()}
            </span>
            <span className="text-xs font-semibold text-blue-700">แพ็ค</span>
          </div>
          <div className="text-[11px] text-blue-600/80 mt-1">
            น้ำดื่มมูลนิธิร่วมกุศลสมุทรปราการ
          </div>
        </div>

        {/* Card 3: Rice & Dry Food */}
        <div className="bg-white rounded-xl border border-emerald-200 p-3.5 shadow-2xs bg-emerald-50/20">
          <div className="text-xs text-emerald-800 font-medium flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Wheat className="w-3.5 h-3.5 text-emerald-600" />
              <span>ข้าวสาร & อาหารแห้ง</span>
            </span>
            <span className="text-[10px] text-emerald-700 font-bold">ถุงยังชีพ</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <div>
              <span className="text-2xl font-black text-emerald-900 font-mono">
                {totalRiceBags.toLocaleString()}
              </span>
              <span className="text-xs font-semibold text-emerald-700 ml-1">ถุง (5กก.)</span>
            </div>
            <span className="text-slate-300">|</span>
            <div>
              <span className="text-xl font-black text-amber-800 font-mono">
                {totalDryFood.toLocaleString()}
              </span>
              <span className="text-xs font-semibold text-amber-700 ml-1">ชุด</span>
            </div>
          </div>
          <div className="text-[11px] text-emerald-700/80 mt-1">
            รวมข้าวสารหนัก {totalRiceKg.toLocaleString()} กก.
          </div>
        </div>

        {/* Card 4: Diapers */}
        <div className="bg-white rounded-xl border border-purple-200 p-3.5 shadow-2xs bg-purple-50/20">
          <div className="text-xs text-purple-800 font-medium flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Heart className="w-3.5 h-3.5 text-purple-600" />
              <span>แพมเพิส / ผ้าอ้อม</span>
            </span>
            <span className="text-[10px] text-purple-700 font-bold">ผู้ใหญ่/เด็ก</span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-purple-900 font-mono">
              {totalDiapers.toLocaleString()}
            </span>
            <span className="text-xs font-semibold text-purple-700">แพ็ค</span>
          </div>
          <div className="text-[11px] text-purple-600/80 mt-1">
            ช่วยเหลือผู้ป่วย/ผู้สูงอายุ/เด็ก
          </div>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Search bar */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ค้นหาด้วยชื่อผู้รับ, เลขบัตร 13 หลัก, ชื่อหน่วยงานราชการ, หรือสถานที่..."
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-semibold overflow-x-auto">
            {[
              { id: 'all', label: 'ทั้งหมด' },
              { id: 'individual', label: `ประชาชนทั่วไป (${individualCount})` },
              { id: 'government', label: `หน่วยงานราชการ (${governmentCount})` },
              { id: 'completed', label: 'ส่งมอบแล้ว' },
              { id: 'pending', label: 'รอส่งมอบ' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterType(tab.id as any)}
                className={`px-3 py-1 rounded-md transition cursor-pointer whitespace-nowrap ${
                  filterType === tab.id
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

      {/* Donation Records List */}
      {filteredDonations.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center space-y-3">
          <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto border border-amber-200">
            <Gift className="w-8 h-8" />
          </div>
          <h3 className="font-bold text-slate-800 text-base">ยังไม่มีข้อมูลการบริจาคสิ่งของ</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {searchTerm
              ? 'ไม่พบข้อมูลที่ตรงกับคำค้นหา ลองเปลี่ยนคำค้นหาหรือตัวกรอง'
              : 'เริ่มต้นบันทึกการส่งมอบสิ่งของบริจาคให้แก่ประชาชนทั่วไปหรือหน่วยงานราชการ'}
          </p>
          <button
            onClick={() => {
              setEditingRecord(null);
              setIsFormOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition shadow-md cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ บันทึกการบริจาคสิ่งของรายการแรก</span>
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                  <th className="py-3 px-3.5 w-24">รหัส / วันที่</th>
                  <th className="py-3 px-3">ประเภทผู้รับ</th>
                  <th className="py-3 px-3 min-w-[200px]">ชื่อผู้รับ / หน่วยงานราชการ</th>
                  <th className="py-3 px-3 min-w-[220px]">สิ่งของที่บริจาค</th>
                  <th className="py-3 px-3">สถานที่ / วิธีส่งมอบ</th>
                  <th className="py-3 px-3 text-center">หลักฐาน</th>
                  <th className="py-3 px-3 text-center">สถานะ</th>
                  <th className="py-3 px-3 text-right">การจัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDonations.map((record) => {
                  const isIndiv = record.recipientType === 'individual';
                  const titleName = isIndiv
                    ? `${record.individualTitle || ''} ${record.individualName || ''}`
                    : record.agencyName;

                  return (
                    <tr key={record.id} className="hover:bg-slate-50/70 transition">
                      {/* Code & Date */}
                      <td className="py-3 px-3.5 font-mono">
                        <span className="font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                          {record.code}
                        </span>
                        <div className="text-[10.5px] text-slate-500 mt-1">
                          {formatThaiDate(record.distributionDate)}
                        </div>
                      </td>

                      {/* Recipient Type */}
                      <td className="py-3 px-3">
                        {isIndiv ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                            <User className="w-3 h-3" />
                            <span>ประชาชนทั่วไป</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <Building2 className="w-3 h-3" />
                            <span>หน่วยงานราชการ</span>
                          </span>
                        )}
                        <div className="text-[10px] text-slate-500 mt-1">
                          {isIndiv ? (record.individualCategory || 'ผู้ยากไร้') : (record.agencyType || 'ส่วนราชการ')}
                        </div>
                      </td>

                      {/* Recipient Name & Details */}
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900 text-xs">
                          {titleName}
                        </div>
                        {isIndiv ? (
                          <div className="text-[10.5px] text-slate-500 space-y-0.5 mt-0.5">
                            {record.individualNationalId && (
                              <div className="font-mono text-slate-600">
                                เลขบัตร: {formatNationalId(record.individualNationalId)}
                              </div>
                            )}
                            {record.individualPhone && (
                              <div className="flex items-center gap-1">
                                <Phone className="w-3 h-3 text-slate-400" />
                                <span>{formatPhone(record.individualPhone)}</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-[10.5px] text-slate-500 space-y-0.5 mt-0.5">
                            <div className="font-medium text-slate-700">
                              ผู้แทน: {record.agencyContactPerson} {record.agencyContactPosition && `(${record.agencyContactPosition})`}
                            </div>
                            {record.agencyPhone && (
                              <div className="flex items-center gap-1">
                                <Phone className="w-3 h-3 text-slate-400" />
                                <span>{formatPhone(record.agencyPhone)}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Donated Items Breakdown */}
                      <td className="py-3 px-3">
                        <div className="flex flex-wrap gap-1">
                          {record.waterPacks > 0 && (
                            <span className="bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 rounded-md font-bold text-[11px] flex items-center gap-1">
                              <Droplets className="w-3 h-3 text-blue-600" />
                              <span>น้ำดื่ม {record.waterPacks} แพ็ค</span>
                            </span>
                          )}

                          {record.dryFoodCount > 0 && (
                            <span className="bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-md font-bold text-[11px] flex items-center gap-1">
                              <Utensils className="w-3 h-3 text-amber-600" />
                              <span>อาหารแห้ง {record.dryFoodCount} ชุด</span>
                            </span>
                          )}

                          {record.riceBags > 0 && (
                            <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md font-bold text-[11px] flex items-center gap-1">
                              <Wheat className="w-3 h-3 text-emerald-600" />
                              <span>ข้าวสาร {record.riceBags} ถุง (5กก.)</span>
                            </span>
                          )}

                          {record.diaperPacks > 0 && (
                            <span className="bg-purple-50 text-purple-800 border border-purple-200 px-2 py-0.5 rounded-md font-bold text-[11px] flex items-center gap-1">
                              <Heart className="w-3 h-3 text-purple-600" />
                              <span>แพมเพิส {record.diaperPacks} แพ็ค ({record.diaperSize || 'คละ'})</span>
                            </span>
                          )}

                          {record.otherItems && record.otherItems.length > 0 && (
                            <span className="bg-slate-100 text-slate-700 border border-slate-200 px-1.5 py-0.5 rounded-md font-semibold text-[10.5px]">
                              +{record.otherItems.length} สิ่งของอื่นๆ
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Location / Delivery Method */}
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-800 text-[11px] flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[140px]">{record.handoverPlace || 'มูลนิธิร่วมกุศลฯ'}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          โดย {record.officerName || 'เจ้าหน้าที่'}
                        </div>
                      </td>

                      {/* Attachments / Photos Badge */}
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {record.photos && record.photos.length > 0 ? (
                            <button
                              type="button"
                              onClick={() => setPreviewingPhoto(record.photos[0].dataUrl)}
                              className="relative group p-1 bg-blue-50 text-blue-700 rounded-md border border-blue-200 hover:bg-blue-100 transition cursor-pointer"
                              title={`ดูภาพถ่ายการรับมอบ (${record.photos.length} ภาพ)`}
                            >
                              <Camera className="w-3.5 h-3.5" />
                              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-blue-600 text-white text-[9px] font-bold flex items-center justify-center">
                                {record.photos.length}
                              </span>
                            </button>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}

                          {record.documents && record.documents.length > 0 && (
                            <span className="p-1 bg-amber-50 text-amber-700 rounded-md border border-amber-200 text-[10px] font-bold" title={`มีเอกสารแนบ ${record.documents.length} ฉบับ`}>
                              <FileText className="w-3.5 h-3.5 inline" />
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-md text-[10.5px] font-bold ${
                          record.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : record.status === 'cancelled'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {record.status === 'completed' ? 'ส่งมอบแล้ว' :
                           record.status === 'cancelled' ? 'ยกเลิก' : 'รอส่งมอบ'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setPrintingRecord(record)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                            title="พิมพ์ใบสำคัญส่งมอบสิ่งของบริจาค"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingRecord(record);
                              setIsFormOpen(true);
                            }}
                            className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                            title="แก้ไขบันทึกบริจาค"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(record.id, titleName || record.code)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition cursor-pointer"
                            title="ลบรายการ"
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

      {/* Form Modal for Creating/Editing Donation */}
      {isFormOpen && (
        <DonationFormModal
          initialRecord={editingRecord}
          currentAdmin={currentAdmin}
          isOpen={isFormOpen}
          onClose={() => {
            setIsFormOpen(false);
            setEditingRecord(null);
          }}
          onSave={onSaveDonation}
          existingCount={donations.length}
          existingCodes={donations.map((d) => d.code)}
        />
      )}

      {/* Print Slip Modal */}
      {printingRecord && (
        <PrintDonationForm
          record={printingRecord}
          onClose={() => setPrintingRecord(null)}
        />
      )}

      {/* Photo Preview Modal */}
      {previewingPhoto && (
        <div 
          onClick={() => setPreviewingPhoto(null)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="relative max-w-3xl max-h-[85vh] bg-white rounded-2xl overflow-hidden shadow-2xl p-2" onClick={(e) => e.stopPropagation()}>
            <img src={previewingPhoto} alt="หลักฐานการรับมอบ" className="max-h-[80vh] w-auto object-contain rounded-xl" />
            <button
              onClick={() => setPreviewingPhoto(null)}
              className="absolute top-4 right-4 bg-slate-900/80 hover:bg-slate-900 text-white p-2 rounded-full cursor-pointer transition shadow"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* A4 Donation Distribution Summary Report Modal */}
      {isPrintingRoster && (
        <PrintRosterModal
          title="รายงานสรุปการส่งมอบสิ่งของบริจาคสงเคราะห์"
          subtitle={`หมวด: ${filterType === 'individual' ? 'ประชาชนทั่วไป' : filterType === 'government' ? 'หน่วยงานราชการ' : 'ทั้งหมด'} • มูลนิธิร่วมกุศลสมุทรปราการ (北欖天德善堂)`}
          documentCode="แบบ บจ.01-R"
          items={filteredDonations}
          itemsPerPage={9}
          onClose={() => setIsPrintingRoster(false)}
          summaryItems={[
            { label: 'บันทึกตามตัวกรอง', value: `${filteredDonations.length} รายการ` },
            { label: 'น้ำดื่มสิงห์รวม', value: `${filteredDonations.reduce((s, d) => s + (d.waterPacks || 0), 0)} แพ็ค` },
            { label: 'อาหารแห้งยังชีพ', value: `${filteredDonations.reduce((s, d) => s + (d.dryFoodCount || 0), 0)} ชุด` },
            { label: 'ข้าวสารรวม', value: `${filteredDonations.reduce((s, d) => s + (d.riceBags || 0), 0)} ถุง (${filteredDonations.reduce((s, d) => s + (d.riceBags || 0), 0) * 5} กก.)` },
            { label: 'ผ้าอ้อม/แพมเพิส', value: `${filteredDonations.reduce((s, d) => s + (d.diaperPacks || 0), 0)} ห่อ` },
          ]}
          columns={[
            {
              header: 'รหัสบันทึก',
              width: 'w-24',
              align: 'center',
              render: (d) => (
                <div className="font-mono font-bold text-blue-900 text-[10.5px]">{d.code}</div>
              ),
            },
            {
              header: 'วันที่ส่งมอบ',
              width: 'w-24',
              align: 'center',
              render: (d) => (
                <div className="text-[10px] text-slate-700 font-mono">{formatThaiDateShort(d.distributionDate)}</div>
              ),
            },
            {
              header: 'ผู้รับมอบสิ่งของ (ประชาชน / หน่วยงาน)',
              width: 'w-52',
              render: (d) => (
                <div>
                  {d.recipientType === 'individual' ? (
                    <div>
                      <div className="font-bold text-slate-900 text-[11px] leading-tight">
                        {d.individualTitle}{d.individualName}
                      </div>
                      <div className="text-[9.5px] text-slate-500 font-mono">
                        ปชช: {formatNationalId(d.individualNationalId || '')}
                      </div>
                      {d.individualPhone && <div className="text-[9px] text-slate-600 font-mono">{formatPhone(d.individualPhone)}</div>}
                    </div>
                  ) : (
                    <div>
                      <div className="font-bold text-slate-900 text-[11px] leading-tight">{d.agencyName}</div>
                      <div className="text-[9.5px] text-slate-600">ผู้แทน: {d.agencyContactPerson} ({d.agencyContactPosition || '-'})</div>
                      {d.agencyPhone && <div className="text-[9px] text-slate-500 font-mono">{formatPhone(d.agencyPhone)}</div>}
                    </div>
                  )}
                </div>
              ),
            },
            {
              header: 'สิ่งของที่ส่งมอบ',
              render: (d) => (
                <div className="text-[9.5px] text-slate-700 space-y-0.5">
                  {d.waterPacks > 0 && <span className="mr-1.5">• น้ำ {d.waterPacks} {d.waterUnit || 'แพ็ค'}</span>}
                  {d.dryFoodCount > 0 && <span className="mr-1.5">• อาหารแห้ง {d.dryFoodCount} {d.dryFoodUnit || 'ชุด'}</span>}
                  {d.riceBags > 0 && <span className="mr-1.5 font-semibold text-slate-900">• ข้าวสาร {d.riceBags} ถุง ({(d.riceBags * 5).toLocaleString()} กก.)</span>}
                  {d.diaperPacks > 0 && <span className="font-semibold text-blue-900">• แพมเพิส {d.diaperPacks} ห่อ</span>}
                  {d.otherItems && d.otherItems.length > 0 && (
                    <div className="text-[9px] text-slate-500">
                      • อื่นๆ: {d.otherItems.map(i => `${i.name} (${i.quantity} ${i.unit})`).join(', ')}
                    </div>
                  )}
                </div>
              ),
            },
            {
              header: 'สถานที่ / วิธีส่งมอบ',
              width: 'w-36',
              render: (d) => (
                <div className="text-[9.5px] text-slate-700 leading-tight">
                  <div className="font-medium text-slate-900">{d.handoverPlace || 'มูลนิธิฯ'}</div>
                  <div className="text-slate-500 text-[9px]">{d.deliveryMethod || 'รับที่มูลนิธิฯ'}</div>
                </div>
              ),
            },
            {
              header: 'ผู้ส่งมอบ',
              width: 'w-28',
              render: (d) => (
                <div className="text-[9.5px] text-slate-700">
                  {d.officerName || 'นายกริชพิพัฒน์  สลับทอง'}
                </div>
              ),
            },
            {
              header: 'สถานะ',
              width: 'w-20',
              align: 'center',
              render: (d) => (
                <span className={`text-[9.5px] font-semibold px-2 py-0.5 rounded-full ${
                  d.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {d.status === 'completed' ? 'ส่งมอบแล้ว' : 'รอส่งมอบ'}
                </span>
              ),
            },
          ]}
        />
      )}
    </div>
  );
};
