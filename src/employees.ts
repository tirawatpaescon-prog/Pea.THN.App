/**
 * Employee Database
 * เก็บข้อมูลพนักงานที่มีสิทธิ์เข้าร่วมระบบ
 */

export interface Employee {
    id: string;
    email: string;
    password: string; // ในการใช้งานจริง ต้องใช้ hashed password
    displayName: string;
    department: 'admin' | 'accounting' | 'other';
    phone?: string;
    status: 'active' | 'inactive';
    createdAt: string;
    updatedAt?: string;
}

export const EMPLOYEE_LIST: Employee[] = [
    {
        id: 'EMP001',
        email: 'tirawat.p.aescon@gmail.com',
        password: 'Admin12345', // Demo only - use hashed in production
        displayName: 'Tirawat Ponkete',
        department: 'admin',
        phone: '081-2345-6789',
        status: 'active',
        createdAt: '2024-01-01T00:00:00Z'
    },
    {
        id: 'EMP002',
        email: 'accountant@company.com',
        password: 'Account12345', // Demo only
        displayName: 'Niran Sunthara',
        department: 'accounting',
        phone: '089-8765-4321',
        status: 'active',
        createdAt: '2024-01-15T00:00:00Z'
    }
    // เพิ่มพนักงานคนอื่นๆ ที่นี่
];

/**
 * ค้นหาพนักงานด้วย username (ใช้ email ส่วนแรก)
 */
export const findEmployeeByUsername = (username: string): Employee | undefined => {
    const normalized = username.trim().toLowerCase();
    return EMPLOYEE_LIST.find(emp => {
        const empUsername = emp.email.split('@')[0].toLowerCase();
        return empUsername === normalized || emp.id.toLowerCase() === normalized;
    });
};

/**
 * ค้นหาพนักงานด้วยอีเมล
 */
export const findEmployeeByEmail = (email: string): Employee | undefined => {
    return EMPLOYEE_LIST.find(emp => emp.email === email);
};

/**
 * ค้นหาพนักงานด้วย ID
 */
export const findEmployeeById = (id: string): Employee | undefined => {
    return EMPLOYEE_LIST.find(emp => emp.id === id);
};

/**
 * ตรวจสอบครั้นพนักงานว่า active หรือไม่
 */
export const isEmployeeActive = (email: string): boolean => {
    const emp = findEmployeeByEmail(email);
    return emp?.status === 'active' ? true : false;
};

/**
 * ตรวจสอบรหัสผ่าน (Demo only - ในการใช้งานจริงต้องใช้ hashed)
 */
export const verifyEmployeePassword = (email: string, password: string): boolean => {
    const emp = findEmployeeByEmail(email);
    if (!emp || emp.status !== 'active') return false;
    // ในการใช้งานจริง: return bcrypt.compare(password, emp.password);
    return emp.password === password;
};

/**
 * ดึงรายชื่อพนักงานที่ active
 */
export const getActiveEmployees = (): Employee[] => {
    return EMPLOYEE_LIST.filter(emp => emp.status === 'active');
};

/**
 * นับพนักงานตามแผนก
 */
export const countEmployeesByDepartment = (department: 'admin' | 'accounting' | 'other'): number => {
    return EMPLOYEE_LIST.filter(
        emp => emp.department === department && emp.status === 'active'
    ).length;
};
