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
  ExternalLink,
} from 'lucide-react';
import { ADMIN_USERS, AdminUser, AccessRequestRecord } from '../types';
import {
  SUPER_ADMIN_EMAIL,
  isSuperAdminUser,
  isProviderDisabledError,
  authEmailToUsername,
  createStaffUsernameAccount,
  getAuthSignInErrorMessage,
  firebaseConfig,
} from '../firebase';

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
  onRegisterCreatedStaff?: (uid: string, email: string, displayName: string) => Promise<void>;
  onSwitchUserAccount?: (username: string, password: string) => Promise<void>;
  onCloudSignOut?: () => void;
  onManualCloudSync?: () => void;
  myAccessRequest?: AccessRequestRecord | null;
  isSubmittingRequest?: boolean;
  onSubmitAccessRequest?: (note?: string) => Promise<void>;
  pendingAccessRequests?: AccessRequestRecord[];
  onApproveAccessRequest?: (req: AccessRequestRecord) => Promise<void>;
  onRejectAccessRequest?: (req: AccessRequestRecord) => Promise<void>;
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
  onRegisterCreatedStaff,
  onSwitchUserAccount,
  onCloudSignOut,
  onManualCloudSync,
  myAccessRequest = null,
  isSubmittingRequest = false,
  onSubmitAccessRequest,
  pendingAccessRequests = [],
  onApproveAccessRequest,
  onRejectAccessRequest,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Admin: create additional staff Username + Password account
  const [newStaffUsername, setNewStaffUsername] = useState('');
  const [newStaffPassword, setNewStaffPassword] = useState('');
  const [newStaffName, setNewStaffName] = useState('');
  const [isSavingStaff, setIsSavingStaff] = useState(false);
  const [processingReqUid, setProcessingReqUid] = useState<string | null>(null);
  const [teamMsg, setTeamMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [showProviderLink, setShowProviderLink] = useState(false);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const cleanUser = username.trim();
    if (!cleanUser || !password) {
      setErrorMsg('กรุณากรอกชื่อผู้ใช้งาน (Username) และรหัสผ่าน (Password)');
      return;
    }

    setIsLoggingIn(true);
    setShowProviderLink(false);
    try {
      if (onSwitchUserAccount) {
        await onSwitchUserAccount(cleanUser, password);
        setSuccessMsg(`เข้าสู่ระบบด้วยบัญชี ${cleanUser} สำเร็จ`);
        setPassword('');
        setTimeout(() => {
          onClose();
        }, 350);
      } else {
        const trimmedUser = cleanUser.toLowerCase();
        const foundAdmin = ADMIN_USERS.find(
          (u) => u.username.toLowerCase() === trimmedUser && u.password === password
        );
        if (foundAdmin) {
          setSuccessMsg(`ยินดีต้อนรับ ${foundAdmin.name}`);
          setTimeout(() => {
            onLoginSuccess(foundAdmin);
            onClose();
          }, 350);
        } else {
          setErrorMsg('ชื่อผู้ใช้งาน (Username) หรือรหัสผ่าน (Password) ไม่ถูกต้อง');
        }
      }
    } catch (err: any) {
      setShowProviderLink(isProviderDisabledError(err));
      setErrorMsg(getAuthSignInErrorMessage(err));
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleQuickSelect = (admin: AdminUser) => {
    setUsername(admin.username);
    setPassword('');
    setErrorMsg('');
    setSuccessMsg('');
  };

  const handleCreateStaffUser = async () => {
    if (!onSaveAuthorizedEmails) return;
    const cleanUser = newStaffUsername.trim();
    if (!/^[a-zA-Z0-9._-]{3,40}$/.test(cleanUser)) {
      setTeamMsg({
        type: 'err',
        text: 'Username ต้องเป็นภาษาอังกฤษ ตัวเลข หรือ . _ - (3-40 ตัวอักษร)',
      });
      return;
    }
    if (!newStaffPassword || newStaffPassword.length < 6) {
      setTeamMsg({ type: 'err', text: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' });
      return;
    }

    setIsSavingStaff(true);
    setTeamMsg(null);
    try {
      const created = await createStaffUsernameAccount(
        cleanUser,
        newStaffPassword,
        newStaffName || cleanUser
      );
      if (onRegisterCreatedStaff) {
        await onRegisterCreatedStaff(created.uid, created.email, created.displayName);
      } else {
        await onSaveAuthorizedEmails([...authorizedEmails, created.email]);
      }
      setNewStaffUsername('');
      setNewStaffPassword('');
      setNewStaffName('');
      setTeamMsg({
        type: 'ok',
        text: `สร้างบัญชี Username: ${cleanUser} และเปิดสิทธิ์บน ${firebaseConfig.projectId} เรียบร้อยแล้ว`,
      });
    } catch (err: any) {
      setShowProviderLink(isProviderDisabledError(err));
      const code = String(err?.code || '');
      if (code === 'auth/email-already-in-use') {
        setTeamMsg({ type: 'err', text: `Username "${cleanUser}" มีอยู่ในระบบแล้ว` });
      } else {
        setTeamMsg({
          type: 'err',
          text: isProviderDisabledError(err) ? getAuthSignInErrorMessage(err) : (err?.message || getAuthSignInErrorMessage(err)),
        });
      }
    } finally {
      setIsSavingStaff(false);
    }
  };

  const handleRemoveTeamAccount = async (emailToRemove: string) => {
    if (!onSaveAuthorizedEmails) return;
    if (emailToRemove.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) return;
    setIsSavingStaff(true);
    setTeamMsg(null);
    try {
      await onSaveAuthorizedEmails(authorizedEmails.filter((e) => e !== emailToRemove));
      setTeamMsg({
        type: 'ok',
        text: `ยกเลิกสิทธิ์ของ ${authEmailToUsername(emailToRemove)} แล้ว`,
      });
    } catch {
      setTeamMsg({ type: 'err', text: 'ไม่สามารถยกเลิกสิทธิ์ได้ กรุณาลองใหม่อีกครั้ง' });
    } finally {
      setIsSavingStaff(false);
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
              <h3 className="font-bold text-base text-white">
                เข้าสู่ระบบเจ้าหน้าที่ & Cloud Firestore
              </h3>
              <p className="text-xs text-slate-300">
                มูลนิธิร่วมกุศลสมุทรปราการ (北欖天德善堂) • เฉพาะ Username & Password
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
                <span>ฐานข้อมูลถาวร Cloud Firestore ({firebaseConfig.projectId})</span>
              </span>
              {firebaseUser && isSuperAdminUser(firebaseUser) && (
                <span className="text-[10px] font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full border border-amber-300">
                  Admin หลัก
                </span>
              )}
            </div>

            {firebaseUser ? (
              <div className="space-y-2.5">
                <div className="text-xs text-slate-700 bg-white border border-blue-100 rounded-lg p-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 truncate">{currentAdmin.name}</div>
                    <div className="text-[11px] font-mono text-slate-500 truncate">
                      Username: {authEmailToUsername(firebaseUser.email)}
                    </div>
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
                    {myAccessRequest?.status === 'pending' ? (
                      <div className="p-2 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 font-semibold flex items-center gap-2">
                        <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>ส่งคำขอสิทธิ์แล้ว กำลังรอผู้ดูแลระบบอนุมัติ</span>
                      </div>
                    ) : (
                      onSubmitAccessRequest && (
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
                      )
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onManualCloudSync}
                    className="flex-1 py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${cloudStatus === 'syncing' ? 'animate-spin' : ''}`}
                    />
                    <span>ซิงค์ข้อมูลกับ Cloud ทันที</span>
                  </button>
                  {onCloudSignOut && (
                    <button
                      type="button"
                      onClick={() => {
                        onCloudSignOut();
                        onClose();
                      }}
                      className="py-1.5 px-3 bg-white hover:bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>ออกจากระบบ</span>
                    </button>
                  )}
                </div>

                {/* Primary Admin: Add & Manage Username/Password Team Accounts */}
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
                                  {req.displayName || authEmailToUsername(req.email)}
                                </div>
                                <div className="font-mono text-slate-600 truncate">
                                  @{authEmailToUsername(req.email)}
                                </div>
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
                      <span>สร้างบัญชีผู้ใช้งานใหม่ (Username & Password)</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                      <input
                        type="text"
                        value={newStaffUsername}
                        onChange={(e) => setNewStaffUsername(e.target.value)}
                        placeholder="Username (อังกฤษ)"
                        className="px-2.5 py-1.5 text-xs bg-white border border-blue-200 rounded-lg font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <input
                        type="password"
                        value={newStaffPassword}
                        onChange={(e) => setNewStaffPassword(e.target.value)}
                        placeholder="รหัสผ่าน (>= 6 ตัว)"
                        className="px-2.5 py-1.5 text-xs bg-white border border-blue-200 rounded-lg font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <input
                        type="text"
                        value={newStaffName}
                        onChange={(e) => setNewStaffName(e.target.value)}
                        placeholder="ชื่อ-สกุลเจ้าหน้าที่"
                        className="px-2.5 py-1.5 text-xs bg-white border border-blue-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={isSavingStaff}
                      onClick={handleCreateStaffUser}
                      className="w-full py-1.5 px-3 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{isSavingStaff ? 'กำลังสร้างบัญชี...' : 'เพิ่มบัญชี Username & Password'}</span>
                    </button>

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
                        const uName = authEmailToUsername(em);
                        const isPreset = ADMIN_USERS.some(
                          (u) => u.username.toLowerCase() === uName.toLowerCase()
                        );
                        return (
                          <div
                            key={em}
                            className="flex items-center justify-between bg-white px-2.5 py-1 rounded border border-blue-100 text-[11px]"
                          >
                            <span className="font-mono text-slate-700 truncate">@{uName}</span>
                            {isOwner ? (
                              <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded shrink-0">
                                Admin หลัก
                              </span>
                            ) : isPreset ? (
                              <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded shrink-0">
                                เจ้าหน้าที่หลัก
                              </span>
                            ) : (
                              <button
                                type="button"
                                disabled={isSavingStaff}
                                onClick={() => handleRemoveTeamAccount(em)}
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
              <div className="text-[11.5px] text-slate-600 leading-relaxed">
                กรุณาเข้าสู่ระบบด้วย Username และ Password ด้านล่าง เพื่อเชื่อมต่อฐานข้อมูล {firebaseConfig.projectId}
              </div>
            )}
          </div>

          {/* Login Form (Username + Password ONLY) */}
          <form onSubmit={handleLogin} className="space-y-3.5">
            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-start gap-2 leading-relaxed">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {showProviderLink && (
              <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-950 text-xs space-y-1.5 leading-relaxed">
                <div className="font-bold text-amber-900">
                  กรุณาเปิดใช้งาน Email/Password ใน Firebase Console ({firebaseConfig.projectId})
                </div>
                <a
                  href={`https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/providers`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-bold text-blue-700 hover:text-blue-900 underline"
                >
                  <span>เปิดหน้า Authentication &rarr; Sign-in method</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
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
              disabled={isLoggingIn}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition cursor-pointer flex items-center justify-center gap-2"
            >
              <Lock className="w-4 h-4" />
              <span>{isLoggingIn ? 'กำลังตรวจสอบ...' : 'เข้าสู่ระบบด้วย Username & Password'}</span>
            </button>
          </form>

          {/* Staff Directory Reference (Username ONLY - No Passwords Shown) */}
          <div className="pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                <span>รายชื่อเจ้าหน้าที่ (คลิกเพื่อใส่ Username แล้วกรอกรหัสผ่าน)</span>
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
                    <div className="text-[11px] text-blue-700 font-medium truncate">
                      {admin.roleTitle}
                    </div>
                    <div className="text-[10.5px] font-mono text-slate-500 mt-1 flex items-center justify-between gap-2">
                      <span>
                        User: <strong className="text-slate-800">{admin.username}</strong>
                      </span>
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
