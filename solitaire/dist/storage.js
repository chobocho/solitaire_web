/**
 * storage.ts - IndexedDB 기반 게임 자동저장
 *
 * DB: "solitaire-db" / ObjectStore: "saves" / key: "autosave"
 */
// ─── 상수 ──────────────────────────────────────────────────────────────────
const DB_NAME = 'solitaire-db';
const DB_VERSION = 1;
const STORE_NAME = 'saves';
const SAVE_KEY = 'autosave';
const SCHEMA_VER = 2;
// ─── GameStorage ───────────────────────────────────────────────────────────
export class GameStorage {
    constructor() {
        this.db = null;
    }
    async init() {
        return new Promise((resolve) => {
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            };
            req.onsuccess = (e) => {
                this.db = e.target.result;
                resolve();
            };
            req.onerror = () => {
                console.warn('IndexedDB 초기화 실패:', req.error);
                resolve();
            };
        });
    }
    async save(snapshot) {
        if (!this.db)
            return;
        return new Promise((resolve) => {
            const tx = this.db.transaction(STORE_NAME, 'readwrite');
            const st = tx.objectStore(STORE_NAME);
            const req = st.put(snapshot, SAVE_KEY);
            req.onsuccess = () => resolve();
            req.onerror = () => resolve();
        });
    }
    async load() {
        if (!this.db)
            return null;
        return new Promise((resolve) => {
            const tx = this.db.transaction(STORE_NAME, 'readonly');
            const st = tx.objectStore(STORE_NAME);
            const req = st.get(SAVE_KEY);
            req.onsuccess = () => {
                const data = req.result;
                if (!data || data.version !== SCHEMA_VER) {
                    resolve(null);
                    return;
                }
                resolve(data);
            };
            req.onerror = () => resolve(null);
        });
    }
    async clear() {
        if (!this.db)
            return;
        return new Promise((resolve) => {
            const tx = this.db.transaction(STORE_NAME, 'readwrite');
            const st = tx.objectStore(STORE_NAME);
            const req = st.delete(SAVE_KEY);
            req.onsuccess = () => resolve();
            req.onerror = () => resolve();
        });
    }
    async hasSave() {
        const snap = await this.load();
        return snap !== null;
    }
}
export function formatSavedAt(savedAt) {
    const d = new Date(savedAt);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
//# sourceMappingURL=storage.js.map