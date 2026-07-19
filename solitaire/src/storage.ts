/**
 * storage.ts - IndexedDB 기반 게임 자동저장
 *
 * DB: "solitaire-db" / ObjectStore: "saves" / key: "autosave"
 */

// ─── 저장 데이터 스키마 ────────────────────────────────────────────────────

export interface SavedCard {
  figure: number;
  number: number;
  isOpen: boolean;
}

export interface SavedDeck {
  cards: SavedCard[];
}

export interface GameSnapshot {
  version:   number;
  savedAt:   number;
  gameState: string;
  moveCount: number;
  elapsed:   number;
  decks:     SavedDeck[];
  history:   SavedMove[];
  /** deal() 직후 초기 배치 ("다시 하기"로 같은 배열 재시작용) */
  initialDeal?: SavedDeck[];
}

export interface SavedMove {
  type:          string;
  from:          number;
  to:            number;
  count:         number;
  didOpenCard:   boolean;
  wasteSnapshot: Array<{ figure: number; number: number }>;
}

// ─── 상수 ──────────────────────────────────────────────────────────────────

const DB_NAME    = 'solitaire-db';
const DB_VERSION = 1;
const STORE_NAME = 'saves';
const SAVE_KEY   = 'autosave';
const SCHEMA_VER = 2;

// ─── GameStorage ───────────────────────────────────────────────────────────

export class GameStorage {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };

      req.onsuccess = (e) => {
        this.db = (e.target as IDBOpenDBRequest).result;
        resolve();
      };

      req.onerror = () => {
        console.warn('IndexedDB 초기화 실패:', req.error);
        resolve();
      };
    });
  }

  async save(snapshot: GameSnapshot): Promise<void> {
    if (!this.db) return;
    return new Promise((resolve) => {
      const tx  = this.db!.transaction(STORE_NAME, 'readwrite');
      const st  = tx.objectStore(STORE_NAME);
      const req = st.put(snapshot, SAVE_KEY);
      req.onsuccess = () => resolve();
      req.onerror   = () => resolve();
    });
  }

  async load(): Promise<GameSnapshot | null> {
    if (!this.db) return null;
    return new Promise((resolve) => {
      const tx  = this.db!.transaction(STORE_NAME, 'readonly');
      const st  = tx.objectStore(STORE_NAME);
      const req = st.get(SAVE_KEY);

      req.onsuccess = () => {
        const data = req.result as GameSnapshot | undefined;
        if (!data || data.version !== SCHEMA_VER) {
          resolve(null);
          return;
        }
        resolve(data);
      };
      req.onerror = () => resolve(null);
    });
  }

  async clear(): Promise<void> {
    if (!this.db) return;
    return new Promise((resolve) => {
      const tx  = this.db!.transaction(STORE_NAME, 'readwrite');
      const st  = tx.objectStore(STORE_NAME);
      const req = st.delete(SAVE_KEY);
      req.onsuccess = () => resolve();
      req.onerror   = () => resolve();
    });
  }

  async hasSave(): Promise<boolean> {
    const snap = await this.load();
    return snap !== null;
  }
}

export function formatSavedAt(savedAt: number): string {
  const d = new Date(savedAt);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
