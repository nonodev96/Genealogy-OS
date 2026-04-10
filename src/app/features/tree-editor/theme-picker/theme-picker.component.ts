import {
	ChangeDetectionStrategy,
	Component,
	computed,
	effect,
	input,
	output,
	signal,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import type { TreeTheme } from "@core/models";
import { DEFAULT_PALETTE } from "@core/services/palette.service";
import { TranslatePipe } from "@ngx-translate/core";

const PRESETS: { label: string; theme: TreeTheme }[] = [
	{
		label: "default",
		theme: {
			accentColor: "#ff3333",
			nodeBackground: "#1c1c1c",
			edgeColor: "#f0f0f0",
			personRowBackground: "#0c0c0c",
			personRowText: "#f0f0f0",
			personRowBorder: "#1e1e1e",
			nodeBorder: "#333333",
			nodeText: "#f0f0f0",
			nodeSelectedBackground: "#1a0000",
			nodeSelectedBorder: "#ff3333",
			selectionBorder: "#4499ff",
			selectionBackground: "#2266cc",
		},
	},
	{
		label: "ocean",
		theme: {
			accentColor: "#00bcd4",
			nodeBackground: "#0d2035",
			edgeColor: "#80deea",
			personRowBackground: "#07192b",
			personRowText: "#e0f7fa",
			personRowBorder: "#1a4060",
			nodeBorder: "#1a4060",
			nodeText: "#e0f7fa",
			nodeSelectedBackground: "#003344",
			nodeSelectedBorder: "#00bcd4",
			selectionBorder: "#00e5ff",
			selectionBackground: "#0097a7",
		},
	},
	{
		label: "forest",
		theme: {
			accentColor: "#4caf50",
			nodeBackground: "#1a2a1a",
			edgeColor: "#a5d6a7",
			personRowBackground: "#111a11",
			personRowText: "#e8f5e9",
			personRowBorder: "#2a4a2a",
			nodeBorder: "#2a4a2a",
			nodeText: "#e8f5e9",
			nodeSelectedBackground: "#0d200d",
			nodeSelectedBorder: "#4caf50",
			selectionBorder: "#69f0ae",
			selectionBackground: "#2e7d32",
		},
	},
	{
		label: "sunset",
		theme: {
			accentColor: "#ff6f00",
			nodeBackground: "#1a0d00",
			edgeColor: "#ffcc02",
			personRowBackground: "#110800",
			personRowText: "#fff8e1",
			personRowBorder: "#3d2000",
			nodeBorder: "#3d2000",
			nodeText: "#fff8e1",
			nodeSelectedBackground: "#220c00",
			nodeSelectedBorder: "#ff6f00",
			selectionBorder: "#ffab40",
			selectionBackground: "#e65100",
		},
	},
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
      <div class="tp-body" tabindex="0">

        <!-- Presets -->
        <p class="tp-label">{{ 'THEME.PRESETS' | translate }}</p>
        <div class="presets-row">
          @for (p of presets; track p.label) {
          <button class="preset-btn"
            [class.active]="isActivePreset(p.theme)"
            (click)="applyPreset(p.theme)"
            [title]="p.label">
            <span class="preset-dot" [style.background]="p.theme.accentColor"></span>
            <span class="preset-dot" [style.background]="p.theme.nodeBackground" style="border:1px solid rgba(255,255,255,0.2)"></span>
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
            <input id="node-bg-color" type="color" class="color-input" [ngModel]="current().nodeBackground"
              (ngModelChange)="updateField('nodeBackground', $event)"/>
            <span class="color-hex">{{ current().nodeBackground }}</span>
          </div>
          <div class="color-row">
            <label class="color-lbl" for="edge-color">{{ 'THEME.EDGE_COLOR' | translate }}</label>
            <input id="edge-color" type="color" class="color-input" [ngModel]="current().edgeColor"
              (ngModelChange)="updateField('edgeColor', $event)"/>
            <span class="color-hex">{{ current().edgeColor }}</span>
          </div>
          <div class="color-row">
            <label class="color-lbl" for="pr-bg">{{ 'THEME.PERSON_ROW_BG' | translate }}</label>
            <input id="pr-bg" type="color" class="color-input" [ngModel]="current().personRowBackground"
              (ngModelChange)="updateField('personRowBackground', $event)"/>
            <span class="color-hex">{{ current().personRowBackground }}</span>
          </div>
          <div class="color-row">
            <label class="color-lbl" for="pr-text">{{ 'THEME.PERSON_ROW_TEXT' | translate }}</label>
            <input id="pr-text" type="color" class="color-input" [ngModel]="current().personRowText"
              (ngModelChange)="updateField('personRowText', $event)"/>
            <span class="color-hex">{{ current().personRowText }}</span>
          </div>
          <div class="color-row">
            <label class="color-lbl" for="pr-border">{{ 'THEME.PERSON_ROW_BORDER' | translate }}</label>
            <input id="pr-border" type="color" class="color-input" [ngModel]="current().personRowBorder"
              (ngModelChange)="updateField('personRowBorder', $event)"/>
            <span class="color-hex">{{ current().personRowBorder }}</span>
          </div>
          <div class="color-row">
            <label class="color-lbl" for="node-border">{{ 'THEME.NODE_BORDER' | translate }}</label>
            <input id="node-border" type="color" class="color-input" [ngModel]="current().nodeBorder"
              (ngModelChange)="updateField('nodeBorder', $event)"/>
            <span class="color-hex">{{ current().nodeBorder }}</span>
          </div>
          <div class="color-row">
            <label class="color-lbl" for="node-text">{{ 'THEME.NODE_TEXT' | translate }}</label>
            <input id="node-text" type="color" class="color-input" [ngModel]="current().nodeText"
              (ngModelChange)="updateField('nodeText', $event)"/>
            <span class="color-hex">{{ current().nodeText }}</span>
          </div>
          <div class="color-row">
            <label class="color-lbl" for="node-sel-bg">{{ 'THEME.NODE_SEL_BG' | translate }}</label>
            <input id="node-sel-bg" type="color" class="color-input" [ngModel]="current().nodeSelectedBackground"
              (ngModelChange)="updateField('nodeSelectedBackground', $event)"/>
            <span class="color-hex">{{ current().nodeSelectedBackground }}</span>
          </div>
          <div class="color-row">
            <label class="color-lbl" for="node-sel-border">{{ 'THEME.NODE_SEL_BORDER' | translate }}</label>
            <input id="node-sel-border" type="color" class="color-input" [ngModel]="current().nodeSelectedBorder"
              (ngModelChange)="updateField('nodeSelectedBorder', $event)"/>
            <span class="color-hex">{{ current().nodeSelectedBorder }}</span>
          </div>
          <div class="color-row">
            <label class="color-lbl" for="selection-border">{{ 'THEME.SELECTION_BORDER' | translate }}</label>
            <input id="selection-border" type="color" class="color-input" [ngModel]="current().selectionBorder"
              (ngModelChange)="updateField('selectionBorder', $event)"/>
            <span class="color-hex">{{ current().selectionBorder }}</span>
          </div>
          <div class="color-row">
            <label class="color-lbl" for="selection-bg">{{ 'THEME.SELECTION_BG' | translate }}</label>
            <input id="selection-bg" type="color" class="color-input" [ngModel]="current().selectionBackground"
              (ngModelChange)="updateField('selectionBackground', $event)"/>
            <span class="color-hex">{{ current().selectionBackground }}</span>
          </div>
        </div>

        <button class="apply-btn" (click)="onApply()">
          <mat-icon>check</mat-icon> {{ 'THEME.APPLY' | translate }}
        </button>
      </div>
    </div>
  `,
	styles: [
		`
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
    .tp-body { padding:12px; display:flex; flex-direction:column; gap:8px; max-height:70vh; overflow-y:auto; }
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
  `,
	],
})
export class ThemePickerComponent {
	readonly initialTheme = input<TreeTheme | undefined>(undefined);
	readonly themeChange = output<TreeTheme>();
	readonly close = output<void>();

	readonly presets = PRESETS;
	readonly current = signal<TreeTheme>({ ...DEFAULT_PALETTE });

	constructor() {
		// Sync the local editing state whenever the parent passes a new initial theme.
		// Using effect() instead of computed() so the update actually runs reactively.
		effect(() => {
			const t = this.initialTheme();
			if (t) this.current.set({ ...DEFAULT_PALETTE, ...t });
		});
	}

	updateField(field: keyof TreeTheme, value: string): void {
		this.current.update((c) => ({ ...c, [field]: value }));
	}

	applyPreset(theme: TreeTheme): void {
		this.current.set({ ...theme });
	}

	isActivePreset(theme: TreeTheme): boolean {
		const c = this.current();
		return (
			c.accentColor === theme.accentColor &&
			c.nodeBackground === theme.nodeBackground &&
			c.edgeColor === theme.edgeColor &&
			c.nodeSelectedBorder === theme.nodeSelectedBorder
		);
	}

	onApply(): void {
		this.themeChange.emit({ ...this.current() });
		this.close.emit();
	}

	onClose(): void {
		this.close.emit();
	}
}
