export interface UserData {
  id: string;
  name: string;
  meterId: string;
  address: string;
  amount: number;
  status: string;
}

export interface RefundRequest {
  id?: string;
  fullName: string;
  idCard: string;
  phone: string;
  address: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  idCardUrl: string;
  billUrl: string;
  bookBankUrl: string;
  status: 'pending' | 'processing' | 'completed' | 'rejected';
  createdAt: any;
  updatedAt: any;
  slipImage?: string;
  signerName?: string;
  completedAt?: any;
}

export type UserRole = 'admin' | 'staff' | 'installer' | 'customer';

export interface UserSession {
  id: string;
  displayName: string;
  role: UserRole;
  icsAccessToken?: string;
  icsRefreshToken?: string;
  icsTokenExpiresAt?: string;
  customerIdCard?: string;
  customerPhone?: string;
}

export interface IcsRequestPayload {
  requestNumber: string;
  CA: string;
  fullName: string;
  address: string;
  depositAmount: number;
  meterType: number;
  officeCode: string;
  managementType: string;
  lat: number;
  lng: number;
}

export interface IcsNotificationPayload {
  notificationType: string;
  notificationId: string;
  name: string;
  online: number;
  remain: number;
  message: string;
  success: boolean;
}

export interface WorkflowRequest extends IcsRequestPayload {
  status: 'Pending' | 'Assigned' | 'Installed' | 'Disconnected' | 'Completed';
  createdAt: string;
  updatedAt: string;
  meterNumber?: string;
  caNumber?: string;
  requesterFullName?: string;
  requesterIdCard?: string;
  requesterPhone?: string;
  meterSize?: string;
  vendorName?: string;
  customerApproved?: boolean;
  electricityBillAmount?: number;
  refundAmount?: number;
  attachments?: string[];
}
