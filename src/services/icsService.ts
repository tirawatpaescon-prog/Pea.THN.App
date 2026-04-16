import type { IcsNotificationPayload, UserSession } from '../types';

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

export interface IcsRefreshResult {
    accessToken: string;
    refreshToken?: string;
    expiresIn?: number;
}

interface AuthState { codeVerifier: string; role: 'staff' | 'installer'; }

function parseResponsePayload(response: Response) {
    return response.text().then((text) => {
        if (!text) {
            return null;
        }
        try {
            return JSON.parse(text);
        } catch {
            return null;
        }
    });
}

function generateRandomString(length: number) {
    const array = new Uint8Array(length);
    window.crypto.getRandomValues(array);
    return Array.from(array, (byte) => ('0' + byte.toString(16)).slice(-2)).join('');
}

function base64UrlEncode(buffer: ArrayBuffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i += 1) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256(message: string) {
    const encoded = new TextEncoder().encode(message);
    return await window.crypto.subtle.digest('SHA-256', encoded);
}

async function createCodeChallenge(verifier: string) {
    const hashed = await sha256(verifier);
    return base64UrlEncode(hashed);
}

export async function getIcsAuthUrl(role: 'staff' | 'installer'): Promise<string> {
    const state = generateRandomString(16);
    const codeVerifier = generateRandomString(64);
    const codeChallenge = await createCodeChallenge(codeVerifier);
    const redirectUri = `${window.location.origin}/auth/callback`;

    sessionStorage.setItem(`ics_pkce_${state}`, JSON.stringify({ codeVerifier, role }));

    const authUrl = new URL(import.meta.env.VITE_ICS_AUTH_URL ?? 'https://sso2.pea.co.th/realms/pea-users/protocol/openid-connect/auth');
    authUrl.searchParams.set('client_id', import.meta.env.VITE_ICS_CLIENT_ID ?? 'pea-ics');
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'openid profile email');
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('prompt', 'login');

    return authUrl.toString();
}

export async function restoreSessionFromCallback(code: string, state: string): Promise<UserSession> {
    const stored = sessionStorage.getItem(`ics_pkce_${state}`);
    if (!stored) {
        throw new Error('ไม่พบสถานะการล็อกอิน โปรดลองใหม่อีกครั้ง');
    }

    const authState = JSON.parse(stored) as AuthState;
    sessionStorage.removeItem(`ics_pkce_${state}`);

    const redirectUri = `${window.location.origin}/auth/callback`;
    const response = await fetch('/api/ics-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, codeVerifier: authState.codeVerifier, redirectUri })
    });

    const payload = await parseResponsePayload(response);
    if (!response.ok || !payload || !payload.success) {
        throw new Error(payload?.error || 'ไม่สามารถล็อกอินผ่าน PEA SSO ได้');
    }

    const result = payload.data;
    const displayName = result.displayName || result.userInfo?.name || result.userInfo?.preferred_username || 'PEA User';
    const employeeCode = result.employeeCode || result.userInfo?.preferred_username || `sso-${Date.now()}`;

    return {
        id: `ics-${employeeCode}`,
        displayName,
        role: authState.role,
        icsAccessToken: result.accessToken,
        icsRefreshToken: result.refreshToken,
        icsTokenExpiresAt: result.expiresIn ? new Date(Date.now() + result.expiresIn * 1000).toISOString() : undefined
    };
}

export async function loginIcsEmployee(employeeCode: string, password: string, role: 'staff' | 'installer'): Promise<UserSession> {
    const response = await fetch('/api/ics-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeCode, password, role })
    });

    const payload = await parseResponsePayload(response);
    if (!response.ok || !payload || !payload.success) {
        throw new Error(payload?.error || 'ไม่สามารถเข้าสู่ระบบด้วยรหัสพนักงานได้');
    }

    const result = payload.data;
    return {
        id: `ics-${result.employeeCode}`,
        displayName: result.displayName || result.employeeCode,
        role: result.role,
        icsAccessToken: result.accessToken,
        icsRefreshToken: result.refreshToken,
        icsTokenExpiresAt: result.expiresIn ? new Date(Date.now() + result.expiresIn * 1000).toISOString() : undefined
    };
}

export async function fetchIcsData(requestNumber: string, accessToken: string): Promise<IcsRequestPayload> {
    if (!accessToken) {
        throw new Error('ต้องล็อกอิน ICS ก่อนดึงข้อมูล');
    }

    const response = await fetch(`/api/ics-data?requestNumber=${encodeURIComponent(requestNumber)}`, {
        headers: {
            Authorization: `Bearer ${accessToken}`
        }
    });

    if (response.status === 440) {
        throw new Error('ICS_SESSION_EXPIRED');
    }

    const payload = await parseResponsePayload(response);
    if (!response.ok || !payload || !payload.success) {
        throw new Error(payload?.error || 'ไม่สามารถดึงข้อมูล ICS ได้');
    }
    return payload.data as IcsRequestPayload;
}

export async function fetchIcsNotification(notificationId: string, accessToken?: string): Promise<IcsNotificationPayload> {
    if (!notificationId) {
        throw new Error('notificationId is required');
    }

    const headers: Record<string, string> = { Accept: 'application/json' };
    if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
    }

    const response = await fetch(`/api/ics-notification?notificationId=${encodeURIComponent(notificationId)}`, {
        headers
    });

    const payload = await parseResponsePayload(response);
    if (!response.ok || !payload || !payload.success) {
        throw new Error(payload?.error || 'ไม่สามารถดึงข้อมูล Notification ได้');
    }

    return payload.data as IcsNotificationPayload;
}

export async function refreshIcsToken(refreshToken: string): Promise<IcsRefreshResult> {
    const response = await fetch('/api/ics-refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
    });

    const payload = await parseResponsePayload(response);
    if (!response.ok) {
        throw new Error(payload?.error || 'ไม่สามารถรีเฟรชโทเค็นได้');
    }

    if (!payload || !payload.success) {
        throw new Error(payload?.error || 'ไม่สามารถรีเฟรชโทเค็นได้');
    }

    return payload.data as IcsRefreshResult;
}
