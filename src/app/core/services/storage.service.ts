import type { OnDestroy } from "@angular/core";
import { Injectable } from "@angular/core";
import { BehaviorSubject, Subject } from "rxjs";
import type { FamilyTree, PersonComment } from "../models/index";

const DB_NAME = "genealogy_db";
const DB_VERSION = 1;
const STORE_TREES = "family_trees";
const LS_KEY = "genealogy_trees"; // LocalStorage fallback key

@Injectable({ providedIn: "root" })
export class StorageService implements OnDestroy {
	private db: IDBDatabase | null = null;
	private useLocalStorage = false;

	// Cross-tab real-time sync
	private channel = new BroadcastChannel("genealogy_sync");

	// Reactive cache of all trees
	private _trees$ = new BehaviorSubject<FamilyTree[]>([]);
	readonly trees$ = this._trees$.asObservable();

	private _ready$ = new BehaviorSubject<boolean>(false);
	readonly ready$ = this._ready$.asObservable();

	// Cross-tab live node-move events (no IDB write)
	private _nodeMove$ = new Subject<{
		treeId: string;
		nodeId: string;
		x: number;
		y: number;
	}>();
	readonly nodeMove$ = this._nodeMove$.asObservable();

	constructor() {
		this.channel.onmessage = (ev) => this.handleSyncMessage(ev.data);
		this.initStorage();
	}

	ngOnDestroy(): void {
		this.channel.close();
		this._nodeMove$.complete();
	}

	// ── Initialisation ───────────────────────────

	private async initStorage(): Promise<void> {
		try {
			this.db = await this.openIndexedDB();
			const trees = await this.loadAllFromIDB();
			this._trees$.next(trees);
		} catch {
			console.warn("IndexedDB unavailable, falling back to localStorage");
			this.useLocalStorage = true;
			this._trees$.next(this.loadFromLocalStorage());
		} finally {
			this._ready$.next(true);
		}
	}

	private openIndexedDB(): Promise<IDBDatabase> {
		return new Promise((resolve, reject) => {
			const req = indexedDB.open(DB_NAME, DB_VERSION);
			req.onupgradeneeded = (e) => {
				const db = (e.target as IDBOpenDBRequest).result;
				if (!db.objectStoreNames.contains(STORE_TREES)) {
					db.createObjectStore(STORE_TREES, { keyPath: "id" });
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
		const idx = current.findIndex((t) => t.id === tree.id);
		if (idx >= 0) {
			const next = [...current];
			next[idx] = updated;
			this._trees$.next(next);
		} else {
			this._trees$.next([...current, updated]);
		}
		this.channel.postMessage({ type: "save", treeId: tree.id });
	}

	async deleteTree(treeId: string): Promise<void> {
		if (this.useLocalStorage) {
			const trees = this.loadFromLocalStorage().filter((t) => t.id !== treeId);
			localStorage.setItem(LS_KEY, JSON.stringify(trees));
		} else {
			await this.idbDelete(treeId);
		}
		this._trees$.next(this._trees$.getValue().filter((t) => t.id !== treeId));
		this.channel.postMessage({ type: "delete", treeId });
	}

	/** Broadcast a new comment to other tabs */
	broadcastComment(treeId: string, comment: PersonComment): void {
		this.channel.postMessage({ type: "comment", treeId, comment });
	}

	/** Broadcast a live node drag position to other tabs — no IDB write */
	broadcastNodeMove(
		treeId: string,
		nodeId: string,
		x: number,
		y: number,
	): void {
		this.channel.postMessage({ type: "nodeMove", treeId, nodeId, x, y });
	}

	getTree(treeId: string): FamilyTree | null {
		return this._trees$.getValue().find((t) => t.id === treeId) ?? null;
	}

	getTreeByCollaborationToken(token: string): FamilyTree | null {
		return (
			this._trees$
				.getValue()
				.find((t) => t.permissions.collaborationToken === token) ?? null
		);
	}

	// ── IndexedDB helpers ─────────────────────────

	private loadAllFromIDB(): Promise<FamilyTree[]> {
		return new Promise((resolve, reject) => {
			if (!this.db) {
				reject(new Error("IDB not ready"));
				return;
			}
			const tx = this.db.transaction(STORE_TREES, "readonly");
			const req = tx.objectStore(STORE_TREES).getAll();
			req.onsuccess = () => resolve(req.result as FamilyTree[]);
			req.onerror = () => reject(req.error);
		});
	}

	private idbPut(tree: FamilyTree): Promise<void> {
		return new Promise((resolve, reject) => {
			if (!this.db) {
				reject(new Error("IDB not ready"));
				return;
			}
			const tx = this.db.transaction(STORE_TREES, "readwrite");
			const req = tx.objectStore(STORE_TREES).put(tree);
			req.onsuccess = () => resolve();
			req.onerror = () => reject(req.error);
		});
	}

	private idbGet(id: string): Promise<FamilyTree | null> {
		return new Promise((resolve, reject) => {
			if (!this.db) {
				reject(new Error("IDB not ready"));
				return;
			}
			const tx = this.db.transaction(STORE_TREES, "readonly");
			const req = tx.objectStore(STORE_TREES).get(id);
			req.onsuccess = () => resolve((req.result as FamilyTree) ?? null);
			req.onerror = () => reject(req.error);
		});
	}

	private idbDelete(id: string): Promise<void> {
		return new Promise((resolve, reject) => {
			if (!this.db) {
				reject(new Error("IDB not ready"));
				return;
			}
			const tx = this.db.transaction(STORE_TREES, "readwrite");
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
			console.error("Failed to load from localStorage");
			return [];
		}
	}

	private saveToLocalStorage(tree: FamilyTree): void {
		const trees = this.loadFromLocalStorage();
		const idx = trees.findIndex((t) => t.id === tree.id);
		if (idx >= 0) trees[idx] = tree;
		else trees.push(tree);
		localStorage.setItem(LS_KEY, JSON.stringify(trees));
	}

	// ── Cross-tab sync ────────────────────────────

	private async handleSyncMessage(msg: {
		type: "save" | "delete" | "nodeMove" | "comment";
		treeId: string;
		nodeId?: string;
		x?: number;
		y?: number;
		comment?: PersonComment;
	}): Promise<void> {
		const current = [...this._trees$.getValue()];
		if (msg.type === "nodeMove") {
			this._nodeMove$.next({
				treeId: msg.treeId,
				nodeId: msg.nodeId ?? "",
				x: msg.x ?? 0,
				y: msg.y ?? 0,
			});
			return;
		}
		if (msg.type === "comment" && msg.comment) {
			const idx = current.findIndex((t) => t.id === msg.treeId);
			if (idx >= 0) {
				const tree = current[idx];
				current[idx] = {
					...tree,
					comments: [...(tree.comments ?? []), msg.comment],
				};
				this._trees$.next([...current]);
			}
			return;
		}
		if (msg.type === "delete") {
			this._trees$.next(current.filter((t) => t.id !== msg.treeId));
			return;
		}
		// type === 'save': reload the updated tree from persistent storage
		try {
			const updated = this.useLocalStorage
				? (this.loadFromLocalStorage().find((t) => t.id === msg.treeId) ?? null)
				: await this.idbGet(msg.treeId);
			if (!updated) return;
			const idx = current.findIndex((t) => t.id === msg.treeId);
			if (idx >= 0) {
				current[idx] = updated;
			} else {
				current.push(updated);
			}
			this._trees$.next(current);
		} catch {
			console.error("Failed to sync tree from other tab");
		}
	}

	// ── Photo helper ──────────────────────────────

	/** Convert File to Base64 data URL for storage */
	fileToBase64(file: File): Promise<string> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(reader.result as string);
			reader.onerror = () => reject(new Error("Failed to read file"));
			reader.readAsDataURL(file);
		});
	}
}
