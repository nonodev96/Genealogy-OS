import {
	ChangeDetectionStrategy,
	Component,
	computed,
	input,
	output,
} from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { TranslatePipe } from "@ngx-translate/core";
import type { FamilyTree, Person } from "@core/models";
import { PARENT_TYPES } from "@core/models";

function extractYear(date?: string): number | null {
	if (!date) return null;
	const m = date.match(/(\d{4})/);
	return m ? Number(m[1]) : null;
}

interface GenderSegment {
	label: string;
	count: number;
	color: string;
	startAngle: number;
	endAngle: number;
	d: string;
}

function arcPath(
	cx: number,
	cy: number,
	r: number,
	startAngle: number,
	endAngle: number,
): string {
	const s = startAngle - Math.PI / 2;
	const e = endAngle - Math.PI / 2;
	const x1 = cx + r * Math.cos(s);
	const y1 = cy + r * Math.sin(s);
	const x2 = cx + r * Math.cos(e);
	const y2 = cy + r * Math.sin(e);
	const large = endAngle - startAngle > Math.PI ? 1 : 0;
	return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
}

@Component({
	selector: "app-stats-panel",
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [MatButtonModule, MatIconModule, TranslatePipe],
	template: `
    <div class="stats-panel" role="complementary" [attr.aria-label]="'STATS.TITLE' | translate">
      <div class="stats-header">
        <span class="stats-title">// {{ 'STATS.TITLE' | translate }}</span>
        <button class="close-btn" (click)="onClose()" [attr.aria-label]="'COMMON.CANCEL' | translate">
          <mat-icon>close</mat-icon>
        </button>
      </div>
      <div class="stats-body">

        <!-- Summary numbers -->
        <div class="stat-grid">
          <div class="stat-card">
            <span class="stat-val">{{ stats().totalPersons }}</span>
            <span class="stat-lbl">{{ 'STATS.PERSONS' | translate }}</span>
          </div>
          <div class="stat-card">
            <span class="stat-val">{{ stats().totalRelations }}</span>
            <span class="stat-lbl">{{ 'STATS.RELATIONS' | translate }}</span>
          </div>
          <div class="stat-card">
            <span class="stat-val">{{ stats().generations }}</span>
            <span class="stat-lbl">{{ 'STATS.GENERATIONS' | translate }}</span>
          </div>
          <div class="stat-card">
            <span class="stat-val">{{ stats().avgLifespan > 0 ? stats().avgLifespan : '—' }}</span>
            <span class="stat-lbl">{{ 'STATS.AVG_LIFESPAN' | translate }}</span>
          </div>
        </div>

        <!-- Oldest / youngest -->
        @if (stats().oldest) {
        <div class="stat-row">
          <span class="sr-lbl">{{ 'STATS.OLDEST' | translate }}</span>
          <span class="sr-val">{{ stats().oldest }}</span>
        </div>
        }
        @if (stats().youngest) {
        <div class="stat-row">
          <span class="sr-lbl">{{ 'STATS.YOUNGEST' | translate }}</span>
          <span class="sr-val">{{ stats().youngest }}</span>
        </div>
        }

        <!-- Gender donut -->
        <div class="donut-section">
          <p class="donut-title">{{ 'STATS.GENDER_BREAKDOWN' | translate }}</p>
          <div class="donut-wrap">
            <svg width="120" height="120" role="img" [attr.aria-label]="'STATS.GENDER_BREAKDOWN' | translate">
              @for (seg of genderSegments(); track seg.label) {
                <path [attr.d]="seg.d" [attr.fill]="seg.color" opacity="0.85">
                  <title>{{ seg.label }}: {{ seg.count }}</title>
                </path>
              }
              <!-- Donut hole -->
              <circle cx="60" cy="60" r="28" fill="#111"/>
              <text x="60" y="65" text-anchor="middle" fill="rgba(255,255,255,0.6)"
                font-family="monospace" font-size="12">
                {{ stats().totalPersons }}
              </text>
            </svg>
            <div class="donut-legend">
              @for (seg of genderSegments(); track seg.label) {
              <div class="legend-row">
                <span class="legend-dot" [style.background]="seg.color"></span>
                <span class="legend-lbl">{{ seg.label }}</span>
                <span class="legend-val">{{ seg.count }}</span>
              </div>
              }
            </div>
          </div>
        </div>

      </div>
    </div>
  `,
	styles: [`
    :host { display:block; }
    .stats-panel {
      width:280px; background:var(--bg-surface);
      border-left:1px solid var(--border-dim);
      height:100%; display:flex; flex-direction:column;
    }
    .stats-header {
      display:flex; align-items:center; justify-content:space-between;
      padding:12px 14px; border-bottom:1px solid var(--border-dim);
      flex-shrink:0;
    }
    .stats-title {
      font-family:var(--font-mono); font-size:12px; color:var(--text-primary);
      letter-spacing:0.06em;
    }
    .close-btn {
      background:transparent; border:none; color:var(--text-muted);
      cursor:pointer; display:flex; align-items:center; padding:2px;
    }
    .close-btn mat-icon { font-size:16px !important; width:16px !important; height:16px !important; }
    .close-btn:hover { color:var(--text-primary); }
    .stats-body { flex:1; overflow-y:auto; padding:12px; display:flex; flex-direction:column; gap:12px; }

    .stat-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
    .stat-card {
      background:var(--bg-elevated); border:1px solid var(--border-dim);
      border-radius:var(--radius-sm); padding:10px;
      display:flex; flex-direction:column; gap:2px;
    }
    .stat-val { font-family:var(--font-display); font-size:22px; color:var(--red); }
    .stat-lbl { font-family:var(--font-mono); font-size:9px; color:var(--text-muted); letter-spacing:0.1em; text-transform:uppercase; }

    .stat-row { display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid var(--border-dim); }
    .sr-lbl { font-size:9px; color:var(--text-muted); font-family:var(--font-mono); letter-spacing:0.1em; text-transform:uppercase; }
    .sr-val { font-size:11px; color:var(--text-primary); font-family:var(--font-mono); }

    .donut-section { margin-top:4px; }
    .donut-title { font-size:9px; color:var(--text-muted); font-family:var(--font-mono); letter-spacing:0.1em; text-transform:uppercase; margin:0 0 10px; }
    .donut-wrap { display:flex; align-items:center; gap:16px; }
    .donut-legend { display:flex; flex-direction:column; gap:6px; }
    .legend-row { display:flex; align-items:center; gap:6px; }
    .legend-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
    .legend-lbl { font-size:10px; color:var(--text-secondary); font-family:var(--font-mono); flex:1; }
    .legend-val { font-size:10px; color:var(--text-primary); font-family:var(--font-mono); }
  `],
})
export class StatsPanelComponent {
	readonly tree = input<FamilyTree | null>(null);
	readonly close = output<void>();

	readonly stats = computed(() => {
		const t = this.tree();
		if (!t) return { totalPersons: 0, totalRelations: 0, generations: 0, avgLifespan: 0, oldest: null, youngest: null };

		const totalPersons = t.persons.length;
		const totalRelations = t.relations.length;

		// Compute generations via BFS on parent→child graph
		const generations = this.computeGenerations(t.persons, t);

		// Average lifespan
		const lifespans = t.persons
			.map((p) => {
				const b = extractYear(p.birthDate);
				const d = extractYear(p.deathDate);
				if (b && d) return d - b;
				return null;
			})
			.filter((v): v is number => v !== null);
		const avgLifespan = lifespans.length > 0
			? Math.round(lifespans.reduce((a, b) => a + b, 0) / lifespans.length)
			: 0;

		// Oldest and youngest by birth year
		const withBirth = t.persons
			.map((p) => ({ p, y: extractYear(p.birthDate) }))
			.filter((x): x is { p: Person; y: number } => x.y !== null);

		const oldest = withBirth.length > 0
			? withBirth.reduce((a, b) => (a.y < b.y ? a : b)).p.name
			: null;
		const youngest = withBirth.length > 0
			? withBirth.reduce((a, b) => (a.y > b.y ? a : b)).p.name
			: null;

		return { totalPersons, totalRelations, generations, avgLifespan, oldest, youngest };
	});

	readonly genderSegments = computed((): GenderSegment[] => {
		const t = this.tree();
		if (!t || t.persons.length === 0) return [];
		const counts = { male: 0, female: 0, other: 0, unknown: 0 };
		for (const p of t.persons) {
			counts[p.gender ?? "unknown"]++;
		}
		const colors: Record<string, string> = {
			male: "#4a90d9",
			female: "#e87ea1",
			other: "#8bc34a",
			unknown: "#8a8a8a",
		};
		const labels: Record<string, string> = {
			male: "male", female: "female", other: "other", unknown: "unknown",
		};
		const total = t.persons.length;
		const CX = 60, CY = 60, R = 50;
		let angle = 0;
		const segs: GenderSegment[] = [];
		for (const [key, count] of Object.entries(counts)) {
			if (count === 0) continue;
			const slice = (count / total) * Math.PI * 2;
			segs.push({
				label: labels[key],
				count,
				color: colors[key],
				startAngle: angle,
				endAngle: angle + slice,
				d: arcPath(CX, CY, R, angle, angle + slice),
			});
			angle += slice;
		}
		return segs;
	});

	onClose(): void {
		this.close.emit();
	}

	private computeGenerations(persons: Person[], tree: FamilyTree): number {
		if (persons.length === 0) return 0;
		// Find roots (persons with no parent relation pointing to them)
		const hasParent = new Set(
			tree.relations
				.filter((r) => PARENT_TYPES.includes(r.type))
				.map((r) => r.to),
		);
		const roots = persons.filter((p) => !hasParent.has(p.id));
		if (roots.length === 0) return 1;

		// BFS to find max depth
		const childMap = new Map<string, string[]>();
		for (const r of tree.relations) {
			if (PARENT_TYPES.includes(r.type)) {
				const arr = childMap.get(r.from) ?? [];
				arr.push(r.to);
				childMap.set(r.from, arr);
			}
		}

		let maxDepth = 0;
		const queue: { id: string; depth: number }[] = roots.map((r) => ({ id: r.id, depth: 1 }));
		const visited = new Set<string>();
		while (queue.length > 0) {
			const { id, depth } = queue.shift()!;
			if (visited.has(id)) continue;
			visited.add(id);
			maxDepth = Math.max(maxDepth, depth);
			for (const childId of childMap.get(id) ?? []) {
				if (!visited.has(childId)) {
					queue.push({ id: childId, depth: depth + 1 });
				}
			}
		}
		return maxDepth;
	}
}
