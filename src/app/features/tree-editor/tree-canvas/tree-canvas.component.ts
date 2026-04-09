import {
    Component, Input, OnInit, OnChanges, OnDestroy, AfterViewInit,
    ViewChild, ElementRef, Output, EventEmitter, SimpleChanges, inject, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import * as d3 from 'd3';
import { FamilyTree, RelationType, PARENT_TYPES, PARTNER_TYPES, SIBLING_TYPES, TreeLayout } from '../../../core/models';
import { TreeLayoutService, NODE_W, NODE_H } from '../../../core/services/tree-layout.service';
import { StorageService } from '../../../core/services/storage.service';
import { TreeService } from '../../../core/services/tree.service';

const GRID_SIZE = 40;
function snapToGrid(v: number): number { return Math.round(v / GRID_SIZE) * GRID_SIZE; }

/* Nothing palette */
const C_RED = '#ff3333';
const C_WHITE = '#f0f0f0';
const C_MUTED = '#666666';
const C_DIM = 'rgba(255,255,255,0.07)';
const C_MID = 'rgba(255,255,255,0.14)';
const C_SURF = '#1c1c1c';
const C_ELEV = '#222222';

function edgeStroke(type: RelationType): string {
    if (PARENT_TYPES.includes(type) || ['childOf', 'descendantOf', 'adoptiveChildOf', 'stepChildOf', 'wardOf'].includes(type)) return C_WHITE;
    if (PARTNER_TYPES.includes(type)) return C_RED;
    if (SIBLING_TYPES.includes(type)) return 'rgba(255,255,255,0.4)';
    return C_MUTED;
}

@Component({
    selector: 'app-tree-canvas',
    standalone: true,
    imports: [CommonModule, MatIconModule, MatTooltipModule, TranslatePipe],
    template: `
    <div class="canvas-wrap" #wrapper>

      <!-- Zoom controls -->
      <div class="zoom-bar">
        <button class="z-btn" (click)="zoomIn()"  [matTooltip]="'CANVAS.ZOOM_IN' | translate">+</button>
        <button class="z-btn" (click)="zoomOut()" [matTooltip]="'CANVAS.ZOOM_OUT' | translate">−</button>
        <div class="z-divider"></div>
        <button class="z-btn" (click)="fitToScreen()" [matTooltip]="'CANVAS.FIT' | translate">⊞</button>
        <button class="z-btn" (click)="resetZoom()"   [matTooltip]="'CANVAS.CENTER' | translate">◎</button>
      </div>

      <!-- Scale readout -->
      <div class="scale-hud">
        <span class="hud-label">{{ 'CANVAS.SCALE' | translate }}</span>
        <span class="hud-val">{{ (currentScale * 100) | number:'1.0-0' }}%</span>
      </div>

      <!-- Node count HUD -->
      <div class="node-hud" *ngIf="layout">
        <span class="hud-label">{{ 'CANVAS.NODES' | translate }}</span>
        <span class="hud-val">{{ layout.nodes.size }}</span>
        <span class="hud-sep">|</span>
        <span class="hud-label">{{ 'CANVAS.EDGES' | translate }}</span>
        <span class="hud-val">{{ layout.edges.length }}</span>
      </div>

      <!-- Link style selector -->
      <div class="link-style-hud">
        <span class="hud-label">{{ 'CANVAS.LINK_STYLE' | translate }}</span>
        <select class="hud-select" [value]="linkStyle()" (change)="onLinkStyleChange($event)">
          <option value="curved">{{ 'CANVAS.LINK_CURVED' | translate }}</option>
          <option value="orthogonal">{{ 'CANVAS.LINK_ORTHOGONAL' | translate }}</option>
        </select>
      </div>

      <!-- SVG -->
      <svg #svgEl class="tree-svg">
        <defs>
          <!-- Grid pattern -->
          <pattern id="dot-grid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="0.5"/>
          </pattern>
          <!-- Arrow markers -->
          <marker id="arr-parent"  markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,1 L5,3 L0,5 L1,3 Z" fill="rgba(240,240,240,0.7)"/>
          </marker>
          <marker id="arr-partner" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,1 L5,3 L0,5 L1,3 Z" fill="rgba(255,51,51,0.8)"/>
          </marker>
          <marker id="arr-sibling" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,1 L5,3 L0,5 L1,3 Z" fill="rgba(255,255,255,0.3)"/>
          </marker>
          <!-- Node glow filter -->
          <filter id="glow-selected" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="glow-red" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        <!-- Background dot grid -->
        <rect width="100%" height="100%" fill="url(#dot-grid)"/>
        <!-- Zoom layer -->
        <g class="zoom-layer" #zoomLayer></g>
      </svg>

      <!-- Empty state -->
      <div class="empty-overlay" *ngIf="!layout || layout.nodes.size === 0">
        <svg class="empty-svg" width="80" height="80" viewBox="0 0 80 80">
          <circle cx="40" cy="16" r="6" stroke="rgba(255,255,255,0.1)" stroke-width="1" fill="none"/>
          <circle cx="18" cy="56" r="6" stroke="rgba(255,255,255,0.1)" stroke-width="1" fill="none"/>
          <circle cx="62" cy="56" r="6" stroke="rgba(255,255,255,0.1)" stroke-width="1" fill="none"/>
          <line x1="40" y1="22" x2="25" y2="50" stroke="rgba(255,255,255,0.07)" stroke-width="1" stroke-dasharray="4,4"/>
          <line x1="40" y1="22" x2="55" y2="50" stroke="rgba(255,255,255,0.07)" stroke-width="1" stroke-dasharray="4,4"/>
          <circle cx="40" cy="16" r="2" fill="rgba(255,51,51,0.5)"/>
        </svg>
        <p class="empty-line">{{ 'CANVAS.EMPTY_TITLE' | translate }}</p>
        <p class="empty-sub">{{ 'CANVAS.EMPTY_SUB' | translate }}</p>
      </div>

    </div>
  `,
    styles: [`
    :host { display:block; height:100%; }

    .canvas-wrap {
      position:relative; width:100%; height:100%;
      background:var(--bg-void);
      overflow:hidden;
    }

    /* Zoom bar */
    .zoom-bar {
      position:absolute; top:16px; right:16px; z-index:10;
      display:flex; flex-direction:column; align-items:center; gap:2px;
      background:var(--bg-surface);
      border:1px solid var(--border-dim);
      border-radius:var(--radius-sm);
      padding:4px;
    }
    .z-btn {
      width:34px; height:34px;
      background:transparent;
      border:none;
      color:var(--text-secondary);
      font-family:var(--font-mono);
      font-size:20px;
      cursor:pointer;
      border-radius:var(--radius-sm);
      transition:all var(--t);
      display:flex; align-items:center; justify-content:center;
      line-height:1;
    }
    .z-btn:hover { background:var(--bg-overlay); color:var(--text-primary); }
    .z-divider { width:20px; height:1px; background:var(--border-dim); margin:2px 0; }

    /* HUDs */
    .scale-hud, .node-hud {
      position:absolute; z-index:10;
      background:var(--bg-surface);
      border:1px solid var(--border-dim);
      border-radius:var(--radius-sm);
      padding:4px 10px;
      display:flex; align-items:center; gap:6px;
    }
    .scale-hud { bottom:16px; right:16px; }
    .node-hud  { bottom:16px; left:16px; }
    .link-style-hud {
      position:absolute; z-index:10; bottom:52px; left:16px;
      background:var(--bg-surface);
      border:1px solid var(--border-dim);
      border-radius:var(--radius-sm);
      padding:4px 10px;
      display:flex; align-items:center; gap:6px;
    }
    .hud-select {
      background:var(--bg-overlay, #2a2a2a);
      color:var(--text-primary);
      border:1px solid var(--border-dim);
      border-radius:var(--radius-sm);
      font-size:12px;
      font-family:var(--font-mono);
      padding:1px 4px;
      cursor:pointer;
    }
    .hud-select:focus { outline:none; border-color:var(--border-mid); }
    .hud-label { font-size:12px; color:var(--text-secondary); letter-spacing:0.1em; text-transform:uppercase; font-family:var(--font-display); }
    .hud-val   { font-size:15px; color:var(--text-primary); font-family:var(--font-mono); font-weight:700; }
    .hud-sep   { color:var(--border-mid); font-size:10px; }

    /* SVG */
    .tree-svg { width:100%; height:100%; cursor:grab; display:block; }
    .tree-svg:active { cursor:grabbing; }

    /* Empty */
    .empty-overlay {
      position:absolute; inset:0;
      display:flex; flex-direction:column; align-items:center; justify-content:center;
      gap:10px; pointer-events:none;
    }
    .empty-svg { opacity:0.6; }
    .empty-line {
      font-family:var(--font-display); font-size:13px;
      letter-spacing:0.12em; color:var(--text-muted); text-transform:uppercase;
    }
    .empty-sub { font-size:10px; color:var(--text-muted); letter-spacing:0.06em; }
  `],
})
export class TreeCanvasComponent implements OnInit, AfterViewInit, OnChanges, OnDestroy {
    @Input() tree!: FamilyTree;
    @Input() layout: TreeLayout | null = null;
    @Input() selectedPersonId: string | null = null;
    @Input() readOnly = false;

    @Output() personClick = new EventEmitter<string>();
    @Output() personDblClick = new EventEmitter<string>();
    @Output() backgroundClick = new EventEmitter<void>();

    @ViewChild('svgEl') svgRef!: ElementRef<SVGSVGElement>;
    @ViewChild('zoomLayer') zoomRef!: ElementRef<SVGGElement>;
    @ViewChild('wrapper') wrapperRef!: ElementRef<HTMLDivElement>;

    currentScale = 1;
    linkStyle = signal<'curved' | 'orthogonal'>('curved');
    private nodePositions = new Map<string, { x: number; y: number }>();
    private currentTreeId: string | null = null;
    private syncedNodePositions: Record<string, { x: number; y: number }> | undefined = undefined;
    private destroy$ = new Subject<void>();

    private storage = inject(StorageService);
    private treeService = inject(TreeService);

    private zoom!: d3.ZoomBehavior<SVGSVGElement, unknown>;
    private svg!: d3.Selection<SVGSVGElement, unknown, null, undefined>;
    private g!: d3.Selection<SVGGElement, unknown, null, undefined>;

    ngOnInit(): void {
        this.storage.nodeMove$.pipe(takeUntil(this.destroy$)).subscribe(ev => {
            if (ev.treeId !== this.tree?.id) return;
            const pos = this.nodePositions.get(ev.nodeId);
            if (!pos) return;
            pos.x = ev.x;
            pos.y = ev.y;
            // Move the node group and update edges without full re-render
            if (this.g) {
                this.g.select<SVGGElement>(`.nodes g[data-nid="${ev.nodeId}"]`)
                    .attr('transform', `translate(${ev.x},${ev.y})`);
                this.updateEdgePaths();
            }
        });
    }

    ngAfterViewInit(): void { this.initD3(); if (this.layout) this.render(); }

    ngOnChanges(c: SimpleChanges): void {
        if (c['layout'] && this.g) {
            if (this.tree?.id !== this.currentTreeId) {
                // Different tree: clear everything so render starts fresh
                this.currentTreeId = this.tree?.id ?? null;
                this.nodePositions.clear();
                this.syncedNodePositions = undefined;
            }
            this.render();
        } else if (c['selectedPersonId'] && this.g) {
            this.render();
        }
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
        if (this.svg) this.svg.on('.zoom', null);
    }

    private initD3(): void {
        this.svg = d3.select<SVGSVGElement, unknown>(this.svgRef.nativeElement);
        this.g = d3.select<SVGGElement, unknown>(this.zoomRef.nativeElement);

        this.zoom = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.08, 3])
            .on('zoom', (ev: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
                this.g.attr('transform', ev.transform.toString());
                this.currentScale = ev.transform.k;
            });

        this.svg
            .call(this.zoom)
            .on('click', (ev: MouseEvent) => {
                if ((ev.target as Element).tagName === 'svg' || (ev.target as Element).tagName === 'rect' && (ev.target as Element).getAttribute('fill') === 'url(#dot-grid)')
                    this.backgroundClick.emit();
            });
    }

    private render(): void {
        if (!this.layout || !this.g) return;
        const savedPos = this.tree?.nodePositions;
        const positionsChanged = savedPos !== this.syncedNodePositions;
        if (positionsChanged) {
            // nodePositions object reference changed: undo/redo/drag-end → re-sync Map
            this.syncedNodePositions = savedPos;
        }
        this.layout.nodes.forEach(node => {
            if (positionsChanged && savedPos?.[node.id]) {
                // Always trust the authoritative saved position when it changed
                this.nodePositions.set(node.id, { ...savedPos[node.id] });
            } else if (!this.nodePositions.has(node.id)) {
                // New node: fall back to layout position
                this.nodePositions.set(node.id, { x: node.x, y: node.y });
            }
            // else: keep current in-memory position (unsaved drag)
        });
        // Remove stale entries for deleted nodes
        this.nodePositions.forEach((_, id) => {
            if (!this.layout!.nodes.has(id)) this.nodePositions.delete(id);
        });
        this.g.selectAll('*').remove();
        this.renderEdges();
        this.renderNodes();
    }

    /* ── Edge path computation ───────────────────── */
    private edgePath(x1: number, y1: number, x2: number, y2: number): string {
        const isV = Math.abs(y2 - y1) > Math.abs(x2 - x1);
        if (this.linkStyle() === 'orthogonal') {
            if (isV) {
                const my = (y1 + y2) / 2;
                return `M${x1},${y1} L${x1},${my} L${x2},${my} L${x2},${y2}`;
            } else {
                const mx = (x1 + x2) / 2;
                return `M${x1},${y1} L${mx},${y1} L${mx},${y2} L${x2},${y2}`;
            }
        } else {
            if (isV) {
                const my = (y1 + y2) / 2;
                return `M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`;
            } else {
                const mx = (x1 + x2) / 2;
                return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
            }
        }
    }

    /* ── Edges ───────────────────────────────────── */
    private renderEdges(): void {
        const eg = this.g.append('g').attr('class', 'edges');

        this.layout!.edges.forEach(e => {
            const fromNode = this.layout!.nodes.get(e.fromId);
            const toNode   = this.layout!.nodes.get(e.toId);
            if (!fromNode || !toNode) return;

            const fromPos = this.nodePositions.get(e.fromId)!;
            const toPos   = this.nodePositions.get(e.toId)!;
            const x1 = fromPos.x + this.nodeW(fromNode.person.name) / 2;
            const y1 = fromPos.y + NODE_H / 2;
            const x2 = toPos.x   + this.nodeW(toNode.person.name) / 2;
            const y2 = toPos.y   + NODE_H / 2;

            const stroke = edgeStroke(e.type);
            const dashed = TreeLayoutService.isDashed(e.type);
            const label = TreeLayoutService.label(e.type);
            const isPartner = PARTNER_TYPES.includes(e.type);
            const marker = isPartner ? 'url(#arr-partner)'
                : SIBLING_TYPES.includes(e.type) ? 'url(#arr-sibling)'
                    : 'url(#arr-parent)';

            const d = this.edgePath(x1, y1, x2, y2);

            eg.append('path')
                .attr('data-eid', e.id)
                .attr('d', d)
                .attr('fill', 'none')
                .attr('stroke', stroke)
                .attr('stroke-width', isPartner ? 1 : 1.2)
                .attr('stroke-opacity', isPartner ? 0.7 : 0.5)
                .attr('stroke-dasharray', dashed ? '5,4' : null)
                .attr('marker-end', marker);

            // Label pill
            const lx = (x1 + x2) / 2;
            const ly = (y1 + y2) / 2;
            const pill = eg.append('g').attr('data-label', e.id).attr('transform', `translate(${lx},${ly})`);
            const tw = label.length * 6.5 + 16;
            pill.append('rect')
                .attr('x', -tw / 2).attr('y', -9).attr('width', tw).attr('height', 16)
                .attr('rx', 2).attr('fill', C_SURF).attr('stroke', C_MID).attr('stroke-width', 0.8);
            pill.append('text')
                .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle').attr('y', -1)
                .attr('font-size', '10').attr('letter-spacing', '0.06em')
                .attr('fill', isPartner ? C_RED : 'rgba(255,255,255,0.75)')
                .attr('font-family', "'Share Tech Mono', monospace")
                .text(label);
        });
    }

    /* ── Nodes ───────────────────────────────────── */
    private renderNodes(): void {
        const ng = this.g.append('g').attr('class', 'nodes');

        this.layout!.nodes.forEach(node => {
            const sel    = node.id === this.selectedPersonId;
            const nw     = this.nodeW(node.person.name);
            const pos    = this.nodePositions.get(node.id)!;
            const nodeId = node.id;

            const grp = ng.append('g')
                .attr('transform', `translate(${pos.x},${pos.y})`)
                .attr('data-nid', nodeId)
                .attr('cursor', this.readOnly ? 'default' : 'grab')
                .on('click', (ev: MouseEvent) => { ev.stopPropagation(); this.personClick.emit(nodeId); })
                .on('dblclick', (ev: MouseEvent) => { ev.stopPropagation(); this.personDblClick.emit(nodeId); });

            /* Drag behaviour */
            if (!this.readOnly) {
                grp.call(
                    d3.drag<SVGGElement, unknown>()
                        .on('start', (ev) => {
                            ev.sourceEvent.stopPropagation();
                            grp.raise().attr('cursor', 'grabbing');
                        })
                        .on('drag', (ev) => {
                            const p = this.nodePositions.get(nodeId)!;
                            p.x += ev.dx;
                            p.y += ev.dy;
                            if (ev.sourceEvent.ctrlKey) {
                                p.x = snapToGrid(p.x);
                                p.y = snapToGrid(p.y);
                            }
                            grp.attr('transform', `translate(${p.x},${p.y})`);
                            this.updateEdgePaths();
                            this.storage.broadcastNodeMove(this.tree.id, nodeId, p.x, p.y);
                        })
                        .on('end', () => {
                            grp.attr('cursor', 'grab');
                            this.treeService.saveNodePositions(
                                this.tree.id,
                                Object.fromEntries(this.nodePositions)
                            );
                        })
                );
            }

            /* Selection outer glow */
            if (sel) {
                grp.append('rect')
                    .attr('x', -3).attr('y', -3)
                    .attr('width', nw + 6).attr('height', NODE_H + 6)
                    .attr('rx', 6).attr('fill', 'none')
                    .attr('stroke', C_RED).attr('stroke-width', 1)
                    .attr('stroke-opacity', 0.6)
                    .attr('filter', 'url(#glow-red)');
            }

            /* Card */
            grp.append('rect')
                .attr('width', nw).attr('height', NODE_H).attr('rx', 3)
                .attr('fill', sel ? 'rgba(255,51,51,0.06)' : C_SURF)
                .attr('stroke', sel ? C_RED : C_DIM)
                .attr('stroke-width', sel ? 1 : 0.8);

            /* Subtle top highlight */
            grp.append('line')
                .attr('x1', 6).attr('y1', 0.5).attr('x2', nw - 6).attr('y2', 0.5)
                .attr('stroke', 'rgba(255,255,255,0.06)').attr('stroke-width', 1);

            /* Corner ID marker */
            grp.append('text')
                .attr('x', 8).attr('y', 11)
                .attr('font-size', '7').attr('fill', C_MUTED)
                .attr('font-family', "'Orbitron', monospace")
                .attr('letter-spacing', '0.08em')
                .text(node.id.slice(0, 6));

            /* Avatar area */
            const ax = 10, ay = 18, ar = 18;
            if (node.person.photoUrl) {
                /* clipPath lives inside the group → local coordinate space,
                   so it stays correct after zoom/pan/drag */
                const cid = `clip-${node.id}`;
                grp.append('clipPath').attr('id', cid)
                    .append('circle').attr('cx', ax + ar).attr('cy', ay + ar).attr('r', ar);
                grp.append('image')
                    .attr('href', node.person.photoUrl)
                    .attr('x', ax).attr('y', ay)
                    .attr('width', ar * 2).attr('height', ar * 2)
                    .attr('clip-path', `url(#${cid})`);
            } else {
                const genderOpacity = node.person.gender === 'female' ? 0.15 : node.person.gender === 'male' ? 0.12 : 0.08;
                grp.append('circle')
                    .attr('cx', ax + ar).attr('cy', ay + ar).attr('r', ar)
                    .attr('fill', `rgba(255,255,255,${genderOpacity})`)
                    .attr('stroke', C_DIM).attr('stroke-width', 0.8);
                grp.append('text')
                    .attr('x', ax + ar).attr('y', ay + ar + 1)
                    .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
                    .attr('font-size', '18').attr('fill', 'rgba(255,255,255,0.55)')
                    .attr('font-family', "'Orbitron', monospace")
                    .text(node.person.name.charAt(0).toUpperCase());
            }

            /* Name — full text, card width adapts */
            const tx = ax + ar * 2 + 10;
            grp.append('text')
                .attr('x', tx).attr('y', ay + ar - 4)
                .attr('font-size', '11').attr('font-family', "'Orbitron', monospace")
                .attr('font-weight', '700').attr('letter-spacing', '0.05em')
                .attr('fill', sel ? C_RED : C_WHITE)
                .text(node.person.name);

            /* Birth */
            if (node.person.birthDate) {
                grp.append('text')
                    .attr('x', tx).attr('y', ay + ar + 10)
                    .attr('font-size', '9').attr('fill', C_MUTED)
                    .attr('font-family', "'Share Tech Mono', monospace")
                    .attr('letter-spacing', '0.04em')
                    .text('b.' + node.person.birthDate.slice(0, 4));
            }

            /* Death */
            if (node.person.deathDate) {
                grp.append('text')
                    .attr('x', tx).attr('y', node.person.birthDate ? ay + ar + 22 : ay + ar + 10)
                    .attr('font-size', '9').attr('fill', C_MUTED)
                    .attr('font-family', "'Share Tech Mono', monospace")
                    .text('d.' + node.person.deathDate.slice(0, 4));
            }

            /* Notes indicator */
            if (node.person.notes) {
                grp.append('circle').attr('cx', nw - 8).attr('cy', 8).attr('r', 3)
                    .attr('fill', C_RED)
                    .attr('filter', 'url(#glow-red)');
            }

            /* Bottom separator line */
            grp.append('line')
                .attr('x1', 0).attr('y1', NODE_H - 1)
                .attr('x2', nw).attr('y2', NODE_H - 1)
                .attr('stroke', sel ? 'rgba(255,51,51,0.3)' : C_DIM)
                .attr('stroke-width', 0.8);
        });
    }

    /* ── Adaptive node width ─────────────────────── */
    private nodeW(name: string): number {
        return Math.max(140, name.length * 7 + 80);
    }

    /* ── Update edge paths after node drag ───────── */
    private updateEdgePaths(): void {
        if (!this.layout || !this.g) return;
        const eg = this.g.select<SVGGElement>('.edges');
        this.layout.edges.forEach(e => {
            const fromNode = this.layout!.nodes.get(e.fromId);
            const toNode   = this.layout!.nodes.get(e.toId);
            if (!fromNode || !toNode) return;
            const fromPos = this.nodePositions.get(e.fromId);
            const toPos   = this.nodePositions.get(e.toId);
            if (!fromPos || !toPos) return;

            const x1 = fromPos.x + this.nodeW(fromNode.person.name) / 2;
            const y1 = fromPos.y + NODE_H / 2;
            const x2 = toPos.x   + this.nodeW(toNode.person.name) / 2;
            const y2 = toPos.y   + NODE_H / 2;

            const d = this.edgePath(x1, y1, x2, y2);

            eg.select(`[data-eid="${e.id}"]`).attr('d', d);
            eg.select(`[data-label="${e.id}"]`)
                .attr('transform', `translate(${(x1 + x2) / 2},${(y1 + y2) / 2})`);
        });
    }

    onLinkStyleChange(ev: Event): void {
        const val = (ev.target as HTMLSelectElement).value as 'curved' | 'orthogonal';
        this.linkStyle.set(val);
        this.updateEdgePaths();
    }

    zoomIn(): void { this.svg.transition().duration(200).call(this.zoom.scaleBy, 1.35); }
    zoomOut(): void { this.svg.transition().duration(200).call(this.zoom.scaleBy, 0.74); }

    resetZoom(): void {
        this.svg.transition().duration(300).call(
            this.zoom.transform, d3.zoomIdentity.translate(60, 60)
        );
    }

    fitToScreen(): void {
        if (!this.layout || !this.wrapperRef) return;
        const { width: w, height: h } = this.wrapperRef.nativeElement.getBoundingClientRect();
        const scale = Math.min((w - 120) / (this.layout.width || 1), (h - 120) / (this.layout.height || 1), 1);
        const tx = (w - this.layout.width * scale) / 2;
        const ty = (h - this.layout.height * scale) / 2;
        this.svg.transition().duration(400).call(
            this.zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale)
        );
    }

    getSVGElement(): SVGSVGElement { return this.svgRef.nativeElement; }

    private trunc(s: string, n: number): string {
        return s.length > n ? s.slice(0, n) + '…' : s;
    }
}