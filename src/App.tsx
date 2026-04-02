/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, createContext, useContext, Component, ReactNode } from 'react';
import {
  onAuthStateChanged,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  User as FirebaseUser
} from 'firebase/auth';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  getDoc,
  setDoc,
  getDocs,
  getDocFromServer
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import {
  LogOut,
  PlusCircle,
  ClipboardList,
  CheckCircle,
  Clock,
  AlertCircle,
  User as UserIcon,
  ShieldCheck,
  ChevronRight,
  Loader2,
  Zap,
  Upload,
  Image as ImageIcon,
  FileText,
  Eye,
  Bell,
  Download,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster, toast } from 'sonner';
import { VALID_USERS } from './data';

// --- Sticker Gallery ---33333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333
const STICKER_EMOJIS = [
  { id: '1', emoji: '😊', name: 'ยิม' },
  { id: '2', emoji: '🎉', name: 'เฉลิม' },
  { id: '3', emoji: '⭐', name: 'ดาว' },
  { id: '4', emoji: '💚', name: 'หัวใจ' },
  { id: '5', emoji: '🎁', name: 'ของขวัญ' },
  { id: '6', emoji: '🔥', name: 'ไฟ' },
  { id: '7', emoji: '🌈', name: 'รุ้ง' },
  { id: '8', emoji: '✨', name: 'วิหวา' },
];

const BANK_LOGOS: Record<string, React.ReactNode> = {
  'ธนาคารกรุงเทพ': (
    <div className="w-10 h-10 rounded-full bg-[#752476] flex items-center justify-center text-white font-black">BB</div>
  ),
  'ธนาคารกสิกรไทย': (
    <div className="w-10 h-10 rounded-full bg-[#03A650] flex items-center justify-center text-white font-black">K</div>
  ),
  'ธนาคารไทยพาณิชย์': (
    <div className="w-10 h-10 rounded-full bg-[#D82E5F] flex items-center justify-center text-white font-black">SCB</div>
  ),
  'ธนาคารกรุงไทย': (
    <div className="w-10 h-10 rounded-full bg-[#1A86A8] flex items-center justify-center text-white font-black">KTB</div>
  ),
  'ธนาคารทหารไทย': (
    <div className="w-10 h-10 rounded-full bg-[#0070B9] flex items-center justify-center text-white font-black">TTB</div>
  ),
  'ธนาคารออมสิน': (
    <div className="w-10 h-10 rounded-full bg-[#F29F05] flex items-center justify-center text-white font-black">GSB</div>
  ),
  'ธนาคารกรุงศรีอยุธยา': (
    <div className="w-10 h-10 rounded-full bg-[#ff3333] flex items-center justify-center text-white font-black">BAY</div>
  ),
  'ธนาคารกรุงศรี': (
    <div className="w-10 h-10 rounded-full bg-[#ff3333] flex items-center justify-center text-white font-black">BAY</div>
  ),
  'ธนาคารยูโอบี': (
    <div className="w-10 h-10 rounded-full bg-[#0066af] flex items-center justify-center text-white font-black">UOB</div>
  ),
  'ธนาคารธนชาติ': (
    <div className="w-10 h-10 rounded-full bg-[#0099d9] flex items-center justify-center text-white font-black">TNC</div>
  )
};

const getBankLogo = (name: string) => {
  const normalized = name.trim();
  return BANK_LOGOS[normalized] || (
    <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-gray-700 font-black">🏦</div>
  );
};

// --- Types ---
type AppRole = 'admin' | 'accounting' | 'meter-user';

interface AppUser {
  uid: string;
  displayName: string;
  email?: string | null;
  role: AppRole;
  verified?: boolean; // meter-user needs admin/accounting approval
}

interface UserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  role: 'user' | 'admin';
  createdAt: string;
}

interface MeterRegistrationData {
  fullName: string;
  phone: string;
  address: string;
  bankName: string;
  bankAccountNumber: string;
  idCardNumber: string;
  electricityBillImage: string;
  bankBookImage: string;
  idCardImage: string;
}

interface MeterRegistration extends MeterRegistrationData {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  approvedAt?: string;
  approvedBy?: string;
  rejectionReason?: string;
  otpCode?: string;
  otpExpire?: number;
  otpVerified?: boolean;
}

interface AuditLog {
  id: string;
  registrationId: string;
  action: 'created' | 'approved' | 'rejected' | 'otp_sent' | 'otp_verified' | 'login_attempt';
  performedBy: string;
  timestamp: string;
  details: Record<string, any>;
  ipAddress?: string;
}

interface Sticker {
  id: string;
  emoji: string;
  x: number;
  y: number;
}

interface RefundRequest {
  [x: string]: string | undefined;
  id: string;
  uid: string;
  meterNumber: string;
  accountNumber: string;
  fullName: string;
  idCardNumber: string;
  bankName: string;
  bankAccountNumber: string;
  idCardImage?: string;
  electricityBillImage?: string;
  bankBookImage?: string;
  status: 'pending' | 'processing' | 'approved' | 'rejected' | 'completed';
  comment?: string;
  createdAt: string;
  updatedAt: string;
}

// --- Context ---
interface AuthContextType {
  user: AppUser | null;
  firebaseUser: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdminOrAccounting: boolean;
  loginLocal: (role: 'admin' | 'accounting', employee?: any) => Promise<void>;
  loginMeter: (phone: string, idCardNumber: string) => Promise<void>;
  registerMeter: (data: MeterRegistrationData) => Promise<void>;
  logout: () => Promise<void>;
  toggleRole: () => Promise<void>;
  approveRegistration: (id: string, data: MeterRegistration, approverName: string) => Promise<void>;
  rejectRegistration: (id: string, data: MeterRegistration, rejecterName: string, reason: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

// --- Utility Functions ---

const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const sendEmailNotification = async (
  email: string,
  type: 'approval' | 'rejection' | 'otp' | 'completed',
  data: Record<string, any>
): Promise<void> => {
  try {
    const emailContent = {
      approval: `
        สวัสดี ${data.fullName}
        
        ยินดีด้วย! คำขอลงทะเบียนของคุณได้รับการอนุมัติแล้ว ✅
        
        เบอร์โทรศัพท์: ${data.phone}
        หมายเลขบัตรประชาชน: ${data.idCardNumber}
        
        ขั้นตอนถัดไป:
        1. เข้าสู่ระบบด้วยเบอร์และเลขบัตรประชาชน
        2. เริ่มใช้งานระบบขอคืนเงินประกันทันใจ
        
        --
        ระบบขอคืนเงินประกันมิเตอร์ไฟฟ้า
      `,
      rejection: `
        สวัสดี ${data.fullName}
        
        ขออภัยครับ คำขอลงทะเบียนของคุณได้รับการปฏิเสธ ❌
        
        เหตุผล: ${data.reason || 'ข้อมูลไม่ครบถ้วน'}
        
        โปรดติดต่อฝ่ายบัญชี เพื่อตรวจสอบเพิ่มเติม
        
        --
        ระบบขอคืนเงินประกันมิเตอร์ไฟฟ้า
      `,
      otp: `
        รหัส OTP ของคุณ: ${data.otp}
        
        รหัสนี้จะหมดอายุใน 10 นาที
        
        ไม่ใช่คุณ? โปรดเพิกเฉยต่อข้อความนี้
      `,
      completed: `
        สวัสดี ${data.fullName}
        
        คำขอคืนเงินประกันของคุณได้รับการดำเนินการเสร็จสิ้นแล้ว ✅
        
        กรุณาตรวจสอบบัญชีธนาคารของคุณ
        
        หากมีข้อสงสัย โปรดติดต่อฝ่ายบัญชี
        
        --
        ระบบขอคืนเงินประกันมิเตอร์ไฟฟ้า
      `
    };

    console.log(`[✉️ Email Simulation] To: ${email}\n${emailContent[type]}`);

    // In production, use Firebase Admin SDK or 3rd party like SendGrid
    // await fetch('/api/send-email', { method: 'POST', body: JSON.stringify({...}) })
  } catch (error) {
    console.error('Email notification failed:', error);
  }
};

const createAuditLog = async (
  registrationId: string,
  action: string,
  details: Record<string, any>,
  performedBy: string
): Promise<void> => {
  try {
    const auditEntry: AuditLog = {
      id: `audit-${Date.now()}`,
      registrationId,
      action: action as any,
      performedBy,
      timestamp: new Date().toISOString(),
      details,
      ipAddress: 'N/A' // In real app, get from request
    };

    await addDoc(collection(db, 'auditLogs'), auditEntry);
    console.log('Audit logged:', auditEntry);
  } catch (error) {
    console.error('Audit logging failed:', error);
  }
};

// --- Floating Decorations ---
const FloatingStickers = ({ count = 3 }: { count?: number }) => {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      {Array.from({ length: count }).map((_, i) => {
        const sticker = STICKER_EMOJIS[i % STICKER_EMOJIS.length];
        const delay = i * 0.3;
        return (
          <motion.div
            key={i}
            className="absolute text-4xl sm:text-5xl"
            animate={{
              y: [0, -30, 0],
              x: [0, 10, 0],
              rotate: [0, 10, -10, 0]
            }}
            transition={{
              duration: 4,
              delay,
              repeat: Infinity
            }}
            style={{
              left: `${20 + i * 25}%`,
              top: `${10 + i * 15}%`,
              opacity: 0.2
            }}
          >
            {sticker.emoji}
          </motion.div>
        );
      })}
    </div>
  );
};

// --- Sticker Gallery Component ---
const StickerGallery = ({ onSelect, maxStickers = 5, stickersAdded = 0 }: { onSelect: (sticker: string) => void; maxStickers?: number; stickersAdded?: number }) => {
  return (
    <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl p-4 border-2 border-purple-100">
      <p className="text-sm sm:text-base font-black text-purple-700 mb-3 block">✨ เพิ่มสติก บูติก ({stickersAdded}/{maxStickers})</p>
      <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
        {STICKER_EMOJIS.map(sticker => (
          <motion.button
            key={sticker.id}
            onClick={() => stickersAdded < maxStickers && onSelect(sticker.emoji)}
            className={`text-2xl sm:text-3xl p-2 rounded-lg transition transform hover:scale-125 ${stickersAdded >= maxStickers ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white'
              }`}
            whileHover={stickersAdded < maxStickers ? { scale: 1.3 } : {}}
            title={sticker.name}
            disabled={stickersAdded >= maxStickers}
          >
            {sticker.emoji}
          </motion.button>
        ))}
      </div>
    </div>
  );
};

// --- Error Boundary ---

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Something went wrong.";
      try {
        const parsedError = JSON.parse(this.state.error.message);
        errorMessage = `Firestore Error: ${parsedError.error} (${parsedError.operationType} at ${parsedError.path})`;
      } catch (e) {
        errorMessage = this.state.error.message || errorMessage;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
          <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Application Error</h2>
            <p className="text-gray-600 mb-6">{errorMessage}</p>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- Image Compression Helper ---
const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        // Compress to JPEG with 0.7 quality to keep it small
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        resolve(dataUrl);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

// --- Image Viewer Modal ---
const ImageViewer = ({ imageUrl, onClose }: { imageUrl: string; onClose: () => void }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="relative max-w-5xl w-full max-h-[90vh] flex items-center justify-center"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute -top-12 right-0 text-white hover:text-purple-400 transition-colors"
        >
          <X className="w-10 h-10" />
        </button>
        <img
          src={imageUrl}
          alt="Full View"
          className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl"
          referrerPolicy="no-referrer"
        />
      </motion.div>
    </motion.div>
  );
};

// --- Notification Listener ---
const NotificationListener = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const path = 'refundRequests';
    const q = query(collection(db, path), where('uid', '==', user.uid));

    // We only want to notify for updates, not initial load
    let isInitialLoad = true;

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (isInitialLoad) {
        isInitialLoad = false;
        return;
      }

      snapshot.docChanges().forEach((change) => {
        if (change.type === 'modified') {
          const data = change.doc.data() as RefundRequest;
          toast.success(`คำขอของคุณได้รับการอัปเดตสถานะเป็น: ${data.status}`, {
            description: `หมายเลขมิเตอร์: ${data.meterNumber}`,
            duration: 5000,
            icon: <Bell className="w-5 h-5 text-purple-600" />,
            style: {
              borderRadius: '1.5rem',
              padding: '1.5rem',
              border: '2px solid #f3e8ff',
              fontFamily: 'Prompt, sans-serif'
            }
          });
        }
      });
    });

    return () => unsubscribe();
  }, [user]);

  return null;
};

// --- Components ---

const Navbar = ({ onBack }: { onBack?: () => void }) => {
  const { user, isAdminOrAccounting, logout, toggleRole } = useAuth();

  const isTestUser = user?.uid === 'admin' || user?.uid === 'accounting' || user?.email === 'tirawat.p.aescon@gmail.com';

  return (
    <nav className="bg-white/90 backdrop-blur-md border-b border-purple-50 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20 items-center">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="hidden xs:flex items-center justify-center w-10 h-10 rounded-lg hover:bg-purple-100 text-purple-600 transition-all"
                title="ย้อนกลับ"
              >
                <ChevronRight className="w-6 h-6 transform rotate-180" />
              </button>
            )}
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-purple-200">
              <Zap className="w-7 h-7" />
            </div>
            <span className="text-xl xs:text-2xl font-black bg-gradient-to-r from-purple-700 to-indigo-700 bg-clip-text text-transparent block">เงินประกันทันใจ</span>
          </div>

          {user && (
            <div className="flex items-center gap-4">
              {isTestUser && (
                <button
                  onClick={toggleRole}
                  className="hidden md:flex items-center gap-2 px-4 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl text-sm font-black transition-all border border-purple-100"
                >
                  <ShieldCheck className="w-5 h-5" />
                  SWITCH ROLE
                </button>
              )}
              <div className="flex flex-col items-end">
                <span className="text-base sm:text-lg font-black text-gray-900 leading-none mb-1.5">{user?.displayName?.split(' ')[0]}</span>
                <span className={`text-xs sm:text-sm px-3 sm:px-4 py-1 sm:py-1.5 rounded-full font-black uppercase tracking-tight flex items-center gap-2 ${user?.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                  user?.role === 'accounting' ? 'bg-blue-100 text-blue-700' :
                    'bg-indigo-100 text-indigo-700'
                  }`}>
                  {user?.role === 'admin' && <ShieldCheck className="w-4 h-4" />}
                  {user?.role === 'accounting' && <FileText className="w-4 h-4" />}
                  {user?.role === 'meter-user' && <Zap className="w-4 h-4" />}
                  {user?.role === 'admin' ? 'ADMIN' : user?.role === 'accounting' ? 'บัญชี' : 'ผู้ใช้ไฟฟ้า'}
                </span>
              </div>
              <button
                onClick={logout}
                className="p-3 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all border border-transparent hover:border-red-100"
                title="Sign Out"
              >
                <LogOut className="w-6 h-6" />
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

const Login = ({ onBackClick }: { onBackClick?: () => void }) => {
  const { loginLocal, loginMeter, registerMeter } = useAuth();
  const [viewMode, setViewMode] = useState<'admin' | 'accounting' | 'meter'>('admin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginRole, setLoginRole] = useState<'admin' | 'accounting' | null>(null);

  const [meterLoginPhone, setMeterLoginPhone] = useState('');
  const [meterLoginIdCard, setMeterLoginIdCard] = useState('');

  const [registerData, setRegisterData] = useState<MeterRegistrationData>({
    fullName: '',
    phone: '',
    address: '',
    bankName: '',
    bankAccountNumber: '',
    idCardNumber: '',
    electricityBillImage: '',
    bankBookImage: '',
    idCardImage: ''
  });

  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve(reader.result as string);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const onRegisterFileChange = async (event: React.ChangeEvent<HTMLInputElement>, key: keyof MeterRegistrationData) => {
    if (!event.target.files?.[0]) return;
    const file = event.target.files[0];
    const base64 = await convertFileToBase64(file);
    setRegisterData(prev => ({ ...prev, [key]: base64 }));
  };

  const handleLocalLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);

    // Validate input
    if (!username.trim() || !password) {
      setError('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
      return;
    }

    setLoading(true);
    try {
      // Verify against employee list
      const { findEmployeeByUsername } = await import('./employees');
      const employee = findEmployeeByUsername(username.trim());

      if (!employee || employee.password !== password) {
        setError('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
        setLoading(false);
        return;
      }

      // Check employee status
      if (employee.status !== 'active') {
        setError('บัญชีนี้ถูกปิดใช้งาน');
        setLoading(false);
        return;
      }

      setLoginRole(viewMode === 'admin' ? 'admin' : 'accounting');
      await loginLocal(viewMode === 'admin' ? 'admin' : 'accounting', employee);
    } catch (err) {
      setError('ไม่สามารถเข้าสู่ระบบได้ ลองอีกครั้ง');
    } finally {
      setLoading(false);
    }
  };

  const handleMeterLogin = async () => {
    setError(null);
    if (!meterLoginPhone || !meterLoginIdCard) {
      setError('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    setLoading(true);
    try {
      await loginMeter(meterLoginPhone.trim(), meterLoginIdCard.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ไม่สามารถเข้าสู่ระบบได้');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setError(null);

    // ตรวจสอบข้อมูลพื้นฐาน
    if (!registerData.fullName.trim()) {
      setError('กรุณากรอกชื่อ-นามสกุล');
      return;
    }

    if (!registerData.phone.trim() || !/^[0-9]{10}$/.test(registerData.phone.trim())) {
      setError('กรุณากรอกเบอร์โทรศัพท์ 10 หลัก (ตัวเลขเท่านั้น)');
      return;
    }

    if (!registerData.address.trim()) {
      setError('กรุณากรอกที่อยู่');
      return;
    }

    if (!registerData.bankName.trim()) {
      setError('กรุณากรอกชื่อธนาคาร');
      return;
    }

    if (!registerData.bankAccountNumber.trim() || !/^[0-9]{10,15}$/.test(registerData.bankAccountNumber.trim())) {
      setError('กรุณากรอกเลขบัญชีธนาคาร 10-15 หลัก (ตัวเลขเท่านั้น)');
      return;
    }

    if (!registerData.idCardNumber.trim() || !/^[0-9]{13}$/.test(registerData.idCardNumber.trim())) {
      setError('กรุณากรอกเลขบัตรประชาชน 13 หลัก (ตัวเลขเท่านั้น)');
      return;
    }

    // ตรวจสอบรูปภาพ
    if (!registerData.electricityBillImage) {
      setError('กรุณาแนบรูปใบแจ้งหนี้ไฟฟ้า');
      return;
    }

    if (!registerData.bankBookImage) {
      setError('กรุณาแนบรูปสมุดบัญชี');
      return;
    }

    if (!registerData.idCardImage) {
      setError('กรุณาแนบรูปบัตรประชาชน');
      return;
    }

    setLoading(true);
    try {
      await registerMeter(registerData);
      setError(null);
      toast.success('ลงทะเบียนผู้ใช้ไฟฟ้าสำเร็จ กรุณารอการยืนยัน');
      setRegisterData({
        fullName: '',
        phone: '',
        address: '',
        bankName: '',
        bankAccountNumber: '',
        idCardNumber: '',
        electricityBillImage: '',
        bankBookImage: '',
        idCardImage: ''
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'ลงทะเบียนผู้ใช้ไฟฟ้าล้มเหลว กรุณาลองใหม่อีกครั้ง';
      setError(errorMessage);
      console.error('Registration error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] bg-gradient-to-br from-purple-50 via-white to-indigo-50 flex items-center justify-center p-3 sm:p-6">
      <FloatingStickers count={2} />
      <div className="w-full max-w-2xl relative z-10">
        {onBackClick && (
          <motion.button
            onClick={onBackClick}
            className="flex items-center gap-2 mb-6 text-purple-600 hover:text-purple-700 font-black text-sm sm:text-base"
            whileHover={{ x: -4 }}
          >
            <ChevronRight className="w-5 h-5 transform rotate-180" />
            <span>ย้อนกลับ</span>
          </motion.button>
        )}
        {/* Logo Header */}
        <div className="text-center mb-6 sm:mb-10">
          <div className="inline-block bg-gradient-to-br from-purple-500 to-indigo-600 rounded-[2rem] p-3 sm:p-4 mb-3 sm:mb-4 shadow-2xl">
            <Zap className="w-8 sm:w-10 h-8 sm:h-10 text-white" />
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-gray-900">เงินประกันทันใจ</h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-2">ระบบขอคืนเงินประกันมิเตอร์ไฟฟ้า ง่าย รวดเร็ว และปลอดภัย</p>
        </div>

        {/* Role Selector */}
        <div className="flex justify-center gap-2 sm:gap-3 mb-6 sm:mb-8 flex-wrap">
          <button
            onClick={() => { setViewMode('admin'); setError(null); }}
            className={`flex items-center gap-2 px-3 sm:px-6 py-2 sm:py-3 rounded-lg sm:rounded-xl font-black text-sm sm:text-base transition ${viewMode === 'admin'
              ? 'bg-purple-600 text-white shadow-lg'
              : 'bg-white text-purple-600 border-2 border-purple-200'
              }`}
          >
            👨‍💼 <span className="hidden sm:inline">Admin</span>
          </button>
          <button
            onClick={() => { setViewMode('accounting'); setError(null); }}
            className={`flex items-center gap-2 px-3 sm:px-6 py-2 sm:py-3 rounded-lg sm:rounded-xl font-black text-sm sm:text-base transition ${viewMode === 'accounting'
              ? 'bg-purple-600 text-white shadow-lg'
              : 'bg-white text-purple-600 border-2 border-purple-200'
              }`}
          >
            💼 <span className="hidden sm:inline">ฝ่ายบัญชี</span>
          </button>
          <button
            onClick={() => { setViewMode('meter'); setError(null); }}
            className={`flex items-center gap-2 px-3 sm:px-6 py-2 sm:py-3 rounded-lg sm:rounded-xl font-black text-sm sm:text-base transition ${viewMode === 'meter'
              ? 'bg-indigo-600 text-white shadow-lg'
              : 'bg-white text-indigo-600 border-2 border-indigo-200'
              }`}
          >
            ⚡ <span className="hidden sm:inline">ผู้ใช้ไฟฟ้า</span>
          </button>
        </div>

        {/* Form Container */}
        <motion.div
          key={viewMode}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/95 backdrop-blur-xl rounded-xl sm:rounded-[2rem] border-2 border-purple-100 shadow-2xl p-6 sm:p-10"
        >
          {error && (
            <div className="mb-6 p-3 sm:p-4 bg-red-50 border-2 border-red-200 rounded-xl text-red-700 font-black text-xs sm:text-sm">
              ⚠️ {error}
            </div>
          )}

          {viewMode === 'admin' || viewMode === 'accounting' ? (
            // Admin/Accounting Login
            <form className="space-y-6" onSubmit={handleLocalLogin}>
              <h2 className="text-lg sm:text-2xl font-black text-gray-900">
                {viewMode === 'admin' ? '🔐 เข้าสู่ระบบ Admin' : '💼 เข้าสู่ระบบฝ่ายบัญชี'}
              </h2>

              <div>
                <label className="block text-xs sm:text-sm font-black text-gray-700 mb-2">ชื่อผู้ใช้</label>
                <input
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="w-full p-2 sm:p-4 rounded-lg sm:rounded-xl border-2 border-purple-100 focus:border-purple-600 outline-none font-bold transition text-sm sm:text-base text-gray-900"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-black text-gray-700 mb-2">รหัสผ่าน</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onBlur={() => setShowPassword(false)}
                    className="w-full p-2 sm:p-4 pr-10 rounded-lg sm:rounded-xl border-2 border-purple-100 focus:border-purple-600 outline-none font-bold transition text-sm sm:text-base text-gray-900"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onMouseDown={() => setShowPassword(true)}
                    onMouseUp={() => setShowPassword(false)}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 select-none"
                  >
                    <Eye size={20} />
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 sm:py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg sm:rounded-xl font-black text-base sm:text-lg hover:shadow-lg transition disabled:opacity-50"
              >
                {loading ? 'กำลังเข้าสู่ระบบ...' : '🔓 เข้าสู่ระบบ'}
              </button>
            </form>
          ) : (
            // Meter User Options
            <div className="space-y-6 sm:space-y-8">
              {/* Registration Section */}
              <div>
                <h3 className="text-base sm:text-xl font-black text-gray-900 mb-4 flex items-center gap-2">
                  📝 ลงทะเบียนผู้ใช้ไฟฟ้า
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <input
                    value={registerData.fullName}
                    onChange={e => setRegisterData(prev => ({ ...prev, fullName: e.target.value }))}
                    placeholder="ชื่อ นามสกุล"
                    className="w-full p-3 rounded-xl border-2 border-purple-100 outline-none focus:border-purple-600 transition"
                    disabled={loading}
                  />
                  <input
                    value={registerData.phone}
                    onChange={e => setRegisterData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="เบอร์โทรศัพท์"
                    className="w-full p-3 rounded-xl border-2 border-purple-100 outline-none focus:border-purple-600 transition"
                    disabled={loading}
                  />
                  <input
                    value={registerData.address}
                    onChange={e => setRegisterData(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="ที่อยู่"
                    className="w-full p-3 rounded-xl border-2 border-purple-100 outline-none focus:border-purple-600 transition"
                    disabled={loading}
                  />
                  <input
                    value={registerData.idCardNumber}
                    onChange={e => setRegisterData(prev => ({ ...prev, idCardNumber: e.target.value }))}
                    placeholder="เลขบัตรประชาชน"
                    className="w-full p-3 rounded-xl border-2 border-purple-100 outline-none focus:border-purple-600 transition"
                    disabled={loading}
                  />
                  <div className="w-full">
                    <select
                      value={registerData.bankName}
                      onChange={e => setRegisterData(prev => ({ ...prev, bankName: e.target.value }))}
                      className="w-full p-3 rounded-xl border-2 border-purple-100 outline-none focus:border-purple-600 transition"
                      disabled={loading}
                    >
                      <option value="">เลือกธนาคาร</option>
                      <option value="ธนาคารกรุงเทพ">🏦 ธนาคารกรุงเทพ</option>
                      <option value="ธนาคารกสิกรไทย">🐉 ธนาคารกสิกรไทย</option>
                      <option value="ธนาคารไทยพาณิชย์">💳 ธนาคารไทยพาณิชย์</option>
                      <option value="ธนาคารกรุงไทย">🌐 ธนาคารกรุงไทย</option>
                      <option value="ธนาคารทหารไทย">🛡️ ธนาคารทหารไทย</option>
                      <option value="ธนาคารออมสิน">🐷 ธนาคารออมสิน</option>
                      <option value="ธนาคารกรุงศรีอยุธยา">🌿 ธนาคารกรุงศรีอยุธยา</option>
                    </select>
                  </div>
                  <input
                    value={registerData.bankAccountNumber}
                    onChange={e => setRegisterData(prev => ({ ...prev, bankAccountNumber: e.target.value }))}
                    placeholder="เลขบัญชี"
                    className="w-full p-3 rounded-xl border-2 border-purple-100 outline-none focus:border-purple-600 transition"
                    disabled={loading}
                  />
                </div>

                <div className="mb-4 text-sm font-black text-gray-600">📸 แนบรูป (jpg/png)</div>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <label className="relative p-4 border-2 border-dashed border-purple-200 rounded-xl cursor-pointer hover:bg-purple-50 transition">
                    <input type="file" accept="image/*" onChange={e => onRegisterFileChange(e, 'electricityBillImage')} className="hidden" />
                    <div className="text-center">
                      <div className="text-lg">💡</div>
                      <div className="text-xs font-black">{registerData.electricityBillImage ? '✓ บิลค่าไฟ' : 'บิลค่าไฟ'}</div>
                    </div>
                  </label>
                  <label className="relative p-4 border-2 border-dashed border-purple-200 rounded-xl cursor-pointer hover:bg-purple-50 transition">
                    <input type="file" accept="image/*" onChange={e => onRegisterFileChange(e, 'bankBookImage')} className="hidden" />
                    <div className="text-center">
                      <div className="text-lg">📘</div>
                      <div className="text-xs font-black">{registerData.bankBookImage ? '✓ สมุดบัญชี' : 'สมุดบัญชี'}</div>
                    </div>
                  </label>
                  <label className="relative p-4 border-2 border-dashed border-purple-200 rounded-xl cursor-pointer hover:bg-purple-50 transition">
                    <input type="file" accept="image/*" onChange={e => onRegisterFileChange(e, 'idCardImage')} className="hidden" />
                    <div className="text-center">
                      <div className="text-lg">🆔</div>
                      <div className="text-xs font-black">{registerData.idCardImage ? '✓ บัตรประชาชน' : 'บัตรประชาชน'}</div>
                    </div>
                  </label>
                </div>

                <button
                  onClick={handleRegister}
                  disabled={loading}
                  className="w-full py-3 bg-indigo-600 text-white rounded-xl font-black hover:bg-indigo-700 transition disabled:opacity-50"
                >
                  {loading ? 'กำลังส่งข้อมูล...' : '📤 ส่งข้อมูลลงทะเบียน'}
                </button>
              </div>

              {/* Login Section */}
              <div className="border-t-2 border-purple-100 pt-8">
                <h3 className="text-xl font-black text-gray-900 mb-4 flex items-center gap-2">
                  ⚡ เข้าสู่ระบบ (หลังได้รับการอนุมัติ)
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <input
                    value={meterLoginPhone}
                    onChange={e => setMeterLoginPhone(e.target.value)}
                    placeholder="เบอร์โทรศัพท์"
                    className="w-full p-4 rounded-xl border-2 border-indigo-100 focus:border-indigo-600 outline-none transition"
                    disabled={loading}
                  />
                  <input
                    value={meterLoginIdCard}
                    onChange={e => setMeterLoginIdCard(e.target.value)}
                    placeholder="เลขบัตรประชาชน"
                    className="w-full p-4 rounded-xl border-2 border-indigo-100 focus:border-indigo-600 outline-none transition"
                    disabled={loading}
                  />
                </div>

                <button
                  onClick={handleMeterLogin}
                  disabled={loading}
                  className="w-full py-4 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-xl font-black text-lg hover:shadow-lg transition disabled:opacity-50"
                >
                  {loading ? 'กำลังเข้าสู่ระบบ...' : '🔓 เข้าสู่ระบบ'}
                </button>
              </div>
            </div>
          )}
        </motion.div>

        {/* Footer Note */}
        <div className="text-center mt-8 text-sm text-gray-500 font-black">
          ✅ ระบบนี้ได้มาตรฐานความปลอดภัยและเข้ารหัส SSL
        </div>
      </div>
    </div>
  );
};

const RefundForm = ({ onSuccess, onBack }: { onSuccess: () => void; onBack?: () => void }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [formData, setFormData] = useState({
    meterNumber: '',
    accountNumber: '',
    fullName: '',
    idCardNumber: '',
    bankName: '',
    bankAccountNumber: '',
    idCardImage: '',
    electricityBillImage: '',
    bankBookImage: ''
  });

  const verifyUser = () => {
    const validUser = VALID_USERS.find(u =>
      u.meterNumber === formData.meterNumber &&
      u.accountNumber === formData.accountNumber &&
      (u.usageType === '8114' || u.usageType === '8115')
    );

    if (validUser) {
      setIsVerified(true);
      setFormData(prev => ({ ...prev, fullName: validUser.fullName }));
      toast.success('ตรวจสอบข้อมูลสำเร็จ', {
        description: `พบข้อมูลผู้ใช้ไฟฟ้า: ${validUser.fullName}`,
        duration: 4000
      });
    } else {
      setIsVerified(false);
      toast.error('ไม่พบข้อมูล หรือประเภทการใช้งานไม่ถูกต้อง', {
        description: 'โปรดตรวจสอบหมายเลขมิเตอร์และหมายเลขผู้ใช้ไฟฟ้าอีกครั้ง',
        duration: 5000
      });
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressImage(file);
        setFormData(prev => ({ ...prev, [field]: compressed }));
      } catch (error) {
        console.error('Image compression failed:', error);
        alert('ไม่สามารถประมวลผลรูปภาพได้ โปรดลองใหม่อีกครั้ง');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.idCardImage || !formData.electricityBillImage || !formData.bankBookImage) {
      alert('โปรดแนบรูปภาพให้ครบถ้วนทั้ง 3 รายการ');
      return;
    }

    setLoading(true);

    if (!isVerified) {
      setLoading(false);
      toast.error('โปรดตรวจสอบข้อมูลผู้ใช้ไฟฟ้าก่อนส่งคำขอ');
      return;
    }

    const path = 'refundRequests';
    try {
      await addDoc(collection(db, path), {
        ...formData,
        uid: user.uid,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      onSuccess();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {onBack && (
        <motion.button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 mb-6 text-purple-600 hover:text-purple-700 font-black text-sm sm:text-base"
          whileHover={{ x: -4 }}
        >
          <ChevronRight className="w-5 h-5 transform rotate-180" />
          <span>ย้อนกลับ</span>
        </motion.button>
      )}
      <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-10">
        <div className="bg-purple-50 p-4 sm:p-8 rounded-lg sm:rounded-[2.5rem] border-2 border-purple-100 mb-6 sm:mb-10">
          <div className="flex items-start gap-3 sm:gap-4">
            <AlertCircle className="w-6 sm:w-8 h-6 sm:h-8 text-purple-600 mt-1 flex-shrink-0" />
            <div>
              <p className="text-base sm:text-xl font-black text-purple-900 mb-2">เงื่อนไขการขอคืนเงิน</p>
              <p className="text-xs sm:text-sm text-gray-600 font-bold leading-relaxed">
                เฉพาะผู้ใช้ไฟฟ้าที่มีรหัสประเภทการใช้งาน <span className="text-purple-700 font-black">8114</span> หรือ <span className="text-purple-700 font-black">8115</span> เท่านั้น
                โปรดตรวจสอบข้อมูลจากบิลค่าไฟฟ้าของท่านก่อนดำเนินการ
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div className="space-y-4">
            <label className="text-base font-black text-purple-600 uppercase tracking-widest ml-1">หมายเลขมิเตอร์</label>
            <input
              required
              type="text"
              value={formData.meterNumber}
              onChange={e => {
                setFormData({ ...formData, meterNumber: e.target.value });
                setIsVerified(false);
              }}
              className="w-full px-8 py-6 bg-purple-50/50 border-2 border-transparent focus:border-purple-500 focus:bg-white rounded-[2rem] transition-all outline-none font-black text-2xl text-gray-900"
              placeholder="เช่น 12345678"
            />
          </div>
          <div className="space-y-4">
            <label className="text-base font-black text-purple-600 uppercase tracking-widest ml-1">หมายเลขผู้ใช้ไฟฟ้า</label>
            <div className="flex gap-4">
              <input
                required
                type="text"
                value={formData.accountNumber}
                onChange={e => {
                  setFormData({ ...formData, accountNumber: e.target.value });
                  setIsVerified(false);
                }}
                className="flex-1 px-8 py-6 bg-purple-50/50 border-2 border-transparent focus:border-purple-500 focus:bg-white rounded-[2rem] transition-all outline-none font-black text-2xl text-gray-900"
                placeholder="เช่น 020001234567"
              />
              <button
                type="button"
                onClick={verifyUser}
                className="px-8 bg-purple-600 text-white rounded-[2rem] font-black text-xl hover:bg-purple-700 transition-all shadow-xl active:scale-95"
              >
                ตรวจสอบ
              </button>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {isVerified && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-10 overflow-hidden"
            >
              <div className="space-y-4">
                <label className="text-base font-black text-purple-600 uppercase tracking-widest ml-1">ชื่อ-นามสกุล (ตามบิลค่าไฟ)</label>
                <input
                  required
                  readOnly
                  type="text"
                  value={formData.fullName}
                  className="w-full px-8 py-6 bg-gray-100 border-2 border-gray-200 rounded-[2rem] outline-none font-black text-2xl text-gray-500"
                />
              </div>

              <div className="space-y-4">
                <label className="text-base font-black text-purple-600 uppercase tracking-widest ml-1">เลขบัตรประจำตัวประชาชน (13 หลัก)</label>
                <input
                  required
                  type="text"
                  maxLength={13}
                  inputMode="numeric"
                  value={formData.idCardNumber}
                  onChange={e => setFormData({ ...formData, idCardNumber: e.target.value.replace(/\D/g, '') })}
                  className="w-full px-8 py-6 bg-purple-50/50 border-2 border-transparent focus:border-purple-500 focus:bg-white rounded-[2rem] transition-all outline-none font-black text-2xl text-gray-900"
                  placeholder="1234567890123"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10 pt-6">
                <div className="space-y-4">
                  <label className="text-base font-black text-purple-600 uppercase tracking-widest ml-1">ธนาคารที่รับเงินคืน</label>
                  <div className="relative">
                    <select
                      required
                      value={formData.bankName}
                      onChange={e => setFormData({ ...formData, bankName: e.target.value })}
                      className="w-full px-8 py-6 bg-purple-50/50 border-2 border-transparent focus:border-purple-500 focus:bg-white rounded-[2rem] transition-all outline-none font-black text-2xl text-gray-900 appearance-none cursor-pointer"
                    >
                      <option value="">เลือกธนาคาร</option>
                      <option value="กสิกรไทย">กสิกรไทย</option>
                      <option value="ไทยพาณิชย์">ไทยพาณิชย์</option>
                      <option value="กรุงเทพ">กรุงเทพ</option>
                      <option value="กรุงไทย">กรุงไทย</option>
                      <option value="กรุงศรีอยุธยา">กรุงศรีอยุธยา</option>
                      <option value="ทหารไทยธนชาต">ทหารไทยธนชาต</option>
                    </select>
                    <div className="absolute right-8 top-1/2 -translate-y-1/2 pointer-events-none text-purple-400">
                      <ChevronRight className="w-8 h-8 rotate-90" />
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <label className="text-base font-black text-purple-600 uppercase tracking-widest ml-1">เลขบัญชีธนาคาร</label>
                  <input
                    required
                    type="text"
                    inputMode="numeric"
                    value={formData.bankAccountNumber}
                    onChange={e => setFormData({ ...formData, bankAccountNumber: e.target.value })}
                    className="w-full px-8 py-6 bg-purple-50/50 border-2 border-transparent focus:border-purple-500 focus:bg-white rounded-[2rem] transition-all outline-none font-black text-2xl text-gray-900"
                    placeholder="000-0-00000-0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-10">
                <div className="space-y-4">
                  <label className="text-base font-black text-purple-600 uppercase tracking-widest ml-1 block">1. รูปบัตรประชาชน</label>
                  <div className={`relative group cursor-pointer border-4 border-dashed rounded-[2.5rem] transition-all flex flex-col items-center justify-center p-8 ${formData.idCardImage ? 'border-green-400 bg-green-50/30' : 'border-purple-100 bg-purple-50/30 hover:border-purple-300'
                    }`}>
                    <input
                      required
                      type="file"
                      accept="image/*"
                      onChange={e => handleFileChange(e, 'idCardImage')}
                      className="absolute inset-0 opacity-0 cursor-pointer z-10"
                    />
                    {formData.idCardImage ? (
                      <div className="text-center">
                        <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                        <span className="text-sm font-black text-green-600 uppercase tracking-widest">แนบแล้ว</span>
                      </div>
                    ) : (
                      <div className="text-center">
                        <Upload className="w-12 h-12 text-purple-300 mx-auto mb-3 group-hover:scale-110 transition-transform" />
                        <span className="text-sm font-black text-purple-400 uppercase tracking-widest">คลิกเพื่อแนบรูป</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-base font-black text-purple-600 uppercase tracking-widest ml-1 block">2. รูปบิลค่าไฟฟ้า</label>
                  <div className={`relative group cursor-pointer border-4 border-dashed rounded-[2.5rem] transition-all flex flex-col items-center justify-center p-8 ${formData.electricityBillImage ? 'border-green-400 bg-green-50/30' : 'border-purple-100 bg-purple-50/30 hover:border-purple-300'
                    }`}>
                    <input
                      required
                      type="file"
                      accept="image/*"
                      onChange={e => handleFileChange(e, 'electricityBillImage')}
                      className="absolute inset-0 opacity-0 cursor-pointer z-10"
                    />
                    {formData.electricityBillImage ? (
                      <div className="text-center">
                        <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                        <span className="text-sm font-black text-green-600 uppercase tracking-widest">แนบแล้ว</span>
                      </div>
                    ) : (
                      <div className="text-center">
                        <Upload className="w-12 h-12 text-purple-300 mx-auto mb-3 group-hover:scale-110 transition-transform" />
                        <span className="text-sm font-black text-purple-400 uppercase tracking-widest">คลิกเพื่อแนบรูป</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-base font-black text-purple-600 uppercase tracking-widest ml-1 block">3. รูปหน้าสมุดบัญชี</label>
                  <div className={`relative group cursor-pointer border-4 border-dashed rounded-[2.5rem] transition-all flex flex-col items-center justify-center p-8 ${formData.bankBookImage ? 'border-green-400 bg-green-50/30' : 'border-purple-100 bg-purple-50/30 hover:border-purple-300'
                    }`}>
                    <input
                      required
                      type="file"
                      accept="image/*"
                      onChange={e => handleFileChange(e, 'bankBookImage')}
                      className="absolute inset-0 opacity-0 cursor-pointer z-10"
                    />
                    {formData.bankBookImage ? (
                      <div className="text-center">
                        <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                        <span className="text-sm font-black text-green-600 uppercase tracking-widest">แนบแล้ว</span>
                      </div>
                    ) : (
                      <div className="text-center">
                        <Upload className="w-12 h-12 text-purple-300 mx-auto mb-3 group-hover:scale-110 transition-transform" />
                        <span className="text-sm font-black text-purple-400 uppercase tracking-widest">คลิกเพื่อแนบรูป</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Sticker Gallery */}
              <div className="mt-8 pt-8 border-t-2 border-purple-100">
                <StickerGallery
                  onSelect={(emoji) => {
                    const newSticker: Sticker = {
                      id: Date.now().toString(),
                      emoji,
                      x: Math.random() * 80,
                      y: Math.random() * 80
                    };
                    setStickers([...stickers, newSticker]);
                    toast.success('เพิ่มสติก!');
                  }}
                  stickersAdded={stickers.length}
                />
              </div>

              {/* Stickers Preview */}
              {stickers.length > 0 && (
                <div className="mt-8 relative bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl p-4 sm:p-6 border-2 border-purple-100 min-h-32 sm:min-h-40">
                  <p className="text-xs sm:text-sm font-black text-purple-600 mb-3">✨ สติกเกอร์ที่เพิ่มแล้ว:</p>
                  <div className="relative w-full h-24 sm:h-32">
                    {stickers.map(sticker => (
                      <motion.div
                        key={sticker.id}
                        className="absolute text-2xl sm:text-4xl cursor-pointer hover:scale-125 transition"
                        style={{ left: `${sticker.x}%`, top: `${sticker.y}%` }}
                        whileHover={{ scale: 1.3 }}
                        onClick={() => {
                          setStickers(stickers.filter(s => s.id !== sticker.id));
                          toast.success('ลบสติกแล้ว');
                        }}
                        title="คลิกเพื่อลบ"
                      >
                        {sticker.emoji}
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 sm:py-6 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg sm:rounded-[2rem] font-black text-base sm:text-2xl hover:from-purple-700 hover:to-indigo-700 transition-all shadow-2xl shadow-purple-200 disabled:opacity-50 flex items-center justify-center gap-2 sm:gap-4 mt-6 sm:mt-8 active:scale-95"
              >
                {loading ? <Loader2 className="w-6 sm:w-8 h-6 sm:h-8 animate-spin" /> : (
                  <>
                    <PlusCircle className="w-5 sm:w-7 h-5 sm:h-7" />
                    ส่งคำขอคืนเงินประกัน
                  </>
                )}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </form>
    </>
  );
};

const RequestList = ({ requests, isPrivileged }: { requests: RefundRequest[], isPrivileged: boolean }) => {
  const [updating, setUpdating] = useState<string | null>(null);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [slipImage, setSlipImage] = useState('');
  const [signerName, setSignerName] = useState('');
  const { user } = useAuth();

  const updateStatus = async (id: string, status: RefundRequest['status']) => {
    setUpdating(id);
    const path = `refundRequests/${id}`;
    try {
      await updateDoc(doc(db, 'refundRequests', id), {
        status,
        updatedAt: new Date().toISOString()
      });
      toast.success('อัปเดตสถานะเรียบร้อยแล้ว');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    } finally {
      setUpdating(null);
    }
  };

  const completeRequest = async (id: string, request: RefundRequest) => {
    if (!slipImage || !signerName) {
      toast.error('กรุณาแนบสลิปและลงชื่อผู้ปิดคำร้อง');
      return;
    }
    setUpdating(id);
    const path = `refundRequests/${id}`;
    try {
      await updateDoc(doc(db, 'refundRequests', id), {
        status: 'completed',
        slipImage,
        signerName,
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // Send notification to user
      await sendEmailNotification(
        request.phone || '',
        'completed',
        { fullName: request.fullName, signerName }
      );

      toast.success('ปิดคำร้องสำเร็จและแจ้งเตือนผู้ใช้แล้ว');
      setCompletingId(null);
      setSlipImage('');
      setSignerName('');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    } finally {
      setUpdating(null);
    }
  };

  if (requests.length === 0) {
    return (
      <div className="text-center py-24 bg-white rounded-[3rem] border-2 border-dashed border-purple-200">
        <div className="w-28 h-28 bg-purple-50 rounded-full flex items-center justify-center text-purple-300 mx-auto mb-8">
          <ClipboardList className="w-14 h-14" />
        </div>
        <p className="text-gray-500 font-black text-3xl">ยังไม่มีรายการคำขอในขณะนี้</p>
        <p className="text-purple-500 font-black text-lg mt-4">เริ่มสร้างคำขอแรกของคุณได้เลย!</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-8">
        {requests.map((req) => (
          <motion.div
            layout
            key={req.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-10 rounded-[3rem] border border-purple-100 shadow-2xl shadow-purple-100/40 hover:shadow-purple-200/60 transition-all group overflow-hidden relative"
          >
            <div className={`absolute top-0 left-0 w-3 h-full ${req.status === 'approved' ? 'bg-green-500' :
              req.status === 'rejected' ? 'bg-red-500' :
                req.status === 'processing' ? 'bg-indigo-500' :
                  req.status === 'completed' ? 'bg-blue-500' :
                    'bg-purple-600'
              }`} />

            <div className="flex flex-col sm:flex-row justify-between gap-8">
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="px-5 py-2 bg-purple-50 rounded-xl">
                    <span className="text-sm font-black text-purple-700 uppercase tracking-widest">#{req.meterNumber}</span>
                  </div>
                  <span className="text-sm font-black text-gray-400 uppercase tracking-widest">{new Date(req.createdAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                </div>
                <h3 className="text-4xl font-black text-gray-900 group-hover:text-purple-700 transition-colors leading-tight">{req.fullName}</h3>
                <div className="flex flex-wrap gap-4">
                  <p className="text-base font-black text-gray-500 flex items-center gap-3 bg-gray-50 px-5 py-2.5 rounded-2xl">
                    <Zap className="w-5 h-5 text-purple-500" /> {req.accountNumber}
                  </p>
                  <p className="text-base font-black text-gray-500 flex items-center gap-3 bg-gray-50 px-5 py-2.5 rounded-2xl">
                    <UserIcon className="w-5 h-5 text-indigo-500" /> {req.idCardNumber.replace(/(\d{1})\d{11}(\d{1})/, "$1***********$2")}
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-start sm:items-end justify-between gap-8">
                <div className={`px-8 py-4 rounded-2xl text-sm font-black uppercase tracking-widest flex items-center gap-4 shadow-xl ${req.status === 'approved' ? 'bg-green-500 text-white shadow-green-100' :
                  req.status === 'rejected' ? 'bg-red-500 text-white shadow-red-100' :
                    req.status === 'processing' ? 'bg-indigo-500 text-white shadow-indigo-100' :
                      req.status === 'completed' ? 'bg-blue-500 text-white shadow-blue-100' :
                        'bg-purple-600 text-white shadow-purple-100'
                  }`}>
                  {req.status === 'approved' && <CheckCircle className="w-6 h-6" />}
                  {req.status === 'rejected' && <AlertCircle className="w-6 h-6" />}
                  {req.status === 'processing' && <Clock className="w-6 h-6" />}
                  {req.status === 'pending' && <Clock className="w-6 h-6" />}
                  {req.status === 'completed' && <CheckCircle className="w-6 h-6" />}
                  {req.status}
                </div>

                {isPrivileged && (
                  <div className="w-full sm:w-auto flex gap-3">
                    <select
                      disabled={updating === req.id}
                      value={req.status}
                      onChange={(e) => updateStatus(req.id, e.target.value as any)}
                      className="flex-1 text-sm font-black uppercase tracking-widest border-2 border-purple-100 rounded-2xl px-8 py-4 outline-none focus:border-purple-600 transition-all bg-purple-50/50 cursor-pointer"
                    >
                      <option value="pending">Pending</option>
                      <option value="processing">Processing</option>
                      <option value="approved">Approved</option>
                      <option value="completed">Completed</option>
                      <option value="rejected">Rejected</option>
                    </select>
                    {req.status === 'approved' && (
                      <button
                        onClick={() => setCompletingId(req.id)}
                        className="px-6 py-4 bg-blue-600 text-white rounded-2xl font-black hover:bg-blue-700 transition-colors"
                      >
                        ปิดคำร้อง
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-10 pt-8 border-t border-purple-50 grid grid-cols-2 gap-10">
              <div className="space-y-3">
                <span className="text-sm font-black text-gray-400 uppercase tracking-widest block">ธนาคาร</span>
                <div className="flex items-center gap-4">
                  <span className="text-2xl">{getBankLogo(req.bankName)}</span>
                  <span className="font-black text-2xl text-gray-800">{req.bankName}</span>
                </div>
              </div>
              <div className="space-y-3">
                <span className="text-sm font-black text-gray-400 uppercase tracking-widest block">เลขบัญชี</span>
                <span className="font-mono font-black text-2xl text-gray-800">{req.bankAccountNumber}</span>
              </div>
            </div>

            {/* Image Attachments Display for Admin/User */}
            <div className="mt-10 grid grid-cols-3 gap-6">
              {req.idCardImage && (
                <div className="space-y-2">
                  <span className="text-xs font-black text-purple-400 uppercase tracking-widest block ml-1">บัตรประชาชน</span>
                  <div className="relative group overflow-hidden rounded-2xl border-2 border-purple-50 aspect-video bg-gray-50">
                    <img src={req.idCardImage} alt="ID Card" className="w-full h-full object-cover group-hover:scale-110 transition-transform" referrerPolicy="no-referrer" />
                    <button
                      onClick={() => setViewingImage(req.idCardImage!)}
                      className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-black text-xs uppercase tracking-widest gap-2"
                    >
                      <Eye className="w-4 h-4" /> ดูรูป
                    </button>
                  </div>
                </div>
              )}
              {req.electricityBillImage && (
                <div className="space-y-2">
                  <span className="text-xs font-black text-purple-400 uppercase tracking-widest block ml-1">บิลค่าไฟ</span>
                  <div className="relative group overflow-hidden rounded-2xl border-2 border-purple-50 aspect-video bg-gray-50">
                    <img src={req.electricityBillImage} alt="Electricity Bill" className="w-full h-full object-cover group-hover:scale-110 transition-transform" referrerPolicy="no-referrer" />
                    <button
                      onClick={() => setViewingImage(req.electricityBillImage!)}
                      className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-black text-xs uppercase tracking-widest gap-2"
                    >
                      <Eye className="w-4 h-4" /> ดูรูป
                    </button>
                  </div>
                </div>
              )}
              {req.bankBookImage && (
                <div className="space-y-2">
                  <span className="text-xs font-black text-purple-400 uppercase tracking-widest block ml-1">สมุดบัญชี</span>
                  <div className="relative group overflow-hidden rounded-2xl border-2 border-purple-50 aspect-video bg-gray-50">
                    <img src={req.bankBookImage} alt="Bank Book" className="w-full h-full object-cover group-hover:scale-110 transition-transform" referrerPolicy="no-referrer" />
                    <button
                      onClick={() => setViewingImage(req.bankBookImage!)}
                      className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-black text-xs uppercase tracking-widest gap-2"
                    >
                      <Eye className="w-4 h-4" /> ดูรูป
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Complete Request Dialog */}
      <AnimatePresence>
        {completingId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            onClick={() => setCompletingId(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[2rem] p-8 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-2xl font-black text-gray-900 mb-6">ปิดคำร้อง</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-black text-gray-700 mb-2">แนบสลิปการโอน</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = () => setSlipImage(reader.result as string);
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="w-full border-2 border-purple-100 rounded-xl p-3"
                  />
                </div>
                <div>
                  <label className="block text-sm font-black text-gray-700 mb-2">ชื่อผู้ปิดคำร้อง</label>
                  <input
                    type="text"
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    placeholder="กรอกชื่อผู้ปิดคำร้อง"
                    className="w-full border-2 border-purple-100 rounded-xl p-3 outline-none focus:border-purple-600"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setCompletingId(null)}
                    className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-xl font-black hover:bg-gray-300 transition-colors"
                  >
                    ยกเลิก
                  </button>
                  <button
                    onClick={() => completeRequest(completingId, requests.find(r => r.id === completingId)!)}
                    disabled={updating === completingId}
                    className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl font-black hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {updating === completingId ? 'กำลังปิด...' : 'ปิดคำร้อง'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {viewingImage && (
          <ImageViewer imageUrl={viewingImage} onClose={() => setViewingImage(null)} />
        )}
      </AnimatePresence>
    </>
  );
};

// --- Main App ---

const Dashboard = ({ onBack }: { onBack?: () => void }) => {
  const { user, isAdminOrAccounting } = useAuth();
  const [requests, setRequests] = useState<RefundRequest[]>([]);
  const [view, setView] = useState<'list' | 'form'>('list');
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!user) return;

    const path = 'refundRequests';
    const q = isAdminOrAccounting
      ? query(collection(db, path))
      : query(collection(db, path), where('uid', '==', user.uid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reqs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as RefundRequest[];
      setRequests(reqs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });

    return () => unsubscribe();
  }, [user, isAdminOrAccounting]);

  const filteredRequests = requests.filter(req =>
    req.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    req.meterNumber.includes(searchTerm) ||
    req.accountNumber.includes(searchTerm)
  );

  const stats = {
    total: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    processing: requests.filter(r => r.status === 'processing').length,
    approved: requests.filter(r => r.status === 'approved').length,
    completed: requests.filter(r => r.status === 'completed').length,
    rejected: requests.filter(r => r.status === 'rejected').length
  };

  const exportToCSV = () => {
    const headers = ['Meter Number', 'Account Number', 'Full Name', 'ID Card Number', 'Bank', 'Account', 'Status', 'Date'];
    const rows = requests.map(req => [
      req.meterNumber,
      req.accountNumber,
      req.fullName,
      req.idCardNumber,
      req.bankName,
      req.bankAccountNumber,
      req.status,
      new Date(req.createdAt).toLocaleDateString('th-TH')
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `refund_requests_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-80px)] flex items-center justify-center">
        <Loader2 className="w-14 h-14 text-purple-600 animate-spin" />
      </div>
    );
  }

  return (
    <main className="max-w-5xl mx-auto px-3 sm:px-6 py-6 sm:py-12 md:py-24">
      {onBack && (
        <motion.button
          onClick={onBack}
          className="flex items-center gap-2 mb-6 text-purple-600 hover:text-purple-700 font-black text-sm sm:text-base"
          whileHover={{ x: -4 }}
        >
          <ChevronRight className="w-5 h-5 transform rotate-180" />
          <span>ย้อนกลับ</span>
        </motion.button>
      )}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 sm:gap-10 mb-10 sm:mb-20">
        <div className="space-y-3 sm:space-y-4">
          <h2 className="text-3xl sm:text-6xl md:text-7xl font-black text-gray-900 tracking-tighter leading-tight">
            รายการคำขอ
            <span className="text-purple-600 block sm:inline sm:ml-2 md:ml-4 text-2xl sm:text-6xl md:text-7xl">{isAdminOrAccounting ? 'ทั้งหมด' : 'ของคุณ'}</span>
          </h2>
          <div className="flex items-center gap-3 sm:gap-4">
            <span className="w-3 sm:w-4 h-3 sm:h-4 rounded-full bg-purple-500 animate-pulse" />
            <p className="text-gray-500 font-black text-xs sm:text-base md:text-lg uppercase tracking-widest">
              {isAdminOrAccounting ? `พบทั้งหมด ${requests.length} รายการ` : `คุณมีรายการคำขอ ${requests.length} รายการ`}
            </p>
          </div>
        </div>

        {!isAdminOrAccounting ? (
          <button
            onClick={() => setView(view === 'list' ? 'form' : 'list')}
            className="w-full md:w-auto flex items-center justify-center gap-2 sm:gap-5 px-4 sm:px-12 py-3 sm:py-6 bg-gray-900 text-white rounded-lg sm:rounded-[2.5rem] font-black text-base sm:text-2xl hover:bg-black transition-all shadow-2xl shadow-gray-200 active:scale-95"
          >
            {view === 'list' ? (
              <>
                <PlusCircle className="w-6 sm:w-8 h-6 sm:h-8 text-purple-400" />
                <span className="hidden sm:inline">สร้างคำขอใหม่</span>
                <span className="sm:hidden">สร้างคำขอ</span>
              </>
            ) : (
              <>
                <ClipboardList className="w-6 sm:w-8 h-6 sm:h-8 text-indigo-400" />
                <span className="hidden sm:inline">ดูรายการทั้งหมด</span>
                <span className="sm:hidden">ดูรายการ</span>
              </>
            )}
          </button>
        ) : (
          <button
            onClick={exportToCSV}
            className="w-full md:w-auto flex items-center justify-center gap-2 sm:gap-4 px-4 sm:px-10 py-3 sm:py-5 bg-purple-600 text-white rounded-lg sm:rounded-[2rem] font-black text-base sm:text-xl hover:bg-purple-700 transition-all shadow-2xl shadow-purple-200 active:scale-95"
          >
            <Download className="w-5 sm:w-7 h-5 sm:h-7" />
            <span className="hidden sm:inline">ส่งออกข้อมูล (CSV)</span>
            <span className="sm:hidden">CSV</span>
          </button>
        )}
      </div>

      {/* Search Bar for Admin or Accounting */}
      {isAdminOrAccounting && (
        <div className="mb-6 sm:mb-10">
          <input
            type="text"
            placeholder="ค้นหาด้วยชื่อ, หมายเลขมิเตอร์ หรือ หมายเลขผู้ใช้..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-8 py-6 bg-white border-2 border-purple-100 focus:border-purple-500 rounded-[2rem] shadow-xl shadow-purple-100/20 outline-none font-bold text-xl transition-all"
          />
        </div>
      )}

      {/* Stats Section */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-6 mb-16">
        <div className="bg-white p-8 rounded-[2.5rem] border border-purple-50 shadow-xl shadow-purple-100/30">
          <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">ทั้งหมด</p>
          <p className="text-4xl font-black text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-white p-8 rounded-[2.5rem] border border-purple-50 shadow-xl shadow-purple-100/30">
          <p className="text-xs font-black text-purple-400 uppercase tracking-widest mb-2">รอดำเนินการ</p>
          <p className="text-4xl font-black text-purple-600">{stats.pending}</p>
        </div>
        <div className="bg-white p-8 rounded-[2.5rem] border border-purple-50 shadow-xl shadow-purple-100/30">
          <p className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-2">กำลังดำเนินการ</p>
          <p className="text-4xl font-black text-indigo-600">{stats.processing}</p>
        </div>
        <div className="bg-white p-8 rounded-[2.5rem] border border-purple-50 shadow-xl shadow-purple-100/30">
          <p className="text-xs font-black text-green-400 uppercase tracking-widest mb-2">อนุมัติแล้ว</p>
          <p className="text-4xl font-black text-green-600">{stats.approved}</p>
        </div>
        <div className="bg-white p-8 rounded-[2.5rem] border border-purple-50 shadow-xl shadow-purple-100/30">
          <p className="text-xs font-black text-blue-400 uppercase tracking-widest mb-2">เสร็จสิ้น</p>
          <p className="text-4xl font-black text-blue-600">{stats.completed}</p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {view === 'form' && !isAdminOrAccounting ? (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            className="bg-white p-10 sm:p-16 rounded-[4rem] border border-purple-50 shadow-2xl shadow-purple-100/50"
          >
            <div className="flex items-center gap-6 mb-12">
              <button onClick={() => setView('list')} className="w-14 h-14 flex items-center justify-center bg-purple-50 hover:bg-purple-100 rounded-2xl transition-colors">
                <ChevronRight className="w-8 h-8 rotate-180 text-purple-600" />
              </button>
              <div>
                <h3 className="text-3xl font-black text-gray-900">กรอกข้อมูลขอคืนเงิน</h3>
                <p className="text-sm font-black text-purple-300 uppercase tracking-widest mt-1">โปรดตรวจสอบข้อมูลให้ถูกต้อง</p>
              </div>
            </div>
            <RefundForm onSuccess={() => setView('list')} onBack={() => setView('list')} />
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
          >
            <RequestList requests={filteredRequests} isPrivileged={isAdminOrAccounting} />
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
};

const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginRole, setLoginRole] = useState<'admin' | 'accounting' | null>(null);
  const saveUserToStorage = (nextUser: AppUser | null) => {
    if (nextUser) {
      localStorage.setItem('appUser', JSON.stringify(nextUser));
    } else {
      localStorage.removeItem('appUser');
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem('appUser');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as AppUser;
        setUser(parsed);
      } catch (error) {
        console.warn('Invalid appUser in localStorage');
      }
    }

    const listenFirebase = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);

      if (fbUser) {
        const userDocRef = doc(db, 'users', fbUser.uid);
        try {
          const userDoc = await getDoc(userDocRef);
          if (!userDoc.exists()) {
            const newProfile: UserProfile = {
              uid: fbUser.uid,
              displayName: fbUser.displayName,
              email: fbUser.email,
              role: fbUser.email === 'tirawat.p.aescon@gmail.com' ? 'admin' : 'user',
              createdAt: new Date().toISOString()
            };
            await setDoc(userDocRef, newProfile);
            setProfile(newProfile);
            setUser({
              uid: fbUser.uid,
              displayName: fbUser.displayName ?? 'ผู้ใช้ไฟฟ้า',
              email: fbUser.email,
              role: 'meter-user',
              verified: false
            });
            saveUserToStorage({
              uid: fbUser.uid,
              displayName: fbUser.displayName ?? 'ผู้ใช้ไฟฟ้า',
              email: fbUser.email,
              role: 'meter-user',
              verified: false
            });
          } else {
            const existingProfile = userDoc.data() as UserProfile;
            setProfile(existingProfile);
            const userRole: AppRole = existingProfile.role === 'admin' ? 'admin' : 'meter-user';
            const autoUser: AppUser = {
              uid: fbUser.uid,
              displayName: existingProfile.displayName || fbUser.displayName || 'ผู้ใช้ไฟฟ้า',
              email: existingProfile.email,
              role: userRole,
              verified: userRole === 'meter-user' ? false : true
            };
            setUser(autoUser);
            saveUserToStorage(autoUser);
          }
        } catch (error) {
          console.error('Error initializing user profile:', error);
        }

        // Override role for local login
        if (loginRole && fbUser) {
          const overrideUser: AppUser = {
            uid: fbUser.uid,
            displayName: loginRole === 'admin' ? 'Admin' : 'ฝ่ายบัญชี',
            email: fbUser.email,
            role: loginRole,
            verified: true
          };
          setUser(overrideUser);
          saveUserToStorage(overrideUser);
          setLoginRole(null); // reset
        }
      } else {
        setProfile(null);
        // keep local logged in user if any
      }

      setLoading(false);
    });

    return () => listenFirebase();
  }, []);

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.warn('Sign out from Firebase failed', err);
    }
    setFirebaseUser(null);
    setUser(null);
    setProfile(null);
    saveUserToStorage(null);
    setLoading(false);
  };

  const loginLocal = async (role: 'admin' | 'accounting', employee?: any) => {
    try {
      // Local login only (demo mode): bypass Firebase password flow to avoid invalid-credential issues
      const localUser: AppUser = {
        uid: `local-${role}`,
        displayName: employee?.displayName || (role === 'admin' ? 'Admin' : 'ฝ่ายบัญชี'),
        email: employee?.email,
        role: role,
        verified: true
      };
      setUser(localUser);
      saveUserToStorage(localUser);
      setProfile(null);
      setLoginRole(null);
    } catch (error) {
      setLoginRole(null);
      console.error('loginLocal error:', error);
      throw new Error('ไม่สามารถเข้าสู่ระบบได้ ลองอีกครั้ง');
    }
  };

  const loginMeter = async (phone: string, idCardNumber: string) => {
    const q = query(
      collection(db, 'meterUserRegistrations'),
      where('phone', '==', phone),
      where('idCardNumber', '==', idCardNumber)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      throw new Error('ไม่พบข้อมูลผู้ใช้ไฟฟ้า กรุณาลงทะเบียนก่อนหรือรออนุมัติ');
    }

    const regDoc = snapshot.docs[0];
    const reg = regDoc.data() as MeterRegistrationData & { fullName: string; otpVerified?: boolean; status: string };

    if (reg.status !== 'approved') {
      throw new Error('บัญชีของคุณยังไม่ถูกอนุมัติ กรุณารอการอนุมัติจากผู้ดูแลระบบ');
    }

    const localUser: AppUser = {
      uid: `meter-${phone}`,
      displayName: reg.fullName,
      role: 'meter-user',
      verified: true
    };
    setUser(localUser);
    saveUserToStorage(localUser);
    setProfile(null);
  };

  const requestMeterOTP = async (phone: string, idCardNumber: string) => {
    const q = query(
      collection(db, 'meterUserRegistrations'),
      where('phone', '==', phone),
      where('idCardNumber', '==', idCardNumber),
      where('status', '==', 'approved')
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      throw new Error('ไม่พบข้อมูลผู้ใช้ไฟฟ้าที่อนุมัติแล้ว');
    }

    const regDoc = snapshot.docs[0];
    const otp = generateOTP();

    await updateDoc(doc(db, 'meterUserRegistrations', regDoc.id), {
      status: 'otp_sent',
      otpCode: otp,
      otpExpire: Date.now() + 10 * 60 * 1000 // 10 minutes
    });

    await createAuditLog(regDoc.id, 'otp_sent', { method: 'sms' }, phone);

    // แสดงใน console เพื่อทดสอบ (หรือแทนการส่ง SMS จริงในโหมด demo)
    console.log(`📱 OTP SMS sent to ${phone}: ${otp}`);

    await sendEmailNotification(phone, 'otp', { fullName: regDoc.data().fullName, otp });
    toast.success('ส่งรหัส OTP ไปยังเบอร์โทรศัพท์แล้ว (ตรวจสอบใน SMS หรือ console)');
  };

  const verifyMeterOTP = async (phone: string, idCardNumber: string, otpCode: string): Promise<boolean> => {
    const q = query(
      collection(db, 'meterUserRegistrations'),
      where('phone', '==', phone),
      where('idCardNumber', '==', idCardNumber),
      where('otpCode', '==', otpCode),
      where('otpExpire', '>', Date.now())
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      return false;
    }

    const regDoc = snapshot.docs[0];
    const reg = regDoc.data() as MeterRegistration;

    await updateDoc(doc(db, 'meterUserRegistrations', regDoc.id), {
      otpVerified: true,
      status: 'otp_verified'
    });

    await createAuditLog(
      regDoc.id,
      'otp_verified',
      { otpCode: '***' },
      `${phone}/${idCardNumber}`
    );

    return true;
  };


  const registerMeter = async (data: MeterRegistrationData) => {
    try {
      // Check if phone or idCardNumber already exists
      const phoneQuery = query(
        collection(db, 'meterUserRegistrations'),
        where('phone', '==', data.phone)
      );
      const idCardQuery = query(
        collection(db, 'meterUserRegistrations'),
        where('idCardNumber', '==', data.idCardNumber)
      );

      const [phoneSnapshot, idCardSnapshot] = await Promise.all([
        getDocs(phoneQuery),
        getDocs(idCardQuery)
      ]);

      if (!phoneSnapshot.empty) {
        throw new Error('เบอร์โทรศัพท์นี้ได้ลงทะเบียนแล้ว');
      }

      if (!idCardSnapshot.empty) {
        throw new Error('หมายเลขบัตรประชาชนนี้ได้ลงทะเบียนแล้ว');
      }

      const docRef = await addDoc(collection(db, 'meterUserRegistrations'), {
        ...data,
        role: 'meter-user',
        status: 'pending',
        createdAt: new Date().toISOString()
      });

      await createAuditLog(
        docRef.id,
        'created',
        { fullName: data.fullName, phone: data.phone },
        'system'
      );

      toast.success('ลงทะเบียนสำเร็จแล้ว กรุณารอการอนุมัติจากผู้ดูแลระบบ');
    } catch (error) {
      console.error('Registration failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'ลงทะเบียนล้มเหลว กรุณาลองใหม่อีกครั้ง';
      toast.error(errorMessage);
      throw error;
    }
  };

  const approveRegistration = async (
    registrationId: string,
    registrationData: MeterRegistration,
    approverName: string
  ) => {
    // Check if user is admin or accounting
    if (user?.role !== 'admin' && user?.role !== 'accounting') {
      toast.error('เฉพาะ Admin และ ฝ่ายบัญชี เท่านั้นที่สามารถอนุมัติได้');
      return;
    }

    try {
      await updateDoc(doc(db, 'meterUserRegistrations', registrationId), {
        status: 'approved',
        approvedAt: new Date().toISOString(),
        approvedBy: approverName
      });

      await createAuditLog(
        registrationId,
        'approved',
        {
          approvedBy: approverName
        },
        approverName
      );

      // Send email notification
      await sendEmailNotification(
        registrationData.phone,
        'approval',
        { fullName: registrationData.fullName, phone: registrationData.phone, idCardNumber: registrationData.idCardNumber }
      );

      toast.success('อนุมัติสำเร็จ ผู้ใช้สามารถเข้าสู่ระบบด้วยเบอร์โทรและบัตรประชาชนได้เลย');
    } catch (error) {
      toast.error('อนุมัติล้มเหลว');
      console.error(error);
    }
  };

  const rejectRegistration = async (
    registrationId: string,
    registrationData: MeterRegistration,
    rejecterName: string,
    reason: string
  ) => {
    // Check if user is admin or accounting
    if (user?.role !== 'admin' && user?.role !== 'accounting') {
      toast.error('เฉพาะ Admin และ ฝ่ายบัญชี เท่านั้นที่สามารถปฏิเสธได้');
      return;
    }

    try {
      await updateDoc(doc(db, 'meterUserRegistrations', registrationId), {
        status: 'rejected',
        rejectionReason: reason
      });

      await createAuditLog(
        registrationId,
        'rejected',
        {
          rejectedBy: rejecterName,
          reason
        },
        rejecterName
      );

      await sendEmailNotification(
        registrationData.phone,
        'rejection',
        { fullName: registrationData.fullName, reason }
      );

      toast.success('ปฏิเสธแล้ว');
    } catch (error) {
      toast.error('ปฏิเสธล้มเหลว');
      console.error(error);
    }
  };

  const verifyOTP = async (
    registrationId: string,
    phoneOrIdCard: string,
    otpCode: string
  ): Promise<boolean> => {
    try {
      const q = query(
        collection(db, 'meterUserRegistrations'),
        where('id', '==', registrationId),
        where('status', 'in', ['pending', 'approved', 'rejected', 'otp_sent', 'otp_verified', 'login_attempt']),
        where('otpCode', '==', otpCode),
        where('otpExpire', '>', Date.now())
      );

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        throw new Error('OTP ไม่ถูกต้อง หรือหมดอายุแล้ว');
      }

      const reg = snapshot.docs[0];
      await updateDoc(doc(db, 'meterUserRegistrations', reg.id), {
        otpVerified: true
      });

      await createAuditLog(
        reg.id,
        'otp_verified',
        { otpCode: '***' },
        phoneOrIdCard
      );

      return true;
    } catch (error) {
      console.error('OTP verification failed:', error);
      return false;
    }
  };

  const toggleRole = async () => {
    if (!user) return;
    if (user.role === 'admin') {
      const nextUser = { ...user, role: 'accounting' as AppRole, displayName: 'ฝ่ายบัญชี' };
      setUser(nextUser);
      saveUserToStorage(nextUser);
      return;
    }
    if (user.role === 'accounting') {
      const nextUser = { ...user, role: 'admin' as AppRole, displayName: 'Admin' };
      setUser(nextUser);
      saveUserToStorage(nextUser);
      return;
    }

    if (firebaseUser && profile) {
      const newRole = profile.role === 'admin' ? 'user' : 'admin';
      const path = `users/${firebaseUser.uid}`;
      try {
        await updateDoc(doc(db, 'users', firebaseUser.uid), { role: newRole });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        profile,
        loading,
        isAdminOrAccounting: user?.role === 'admin' || user?.role === 'accounting',
        loginLocal,
        loginMeter,
        registerMeter,
        logout,
        toggleRole,
        approveRegistration,
        rejectRegistration
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// --- Admin Registration Dashboard ---
const AdminRegistrationDashboard = () => {
  const { user, approveRegistration, rejectRegistration } = useAuth();
  const [registrations, setRegistrations] = useState<MeterRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');

  useEffect(() => {
    const q = query(
      collection(db, 'meterUserRegistrations'),
      where('status', 'in', filterStatus === 'all' ? ['pending', 'approved', 'rejected'] : [filterStatus])
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const regs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as MeterRegistration[];
      setRegistrations(regs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [filterStatus]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-12 h-12 text-purple-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2 mb-6">
        {(['all', 'pending', 'approved', 'rejected'] as const).map(status => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`px-5 py-2 rounded-xl font-black transition ${filterStatus === status
              ? 'bg-purple-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            {status === 'all' ? 'ทั้งหมด' : status === 'pending' ? 'รอการอนุมัติ' : status === 'approved' ? 'อนุมัติแล้ว' : 'ปฏิเสธ'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6">
        {registrations.length === 0 ? (
          <div className="text-center py-20 bg-gray-50 rounded-[2rem]">
            <p className="text-gray-400 font-black">ไม่มีข้อมูล</p>
          </div>
        ) : (
          registrations.map(reg => (
            <motion.div
              key={reg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white border-2 border-purple-100 rounded-[2rem] p-6 hover:shadow-lg transition"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h3 className="text-2xl font-black text-gray-900">{reg.fullName}</h3>
                  <div className="space-y-2 text-sm">
                    <p className="text-gray-600">📱 {reg.phone}</p>
                    <p className="text-gray-600">🆔 {reg.idCardNumber}</p>
                    <p className="text-gray-600">📍 {reg.address}</p>
                    <p className="text-gray-600 flex items-center gap-2">{getBankLogo(reg.bankName)} {reg.bankName} - {reg.bankAccountNumber}</p>
                  </div>
                  <p className="text-xs text-gray-400 mt-4">
                    สมัครเข้า: {new Date(reg.createdAt).toLocaleDateString('th-TH')}
                  </p>
                </div>

                <div className="flex flex-col justify-between">
                  <div>
                    <span className={`inline-block px-4 py-2 rounded-xl font-black text-sm ${reg.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                      reg.status === 'approved' ? 'bg-green-100 text-green-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                      {reg.status === 'pending' ? 'รอการอนุมัติ' : reg.status === 'approved' ? 'อนุมัติแล้ว' : 'ปฏิเสธ'}
                    </span>
                    {reg.rejectionReason && (
                      <p className="text-sm text-red-600 mt-2 font-black">เหตุผล: {reg.rejectionReason}</p>
                    )}
                  </div>

                  <div className="flex gap-3 mt-4">
                    {reg.status === 'pending' && (
                      <>
                        <button
                          onClick={() => approveRegistration(reg.id, reg, user?.displayName || 'admin')}
                          className="flex-1 bg-green-600 text-white px-4 py-2 rounded-xl font-black hover:bg-green-700 transition"
                        >
                          ✓ อนุมัติ
                        </button>
                        <button
                          onClick={() => setRejectingId(reg.id)}
                          className="flex-1 bg-red-600 text-white px-4 py-2 rounded-xl font-black hover:bg-red-700 transition"
                        >
                          ✕ ปฏิเสธ
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Rejection Dialog */}
              {rejectingId === reg.id && (
                <div className="mt-6 pt-6 border-t-2 border-purple-100 space-y-4">
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="ระบุเหตุผลการปฏิเสธ..."
                    className="w-full p-3 border-2 border-purple-100 rounded-xl outline-none focus:border-purple-600 resize-none"
                    rows={3}
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={async () => {
                        await rejectRegistration(reg.id, reg, user?.displayName || 'admin', rejectReason || 'ไม่ระบุเหตุผล');
                        setRejectingId(null);
                        setRejectReason('');
                      }}
                      className="flex-1 bg-red-600 text-white px-4 py-2 rounded-xl font-black hover:bg-red-700 transition"
                    >
                      ยืนยันการปฏิเสธ
                    </button>
                    <button
                      onClick={() => {
                        setRejectingId(null);
                        setRejectReason('');
                      }}
                      className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-xl font-black hover:bg-gray-300 transition"
                    >
                      ยกเลิก
                    </button>
                  </div>
                </div>
              )}

              {/* Image Preview */}
              <div className="mt-6 pt-6 border-t-2 border-purple-100 grid grid-cols-3 gap-4">
                {reg.idCardImage && (
                  <img src={reg.idCardImage} alt="ID Card" className="w-full h-40 object-cover rounded-xl border border-purple-100" />
                )}
                {reg.electricityBillImage && (
                  <img src={reg.electricityBillImage} alt="Bill" className="w-full h-40 object-cover rounded-xl border border-purple-100" />
                )}
                {reg.bankBookImage && (
                  <img src={reg.bankBookImage} alt="Bank Book" className="w-full h-40 object-cover rounded-xl border border-purple-100" />
                )}
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};

const AdminWrapper = () => {
  const [tab, setTab] = useState<'registrations' | 'requests'>('registrations');

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="flex gap-4 mb-10 border-b-2 border-purple-100">
        <button
          onClick={() => setTab('registrations')}
          className={`px-6 py-3 font-black text-lg transition ${tab === 'registrations'
            ? 'text-purple-600 border-b-2 border-purple-600'
            : 'text-gray-400 hover:text-gray-600'
            }`}
        >
          📋 ยืนยันการลงทะเบียน
        </button>
        <button
          onClick={() => setTab('requests')}
          className={`px-6 py-3 font-black text-lg transition ${tab === 'requests'
            ? 'text-purple-600 border-b-2 border-purple-600'
            : 'text-gray-400 hover:text-gray-600'
            }`}
        >
          💰 คำขอคืนเงิน
        </button>
      </div>

      {tab === 'registrations' ? <AdminRegistrationDashboard /> : <Dashboard />}
    </div>
  );
};

const AppContent = ({ onNavBack }: { onNavBack?: () => void }) => {
  const { user, loading, isAdminOrAccounting } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-8">
          <div className="relative">
            <div className="w-24 h-24 bg-purple-50 rounded-[2rem] animate-pulse" />
            <Loader2 className="w-12 h-12 text-purple-600 animate-spin absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <div className="text-center">
            <p className="text-gray-900 font-black text-2xl tracking-tight">กำลังเตรียมข้อมูล</p>
            <p className="text-purple-400 text-sm font-black uppercase tracking-widest mt-2">โปรดรอสักครู่...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white font-sans selection:bg-purple-100 selection:text-purple-900">
      <Toaster position="top-center" expand={true} richColors />
      <NotificationListener />
      <Navbar onBack={onNavBack} />
      <div className="relative overflow-hidden bg-gradient-to-b from-purple-50/30 to-white">
        <div className="absolute top-0 left-0 w-full h-[800px] bg-gradient-to-b from-purple-100/20 to-transparent pointer-events-none" />
        <div className="relative z-10">
          {!user ? <Login onBackClick={onNavBack} /> : isAdminOrAccounting ? <AdminWrapper /> : <Dashboard onBack={onNavBack} />}
        </div>
      </div>

      <footer className="py-24 px-6 border-t border-purple-100 text-center bg-white">
        <div className="flex items-center justify-center gap-4 mb-8">
          <div className="w-10 h-10 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-500 shadow-sm">
            <Zap className="w-5 h-5" />
          </div>
          <span className="text-lg font-black text-gray-400 uppercase tracking-widest">เงินประกันทันใจ v1.0</span>
        </div>
        <p className="text-sm font-black text-gray-400 uppercase tracking-tight max-w-sm mx-auto leading-relaxed">
          © 2026 ระบบขอคืนเงินประกันมิเตอร์ไฟฟ้าชั่วคราว<br />
          <span className="text-purple-400/60 font-bold">พัฒนาเพื่อความสะดวกของประชาชน</span>
        </p>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}
