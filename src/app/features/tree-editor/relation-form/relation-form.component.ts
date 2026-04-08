import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import { Person, Relation, RelationType } from '../../../core/models';
import { TreeLayoutService } from '../../../core/services/tree-layout.service';

export interface RelationFormData {
  relation?: Relation;
  persons: Person[];
  preselectedFrom?: string;
}

interface RelOption { value: RelationType; label: string; group: string; }

const OPTIONS: RelOption[] = [
  { value: 'parentOf', label: 'parentOf', group: 'filiation' },
  { value: 'childOf', label: 'childOf', group: 'filiation' },
  { value: 'adoptiveParentOf', label: 'adoptiveParentOf', group: 'filiation' },
  { value: 'adoptiveChildOf', label: 'adoptiveChildOf', group: 'filiation' },
  { value: 'stepParentOf', label: 'stepParentOf', group: 'filiation' },
  { value: 'stepChildOf', label: 'stepChildOf', group: 'filiation' },
  { value: 'guardianOf', label: 'guardianOf', group: 'filiation' },
  { value: 'wardOf', label: 'wardOf', group: 'filiation' },
  { value: 'partnerOf', label: 'partnerOf', group: 'partner' },
  { value: 'siblingOf', label: 'siblingOf', group: 'sibling' },
  { value: 'halfSiblingOf', label: 'halfSiblingOf', group: 'sibling' },
  { value: 'ancestorOf', label: 'ancestorOf', group: 'lineage' },
  { value: 'descendantOf', label: 'descendantOf', group: 'lineage' },
];

@Component({
  selector: 'app-relation-form',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, MatDialogModule,
    MatFormFieldModule, MatInputModule, MatDatepickerModule, MatButtonModule,
    MatSelectModule, MatIconModule, TranslatePipe,
  ],
  template: `
    <h2 mat-dialog-title>
      <span class="marker">//</span>
      {{ (isEdit ? 'RELATION.FORM.TITLE_EDIT' : 'RELATION.FORM.TITLE_ADD') | translate }}
    </h2>

    <mat-dialog-content>
      <form [formGroup]="form" class="form-grid">

        <!-- FROM -->
        <mat-form-field appearance="outline" class="full">
          <mat-label>{{ 'RELATION.FORM.FROM' | translate }}</mat-label>
          <mat-select formControlName="from">
            <mat-option *ngFor="let p of data.persons" [value]="p.id">{{ p.name }}</mat-option>
          </mat-select>
        </mat-form-field>

        <!-- TYPE -->
        <mat-form-field appearance="outline" class="full">
          <mat-label>{{ 'RELATION.FORM.TYPE' | translate }}</mat-label>
          <mat-select formControlName="type">
            <mat-optgroup *ngFor="let g of groups" [label]="('RELATION.GROUP.' + g.name.toUpperCase()) | translate">
              <mat-option *ngFor="let o of g.options" [value]="o.value">{{ ('RELATION.TYPE.' + o.value.toUpperCase()) | translate }}</mat-option>
            </mat-optgroup>
          </mat-select>
        </mat-form-field>

        <!-- TO -->
        <mat-form-field appearance="outline" class="full">
          <mat-label>{{ 'RELATION.FORM.TO' | translate }}</mat-label>
          <mat-select formControlName="to">
            <mat-option *ngFor="let p of targets" [value]="p.id">{{ p.name }}</mat-option>
          </mat-select>
        </mat-form-field>

        <!-- Edge preview terminal -->
        <div class="edge-preview" *ngIf="form.value.from && form.value.type && form.value.to">
          <span class="ep-node">{{ getName(form.value.from) }}</span>
          <span class="ep-arrow">──<span [style.color]="previewColor">{{ form.value.type }}</span>──▶</span>
          <span class="ep-node">{{ getName(form.value.to) }}</span>
        </div>

        <!-- Metadata -->
        <mat-form-field appearance="outline" class="half">
          <mat-label>{{ 'RELATION.FORM.START_DATE' | translate }}</mat-label>
          <input matInput [matDatepicker]="startPicker" formControlName="startDate"/>
          <mat-datepicker-toggle matIconSuffix [for]="startPicker"></mat-datepicker-toggle>
          <mat-datepicker #startPicker></mat-datepicker>
        </mat-form-field>
        <mat-form-field appearance="outline" class="half">
          <mat-label>{{ 'RELATION.FORM.END_DATE' | translate }}</mat-label>
          <input matInput [matDatepicker]="endPicker" formControlName="endDate"/>
          <mat-datepicker-toggle matIconSuffix [for]="endPicker"></mat-datepicker-toggle>
          <mat-datepicker #endPicker></mat-datepicker>
        </mat-form-field>
        <mat-form-field appearance="outline" class="full">
          <mat-label>{{ 'COMMON.NOTES' | translate }}</mat-label>
          <input matInput formControlName="notes" [placeholder]="'RELATION.FORM.NOTES_PLACEHOLDER' | translate"/>
        </mat-form-field>

      </form>
    </mat-dialog-content>

    <mat-dialog-actions>
      <button mat-button (click)="onCancel()">{{ 'COMMON.CANCEL' | translate }}</button>
      <button mat-flat-button color="primary" (click)="onSave()" [disabled]="form.invalid">
        <mat-icon>{{ isEdit ? 'save' : 'add_link' }}</mat-icon>
        {{ (isEdit ? 'COMMON.SAVE' : 'RELATION.FORM.TITLE_ADD') | translate }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .marker { color:var(--red); margin-right:8px; }
    .form-grid { display:flex; flex-wrap:wrap; gap:12px; padding:14px 0; }
    .full { width:100%; }
    .half { width:calc(50% - 6px); }
    @media (max-width:480px) { .half { width:100%; } }

    .edge-preview {
      width:100%; display:flex; align-items:center; gap:8px; flex-wrap:wrap;
      padding:10px 12px;
      background:var(--bg-void); border:1px solid var(--border-dim);
      border-radius:var(--radius-sm); font-family:var(--font-mono); font-size:11px;
    }
    .ep-node { color:var(--text-primary); font-family:var(--font-display); font-size:10px; letter-spacing:0.06em; }
    .ep-arrow { color:var(--text-muted); white-space:nowrap; }
    .ep-arrow span { font-style:italic; }
  `],
})
export class RelationFormComponent implements OnInit {
  form!: FormGroup;
  isEdit = false;
  groups: { name: string; options: RelOption[] }[] = [];

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<RelationFormComponent>,
    @Inject(MAT_DIALOG_DATA) public data: RelationFormData,
  ) { }

  ngOnInit(): void {
    this.isEdit = !!this.data.relation;
    const r = this.data.relation;
    this.form = this.fb.group({
      from: [r?.from ?? this.data.preselectedFrom ?? '', Validators.required],
      type: [r?.type ?? '', Validators.required],
      to: [r?.to ?? '', Validators.required],
      startDate: [r?.startDate ? new Date(r.startDate) : null],
      endDate: [r?.endDate ? new Date(r.endDate) : null],
      notes: [r?.notes ?? ''],
    });
    const grpNames = [...new Set(OPTIONS.map(o => o.group))];
    this.groups = grpNames.map(n => ({ name: n, options: OPTIONS.filter(o => o.group === n) }));
  }

  get targets(): Person[] { return this.data.persons.filter(p => p.id !== this.form.value.from); }
  get previewColor(): string { return TreeLayoutService.edgeColor(this.form.value.type); }
  getName(id: string): string { return this.data.persons.find(p => p.id === id)?.name ?? id; }
  onCancel(): void { this.dialogRef.close(null); }

  onSave(): void {
    if (this.form.invalid) return;
    const v = this.form.value;
    this.dialogRef.close({
      from: v.from, to: v.to, type: v.type,
      startDate: v.startDate ? (v.startDate as Date).toISOString().split('T')[0] : undefined,
      endDate: v.endDate ? (v.endDate as Date).toISOString().split('T')[0] : undefined,
      notes: v.notes || undefined,
    });
  }
}