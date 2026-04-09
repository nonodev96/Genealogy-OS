import { Injectable, type OnDestroy } from "@angular/core";
import { Subject } from "rxjs";
import type { FamilyTree, Person, Relation } from "../models";

export interface TreeSnapshot {
	persons: Person[];
	relations: Relation[];
	nodePositions?: Record<string, { x: number; y: number }>;
	author?: string;
	timestamp?: string;
	description?: string;
}

@Injectable({ providedIn: "root" })
export class HistoryService implements OnDestroy {
	private readonly MAX_DEPTH = 50;

	private undoMap = new Map<string, TreeSnapshot[]>();
	private redoMap = new Map<string, TreeSnapshot[]>();

	private _changed$ = new Subject<void>();
	readonly changed$ = this._changed$.asObservable();

	/** Snapshot current tree BEFORE a user mutation. Clears the redo stack. */
	snapshot(tree: FamilyTree, author?: string, description?: string): void {
		const snap = this.toSnap(tree);
		snap.author = author;
		snap.description = description;
		this.getStack(this.undoMap, tree.id).push(snap);
		this.trim(this.getStack(this.undoMap, tree.id));
		this.redoMap.set(tree.id, []);
		this._changed$.next();
	}

	/** Return all undo snapshots for a tree (oldest first). */
	getHistory(treeId: string): TreeSnapshot[] {
		return [...(this.undoMap.get(treeId) ?? [])];
	}

	canUndo(treeId: string): boolean {
		return (this.undoMap.get(treeId)?.length ?? 0) > 0;
	}

	canRedo(treeId: string): boolean {
		return (this.redoMap.get(treeId)?.length ?? 0) > 0;
	}

	/** Pop from undo stack. Returns null if empty. */
	popUndo(treeId: string): TreeSnapshot | null {
		const snap = this.undoMap.get(treeId)?.pop() ?? null;
		this._changed$.next();
		return snap;
	}

	/** Pop from redo stack. Returns null if empty. */
	popRedo(treeId: string): TreeSnapshot | null {
		const snap = this.redoMap.get(treeId)?.pop() ?? null;
		this._changed$.next();
		return snap;
	}

	/** Push a snapshot onto the redo stack (used by undo()). Does NOT touch undo stack. */
	pushRedo(treeId: string, snap: TreeSnapshot): void {
		this.getStack(this.redoMap, treeId).push(snap);
	}

	/** Push a snapshot onto the undo stack without clearing redo (used by redo()). */
	pushUndo(treeId: string, snap: TreeSnapshot): void {
		this.getStack(this.undoMap, treeId).push(snap);
		this.trim(this.getStack(this.undoMap, treeId));
	}

	clearTree(treeId: string): void {
		this.undoMap.delete(treeId);
		this.redoMap.delete(treeId);
		this._changed$.next();
	}

	toSnap(tree: FamilyTree): TreeSnapshot {
		return {
			persons: structuredClone(tree.persons),
			relations: structuredClone(tree.relations),
			nodePositions: tree.nodePositions
				? structuredClone(tree.nodePositions)
				: undefined,
			timestamp: new Date().toISOString(),
		};
	}

	private getStack(
		map: Map<string, TreeSnapshot[]>,
		treeId: string,
	): TreeSnapshot[] {
		if (!map.has(treeId)) map.set(treeId, []);
		return map.get(treeId) as TreeSnapshot[];
	}

	private trim(stack: TreeSnapshot[]): void {
		while (stack.length > this.MAX_DEPTH) stack.shift();
	}

	ngOnDestroy(): void {
		this._changed$.complete();
	}
}
