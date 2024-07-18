/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { BehaviorSubject } from 'rxjs';
import { inject } from './di/injector_compatibility';
import { ɵɵdefineInjectable } from './di/interface/defs';
/**
 * Internal implementation of the pending tasks service.
 */
export class PendingTasks {
    constructor() {
        this.taskId = 0;
        this.pendingTasks = new Set();
        this.hasPendingTasks = new BehaviorSubject(false);
    }
    get _hasPendingTasks() {
        return this.hasPendingTasks.value;
    }
    add() {
        if (!this._hasPendingTasks) {
            this.hasPendingTasks.next(true);
        }
        const taskId = this.taskId++;
        this.pendingTasks.add(taskId);
        return taskId;
    }
    remove(taskId) {
        this.pendingTasks.delete(taskId);
        if (this.pendingTasks.size === 0 && this._hasPendingTasks) {
            this.hasPendingTasks.next(false);
        }
    }
    ngOnDestroy() {
        this.pendingTasks.clear();
        if (this._hasPendingTasks) {
            this.hasPendingTasks.next(false);
        }
    }
    /** @nocollapse */
    static { this.ɵprov = ɵɵdefineInjectable({
        token: PendingTasks,
        providedIn: 'root',
        factory: () => new PendingTasks(),
    }); }
}
/**
 * Experimental service that keeps track of pending tasks contributing to the stableness of Angular
 * application. While several existing Angular services (ex.: `HttpClient`) will internally manage
 * tasks influencing stability, this API gives control over stability to library and application
 * developers for specific cases not covered by Angular internals.
 *
 * The concept of stability comes into play in several important scenarios:
 * - SSR process needs to wait for the application stability before serializing and sending rendered
 * HTML;
 * - tests might want to delay assertions until the application becomes stable;
 *
 * @usageNotes
 * ```typescript
 * const pendingTasks = inject(ExperimentalPendingTasks);
 * const taskCleanup = pendingTasks.add();
 * // do work that should block application's stability and then:
 * taskCleanup();
 * ```
 *
 * This API is experimental. Neither the shape, nor the underlying behavior is stable and can change
 * in patch versions. We will iterate on the exact API based on the feedback and our understanding
 * of the problem and solution space.
 *
 * @publicApi
 * @experimental
 */
export class ExperimentalPendingTasks {
    constructor() {
        this.internalPendingTasks = inject(PendingTasks);
    }
    /**
     * Adds a new task that should block application's stability.
     * @returns A cleanup function that removes a task when called.
     */
    add() {
        const taskId = this.internalPendingTasks.add();
        return () => this.internalPendingTasks.remove(taskId);
    }
    /** @nocollapse */
    static { this.ɵprov = ɵɵdefineInjectable({
        token: ExperimentalPendingTasks,
        providedIn: 'root',
        factory: () => new ExperimentalPendingTasks(),
    }); }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGVuZGluZ190YXNrcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvcmUvc3JjL3BlbmRpbmdfdGFza3MudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUFDLGVBQWUsRUFBQyxNQUFNLE1BQU0sQ0FBQztBQUVyQyxPQUFPLEVBQUMsTUFBTSxFQUFDLE1BQU0sNkJBQTZCLENBQUM7QUFDbkQsT0FBTyxFQUFDLGtCQUFrQixFQUFDLE1BQU0scUJBQXFCLENBQUM7QUFHdkQ7O0dBRUc7QUFDSCxNQUFNLE9BQU8sWUFBWTtJQUF6QjtRQUNVLFdBQU0sR0FBRyxDQUFDLENBQUM7UUFDWCxpQkFBWSxHQUFHLElBQUksR0FBRyxFQUFVLENBQUM7UUFJekMsb0JBQWUsR0FBRyxJQUFJLGVBQWUsQ0FBVSxLQUFLLENBQUMsQ0FBQztJQStCeEQsQ0FBQztJQWxDQyxJQUFZLGdCQUFnQjtRQUMxQixPQUFPLElBQUksQ0FBQyxlQUFlLENBQUMsS0FBSyxDQUFDO0lBQ3BDLENBQUM7SUFHRCxHQUFHO1FBQ0QsSUFBSSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO1lBQzNCLElBQUksQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ2xDLENBQUM7UUFDRCxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7UUFDN0IsSUFBSSxDQUFDLFlBQVksQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDOUIsT0FBTyxNQUFNLENBQUM7SUFDaEIsQ0FBQztJQUVELE1BQU0sQ0FBQyxNQUFjO1FBQ25CLElBQUksQ0FBQyxZQUFZLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ2pDLElBQUksSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLEtBQUssQ0FBQyxJQUFJLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO1lBQzFELElBQUksQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ25DLENBQUM7SUFDSCxDQUFDO0lBRUQsV0FBVztRQUNULElBQUksQ0FBQyxZQUFZLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDMUIsSUFBSSxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztZQUMxQixJQUFJLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUNuQyxDQUFDO0lBQ0gsQ0FBQztJQUVELGtCQUFrQjthQUNYLFVBQUssR0FBNkIsa0JBQWtCLENBQUM7UUFDMUQsS0FBSyxFQUFFLFlBQVk7UUFDbkIsVUFBVSxFQUFFLE1BQU07UUFDbEIsT0FBTyxFQUFFLEdBQUcsRUFBRSxDQUFDLElBQUksWUFBWSxFQUFFO0tBQ2xDLENBQUMsQUFKVSxDQUlUOztBQUdMOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBeUJHO0FBQ0gsTUFBTSxPQUFPLHdCQUF3QjtJQUFyQztRQUNVLHlCQUFvQixHQUFHLE1BQU0sQ0FBQyxZQUFZLENBQUMsQ0FBQztJQWdCdEQsQ0FBQztJQWZDOzs7T0FHRztJQUNILEdBQUc7UUFDRCxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsb0JBQW9CLENBQUMsR0FBRyxFQUFFLENBQUM7UUFDL0MsT0FBTyxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsb0JBQW9CLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQ3hELENBQUM7SUFFRCxrQkFBa0I7YUFDWCxVQUFLLEdBQTZCLGtCQUFrQixDQUFDO1FBQzFELEtBQUssRUFBRSx3QkFBd0I7UUFDL0IsVUFBVSxFQUFFLE1BQU07UUFDbEIsT0FBTyxFQUFFLEdBQUcsRUFBRSxDQUFDLElBQUksd0JBQXdCLEVBQUU7S0FDOUMsQ0FBQyxBQUpVLENBSVQiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtCZWhhdmlvclN1YmplY3R9IGZyb20gJ3J4anMnO1xuXG5pbXBvcnQge2luamVjdH0gZnJvbSAnLi9kaS9pbmplY3Rvcl9jb21wYXRpYmlsaXR5JztcbmltcG9ydCB7ybXJtWRlZmluZUluamVjdGFibGV9IGZyb20gJy4vZGkvaW50ZXJmYWNlL2RlZnMnO1xuaW1wb3J0IHtPbkRlc3Ryb3l9IGZyb20gJy4vaW50ZXJmYWNlL2xpZmVjeWNsZV9ob29rcyc7XG5cbi8qKlxuICogSW50ZXJuYWwgaW1wbGVtZW50YXRpb24gb2YgdGhlIHBlbmRpbmcgdGFza3Mgc2VydmljZS5cbiAqL1xuZXhwb3J0IGNsYXNzIFBlbmRpbmdUYXNrcyBpbXBsZW1lbnRzIE9uRGVzdHJveSB7XG4gIHByaXZhdGUgdGFza0lkID0gMDtcbiAgcHJpdmF0ZSBwZW5kaW5nVGFza3MgPSBuZXcgU2V0PG51bWJlcj4oKTtcbiAgcHJpdmF0ZSBnZXQgX2hhc1BlbmRpbmdUYXNrcygpIHtcbiAgICByZXR1cm4gdGhpcy5oYXNQZW5kaW5nVGFza3MudmFsdWU7XG4gIH1cbiAgaGFzUGVuZGluZ1Rhc2tzID0gbmV3IEJlaGF2aW9yU3ViamVjdDxib29sZWFuPihmYWxzZSk7XG5cbiAgYWRkKCk6IG51bWJlciB7XG4gICAgaWYgKCF0aGlzLl9oYXNQZW5kaW5nVGFza3MpIHtcbiAgICAgIHRoaXMuaGFzUGVuZGluZ1Rhc2tzLm5leHQodHJ1ZSk7XG4gICAgfVxuICAgIGNvbnN0IHRhc2tJZCA9IHRoaXMudGFza0lkKys7XG4gICAgdGhpcy5wZW5kaW5nVGFza3MuYWRkKHRhc2tJZCk7XG4gICAgcmV0dXJuIHRhc2tJZDtcbiAgfVxuXG4gIHJlbW92ZSh0YXNrSWQ6IG51bWJlcik6IHZvaWQge1xuICAgIHRoaXMucGVuZGluZ1Rhc2tzLmRlbGV0ZSh0YXNrSWQpO1xuICAgIGlmICh0aGlzLnBlbmRpbmdUYXNrcy5zaXplID09PSAwICYmIHRoaXMuX2hhc1BlbmRpbmdUYXNrcykge1xuICAgICAgdGhpcy5oYXNQZW5kaW5nVGFza3MubmV4dChmYWxzZSk7XG4gICAgfVxuICB9XG5cbiAgbmdPbkRlc3Ryb3koKTogdm9pZCB7XG4gICAgdGhpcy5wZW5kaW5nVGFza3MuY2xlYXIoKTtcbiAgICBpZiAodGhpcy5faGFzUGVuZGluZ1Rhc2tzKSB7XG4gICAgICB0aGlzLmhhc1BlbmRpbmdUYXNrcy5uZXh0KGZhbHNlKTtcbiAgICB9XG4gIH1cblxuICAvKiogQG5vY29sbGFwc2UgKi9cbiAgc3RhdGljIMm1cHJvdiA9IC8qKiBAcHVyZU9yQnJlYWtNeUNvZGUgKi8gybXJtWRlZmluZUluamVjdGFibGUoe1xuICAgIHRva2VuOiBQZW5kaW5nVGFza3MsXG4gICAgcHJvdmlkZWRJbjogJ3Jvb3QnLFxuICAgIGZhY3Rvcnk6ICgpID0+IG5ldyBQZW5kaW5nVGFza3MoKSxcbiAgfSk7XG59XG5cbi8qKlxuICogRXhwZXJpbWVudGFsIHNlcnZpY2UgdGhhdCBrZWVwcyB0cmFjayBvZiBwZW5kaW5nIHRhc2tzIGNvbnRyaWJ1dGluZyB0byB0aGUgc3RhYmxlbmVzcyBvZiBBbmd1bGFyXG4gKiBhcHBsaWNhdGlvbi4gV2hpbGUgc2V2ZXJhbCBleGlzdGluZyBBbmd1bGFyIHNlcnZpY2VzIChleC46IGBIdHRwQ2xpZW50YCkgd2lsbCBpbnRlcm5hbGx5IG1hbmFnZVxuICogdGFza3MgaW5mbHVlbmNpbmcgc3RhYmlsaXR5LCB0aGlzIEFQSSBnaXZlcyBjb250cm9sIG92ZXIgc3RhYmlsaXR5IHRvIGxpYnJhcnkgYW5kIGFwcGxpY2F0aW9uXG4gKiBkZXZlbG9wZXJzIGZvciBzcGVjaWZpYyBjYXNlcyBub3QgY292ZXJlZCBieSBBbmd1bGFyIGludGVybmFscy5cbiAqXG4gKiBUaGUgY29uY2VwdCBvZiBzdGFiaWxpdHkgY29tZXMgaW50byBwbGF5IGluIHNldmVyYWwgaW1wb3J0YW50IHNjZW5hcmlvczpcbiAqIC0gU1NSIHByb2Nlc3MgbmVlZHMgdG8gd2FpdCBmb3IgdGhlIGFwcGxpY2F0aW9uIHN0YWJpbGl0eSBiZWZvcmUgc2VyaWFsaXppbmcgYW5kIHNlbmRpbmcgcmVuZGVyZWRcbiAqIEhUTUw7XG4gKiAtIHRlc3RzIG1pZ2h0IHdhbnQgdG8gZGVsYXkgYXNzZXJ0aW9ucyB1bnRpbCB0aGUgYXBwbGljYXRpb24gYmVjb21lcyBzdGFibGU7XG4gKlxuICogQHVzYWdlTm90ZXNcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIGNvbnN0IHBlbmRpbmdUYXNrcyA9IGluamVjdChFeHBlcmltZW50YWxQZW5kaW5nVGFza3MpO1xuICogY29uc3QgdGFza0NsZWFudXAgPSBwZW5kaW5nVGFza3MuYWRkKCk7XG4gKiAvLyBkbyB3b3JrIHRoYXQgc2hvdWxkIGJsb2NrIGFwcGxpY2F0aW9uJ3Mgc3RhYmlsaXR5IGFuZCB0aGVuOlxuICogdGFza0NsZWFudXAoKTtcbiAqIGBgYFxuICpcbiAqIFRoaXMgQVBJIGlzIGV4cGVyaW1lbnRhbC4gTmVpdGhlciB0aGUgc2hhcGUsIG5vciB0aGUgdW5kZXJseWluZyBiZWhhdmlvciBpcyBzdGFibGUgYW5kIGNhbiBjaGFuZ2VcbiAqIGluIHBhdGNoIHZlcnNpb25zLiBXZSB3aWxsIGl0ZXJhdGUgb24gdGhlIGV4YWN0IEFQSSBiYXNlZCBvbiB0aGUgZmVlZGJhY2sgYW5kIG91ciB1bmRlcnN0YW5kaW5nXG4gKiBvZiB0aGUgcHJvYmxlbSBhbmQgc29sdXRpb24gc3BhY2UuXG4gKlxuICogQHB1YmxpY0FwaVxuICogQGV4cGVyaW1lbnRhbFxuICovXG5leHBvcnQgY2xhc3MgRXhwZXJpbWVudGFsUGVuZGluZ1Rhc2tzIHtcbiAgcHJpdmF0ZSBpbnRlcm5hbFBlbmRpbmdUYXNrcyA9IGluamVjdChQZW5kaW5nVGFza3MpO1xuICAvKipcbiAgICogQWRkcyBhIG5ldyB0YXNrIHRoYXQgc2hvdWxkIGJsb2NrIGFwcGxpY2F0aW9uJ3Mgc3RhYmlsaXR5LlxuICAgKiBAcmV0dXJucyBBIGNsZWFudXAgZnVuY3Rpb24gdGhhdCByZW1vdmVzIGEgdGFzayB3aGVuIGNhbGxlZC5cbiAgICovXG4gIGFkZCgpOiAoKSA9PiB2b2lkIHtcbiAgICBjb25zdCB0YXNrSWQgPSB0aGlzLmludGVybmFsUGVuZGluZ1Rhc2tzLmFkZCgpO1xuICAgIHJldHVybiAoKSA9PiB0aGlzLmludGVybmFsUGVuZGluZ1Rhc2tzLnJlbW92ZSh0YXNrSWQpO1xuICB9XG5cbiAgLyoqIEBub2NvbGxhcHNlICovXG4gIHN0YXRpYyDJtXByb3YgPSAvKiogQHB1cmVPckJyZWFrTXlDb2RlICovIMm1ybVkZWZpbmVJbmplY3RhYmxlKHtcbiAgICB0b2tlbjogRXhwZXJpbWVudGFsUGVuZGluZ1Rhc2tzLFxuICAgIHByb3ZpZGVkSW46ICdyb290JyxcbiAgICBmYWN0b3J5OiAoKSA9PiBuZXcgRXhwZXJpbWVudGFsUGVuZGluZ1Rhc2tzKCksXG4gIH0pO1xufVxuIl19