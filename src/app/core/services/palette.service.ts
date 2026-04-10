import { effect, Injectable, signal } from "@angular/core";
import type { TreeTheme } from "../models/index";

const LS_KEY = "genealogy_palette";

export const DEFAULT_PALETTE: TreeTheme = {
	accentColor: "#ff3333",
	nodeBg: "#1c1c1c",
	edgeColor: "#f0f0f0",
};

@Injectable({ providedIn: "root" })
export class PaletteService {
	readonly palette = signal<TreeTheme>(this.loadOrDefault());

	constructor() {
		// Apply the initial palette immediately, then react to every future change.
		this.applyToRoot(this.palette());
		effect(() => {
			const p = this.palette();
			this.applyToRoot(p);
			this.saveToStorage(p);
		});
	}

	/**
	 * Update the global palette.
	 * If the provided theme is invalid the call is silently ignored.
	 */
	setPalette(theme: TreeTheme): void {
		if (!this.isValid(theme)) {
			console.warn("[PaletteService] Invalid theme ignored", theme);
			return;
		}
		this.palette.set({ ...theme });
	}

	/** Returns true when all three fields are valid 6-digit hex colours. */
	isValid(theme: unknown): theme is TreeTheme {
		if (!theme || typeof theme !== "object") return false;
		const t = theme as TreeTheme;
		return (
			this.isHex(t.accentColor) &&
			this.isHex(t.nodeBg) &&
			this.isHex(t.edgeColor)
		);
	}

	// ── Private helpers ───────────────────────────

	private isHex(v: unknown): v is string {
		return typeof v === "string" && /^#[0-9A-Fa-f]{6}$/.test(v);
	}

	private loadOrDefault(): TreeTheme {
		try {
			const raw = localStorage.getItem(LS_KEY);
			if (raw) {
				const parsed: unknown = JSON.parse(raw);
				if (this.isValid(parsed)) return parsed;
			}
		} catch {
			// ignore parse errors
		}
		const def: TreeTheme = { ...DEFAULT_PALETTE };
		try {
			localStorage.setItem(LS_KEY, JSON.stringify(def));
		} catch {
			// ignore write errors (e.g. private browsing quota)
		}
		return def;
	}

	private saveToStorage(theme: TreeTheme): void {
		try {
			localStorage.setItem(LS_KEY, JSON.stringify(theme));
		} catch {
			// ignore
		}
	}

	/**
	 * Write all palette-derived CSS custom properties on <html> so every
	 * element in the document — including Angular Material CDK overlays that
	 * live outside the component subtree — inherits the values.
	 */
	private applyToRoot(theme: TreeTheme): void {
		const root = document.documentElement;
		const { accentColor } = theme;
		root.style.setProperty("--red", accentColor);
		root.style.setProperty("--text-accent", accentColor);
		root.style.setProperty("--border-accent", this.hexToRgba(accentColor, 0.6));
		root.style.setProperty("--red-dim", this.hexToRgba(accentColor, 0.12));
		root.style.setProperty(
			"--red-glow",
			`0 0 16px ${this.hexToRgba(accentColor, 0.35)}`,
		);
		root.style.setProperty("--node-bg", theme.nodeBg);
		root.style.setProperty("--edge-color", theme.edgeColor);
	}

	/** Convert a 6-digit hex colour string to `rgba(r, g, b, alpha)`. */
	private hexToRgba(hex: string, alpha: number): string {
		const r = parseInt(hex.slice(1, 3), 16);
		const g = parseInt(hex.slice(3, 5), 16);
		const b = parseInt(hex.slice(5, 7), 16);
		return `rgba(${r}, ${g}, ${b}, ${alpha})`;
	}
}
