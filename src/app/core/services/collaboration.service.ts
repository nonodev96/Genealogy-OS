import { Injectable } from "@angular/core";
import type { CollaborationSession } from "../models";
import { StorageService } from "./storage.service";

const SESSION_KEY = "genealogy_session";

@Injectable({ providedIn: "root" })
export class CollaborationService {
	constructor(private storage: StorageService) {}

	// ── Session management ────────────────────────

	/** Persist caller's identity token so we know their role */
	saveSession(session: CollaborationSession): void {
		const sessions = this.loadSessions();
		sessions[`${session.treeId}_${session.token}`] = session;
		localStorage.setItem(SESSION_KEY, JSON.stringify(sessions));
	}

	getSession(treeId: string, token: string): CollaborationSession | null {
		const sessions = this.loadSessions();
		return sessions[`${treeId}_${token}`] ?? null;
	}

	private loadSessions(): Record<string, CollaborationSession> {
		try {
			const raw = localStorage.getItem(SESSION_KEY);
			return raw ? JSON.parse(raw) : {};
		} catch {
			console.error("Failed to load collaboration sessions from localStorage");
			return {};
		}
	}

	// ── Collaboration token for a tree ────────────

	/**
	 * Generate (or return existing) collaboration token.
	 * Returns the full share URL to send to collaborators.
	 */
	async generateCollaborationLink(
		treeId: string,
		ownerToken: string,
	): Promise<string | null> {
		const tree = this.storage.getTree(treeId);
		if (!tree) return null;
		if (tree.permissions.ownerToken !== ownerToken) return null; // Not owner

		let token = tree.permissions.collaborationToken;
		if (!token) {
			token = this.randomToken(16);
			await this.storage.saveTree({
				...tree,
				permissions: { ...tree.permissions, collaborationToken: token },
			});
		}

		return this.buildShareUrl(treeId, token);
	}

	/** Revoke collaboration token — existing links stop working */
	async revokeCollaborationLink(
		treeId: string,
		ownerToken: string,
	): Promise<void> {
		const tree = this.storage.getTree(treeId);
		if (!tree || tree.permissions.ownerToken !== ownerToken) return;
		await this.storage.saveTree({
			...tree,
			permissions: { ...tree.permissions, collaborationToken: undefined },
		});
	}

	/**
	 * Resolve a share URL: find the tree, verify the token, and return
	 * a CollaborationSession describing the caller's role.
	 */
	resolveShareUrl(url: string): CollaborationSession | null {
		try {
			const parsed = new URL(url);
			const treeId = parsed.searchParams.get("tree");
			const token = parsed.searchParams.get("token");
			if (!treeId || !token) return null;
			return this.resolveToken(treeId, token);
		} catch {
			return null;
		}
	}

	resolveToken(treeId: string, token: string): CollaborationSession | null {
		const tree = this.storage.getTree(treeId);
		if (!tree) return null;

		if (tree.permissions.ownerToken === token) {
			return { treeId, token, role: "owner" };
		}
		if (tree.permissions.collaborationToken === token) {
			return { treeId, token, role: "editor" };
		}
		if (tree.permissions.isPublicRead) {
			return { treeId, token: "", role: "viewer" };
		}
		return null;
	}

	canEdit(session: CollaborationSession): boolean {
		return session.role === "owner" || session.role === "editor";
	}

	// ── Helpers ───────────────────────────────────

	private buildShareUrl(treeId: string, token: string): string {
		const base = window.location.origin + window.location.pathname;
		return `${base}#/collaborate?tree=${treeId}&token=${token}`;
	}

	private randomToken(bytes: number): string {
		const arr = new Uint8Array(bytes);
		crypto.getRandomValues(arr);
		return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
	}
}
