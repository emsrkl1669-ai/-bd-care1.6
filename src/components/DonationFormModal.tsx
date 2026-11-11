import React, { useState, useRef } from 'react';
import { 
  X, 
  Save, 
  Upload, 
  Trash2, 
  Plus, 
  Gift, 
  Building2, 
  User, 
  Calendar, 
  MapPin, 
  FileText, 
  Camera, 
  CheckCircle2, 
  AlertCircle,
  Package,
  Layers,
  Sparkles
} from 'lucide-react';
import { 
  DonationDistributionRecord, 
  DonationRecipientType, 
  DonationStatus, 
  DonationOtherItem, 
  DonationPhoto, 
  DonationDocument,
  AdminUser, 
  ADMIN_USERS 
} from '../types';
import { formatNationalId, formatPhone } from '../utils/idCard';
import { ThaiDateInput } from './ThaiDateInput';

interface DonationFormModalProps {
  initialRecord: DonationDistributionRecord | null;
  currentAdmin: AdminUser;
  isOpen: boolean;
  onClose: () => void;
  onSave: (record: DonationDistributionRecord) => void;
  existingCount: number;
}

export const DonationFormModal: React.FC<DonationFormModalProps> = ({
  initialRecord,
  currentAdmin,
  isOpen,
  onClose,
  onSave,
  existingCount,
}) => {
  const [formData, setFormData] = useState<Partial<DonationDistributionRecord>>(() => {
    if (initialRecord) return { ...initialRecord };

    const currentYear = new Date().getFullYear() + 543;
    const shortYear = currentYear.toString().slice(-2);
    const code = `บริจาค-${shortYear}-${(existingCount + 1).toString().padStart(3, '0')}`;

    return {
      id: `donation-${Date.now()}`,
      code,
      distributionDate: new Date().toISOString().slice(0, 10),
      status: 'completed',
      recipientType: 'individual',

      // ประชาชนทั่วไป
      individualTitle: 'นาย',
      individualName: '',
      individualNationalId: '',
      individualPhone: '',
      individualAddress: '',
      individualCategory: 'ผู้ยากไร้',
      individualNeedReason: 'ครอบครัวมีฐานะยากจน รายได้ไม่เพียงพอต่อการดำรงชีพ',

      // หน่วยงานราชการ
      agencyName: '',
      agencyType: 'โรงพยาบาล/รพ.สต./สาธารณสุข',
      agencyContactPerson: '',
      agencyContactPosition: '',
      agencyPhone: '',
      agencyAddress: '',
      agencyRequestPurpose: 'เพื่อนำไปแจกจ่ายช่วยเหลือประชาชนและผู้ป่วยในพื้นที่รับผิดชอบ',
      officialLetterNo: '',

      // รายการสิ่งของ
      waterPacks: 10,
      waterUnit: 'แพ็ค',
      dryFoodCount: 5,
      dryFoodUnit: 'ชุด',
      riceBags: 5,
      riceKg: 25,
      diaperPacks: 0,
      diaperSize: 'คละไซส์',
      otherItems: [],
      notes: '',

      // สถานที่และวิธีส่งมอบ
      handoverPlace: 'มูลนิธิร่วมกุศลสมุทรปราการ (ปากน้ำ)',
      deliveryMethod: 'รับมอบ ณ มูลนิธิร่วมกุศลสมุทรปราการ',

      // เจ้าหน้าที่
      officerId: currentAdmin.id,
      officerName: currentAdmin.name,
      officerPosition: currentAdmin.position,
      approverName: 'นางสาวศาตพร ภูมิโคกรักษ์',
      approverPosition: 'ผู้จัดการมูลนิธิร่วมกุศลสมุทรปราการ (ผู้อนุมัติ)',

      photos: [],
      documents: [],
    };
  });

  const [errorMsg, setErrorMsg] = useState('');
  const photoInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleChange = (field: keyof DonationDistributionRecord, value: any) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      // auto calculate riceKg if riceBags changed
      if (field === 'riceBags') {
        next.riceKg = Number(value) * 5;
      }
      return next;
    });
  };

  // Other dynamic items handlers
  const handleAddOtherItem = () => {
    const newItem: DonationOtherItem = {
      id: `item-${Date.now()}`,
      name: '',
      quantity: 1,
      unit: 'ชิ้น',
    };
    setFormData((prev) => ({
      ...prev,
      otherItems: [...(prev.otherItems || []), newItem],
    }));
  };

  const handleUpdateOtherItem = (id: string, field: keyof DonationOtherItem, val: any) => {
    setFormData((prev) => ({
      ...prev,
      otherItems: (prev.otherItems || []).map((item) =>
        item.id === id ? { ...item, [field]: val } : item
      ),
    }));
  };

  const handleRemoveOtherItem = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      otherItems: (prev.otherItems || []).filter((item) => item.id !== id),
    }));
  };

  // Upload Photo Handlers
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        const newPhoto: DonationPhoto = {
          id: `photo-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
          dataUrl,
          caption: 'ภาพถ่ายการรับมอบสิ่งของบริจาค',
          timestamp: new Date().toISOString(),
        };
        setFormData((prev) => ({
          ...prev,
          photos: [...(prev.photos || []), newPhoto],
        }));
      };
      reader.readAsDataURL(file);
    });

    e.target.value = '';
  };

  const handleRemovePhoto = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      photos: (prev.photos || []).filter((p) => p.id !== id),
    }));
  };

  // Upload Document Handlers
  const handleDocUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        const newDoc: DonationDocument = {
          id: `doc-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
          title: file.name,
          fileName: file.name,
          fileType: file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
          dataUrl,
          fileSize: file.size,
          uploadDate: new Date().toISOString(),
        };
        setFormData((prev) => ({
          ...prev,
          documents: [...(prev.documents || []), newDoc],
        }));
      };
      reader.readAsDataURL(file);
    });

    e.target.value = '';
  };

  const handleRemoveDoc = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      documents: (prev.documents || []).filter((d) => d.id !== id),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (formData.recipientType === 'individual') {
      if (!formData.individualName?.trim()) {
        setErrorMsg('กรุณากรอกชื่อ-นามสกุล ของประชาชนผู้รับมอบ');
        return;
      }
    } else {
      if (!formData.agencyName?.trim()) {
        setErrorMsg('กรุณากรอกชื่อหน่วยงานราชการที่ขอรับบริจาค');
        return;
      }
      if (!formData.agencyContactPerson?.trim()) {
        setErrorMsg('กรุณากรอกชื่อผู้แทน/ผู้รับมอบของหน่วยงาน');
        return;
      }
    }

    // Check if at least one item has quantity > 0
    const totalItemsCount = 
      (formData.waterPacks || 0) + 
      (formData.dryFoodCount || 0) + 
      (formData.riceBags || 0) + 
      (formData.diaperPacks || 0) + 
      (formData.otherItems?.length || 0);

    if (totalItemsCount <= 0) {
      setErrorMsg('กรุณาระบุจำนวนสิ่งของบริจาคอย่างน้อย 1 รายการ (น้ำ, อาหารแห้ง, ข้าวสาร, แพมเพิส หรือสิ่งของอื่นๆ)');
      return;
    }

    const completedRecord: DonationDistributionRecord = {
      ...(formData as DonationDistributionRecord),
      updatedAt: new Date().toISOString(),
      createdAt: formData.createdAt || new Date().toISOString(),
    };

    onSave(completedRecord);
    onClose();
  };

  const isIndividual = formData.recipientType === 'individual';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex flex-col items-center p-2 sm:p-4">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto">
        
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center">
              <Gift className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base sm:text-lg text-white">
                  {initialRecord ? 'แก้ไขบันทึกการบริจาคสิ่งของ' : 'บันทึกการบริจาคสิ่งของ (ประชาชนทั่วไป / หน่วยงานราชการ)'}
                </h3>
                <span className="text-xs bg-amber-500/30 text-amber-200 font-mono font-bold px-2 py-0.5 rounded-md border border-amber-400/40">
                  {formData.code}
                </span>
              </div>
              <p className="text-xs text-slate-300">
                มูลนิธิร่วมกุศลสมุทรปราการ (北欖天德善堂) • แผนกสังคมสงเคราะห์และการแจกจ่ายสิ่งของยังชีพ
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

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto max-h-[78vh] space-y-6">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* SECTION 1: เลือกประเภทผู้รับมอบ */}
          <div className="bg-blue-50/60 border-2 border-blue-200 rounded-xl p-4">
            <label className="block font-bold text-sm text-slate-900 mb-2">
              1. เลือกประเภทผู้รับมอบสิ่งของบริจาค *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleChange('recipientType', 'individual')}
                className={`p-3.5 rounded-xl border-2 flex items-center gap-3 transition cursor-pointer text-left ${
                  isIndividual
                    ? 'border-blue-600 bg-white text-blue-900 shadow-sm ring-2 ring-blue-500/20'
                    : 'border-slate-200 bg-white/60 hover:bg-white text-slate-700'
                }`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                  isIndividual ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-sm">ประชาชนทั่วไป / ผู้ยากไร้</div>
                  <div className="text-[11px] text-slate-500">บุคคลธรรมดา, ครอบครัวผู้ยากไร้, ผู้ประสบภัย, ผู้สูงอายุ</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleChange('recipientType', 'government')}
                className={`p-3.5 rounded-xl border-2 flex items-center gap-3 transition cursor-pointer text-left ${
                  !isIndividual
                    ? 'border-emerald-600 bg-white text-emerald-900 shadow-sm ring-2 ring-emerald-500/20'
                    : 'border-slate-200 bg-white/60 hover:bg-white text-slate-700'
                }`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                  !isIndividual ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-sm">หน่วยงานราชการ / องค์กร</div>
                  <div className="text-[11px] text-slate-500">รพ./รพ.สต., เทศบาล, อบต., สภ., โรงเรียน, ศูนย์พัฒนาชุมชน</div>
                </div>
              </button>
            </div>
          </div>

          {/* SECTION 2: ข้อมูลผู้รับมอบ (สลับตามประเภท) */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs">
                  2
                </span>
                <span>
                  {isIndividual ? 'ข้อมูลประชาชนผู้รับมอบสิ่งของ' : 'ข้อมูลหน่วยงานราชการ / องค์กรผู้ขอรับบริจาค'}
                </span>
              </h4>
              <span className="text-xs text-slate-500 font-medium">
                {isIndividual ? 'บุคคลธรรมดา' : 'หน่วยงานภาครัฐ'}
              </span>
            </div>

            {isIndividual ? (
              /* Case 1: Individual */
              <div className="grid grid-cols-12 gap-3 text-xs">
                <div className="col-span-12 sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">คำนำหน้า</label>
                  <select
                    value={formData.individualTitle || 'นาย'}
                    onChange={(e) => handleChange('individualTitle', e.target.value)}
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
                  <label className="block font-bold text-slate-700 mb-1">ชื่อ-นามสกุล ผู้รับมอบ *</label>
                  <input
                    type="text"
                    value={formData.individualName || ''}
                    onChange={(e) => handleChange('individualName', e.target.value)}
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
                    value={formData.individualNationalId || ''}
                    onChange={(e) => handleChange('individualNationalId', e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="x-xxxx-xxxxx-xx-x"
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>

                <div className="col-span-12 sm:col-span-4">
                  <label className="block font-bold text-slate-700 mb-1">เบอร์โทรศัพท์ติดต่อ</label>
                  <input
                    type="tel"
                    value={formData.individualPhone || ''}
                    onChange={(e) => handleChange('individualPhone', e.target.value)}
                    placeholder="08x-xxxxxxx"
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>

                <div className="col-span-12 sm:col-span-4">
                  <label className="block font-bold text-slate-700 mb-1">กลุ่มเป้าหมาย</label>
                  <select
                    value={formData.individualCategory || 'ผู้ยากไร้'}
                    onChange={(e) => handleChange('individualCategory', e.target.value)}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold"
                  >
                    <option value="ผู้ยากไร้">ผู้ยากไร้ / มีรายได้น้อย</option>
                    <option value="ผู้ประสบภัย">ผู้ประสบภัย (น้ำท่วม/ไฟไหม้/วาตภัย)</option>
                    <option value="ผู้สูงอายุ">ผู้สูงอายุ / ไม่มีคนดูแล</option>
                    <option value="ผู้ป่วย/คนพิการ">ผู้ป่วย / คนพิการในชุมชน</option>
                    <option value="ประชาชนทั่วไป">ประชาชนทั่วไป</option>
                  </select>
                </div>

                <div className="col-span-12 sm:col-span-6">
                  <label className="block font-bold text-slate-700 mb-1">วันที่ส่งมอบ (วัน เดือน พ.ศ.)</label>
                  <ThaiDateInput
                    value={formData.distributionDate || ''}
                    onChange={(val) => handleChange('distributionDate', val)}
                    minYearBE={2560}
                    maxYearBE={new Date().getFullYear() + 543 + 5}
                  />
                </div>

                <div className="col-span-12 sm:col-span-6">
                  <label className="block font-bold text-slate-700 mb-1">ที่อยู่ / ชุมชน ที่อาศัยอยู่</label>
                  <input
                    type="text"
                    value={formData.individualAddress || ''}
                    onChange={(e) => handleChange('individualAddress', e.target.value)}
                    placeholder="บ้านเลขที่, ชุมชน, ซอย, ถนน, ตำบล, อำเภอ"
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                <div className="col-span-12 sm:col-span-6">
                  <label className="block font-bold text-slate-700 mb-1">เหตุผลความจำเป็น / สภาพปัญหา</label>
                  <input
                    type="text"
                    value={formData.individualNeedReason || ''}
                    onChange={(e) => handleChange('individualNeedReason', e.target.value)}
                    placeholder="เช่น ครอบครัวยากจน ไม่มีรายได้, ประสบอัคคีภัย"
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>
            ) : (
              /* Case 2: Government Agency */
              <div className="grid grid-cols-12 gap-3 text-xs">
                <div className="col-span-12 sm:col-span-7">
                  <label className="block font-bold text-slate-700 mb-1">ชื่อหน่วยงานราชการ / ส่วนราชการ *</label>
                  <input
                    type="text"
                    value={formData.agencyName || ''}
                    onChange={(e) => handleChange('agencyName', e.target.value)}
                    placeholder="เช่น รพ.สต.บางปู, เทศบาลนครสมุทรปราการ, สภ.เมืองสมุทรปราการ"
                    required
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900"
                  />
                </div>

                <div className="col-span-12 sm:col-span-5">
                  <label className="block font-bold text-slate-700 mb-1">ประเภทหน่วยงาน</label>
                  <select
                    value={formData.agencyType || 'โรงพยาบาล/รพ.สต./สาธารณสุข'}
                    onChange={(e) => handleChange('agencyType', e.target.value)}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold"
                  >
                    <option value="โรงพยาบาล/รพ.สต./สาธารณสุข">โรงพยาบาล / รพ.สต. / สาธารณสุข</option>
                    <option value="เทศบาล/อบต./อปท.">เทศบาล / อบต. / ท้องถิ่น (อปท.)</option>
                    <option value="สถานีตำรวจ/ฝ่ายความมั่นคง">สถานีตำรวจ / ฝ่ายความมั่นคง / กองกำลัง</option>
                    <option value="โรงเรียน/สถานศึกษา">โรงเรียน / สถานศึกษา / สพฐ.</option>
                    <option value="ศูนย์พัฒนาเด็กเล็ก/สังคมสงเคราะห์">ศูนย์พัฒนาเด็กเล็ก / สังคมสงเคราะห์</option>
                    <option value="อำเภอ/จังหวัด/ราชการอื่นๆ">ที่ว่าการอำเภอ / ศาลากลาง / อื่นๆ</option>
                  </select>
                </div>

                <div className="col-span-12 sm:col-span-4">
                  <label className="block font-bold text-slate-700 mb-1">ชื่อผู้แทน / ผู้รับมอบของหน่วยงาน *</label>
                  <input
                    type="text"
                    value={formData.agencyContactPerson || ''}
                    onChange={(e) => handleChange('agencyContactPerson', e.target.value)}
                    placeholder="ชื่อ-นามสกุล ผู้แทนรับมอบ"
                    required
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold"
                  />
                </div>

                <div className="col-span-12 sm:col-span-4">
                  <label className="block font-bold text-slate-700 mb-1">ตำแหน่งในหน่วยงาน</label>
                  <input
                    type="text"
                    value={formData.agencyContactPosition || ''}
                    onChange={(e) => handleChange('agencyContactPosition', e.target.value)}
                    placeholder="เช่น ผอ.รพ.สต., ปลัด, นักสังคมสงเคราะห์"
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                <div className="col-span-12 sm:col-span-4">
                  <label className="block font-bold text-slate-700 mb-1">เบอร์โทรศัพท์ติดต่อ</label>
                  <input
                    type="tel"
                    value={formData.agencyPhone || ''}
                    onChange={(e) => handleChange('agencyPhone', e.target.value)}
                    placeholder="เบอร์โทรผู้แทน/หน่วยงาน"
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>

                <div className="col-span-12 sm:col-span-6">
                  <label className="block font-bold text-slate-700 mb-1">วันที่ส่งมอบ (วัน เดือน พ.ศ.)</label>
                  <ThaiDateInput
                    value={formData.distributionDate || ''}
                    onChange={(val) => handleChange('distributionDate', val)}
                    minYearBE={2560}
                    maxYearBE={new Date().getFullYear() + 543 + 5}
                  />
                </div>

                <div className="col-span-12 sm:col-span-4">
                  <label className="block font-bold text-slate-700 mb-1">เลขที่หนังสือขอความอนุเคราะห์ (ถ้ามี)</label>
                  <input
                    type="text"
                    value={formData.officialLetterNo || ''}
                    onChange={(e) => handleChange('officialLetterNo', e.target.value)}
                    placeholder="เช่น สป 0032/1234"
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>

                <div className="col-span-12 sm:col-span-4">
                  <label className="block font-bold text-slate-700 mb-1">สถานที่ตั้งหน่วยงาน</label>
                  <input
                    type="text"
                    value={formData.agencyAddress || ''}
                    onChange={(e) => handleChange('agencyAddress', e.target.value)}
                    placeholder="ตำบล, อำเภอ, จังหวัด"
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                <div className="col-span-12">
                  <label className="block font-bold text-slate-700 mb-1">
                    วัตถุประสงค์ในการขอรับบริจาคเพื่อนำไปใช้
                  </label>
                  <input
                    type="text"
                    value={formData.agencyRequestPurpose || ''}
                    onChange={(e) => handleChange('agencyRequestPurpose', e.target.value)}
                    placeholder="เช่น นำไปแจกจ่ายประชาชนที่ประสบภัยน้ำท่วมในตำบล, มอบให้ผู้ป่วยยากไร้ในเขตรับผิดชอบ"
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>
            )}
          </div>

          {/* SECTION 3: รายการสิ่งของบริจาค (น้ำ, อาหารแห้ง, ข้าวสาร, แพมเพิส, และอื่นๆ) */}
          <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-amber-200/80 pb-2">
              <h4 className="font-bold text-sm text-amber-950 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-amber-600 text-white flex items-center justify-center text-xs">
                  3
                </span>
                <span>รายการสิ่งของที่บริจาค (น้ำ, อาหารแห้ง, ข้าวสาร, แพมเพิส และอื่นๆ) *</span>
              </h4>
              <span className="text-xs text-amber-800 font-semibold">
                ระบุจำนวนสิ่งของ
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              
              {/* 1. น้ำดื่ม */}
              <div className="p-3 bg-white rounded-xl border border-blue-200 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-blue-900 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                    น้ำดื่มสะอาด
                  </span>
                  <span className="text-[10px] text-blue-600 font-semibold">แพ็ค/ขวด</span>
                </div>
                
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    value={formData.waterPacks ?? 0}
                    onChange={(e) => handleChange('waterPacks', Number(e.target.value))}
                    className="w-full p-2 bg-blue-50/40 border border-blue-300 rounded-lg text-sm font-bold text-blue-900 font-mono"
                  />
                  <span className="font-semibold text-slate-600 shrink-0">แพ็ค</span>
                </div>

                {/* Quick Presets */}
                <div className="flex items-center gap-1 text-[11px] pt-0.5">
                  <span className="text-slate-400">ลัด:</span>
                  {[5, 10, 20, 50, 100].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handleChange('waterPacks', num)}
                      className="px-1.5 py-0.5 bg-slate-100 hover:bg-blue-100 text-slate-700 hover:text-blue-800 rounded font-semibold cursor-pointer"
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. อาหารแห้ง */}
              <div className="p-3 bg-white rounded-xl border border-amber-200 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-900 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                    อาหารแห้ง / ถุงยังชีพ
                  </span>
                  <span className="text-[10px] text-amber-600 font-semibold">ชุด/กล่อง</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    value={formData.dryFoodCount ?? 0}
                    onChange={(e) => handleChange('dryFoodCount', Number(e.target.value))}
                    className="w-full p-2 bg-amber-50/40 border border-amber-300 rounded-lg text-sm font-bold text-amber-900 font-mono"
                  />
                  <span className="font-semibold text-slate-600 shrink-0">ชุด</span>
                </div>

                {/* Quick Presets */}
                <div className="flex items-center gap-1 text-[11px] pt-0.5">
                  <span className="text-slate-400">ลัด:</span>
                  {[2, 5, 10, 20, 50].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handleChange('dryFoodCount', num)}
                      className="px-1.5 py-0.5 bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-800 rounded font-semibold cursor-pointer"
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. ข้าวสาร */}
              <div className="p-3 bg-white rounded-xl border border-emerald-200 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-900 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    ข้าวสาร (5 กก.)
                  </span>
                  <span className="text-[10px] text-emerald-600 font-semibold">
                    {formData.riceKg ? `รวม ${formData.riceKg} กก.` : '5 กก./ถุง'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    value={formData.riceBags ?? 0}
                    onChange={(e) => handleChange('riceBags', Number(e.target.value))}
                    className="w-full p-2 bg-emerald-50/40 border border-emerald-300 rounded-lg text-sm font-bold text-emerald-900 font-mono"
                  />
                  <span className="font-semibold text-slate-600 shrink-0">ถุง</span>
                </div>

                {/* Quick Presets */}
                <div className="flex items-center gap-1 text-[11px] pt-0.5">
                  <span className="text-slate-400">ลัด:</span>
                  {[2, 5, 10, 20, 50].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handleChange('riceBags', num)}
                      className="px-1.5 py-0.5 bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-800 rounded font-semibold cursor-pointer"
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              {/* 4. แพมเพิส */}
              <div className="p-3 bg-white rounded-xl border border-purple-200 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-purple-900 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
                    แพมเพิส / ผ้าอ้อม
                  </span>
                  <select
                    value={formData.diaperSize || 'คละไซส์'}
                    onChange={(e) => handleChange('diaperSize', e.target.value)}
                    className="text-[10.5px] p-0.5 bg-purple-50 border border-purple-200 rounded font-bold text-purple-800"
                  >
                    <option value="คละไซส์">คละไซส์</option>
                    <option value="M">ไซส์ M</option>
                    <option value="L">ไซส์ L</option>
                    <option value="XL">ไซส์ XL</option>
                    <option value="XXL">ไซส์ XXL</option>
                    <option value="แพมเพิสเด็ก">แพมเพิสเด็ก</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    value={formData.diaperPacks ?? 0}
                    onChange={(e) => handleChange('diaperPacks', Number(e.target.value))}
                    className="w-full p-2 bg-purple-50/40 border border-purple-300 rounded-lg text-sm font-bold text-purple-900 font-mono"
                  />
                  <span className="font-semibold text-slate-600 shrink-0">แพ็ค</span>
                </div>

                {/* Quick Presets */}
                <div className="flex items-center gap-1 text-[11px] pt-0.5">
                  <span className="text-slate-400">ลัด:</span>
                  {[0, 1, 2, 4, 10].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handleChange('diaperPacks', num)}
                      className="px-1.5 py-0.5 bg-slate-100 hover:bg-purple-100 text-slate-700 hover:text-purple-800 rounded font-semibold cursor-pointer"
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 5. สิ่งของอื่นๆ เพิ่มเติม (และอื่นๆ) */}
            <div className="pt-2 border-t border-amber-200">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="font-bold text-xs text-slate-900">
                    รายการสิ่งของอื่นๆ เพิ่มเติม (ระบุได้ไม่จำกัด)
                  </span>
                  <p className="text-[11px] text-slate-500">
                    เช่น นมกล่อง, ยาสามัญประจำบ้าน, เสื้อผ้า, ผ้าห่ม, น้ำมันพืช, หน้ากากอนามัย ฯลฯ
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddOtherItem}
                  className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-2xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ เพิ่มรายการสิ่งของอื่นๆ</span>
                </button>
              </div>

              {formData.otherItems && formData.otherItems.length > 0 ? (
                <div className="space-y-2">
                  {formData.otherItems.map((item, idx) => (
                    <div
                      key={item.id}
                      className="p-2.5 bg-white border border-slate-200 rounded-xl flex items-center gap-2 text-xs"
                    >
                      <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold shrink-0">
                        {idx + 1}
                      </span>
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => handleUpdateOtherItem(item.id, 'name', e.target.value)}
                        placeholder="ชื่อสิ่งของ เช่น นมกล่อง, ผ้าห่ม"
                        className="flex-1 p-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold"
                      />
                      <div className="flex items-center gap-1 w-24">
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => handleUpdateOtherItem(item.id, 'quantity', Number(e.target.value))}
                          className="w-full p-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-center font-bold font-mono"
                        />
                      </div>
                      <div className="w-24">
                        <input
                          type="text"
                          value={item.unit}
                          onChange={(e) => handleUpdateOtherItem(item.id, 'unit', e.target.value)}
                          placeholder="หน่วย เช่น ลัง, ผืน"
                          className="w-full p-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-center"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveOtherItem(item.id)}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition cursor-pointer"
                        title="ลบรายการนี้"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 bg-white/60 border border-dashed border-amber-300 rounded-xl text-center text-xs text-slate-500">
                  ยังไม่มีสิ่งของเพิ่มเติม หากมีรายการอื่น เช่น นมกล่อง, ยาสามัญ หรือผ้าห่ม สามารถกดปุ่ม "+ เพิ่มรายการสิ่งของอื่นๆ"
                </div>
              )}
            </div>

            {/* หมายเหตุสิ่งของ */}
            <div className="pt-2">
              <label className="block font-bold text-slate-700 text-xs mb-1">
                หมายเหตุสิ่งของเพิ่มเติม / วัตถุประสงค์เฉพาะ
              </label>
              <input
                type="text"
                value={formData.notes || ''}
                onChange={(e) => handleChange('notes', e.target.value)}
                placeholder="เช่น มอบเป็นกรณีพิเศษเพื่อบรรเทาภัยน้ำท่วม, มอบชุดข้าวสารอาหารแห้งเนื่องในเทศกาล"
                className="w-full p-2 bg-white border border-amber-300 rounded-lg text-xs"
              />
            </div>
          </div>

          {/* SECTION 4: สถานที่, วิธีส่งมอบ, เจ้าหน้าที่ และสถานะ */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs">
                  4
                </span>
                <span>สถานที่ส่งมอบ & เจ้าหน้าที่ผู้ดำเนินการ</span>
              </h4>
              <span className="text-xs text-slate-500">บันทึกการส่งมอบ</span>
            </div>

            <div className="grid grid-cols-12 gap-3 text-xs">
              <div className="col-span-12 sm:col-span-6">
                <label className="block font-bold text-slate-700 mb-1">สถานที่ส่งมอบ</label>
                <input
                  type="text"
                  value={formData.handoverPlace || ''}
                  onChange={(e) => handleChange('handoverPlace', e.target.value)}
                  placeholder="เช่น มูลนิธิร่วมกุศลสมุทรปราการ, ศาลาประชาคมหมู่บ้าน, ที่ว่าการอำเภอ"
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="col-span-12 sm:col-span-6">
                <label className="block font-bold text-slate-700 mb-1">วิธีการส่งมอบ</label>
                <select
                  value={formData.deliveryMethod || 'รับมอบ ณ มูลนิธิร่วมกุศลสมุทรปราการ'}
                  onChange={(e) => handleChange('deliveryMethod', e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold"
                >
                  <option value="รับมอบ ณ มูลนิธิร่วมกุศลสมุทรปราการ">รับมอบ ณ มูลนิธิร่วมกุศลสมุทรปราการ</option>
                  <option value="เจ้าหน้าที่มูลนิธิฯ นำสิ่งของไปส่งมอบ">เจ้าหน้าที่มูลนิธิฯ นำสิ่งของไปส่งมอบถึงสถานที่</option>
                  <option value="ลงพื้นที่ร่วมกับหน่วยงานราชการ">ลงพื้นที่ร่วมกับหน่วยงานราชการ/ผู้นำชุมชน</option>
                </select>
              </div>

              <div className="col-span-12 sm:col-span-4">
                <label className="block font-bold text-slate-700 mb-1">เจ้าหน้าที่ผู้ส่งมอบ</label>
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
                  {ADMIN_USERS.map((admin) => (
                    <option key={admin.id} value={admin.name}>
                      {admin.name} ({admin.roleTitle})
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-12 sm:col-span-4">
                <label className="block font-bold text-slate-700 mb-1">ผู้อนุมัติการมอบสิ่งของ</label>
                <input
                  type="text"
                  disabled
                  value={formData.approverName || 'นางสาวศาตพร ภูมิโคกรักษ์'}
                  className="w-full p-2 bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-600 font-semibold"
                />
              </div>

              <div className="col-span-12 sm:col-span-4">
                <label className="block font-bold text-slate-700 mb-1">สถานะการบริจาค</label>
                <select
                  value={formData.status || 'completed'}
                  onChange={(e) => handleChange('status', e.target.value as DonationStatus)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-bold"
                >
                  <option value="completed">ส่งมอบเรียบร้อยแล้ว (Completed)</option>
                  <option value="pending">รอส่งมอบ / เตรียมนัดหมาย (Pending)</option>
                  <option value="cancelled">ยกเลิกรายการ (Cancelled)</option>
                </select>
              </div>
            </div>
          </div>

          {/* SECTION 5: ภาพถ่ายหลักฐาน และเอกสารแนบ */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-700 text-white flex items-center justify-center text-xs">
                  5
                </span>
                <span>ภาพถ่ายหลักฐานการรับมอบ และเอกสารแนบ</span>
              </h4>
              <span className="text-xs text-slate-500">แนบได้ตามความสะดวก</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              {/* Photos */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-blue-600" />
                    <span>ภาพถ่ายการรับมอบสิ่งของ ({formData.photos?.length || 0})</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg transition flex items-center gap-1 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>+ อัปโหลดรูป</span>
                  </button>
                </div>

                {formData.photos && formData.photos.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    {formData.photos.map((p) => (
                      <div key={p.id} className="relative group rounded-lg overflow-hidden border border-slate-200 aspect-square">
                        <img src={p.dataUrl} alt="หลักฐาน" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(p.id)}
                          className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-md opacity-0 group-hover:opacity-100 transition cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-4 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-lg">
                    ยังไม่มีรูปถ่ายการรับมอบ
                  </div>
                )}
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </div>

              {/* Documents */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-amber-600" />
                    <span>เอกสารแนบ (หนังสือ/สำเนา) ({formData.documents?.length || 0})</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => docInputRef.current?.click()}
                    className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold rounded-lg transition flex items-center gap-1 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>+ แนบไฟล์</span>
                  </button>
                </div>

                {formData.documents && formData.documents.length > 0 ? (
                  <div className="space-y-1.5 pt-1">
                    {formData.documents.map((d) => (
                      <div key={d.id} className="flex items-center justify-between p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                        <div className="truncate max-w-[180px] font-medium text-slate-800">
                          {d.fileName}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveDoc(d.id)}
                          className="text-red-500 hover:text-red-700 p-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-4 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-lg">
                    ยังไม่มีเอกสารแนบ (เช่น หนังสือขอรับบริจาค)
                  </div>
                )}
                <input
                  ref={docInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  multiple
                  onChange={handleDocUpload}
                  className="hidden"
                />
              </div>
            </div>
          </div>

          {/* Form Actions Footer */}
          <div className="border-t border-slate-200 pt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-500 flex items-center gap-2">
              <Gift className="w-4 h-4 text-amber-600" />
              <span>
                ผู้รับ: <b className="text-slate-800">{isIndividual ? (formData.individualName || 'ประชาชนทั่วไป') : (formData.agencyName || 'หน่วยงานราชการ')}</b>
              </span>
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
                <span>บันทึกการบริจาคสิ่งของ</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
