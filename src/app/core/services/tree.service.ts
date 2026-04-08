import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';
import { FamilyTree, Person, Relation, RelationType, TreePermissions, TreeLayout } from '../models/index';
import { StorageService } from './storage.service';
import { TreeLayoutService } from './tree-layout.service';

@Injectable({ providedIn: 'root' })
export class TreeService {
  private storage = inject(StorageService);
  private layoutService = inject(TreeLayoutService);

  // Currently active tree
  private _activeTreeId$ = new BehaviorSubject<string | null>(null);
  readonly activeTreeId$ = this._activeTreeId$.asObservable();

  // Derived: active tree object
  readonly activeTree$: Observable<FamilyTree | undefined> = combineLatest([
    this._activeTreeId$,
    this.storage.trees$,
  ]).pipe(map(([id, trees]) => trees.find(t => t.id === id)));

  // Derived: layout for active tree
  readonly activeLayout$: Observable<TreeLayout | null> = this.activeTree$.pipe(
    map(tree => tree
      ? this.layoutService.computeLayout(tree.persons, tree.relations)
      : null
    )
  );

  // ── Trees ─────────────────────────────────────

  setActiveTree(id: string | null): void {
    this._activeTreeId$.next(id);
  }

  async createTree(name: string, description?: string): Promise<FamilyTree> {
    const ownerToken = this.generateToken();
    const tree: FamilyTree = {
      id: uuidv4(),
      name,
      description,
      persons:   [],
      relations: [],
      permissions: {
        ownerToken,
        isPublicRead: false,
        editorTokens: [],
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await this.storage.saveTree(tree);
    return tree;
  }

  async duplicateTree(treeId: string): Promise<FamilyTree | null> {
    const source = this.storage.getTree(treeId);
    if (!source) return null;
    const copy: FamilyTree = {
      ...JSON.parse(JSON.stringify(source)),
      id: uuidv4(),
      name: `${source.name} (copia)`,
      permissions: {
        ownerToken: this.generateToken(),
        isPublicRead: false,
        editorTokens: [],
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await this.storage.saveTree(copy);
    return copy;
  }

  async deleteTree(treeId: string): Promise<void> {
    await this.storage.deleteTree(treeId);
    if (this._activeTreeId$.value === treeId) {
      this._activeTreeId$.next(null);
    }
  }

  async updateTreeMeta(treeId: string, name: string, description?: string): Promise<void> {
    const tree = this.storage.getTree(treeId);
    if (!tree) return;
    await this.storage.saveTree({ ...tree, name, description });
  }

  // ── Persons ───────────────────────────────────

  async addPerson(treeId: string, data: Omit<Person, 'id' | 'createdAt' | 'updatedAt'>): Promise<Person> {
    const tree = this.storage.getTree(treeId);
    if (!tree) throw new Error(`Tree ${treeId} not found`);
    const person: Person = {
      ...data,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await this.storage.saveTree({ ...tree, persons: [...tree.persons, person] });
    return person;
  }

  async updatePerson(treeId: string, updated: Person): Promise<void> {
    const tree = this.storage.getTree(treeId);
    if (!tree) return;
    const persons = tree.persons.map(p =>
      p.id === updated.id ? { ...updated, updatedAt: new Date().toISOString() } : p
    );
    await this.storage.saveTree({ ...tree, persons });
  }

  async deletePerson(treeId: string, personId: string): Promise<void> {
    const tree = this.storage.getTree(treeId);
    if (!tree) return;
    await this.storage.saveTree({
      ...tree,
      persons: tree.persons.filter(p => p.id !== personId),
      // Remove all relations involving this person
      relations: tree.relations.filter(r => r.from !== personId && r.to !== personId),
    });
  }

  // ── Relations ─────────────────────────────────

  async addRelation(
    treeId: string,
    from: string,
    to: string,
    type: RelationType,
    meta?: { startDate?: string; endDate?: string; notes?: string }
  ): Promise<Relation> {
    const tree = this.storage.getTree(treeId);
    if (!tree) throw new Error(`Tree ${treeId} not found`);

    // Guard: prevent duplicate relations
    const duplicate = tree.relations.find(r =>
      r.from === from && r.to === to && r.type === type
    );
    if (duplicate) return duplicate;

    const relation: Relation = {
      id: uuidv4(),
      from, to, type,
      ...meta,
    };
    await this.storage.saveTree({ ...tree, relations: [...tree.relations, relation] });
    return relation;
  }

  async updateRelation(treeId: string, updated: Relation): Promise<void> {
    const tree = this.storage.getTree(treeId);
    if (!tree) return;
    const relations = tree.relations.map(r => r.id === updated.id ? updated : r);
    await this.storage.saveTree({ ...tree, relations });
  }

  async deleteRelation(treeId: string, relationId: string): Promise<void> {
    const tree = this.storage.getTree(treeId);
    if (!tree) return;
    await this.storage.saveTree({
      ...tree,
      relations: tree.relations.filter(r => r.id !== relationId),
    });
  }

  // ── Utility ───────────────────────────────────

  getRelationsForPerson(tree: FamilyTree, personId: string): Relation[] {
    return tree.relations.filter(r => r.from === personId || r.to === personId);
  }

  getRelatedPersons(tree: FamilyTree, personId: string): { person: Person; relation: Relation }[] {
    return this.getRelationsForPerson(tree, personId).map(rel => {
      const otherId = rel.from === personId ? rel.to : rel.from;
      const person = tree.persons.find(p => p.id === otherId);
      return person ? { person, relation: rel } : null;
    }).filter(Boolean) as { person: Person; relation: Relation }[];
  }

  private generateToken(): string {
    const arr = new Uint8Array(24);
    crypto.getRandomValues(arr);
    return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
  }
}