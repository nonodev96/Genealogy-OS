import {
	ChangeDetectionStrategy,
	Component,
	input,
	output,
} from "@angular/core";
import { DatePipe } from "@angular/common";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatTooltipModule } from "@angular/material/tooltip";
import { TranslatePipe } from "@ngx-translate/core";
import type { TreeSnapshot } from "@core/services/history.service";

@Component({
	selector: "app-history-panel",
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [DatePipe, MatButtonModule, MatIconModule, MatTooltipModule, TranslatePipe],
	template: `
    <div class="history-panel" role="complementary" [attr.aria-label]="'HISTORY.TITLE' | translate">
      <div class="hp-header">
        <span class="hp-title">// {{ 'HISTORY.TITLE' | translate }}</span>
        <button class="close-btn" (click)="close.emit()" [attr.aria-label]="'COMMON.CANCEL' | translate">
          <mat-icon>close</mat-icon>
        </button>
      </div>
      <div class="hp-body">
        @if (snapshots().length === 0) {
        <div class="hp-empty">
          <p>{{ 'HISTORY.EMPTY' | translate }}</p>
        </div>
        }
        @for (snap of snapshots(); track snap.timestamp; let i = $index) {
        <div class="snap-row">
          <div class="snap-index">{{ snapshots().length - i }}</div>
          <div class="snap-info">
            @if (snap.description) {
            <span class="snap-desc">{{ snap.description }}</span>
            }
            @if (!snap.description) {
            <span class="snap-desc muted">{{ 'HISTORY.NO_DESC' | translate }}</span>
            }
            <div class="snap-meta">
              @if (snap.author) {
              <span class="snap-author">{{ snap.author }}</span>
              }
              @if (snap.timestamp) {
              <span class="snap-time">{{ snap.timestamp | date:'dd MMM yyyy HH:mm' }}</span>
              }
            </div>
            <div class="snap-counts">
              <span>{{ snap.persons.length }} {{ 'STATS.PERSONS' | translate }}</span>
              <span>{{ snap.relations.length }} {{ 'STATS.RELATIONS' | translate }}</span>
            </div>
          </div>
          <button class="restore-btn"
            (click)="restore.emit(i)"
            [matTooltip]="'HISTORY.RESTORE' | translate">
            <mat-icon>restore</mat-icon>
          </button>
        </div>
        }
      </div>
    </div>
  `,
	styles: [`
    :host { display:block; height:100%; }
    .history-panel {
      width:280px; background:var(--bg-surface);
      border-left:1px solid var(--border-dim);
      height:100%; display:flex; flex-direction:column;
    }
    .hp-header {
      display:flex; align-items:center; justify-content:space-between;
      padding:12px 14px; border-bottom:1px solid var(--border-dim);
      flex-shrink:0;
    }
    .hp-title { font-family:var(--font-mono); font-size:12px; color:var(--text-primary); letter-spacing:0.06em; }
    .close-btn { background:transparent; border:none; color:var(--text-muted); cursor:pointer; display:flex; align-items:center; padding:2px; }
    .close-btn mat-icon { font-size:16px !important; width:16px !important; height:16px !important; }
    .close-btn:hover { color:var(--text-primary); }
    .hp-body { flex:1; overflow-y:auto; padding:8px; display:flex; flex-direction:column; gap:4px; }

    .hp-empty { padding:20px; text-align:center; font-size:10px; color:var(--text-muted); font-family:var(--font-mono); }

    .snap-row {
      display:flex; align-items:flex-start; gap:8px;
      padding:8px; border-radius:var(--radius-sm);
      border:1px solid transparent;
      transition:all var(--t);
    }
    .snap-row:hover { background:var(--bg-elevated); border-color:var(--border-dim); }

    .snap-index {
      width:20px; height:20px; border-radius:2px;
      background:var(--bg-overlay); border:1px solid var(--border-dim);
      display:flex; align-items:center; justify-content:center;
      font-size:9px; color:var(--text-muted); font-family:var(--font-mono);
      flex-shrink:0;
    }
    .snap-info { flex:1; min-width:0; display:flex; flex-direction:column; gap:2px; }
    .snap-desc { font-size:11px; color:var(--text-primary); font-family:var(--font-mono); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .snap-desc.muted { color:var(--text-muted); font-style:italic; }
    .snap-meta { display:flex; gap:8px; align-items:center; }
    .snap-author { font-size:9px; color:var(--red); font-family:var(--font-mono); }
    .snap-time { font-size:9px; color:var(--text-muted); }
    .snap-counts { display:flex; gap:6px; font-size:9px; color:var(--text-muted); font-family:var(--font-mono); }

    .restore-btn {
      background:transparent; border:1px solid var(--border-dim);
      border-radius:var(--radius-sm); color:var(--text-muted);
      cursor:pointer; display:flex; align-items:center; padding:3px;
      flex-shrink:0; transition:all var(--t);
    }
    .restore-btn:hover { border-color:var(--red); color:var(--red); }
    .restore-btn mat-icon { font-size:14px !important; width:14px !important; height:14px !important; }
  `],
})
export class HistoryPanelComponent {
	readonly snapshots = input<TreeSnapshot[]>([]);
	readonly restore = output<number>();
	readonly close = output<void>();
}
