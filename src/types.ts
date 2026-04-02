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
