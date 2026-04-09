import { Component, ElementRef, ViewChild, inject, signal, type OnInit, ChangeDetectionStrategy } from "@angular/core";
import {
FormBuilder,
type FormGroup,
ReactiveFormsModule,
Validators,
} from "@angular/forms";
import { MatAutocompleteModule, type MatAutocompleteSelectedEvent } from "@angular/material/autocomplete";
import { MatButtonModule } from "@angular/material/button";
import { MatChipsModule, type MatChipInputEvent } from "@angular/material/chips";
import { MatDatepickerModule } from "@angular/material/datepicker";
import {
MAT_DIALOG_DATA,
MatDialogModule,
MatDialogRef,
} from "@angular/material/dialog";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatSelectModule } from "@angular/material/select";
import { MatSnackBar } from "@angular/material/snack-bar";
import { TranslatePipe, TranslateService } from "@ngx-translate/core";
import type { Person } from "@core/models";
import { StorageService } from "@core/services/storage.service";

export interface PersonFormData {
person?: Person;
treeId: string;
existingTags?: string[];
}

@Component({
selector: "app-person-form",
changeDetection: ChangeDetectionStrategy.OnPush,
imports: [
ReactiveFormsModule,
MatDialogModule,
MatFormFieldModule,
MatInputModule,
MatDatepickerModule,
MatButtonModule,
MatSelectModule,
MatIconModule,
MatChipsModule,
MatAutocompleteModule,
TranslatePipe,
],
template: `
    <h2 mat-dialog-title>
      <span class="marker">//</span>
      {{ (isEdit ? 'PERSON.FORM.TITLE_EDIT' : 'PERSON.FORM.TITLE_ADD') | translate }}
    </h2>

    <mat-dialog-content>
      <form [formGroup]="form" class="form-grid">

        <!-- Photo -->
        <div class="photo-area">
          <div class="avatar-zone" (click)="photoInput.click()" [class.has-photo]="!!previewUrl">
            @if (previewUrl) {
            <img [src]="previewUrl" class="avatar-img" alt=""/>
            }
            @if (!previewUrl) {
            <div class="avatar-placeholder">
              <span class="avatar-initial">{{ form.value.name?.charAt(0)?.toUpperCase() || '?' }}</span>
            </div>
            }
            <div class="avatar-overlay">
              <mat-icon>photo_camera</mat-icon>
            </div>
          </div>
          <div class="photo-side">
            <span class="upload-hint">{{ 'PERSON.FORM.UPLOAD' | translate }}</span>
            @if (previewUrl) {
            <div class="photo-actions">
              <button mat-button type="button" (click)="clearPhoto()">
                <mat-icon>close</mat-icon> {{ 'COMMON.REMOVE' | translate }}
              </button>
            </div>
            }
          </div>
          <input #photoInput type="file" accept="image/*" hidden (change)="onPhotoChange($event)"/>
        </div>

        <!-- Name -->
        <mat-form-field appearance="outline" class="full">
          <mat-label>{{ 'PERSON.FORM.NAME' | translate }}</mat-label>
          <input matInput formControlName="name" placeholder="e.g. Juan Garcia Lopez" autocomplete="off"/>
          @if (form.get('name')?.hasError('required')) {
          <mat-error>{{ 'COMMON.REQUIRED' | translate }}</mat-error>
          }
        </mat-form-field>

        <!-- Gender -->
        <mat-form-field appearance="outline" class="half">
          <mat-label>{{ 'PERSON.FORM.GENDER' | translate }}</mat-label>
          <mat-select formControlName="gender">
            <mat-option value="male">{{ 'PERSON.GENDER.MALE' | translate }}</mat-option>
            <mat-option value="female">{{ 'PERSON.GENDER.FEMALE' | translate }}</mat-option>
            <mat-option value="other">{{ 'PERSON.GENDER.OTHER' | translate }}</mat-option>
            <mat-option value="unknown">{{ 'PERSON.GENDER.UNKNOWN' | translate }}</mat-option>
          </mat-select>
        </mat-form-field>

        <!-- Birth date -->
        <mat-form-field appearance="outline" class="half">
          <mat-label>{{ 'PERSON.FORM.BIRTH_DATE' | translate }}</mat-label>
          <input matInput [matDatepicker]="birthPicker" formControlName="birthDate"/>
          <mat-datepicker-toggle matIconSuffix [for]="birthPicker"></mat-datepicker-toggle>
          <mat-datepicker #birthPicker></mat-datepicker>
        </mat-form-field>

        <!-- Death date -->
        <mat-form-field appearance="outline" class="half">
          <mat-label>{{ 'PERSON.FORM.DEATH_DATE' | translate }}</mat-label>
          <input matInput [matDatepicker]="deathPicker" formControlName="deathDate"/>
          <mat-datepicker-toggle matIconSuffix [for]="deathPicker"></mat-datepicker-toggle>
          <mat-datepicker #deathPicker></mat-datepicker>
        </mat-form-field>

        <!-- Tags chip input -->
        <mat-form-field appearance="outline" class="full">
          <mat-label>{{ 'TAGS.LABEL' | translate }}</mat-label>
          <mat-chip-grid #chipGrid [attr.aria-label]="'TAGS.LABEL' | translate">
            @for (tag of tags(); track tag) {
            <mat-chip-row (removed)="removeTag(tag)">
              {{ tag }}
              <button matChipRemove [attr.aria-label]="'TAGS.REMOVE' | translate">
                <mat-icon>cancel</mat-icon>
              </button>
            </mat-chip-row>
            }
            <input
              #tagInput
              [placeholder]="'TAGS.PLACEHOLDER' | translate"
              [matChipInputFor]="chipGrid"
              [matAutocomplete]="tagAuto"
              (matChipInputTokenEnd)="addTagFromInput($event)"
              (input)="onTagInput($event)"/>
          </mat-chip-grid>
          <mat-autocomplete #tagAuto="matAutocomplete" (optionSelected)="addTagFromAuto($event)">
            @for (t of getFilteredSuggestions(); track t) {
            <mat-option [value]="t">{{ t }}</mat-option>
            }
          </mat-autocomplete>
        </mat-form-field>

        <!-- Notes -->
        <mat-form-field appearance="outline" class="full">
          <mat-label>{{ 'PERSON.FORM.BIO_NOTES' | translate }}</mat-label>
          <textarea matInput formControlName="notes" rows="3"
            [placeholder]="'PERSON.FORM.NOTES_PLACEHOLDER' | translate"></textarea>
        </mat-form-field>

      </form>
    </mat-dialog-content>

    <mat-dialog-actions>
      <button mat-button (click)="onCancel()">{{ 'COMMON.CANCEL' | translate }}</button>
      <button mat-flat-button color="primary" (click)="onSave()" [disabled]="form.invalid">
        <mat-icon>{{ isEdit ? 'save' : 'add' }}</mat-icon>
        {{ (isEdit ? 'COMMON.SAVE' : 'PERSON.FORM.TITLE_ADD') | translate }}
      </button>
    </mat-dialog-actions>
  `,
styles: [
`
    .marker { color:var(--red); margin-right:8px; font-family:var(--font-mono); }
    .form-grid { display:flex; flex-wrap:wrap; gap:12px; padding:14px 0; }
    .full  { width:100%; }
    .half  { width:calc(50% - 6px); }
    @media (max-width:480px) { .half { width:100%; } }

    .photo-area { width:100%; display:flex; align-items:center; gap:14px; }
    .avatar-zone {
      width:72px; height:72px; border-radius:var(--radius-md);
      border:1px dashed var(--border-mid);
      background:var(--bg-overlay); cursor:crosshair;
      position:relative; overflow:hidden; flex-shrink:0;
      transition:border-color var(--t);
    }
    .avatar-zone:hover, .avatar-zone.has-photo { border-color:var(--border-bright); }
    .avatar-img { width:100%; height:100%; object-fit:cover; }
    .avatar-placeholder {
      display:flex; align-items:center; justify-content:center; height:100%;
    }
    .avatar-initial { font-family:var(--font-display); font-size:22px; color:var(--text-muted); }
    .photo-side { display:flex; flex-direction:column; gap:6px; }
    .upload-hint {
      font-size:10px; color:var(--text-secondary);
      font-family:var(--font-mono); letter-spacing:0.06em;
      cursor:crosshair;
    }
    .avatar-overlay {
      position:absolute; inset:0;
      background:rgba(0,0,0,0.5);
      display:flex; align-items:center; justify-content:center;
      opacity:0; transition:opacity var(--t);
    }
    .avatar-overlay mat-icon { color:var(--red) !important; }
    .avatar-zone:hover .avatar-overlay { opacity:1; }
    .photo-actions { display:flex; flex-direction:column; gap:4px; }
  `,
],
})
export class PersonFormComponent implements OnInit {
private fb = inject(FormBuilder);
private storage = inject(StorageService);
private dialogRef = inject(MatDialogRef<PersonFormComponent>);
private snack = inject(MatSnackBar);
private translate = inject(TranslateService);
data = inject<PersonFormData>(MAT_DIALOG_DATA);

@ViewChild("tagInput") tagInputRef?: ElementRef<HTMLInputElement>;

form!: FormGroup;
previewUrl: string | null = null;
isEdit = false;

readonly tags = signal<string[]>([]);
readonly tagInputValue = signal<string>("");

ngOnInit(): void {
this.isEdit = !!this.data.person;
const p = this.data.person;
this.form = this.fb.group({
name: [p?.name ?? "", [Validators.required, Validators.minLength(2)]],
gender: [p?.gender ?? "unknown"],
birthDate: [p?.birthDate ? new Date(p.birthDate) : null],
deathDate: [p?.deathDate ? new Date(p.deathDate) : null],
notes: [p?.notes ?? ""],
});
if (p?.photoUrl) this.previewUrl = p.photoUrl;
if (p?.tags) this.tags.set([...p.tags]);
}

getFilteredSuggestions(): string[] {
const query = this.tagInputValue().toLowerCase();
const existing = new Set(this.tags());
const all = this.data.existingTags ?? [];
return all.filter(
(t) => !existing.has(t) && t.toLowerCase().includes(query),
);
}

onTagInput(event: Event): void {
this.tagInputValue.set((event.target as HTMLInputElement).value);
}

addTagFromInput(event: MatChipInputEvent): void {
const value = (event.value ?? "").trim();
if (value) this.addTag(value);
event.chipInput.clear();
this.tagInputValue.set("");
}

addTagFromAuto(event: MatAutocompleteSelectedEvent): void {
this.addTag(event.option.viewValue);
if (this.tagInputRef) this.tagInputRef.nativeElement.value = "";
this.tagInputValue.set("");
}

addTag(tag: string): void {
const t = tag.trim().toLowerCase();
if (t && !this.tags().includes(t)) {
this.tags.update((prev) => [...prev, t]);
}
}

removeTag(tag: string): void {
this.tags.update((prev) => prev.filter((t) => t !== tag));
}

async onPhotoChange(event: Event): Promise<void> {
const file = (event.target as HTMLInputElement).files?.[0];
if (!file) return;
if (file.size > 2 * 1024 * 1024) {
this.snack.open(this.translate.instant("CONFIRM.PHOTO_TOO_LARGE"), "", { duration: 3000 });
return;
}
this.previewUrl = await this.storage.fileToBase64(file);
}

clearPhoto(): void {
this.previewUrl = null;
}

onCancel(): void {
this.dialogRef.close(null);
}

onSave(): void {
if (this.form.invalid) return;
const v = this.form.value;
this.dialogRef.close({
name: v.name.trim(),
gender: v.gender,
birthDate: v.birthDate
? (v.birthDate as Date).toISOString().split("T")[0]
: undefined,
deathDate: v.deathDate
? (v.deathDate as Date).toISOString().split("T")[0]
: undefined,
notes: v.notes || undefined,
photoUrl: this.previewUrl || undefined,
tags: this.tags().length > 0 ? [...this.tags()] : undefined,
});
}
}
