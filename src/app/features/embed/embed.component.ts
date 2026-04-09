import {
	ChangeDetectionStrategy,
	ChangeDetectorRef,
	Component,
	OnDestroy,
	OnInit,
	inject,
} from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { Subscription } from "rxjs";
import type { FamilyTree, TreeLayout } from "@core/models";
import { StorageService } from "@core/services/storage.service";
import { TreeLayoutService } from "@core/services/tree-layout.service";
import { TreeCanvasComponent } from "../tree-editor/tree-canvas/tree-canvas.component";

@Component({
	selector: "app-embed",
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TreeCanvasComponent],
	template: `
    @if (tree && layout) {
    <div class="embed-shell">
      <div class="embed-header">
        <span class="embed-name">{{ tree.name }}</span>
      </div>
      <div class="embed-canvas">
        <app-tree-canvas
          [tree]="tree"
          [layout]="layout"
          [selectedPersonId]="null"
          (personClick)="noop()"
          (personDblClick)="noop()"
          (backgroundClick)="noop()">
        </app-tree-canvas>
      </div>
      <div class="embed-footer">
        <a href="https://github.com/Genealogy-OS" target="_blank" rel="noopener noreferrer"
          class="embed-credit">Made with Genealogy OS</a>
      </div>
    </div>
    } @else {
    <div class="embed-error">
      <p>Tree not found. Please provide a valid <code>?id=</code> parameter.</p>
    </div>
    }
  `,
	styles: [`
    :host { display:flex; flex-direction:column; height:100vh; background:#0d0d0d; }
    .embed-shell { display:flex; flex-direction:column; height:100vh; }
    .embed-header {
      padding:8px 16px;
      background:#111;
      border-bottom:1px solid rgba(255,255,255,0.08);
      flex-shrink:0;
    }
    .embed-name {
      font-family:monospace; font-size:14px; color:#f0f0f0;
      letter-spacing:0.06em; text-transform:uppercase;
    }
    .embed-canvas { flex:1; overflow:hidden; }
    .embed-footer {
      padding:6px 16px;
      background:#111;
      border-top:1px solid rgba(255,255,255,0.08);
      flex-shrink:0; text-align:right;
    }
    .embed-credit {
      font-family:monospace; font-size:10px; color:rgba(255,255,255,0.3);
      text-decoration:none; letter-spacing:0.06em;
    }
    .embed-credit:hover { color:rgba(255,255,255,0.6); }
    .embed-error {
      display:flex; align-items:center; justify-content:center; height:100vh;
      color:rgba(255,255,255,0.4); font-family:monospace; font-size:13px;
    }
    code { background:rgba(255,255,255,0.1); padding:2px 4px; border-radius:2px; }
  `],
})
export class EmbedComponent implements OnInit, OnDestroy {
	private route = inject(ActivatedRoute);
	private storage = inject(StorageService);
	private layoutService = inject(TreeLayoutService);
	private cdr = inject(ChangeDetectorRef);

	tree: FamilyTree | null = null;
	layout: TreeLayout | null = null;

	private sub = new Subscription();

	ngOnInit(): void {
		const id = this.route.snapshot.queryParamMap.get("id") ?? "";
		this.sub.add(
			this.storage.trees$.subscribe((trees) => {
				this.tree = trees.find((t) => t.id === id) ?? null;
				this.layout = this.tree
					? this.layoutService.computeLayout(this.tree.persons, this.tree.relations)
					: null;
				this.cdr.markForCheck();
			}),
		);
	}

	ngOnDestroy(): void {
		this.sub.unsubscribe();
	}

	noop(): void {}
}
