// ─────────────────────────────────────────────
//  GENEALOGY APP — CORE MODELS
// ─────────────────────────────────────────────

// ── Relation types ──────────────────────────
export type RelationType =
	| "parentOf"
	| "childOf"
	| "partnerOf"
	| "siblingOf"
	| "halfSiblingOf"
	| "ancestorOf"
	| "descendantOf"
	| "adoptiveParentOf"
	| "adoptiveChildOf"
	| "stepParentOf"
	| "stepChildOf"
	| "guardianOf"
	| "wardOf";

/** Map of inverse relationship types */
export const INVERSE_RELATION: Record<RelationType, RelationType> = {
	parentOf: "childOf",
	childOf: "parentOf",
	partnerOf: "partnerOf",
	siblingOf: "siblingOf",
	halfSiblingOf: "halfSiblingOf",
	ancestorOf: "descendantOf",
	descendantOf: "ancestorOf",
	adoptiveParentOf: "adoptiveChildOf",
	adoptiveChildOf: "adoptiveParentOf",
	stepParentOf: "stepChildOf",
	stepChildOf: "stepParentOf",
	guardianOf: "wardOf",
	wardOf: "guardianOf",
};

/** Relations that imply a parent→child hierarchy */
export const PARENT_TYPES: RelationType[] = [
	"parentOf",
	"adoptiveParentOf",
	"stepParentOf",
	"guardianOf",
	"ancestorOf",
];

/** Relations that imply child→parent (inverse of above) */
export const CHILD_TYPES: RelationType[] = [
	"childOf",
	"adoptiveChildOf",
	"stepChildOf",
	"wardOf",
	"descendantOf",
];

/** Relations that are horizontal (same generation) */
export const PARTNER_TYPES: RelationType[] = ["partnerOf"];
export const SIBLING_TYPES: RelationType[] = ["siblingOf", "halfSiblingOf"];

// ── Person ───────────────────────────────────
export interface Person {
	id: string;
	name: string;
	photoUrl?: string; // Base64 or object URL
	birthDate?: string; // ISO date string YYYY-MM-DD
	deathDate?: string;
	gender?: "male" | "female" | "other" | "unknown";
	notes?: string;
	tags?: string[];
	createdAt: string;
	updatedAt: string;
}

// ── Relation ─────────────────────────────────
export interface Relation {
	id: string;
	from: string; // Person id
	to: string; // Person id
	type: RelationType;
	startDate?: string; // e.g. marriage year
	endDate?: string; // e.g. divorce year
	notes?: string;
}

// ── Tree Theme ────────────────────────────────
export interface TreeTheme {
	accentColor: string; // hex color
	nodeBackground: string; // hex color (formerly nodeBg)
	edgeColor: string; // hex color
	// Person-row palette
	personRowBackground: string; // hex color
	personRowText: string; // hex color
	personRowBorder: string; // hex color
	// Node palette
	nodeBorder: string; // hex color
	nodeText: string; // hex color
	nodeSelectedBackground: string; // hex color
	nodeSelectedBorder: string; // hex color
}

// ── Person Comment ────────────────────────────
export interface PersonComment {
	id: string;
	personId: string;
	text: string;
	author: string;
	createdAt: string;
}

// ── Family Tree (a "project") ─────────────────
export interface FamilyTree {
	id: string;
	name: string;
	description?: string;
	persons: Person[];
	relations: Relation[];
	permissions: TreePermissions;
	nodePositions?: Record<string, { x: number; y: number }>;
	theme?: TreeTheme;
	comments?: PersonComment[];
	createdAt: string;
	updatedAt: string;
}

export interface TreePermissions {
	ownerToken: string; // SHA-256 derived token stored client-side
	collaborationToken?: string; // Shared read/write token
	isPublicRead: boolean;
	editorTokens: string[]; // Additional editor tokens
}

// ── Layout types ──────────────────────────────
export interface LayoutNode {
	id: string;
	person: Person;
	x: number;
	y: number;
	level: number; // Generation level (0 = oldest)
	column: number;
	groupIndex: number; // Index within partner group
}

export interface LayoutEdge {
	id: string;
	fromId: string;
	toId: string;
	type: RelationType;
	// Computed SVG path points
	x1: number;
	y1: number;
	x2: number;
	y2: number;
	midX?: number;
	midY?: number;
}

export interface TreeLayout {
	nodes: Map<string, LayoutNode>;
	edges: LayoutEdge[];
	width: number;
	height: number;
	levelCount: number;
}

// ── Collaboration ─────────────────────────────
export interface CollaborationSession {
	treeId: string;
	token: string;
	role: "owner" | "editor" | "viewer";
	expiresAt?: string;
}

// ── Export ────────────────────────────────────
export type ExportFormat = "svg" | "text";

export interface ExportOptions {
	format: ExportFormat;
	includePhotos?: boolean;
	includeNotes?: boolean;
	includeRelationLabels?: boolean;
}
