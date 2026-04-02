export interface ElectricityUser {
  meterNumber: string;
  accountNumber: string;
  fullName: string;
  usageType: string; // e.g., '8114', '8115'
}

export const VALID_USERS: ElectricityUser[] = [
  {
    meterNumber: '1234567890',
    accountNumber: '9876543210',
    fullName: 'สมชาย ใจดี',
    usageType: '8114'
  },
  {
    meterNumber: '2233445566',
    accountNumber: '6655443322',
    fullName: 'สมหญิง รักเรียน',
    usageType: '8115'
  },
  {
    meterNumber: '1112223334',
    accountNumber: '4443332221',
    fullName: 'มานะ อดทน',
    usageType: '8114'
  },
  {
    meterNumber: '5556667778',
    accountNumber: '8887776665',
    fullName: 'ชูใจ ร่าเริง',
    usageType: '8115'
  },
  // Users with other usage types (should not be able to request)
  {
    meterNumber: '9998887776',
    accountNumber: '6667778889',
    fullName: 'ปิติ ยินดี',
    usageType: '1111'
  }
];
