import {
	ChangeDetectionStrategy,
	Component,
	computed,
	input,
	output,
	signal,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { TranslatePipe } from "@ngx-translate/core";
import type { TreeTheme } from "@core/models";

const PRESETS: { label: string; theme: TreeTheme }[] = [
	{ label: "default", theme: { accentColor: "#ff3333", nodeBg: "#1c1c1c", edgeColor: "#f0f0f0" } },
	{ label: "ocean", theme: { accentColor: "#00bcd4", nodeBg: "#0d2035", edgeColor: "#80deea" } },
	{ label: "forest", theme: { accentColor: "#4caf50", nodeBg: "#1a2a1a", edgeColor: "#a5d6a7" } },
	{ label: "sunset", theme: { accentColor: "#ff6f00", nodeBg: "#1a0d00", edgeColor: "#ffcc02" } },
];

@Component({
	selector: "app-theme-picker",
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [FormsModule, MatButtonModule, MatIconModule, TranslatePipe],
	template: `
    <div class="theme-picker" role="dialog" [attr.aria-label]="'THEME.TITLE' | translate">
      <div class="tp-header">
        <span class="tp-title">// {{ 'THEME.TITLE' | translate }}</span>
        <button class="close-btn" (click)="onClose()" [attr.aria-label]="'COMMON.CANCEL' | translate">
          <mat-icon>close</mat-icon>
        </button>
      </div>
      <div class="tp-body">

        <!-- Presets -->
        <p class="tp-label">{{ 'THEME.PRESETS' | translate }}</p>
        <div class="presets-row">
          @for (p of presets; track p.label) {
          <button class="preset-btn"
            [class.active]="isActivePreset(p.theme)"
            (click)="applyPreset(p.theme)"
            [title]="p.label">
            <span class="preset-dot" [style.background]="p.theme.accentColor"></span>
            <span class="preset-dot" [style.background]="p.theme.nodeBg" style="border:1px solid rgba(255,255,255,0.2)"></span>
            <span class="preset-dot" [style.background]="p.theme.edgeColor"></span>
            <span class="preset-lbl">{{ p.label }}</span>
          </button>
          }
        </div>

        <!-- Custom -->
        <p class="tp-label" style="margin-top:12px">{{ 'THEME.CUSTOM' | translate }}</p>
        <div class="color-rows">
          <div class="color-row">
            <label class="color-lbl" for="accent-color">{{ 'THEME.ACCENT' | translate }}</label>
            <input id="accent-color" type="color" class="color-input" [ngModel]="current().accentColor"
              (ngModelChange)="updateField('accentColor', $event)"/>
            <span class="color-hex">{{ current().accentColor }}</span>
          </div>
          <div class="color-row">
            <label class="color-lbl" for="node-bg-color">{{ 'THEME.NODE_BG' | translate }}</label>
            <input id="node-bg-color" type="color" class="color-input" [ngModel]="current().nodeBg"
              (ngModelChange)="updateField('nodeBg', $event)"/>
            <span class="color-hex">{{ current().nodeBg }}</span>
          </div>
          <div class="color-row">
            <label class="color-lbl" for="edge-color">{{ 'THEME.EDGE_COLOR' | translate }}</label>
            <input id="edge-color" type="color" class="color-input" [ngModel]="current().edgeColor"
              (ngModelChange)="updateField('edgeColor', $event)"/>
            <span class="color-hex">{{ current().edgeColor }}</span>
          </div>
        </div>

        <button class="apply-btn" (click)="onApply()">
          <mat-icon>check</mat-icon> {{ 'THEME.APPLY' | translate }}
        </button>
      </div>
    </div>
  `,
	styles: [`
    :host { display:block; }
    .theme-picker {
      width:260px; background:var(--bg-surface);
      border:1px solid var(--border-dim); border-radius:var(--radius-md);
      box-shadow:0 8px 24px rgba(0,0,0,0.5);
    }
    .tp-header {
      display:flex; align-items:center; justify-content:space-between;
      padding:10px 12px; border-bottom:1px solid var(--border-dim);
    }
    .tp-title { font-family:var(--font-mono); font-size:12px; color:var(--text-primary); letter-spacing:0.06em; }
    .close-btn { background:transparent; border:none; color:var(--text-muted); cursor:pointer; display:flex; align-items:center; padding:2px; }
    .close-btn mat-icon { font-size:16px !important; width:16px !important; height:16px !important; }
    .close-btn:hover { color:var(--text-primary); }
    .tp-body { padding:12px; display:flex; flex-direction:column; gap:8px; }
    .tp-label { font-size:9px; color:var(--text-muted); font-family:var(--font-mono); letter-spacing:0.1em; text-transform:uppercase; margin:0; }

    .presets-row { display:flex; flex-wrap:wrap; gap:6px; }
    .preset-btn {
      display:flex; align-items:center; gap:4px; padding:4px 8px;
      background:var(--bg-elevated); border:1px solid var(--border-dim);
      border-radius:var(--radius-sm); cursor:pointer; transition:all var(--t);
    }
    .preset-btn:hover, .preset-btn.active { border-color:var(--red); }
    .preset-dot { width:10px; height:10px; border-radius:50%; display:inline-block; }
    .preset-lbl { font-size:9px; color:var(--text-muted); font-family:var(--font-mono); margin-left:2px; }

    .color-rows { display:flex; flex-direction:column; gap:6px; }
    .color-row { display:flex; align-items:center; gap:8px; }
    .color-lbl { font-size:10px; color:var(--text-secondary); font-family:var(--font-mono); flex:1; }
    .color-input { width:28px; height:24px; border:1px solid var(--border-dim); border-radius:3px; padding:1px; background:transparent; cursor:pointer; }
    .color-hex { font-size:9px; color:var(--text-muted); font-family:var(--font-mono); width:56px; }

    .apply-btn {
      display:flex; align-items:center; gap:6px; justify-content:center;
      width:100%; padding:8px; margin-top:4px;
      background:var(--red-dim); border:1px solid var(--red);
      border-radius:var(--radius-sm); color:var(--red);
      font-family:var(--font-mono); font-size:11px; letter-spacing:0.08em;
      cursor:pointer; transition:all var(--t);
    }
    .apply-btn:hover { background:var(--red); color:#fff; }
    .apply-btn mat-icon { font-size:14px !important; width:14px !important; height:14px !important; }
  `],
})
export class ThemePickerComponent {
	readonly initialTheme = input<TreeTheme | undefined>(undefined);
	readonly themeChange = output<TreeTheme>();
	readonly close = output<void>();

	readonly presets = PRESETS;
	readonly current = signal<TreeTheme>({ accentColor: "#ff3333", nodeBg: "#1c1c1c", edgeColor: "#f0f0f0" });

	readonly _init = computed(() => {
		const t = this.initialTheme();
		if (t) this.current.set({ ...t });
	});

	updateField(field: keyof TreeTheme, value: string): void {
		this.current.update((c) => ({ ...c, [field]: value }));
	}

	applyPreset(theme: TreeTheme): void {
		this.current.set({ ...theme });
	}

	isActivePreset(theme: TreeTheme): boolean {
		const c = this.current();
		return c.accentColor === theme.accentColor && c.nodeBg === theme.nodeBg && c.edgeColor === theme.edgeColor;
	}

	onApply(): void {
		this.themeChange.emit({ ...this.current() });
		this.close.emit();
	}

	onClose(): void {
		this.close.emit();
	}
}
