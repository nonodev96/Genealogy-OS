import { CommonModule } from "@angular/common";
import { Component, inject, type OnInit } from "@angular/core";
import {
	FormBuilder,
	type FormGroup,
	ReactiveFormsModule,
	Validators,
} from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
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
import { TranslatePipe } from "@ngx-translate/core";
import type { Person } from "@core/models";
import { StorageService } from "@core/services/storage.service";

export interface PersonFormData {
	person?: Person;
	treeId: string;
}

@Component({
	selector: "app-person-form",
	standalone: true,
	imports: [
		CommonModule,
		ReactiveFormsModule,
		MatDialogModule,
		MatFormFieldModule,
		MatInputModule,
		MatDatepickerModule,
		MatButtonModule,
		MatSelectModule,
		MatIconModule,
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
            <img *ngIf="previewUrl" [src]="previewUrl" class="avatar-img"/>
            <div *ngIf="!previewUrl" class="avatar-placeholder">
              <span class="avatar-initial">{{ form.value.name?.charAt(0)?.toUpperCase() || '?' }}</span>
            </div>
            <div class="avatar-overlay">
              <mat-icon>photo_camera</mat-icon>
            </div>
          </div>
          <div class="photo-side">
            <span class="upload-hint">{{ 'PERSON.FORM.UPLOAD' | translate }}</span>
            <div class="photo-actions" *ngIf="previewUrl">
              <button mat-button type="button" (click)="clearPhoto()">
                <mat-icon>close</mat-icon> {{ 'COMMON.REMOVE' | translate }}
              </button>
            </div>
          </div>
          <input #photoInput type="file" accept="image/*" hidden (change)="onPhotoChange($event)"/>
        </div>

        <!-- Name -->
        <mat-form-field appearance="outline" class="full">
          <mat-label>{{ 'PERSON.FORM.NAME' | translate }}</mat-label>
          <input matInput formControlName="name" placeholder="e.g. Juan García López" autocomplete="off"/>
          <mat-error *ngIf="form.get('name')?.hasError('required')">{{ 'COMMON.REQUIRED' | translate }}</mat-error>
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
	data = inject<PersonFormData>(MAT_DIALOG_DATA);

	form!: FormGroup;
	previewUrl: string | null = null;
	isEdit = false;

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
	}

	async onPhotoChange(event: Event): Promise<void> {
		const file = (event.target as HTMLInputElement).files?.[0];
		if (!file) return;
		if (file.size > 2 * 1024 * 1024) {
			alert("max 2 MB");
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
		});
	}
}
