import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { FamilyTree } from '../models/index';

const DB_NAME = 'genealogy_db';
const DB_VERSION = 1;
const STORE_TREES = 'family_trees';
const LS_KEY = 'genealogy_trees';  // LocalStorage fallback key

@Injectable({ providedIn: 'root' })
export class StorageService {
  private db: IDBDatabase | null = null;
  private useLocalStorage = false;

  // Reactive cache of all trees
  private _trees$ = new BehaviorSubject<FamilyTree[]>([]);
  readonly trees$ = this._trees$.asObservable();

  constructor() {
    this.initStorage();
  }

  // ── Initialisation ───────────────────────────

  private async initStorage(): Promise<void> {
    try {
      this.db = await this.openIndexedDB();
      const trees = await this.loadAllFromIDB();
      this._trees$.next(trees);
    } catch {
      console.warn('IndexedDB unavailable, falling back to localStorage');
      this.useLocalStorage = true;
      this._trees$.next(this.loadFromLocalStorage());
    }
  }

  private openIndexedDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_TREES)) {
          db.createObjectStore(STORE_TREES, { keyPath: 'id' });
        }
      };
      req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
      req.onerror = (e) => reject((e.target as IDBOpenDBRequest).error);
    });
  }

  // ── CRUD ─────────────────────────────────────

  async saveTree(tree: FamilyTree): Promise<void> {
    const updated = { ...tree, updatedAt: new Date().toISOString() };
    if (this.useLocalStorage) {
      this.saveToLocalStorage(updated);
    } else {
      await this.idbPut(updated);
    }
    const current = this._trees$.getValue();
    const idx = current.findIndex(t => t.id === tree.id);
    if (idx >= 0) {
      const next = [...current];
      next[idx] = updated;
      this._trees$.next(next);
    } else {
      this._trees$.next([...current, updated]);
    }
  }

  async deleteTree(treeId: string): Promise<void> {
    if (this.useLocalStorage) {
      const trees = this.loadFromLocalStorage().filter(t => t.id !== treeId);
      localStorage.setItem(LS_KEY, JSON.stringify(trees));
    } else {
      await this.idbDelete(treeId);
    }
    this._trees$.next(this._trees$.getValue().filter(t => t.id !== treeId));
  }

  getTree(treeId: string): FamilyTree {
    const data = this._trees$.getValue().find(t => t.id === treeId);
    if (!data) throw new Error(`Tree ${treeId} not found`);
    return data;
  }

  getTreeByCollaborationToken(token: string): FamilyTree {
    const data = this._trees$.getValue().find(
      t => t.permissions.collaborationToken === token
    );
    if (!data) throw new Error(`Tree with token ${token} not found`);
    return data;
  }

  // ── IndexedDB helpers ─────────────────────────

  private loadAllFromIDB(): Promise<FamilyTree[]> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_TREES, 'readonly');
      const req = tx.objectStore(STORE_TREES).getAll();
      req.onsuccess = () => resolve(req.result as FamilyTree[]);
      req.onerror = () => reject(req.error);
    });
  }

  private idbPut(tree: FamilyTree): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_TREES, 'readwrite');
      const req = tx.objectStore(STORE_TREES).put(tree);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  private idbDelete(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_TREES, 'readwrite');
      const req = tx.objectStore(STORE_TREES).delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // ── LocalStorage fallback ────────────────────

  private loadFromLocalStorage(): FamilyTree[] {
    try {
      const raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private saveToLocalStorage(tree: FamilyTree): void {
    const trees = this.loadFromLocalStorage();
    const idx = trees.findIndex(t => t.id === tree.id);
    if (idx >= 0) trees[idx] = tree; else trees.push(tree);
    localStorage.setItem(LS_KEY, JSON.stringify(trees));
  }

  // ── Photo helper ──────────────────────────────

  /** Convert File to Base64 data URL for storage */
  fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }
}