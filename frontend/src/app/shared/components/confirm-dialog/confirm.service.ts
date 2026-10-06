import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { type Observable, map } from 'rxjs';
import { ConfirmDialogComponent, type ConfirmDialogData } from './confirm-dialog.component';

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly dialog = inject(MatDialog);

  /** Emits true when the user confirms; false on cancel, Escape or a click outside. */
  confirm(data: ConfirmDialogData): Observable<boolean> {
    return this.dialog
      .open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
        data,
        width: '440px',
        autoFocus: false,
      })
      .afterClosed()
      .pipe(map((result) => result === true));
  }
}
