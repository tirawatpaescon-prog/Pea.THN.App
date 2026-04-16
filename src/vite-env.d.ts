/// <reference types="vite/client" />

declare global {
    interface ImportMetaEnv {
        readonly VITE_ICS_AUTH_URL?: string;
        readonly VITE_ICS_CLIENT_ID?: string;
        readonly VITE_ICS_REDIRECT_URI?: string;
    }

    interface ImportMeta {
        readonly env: ImportMetaEnv;
    }
}

export { };