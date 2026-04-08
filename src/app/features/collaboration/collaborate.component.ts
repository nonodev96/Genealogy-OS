import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { filter, take } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';
import { CollaborationService } from '../../core/services/collaboration.service';
import { StorageService } from '../../core/services/storage.service';
import { CollaborationSession } from '../../core/models';

@Component({
  selector: 'app-collaborate',
  standalone: true,
  imports: [CommonModule, RouterModule, MatButtonModule, MatIconModule, TranslatePipe],
  template: `
    <div class="collab-page dot-grid">

      <!-- Corner logo -->
      <div class="corner-logo">
        <span class="logo-mark">⬡</span>
        <span class="logo-txt">genealogy.os</span>
      </div>

      <!-- Terminal card -->
      <div class="terminal-card">

        <!-- Title bar -->
        <div class="term-bar">
          <div class="term-dots">
            <span class="tdot"></span><span class="tdot"></span><span class="tdot"></span>
          </div>
          <span class="term-title">collaborate.sh</span>
        </div>

        <!-- Body -->
        <div class="term-body">

          <!-- Loading -->
          <ng-container *ngIf="state === 'loading'">
            <div class="term-line"><span class="prompt">$</span> {{ 'COLLABORATE.LOADING' | translate }}</div>
            <div class="term-line blink">█</div>
          </ng-container>

          <!-- Invalid -->
          <ng-container *ngIf="state === 'invalid'">
            <div class="term-line err"><span class="prompt err-p">✗</span> {{ 'COLLABORATE.INVALID.ERROR' | translate }}</div>
            <div class="term-line muted">{{ 'COLLABORATE.INVALID.HINT1' | translate }}</div>
            <div class="term-line muted">{{ 'COLLABORATE.INVALID.HINT2' | translate }}</div>
          </ng-container>

          <!-- Valid -->
          <ng-container *ngIf="state === 'valid' && session">
            <div class="term-line ok"><span class="prompt ok-p">✓</span> {{ 'COLLABORATE.VALID.VERIFIED' | translate }}</div>
            <div class="term-line muted">→ tree_id: {{ session.treeId.slice(0,12) }}…</div>
            <div class="term-line muted">→ role:    <span class="role-tag" [class]="session.role">{{ session.role }}</span></div>
            <div class="term-line muted">→ name:    {{ treeName }}</div>
            <div class="term-line ok">&nbsp;</div>
            <div class="term-line ok">{{ 'COLLABORATE.VALID.ACCESS' | translate }}</div>
          </ng-container>

        </div>

        <!-- Actions -->
        <div class="term-actions">
          <button class="t-btn secondary" routerLink="/dashboard">
            {{ 'COLLABORATE.DASHBOARD_BTN' | translate }}
          </button>
          <button class="t-btn primary" *ngIf="state === 'valid'" (click)="openTree()">
            {{ 'COLLABORATE.VALID.OPEN' | translate }}
          </button>
        </div>
      </div>

      <!-- Decorative grid lines -->
      <div class="deco-h"></div>
      <div class="deco-v"></div>
    </div>
  `,
  styles: [`
    .collab-page {
      min-height:100vh; display:flex; align-items:center; justify-content:center;
      position:relative; overflow:hidden;
    }

    /* Corner logo */
    .corner-logo {
      position:absolute; top:20px; left:24px;
      display:flex; align-items:center; gap:8px;
    }
    .logo-mark { font-size:18px; color:var(--red); filter:drop-shadow(0 0 6px var(--red)); }
    .logo-txt { font-family:var(--font-display); font-size:11px; letter-spacing:0.14em; color:var(--text-muted); text-transform:uppercase; }

    /* Decorative lines */
    .deco-h, .deco-v { position:absolute; pointer-events:none; }
    .deco-h { top:50%; left:0; right:0; height:1px; background:var(--border-dim); }
    .deco-v { left:50%; top:0; bottom:0; width:1px; background:var(--border-dim); }

    /* Terminal card */
    .terminal-card {
      width:460px; background:var(--bg-surface);
      border:1px solid var(--border-mid);
      border-radius:var(--radius-md);
      overflow:hidden;
      box-shadow:0 0 40px rgba(0,0,0,0.8), 0 0 80px rgba(255,51,51,0.04);
      position:relative; z-index:2;
    }

    /* Title bar */
    .term-bar {
      display:flex; align-items:center; gap:10px;
      padding:10px 14px;
      background:var(--bg-elevated);
      border-bottom:1px solid var(--border-dim);
    }
    .term-dots { display:flex; gap:5px; }
    .tdot { width:8px; height:8px; border-radius:50%; background:var(--border-mid); }
    .tdot:first-child { background:var(--red); box-shadow:0 0 4px var(--red); }
    .term-title { font-family:var(--font-mono); font-size:11px; color:var(--text-muted); letter-spacing:0.06em; margin-left:auto; }

    /* Terminal body */
    .term-body { padding:20px; display:flex; flex-direction:column; gap:6px; min-height:140px; }
    .term-line { font-family:var(--font-mono); font-size:12px; color:var(--text-secondary); letter-spacing:0.04em; display:flex; align-items:center; gap:10px; }
    .term-line.muted { color:var(--text-muted); padding-left:20px; }
    .term-line.ok    { color:rgba(255,255,255,0.7); }
    .term-line.err   { color:var(--red); }
    .term-line.blink::after { content:''; display:inline-block; width:8px; height:13px; background:var(--red); animation:blink 1s step-end infinite; }
    @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }

    .prompt    { color:var(--text-muted); font-family:var(--font-mono); }
    .ok-p      { color:#4ade80; }
    .err-p     { color:var(--red); }
    .role-tag  { border:1px solid var(--border-dim); padding:0 6px; border-radius:2px; font-size:10px; }
    .role-tag.owner  { color:var(--red); border-color:rgba(255,51,51,0.4); }
    .role-tag.editor { color:rgba(255,255,255,0.6); border-color:var(--border-mid); }
    .role-tag.viewer { color:var(--text-muted); }

    /* Actions */
    .term-actions {
      display:flex; justify-content:flex-end; gap:8px;
      padding:12px 16px;
      border-top:1px solid var(--border-dim);
      background:var(--bg-elevated);
    }
    .t-btn {
      padding:6px 14px; border-radius:var(--radius-sm);
      font-family:var(--font-display); font-size:9px; letter-spacing:0.12em;
      text-transform:uppercase; cursor:crosshair;
      transition:all var(--t);
    }
    .t-btn.secondary { background:transparent; border:1px solid var(--border-dim); color:var(--text-muted); }
    .t-btn.secondary:hover { border-color:var(--border-mid); color:var(--text-primary); }
    .t-btn.primary { background:transparent; border:1px solid var(--border-accent); color:var(--red); }
    .t-btn.primary:hover { background:var(--red-dim); box-shadow:var(--red-glow); }
  `],
})
export class CollaborateComponent implements OnInit {
  state: 'loading' | 'valid' | 'invalid' = 'loading';
  session: CollaborationSession | null = null;
  treeName = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private collab: CollaborationService,
    private storage: StorageService,
  ) {}

  ngOnInit(): void {
    this.storage.ready$.pipe(filter(Boolean), take(1)).subscribe(() => {
      const treeId = this.route.snapshot.queryParamMap.get('tree') ?? '';
      const token  = this.route.snapshot.queryParamMap.get('token') ?? '';
      if (!treeId || !token) { this.state = 'invalid'; return; }
      this.session = this.collab.resolveToken(treeId, token);
      if (!this.session) { this.state = 'invalid'; return; }
      const tree = this.storage.getTree(treeId);
      if (!tree) { this.state = 'invalid'; return; }
      this.treeName = tree.name;
      this.collab.saveSession(this.session);
      this.state = 'valid';
    });
  }

  openTree(): void {
    if (this.session) this.router.navigate(['/tree', this.session.treeId]);
  }
}