import { Injectable } from "@angular/core";
import {
	CHILD_TYPES,
	type LayoutEdge,
	type LayoutNode,
	PARENT_TYPES,
	PARTNER_TYPES,
	type Person,
	type Relation,
	type RelationType,
	SIBLING_TYPES,
	type TreeLayout,
} from "../models/index";

/** Visual constants (px) */
const NODE_W = 160;
const NODE_H = 90;
const H_GAP = 50; // horizontal gap between nodes
const V_GAP = 100; // vertical gap between generations
const PARTNER_GAP = 10; // extra gap between partners

// ─────────────────────────────────────────────────────────────────────────────
//  TreeLayoutService
//
//  The algorithm:
//  1.  Build an undirected graph of canonical parent↔child edges.
//  2.  Determine the "generation level" of every person using BFS from roots
//      (persons with no parents). Persons from disconnected subgraphs start
//      at level 0.
//  3.  Within each level, group partners together so they sit side-by-side.
//  4.  Run a second-pass "x-centering" sweep so each parent is horizontally
//      centered over its children.
//  5.  Produce LayoutEdge objects with SVG path points.
// ─────────────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: "root" })
export class TreeLayoutService {
	computeLayout(persons: Person[], relations: Relation[]): TreeLayout {
		if (persons.length === 0) {
			return {
				nodes: new Map(),
				edges: [],
				width: 0,
				height: 0,
				levelCount: 0,
			};
		}

		// ── Step 1: build canonical adjacency maps ──────────────────────────────
		const parentOf = new Map<string, Set<string>>(); // id → {child ids}
		const childOf = new Map<string, Set<string>>(); // id → {parent ids}
		const partnerOf = new Map<string, Set<string>>(); // id → {partner ids}
		const siblingOf = new Map<string, Set<string>>(); // id → {sibling ids}

		for (const p of persons) {
			parentOf.set(p.id, new Set());
			childOf.set(p.id, new Set());
			partnerOf.set(p.id, new Set());
			siblingOf.set(p.id, new Set());
		}

		for (const rel of relations) {
			this.addRelation(
				rel.from,
				rel.to,
				rel.type,
				parentOf,
				childOf,
				partnerOf,
				siblingOf,
			);
		}

		// ── Step 2: assign generation levels via BFS ────────────────────────────
		const levels = this.assignLevels(persons, childOf, parentOf);

		// ── Step 3: group persons by level ──────────────────────────────────────
		const byLevel = new Map<number, string[]>();
		levels.forEach((lvl, id) => {
			if (!byLevel.has(lvl)) byLevel.set(lvl, []);
			byLevel.get(lvl)!.push(id);
		});

		// ── Step 4: assign x positions (partner groups first) ───────────────────
		const positions = this.assignPositions(
			byLevel,
			partnerOf,
			childOf,
			parentOf,
		);

		// ── Step 5: center parents over children ────────────────────────────────
		this.centerParentsOverChildren(positions, levels, childOf);

		// ── Step 6: build LayoutNode map ────────────────────────────────────────
		const personMap = new Map(persons.map((p) => [p.id, p]));
		const nodeMap = new Map<string, LayoutNode>();

		let col = 0;
		persons.forEach((p, i) => {
			const pos = positions.get(p.id) ?? { x: i * (NODE_W + H_GAP), y: 0 };
			nodeMap.set(p.id, {
				id: p.id,
				person: p,
				x: pos.x,
				y: pos.y,
				level: levels.get(p.id) ?? 0,
				column: col++,
				groupIndex: 0,
			});
		});

		// ── Step 7: build LayoutEdge list ────────────────────────────────────────
		const edges = this.buildEdges(relations, nodeMap);

		// ── Step 8: compute canvas bounds ───────────────────────────────────────
		let maxX = 0,
			maxY = 0;
		nodeMap.forEach((n) => {
			if (n.x + NODE_W > maxX) maxX = n.x + NODE_W;
			if (n.y + NODE_H > maxY) maxY = n.y + NODE_H;
		});

		const levelCount = byLevel.size;

		return {
			nodes: nodeMap,
			edges,
			width: maxX + H_GAP,
			height: maxY + V_GAP,
			levelCount,
		};
	}

	// ── Relation normalisation ────────────────────────────────────────────────

	private addRelation(
		from: string,
		to: string,
		type: RelationType,
		parentOf: Map<string, Set<string>>,
		childOf: Map<string, Set<string>>,
		partnerOf: Map<string, Set<string>>,
		siblingOf: Map<string, Set<string>>,
	): void {
		// Normalize to canonical parentOf / childOf
		if (PARENT_TYPES.includes(type)) {
			parentOf.get(from)?.add(to);
			childOf.get(to)?.add(from);
		} else if (CHILD_TYPES.includes(type)) {
			childOf.get(from)?.add(to);
			parentOf.get(to)?.add(from);
		} else if (PARTNER_TYPES.includes(type)) {
			partnerOf.get(from)?.add(to);
			partnerOf.get(to)?.add(from);
		} else if (SIBLING_TYPES.includes(type)) {
			siblingOf.get(from)?.add(to);
			siblingOf.get(to)?.add(from);
		}
	}

	// ── Level assignment (BFS) ────────────────────────────────────────────────

	private assignLevels(
		persons: Person[],
		childOf: Map<string, Set<string>>,
		parentOf: Map<string, Set<string>>,
	): Map<string, number> {
		const levels = new Map<string, number>();
		const ids = persons.map((p) => p.id);

		// Roots = persons with no parents in the canonical graph
		const roots = ids.filter((id) => (childOf.get(id)?.size ?? 0) === 0);

		// If every person is in a cycle (e.g., only partnerOf relations),
		// treat all as roots
		const startNodes = roots.length > 0 ? roots : ids.slice(0, 1);

		const queue: { id: string; lvl: number }[] = startNodes.map((id) => ({
			id,
			lvl: 0,
		}));
		const enqueued = new Set(startNodes);

		while (queue.length > 0) {
			const { id, lvl } = queue.shift()!;
			// Accept deeper level if re-encountered (DAG, not just tree)
			if (!levels.has(id) || levels.get(id)! < lvl) {
				levels.set(id, lvl);
			}
			// Enqueue children
			parentOf.get(id)?.forEach((childId) => {
				if (!enqueued.has(childId)) {
					enqueued.add(childId);
					queue.push({ id: childId, lvl: lvl + 1 });
				}
			});
		}

		// Disconnected persons: assign level 0
		ids.forEach((id) => {
			if (!levels.has(id)) levels.set(id, 0);
		});

		return levels;
	}

	// ── Position assignment ───────────────────────────────────────────────────

	private assignPositions(
		byLevel: Map<number, string[]>,
		partnerOf: Map<string, Set<string>>,
		childOf: Map<string, Set<string>>,
		parentOf: Map<string, Set<string>>,
	): Map<string, { x: number; y: number }> {
		const positions = new Map<string, { x: number; y: number }>();
		const sortedLevels = Array.from(byLevel.keys()).sort((a, b) => a - b);

		// Re-index levels to 0..N so Y starts at 0
		const levelYMap = new Map<number, number>();
		sortedLevels.forEach((lvl, i) => levelYMap.set(lvl, i));

		let globalX = 0; // Running x cursor across ALL levels for initial placement

		// We assign x level-by-level, grouping partners
		sortedLevels.forEach((lvl) => {
			const ids = byLevel.get(lvl)!;
			const groups = this.buildPartnerGroups(ids, partnerOf);
			const y = levelYMap.get(lvl)! * (NODE_H + V_GAP);

			// Sort groups: prefer groups whose parents have already been placed
			groups.forEach((group) => {
				group.forEach((id, i) => {
					if (!positions.has(id)) {
						const x = globalX + i * (NODE_W + PARTNER_GAP);
						positions.set(id, { x, y });
					}
				});
				globalX += group.length * (NODE_W + PARTNER_GAP) + H_GAP;
			});
		});

		return positions;
	}

	/** Group partner pairs/sets so they sit adjacent */
	private buildPartnerGroups(
		ids: string[],
		partnerOf: Map<string, Set<string>>,
	): string[][] {
		const groups: string[][] = [];
		const assigned = new Set<string>();

		for (const id of ids) {
			if (assigned.has(id)) continue;
			const group = [id];
			assigned.add(id);

			partnerOf.get(id)?.forEach((partnerId) => {
				if (ids.includes(partnerId) && !assigned.has(partnerId)) {
					group.push(partnerId);
					assigned.add(partnerId);
				}
			});
			groups.push(group);
		}
		return groups;
	}

	// ── Center parents over children (post-pass) ──────────────────────────────

	private centerParentsOverChildren(
		positions: Map<string, { x: number; y: number }>,
		levels: Map<string, number>,
		parentOf: Map<string, Set<string>>,
	): void {
		// Process from deepest level upward so shifts propagate correctly
		const sorted = Array.from(levels.entries()).sort((a, b) => b[1] - a[1]);

		for (const [parentId] of sorted) {
			const children = Array.from(parentOf.get(parentId) ?? []);
			if (children.length === 0) continue;

			const childPositions = children
				.map((cid) => positions.get(cid))
				.filter(Boolean) as { x: number; y: number }[];

			if (childPositions.length === 0) continue;

			const minX = Math.min(...childPositions.map((p) => p.x));
			const maxX = Math.max(...childPositions.map((p) => p.x + NODE_W));
			const centreX = (minX + maxX) / 2 - NODE_W / 2;

			const pos = positions.get(parentId);
			if (pos) pos.x = centreX;
		}
	}

	// ── Edge builder ──────────────────────────────────────────────────────────

	private buildEdges(
		relations: Relation[],
		nodeMap: Map<string, LayoutNode>,
	): LayoutEdge[] {
		const edges: LayoutEdge[] = [];
		const seen = new Set<string>();

		for (const rel of relations) {
			// Deduplicate by unordered pair + type
			const key = [rel.from, rel.to].sort().join("§") + "§" + rel.type;
			if (seen.has(key)) continue;
			seen.add(key);

			const from = nodeMap.get(rel.from);
			const to = nodeMap.get(rel.to);
			if (!from || !to) continue;

			const x1 = from.x + NODE_W / 2;
			const y1 = from.y + NODE_H / 2;
			const x2 = to.x + NODE_W / 2;
			const y2 = to.y + NODE_H / 2;

			edges.push({
				id: rel.id,
				fromId: rel.from,
				toId: rel.to,
				type: rel.type,
				x1,
				y1,
				x2,
				y2,
				midX: (x1 + x2) / 2,
				midY: (y1 + y2) / 2,
			});
		}

		return edges;
	}

	// ── Public helpers ────────────────────────────────────────────────────────

	/** Returns the CSS stroke colour for a given relation type */
	static edgeColor(type: RelationType): string {
		if (PARENT_TYPES.includes(type) || CHILD_TYPES.includes(type))
			return "#4f46e5"; // indigo
		if (PARTNER_TYPES.includes(type)) return "#db2777"; // pink
		if (SIBLING_TYPES.includes(type)) return "#059669"; // green
		return "#6b7280"; // grey
	}

	/** Returns whether the relation should be drawn as dashed */
	static isDashed(type: RelationType): boolean {
		return [
			"adoptiveParentOf",
			"adoptiveChildOf",
			"stepParentOf",
			"stepChildOf",
			"guardianOf",
			"wardOf",
			"ancestorOf",
			"descendantOf",
		].includes(type);
	}

	/** Human-readable label */
	static label(type: RelationType): string {
		const MAP: Record<RelationType, string> = {
			parentOf: "Padre/Madre de",
			childOf: "Hijo/a de",
			partnerOf: "Pareja de",
			siblingOf: "Hermano/a de",
			halfSiblingOf: "Medio/a hermano/a de",
			ancestorOf: "Ancestro de",
			descendantOf: "Descendiente de",
			adoptiveParentOf: "Padre/Madre adoptivo/a de",
			adoptiveChildOf: "Hijo/a adoptivo/a de",
			stepParentOf: "Padrastro/Madrastra de",
			stepChildOf: "Hijastro/a de",
			guardianOf: "Tutor/a de",
			wardOf: "Tutelado/a de",
		};
		return MAP[type] ?? type;
	}
}

export { H_GAP, NODE_H, NODE_W, V_GAP };
