import React, { useState } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import {
  Lock,
  User,
  Key,
  ShieldCheck,
  X,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  UserCheck,
  Cloud,
  RefreshCw,
  LogOut,
  Users,
  Plus,
  Trash2,
  UserPlus,
  Check,
  Clock,
  Server,
  Download,
} from 'lucide-react';
import { ADMIN_USERS, AdminUser, AccessRequestRecord, LanStorageConfig } from '../types';
import { SUPER_ADMIN_EMAIL, isSuperAdminUser } from '../firebase';
import { DEFAULT_LAN_SERVER_URL, downloadStandaloneLanServerScript } from '../services/lanSync';

interface LoginModalProps {
  currentAdmin: AdminUser;
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (admin: AdminUser) => void;
  firebaseUser?: FirebaseUser | null;
  cloudStatus?: 'disconnected' | 'syncing' | 'synced' | 'error';
  cloudErrorReason?: 'permission-denied' | 'network' | null;
  authorizedEmails?: string[];
  onSaveAuthorizedEmails?: (emails: string[]) => Promise<void>;
  onCloudSignIn?: () => void;
  onCloudSignOut?: () => void;
  onManualCloudSync?: () => void;
  myAccessRequest?: AccessRequestRecord | null;
  isSubmittingRequest?: boolean;
  onSubmitAccessRequest?: (note?: string) => Promise<void>;
  pendingAccessRequests?: AccessRequestRecord[];
  onApproveAccessRequest?: (req: AccessRequestRecord) => Promise<void>;
  onRejectAccessRequest?: (req: AccessRequestRecord) => Promise<void>;
  lanConfig?: LanStorageConfig;
  lanStatus?: 'disabled' | 'syncing' | 'connected' | 'error';
  lanStatusInfo?: {
    dataFilePath?: string;
    errorMessage?: string;
    counts?: { patients: number; funerals: number; donations: number };
  } | null;
  onSaveAndSyncLan?: (serverUrl: string, enabled: boolean) => Promise<void>;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  currentAdmin,
  isOpen,
  onClose,
  onLoginSuccess,
  firebaseUser = null,
  cloudStatus = 'disconnected',
  cloudErrorReason = null,
  authorizedEmails = [SUPER_ADMIN_EMAIL],
  onSaveAuthorizedEmails,
  onCloudSignIn,
  onCloudSignOut,
  onManualCloudSync,
  myAccessRequest = null,
  isSubmittingRequest = false,
  onSubmitAccessRequest,
  pendingAccessRequests = [],
  onApproveAccessRequest,
  onRejectAccessRequest,
  lanConfig,
  lanStatus = 'disabled',
  lanStatusInfo = null,
  onSaveAndSyncLan,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [newTeamEmail, setNewTeamEmail] = useState('');
  const [isSavingEmails, setIsSavingEmails] = useState(false);
  const [processingReqUid, setProcessingReqUid] = useState<string | null>(null);
  const [teamMsg, setTeamMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [lanUrlInput, setLanUrlInput] = useState(lanConfig?.serverUrl || DEFAULT_LAN_SERVER_URL);
  const [lanEnabledInput, setLanEnabledInput] = useState<boolean>(Boolean(lanConfig?.enabled));
  const [isSavingLan, setIsSavingLan] = useState(false);

  React.useEffect(() => {
    if (isOpen && lanConfig) {
      setLanUrlInput(lanConfig.serverUrl || DEFAULT_LAN_SERVER_URL);
      setLanEnabledInput(Boolean(lanConfig.enabled));
    }
  }, [isOpen, lanConfig]);

  if (!isOpen) return null;

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const trimmedUser = username.trim().toLowerCase();
    const foundAdmin = ADMIN_USERS.find(
      (u) => u.username.toLowerCase() === trimmedUser && u.password === password
    );

    if (foundAdmin) {
      setSuccessMsg(`ยินดีต้อนรับ ${foundAdmin.name}`);
      setTimeout(() => {
        onLoginSuccess(foundAdmin);
        onClose();
      }, 400);
    } else {
      setErrorMsg('ชื่อผู้ใช้งาน (Username) หรือรหัสผ่าน (Password) ไม่ถูกต้อง');
    }
  };

  const handleQuickSelect = (admin: AdminUser) => {
    setUsername(admin.username);
    setPassword('');
    setErrorMsg('');
  };

  const handleAddTeamEmail = async () => {
    if (!onSaveAuthorizedEmails) return;
    const clean = newTeamEmail.trim().toLowerCase();
    if (!clean || !clean.includes('@') || !clean.includes('.')) {
      setTeamMsg({ type: 'err', text: 'กรุณาระบุอีเมล Google ให้ถูกต้อง เช่น staff@gmail.com' });
      return;
    }
    if (authorizedEmails.includes(clean)) {
      setTeamMsg({ type: 'err', text: 'อีเมลนี้อยู่ในรายการได้รับสิทธิ์แล้ว' });
      return;
    }
    setIsSavingEmails(true);
    setTeamMsg(null);
    try {
      await onSaveAuthorizedEmails([...authorizedEmails, clean]);
      setNewTeamEmail('');
      setTeamMsg({ type: 'ok', text: `เพิ่มสิทธิ์ให้ ${clean} และอัปเดตฐานข้อมูลเรียบร้อยแล้ว` });
    } catch {
      setTeamMsg({ type: 'err', text: 'ไม่สามารถบันทึกสิทธิ์ได้ กรุณาลองใหม่อีกครั้ง' });
    } finally {
      setIsSavingEmails(false);
    }
  };

  const handleRemoveTeamEmail = async (emailToRemove: string) => {
    if (!onSaveAuthorizedEmails) return;
    if (emailToRemove.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) return;
    setIsSavingEmails(true);
    setTeamMsg(null);
    try {
      await onSaveAuthorizedEmails(authorizedEmails.filter((e) => e !== emailToRemove));
      setTeamMsg({ type: 'ok', text: `ยกเลิกสิทธิ์ของ ${emailToRemove} แล้ว` });
    } catch {
      setTeamMsg({ type: 'err', text: 'ไม่สามารถลบสิทธิ์ได้ กรุณาลองใหม่อีกครั้ง' });
    } finally {
      setIsSavingEmails(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">เข้าสู่ระบบเจ้าหน้าที่ & Cloud Firestore</h3>
              <p className="text-xs text-slate-300">
                มูลนิธิร่วมกุศลสมุทรปราการ (北欖天德善堂)
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

        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Firebase Cloud Sync Card */}
          <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/70 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                <Cloud className="w-4 h-4 text-blue-600" />
                <span>ฐานข้อมูลถาวร Cloud Firestore (bd-care-6176a)</span>
              </span>
              {firebaseUser && isSuperAdminUser(firebaseUser) && (
                <span className="text-[10px] font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full border border-amber-300">
                  Super Admin
                </span>
              )}
            </div>

            {firebaseUser ? (
              <div className="space-y-2.5">
                <div className="text-xs text-slate-700 bg-white border border-blue-100 rounded-lg p-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 truncate">
                      {firebaseUser.displayName || 'ผู้ใช้งานระบบ'}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">{firebaseUser.email}</div>
                  </div>
                  <span
                    className={`text-[10.5px] font-bold px-2 py-0.5 rounded shrink-0 ${
                      cloudStatus === 'syncing'
                        ? 'bg-blue-100 text-blue-800'
                        : cloudStatus === 'error'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {cloudStatus === 'syncing'
                      ? 'กำลังซิงค์'
                      : cloudStatus === 'error'
                      ? 'ผิดพลาด'
                      : 'เชื่อมต่อแล้ว'}
                  </span>
                </div>

                {cloudErrorReason === 'permission-denied' && !isSuperAdminUser(firebaseUser) && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-[11.5px] text-red-800 space-y-2">
                    <div className="font-bold flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                      <span>บัญชีนี้ยังไม่ได้รับอนุญาตให้เข้าถึงข้อมูลกลาง</span>
                    </div>
                    <p className="text-red-700 leading-relaxed">
                      สามารถกดส่งคำขอสิทธิ์จากอุปกรณ์นี้เพื่อให้ผู้ดูแลระบบ ({SUPER_ADMIN_EMAIL}) กดอนุมัติได้ทันที หรือสลับไปใช้บัญชีหลักที่ได้รับอนุญาตแล้ว
                    </p>
                    {myAccessRequest?.status === 'pending' ? (
                      <div className="p-2 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 font-semibold flex items-center gap-2">
                        <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>ส่งคำขอสิทธิ์แล้ว กำลังรอผู้ดูแลระบบอนุมัติ (หน้าจอจะโหลดข้อมูลให้อัตโนมัติทันที)</span>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {myAccessRequest?.status === 'rejected' && (
                          <div className="text-[11px] font-semibold text-red-700">
                            คำขอก่อนหน้าถูกปฏิเสธ คุณสามารถกดส่งคำขอใหม่อีกครั้งได้
                          </div>
                        )}
                        {onSubmitAccessRequest && (
                          <button
                            type="button"
                            disabled={isSubmittingRequest}
                            onClick={() => onSubmitAccessRequest()}
                            className="w-full py-2 px-3 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>
                              {isSubmittingRequest ? 'กำลังส่งคำขอ...' : 'ส่งคำขอสิทธิ์เข้าใช้งานทีมงาน'}
                            </span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onManualCloudSync}
                    className="flex-1 py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${cloudStatus === 'syncing' ? 'animate-spin' : ''}`} />
                    <span>ซิงค์ข้อมูลขึ้น Cloud ทันที</span>
                  </button>
                  <button
                    type="button"
                    onClick={onCloudSignOut}
                    className="py-1.5 px-3 bg-white hover:bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>ออก</span>
                  </button>
                </div>

                {/* Super Admin Team Allowlist & Pending Requests for Multi-Device Access */}
                {isSuperAdminUser(firebaseUser) && onSaveAuthorizedEmails && (
                  <div className="mt-2 pt-2.5 border-t border-blue-200/80 space-y-2.5">
                    {pendingAccessRequests.length > 0 && (
                      <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-lg space-y-2">
                        <div className="text-[11px] font-bold text-amber-900 flex items-center gap-1.5">
                          <UserPlus className="w-3.5 h-3.5 text-amber-700" />
                          <span>คำขอสิทธิ์จากอุปกรณ์อื่น ({pendingAccessRequests.length} รายการ)</span>
                        </div>
                        <div className="space-y-1.5 max-h-32 overflow-y-auto">
                          {pendingAccessRequests.map((req) => (
                            <div
                              key={req.uid}
                              className="bg-white border border-amber-200 rounded-lg p-2 flex items-center justify-between gap-2 text-[11px]"
                            >
                              <div className="min-w-0">
                                <div className="font-bold text-slate-900 truncate">
                                  {req.displayName || req.email}
                                </div>
                                <div className="font-mono text-slate-600 truncate">{req.email}</div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {onApproveAccessRequest && (
                                  <button
                                    type="button"
                                    disabled={processingReqUid === req.uid}
                                    onClick={async () => {
                                      setProcessingReqUid(req.uid);
                                      try {
                                        await onApproveAccessRequest(req);
                                      } finally {
                                        setProcessingReqUid(null);
                                      }
                                    }}
                                    className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded font-bold flex items-center gap-1 cursor-pointer"
                                  >
                                    <Check className="w-3 h-3" />
                                    <span>อนุมัติ</span>
                                  </button>
                                )}
                                {onRejectAccessRequest && (
                                  <button
                                    type="button"
                                    disabled={processingReqUid === req.uid}
                                    onClick={async () => {
                                      setProcessingReqUid(req.uid);
                                      try {
                                        await onRejectAccessRequest(req);
                                      } finally {
                                        setProcessingReqUid(null);
                                      }
                                    }}
                                    className="px-2 py-1 bg-white hover:bg-red-50 text-red-600 border border-red-200 rounded font-semibold cursor-pointer"
                                  >
                                    ปฏิเสธ
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="text-[11px] font-bold text-blue-900 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-blue-700" />
                      <span>บัญชี Google ที่ได้รับสิทธิ์ดูและแก้ไขข้อมูลร่วมกันทุกเครื่อง</span>
                    </div>
                    <div className="flex gap-1.5">
                      <input
                        type="email"
                        value={newTeamEmail}
                        onChange={(e) => setNewTeamEmail(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddTeamEmail();
                          }
                        }}
                        placeholder="เพิ่มอีเมล Google เจ้าหน้าที่ เช่น name@gmail.com"
                        className="flex-1 px-2.5 py-1.5 text-xs bg-white border border-blue-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        disabled={isSavingEmails}
                        onClick={handleAddTeamEmail}
                        className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>เพิ่มสิทธิ์</span>
                      </button>
                    </div>
                    {teamMsg && (
                      <div
                        className={`text-[11px] px-2.5 py-1.5 rounded-lg ${
                          teamMsg.type === 'ok'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-red-50 text-red-700 border border-red-200'
                        }`}
                      >
                        {teamMsg.text}
                      </div>
                    )}
                    <div className="space-y-1 max-h-28 overflow-y-auto">
                      {authorizedEmails.map((em) => {
                        const isOwner = em.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
                        return (
                          <div
                            key={em}
                            className="flex items-center justify-between bg-white px-2.5 py-1 rounded border border-blue-100 text-[11px]"
                          >
                            <span className="font-mono text-slate-700 truncate">{em}</span>
                            {isOwner ? (
                              <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded shrink-0">
                                บัญชีหลัก
                              </span>
                            ) : (
                              <button
                                type="button"
                                disabled={isSavingEmails}
                                onClick={() => handleRemoveTeamEmail(em)}
                                className="text-red-500 hover:text-red-700 p-0.5 cursor-pointer"
                                title="ลบสิทธิ์"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-[11.5px] text-slate-600 leading-relaxed">
                  เชื่อมต่อด้วยบัญชี Google เพื่อสำรองและซิงค์ข้อมูลผู้ป่วย คำร้องเผาศพ แผนส่งมอบ และสิ่งของบริจาคทั้งหมดแบบเรียลไทม์ให้เหมือนกันทุกเครื่อง
                </p>
                <button
                  type="button"
                  onClick={onCloudSignIn}
                  className="w-full py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-900 rounded-lg text-xs font-bold shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Cloud className="w-4 h-4 text-blue-600" />
                  <span>เข้าสู่ระบบด้วย Google เพื่อเชื่อมต่อ Cloud</span>
                </button>
              </div>
            )}
          </div>

          {/* Local LAN Server Storage Card (192.168.1.45) */}
          {onSaveAndSyncLan && (
            <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/60 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                  <Server className="w-4 h-4 text-emerald-700" />
                  <span>ที่เก็บข้อมูลเซิร์ฟเวอร์ LAN (192.168.1.45)</span>
                </span>
                <span
                  className={`text-[10.5px] font-bold px-2 py-0.5 rounded shrink-0 ${
                    lanStatus === 'syncing'
                      ? 'bg-blue-100 text-blue-800'
                      : lanStatus === 'connected'
                      ? 'bg-emerald-100 text-emerald-800'
                      : lanStatus === 'error'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {lanStatus === 'syncing'
                    ? 'กำลังซิงค์ LAN...'
                    : lanStatus === 'connected'
                    ? 'เชื่อมต่อ LAN แล้ว'
                    : lanStatus === 'error'
                    ? 'เชื่อมต่อไม่ได้'
                    : 'ยังไม่เปิดใช้งาน'}
                </span>
              </div>

              <div className="space-y-2">
                <div>
                  <label className="block text-[11px] font-semibold text-emerald-900 mb-1">
                    ที่อยู่เซิร์ฟเวอร์ LAN (IP / URL)
                  </label>
                  <input
                    type="text"
                    value={lanUrlInput}
                    onChange={(e) => setLanUrlInput(e.target.value)}
                    placeholder="http://192.168.1.45:3000"
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-emerald-200 rounded-lg font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <label className="flex items-center gap-2 text-xs text-emerald-950 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={lanEnabledInput}
                    onChange={(e) => setLanEnabledInput(e.target.checked)}
                    className="rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="font-semibold">
                    บันทึกและซิงค์ข้อมูลทั้งหมดไปที่เครื่องนี้ (192.168.1.45) อัตโนมัติ
                  </span>
                </label>

                {lanStatusInfo?.dataFilePath && lanStatus === 'connected' && (
                  <div className="p-2 bg-white border border-emerald-200 rounded-lg text-[11px] text-emerald-900 space-y-0.5">
                    <div className="font-semibold">
                      ไฟล์ฐานข้อมูลบนเซิร์ฟเวอร์: <span className="font-mono">{lanStatusInfo.dataFilePath}</span>
                    </div>
                    {lanStatusInfo.counts && (
                      <div className="text-slate-600">
                        ผู้ป่วย {lanStatusInfo.counts.patients} ราย • อนุเคราะห์เผาศพ {lanStatusInfo.counts.funerals} ราย • บริจาคสิ่งของ {lanStatusInfo.counts.donations} ราย
                      </div>
                    )}
                  </div>
                )}

                {lanStatusInfo?.errorMessage && lanStatus === 'error' && (
                  <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-[11px] text-red-800 leading-relaxed">
                    {lanStatusInfo.errorMessage}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={isSavingLan}
                    onClick={async () => {
                      setIsSavingLan(true);
                      try {
                        await onSaveAndSyncLan(lanUrlInput, lanEnabledInput);
                      } finally {
                        setIsSavingLan(false);
                      }
                    }}
                    className="flex-1 min-w-[180px] py-1.5 px-3 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSavingLan || lanStatus === 'syncing' ? 'animate-spin' : ''}`} />
                    <span>บันทึก & ซิงค์กับ 192.168.1.45 ทันที</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadStandaloneLanServerScript()}
                    className="py-1.5 px-3 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    title="ดาวน์โหลดไฟล์ bdcare-lan-server.mjs เพื่อไปรันบนเครื่อง 192.168.1.45 ด้วยคำสั่ง node bdcare-lan-server.mjs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>โหลดตัวเซิร์ฟเวอร์ (.mjs)</span>
                  </button>
                </div>

                <p className="text-[10.5px] text-emerald-800/90 leading-relaxed">
                  วิธีติดตั้งที่เครื่อง 192.168.1.45: ดาวน์โหลดไฟล์ <strong>bdcare-lan-server.mjs</strong> ไปวางบนเครื่อง 192.168.1.45 แล้วรัน{' '}
                  <code className="bg-white/80 px-1 py-0.5 rounded font-mono">node bdcare-lan-server.mjs</code> (ข้อมูลจะถูกเก็บในโฟลเดอร์{' '}
                  <code className="bg-white/80 px-1 py-0.5 rounded font-mono">bdcare-data/bdcare-db.json</code> พร้อมไฟล์สำรองอัตโนมัติ)
                </p>
              </div>
            </div>
          )}

          {/* Currently logged-in status badge */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${currentAdmin.avatarColor}`} />
              <div>
                <span className="text-slate-500">เจ้าหน้าที่ผู้ปฏิบัติงานปัจจุบัน:</span>{' '}
                <span className="font-bold text-slate-900">{currentAdmin.name}</span>
              </div>
            </div>
            <span className="bg-blue-100 text-blue-800 font-semibold px-2 py-0.5 rounded text-[11px]">
              {currentAdmin.roleTitle}
            </span>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-3.5">
            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2 font-semibold">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{successMsg}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                ชื่อผู้ใช้งานเจ้าหน้าที่ (Username)
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="เช่น Kitphiphat03, aleena, muanruethai, sataporn"
                  required
                  className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                รหัสผ่าน (Password)
              </label>
              <div className="relative">
                <Key className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="กรอกรหัสผ่าน"
                  required
                  className="w-full pl-9 pr-10 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition cursor-pointer flex items-center justify-center gap-2"
            >
              <Lock className="w-4 h-4" />
              <span>สลับบัญชีเจ้าหน้าที่</span>
            </button>
          </form>

          {/* Quick Click Staff Credentials Reference */}
          <div className="pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                <span>รายชื่อเจ้าหน้าที่รับคำร้อง & ผู้อนุมัติ (คลิกเพื่อเลือกทันที)</span>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {ADMIN_USERS.map((admin) => (
                <button
                  key={admin.id}
                  type="button"
                  onClick={() => handleQuickSelect(admin)}
                  className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex items-start gap-2 ${
                    username.toLowerCase() === admin.username.toLowerCase()
                      ? 'border-blue-500 bg-blue-50/70 ring-1 ring-blue-500'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 ${admin.avatarColor}`} />
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-slate-900 truncate">{admin.name}</div>
                    <div className="text-[11px] text-blue-700 font-medium truncate">{admin.roleTitle}</div>
                    <div className="text-[10.5px] font-mono text-slate-500 mt-1 flex items-center justify-between gap-2">
                      <span>User: <strong className="text-slate-800">{admin.username}</strong></span>
                      <span className="text-[10px] font-sans text-slate-400">กรอกรหัสผ่าน</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-3 text-right">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-semibold cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};
