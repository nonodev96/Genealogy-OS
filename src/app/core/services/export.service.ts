import { Injectable } from '@angular/core';
import { FamilyTree, Relation, Person, RelationType } from '../models';
import { TreeLayoutService, NODE_W, NODE_H } from './tree-layout.service';

@Injectable({ providedIn: 'root' })
export class ExportService {

  constructor(private layoutService: TreeLayoutService) { }

  // ─────────────────────────────────────────────
  //  SVG EXPORT
  // ─────────────────────────────────────────────

  /**
   * Generate a complete SVG string from the tree's layout.
   * The SVG is self-contained and can be opened in any browser or vector editor.
   */
  exportSVG(tree: FamilyTree, svgElement?: SVGSVGElement): string {
    if (svgElement) {
      const PAD = 40;

      // Get content bounds from the live zoom-layer (in layout coordinates, before zoom transform)
      const liveG = svgElement.querySelector('g.zoom-layer') as SVGGElement | null;
      let vx = 0, vy = 0, vw = 800, vh = 600;
      if (liveG) {
        try {
          const bbox = liveG.getBBox();
          if (bbox.width > 0 && bbox.height > 0) {
            vx = bbox.x - PAD;
            vy = bbox.y - PAD;
            vw = bbox.width + PAD * 2;
            vh = bbox.height + PAD * 2;
          }
        } catch {
          console.warn('Failed to get SVG bounds, using default size');
        }
      }

      const clone = svgElement.cloneNode(true) as SVGSVGElement;

      // Remove zoom/pan transform so content is at its layout coordinates
      const g = clone.querySelector('g.zoom-layer') as SVGGElement | null;
      if (g) g.removeAttribute('transform');

      // Set explicit dimensions and viewBox so the SVG is self-contained
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      clone.setAttribute('width', String(vw));
      clone.setAttribute('height', String(vh));
      clone.setAttribute('viewBox', `${vx} ${vy} ${vw} ${vh}`);

      return '<?xml version="1.0" encoding="UTF-8"?>\n' + clone.outerHTML;
    }

    // Fallback: programmatic SVG
    return this.buildSVGFromScratch(tree);
  }

  private buildSVGFromScratch(tree: FamilyTree): string {
    const layout = this.layoutService.computeLayout(tree.persons, tree.relations);
    const PAD = 40;
    const W = layout.width + PAD * 2;
    const H = layout.height + PAD * 2;

    const lines: string[] = [
      `<?xml version="1.0" encoding="UTF-8"?>`,
      `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
      `<style>`,
      `  .node-rect { fill:#fff; stroke:#4f46e5; stroke-width:2; rx:8; }`,
      `  .node-name { font:bold 13px sans-serif; fill:#111; }`,
      `  .node-date { font:11px sans-serif; fill:#555; }`,
      `  .edge      { fill:none; stroke-width:2; marker-end:url(#arrow); }`,
      `  .parent-edge { stroke:#4f46e5; }`,
      `  .partner-edge { stroke:#db2777; stroke-dasharray:6,3; }`,
      `  .sibling-edge { stroke:#059669; }`,
      `</style>`,
      `<defs>`,
      `  <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">`,
      `    <path d="M0,0 L0,6 L8,3 z" fill="#4f46e5"/>`,
      `  </marker>`,
      `</defs>`,
    ];

    // Edges
    layout.edges.forEach(e => {
      const cls = TreeLayoutService.isDashed(e.type)
        ? 'edge partner-edge'
        : e.type === 'partnerOf' ? 'edge partner-edge'
          : e.type === 'siblingOf' ? 'edge sibling-edge'
            : 'edge parent-edge';

      const x1 = e.x1 + PAD, y1 = e.y1 + PAD;
      const x2 = e.x2 + PAD, y2 = e.y2 + PAD;
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;

      lines.push(`<path class="${cls}" d="M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}"/>`);
      lines.push(`<text x="${mx}" y="${my - 4}" font-size="9" fill="#888" text-anchor="middle">${TreeLayoutService.label(e.type)}</text>`);
    });

    // Nodes
    layout.nodes.forEach(n => {
      const x = n.x + PAD, y = n.y + PAD;
      lines.push(
        `<rect class="node-rect" x="${x}" y="${y}" width="${NODE_W}" height="${NODE_H}" rx="8"/>`,
        `<text class="node-name" x="${x + NODE_W / 2}" y="${y + 30}" text-anchor="middle">${this.escXML(n.person.name)}</text>`,
      );
      if (n.person.birthDate) {
        lines.push(`<text class="node-date" x="${x + NODE_W / 2}" y="${y + 48}" text-anchor="middle">🎂 ${n.person.birthDate}</text>`);
      }
    });

    lines.push(`</svg>`);
    return lines.join('\n');
  }

  downloadSVG(tree: FamilyTree, svgEl?: SVGSVGElement): void {
    const content = this.exportSVG(tree, svgEl);
    this.download(`${tree.name}.svg`, content, 'image/svg+xml');
  }

  // ─────────────────────────────────────────────
  //  PLAIN-TEXT EXPORT
  // ─────────────────────────────────────────────

  /**
   * Produces a human-readable indented text representation:
   *
   * Familia: García–Pérez
   * Juan García
   *   - parentOf → Ana García
   *   - partnerOf → Carmen Pérez
   * Ana García
   *   - siblingOf → Luis García
   */
  exportText(tree: FamilyTree): string {
    const personMap = new Map(tree.persons.map(p => [p.id, p]));
    const lines: string[] = [`Familia: ${tree.name}`];
    if (tree.description) lines.push(`Descripción: ${tree.description}`);
    lines.push('');

    tree.persons.forEach(person => {
      lines.push(person.name);
      if (person.birthDate) lines.push(`  Nacimiento: ${person.birthDate}`);
      if (person.deathDate) lines.push(`  Fallecimiento: ${person.deathDate}`);

      const rels = tree.relations.filter(r => r.from === person.id || r.to === person.id);
      rels.forEach(rel => {
        const otherId = rel.from === person.id ? rel.to : rel.from;
        const other = personMap.get(otherId);
        if (!other) return;

        let type: RelationType = rel.type;
        // If person is the "to" end, use inverse label
        if (rel.to === person.id) {
          const inv: Record<string, string> = {
            parentOf: 'childOf', childOf: 'parentOf',
          };
          type = (inv[type] ?? type) as RelationType;
        }
        lines.push(`  - ${type} → ${other.name}`);
      });

      if (person.notes) lines.push(`  Notas: ${person.notes}`);
      lines.push('');
    });

    return lines.join('\n');
  }

  downloadText(tree: FamilyTree): void {
    const content = this.exportText(tree);
    this.download(`${tree.name}.txt`, content, 'text/plain');
  }

  // ─────────────────────────────────────────────
  //  JSON BACKUP
  // ─────────────────────────────────────────────

  downloadJSON(tree: FamilyTree): void {
    const content = JSON.stringify(tree, null, 2);
    this.download(`${tree.name}.json`, content, 'application/json');
  }

  async importJSON(file: File): Promise<FamilyTree | null> {
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const tree = JSON.parse(reader.result as string) as FamilyTree;
          resolve(tree);
        } catch {
          console.error('Failed to parse JSON file');
          resolve(null);
        }
      };
      reader.readAsText(file);
    });
  }

  // ─────────────────────────────────────────────
  //  Helpers
  // ─────────────────────────────────────────────

  private download(filename: string, content: string, mime: string): void {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  private escXML(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}