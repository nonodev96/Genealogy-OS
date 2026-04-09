import { Component, inject } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import {
	MAT_DIALOG_DATA,
	MatDialogModule,
	MatDialogRef,
} from "@angular/material/dialog";
import { TranslatePipe } from "@ngx-translate/core";

export interface ConfirmDialogData {
	message: string;
}

@Component({
	selector: "app-confirm-dialog",
	imports: [MatDialogModule, MatButtonModule, TranslatePipe],
	template: `
    <mat-dialog-content>
      <p style="padding: 8px 0; font-size: 13px; color: var(--text-secondary);">{{ data.message }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>{{ 'COMMON.CANCEL' | translate }}</button>
      <button mat-flat-button color="warn" (click)="confirm()">{{ 'COMMON.DELETE' | translate }}</button>
    </mat-dialog-actions>
  `,
})
export class ConfirmDialogComponent {
	data = inject<ConfirmDialogData>(MAT_DIALOG_DATA);
	private ref = inject(MatDialogRef<ConfirmDialogComponent>);

	confirm(): void {
		this.ref.close(true);
	}
}
