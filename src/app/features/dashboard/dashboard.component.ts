import { AsyncPipe, DatePipe } from "@angular/common";
import {
	ChangeDetectionStrategy,
	ChangeDetectorRef,
	Component,
	inject,
	type OnInit,
} from "@angular/core";
import {
	FormBuilder,
	ReactiveFormsModule,
	Validators,
} from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import {
	MatDialog,
	MatDialogModule,
	MatDialogRef,
} from "@angular/material/dialog";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatMenuModule } from "@angular/material/menu";
import { MatSelectModule } from "@angular/material/select";
import { MatSnackBar, MatSnackBarModule } from "@angular/material/snack-bar";
import { MatTooltipModule } from "@angular/material/tooltip";
import { Router, RouterModule } from "@angular/router";
import { TranslatePipe, TranslateService } from "@ngx-translate/core";
import { filter } from "rxjs/operators";
import type { FamilyTree } from "@core/models";
import { ExportService } from "@core/services/export.service";
import { GedcomParserService } from "@core/services/gedcom-parser.service";
import { StorageService } from "@core/services/storage.service";
import { TreeService } from "@core/services/tree.service";
import { ConfirmDialogComponent } from "../../shared/confirm-dialog.component";

/* ── New-tree dialog ───────────────────────────────── */
@Component({
	selector: "app-new-tree-dialog",
	imports: [
		ReactiveFormsModule,
		MatDialogModule,
		MatFormFieldModule,
		MatInputModule,
		MatButtonModule,
		MatIconModule,
		TranslatePipe,
	],
	template: `
    <h2 mat-dialog-title>
      <span class="dlg-marker">//</span> {{ 'TREE.NEW_DIALOG.TITLE' | translate }}
    </h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="dlg-form">
        <mat-form-field appearance="outline" class="full">
          <mat-label>{{ 'TREE.NEW_DIALOG.IDENTIFIER' | translate }}</mat-label>
          <input matInput formControlName="name" placeholder="familia_garcia_2025" autocomplete="off"/>
          <mat-error>{{ 'TREE.NEW_DIALOG.REQUIRED' | translate }}</mat-error>
        </mat-form-field>
        <mat-form-field appearance="outline" class="full">
          <mat-label>{{ 'TREE.NEW_DIALOG.DESCRIPTION' | translate }}</mat-label>
          <textarea matInput formControlName="description" rows="3" [placeholder]="'TREE.NEW_DIALOG.PLACEHOLDER_DESC' | translate"></textarea>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions>
      <button mat-button mat-dialog-close>{{ 'COMMON.CANCEL' | translate }}</button>
      <button mat-flat-button color="primary" (click)="save()" [disabled]="form.invalid">
        <mat-icon>add</mat-icon> {{ 'COMMON.CREATE' | translate }}
      </button>
    </mat-dialog-actions>
  `,
	styles: [
		`
    .dlg-form { display:flex; flex-direction:column; gap:16px; padding:16px 0; min-width:360px; }
    .full { width:100%; }
    .dlg-marker { color:var(--red); margin-right:6px; font-family:var(--font-mono); }
    h2 { display:flex; align-items:center; }
  `,
	],
})
export class NewTreeDialogComponent {
	private fb = inject(FormBuilder);
	private ref = inject(MatDialogRef<NewTreeDialogComponent>);
	form = this.fb.group({
		name: ["", Validators.required],
		description: [""],
	});
	save(): void {
		if (this.form.invalid) return;
		this.ref.close(this.form.value);
	}
}

/* ── Import dialog ─────────────────────────────────── */
@Component({
	selector: "app-import-dialog",
	imports: [
		MatDialogModule,
		MatButtonModule,
		MatIconModule,
		TranslatePipe,
	],
	template: `
    <h2 mat-dialog-title><span class="dlg-marker">//</span> {{ 'TREE.IMPORT_DIALOG.TITLE' | translate }}</h2>
    <mat-dialog-content>
      <div class="drop-zone" (click)="fileInput.click()"
        (dragover)="$event.preventDefault()" (drop)="onDrop($event)"
        [class.has-file]="!!file">
        <mat-icon class="upload-ico">upload_file</mat-icon>
        <p class="drop-label">{{ file ? file.name : ('TREE.IMPORT_DIALOG.DRAG' | translate) }}</p>
        <p class="drop-hint">{{ 'TREE.IMPORT_DIALOG.HINT' | translate }}</p>
      </div>
      <input #fileInput type="file" accept=".json,.ged" hidden (change)="onFileChange($event)"/>
    </mat-dialog-content>
    <mat-dialog-actions>
      <button mat-button mat-dialog-close>{{ 'COMMON.CANCEL' | translate }}</button>
      <button mat-flat-button color="primary" [disabled]="!file" (click)="confirm()">
        <mat-icon>input</mat-icon> {{ 'COMMON.IMPORT' | translate }}
      </button>
    </mat-dialog-actions>
  `,
	styles: [
		`
    .dlg-marker { color:var(--red); margin-right:6px; }
    .drop-zone {
      border:1px dashed var(--border-mid); border-radius:var(--radius-md);
      padding:40px 24px; text-align:center; cursor:crosshair;
      transition:all var(--t);
      min-width:340px;
    }
    .drop-zone:hover, .drop-zone.has-file { border-color:var(--red); background:var(--red-dim); }
    .upload-ico { font-size:36px !important; width:36px !important; height:36px !important; color:var(--text-muted) !important; }
    .drop-zone.has-file .upload-ico { color:var(--red) !important; }
    .drop-label { font-family:var(--font-mono); color:var(--text-secondary); margin-top:8px; font-size:12px; }
    .drop-hint { font-size:10px; color:var(--text-muted); letter-spacing:0.08em; margin-top:4px; }
  `,
	],
})
export class ImportDialogComponent {
	private ref = inject(MatDialogRef<ImportDialogComponent>);
	file: File | null = null;
	onFileChange(e: Event): void {
		this.file = (e.target as HTMLInputElement).files?.[0] ?? null;
	}
	onDrop(e: DragEvent): void {
		e.preventDefault();
		this.file = e.dataTransfer?.files?.[0] ?? null;
	}
	confirm(): void {
		this.ref.close(this.file);
	}
}

/* ── Dashboard ─────────────────────────────────────── */
@Component({
	selector: "app-dashboard",
	imports: [
		AsyncPipe,
		DatePipe,
		RouterModule,
		MatButtonModule,
		MatIconModule,
		MatDialogModule,
		MatMenuModule,
		MatSnackBarModule,
		MatTooltipModule,
		MatFormFieldModule,
		MatSelectModule,
		TranslatePipe,
	],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
    <div class="dash dot-grid">

      <!-- Header -->
      <header class="dash-header">
        <div class="logo">
          <span class="logo-mark">⬡</span>
          <span class="logo-text">genealogy<span class="logo-accent">.</span>os</span>
        </div>
        <nav class="header-nav">
          <span class="nav-item glyph-label">v1.0.0</span>
          <span class="separator">|</span>
          <button mat-button (click)="openImport()" [matTooltip]="'DASHBOARD.HEADER.IMPORT_TOOLTIP' | translate">
            <mat-icon>upload</mat-icon> {{ 'DASHBOARD.HEADER.IMPORT' | translate }}
          </button>
          
          <button class="btn-create" (click)="openNewTree()">
          <span class="btn-plus">+</span> {{ 'DASHBOARD.HEADER.NEW_TREE' | translate }}
          </button>

            <!-- Language selector -->
            <mat-form-field appearance="outline" class="lang-field" subscriptSizing="dynamic">
                <mat-label>{{ 'DASHBOARD.HEADER.LANGUAGE' | translate }}</mat-label>
                <mat-select [value]="currentLang" (selectionChange)="changeLang($event.value)">
                <mat-option value="es">Spanish</mat-option>
                <mat-option value="en">English</mat-option>
                </mat-select>
            </mat-form-field>
        </nav>
      </header>

      <!-- System status bar -->
      <div class="status-bar">
        <span class="red-dot"></span>
        <span class="status-text">{{ 'DASHBOARD.STATUS.READY' | translate }}</span>
        <span class="status-sep">|</span>
        <span class="status-text">{{ 'DASHBOARD.STATUS.TREES' | translate }}: {{ (trees$ | async)?.length ?? 0 }}</span>
        <span class="status-sep">|</span>
        <span class="status-text">{{ 'DASHBOARD.STATUS.STORAGE' | translate }}</span>
        <span class="status-spacer"></span>
        <span class="status-time">{{ now | date:'HH:mm:ss' }}</span>
      </div>

      <!-- Empty state + Tree grid -->
      @if (trees$ | async; as trees) {
        @if (trees.length === 0) {
          <div class="empty-state">
            <div class="empty-glyph">
              <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                <circle cx="32" cy="14" r="4" stroke="var(--border-bright)" stroke-width="1"/>
                <circle cx="14" cy="42" r="4" stroke="var(--border-bright)" stroke-width="1"/>
                <circle cx="50" cy="42" r="4" stroke="var(--border-bright)" stroke-width="1"/>
                <line x1="32" y1="18" x2="20" y2="38" stroke="var(--border-dim)" stroke-width="1" stroke-dasharray="3,3"/>
                <line x1="32" y1="18" x2="44" y2="38" stroke="var(--border-dim)" stroke-width="1" stroke-dasharray="3,3"/>
                <circle cx="32" cy="14" r="1.5" fill="var(--red)" opacity="0.6"/>
              </svg>
            </div>
            <p class="empty-title cursor-blink">{{ 'DASHBOARD.EMPTY.TITLE' | translate }}</p>
            <p class="empty-sub">{{ 'DASHBOARD.EMPTY.SUBTITLE' | translate }}</p>
            <button class="btn-create lg" (click)="openNewTree()">
              <span class="btn-plus">+</span> {{ 'DASHBOARD.EMPTY.CTA' | translate }}
            </button>
          </div>
        } @else {
          <!-- Tree grid -->
          <main class="tree-grid stagger">
            @for (tree of trees; track tree.id) {
              <article class="tree-card" (click)="openTree(tree)">

                <!-- Card header line -->
                <div class="card-topbar">
                  <span class="card-id">{{ tree.id.slice(0,8) }}</span>
                  <span class="card-status" [class.shared]="tree.permissions.collaborationToken">
                    {{ tree.permissions.collaborationToken ? ('TREE.CARD.SHARED' | translate) : ('TREE.CARD.LOCAL' | translate) }}
                  </span>
                  <button mat-icon-button [matMenuTriggerFor]="ctxMenu"
                    (click)="$event.stopPropagation()" class="card-menu-btn">
                    <mat-icon>more_horiz</mat-icon>
                  </button>
                  <mat-menu #ctxMenu="matMenu">
                    <button mat-menu-item (click)="openTree(tree)"><mat-icon>open_in_new</mat-icon> {{ 'TREE.CTX.OPEN' | translate }}</button>
                    <button mat-menu-item (click)="duplicateTree(tree)"><mat-icon>content_copy</mat-icon> {{ 'TREE.CTX.DUPLICATE' | translate }}</button>
                    <button mat-menu-item (click)="exportJSON(tree)"><mat-icon>download</mat-icon> {{ 'TREE.CTX.EXPORT' | translate }}</button>
                    <button mat-menu-item (click)="deleteTree(tree)" class="danger-item"><mat-icon>delete_outline</mat-icon> {{ 'TREE.CTX.DELETE' | translate }}</button>
                  </mat-menu>
                </div>

                <!-- Tree name -->
                <h2 class="card-name">{{ tree.name }}</h2>
                @if (tree.description) {
                  <p class="card-desc">{{ tree.description }}</p>
                }

                <!-- Stats row -->
                <div class="card-stats">
                  <div class="stat">
                    <span class="stat-val">{{ tree.persons.length }}</span>
                    <span class="stat-key">{{ 'TREE.CARD.PERSONS' | translate }}</span>
                  </div>
                  <div class="stat-divider"></div>
                  <div class="stat">
                    <span class="stat-val">{{ tree.relations.length }}</span>
                    <span class="stat-key">{{ 'TREE.CARD.RELATIONS' | translate }}</span>
                  </div>
                  <div class="stat-divider"></div>
                  <div class="stat">
                    <span class="stat-val">{{ tree.updatedAt | date:'MMM dd' }}</span>
                    <span class="stat-key">{{ 'TREE.CARD.MODIFIED' | translate }}</span>
                  </div>
          </div>

                <!-- Open indicator -->
                <div class="card-arrow">→</div>

              </article>
            }
          </main>
        }
      }

    </div>
  `,
	styles: [
		`
    :host { display:block; height:100vh; }
    .dash { min-height:100vh; display:flex; flex-direction:column; }

    /* Header */
    .dash-header {
      display:flex; align-items:center; justify-content:space-between;
      padding:14px 28px;
      border-bottom:1px solid var(--border-dim);
      background:rgba(12,12,12,0.9);
      backdrop-filter:blur(8px);
      position:sticky; top:0; z-index:100;
    }
    .logo { display:flex; align-items:center; gap:10px; cursor:default; }
    .logo-mark { font-size:20px; color:var(--red); line-height:1; filter:drop-shadow(0 0 6px var(--red)); }
    .logo-text { font-family:var(--font-display); font-size:14px; font-weight:700; letter-spacing:0.14em; color:var(--text-primary); text-transform:uppercase; }
    .logo-accent { color:var(--red); }
    .header-nav { display:flex; align-items:center; gap:12px; }
    .nav-item { font-size:10px; letter-spacing:0.1em; }
    .separator { color:var(--border-mid); }

    .btn-create {
      display:inline-flex; align-items:center; gap:6px;
      padding:6px 14px;
      background:transparent;
      border:1px solid var(--border-accent);
      border-radius:var(--radius-sm);
      color:var(--red);
      font-family:var(--font-display);
      font-size:9px;
      font-weight:700;
      letter-spacing:0.14em;
      text-transform:uppercase;
      cursor:crosshair;
      transition:all var(--t);
    }
    .btn-create:hover { background:var(--red-dim); box-shadow:var(--red-glow); }
    .btn-create.lg { padding:10px 22px; font-size:11px; margin-top:16px; }
    .btn-plus { font-size:16px; line-height:1; }

    /* Status bar */
    .status-bar {
      display:flex; align-items:center; gap:10px;
      padding:6px 28px;
      background:var(--bg-surface);
      border-bottom:1px solid var(--border-dim);
      font-size:10px; letter-spacing:0.08em;
    }
    .status-text { color:var(--text-muted); font-family:var(--font-mono); }
    .status-sep  { color:var(--border-dim); }
    .status-spacer { flex:1; }
    .status-time { color:var(--text-muted); font-family:var(--font-display); font-size:10px; }

    /* Empty */
    .empty-state {
      flex:1; display:flex; flex-direction:column; align-items:center;
      justify-content:center; gap:12px; padding:60px 24px;
    }
    .empty-glyph { opacity:0.5; margin-bottom:8px; }
    .empty-title { font-family:var(--font-display); font-size:14px; letter-spacing:0.12em; color:var(--text-secondary); text-transform:uppercase; }
    .empty-title::after { content:'▮'; animation:blink 1.2s step-end infinite; color:var(--red); margin-left:2px; }
    .empty-sub { font-size:11px; color:var(--text-muted); letter-spacing:0.08em; }
    @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }

    /* Grid */
    .tree-grid {
      display:grid;
      grid-template-columns:repeat(auto-fill, minmax(300px, 1fr));
      gap:16px;
      padding:24px 28px;
    }

    /* Card */
    .tree-card {
      background:var(--bg-surface);
      border:1px solid var(--border-dim);
      border-radius:var(--radius-md);
      padding:20px;
      cursor:crosshair;
      position:relative;
      transition:border-color var(--t), background var(--t);
      overflow:hidden;
    }
    .tree-card::before {
      content:'';
      position:absolute; top:0; left:0; right:0; height:1px;
      background:linear-gradient(90deg, transparent, var(--border-mid), transparent);
      opacity:0;
      transition:opacity var(--t);
    }
    .tree-card:hover {
      border-color:var(--border-mid);
      background:var(--bg-elevated);
    }
    .tree-card:hover::before { opacity:1; }

    .card-topbar { display:flex; align-items:center; gap:8px; margin-bottom:14px; }
    .card-id { font-size:9px; color:var(--text-muted); letter-spacing:0.1em; font-family:var(--font-mono); }
    .card-status { font-size:9px; color:var(--text-muted); letter-spacing:0.08em; margin-left:auto; }
    .card-status.shared { color:var(--red); }
    .card-menu-btn { width:24px !important; height:24px !important; line-height:24px !important; }
    .card-menu-btn mat-icon { font-size:16px !important; width:16px !important; height:16px !important; color:var(--text-muted) !important; }

    .card-name { font-family:var(--font-display); font-size:14px; font-weight:700; letter-spacing:0.06em; color:var(--text-primary); text-transform:uppercase; margin-bottom:6px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .card-desc { font-size:11px; color:var(--text-muted); letter-spacing:0.03em; margin-bottom:16px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

    .card-stats { display:flex; align-items:center; gap:0; border:1px solid var(--border-dim); border-radius:var(--radius-sm); overflow:hidden; }
    .stat { display:flex; flex-direction:column; align-items:center; padding:8px 0; flex:1; }
    .stat-val { font-family:var(--font-display); font-size:16px; font-weight:700; color:var(--text-primary); line-height:1; }
    .stat-key { font-size:9px; color:var(--text-muted); letter-spacing:0.1em; text-transform:uppercase; margin-top:3px; }
    .stat-divider { width:1px; height:36px; background:var(--border-dim); }

    .card-arrow { position:absolute; bottom:18px; right:20px; font-size:16px; color:var(--text-muted); transition:all var(--t); opacity:0; transform:translateX(-4px); }
    .tree-card:hover .card-arrow { opacity:1; transform:translateX(0); color:var(--red); }

    .danger-item mat-icon { color:#ff4444 !important; }
    .danger-item { color:#ff4444 !important; }

    .glyph-label { font-family:var(--font-display); font-size:9px; letter-spacing:0.18em; text-transform:uppercase; color:var(--text-muted); }

    /* Language selector */
    .lang-field {
      width:120px;
      --mdc-outlined-text-field-outline-color: var(--border-dim);
      --mdc-outlined-text-field-hover-outline-color: var(--border-mid);
      --mdc-outlined-text-field-focus-outline-color: var(--red);
      --mat-select-trigger-text-size: 10px;
      --mat-select-trigger-text-font: var(--font-display);
      --mat-select-trigger-text-tracking: 0.1em;
    }

    .lang-field .mat-mdc-form-field-infix {
      padding-top: 2px !important;
      padding-bottom: 0px !important;
      min-height: 0 !important;
    }
    .lang-field .mat-mdc-text-field-wrapper { padding: 0 8px !important; }
    .lang-field .mdc-notched-outline__notch { border-right: none !important; }

    /* ── Mobile responsive ──────────────────────────────── */
    @media (max-width: 640px) {
      .dash-header {
        flex-wrap: wrap;
        gap: 10px;
        padding: 10px 16px;
      }
      .header-nav {
        flex-wrap: wrap;
        gap: 8px;
        width: 100%;
      }
      .status-bar {
        flex-wrap: wrap;
        padding: 6px 16px;
        gap: 6px;
      }
      .status-spacer { display: none; }
      .tree-grid {
        grid-template-columns: 1fr;
        padding: 16px;
        gap: 12px;
      }
    }

    @media (max-width: 480px) {
      .nav-item.glyph-label,
      .separator { display: none; }
      .lang-field { width: 100px; }
      .btn-create { padding: 6px 10px; }
      .dash-header { padding: 8px 12px; }
      .status-bar { padding: 4px 12px; }
    }
  `],
})
export class DashboardComponent implements OnInit {
	private treeService = inject(TreeService);
	private storage = inject(StorageService);
	private exportService = inject(ExportService);
	private gedcomParser = inject(GedcomParserService);
	private dialog = inject(MatDialog);
	private snack = inject(MatSnackBar);
	private router = inject(Router);
	private cdr = inject(ChangeDetectorRef);
	private translate = inject(TranslateService);

	get currentLang(): string {
		return this.translate.currentLang || "es";
	}
	changeLang(lang: string): void {
		this.translate.use(lang);
		this.cdr.markForCheck();
	}

	trees$ = this.storage.trees$;
	now = new Date();
	private clockInterval: ReturnType<typeof setInterval> | undefined = undefined;

	ngOnInit(): void {
		this.clockInterval = setInterval(() => {
			this.now = new Date();
			this.cdr.markForCheck();
		}, 1000);
	}
	ngOnDestroy(): void {
		clearInterval(this.clockInterval);
	}

	openTree(tree: FamilyTree): void {
		this.router.navigate(["/tree", tree.id]);
	}

	openNewTree(): void {
		this.dialog
			.open(NewTreeDialogComponent, { width: "440px" })
			.afterClosed()
			.pipe(filter(Boolean))
			.subscribe(async ({ name, description }) => {
				const tree = await this.treeService.createTree(name, description);
				this.snack
					.open(this.translate.instant("DASHBOARD.SNACK.TREE_CREATED", { name: tree.name }), this.translate.instant("DASHBOARD.SNACK.OPEN_ACTION"), { duration: 4000 })
					.onAction()
					.subscribe(() => this.openTree(tree));
				this.cdr.markForCheck();
			});
	}

	async duplicateTree(tree: FamilyTree): Promise<void> {
		const copy = await this.treeService.duplicateTree(tree.id);
		if (copy)
			this.snack.open(this.translate.instant("DASHBOARD.SNACK.TREE_DUPLICATED", { name: copy.name }), "", { duration: 3000 });
		this.cdr.markForCheck();
	}

	async deleteTree(tree: FamilyTree): Promise<void> {
		const confirmed = await this.dialog.open(ConfirmDialogComponent, {
			data: { message: this.translate.instant('CONFIRM.DELETE_TREE', { name: tree.name }) },
			width: '380px',
		}).afterClosed().toPromise();
		if (!confirmed) return;
		await this.treeService.deleteTree(tree.id);
		this.snack.open(this.translate.instant("DASHBOARD.SNACK.TREE_DELETED"), "", { duration: 2500 });
		this.cdr.markForCheck();
	}

	exportJSON(tree: FamilyTree): void {
		this.exportService.downloadJSON(tree);
	}

	openImport(): void {
		this.dialog
			.open(ImportDialogComponent, { width: "420px" })
			.afterClosed()
			.pipe(filter(Boolean))
			.subscribe(async (file: File) => {
				const isGedcom = file.name.toLowerCase().endsWith(".ged");
				if (isGedcom) {
					try {
						const result = await this.gedcomParser.parseFile(file);
						const treeName = file.name.replace(/\.ged$/i, "");
						const tree = await this.treeService.createTree(treeName);
						const updatedTree: FamilyTree = {
							...tree,
							persons: result.persons,
							relations: result.relations,
						};
						await this.storage.saveTree(updatedTree);
						this.snack
							.open(this.translate.instant("DASHBOARD.SNACK.IMPORTED", { name: tree.name }), this.translate.instant("DASHBOARD.SNACK.OPEN_ACTION"), { duration: 4000 })
							.onAction()
							.subscribe(() => this.openTree(updatedTree));
					} catch {
						this.snack.open(this.translate.instant("DASHBOARD.SNACK.IMPORT_ERROR"), "", { duration: 3000 });
					}
					this.cdr.markForCheck();
					return;
				}
				const tree = await this.exportService.importJSON(file);
				if (!tree) {
					this.snack.open(this.translate.instant("DASHBOARD.SNACK.IMPORT_ERROR"), "", { duration: 3000 });
					return;
				}
				tree.id = crypto.randomUUID();
				tree.permissions = {
					ownerToken: Array.from(
						crypto.getRandomValues(new Uint8Array(16)),
						(b) => b.toString(16).padStart(2, "0"),
					).join(""),
					isPublicRead: false,
					editorTokens: [],
				};
				await this.storage.saveTree(tree);
				this.snack
					.open(this.translate.instant("DASHBOARD.SNACK.IMPORTED", { name: tree.name }), this.translate.instant("DASHBOARD.SNACK.OPEN_ACTION"), { duration: 4000 })
					.onAction()
					.subscribe(() => this.openTree(tree));
				this.cdr.markForCheck();
			});
	}
}
