import React, { useMemo, useState, useEffect } from 'react';
import { collection, doc, getDoc, getDocs, orderBy, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { db } from './firebase';
import { useRealtimeCollection } from './hooks/useRealtime';
import { handleUpload } from './services/storage';
import { fetchIcsData, fetchIcsNotification, loginIcsEmployee, refreshIcsToken } from './services/icsService';
import { LoginPage } from './components/LoginPage';
import { PEALogo } from './components/PEALogo';
import { SessionExpireModal } from './components/SessionExpireModal';
import { SharedDashboard } from './components/SharedDashboard';
import type { IcsNotificationPayload, IcsRequestPayload, UserSession, WorkflowRequest } from './types';

const SESSION_STORAGE_KEY = 'pea_explorer_session';

interface CustomerRegistration {
    fullName: string;
    phone: string;
    idCardNumber: string;
    status: string;
}

function getPersistedSession(): UserSession | null {
    if (typeof window === 'undefined') return null;
    const stored = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!stored) return null;
    try {
        return JSON.parse(stored) as UserSession;
    } catch {
        return null;
    }
}

function persistSession(session: UserSession | null) {
    if (typeof window === 'undefined') return;
    if (!session) {
        localStorage.removeItem(SESSION_STORAGE_KEY);
        return;
    }
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

const OFFICE_FILTERS = ['กฟส.ท่าคันโท'] as const;

export const PeaApp = () => {
    const [user, setUser] = useState<UserSession | null>(() => getPersistedSession());
    const [activeError, setActiveError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [sessionExpired, setSessionExpired] = useState(false);
    const [searchRequestNumber, setSearchRequestNumber] = useState('');
    const [fetchMessage, setFetchMessage] = useState<string | null>(null);
    const [officeFilter, setOfficeFilter] = useState<string>('กฟส.ท่าคันโท');
    const [customerRequests, setCustomerRequests] = useState<(WorkflowRequest & { id: string })[]>([]);
    const [customerLoading, setCustomerLoading] = useState(false);
    const [notificationId, setNotificationId] = useState('Y101');
    const [notificationData, setNotificationData] = useState<IcsNotificationPayload | null>(null);
    const [notificationLoading, setNotificationLoading] = useState(false);
    const [notificationError, setNotificationError] = useState<string | null>(null);
    const [creatingRequest, setCreatingRequest] = useState(false);
    const [newRequestData, setNewRequestData] = useState({
        requesterFullName: '',
        requesterIdCard: '',
        requesterPhone: '',
        address: '',
        meterSize: '',
        meterNumber: '',
        caNumber: '',
        vendorName: '',
        depositAmount: 4000,
        managementType: 'New Installation' as 'New Installation' | 'Disconnection'
    });

    const requestQuery = query(collection(db, 'requests'), orderBy('createdAt', 'desc'));
    const { data, loading: requestsLoading } = useRealtimeCollection<WorkflowRequest>(requestQuery, [officeFilter]);
    const requests: WorkflowRequest[] = data ?? [];

    const filteredRequests = useMemo(() => {
        const normalizedOffice = officeFilter.trim().toLowerCase();
        return requests.filter((request) => normalizedOffice === 'all' || request.officeCode === officeFilter);
    }, [officeFilter, requests]);

    const pendingRequests = filteredRequests.filter((request) => request.status === 'Pending');

    const saveUserSession = (nextUser: UserSession | null) => {
        setUser(nextUser);
        persistSession(nextUser);
    };

    const loadCustomerRequests = async (idCard: string, phone: string) => {
        setCustomerLoading(true);
        try {
            const customerQuery = query(
                collection(db, 'requests'),
                where('requesterIdCard', '==', idCard),
                where('requesterPhone', '==', phone)
            );
            const snapshot = await getDocs(customerQuery);
            const requests = snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as WorkflowRequest) }));
            setCustomerRequests(requests);
        } finally {
            setCustomerLoading(false);
        }
    };

    const handleCustomerLogin = async (idCard: string, phone: string) => {
        setActiveError(null);
        if (!idCard || !phone) {
            throw new Error('กรุณากรอกเลขบัตรประชาชนและเบอร์โทรศัพท์');
        }

        const customerQuery = query(
            collection(db, 'requests'),
            where('requesterIdCard', '==', idCard),
            where('requesterPhone', '==', phone)
        );

        const snapshot = await getDocs(customerQuery);
        if (snapshot.empty) {
            throw new Error('ไม่พบข้อมูลลูกค้าในระบบ หรือยังไม่มีคำร้องในพื้นที่นี้');
        }

        const request = snapshot.docs[0].data() as WorkflowRequest;
        const customerSession: UserSession = {
            id: snapshot.docs[0].id,
            displayName: request.requesterFullName || request.fullName || 'ลูกค้า PEA',
            role: 'customer',
            customerIdCard: idCard,
            customerPhone: phone
        };

        setCustomerRequests(snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as WorkflowRequest) })));
        saveUserSession(customerSession);
    };

    const handleStaffInstallerLogin = async (role: 'staff' | 'installer', employeeCode: string, password: string) => {
        setActiveError(null);
        if (!employeeCode.trim() || !password.trim()) {
            throw new Error('กรุณากรอกบัญชีผู้ใช้งานและรหัสผ่าน');
        }

        try {
            setLoading(true);
            const session = await loginIcsEmployee(employeeCode.trim(), password, role);
            saveUserSession(session);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'ไม่สามารถเข้าสู่ระบบได้';
            setActiveError(message);
            throw new Error(message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user?.role === 'customer' && user.customerIdCard && user.customerPhone) {
            loadCustomerRequests(user.customerIdCard, user.customerPhone).catch((error) => {
                console.error('Failed to load customer requests', error);
            });
        }
    }, [user]);

    const handleCreateRequest = async () => {
        if (!newRequestData.requesterFullName.trim() || !newRequestData.requesterIdCard.trim() || !newRequestData.requesterPhone.trim() || !newRequestData.address.trim() || !newRequestData.meterSize.trim() || !newRequestData.vendorName.trim() || !newRequestData.meterNumber.trim() || !newRequestData.caNumber.trim()) {
            throw new Error('กรุณากรอกข้อมูลคำร้องให้ครบถ้วน');
        }

        setCreatingRequest(true);
        try {
            const requestNumber = `REQ-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`;
            await setDoc(doc(db, 'requests', requestNumber), {
                requestNumber,
                CA: newRequestData.caNumber.trim(),
                fullName: newRequestData.requesterFullName.trim(),
                address: newRequestData.address.trim(),
                depositAmount: Number(newRequestData.depositAmount) || 4000,
                meterType: newRequestData.managementType === 'Disconnection' ? 8115 : 8114,
                officeCode: 'กฟส.ท่าคันโท',
                managementType: newRequestData.managementType,
                lat: 16.397,
                lng: 103.505,
                status: 'Pending',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                meterNumber: newRequestData.meterNumber.trim(),
                caNumber: newRequestData.caNumber.trim(),
                requesterFullName: newRequestData.requesterFullName.trim(),
                requesterIdCard: newRequestData.requesterIdCard.trim(),
                requesterPhone: newRequestData.requesterPhone.trim(),
                meterSize: newRequestData.meterSize.trim(),
                vendorName: newRequestData.vendorName.trim(),
                customerApproved: false,
                attachments: []
            });
            setNewRequestData({
                requesterFullName: '',
                requesterIdCard: '',
                requesterPhone: '',
                address: '',
                meterSize: '',
                meterNumber: '',
                caNumber: '',
                vendorName: '',
                depositAmount: 4000,
                managementType: 'New Installation'
            });
            setFetchMessage('สร้างคำร้องใหม่เรียบร้อยแล้ว');
        } finally {
            setCreatingRequest(false);
        }
    };

    const handleCustomerApproveTransfer = async (requestId: string) => {
        setCustomerLoading(true);
        try {
            await updateDoc(doc(db, 'requests', requestId), {
                status: 'Completed',
                customerApproved: true,
                updatedAt: new Date().toISOString()
            });
            setCustomerRequests((prev) => prev.map((request) => request.requestNumber === requestId ? { ...request, status: 'Completed', customerApproved: true } : request));
            setFetchMessage('คุณได้ยืนยันการโอนเงินคืนเรียบร้อยแล้ว');
        } finally {
            setCustomerLoading(false);
        }
    };

    const refreshIcsSession = async () => {
        if (!user?.icsRefreshToken) {
            throw new Error('รีเฟรชโทเค็นไม่พร้อมใช้งาน กรุณาล็อกอินใหม่');
        }

        const refreshed = await refreshIcsToken(user.icsRefreshToken);
        if (!refreshed || !refreshed.accessToken) {
            throw new Error('ไม่สามารถรีเฟรช ICS session ได้');
        }

        const updatedSession: UserSession = {
            ...user,
            icsAccessToken: refreshed.accessToken,
            icsRefreshToken: refreshed.refreshToken ?? user.icsRefreshToken,
            icsTokenExpiresAt: refreshed.expiresIn ? new Date(Date.now() + refreshed.expiresIn * 1000).toISOString() : user.icsTokenExpiresAt
        };

        saveUserSession(updatedSession);
        return updatedSession;
    };

    const handleLogout = () => {
        saveUserSession(null);
        setActiveError(null);
        setSearchRequestNumber('');
        setFetchMessage(null);
        setSessionExpired(false);
    };

    const upsertRequestDocument = async (payload: IcsRequestPayload) => {
        const requestRef = doc(db, 'requests', payload.requestNumber);
        const snapshot = await getDoc(requestRef);
        const now = new Date().toISOString();
        const baseDoc = {
            ...payload,
            status: 'Pending' as const,
            createdAt: snapshot.exists() ? snapshot.data()?.createdAt || now : now,
            updatedAt: now
        };
        await setDoc(requestRef, baseDoc, { merge: true });
    };

    const upsertGlobalData = async (payload: IcsRequestPayload) => {
        const globalRef = doc(db, 'global_data', payload.requestNumber);
        const now = new Date().toISOString();
        await setDoc(globalRef, { ...payload, createdAt: now, updatedAt: now }, { merge: true });
    };

    const handleFetchRequest = async () => {
        setFetchMessage(null);
        if (!searchRequestNumber.trim()) {
            setFetchMessage('กรุณากรอกเลขที่คำร้องเพื่อดึงข้อมูล');
            return;
        }
        if (searchRequestNumber.trim().toUpperCase() === 'EXPIRE') {
            setSessionExpired(true);
            setFetchMessage('จำลองระบบ ICS หลุด โปรดล็อกอินใหม่โดยไม่รีเฟรชหน้าเว็บ');
            return;
        }

        try {
            setLoading(true);
            if (!user?.icsAccessToken) {
                throw new Error('กรุณาเข้าสู่ระบบ ICS ก่อนใช้งาน');
            }

            let payload = await fetchIcsData(searchRequestNumber.trim(), user.icsAccessToken);
            const shouldCreateWorkflow = payload.managementType === 'New Installation' && [8114, 8115].includes(payload.meterType);

            if (shouldCreateWorkflow) {
                await upsertRequestDocument(payload);
                setFetchMessage('สร้างคำร้อง Workflow ใหม่ใน Firestore แล้ว (สถานะ Pending)');
            } else {
                await upsertGlobalData(payload);
                setFetchMessage('บันทึกข้อมูลใน global_data แล้ว โดยไม่ได้เข้า Workflow');
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดระหว่างดึงข้อมูล';
            if (message === 'ICS_SESSION_EXPIRED' && user?.icsRefreshToken) {
                try {
                    const refreshed = await refreshIcsSession();
                    const payload = await fetchIcsData(searchRequestNumber.trim(), refreshed.icsAccessToken!);
                    const shouldCreateWorkflow = payload.managementType === 'New Installation' && [8114, 8115].includes(payload.meterType);

                    if (shouldCreateWorkflow) {
                        await upsertRequestDocument(payload);
                        setFetchMessage('รีเฟรช session สำเร็จแล้ว และสร้างคำร้อง Workflow ใหม่ใน Firestore');
                    } else {
                        await upsertGlobalData(payload);
                        setFetchMessage('รีเฟรช session สำเร็จแล้ว และบันทึกข้อมูลใน global_data');
                    }
                } catch (refreshError) {
                    setSessionExpired(true);
                    setFetchMessage(refreshError instanceof Error ? refreshError.message : 'Session ICS หมดอายุ กรุณาเข้าสู่ระบบใหม่');
                }
            } else if (message === 'ICS_SESSION_EXPIRED') {
                setSessionExpired(true);
                setFetchMessage('Session ICS หลุด จำเป็นต้องล็อกอินใหม่');
            } else {
                setFetchMessage(message);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleFetchNotification = async () => {
        setNotificationError(null);
        setNotificationLoading(true);
        try {
            const payload = await fetchIcsNotification(notificationId.trim(), user?.icsAccessToken);
            setNotificationData(payload);
        } catch (error) {
            setNotificationData(null);
            setNotificationError(error instanceof Error ? error.message : 'ไม่สามารถโหลดข้อมูล Notification ได้');
        } finally {
            setNotificationLoading(false);
        }
    };

    const handleUpdateRequest = async (requestId: string, meterNumber: string, file?: File) => {
        if (!requestId) {
            throw new Error('ต้องระบุคำร้อง');
        }
        if (!meterNumber.trim()) {
            throw new Error('กรุณาระบุหมายเลขมิเตอร์ก่อนบันทึก');
        }
        const requestRef = doc(db, 'requests', requestId);
        const updatePayload: Partial<WorkflowRequest> = {
            meterNumber: meterNumber.trim(),
            updatedAt: new Date().toISOString()
        };

        if (file) {
            const url = await handleUpload(`requests/${requestId}/${Date.now()}-${file.name}`, file);
            updatePayload.attachments = Array.isArray((await getDoc(requestRef)).data()?.attachments)
                ? [...((await getDoc(requestRef)).data()?.attachments as string[]), url]
                : [url];
        }

        await updateDoc(requestRef, updatePayload);
    };

    const handleChangeStatus = async (requestId: string, status: WorkflowRequest['status']) => {
        await updateDoc(doc(db, 'requests', requestId), {
            status,
            updatedAt: new Date().toISOString()
        });
    };

    const customerPortal = (
        <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6">
            <div className="mx-auto max-w-5xl space-y-6">
                <div className="rounded-[2rem] bg-white border border-slate-200 p-8 shadow-2xl">
                    <div className="flex items-center gap-4 border-b border-slate-200 pb-6 mb-6">
                        <PEALogo className="w-16 h-16" />
                        <div>
                            <h1 className="text-3xl font-black text-slate-900">Customer Dashboard</h1>
                            <p className="text-sm text-slate-600">สวัสดีคุณ {user?.displayName} คุณสามารถดูคำร้องและผลการคืนเงินได้ที่นี่</p>
                        </div>
                    </div>
                    <div className="rounded-[2rem] bg-slate-50 p-6 text-slate-700">
                        <p className="text-sm">หน้าลูกค้าจะเชื่อมต่อข้อมูลคำร้องของคุณด้วยเลขบัตรประชาชนและเบอร์โทรศัพท์</p>
                        <p className="mt-4 text-xs text-slate-500">หลังจากผู้ติดตั้งบันทึกหมายเลขมิเตอร์และ CA คุณสามารถยืนยันการโอนเงินคืนได้เอง</p>
                    </div>
                </div>

                {customerLoading ? (
                    <div className="rounded-[2rem] bg-white border border-slate-200 p-8 text-center text-slate-500 shadow-sm">กำลังโหลดคำร้องของคุณ...</div>
                ) : customerRequests.length === 0 ? (
                    <div className="rounded-[2rem] bg-white border border-slate-200 p-8 text-center text-slate-500 shadow-sm">
                        ยังไม่มีคำร้องที่เชื่อมโยงกับบัญชีของคุณ
                    </div>
                ) : (
                    customerRequests.map((request) => {
                        const refundAmount = request.refundAmount ?? ((request.depositAmount ?? 0) - (request.electricityBillAmount ?? 0));
                        const canApprove = request.status === 'Installed' || request.status === 'Disconnected';

                        return (
                            <article key={request.requestNumber} className="rounded-[2rem] bg-white border border-slate-200 p-6 shadow-sm">
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                    <div className="space-y-3">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-black text-violet-700">{request.officeCode}</span>
                                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-800">{request.managementType}</span>
                                            <span className={`rounded-full px-3 py-1 text-xs font-black ${request.status === 'Pending' ? 'bg-amber-100 text-amber-800' : request.status === 'Installed' ? 'bg-emerald-100 text-emerald-800' : request.status === 'Disconnected' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>{request.status}</span>
                                        </div>
                                        <p className="text-sm text-slate-600">คำร้อง: <span className="font-black text-slate-900">{request.requestNumber}</span></p>
                                        <p className="text-sm text-slate-600">ชื่อผู้ขอ: <span className="font-bold">{request.requesterFullName || request.fullName}</span></p>
                                        <p className="text-sm text-slate-600">เลขบัตรประชาชน: <span className="font-bold">{request.requesterIdCard}</span></p>
                                        <p className="text-sm text-slate-600">ที่อยู่: <span className="font-bold">{request.address}</span></p>
                                        <p className="text-sm text-slate-600">ผู้ติดตั้ง: <span className="font-bold">{request.vendorName || 'ยังไม่ระบุ'}</span></p>
                                        <div className="grid gap-2 sm:grid-cols-2">
                                            <div className="rounded-3xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                                                <p>เลขมิเตอร์ PEA: <span className="font-bold">{request.meterNumber || 'รอผู้ติดตั้งกรอก'}</span></p>
                                            </div>
                                            <div className="rounded-3xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                                                <p>CA Number: <span className="font-bold">{request.caNumber || 'รอผู้ติดตั้งกรอก'}</span></p>
                                            </div>
                                        </div>
                                        <div className="grid gap-2 sm:grid-cols-2">
                                            <div className="rounded-3xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                                                <p>ยอดเงินประกัน: <span className="font-bold">{request.depositAmount?.toLocaleString()} บาท</span></p>
                                            </div>
                                            <div className="rounded-3xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                                                <p>ยอดคืนเงิน: <span className="font-bold">{request.electricityBillAmount != null ? `${refundAmount.toLocaleString()} บาท` : 'รอคำนวณยอดคืน'}</span></p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="grid gap-3 sm:w-72">
                                        <div className="rounded-3xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                                            <p>อัปเดตล่าสุด: {new Date(request.updatedAt).toLocaleDateString('th-TH')}</p>
                                        </div>
                                        {request.status === 'Completed' && (
                                            <div className="rounded-3xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700 font-black">คำร้องปิดเรียบร้อยแล้ว</div>
                                        )}
                                        {canApprove && !request.customerApproved && (
                                            <button
                                                type="button"
                                                onClick={() => handleCustomerApproveTransfer(request.requestNumber)}
                                                disabled={customerLoading}
                                                className="rounded-3xl bg-blue-600 px-4 py-3 text-white font-black text-sm hover:bg-blue-700 transition"
                                            >
                                                {customerLoading ? 'กำลังยืนยัน...' : 'ยืนยันการโอนเงินคืน'}
                                            </button>
                                        )}
                                        {request.customerApproved && (
                                            <div className="rounded-3xl bg-blue-50 px-4 py-3 text-sm text-blue-700">คุณได้ยืนยันการโอนเงินคืนแล้ว</div>
                                        )}
                                    </div>
                                </div>
                            </article>
                        );
                    })
                )}
            </div>
        </div>
    );

    const adminPanel = (
        <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6">
            <div className="mx-auto max-w-6xl space-y-6">
                <div className="flex flex-col gap-4 rounded-[2rem] bg-white border border-slate-200 p-8 shadow-2xl sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-3xl font-black text-slate-900">Admin Panel</h1>
                        <p className="text-sm text-slate-600">มุมมองสำหรับผู้ดูแลระบบ เพื่อดูภาพรวม Workflow และ global_data</p>
                    </div>
                    <div className="rounded-3xl bg-violet-700 px-5 py-4 text-white font-black">Total requests {filteredRequests.length}</div>
                </div>

                <div className="grid gap-6 lg:grid-cols-3">
                    <div className="rounded-[2rem] bg-white border border-slate-200 p-6 shadow-sm">
                        <p className="text-sm text-slate-500">Pending</p>
                        <p className="mt-4 text-3xl font-black text-slate-900">{pendingRequests.length}</p>
                    </div>
                    <div className="rounded-[2rem] bg-white border border-slate-200 p-6 shadow-sm">
                        <p className="text-sm text-slate-500">Office</p>
                        <p className="mt-4 text-lg font-black text-slate-900">{officeFilter === 'all' ? 'ทุกพื้นที่' : officeFilter}</p>
                    </div>
                    <div className="rounded-[2rem] bg-white border border-slate-200 p-6 shadow-sm">
                        <p className="text-sm text-slate-500">Session status</p>
                        <p className="mt-4 text-lg font-black text-slate-900">{sessionExpired ? 'ICS หลุด' : 'เชื่อมต่ออยู่'}</p>
                    </div>
                </div>

                <div className="rounded-[2rem] bg-white border border-slate-200 p-6 shadow-sm">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4">
                        <div>
                            <h2 className="text-xl font-black text-slate-900">สร้างคำร้องใหม่</h2>
                            <p className="text-sm text-slate-500">กรอกข้อมูลผู้ขอ, หมายเลขมิเตอร์ PEA, CA และผู้ติดตั้งเพื่อส่งต่อให้ทีมงาน</p>
                        </div>
                        <span className="rounded-full bg-violet-100 px-4 py-2 text-xs font-black text-violet-700">สำนักงาน กฟส.ท่าคันโท เท่านั้น</span>
                    </div>
                    <div className="grid gap-4 lg:grid-cols-2">
                        <div className="space-y-4">
                            <div>
                                <label className="text-sm font-black text-slate-700">ชื่อผู้ขอ</label>
                                <input
                                    type="text"
                                    value={newRequestData.requesterFullName}
                                    onChange={(event) => setNewRequestData((prev) => ({ ...prev, requesterFullName: event.target.value }))}
                                    className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-violet-500"
                                    placeholder="ชื่อผู้ขอ"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-black text-slate-700">เลขบัตรประชาชน</label>
                                <input
                                    type="text"
                                    value={newRequestData.requesterIdCard}
                                    onChange={(event) => setNewRequestData((prev) => ({ ...prev, requesterIdCard: event.target.value }))}
                                    className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-violet-500"
                                    placeholder="เลขบัตรประชาชน 13 หลัก"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-black text-slate-700">เบอร์โทรศัพท์</label>
                                <input
                                    type="tel"
                                    value={newRequestData.requesterPhone}
                                    onChange={(event) => setNewRequestData((prev) => ({ ...prev, requesterPhone: event.target.value }))}
                                    className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-violet-500"
                                    placeholder="08xxxxxxxx"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-black text-slate-700">ที่อยู่ผู้ขอ</label>
                                <textarea
                                    value={newRequestData.address}
                                    onChange={(event) => setNewRequestData((prev) => ({ ...prev, address: event.target.value }))}
                                    className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-violet-500"
                                    placeholder="ที่อยู่"
                                />
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="text-sm font-black text-slate-700">ขนาดมิเตอร์</label>
                                <input
                                    type="text"
                                    value={newRequestData.meterSize}
                                    onChange={(event) => setNewRequestData((prev) => ({ ...prev, meterSize: event.target.value }))}
                                    className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-violet-500"
                                    placeholder="เช่น 15/45 A"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-black text-slate-700">หมายเลขมิเตอร์ PEA</label>
                                <input
                                    type="text"
                                    value={newRequestData.meterNumber}
                                    onChange={(event) => setNewRequestData((prev) => ({ ...prev, meterNumber: event.target.value }))}
                                    className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-violet-500"
                                    placeholder="หมายเลขมิเตอร์ PEA"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-black text-slate-700">CA Number</label>
                                <input
                                    type="text"
                                    value={newRequestData.caNumber}
                                    onChange={(event) => setNewRequestData((prev) => ({ ...prev, caNumber: event.target.value }))}
                                    className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-violet-500"
                                    placeholder="CA Number"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-black text-slate-700">ผู้รับเหมา / ผู้ติดตั้ง</label>
                                <input
                                    type="text"
                                    value={newRequestData.vendorName}
                                    onChange={(event) => setNewRequestData((prev) => ({ ...prev, vendorName: event.target.value }))}
                                    className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-violet-500"
                                    placeholder="ชื่อผู้ติดตั้ง"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-black text-slate-700">ประเภทคำร้อง</label>
                                <select
                                    value={newRequestData.managementType}
                                    onChange={(event) => setNewRequestData((prev) => ({ ...prev, managementType: event.target.value as 'New Installation' | 'Disconnection' }))}
                                    className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-violet-500"
                                >
                                    <option value="New Installation">ติดตั้งใหม่</option>
                                    <option value="Disconnection">ถอดถอน</option>
                                </select>
                            </div>
                            <div className="flex flex-wrap gap-3 mt-4">
                                <button
                                    type="button"
                                    onClick={handleCreateRequest}
                                    disabled={creatingRequest}
                                    className="rounded-3xl bg-violet-700 px-6 py-3 text-sm font-black text-white hover:bg-violet-800 transition"
                                >
                                    {creatingRequest ? 'กำลังสร้าง...' : 'สร้างคำร้องใหม่'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setNewRequestData({
                                        requesterFullName: '',
                                        requesterIdCard: '',
                                        requesterPhone: '',
                                        address: '',
                                        meterSize: '',
                                        meterNumber: '',
                                        caNumber: '',
                                        vendorName: '',
                                        depositAmount: 4000,
                                        managementType: 'New Installation'
                                    })}
                                    className="rounded-3xl border border-slate-200 bg-white px-6 py-3 text-sm font-black text-slate-700 hover:bg-slate-100 transition"
                                >
                                    ล้างฟอร์ม
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="rounded-[2rem] bg-white border border-slate-200 p-6 shadow-sm">
                    <h2 className="text-xl font-black text-slate-900 mb-4">รายการคำร้องทั้งหมด</h2>
                    <div className="grid gap-4">
                        {filteredRequests.slice(0, 20).map((request) => (
                            <div key={request.requestNumber} className="rounded-3xl border border-slate-200 p-4">
                                <div className="flex items-center justify-between gap-3">
                                    <p className="font-black text-slate-900">{request.requestNumber} - {request.status}</p>
                                    <span className="text-xs text-slate-500">{request.officeCode}</span>
                                </div>
                                <p className="mt-2 text-sm text-slate-600">{request.fullName} | {request.meterType}</p>
                                <p className="mt-1 text-sm text-slate-600">{request.address}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );

    if (!user) {
        return (
            <LoginPage
                onStaffInstallerLogin={handleStaffInstallerLogin}
                onCustomerLogin={handleCustomerLogin}
                loading={loading}
                error={activeError}
            />
        );
    }

    return (
        <>
            {user.role === 'admin' || user.role === 'staff' ? (
                adminPanel
            ) : user.role === 'customer' ? (
                customerPortal
            ) : (
                <SharedDashboard
                    user={user}
                    requests={filteredRequests}
                    loading={requestsLoading}
                    officeFilter={officeFilter}
                    selectedOffice={officeFilter}
                    searchRequestNumber={searchRequestNumber}
                    fetchMessage={fetchMessage}
                    notificationId={notificationId}
                    notificationData={notificationData}
                    notificationLoading={notificationLoading}
                    notificationError={notificationError}
                    onNotificationIdChange={setNotificationId}
                    onFetchNotification={handleFetchNotification}
                    onSearchTermChange={setSearchRequestNumber}
                    onFetchRequest={handleFetchRequest}
                    onOfficeFilterChange={setOfficeFilter}
                    onNavigate={(lat, lng) => window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank')}
                    onUpdateRequest={handleUpdateRequest}
                    onChangeStatus={handleChangeStatus}
                    sessionExpired={sessionExpired}
                    onOpenSessionModal={() => setSessionExpired(true)}
                />
            )}
            <div className="fixed bottom-6 right-6 z-40">
                <button
                    type="button"
                    onClick={handleLogout}
                    className="rounded-full bg-slate-900 px-5 py-3 text-sm font-black text-white shadow-xl hover:bg-slate-800 transition"
                >
                    ออกจากระบบ
                </button>
            </div>

            <SessionExpireModal
                open={sessionExpired}
                userRole={user?.role === 'installer' ? 'installer' : 'staff'}
                onSubmit={async () => {
                    handleLogout();
                    setSessionExpired(false);
                }}
                onClose={() => setSessionExpired(false)}
                error={activeError}
            />
        </>
    );
};
