import { Pipe, type PipeTransform } from '@angular/core';

/** {{ firstName | fullName: lastName }} */
@Pipe({ name: 'fullName' })
export class FullNamePipe implements PipeTransform {
  transform(first: string | null | undefined, last: string | null | undefined): string {
    return [first, last]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(' ');
  }
}
