import { BreakpointObserver, Breakpoints } from "@angular/cdk/layout";
import { CommonModule } from "@angular/common";
import {
	ChangeDetectionStrategy,
	type ChangeDetectorRef,
	Component,
	inject,
	type OnDestroy,
	type OnInit,
	ViewChild,
} from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import type { MatDialog } from "@angular/material/dialog";
import { MatDividerModule } from "@angular/material/divider";
import { MatIconModule } from "@angular/material/icon";
import { MatMenuModule } from "@angular/material/menu";
import { MatSidenavModule } from "@angular/material/sidenav";
import type { MatSnackBar } from "@angular/material/snack-bar";
import { MatTabsModule } from "@angular/material/tabs";
import { MatTooltipModule } from "@angular/material/tooltip";
import { type ActivatedRoute, RouterModule } from "@angular/router";
import { TranslatePipe, TranslateService } from "@ngx-translate/core";
import { fromEvent, Subscription } from "rxjs";
import { filter } from "rxjs/operators";

import type {
	FamilyTree,
	Person,
	Relation,
	TreeLayout,
} from "../../core/models";
import type { CollaborationService } from "../../core/services/collaboration.service";
import type { ExportService } from "../../core/services/export.service";
import { HistoryService } from "../../core/services/history.service";
import type { TreeService } from "../../core/services/tree.service";
import { TreeLayoutService } from "../../core/services/tree-layout.service";
import {
	PersonFormComponent,
	type PersonFormData,
} from "./person-form/person-form.component";
import {
	RelationFormComponent,
	type RelationFormData,
} from "./relation-form/relation-form.component";
import { TreeCanvasComponent } from "./tree-canvas/tree-canvas.component";

@Component({
	selector: "app-tree-editor",
	standalone: true,
	imports: [
		CommonModule,
		RouterModule,
		MatSidenavModule,
		MatButtonModule,
		MatIconModule,
		MatMenuModule,
		MatTooltipModule,
		MatDividerModule,
		MatTabsModule,
		TreeCanvasComponent,
		TranslatePipe,
	],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
    <div class="editor-shell" *ngIf="tree; else loading">

      <!-- Top bar -->
      <header class="editor-header">
        <button class="menu-btn" (click)="sidenavOpen = !sidenavOpen" [matTooltip]="'TREE_EDITOR.HEADER.TOGGLE_SIDEBAR' | translate" aria-label="Toggle sidebar">
          <mat-icon>menu</mat-icon>
        </button>
        <button class="back-btn" routerLink="/dashboard" [matTooltip]="'TREE_EDITOR.HEADER.BACK' | translate">
          <span>←</span>
        </button>
        <div class="header-breadcrumb">
          <span class="bc-root">genealogy.os</span>
          <span class="bc-sep">/</span>
          <span class="bc-name">{{ tree.name }}</span>
        </div>
        <div class="header-status">
          <span class="red-dot"></span>
          <span class="status-txt">{{ 'TREE_EDITOR.HEADER.STATUS_LIVE' | translate }}</span>
        </div>
        <div class="header-actions">          <button class="hdr-btn" [disabled]="!canUndo" (click)="undoAction()" [matTooltip]="'TREE_EDITOR.HEADER.UNDO' | translate">
              <mat-icon>undo</mat-icon>
            </button>
            <button class="hdr-btn" [disabled]="!canRedo" (click)="redoAction()" [matTooltip]="'TREE_EDITOR.HEADER.REDO' | translate">
              <mat-icon>redo</mat-icon>
            </button>          <button class="hdr-btn" (click)="shareTree()" [matTooltip]="'TREE_EDITOR.HEADER.SHARE_TOOLTIP' | translate">
            <mat-icon>share</mat-icon><span>{{ 'TREE_EDITOR.HEADER.SHARE' | translate }}</span>
          </button>
          <button class="hdr-btn" [matMenuTriggerFor]="exportMenu">
            <mat-icon>download</mat-icon><span>{{ 'TREE_EDITOR.HEADER.EXPORT' | translate }}</span>
          </button>
          <mat-menu #exportMenu="matMenu">
            <button mat-menu-item (click)="exportSVG()"><mat-icon>image</mat-icon> .svg</button>
            <button mat-menu-item (click)="exportText()"><mat-icon>text_snippet</mat-icon> .txt</button>
            <button mat-menu-item (click)="exportJSON()"><mat-icon>data_object</mat-icon> .json</button>
          </mat-menu>
        </div>
      </header>

      <mat-sidenav-container class="editor-body">

        <!-- Sidebar -->
        <mat-sidenav [mode]="isMobile ? 'over' : 'side'" [opened]="sidenavOpen" (openedChange)="sidenavOpen = $event" class="sidebar">
          <mat-tab-group animationDuration="100ms">

            <!-- Persons -->
            <mat-tab>
              <ng-template mat-tab-label>
                {{ 'TREE_EDITOR.TABS.PERSONS' | translate }} <span class="tab-ct">{{ tree.persons.length }}</span>
              </ng-template>
              <div class="tab-pane">
                <button class="add-btn" (click)="openAddPerson()">
                  <mat-icon>add</mat-icon> {{ 'TREE_EDITOR.PERSONS.ADD' | translate }}
                </button>
                <div class="list-empty" *ngIf="tree.persons.length === 0">
                  <p>{{ 'TREE_EDITOR.PERSONS.EMPTY' | translate }}</p>
                </div>
                <div class="person-list stagger">
                  <div
                    *ngFor="let p of tree.persons"
                    class="person-row"
                    [class.is-selected]="selectedPersonId === p.id"
                    (click)="selectPerson(p.id)">
                    <div class="p-avatar">
                      <img *ngIf="p.photoUrl" [src]="p.photoUrl" [alt]="p.name"/>
                      <span *ngIf="!p.photoUrl">{{ p.name.charAt(0) }}</span>
                    </div>
                    <div class="p-info">
                      <span class="p-name">{{ p.name }}</span>
                      <span class="p-meta" *ngIf="p.birthDate">b.{{ p.birthDate.slice(0,4) }}</span>
                    </div>
                    <button class="ctx-btn" [matMenuTriggerFor]="pm" (click)="$event.stopPropagation()">
                      <mat-icon>more_horiz</mat-icon>
                    </button>
                    <mat-menu #pm="matMenu">
                      <button mat-menu-item (click)="openEditPerson(p)"><mat-icon>edit</mat-icon> {{ 'TREE_EDITOR.PERSONS.CTX_EDIT' | translate }}</button>
                      <button mat-menu-item (click)="openAddRelation(p.id)"><mat-icon>link</mat-icon> {{ 'TREE_EDITOR.PERSONS.CTX_ADD_REL' | translate }}</button>
                      <button mat-menu-item (click)="deletePerson(p)" class="danger-item"><mat-icon>delete_outline</mat-icon> {{ 'TREE_EDITOR.PERSONS.CTX_DELETE' | translate }}</button>
                    </mat-menu>
                  </div>
                </div>
              </div>
            </mat-tab>

            <!-- Relations -->
            <mat-tab>
              <ng-template mat-tab-label>
                {{ 'TREE_EDITOR.TABS.RELATIONS' | translate }} <span class="tab-ct">{{ tree.relations.length }}</span>
              </ng-template>
              <div class="tab-pane">
                <button class="add-btn" [disabled]="tree.persons.length < 2" (click)="openAddRelation()">
                  <mat-icon>add_link</mat-icon> {{ 'TREE_EDITOR.RELATIONS.ADD' | translate }}
                </button>
                <div class="rel-list stagger">
                  <div *ngFor="let r of tree.relations" class="rel-row">
                    <div class="rel-line" [style.background]="getEdgeColor(r.type)"></div>
                    <div class="rel-info">
                      <span class="rel-from">{{ getPersonName(r.from) }}</span>
                      <span class="rel-type">{{ getRelLabel(r.type) }}</span>
                      <span class="rel-to">{{ getPersonName(r.to) }}</span>
                    </div>
                    <button class="ctx-btn" [matMenuTriggerFor]="rm" (click)="$event.stopPropagation()">
                      <mat-icon>more_horiz</mat-icon>
                    </button>
                    <mat-menu #rm="matMenu">
                      <button mat-menu-item (click)="openEditRelation(r)"><mat-icon>edit</mat-icon> {{ 'TREE_EDITOR.RELATIONS.CTX_EDIT' | translate }}</button>
                      <button mat-menu-item (click)="deleteRelation(r)" class="danger-item"><mat-icon>delete_outline</mat-icon> {{ 'TREE_EDITOR.RELATIONS.CTX_DELETE' | translate }}</button>
                    </mat-menu>
                  </div>
                </div>
              </div>
            </mat-tab>

            <!-- Detail -->
            <mat-tab *ngIf="selectedPerson">
              <ng-template mat-tab-label>
                <span class="red-dot" style="margin-right:6px"></span> {{ 'TREE_EDITOR.TABS.NODE' | translate }}
              </ng-template>
              <div class="tab-pane detail-pane" *ngIf="selectedPerson as p">
                <div class="detail-avatar">
                  <img *ngIf="p.photoUrl" [src]="p.photoUrl" [alt]="p.name"/>
                  <span *ngIf="!p.photoUrl">{{ p.name.charAt(0) }}</span>
                </div>
                <h3 class="detail-name">{{ p.name }}</h3>
                <p class="detail-id">id: {{ p.id.slice(0,12) }}…</p>
                <div class="detail-meta" *ngIf="p.birthDate || p.deathDate">
                  <div class="meta-row" *ngIf="p.birthDate"><span class="meta-k">{{ 'TREE_EDITOR.DETAIL.BORN' | translate }}</span><span class="meta-v">{{ p.birthDate }}</span></div>
                  <div class="meta-row" *ngIf="p.deathDate"><span class="meta-k">{{ 'TREE_EDITOR.DETAIL.DIED' | translate }}</span><span class="meta-v">{{ p.deathDate }}</span></div>
                </div>
                <p class="detail-notes" *ngIf="p.notes">{{ p.notes }}</p>
                <div class="detail-rels" *ngIf="getPersonRelations(p.id).length > 0">
                  <p class="rels-header">{{ 'TREE_EDITOR.DETAIL.RELATIONS' | translate }}</p>
                  <div *ngFor="let rel of getPersonRelations(p.id)" class="detail-rel-item">
                    <span class="dri-type">{{ rel.type }}</span>
                    <span class="dri-name">{{ rel.name }}</span>
                  </div>
                </div>
                <div class="detail-actions">
                  <button class="act-btn" (click)="openEditPerson(p)"><mat-icon>edit</mat-icon> {{ 'TREE_EDITOR.DETAIL.EDIT' | translate }}</button>
                  <button class="act-btn" (click)="openAddRelation(p.id)"><mat-icon>link</mat-icon> {{ 'TREE_EDITOR.DETAIL.LINK' | translate }}</button>
                </div>
              </div>
            </mat-tab>

          </mat-tab-group>
        </mat-sidenav>

        <!-- Canvas -->
        <mat-sidenav-content class="canvas-area">
          <app-tree-canvas
            #canvas
            [tree]="tree"
            [layout]="layout"
            [selectedPersonId]="selectedPersonId"
            (personClick)="selectPerson($event)"
            (personDblClick)="openEditPerson(getPersonById($event)!)"
            (backgroundClick)="deselectAll()">
          </app-tree-canvas>
        </mat-sidenav-content>

      </mat-sidenav-container>
    </div>

    <ng-template #loading>
      <div class="loading-screen dot-grid">
        <div class="loader-glyph">⬡</div>
        <p class="loader-txt">{{ 'TREE_EDITOR.LOADING' | translate }}</p>
      </div>
    </ng-template>
  `,
	styles: [
		`
    :host { display:flex; flex-direction:column; height:100vh; }
    .editor-shell { display:flex; flex-direction:column; height:100vh; }

    /* Header */
    .editor-header {
      display:flex; align-items:center; gap:12px;
      padding:0 16px;
      height:44px;
      background:var(--bg-surface);
      border-bottom:1px solid var(--border-dim);
      flex-shrink:0;
    }
    .back-btn {
      background:transparent; border:1px solid var(--border-dim);
      color:var(--text-secondary); font-family:var(--font-mono);
      font-size:14px; padding:4px 10px;
      border-radius:var(--radius-sm); cursor:crosshair;
      transition:all var(--t);
      line-height:1;
    }
    .back-btn:hover { border-color:var(--border-mid); color:var(--text-primary); }
    .header-breadcrumb { display:flex; align-items:center; gap:6px; font-size:11px; }
    .bc-root { color:var(--text-muted); font-family:var(--font-mono); }
    .bc-sep  { color:var(--border-mid); }
    .bc-name { color:var(--text-primary); font-family:var(--font-display); font-size:11px; letter-spacing:0.06em; text-transform:uppercase; }
    .header-status { display:flex; align-items:center; gap:6px; }
    .status-txt { font-size:9px; color:var(--text-muted); letter-spacing:0.1em; font-family:var(--font-display); text-transform:uppercase; }
    .header-actions { margin-left:auto; display:flex; gap:6px; }
    .hdr-btn {
      display:inline-flex; align-items:center; gap:4px;
      padding:4px 10px;
      background:transparent; border:1px solid var(--border-dim);
      border-radius:var(--radius-sm);
      color:var(--text-secondary); font-family:var(--font-mono); font-size:10px;
      letter-spacing:0.06em; cursor:crosshair;
      transition:all var(--t);
    }
    .hdr-btn mat-icon { font-size:13px !important; width:13px !important; height:13px !important; }
    .hdr-btn:hover { border-color:var(--border-mid); color:var(--text-primary); }
    .hdr-btn[disabled] { opacity:0.3; cursor:default; pointer-events:none; }

    /* Body */
    .editor-body { flex:1; overflow:hidden; }
    .canvas-area { background:var(--bg-void); }

    /* Sidebar */
    .sidebar { width:268px; background:var(--bg-surface) !important; border-right:1px solid var(--border-dim) !important; }
    .tab-pane { padding:10px 8px; height:calc(100vh - 90px); overflow-y:auto; display:flex; flex-direction:column; gap:8px; }
    .tab-ct { margin-left:5px; background:var(--bg-overlay); border:1px solid var(--border-dim); border-radius:2px; padding:0 4px; font-size:9px; color:var(--text-muted); }

    .add-btn {
      display:flex; align-items:center; gap:6px;
      width:100%; padding:8px 10px;
      background:transparent; border:1px dashed var(--border-dim);
      border-radius:var(--radius-sm);
      color:var(--text-secondary); font-family:var(--font-display);
      font-size:9px; letter-spacing:0.12em; text-transform:uppercase;
      cursor:crosshair; transition:all var(--t);
    }
    .add-btn mat-icon { font-size:13px !important; width:13px !important; height:13px !important; }
    .add-btn:hover:not([disabled]) { border-color:var(--red); color:var(--red); background:var(--red-dim); }
    .add-btn[disabled] { opacity:0.3; }

    /* Person rows */
    .person-row {
      display:flex; align-items:center; gap:8px;
      padding:8px 6px; border-radius:var(--radius-sm);
      border:1px solid transparent; cursor:crosshair;
      transition:all var(--t);
    }
    .person-row:hover { background:var(--bg-overlay); border-color:var(--border-dim); }
    .person-row.is-selected { background:rgba(255,51,51,0.06); border-color:rgba(255,51,51,0.3); }
    .p-avatar {
      width:28px; height:28px; border-radius:2px;
      background:var(--bg-elevated); border:1px solid var(--border-dim);
      overflow:hidden; flex-shrink:0;
      display:flex; align-items:center; justify-content:center;
      font-family:var(--font-display); font-size:12px; color:var(--text-muted);
    }
    .p-avatar img { width:100%; height:100%; object-fit:cover; }
    .p-info { flex:1; min-width:0; }
    .p-name { display:block; font-size:11px; color:var(--text-primary); font-family:var(--font-mono); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .p-meta { font-size:9px; color:var(--text-muted); letter-spacing:0.06em; }
    .ctx-btn { background:transparent; border:none; color:var(--text-muted); cursor:crosshair; padding:2px; }
    .ctx-btn mat-icon { font-size:14px !important; width:14px !important; height:14px !important; }

    /* Relation rows */
    .rel-row { display:flex; align-items:center; gap:8px; padding:6px; border-radius:var(--radius-sm); border:1px solid transparent; transition:all var(--t); }
    .rel-row:hover { background:var(--bg-overlay); border-color:var(--border-dim); }
    .rel-line { width:2px; height:32px; border-radius:1px; flex-shrink:0; opacity:0.6; }
    .rel-info { flex:1; min-width:0; display:flex; flex-direction:column; gap:1px; }
    .rel-from, .rel-to { font-size:10px; color:var(--text-primary); font-family:var(--font-mono); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .rel-type { font-size:9px; color:var(--text-muted); font-style:italic; letter-spacing:0.04em; }

    /* Detail panel */
    .detail-pane { align-items:center; }
    .detail-avatar {
      width:56px; height:56px; border-radius:3px;
      background:var(--bg-elevated); border:1px solid var(--border-dim);
      overflow:hidden; display:flex; align-items:center; justify-content:center;
      font-family:var(--font-display); font-size:24px; color:var(--text-muted);
    }
    .detail-avatar img { width:100%; height:100%; object-fit:cover; }
    .detail-name { font-family:var(--font-display); font-size:13px; letter-spacing:0.08em; text-align:center; text-transform:uppercase; }
    .detail-id { font-size:9px; color:var(--text-muted); letter-spacing:0.06em; font-family:var(--font-mono); }
    .detail-meta { width:100%; display:flex; flex-direction:column; gap:4px; border:1px solid var(--border-dim); border-radius:var(--radius-sm); padding:8px; }
    .meta-row { display:flex; justify-content:space-between; }
    .meta-k { font-size:9px; color:var(--text-muted); letter-spacing:0.1em; text-transform:uppercase; font-family:var(--font-display); }
    .meta-v { font-size:10px; color:var(--text-primary); font-family:var(--font-mono); }
    .detail-notes { font-size:10px; color:var(--text-muted); text-align:center; padding:8px; border-top:1px solid var(--border-dim); width:100%; }
    .detail-rels { width:100%; display:flex; flex-direction:column; gap:4px; }
    .rels-header { font-size:9px; color:var(--text-muted); letter-spacing:0.12em; text-transform:uppercase; font-family:var(--font-display); }
    .detail-rel-item { display:flex; gap:6px; align-items:center; padding:3px 0; border-bottom:1px solid var(--border-dim); }
    .dri-type { font-size:9px; color:var(--red); font-family:var(--font-mono); letter-spacing:0.04em; }
    .dri-name { font-size:10px; color:var(--text-primary); font-family:var(--font-mono); }
    .detail-actions { display:flex; gap:6px; margin-top:4px; }
    .act-btn {
      display:inline-flex; align-items:center; gap:4px;
      padding:5px 10px; background:transparent;
      border:1px solid var(--border-dim); border-radius:var(--radius-sm);
      color:var(--text-secondary); font-family:var(--font-mono); font-size:10px;
      cursor:crosshair; transition:all var(--t);
    }
    .act-btn:hover { border-color:var(--border-mid); color:var(--text-primary); }
    .act-btn mat-icon { font-size:12px !important; width:12px !important; height:12px !important; }

    .list-empty { padding:20px; text-align:center; font-size:10px; color:var(--text-muted); }

    /* Loading */
    .loading-screen { height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; }
    .loader-glyph { font-size:48px; color:var(--red); animation:spin 2s linear infinite; filter:drop-shadow(0 0 8px var(--red)); }
    @keyframes spin { to { transform:rotate(360deg); } }
    .loader-txt { font-family:var(--font-display); font-size:11px; letter-spacing:0.14em; color:var(--text-muted); text-transform:uppercase; }

    .danger-item { color:var(--red) !important; }
    .danger-item mat-icon { color:var(--red) !important; }

    /* Sidebar toggle button */
    .menu-btn {
      background:transparent; border:1px solid var(--border-dim);
      color:var(--text-secondary); border-radius:var(--radius-sm);
      cursor:crosshair; display:flex; align-items:center; justify-content:center;
      width:28px; height:28px; flex-shrink:0; transition:all var(--t);
      padding:0;
    }
    .menu-btn mat-icon { font-size:16px !important; width:16px !important; height:16px !important; }
    .menu-btn:hover { border-color:var(--border-mid); color:var(--text-primary); }

    /* Responsive */
    @media (max-width:640px) {
      .editor-header { padding:0 8px; gap:4px; height:48px; }
      .header-breadcrumb .bc-root,
      .header-breadcrumb .bc-sep { display:none; }
      .header-status { display:none; }
      .hdr-btn span { display:none; }
      .hdr-btn { padding:4px 6px; }
      .back-btn { padding:4px 6px; }
      .tab-pane { height:calc(100vh - 48px - 48px); }
    }
  `,
	],
})
export class TreeEditorComponent implements OnInit, OnDestroy {
	@ViewChild("canvas") canvasRef?: TreeCanvasComponent;

	private translate = inject(TranslateService);
	private historyService = inject(HistoryService);
	private breakpointObserver = inject(BreakpointObserver);

	isMobile = false;
	sidenavOpen = true;

	tree: FamilyTree | null = null;
	layout: TreeLayout | null = null;
	selectedPersonId: string | null = null;
	canUndo = false;
	canRedo = false;

	private subs = new Subscription();

	constructor(
		private route: ActivatedRoute,
		private treeService: TreeService,
		private exportService: ExportService,
		private collab: CollaborationService,
		private dialog: MatDialog,
		private snack: MatSnackBar,
		public cdr: ChangeDetectorRef,
	) {}

	ngOnInit(): void {
		this.subs.add(
			this.breakpointObserver
				.observe([Breakpoints.XSmall, Breakpoints.Small])
				.subscribe((state) => {
					this.isMobile = state.matches;
					if (!this.isMobile) this.sidenavOpen = true;
					else this.sidenavOpen = false;
					this.cdr.markForCheck();
				}),
		);

		const treeId = this.route.snapshot.paramMap.get("id") ?? "";
		this.treeService.setActiveTree(treeId);
		this.subs.add(
			this.treeService.activeTree$.subscribe((tree) => {
				this.tree = tree ?? null;
				this.layout = tree
					? new TreeLayoutService().computeLayout(tree.persons, tree.relations)
					: null;
				this.cdr.markForCheck();
			}),
		);
		this.subs.add(
			this.historyService.changed$.subscribe(() => {
				this.canUndo = this.historyService.canUndo(this.tree?.id ?? "");
				this.canRedo = this.historyService.canRedo(this.tree?.id ?? "");
				this.cdr.markForCheck();
			}),
		);
		this.subs.add(
			fromEvent<KeyboardEvent>(document, "keydown").subscribe((ev) => {
				const mod = ev.ctrlKey || ev.metaKey;
				if (!mod || !this.tree) return;
				if (ev.key === "z" && !ev.shiftKey) {
					ev.preventDefault();
					this.undoAction();
				} else if ((ev.key === "z" && ev.shiftKey) || ev.key === "y") {
					ev.preventDefault();
					this.redoAction();
				}
			}),
		);
	}

	ngOnDestroy(): void {
		this.subs.unsubscribe();
		this.treeService.setActiveTree(null);
		this.historyService.clearTree(this.tree?.id ?? "");
	}

	async undoAction(): Promise<void> {
		if (this.tree) await this.treeService.undo(this.tree.id);
	}

	async redoAction(): Promise<void> {
		if (this.tree) await this.treeService.redo(this.tree.id);
	}

	selectPerson(id: string): void {
		this.selectedPersonId = id === this.selectedPersonId ? null : id;
		this.cdr.markForCheck();
	}
	deselectAll(): void {
		this.selectedPersonId = null;
		this.cdr.markForCheck();
	}

	get selectedPerson(): Person | undefined {
		return this.tree?.persons.find((p) => p.id === this.selectedPersonId);
	}
	getPersonById(id: string): Person | undefined {
		return this.tree?.persons.find((p) => p.id === id);
	}
	getPersonName(id: string): string {
		return this.tree?.persons.find((p) => p.id === id)?.name ?? "?";
	}
	getEdgeColor(type: any): string {
		return TreeLayoutService.edgeColor(type);
	}
	getRelLabel(type: any): string {
		return TreeLayoutService.label(type);
	}

	getPersonRelations(personId: string): { type: string; name: string }[] {
		if (!this.tree) return [];
		return this.treeService
			.getRelatedPersons(this.tree, personId)
			.map(({ person, relation }) => ({
				type: TreeLayoutService.label(relation.type),
				name: person.name,
			}));
	}

	openAddPerson(): void {
		this.dialog
			.open(PersonFormComponent, {
				data: { treeId: this.tree!.id } satisfies PersonFormData,
				width: "480px",
				maxWidth: "95vw",
			})
			.afterClosed()
			.pipe(filter(Boolean))
			.subscribe(async (data) => {
				const person = await this.treeService.addPerson(this.tree!.id, data);
				this.snack.open(
					this.translate.instant("TREE_EDITOR.SNACK.PERSON_ADDED", {
						name: person.name,
					}),
					"",
					{ duration: 2500 },
				);
			});
	}

	openEditPerson(person: Person | undefined): void {
		if (!person) return;
		this.dialog
			.open(PersonFormComponent, {
				data: { person, treeId: this.tree!.id } satisfies PersonFormData,
				width: "480px",
				maxWidth: "95vw",
			})
			.afterClosed()
			.pipe(filter(Boolean))
			.subscribe(async (data) => {
				await this.treeService.updatePerson(this.tree!.id, {
					...person,
					...data,
				});
				this.snack.open(
					this.translate.instant("TREE_EDITOR.SNACK.PERSON_UPDATED"),
					"",
					{ duration: 2000 },
				);
			});
	}

	async deletePerson(p: Person): Promise<void> {
		if (!confirm(`delete "${p.name}"? all edges will also be removed.`)) return;
		await this.treeService.deletePerson(this.tree!.id, p.id);
		if (this.selectedPersonId === p.id) this.selectedPersonId = null;
		this.snack.open(
			this.translate.instant("TREE_EDITOR.SNACK.PERSON_DELETED"),
			"",
			{ duration: 2000 },
		);
	}

	openAddRelation(fromId?: string): void {
		this.dialog
			.open(RelationFormComponent, {
				data: {
					persons: this.tree!.persons,
					preselectedFrom: fromId,
				} satisfies RelationFormData,
				width: "480px",
				maxWidth: "95vw",
			})
			.afterClosed()
			.pipe(filter(Boolean))
			.subscribe(async (data) => {
				await this.treeService.addRelation(
					this.tree!.id,
					data.from,
					data.to,
					data.type,
					{
						startDate: data.startDate,
						endDate: data.endDate,
						notes: data.notes,
					},
				);
				this.snack.open(
					this.translate.instant("TREE_EDITOR.SNACK.RELATION_ADDED"),
					"",
					{ duration: 2000 },
				);
			});
	}

	openEditRelation(rel: Relation): void {
		this.dialog
			.open(RelationFormComponent, {
				data: {
					relation: rel,
					persons: this.tree!.persons,
				} satisfies RelationFormData,
				width: "480px",
				maxWidth: "95vw",
			})
			.afterClosed()
			.pipe(filter(Boolean))
			.subscribe(async (data) => {
				await this.treeService.updateRelation(this.tree!.id, {
					...rel,
					...data,
				});
				this.snack.open(
					this.translate.instant("TREE_EDITOR.SNACK.RELATION_UPDATED"),
					"",
					{ duration: 2000 },
				);
			});
	}

	async deleteRelation(rel: Relation): Promise<void> {
		if (!confirm("delete this relation?")) return;
		await this.treeService.deleteRelation(this.tree!.id, rel.id);
		this.snack.open(
			this.translate.instant("TREE_EDITOR.SNACK.RELATION_DELETED"),
			"",
			{ duration: 2000 },
		);
	}

	async shareTree(): Promise<void> {
		const token = this.tree!.permissions.ownerToken;
		const link = await this.collab.generateCollaborationLink(
			this.tree!.id,
			token,
		);
		if (!link) {
			this.snack.open(
				this.translate.instant("TREE_EDITOR.SNACK.SHARE_ERROR"),
				"",
				{ duration: 3000 },
			);
			return;
		}
		await navigator.clipboard.writeText(link).catch(() => {});
		this.snack.open(
			this.translate.instant("TREE_EDITOR.SNACK.SHARE_COPIED"),
			"",
			{ duration: 4000 },
		);
	}

	exportSVG(): void {
		this.exportService.downloadSVG(this.tree!, this.canvasRef?.getSVGElement());
	}
	exportText(): void {
		this.exportService.downloadText(this.tree!);
	}
	exportJSON(): void {
		this.exportService.downloadJSON(this.tree!);
	}
}
