import { BreakpointObserver, Breakpoints } from "@angular/cdk/layout";
import { DatePipe } from "@angular/common";
import {
ChangeDetectionStrategy,
ChangeDetectorRef,
Component,
inject,
signal,
type OnDestroy,
type OnInit,
ViewChild,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatChipsModule } from "@angular/material/chips";
import { MatDialog } from "@angular/material/dialog";
import { MatDividerModule } from "@angular/material/divider";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatMenuModule } from "@angular/material/menu";
import { MatSidenavModule } from "@angular/material/sidenav";
import { MatSnackBar } from "@angular/material/snack-bar";
import { MatTabsModule } from "@angular/material/tabs";
import { MatTooltipModule } from "@angular/material/tooltip";
import { ActivatedRoute, RouterModule } from "@angular/router";
import { TranslatePipe, TranslateService } from "@ngx-translate/core";
import { fromEvent, Subscription, firstValueFrom } from "rxjs";
import { filter } from "rxjs/operators";

import type { FamilyTree, Person, PersonComment, Relation, RelationType, TreeLayout, TreeTheme } from "@core/models";
import { CollaborationService } from "@core/services/collaboration.service";
import { ExportService } from "@core/services/export.service";
import { HistoryService, type TreeSnapshot } from "@core/services/history.service";
import { PaletteService } from "@core/services/palette.service";
import { StorageService } from "@core/services/storage.service";
import { TreeService } from "@core/services/tree.service";
import { TreeLayoutService } from "@core/services/tree-layout.service";
import {
PersonFormComponent,
type PersonFormData,
} from "./person-form/person-form.component";
import {
RelationFormComponent,
type RelationFormData,
} from "./relation-form/relation-form.component";
import { TreeCanvasComponent } from "./tree-canvas/tree-canvas.component";
import { TimelineComponent } from "./timeline/timeline.component";
import { StatsPanelComponent } from "./stats-panel/stats-panel.component";
import { ThemePickerComponent } from "./theme-picker/theme-picker.component";
import { HistoryPanelComponent } from "./history-panel/history-panel.component";
import { ConfirmDialogComponent } from "../../shared/confirm-dialog.component";


@Component({
	selector: "app-tree-editor",
	imports: [
		RouterModule,
		FormsModule,
		DatePipe,
		MatSidenavModule,
		MatButtonModule,
		MatIconModule,
		MatMenuModule,
		MatTooltipModule,
		MatDividerModule,
		MatTabsModule,
		MatFormFieldModule,
		MatInputModule,
		MatChipsModule,
		TreeCanvasComponent,
		TimelineComponent,
		StatsPanelComponent,
		ThemePickerComponent,
		HistoryPanelComponent,
		TranslatePipe,
	],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
    @if (tree) {
    <div class="editor-shell">

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
            <button mat-menu-item (click)="exportPDF()"><mat-icon>picture_as_pdf</mat-icon> .pdf</button>
          </mat-menu>
          <mat-divider [vertical]="true" style="height:20px;margin:0 4px"></mat-divider>
          <button class="hdr-btn" [class.hdr-btn--active]="activeView() === 'timeline'" (click)="toggleView()" [matTooltip]="('TREE_EDITOR.HEADER.TIMELINE' | translate)">
            <mat-icon>timeline</mat-icon>
          </button>
          <button class="hdr-btn" [class.hdr-btn--active]="showStats()" (click)="showStats.set(!showStats())" [matTooltip]="('TREE_EDITOR.HEADER.STATS' | translate)">
            <mat-icon>bar_chart</mat-icon>
          </button>
          <button class="hdr-btn" [class.hdr-btn--active]="showHistory()" (click)="showHistory.set(!showHistory())" [matTooltip]="('TREE_EDITOR.HEADER.HISTORY' | translate)">
            <mat-icon>history</mat-icon>
          </button>
          <button class="hdr-btn" [class.hdr-btn--active]="showThemePicker()" (click)="showThemePicker.set(!showThemePicker())" [matTooltip]="('TREE_EDITOR.HEADER.THEME' | translate)">
            <mat-icon>palette</mat-icon>
          </button>
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
                <!-- Search input -->
                <div class="search-box">
                  <mat-icon class="search-ico">search</mat-icon>
                  <input class="search-input" type="text" [(ngModel)]="personSearchValue"
                    [placeholder]="'SEARCH.PLACEHOLDER' | translate"
                    (input)="personSearch.set(personSearchValue)"
                    aria-label="Search persons"/>
                  @if (personSearch()) {
                    <button class="search-clear" (click)="personSearchValue=''; personSearch.set('')" aria-label="Clear search">
                      <mat-icon>close</mat-icon>
                    </button>
                  }
                </div>
                <!-- Tag filter chips -->
                @if (allTags.length > 0) {
                  <div class="tag-filters" role="group" [attr.aria-label]="'TAGS.LABEL' | translate">
                    @for (tag of allTags; track tag) {
                      <button class="tag-chip" [class.tag-chip--active]="activeTagFilters().includes(tag)"
                        (click)="toggleTagFilter(tag)">{{ tag }}</button>
                    }
                  </div>
                }
                @if (filteredPersons.length === 0) {
                  <div class="list-empty">
                    <p>{{ 'TREE_EDITOR.PERSONS.EMPTY' | translate }}</p>
                  </div>
                }
                <div class="person-list stagger">
                  @for (p of filteredPersons; track p.id) {
                  <div
                    class="person-row"
                    [class.is-selected]="selectedPersonId === p.id"
                    (click)="selectPerson(p.id)">
                    <div class="p-avatar">
                      @if (p.photoUrl) { <img [src]="p.photoUrl" [alt]="p.name"/> }
                      @if (!p.photoUrl) { <span>{{ p.name.charAt(0) }}</span> }
                    </div>
                    <div class="p-info">
                      <span class="p-name">{{ p.name }}</span>
                      @if (p.birthDate) { <span class="p-meta">b.{{ p.birthDate.slice(0,4) }}</span> }
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
                  }
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
                  @for (r of tree.relations; track r.id) {
                  <div class="rel-row">
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
                  }
                </div>
              </div>
            </mat-tab>

            <!-- Detail -->
            @if (selectedPerson; as p) {
            <mat-tab>
              <ng-template mat-tab-label>
                <span class="red-dot" style="margin-right:6px"></span> {{ 'TREE_EDITOR.TABS.NODE' | translate }}
              </ng-template>
              <div class="tab-pane detail-pane">
                <div class="detail-avatar">
                  @if (p.photoUrl) { <img [src]="p.photoUrl" [alt]="p.name"/> }
                  @if (!p.photoUrl) { <span>{{ p.name.charAt(0) }}</span> }
                </div>
                <h3 class="detail-name">{{ p.name }}</h3>
                <p class="detail-id">id: {{ p.id.slice(0,12) }}…</p>
                @if (p.birthDate || p.deathDate) {
                  <div class="detail-meta">
                    @if (p.birthDate) { <div class="meta-row"><span class="meta-k">{{ 'TREE_EDITOR.DETAIL.BORN' | translate }}</span><span class="meta-v">{{ p.birthDate }}</span></div> }
                    @if (p.deathDate) { <div class="meta-row"><span class="meta-k">{{ 'TREE_EDITOR.DETAIL.DIED' | translate }}</span><span class="meta-v">{{ p.deathDate }}</span></div> }
                  </div>
                }
                @if (p.notes) { <p class="detail-notes">{{ p.notes }}</p> }
                @if (getPersonRelations(p.id).length > 0) {
                  <div class="detail-rels">
                    <p class="rels-header">{{ 'TREE_EDITOR.DETAIL.RELATIONS' | translate }}</p>
                    @for (rel of getPersonRelations(p.id); track rel.type) {
                    <div class="detail-rel-item">
                      <span class="dri-type">{{ rel.type }}</span>
                      <span class="dri-name">{{ rel.name }}</span>
                    </div>
                    }
                  </div>
                }
                <div class="detail-actions">
                  <button class="act-btn" (click)="openEditPerson(p)"><mat-icon>edit</mat-icon> {{ 'TREE_EDITOR.DETAIL.EDIT' | translate }}</button>
                  <button class="act-btn" (click)="openAddRelation(p.id)"><mat-icon>link</mat-icon> {{ 'TREE_EDITOR.DETAIL.LINK' | translate }}</button>
                </div>
                <!-- Tags -->
                @if (p.tags && p.tags.length > 0) {
                  <div class="detail-tags" [attr.aria-label]="'TREE_EDITOR.DETAIL.TAGS' | translate">
                    @for (tag of p.tags; track tag) {
                      <span class="detail-tag-chip">{{ tag }}</span>
                    }
                  </div>
                }
                <!-- Comments -->
                <div class="comments-section">
                  <p class="section-label">{{ 'TREE_EDITOR.DETAIL.COMMENTS' | translate }}</p>
                  @if (getPersonComments(p.id).length === 0) {
                    <p class="comments-empty">{{ 'COMMENTS.EMPTY' | translate }}</p>
                  }
                  @for (c of getPersonComments(p.id); track c.id) {
                    <div class="comment-row">
                      <div class="c-header">
                        <span class="c-author">{{ c.author || ('COMMENTS.ANONYMOUS' | translate) }}</span>
                        <span class="c-time">{{ c.createdAt | date:'dd MMM HH:mm' }}</span>
                        <button class="c-del" (click)="deleteComment(c.id)" [attr.aria-label]="'COMMENTS.DELETE' | translate">
                          <mat-icon>close</mat-icon>
                        </button>
                      </div>
                      <p class="c-text">{{ c.text }}</p>
                    </div>
                  }
                  <div class="comment-form">
                    <input class="c-input" type="text" [(ngModel)]="newCommentAuthor"
                      [placeholder]="'COMMENTS.AUTHOR_PLACEHOLDER' | translate"/>
                    <textarea class="c-input c-textarea" [(ngModel)]="newCommentText" rows="2"
                      [placeholder]="'COMMENTS.PLACEHOLDER' | translate"></textarea>
                    <button class="c-add-btn" [disabled]="!newCommentText.trim()" (click)="addComment(p.id)">
                      <mat-icon>add_comment</mat-icon> {{ 'COMMENTS.ADD' | translate }}
                    </button>
                  </div>
                </div>
              </div>
            </mat-tab>
            }

          </mat-tab-group>
        </mat-sidenav>

        <!-- Canvas + panels -->
        <mat-sidenav-content class="canvas-area">
          <div class="canvas-with-panels">
            <!-- Main view -->
            <div class="main-view">
              @if (showThemePicker()) {
                <div class="theme-overlay">
                  <app-theme-picker
                    [initialTheme]="tree.theme"
                    (themeChange)="applyTheme($event)"
                    (close)="showThemePicker.set(false)">
                  </app-theme-picker>
                </div>
              }
              @if (activeView() === 'canvas') {
                <app-tree-canvas
                  #canvas
                  [tree]="tree"
                  [layout]="layout"
                  [selectedPersonId]="selectedPersonId"
                  (personClick)="selectPerson($event)"
                  (personDblClick)="openEditPerson(getPersonById($event)!)"
                  (backgroundClick)="deselectAll()">
                </app-tree-canvas>
              } @else {
                <app-timeline
                  [persons]="tree.persons"
                  (personClick)="selectPerson($event)">
                </app-timeline>
              }
            </div>
            <!-- Stats panel -->
            @if (showStats()) {
              <app-stats-panel [tree]="tree" (close)="showStats.set(false)"></app-stats-panel>
            }
            <!-- History panel -->
            @if (showHistory()) {
              <app-history-panel
                [snapshots]="historySnapshots"
                (restore)="restoreSnapshot($event)"
                (close)="showHistory.set(false)">
              </app-history-panel>
            }
          </div>
        </mat-sidenav-content>

      </mat-sidenav-container>
    </div>
    } @else {
    <div class="loading-screen dot-grid">
      <div class="loader-glyph">⧁</div>
      <p class="loader-txt">{{ 'TREE_EDITOR.LOADING' | translate }}</p>
    </div>
    }
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
    .header-breadcrumb { display:flex; align-items:center; gap:6px; font-size:15px; }
    .bc-root { color:var(--text-muted); font-family:var(--font-mono); }
    .bc-sep  { color:var(--border-mid); }
    .bc-name { color:var(--text-primary); font-family:var(--font-display); font-size:15px; letter-spacing:0.06em; text-transform:uppercase; }
    .header-status { display:flex; align-items:center; gap:6px; }
    .status-txt { font-size:9px; color:var(--text-muted); letter-spacing:0.1em; font-family:var(--font-display); text-transform:uppercase; }
    .header-actions { margin-left:auto; display:flex; gap:6px; }
    .hdr-btn {
      display:inline-flex; align-items:center; gap:6px;
      padding:6px 14px;
      background:transparent; border:1px solid var(--border-dim);
      border-radius:var(--radius-sm);
      color:var(--text-secondary); font-family:var(--font-mono); font-size:13px;
      letter-spacing:0.06em; cursor:crosshair;
      transition:all var(--t);
    }
    .hdr-btn mat-icon { font-size:18px !important; width:18px !important; height:18px !important; }
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
      width:100%; padding:10px 12px;
      background:transparent; border:1px dashed var(--border-mid);
      border-radius:var(--radius-sm);
      color:var(--text-primary); font-family:var(--font-display);
      font-size:12px; letter-spacing:0.12em; text-transform:uppercase;
      cursor:crosshair; transition:all var(--t);
    }
    .add-btn mat-icon { font-size:16px !important; width:16px !important; height:16px !important; }
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
    .ctx-btn { background:transparent; border:none; color:var(--text-secondary); cursor:pointer; padding:2px; }
    .ctx-btn mat-icon { font-size:16px !important; width:16px !important; height:16px !important; }
    .ctx-btn:hover { color:var(--text-primary); }

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

    /* Active header button */
    .hdr-btn--active { border-color:var(--red) !important; color:var(--red) !important; background:var(--red-dim) !important; }

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

    /* Canvas with panels layout */
    .canvas-with-panels { display:flex; height:100%; overflow:hidden; }
    .main-view { flex:1; position:relative; overflow:hidden; }
    .theme-overlay {
      position:absolute; top:12px; right:12px; z-index:100;
    }

    /* Search */
    .search-box {
      display:flex; align-items:center; gap:6px;
      background:var(--bg-elevated); border:1px solid var(--border-dim);
      border-radius:var(--radius-sm); padding:4px 8px;
      transition:border-color var(--t);
    }
    .search-box:focus-within { border-color:var(--border-mid); }
    .search-ico { font-size:14px !important; width:14px !important; height:14px !important; color:var(--text-muted); flex-shrink:0; }
    .search-input {
      flex:1; background:transparent; border:none; outline:none;
      color:var(--text-primary); font-family:var(--font-mono); font-size:11px;
      min-width:0;
    }
    .search-input::placeholder { color:var(--text-muted); }
    .search-clear {
      background:transparent; border:none; padding:0; cursor:pointer;
      color:var(--text-muted); display:flex; align-items:center;
    }
    .search-clear mat-icon { font-size:12px !important; width:12px !important; height:12px !important; }
    .search-clear:hover { color:var(--text-primary); }

    /* Tag filter chips */
    .tag-filters { display:flex; flex-wrap:wrap; gap:4px; }
    .tag-chip {
      padding:2px 8px; background:var(--bg-elevated); border:1px solid var(--border-dim);
      border-radius:2px; font-size:9px; color:var(--text-muted); font-family:var(--font-mono);
      cursor:pointer; transition:all var(--t); letter-spacing:0.06em;
    }
    .tag-chip:hover { border-color:var(--border-mid); color:var(--text-primary); }
    .tag-chip--active { border-color:var(--red); color:var(--red); background:var(--red-dim); }

    /* Detail tags */
    .detail-tags { display:flex; flex-wrap:wrap; gap:4px; width:100%; }
    .detail-tag-chip {
      padding:2px 8px; background:var(--red-dim); border:1px solid var(--red);
      border-radius:2px; font-size:9px; color:var(--red); font-family:var(--font-mono);
      letter-spacing:0.06em;
    }

    /* Comments */
    .section-label { font-size:9px; color:var(--text-muted); font-family:var(--font-mono); letter-spacing:0.1em; text-transform:uppercase; margin-top:4px; width:100%; }
    .comments-section { width:100%; display:flex; flex-direction:column; gap:8px; margin-top:4px; }
    .comments-empty { font-size:10px; color:var(--text-muted); font-family:var(--font-mono); text-align:center; padding:8px 0; }
    .comment-row {
      background:var(--bg-elevated); border:1px solid var(--border-dim);
      border-radius:var(--radius-sm); padding:8px;
    }
    .c-header { display:flex; align-items:center; gap:6px; margin-bottom:4px; }
    .c-author { font-size:10px; color:var(--red); font-family:var(--font-mono); flex:1; }
    .c-time { font-size:9px; color:var(--text-muted); }
    .c-del {
      background:transparent; border:none; padding:0; cursor:pointer;
      color:var(--text-muted); display:flex; align-items:center;
    }
    .c-del mat-icon { font-size:12px !important; width:12px !important; height:12px !important; }
    .c-del:hover { color:var(--red); }
    .c-text { font-size:10px; color:var(--text-secondary); font-family:var(--font-mono); word-break:break-word; }
    .comment-form { display:flex; flex-direction:column; gap:6px; }
    .c-input {
      background:var(--bg-elevated); border:1px solid var(--border-dim);
      border-radius:var(--radius-sm); padding:6px 8px;
      color:var(--text-primary); font-family:var(--font-mono); font-size:11px;
      outline:none; transition:border-color var(--t); width:100%;
    }
    .c-input:focus { border-color:var(--border-mid); }
    .c-input::placeholder { color:var(--text-muted); }
    .c-textarea { resize:vertical; min-height:52px; }
    .c-add-btn {
      display:inline-flex; align-items:center; gap:4px;
      padding:6px 10px; background:var(--red-dim); border:1px solid var(--red);
      border-radius:var(--radius-sm); color:var(--red);
      font-family:var(--font-mono); font-size:10px; cursor:pointer;
      transition:all var(--t); letter-spacing:0.06em;
    }
    .c-add-btn mat-icon { font-size:12px !important; width:12px !important; height:12px !important; }
    .c-add-btn:hover:not([disabled]) { background:var(--red); color:#fff; }
    .c-add-btn[disabled] { opacity:0.3; cursor:default; }

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

	private route = inject(ActivatedRoute);
	private treeService = inject(TreeService);
	private storageService = inject(StorageService);
	private exportService = inject(ExportService);
	private collab = inject(CollaborationService);
	private dialog = inject(MatDialog);
	private snack = inject(MatSnackBar);
	private cdr = inject(ChangeDetectorRef);
	private translate = inject(TranslateService);
	private historyService = inject(HistoryService);
	private breakpointObserver = inject(BreakpointObserver);
	private paletteService = inject(PaletteService);

	isMobile = false;
	sidenavOpen = true;

	tree: FamilyTree | null = null;
	layout: TreeLayout | null = null;
	selectedPersonId: string | null = null;
	canUndo = false;
	canRedo = false;

	// Panel visibility signals
	readonly activeView = signal<"canvas" | "timeline">("canvas");
	readonly showStats = signal(false);
	readonly showHistory = signal(false);
	readonly showThemePicker = signal(false);

	// Person search / filter signals
	readonly personSearch = signal("");
	readonly activeTagFilters = signal<string[]>([]);
	personSearchValue = "";

	// Comment form state
	newCommentText = "";
	newCommentAuthor = "";

	private subs = new Subscription();

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
				// Sync palette: validate tree theme; fix it if corrupted.
				if (this.tree) {
					if (this.paletteService.isValid(this.tree.theme)) {
						this.paletteService.setPalette(this.tree.theme);
					} else {
						// Replace invalid/missing tree theme with the global palette.
						const globalPalette = this.paletteService.palette();
						void this.storageService.saveTree({ ...this.tree, theme: globalPalette });
					}
				}
				this.cdr.markForCheck();
			}),
		);
		this.subs.add(
			this.treeService.activeLayout$.subscribe((layout) => {
				this.layout = layout;
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
		// Restore the persisted global palette so the dashboard (and any other
		// view) reflects the correct colours after leaving the tree editor.
		this.paletteService.setPalette(this.paletteService.palette());
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
	getEdgeColor(type: RelationType): string {
		return TreeLayoutService.edgeColor(type);
	}
	getRelLabel(type: RelationType): string {
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
				data: { treeId: this.tree!.id, existingTags: this.allTags } satisfies PersonFormData,
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
				data: { person, treeId: this.tree!.id, existingTags: this.allTags } satisfies PersonFormData,
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
		const confirmed = await firstValueFrom(
			this.dialog
				.open(ConfirmDialogComponent, {
					data: {
						message: this.translate.instant("CONFIRM.DELETE_PERSON", {
							name: p.name,
						}),
					},
					width: "380px",
				})
				.afterClosed(),
		);
		if (!confirmed) return;
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
		const confirmed = await firstValueFrom(
			this.dialog
				.open(ConfirmDialogComponent, {
					data: { message: this.translate.instant("CONFIRM.DELETE_RELATION") },
					width: "380px",
				})
				.afterClosed(),
		);
		if (!confirmed) return;
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
	exportPDF(): void {
		this.exportService.downloadPDF(this.tree!, this.canvasRef?.getSVGElement());
	}

	// ── View toggle ──────────────────────────────

	toggleView(): void {
		this.activeView.update((v) => (v === "canvas" ? "timeline" : "canvas"));
	}

	// ── Theme ─────────────────────────────────────

	async applyTheme(theme: TreeTheme): Promise<void> {
		if (!this.tree) return;
		// 1. Persist the new theme to the current tree.
		await this.storageService.saveTree({ ...this.tree, theme });
		// 2. Update the global palette (applies CSS vars to document root
		//    so ALL elements — including Material overlays — receive the change
		//    without a page reload).
		this.paletteService.setPalette(theme);
		// 3. Propagate the new palette to every other tree so each tree's
		//    stored theme stays in sync with the global palette.
		const allTrees = this.storageService.getAllTrees();
		for (const t of allTrees) {
			if (t.id !== this.tree.id) {
				void this.storageService.saveTree({ ...t, theme });
			}
		}
		this.showThemePicker.set(false);
		this.snack.open(this.translate.instant("TREE_EDITOR.SNACK.THEME_APPLIED"), "", { duration: 2000 });
	}

	// ── Filtered persons ──────────────────────────

	get filteredPersons(): Person[] {
		const q = this.personSearch().toLowerCase().trim();
		const filters = this.activeTagFilters();
		const persons = this.tree?.persons ?? [];
		return persons.filter((p) => {
			if (filters.length > 0 && !filters.some((f) => p.tags?.includes(f))) return false;
			if (!q) return true;
			return (
				p.name.toLowerCase().includes(q) ||
				(p.birthDate?.includes(q) ?? false) ||
				(p.notes?.toLowerCase().includes(q) ?? false)
			);
		});
	}

	get allTags(): string[] {
		const tags = new Set<string>();
		for (const p of this.tree?.persons ?? []) {
			for (const t of p.tags ?? []) tags.add(t);
		}
		return [...tags];
	}

	toggleTagFilter(tag: string): void {
		this.activeTagFilters.update((filters) =>
			filters.includes(tag)
				? filters.filter((f) => f !== tag)
				: [...filters, tag],
		);
	}

	// ── History ───────────────────────────────────

	get historySnapshots(): TreeSnapshot[] {
		return [...this.historyService.getHistory(this.tree?.id ?? "")].reverse();
	}

	async restoreSnapshot(index: number): Promise<void> {
		if (!this.tree) return;
		const snaps = [...this.historyService.getHistory(this.tree.id)].reverse();
		const snap = snaps[index];
		if (!snap) return;
		this.historyService.snapshot(this.tree);
		await this.storageService.saveTree({
			...this.tree,
			persons: snap.persons,
			relations: snap.relations,
			nodePositions: snap.nodePositions,
			updatedAt: new Date().toISOString(),
		});
		this.snack.open(this.translate.instant("HISTORY.RESTORE"), "", { duration: 2000 });
	}

	// ── Comments ──────────────────────────────────

	getPersonComments(personId: string): PersonComment[] {
		return (this.tree?.comments ?? []).filter((c) => c.personId === personId);
	}

	async addComment(personId: string): Promise<void> {
		const text = this.newCommentText.trim();
		if (!text || !this.tree) return;
		await this.treeService.addComment(
			this.tree.id,
			personId,
			text,
			this.newCommentAuthor.trim() || "anonymous",
		);
		this.newCommentText = "";
		this.newCommentAuthor = "";
		this.snack.open(this.translate.instant("TREE_EDITOR.SNACK.COMMENT_ADDED"), "", { duration: 2000 });
	}

	async deleteComment(commentId: string): Promise<void> {
		if (!this.tree) return;
		await this.treeService.deleteComment(this.tree.id, commentId);
		this.snack.open(this.translate.instant("TREE_EDITOR.SNACK.COMMENT_DELETED"), "", { duration: 2000 });
	}
}
