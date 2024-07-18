/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { setActiveConsumer } from '@angular/core/primitives/signals';
import { inject } from '../../di/injector_compatibility';
import { ErrorHandler } from '../../error_handler';
import { RuntimeError } from '../../errors';
import { DestroyRef } from '../../linker/destroy_ref';
/**
 * An `OutputEmitterRef` is created by the `output()` function and can be
 * used to emit values to consumers of your directive or component.
 *
 * Consumers of your directive/component can bind to the output and
 * subscribe to changes via the bound event syntax. For example:
 *
 * ```html
 * <my-comp (valueChange)="processNewValue($event)" />
 * ```
 *
 * @developerPreview
 */
export class OutputEmitterRef {
    constructor() {
        this.destroyed = false;
        this.listeners = null;
        this.errorHandler = inject(ErrorHandler, { optional: true });
        /** @internal */
        this.destroyRef = inject(DestroyRef);
        // Clean-up all listeners and mark as destroyed upon destroy.
        this.destroyRef.onDestroy(() => {
            this.destroyed = true;
            this.listeners = null;
        });
    }
    subscribe(callback) {
        if (this.destroyed) {
            throw new RuntimeError(953 /* RuntimeErrorCode.OUTPUT_REF_DESTROYED */, ngDevMode &&
                'Unexpected subscription to destroyed `OutputRef`. ' +
                    'The owning directive/component is destroyed.');
        }
        (this.listeners ??= []).push(callback);
        return {
            unsubscribe: () => {
                const idx = this.listeners?.indexOf(callback);
                if (idx !== undefined && idx !== -1) {
                    this.listeners?.splice(idx, 1);
                }
            },
        };
    }
    /** Emits a new value to the output. */
    emit(value) {
        if (this.destroyed) {
            throw new RuntimeError(953 /* RuntimeErrorCode.OUTPUT_REF_DESTROYED */, ngDevMode &&
                'Unexpected emit for destroyed `OutputRef`. ' +
                    'The owning directive/component is destroyed.');
        }
        if (this.listeners === null) {
            return;
        }
        const previousConsumer = setActiveConsumer(null);
        try {
            for (const listenerFn of this.listeners) {
                try {
                    listenerFn(value);
                }
                catch (err) {
                    this.errorHandler?.handleError(err);
                }
            }
        }
        finally {
            setActiveConsumer(previousConsumer);
        }
    }
}
/** Gets the owning `DestroyRef` for the given output. */
export function getOutputDestroyRef(ref) {
    return ref.destroyRef;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3V0cHV0X2VtaXR0ZXJfcmVmLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29yZS9zcmMvYXV0aG9yaW5nL291dHB1dC9vdXRwdXRfZW1pdHRlcl9yZWYudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUFDLGlCQUFpQixFQUFDLE1BQU0sa0NBQWtDLENBQUM7QUFFbkUsT0FBTyxFQUFDLE1BQU0sRUFBQyxNQUFNLGlDQUFpQyxDQUFDO0FBQ3ZELE9BQU8sRUFBQyxZQUFZLEVBQUMsTUFBTSxxQkFBcUIsQ0FBQztBQUNqRCxPQUFPLEVBQUMsWUFBWSxFQUFtQixNQUFNLGNBQWMsQ0FBQztBQUM1RCxPQUFPLEVBQUMsVUFBVSxFQUFDLE1BQU0sMEJBQTBCLENBQUM7QUFJcEQ7Ozs7Ozs7Ozs7OztHQVlHO0FBQ0gsTUFBTSxPQUFPLGdCQUFnQjtJQVEzQjtRQVBRLGNBQVMsR0FBRyxLQUFLLENBQUM7UUFDbEIsY0FBUyxHQUFxQyxJQUFJLENBQUM7UUFDbkQsaUJBQVksR0FBRyxNQUFNLENBQUMsWUFBWSxFQUFFLEVBQUMsUUFBUSxFQUFFLElBQUksRUFBQyxDQUFDLENBQUM7UUFFOUQsZ0JBQWdCO1FBQ2hCLGVBQVUsR0FBZSxNQUFNLENBQUMsVUFBVSxDQUFDLENBQUM7UUFHMUMsNkRBQTZEO1FBQzdELElBQUksQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLEdBQUcsRUFBRTtZQUM3QixJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQztZQUN0QixJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQztRQUN4QixDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFRCxTQUFTLENBQUMsUUFBNEI7UUFDcEMsSUFBSSxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDbkIsTUFBTSxJQUFJLFlBQVksa0RBRXBCLFNBQVM7Z0JBQ1Asb0RBQW9EO29CQUNsRCw4Q0FBOEMsQ0FDbkQsQ0FBQztRQUNKLENBQUM7UUFFRCxDQUFDLElBQUksQ0FBQyxTQUFTLEtBQUssRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBRXZDLE9BQU87WUFDTCxXQUFXLEVBQUUsR0FBRyxFQUFFO2dCQUNoQixNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsU0FBUyxFQUFFLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQztnQkFDOUMsSUFBSSxHQUFHLEtBQUssU0FBUyxJQUFJLEdBQUcsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDO29CQUNwQyxJQUFJLENBQUMsU0FBUyxFQUFFLE1BQU0sQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUM7Z0JBQ2pDLENBQUM7WUFDSCxDQUFDO1NBQ0YsQ0FBQztJQUNKLENBQUM7SUFFRCx1Q0FBdUM7SUFDdkMsSUFBSSxDQUFDLEtBQVE7UUFDWCxJQUFJLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQztZQUNuQixNQUFNLElBQUksWUFBWSxrREFFcEIsU0FBUztnQkFDUCw2Q0FBNkM7b0JBQzNDLDhDQUE4QyxDQUNuRCxDQUFDO1FBQ0osQ0FBQztRQUVELElBQUksSUFBSSxDQUFDLFNBQVMsS0FBSyxJQUFJLEVBQUUsQ0FBQztZQUM1QixPQUFPO1FBQ1QsQ0FBQztRQUVELE1BQU0sZ0JBQWdCLEdBQUcsaUJBQWlCLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDakQsSUFBSSxDQUFDO1lBQ0gsS0FBSyxNQUFNLFVBQVUsSUFBSSxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7Z0JBQ3hDLElBQUksQ0FBQztvQkFDSCxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUM7Z0JBQ3BCLENBQUM7Z0JBQUMsT0FBTyxHQUFZLEVBQUUsQ0FBQztvQkFDdEIsSUFBSSxDQUFDLFlBQVksRUFBRSxXQUFXLENBQUMsR0FBRyxDQUFDLENBQUM7Z0JBQ3RDLENBQUM7WUFDSCxDQUFDO1FBQ0gsQ0FBQztnQkFBUyxDQUFDO1lBQ1QsaUJBQWlCLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztRQUN0QyxDQUFDO0lBQ0gsQ0FBQztDQUNGO0FBRUQseURBQXlEO0FBQ3pELE1BQU0sVUFBVSxtQkFBbUIsQ0FBQyxHQUF1QjtJQUN6RCxPQUFPLEdBQUcsQ0FBQyxVQUFVLENBQUM7QUFDeEIsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge3NldEFjdGl2ZUNvbnN1bWVyfSBmcm9tICdAYW5ndWxhci9jb3JlL3ByaW1pdGl2ZXMvc2lnbmFscyc7XG5cbmltcG9ydCB7aW5qZWN0fSBmcm9tICcuLi8uLi9kaS9pbmplY3Rvcl9jb21wYXRpYmlsaXR5JztcbmltcG9ydCB7RXJyb3JIYW5kbGVyfSBmcm9tICcuLi8uLi9lcnJvcl9oYW5kbGVyJztcbmltcG9ydCB7UnVudGltZUVycm9yLCBSdW50aW1lRXJyb3JDb2RlfSBmcm9tICcuLi8uLi9lcnJvcnMnO1xuaW1wb3J0IHtEZXN0cm95UmVmfSBmcm9tICcuLi8uLi9saW5rZXIvZGVzdHJveV9yZWYnO1xuXG5pbXBvcnQge091dHB1dFJlZiwgT3V0cHV0UmVmU3Vic2NyaXB0aW9ufSBmcm9tICcuL291dHB1dF9yZWYnO1xuXG4vKipcbiAqIEFuIGBPdXRwdXRFbWl0dGVyUmVmYCBpcyBjcmVhdGVkIGJ5IHRoZSBgb3V0cHV0KClgIGZ1bmN0aW9uIGFuZCBjYW4gYmVcbiAqIHVzZWQgdG8gZW1pdCB2YWx1ZXMgdG8gY29uc3VtZXJzIG9mIHlvdXIgZGlyZWN0aXZlIG9yIGNvbXBvbmVudC5cbiAqXG4gKiBDb25zdW1lcnMgb2YgeW91ciBkaXJlY3RpdmUvY29tcG9uZW50IGNhbiBiaW5kIHRvIHRoZSBvdXRwdXQgYW5kXG4gKiBzdWJzY3JpYmUgdG8gY2hhbmdlcyB2aWEgdGhlIGJvdW5kIGV2ZW50IHN5bnRheC4gRm9yIGV4YW1wbGU6XG4gKlxuICogYGBgaHRtbFxuICogPG15LWNvbXAgKHZhbHVlQ2hhbmdlKT1cInByb2Nlc3NOZXdWYWx1ZSgkZXZlbnQpXCIgLz5cbiAqIGBgYFxuICpcbiAqIEBkZXZlbG9wZXJQcmV2aWV3XG4gKi9cbmV4cG9ydCBjbGFzcyBPdXRwdXRFbWl0dGVyUmVmPFQ+IGltcGxlbWVudHMgT3V0cHV0UmVmPFQ+IHtcbiAgcHJpdmF0ZSBkZXN0cm95ZWQgPSBmYWxzZTtcbiAgcHJpdmF0ZSBsaXN0ZW5lcnM6IEFycmF5PCh2YWx1ZTogVCkgPT4gdm9pZD4gfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBlcnJvckhhbmRsZXIgPSBpbmplY3QoRXJyb3JIYW5kbGVyLCB7b3B0aW9uYWw6IHRydWV9KTtcblxuICAvKiogQGludGVybmFsICovXG4gIGRlc3Ryb3lSZWY6IERlc3Ryb3lSZWYgPSBpbmplY3QoRGVzdHJveVJlZik7XG5cbiAgY29uc3RydWN0b3IoKSB7XG4gICAgLy8gQ2xlYW4tdXAgYWxsIGxpc3RlbmVycyBhbmQgbWFyayBhcyBkZXN0cm95ZWQgdXBvbiBkZXN0cm95LlxuICAgIHRoaXMuZGVzdHJveVJlZi5vbkRlc3Ryb3koKCkgPT4ge1xuICAgICAgdGhpcy5kZXN0cm95ZWQgPSB0cnVlO1xuICAgICAgdGhpcy5saXN0ZW5lcnMgPSBudWxsO1xuICAgIH0pO1xuICB9XG5cbiAgc3Vic2NyaWJlKGNhbGxiYWNrOiAodmFsdWU6IFQpID0+IHZvaWQpOiBPdXRwdXRSZWZTdWJzY3JpcHRpb24ge1xuICAgIGlmICh0aGlzLmRlc3Ryb3llZCkge1xuICAgICAgdGhyb3cgbmV3IFJ1bnRpbWVFcnJvcihcbiAgICAgICAgUnVudGltZUVycm9yQ29kZS5PVVRQVVRfUkVGX0RFU1RST1lFRCxcbiAgICAgICAgbmdEZXZNb2RlICYmXG4gICAgICAgICAgJ1VuZXhwZWN0ZWQgc3Vic2NyaXB0aW9uIHRvIGRlc3Ryb3llZCBgT3V0cHV0UmVmYC4gJyArXG4gICAgICAgICAgICAnVGhlIG93bmluZyBkaXJlY3RpdmUvY29tcG9uZW50IGlzIGRlc3Ryb3llZC4nLFxuICAgICAgKTtcbiAgICB9XG5cbiAgICAodGhpcy5saXN0ZW5lcnMgPz89IFtdKS5wdXNoKGNhbGxiYWNrKTtcblxuICAgIHJldHVybiB7XG4gICAgICB1bnN1YnNjcmliZTogKCkgPT4ge1xuICAgICAgICBjb25zdCBpZHggPSB0aGlzLmxpc3RlbmVycz8uaW5kZXhPZihjYWxsYmFjayk7XG4gICAgICAgIGlmIChpZHggIT09IHVuZGVmaW5lZCAmJiBpZHggIT09IC0xKSB7XG4gICAgICAgICAgdGhpcy5saXN0ZW5lcnM/LnNwbGljZShpZHgsIDEpO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgIH07XG4gIH1cblxuICAvKiogRW1pdHMgYSBuZXcgdmFsdWUgdG8gdGhlIG91dHB1dC4gKi9cbiAgZW1pdCh2YWx1ZTogVCk6IHZvaWQge1xuICAgIGlmICh0aGlzLmRlc3Ryb3llZCkge1xuICAgICAgdGhyb3cgbmV3IFJ1bnRpbWVFcnJvcihcbiAgICAgICAgUnVudGltZUVycm9yQ29kZS5PVVRQVVRfUkVGX0RFU1RST1lFRCxcbiAgICAgICAgbmdEZXZNb2RlICYmXG4gICAgICAgICAgJ1VuZXhwZWN0ZWQgZW1pdCBmb3IgZGVzdHJveWVkIGBPdXRwdXRSZWZgLiAnICtcbiAgICAgICAgICAgICdUaGUgb3duaW5nIGRpcmVjdGl2ZS9jb21wb25lbnQgaXMgZGVzdHJveWVkLicsXG4gICAgICApO1xuICAgIH1cblxuICAgIGlmICh0aGlzLmxpc3RlbmVycyA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IHByZXZpb3VzQ29uc3VtZXIgPSBzZXRBY3RpdmVDb25zdW1lcihudWxsKTtcbiAgICB0cnkge1xuICAgICAgZm9yIChjb25zdCBsaXN0ZW5lckZuIG9mIHRoaXMubGlzdGVuZXJzKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgbGlzdGVuZXJGbih2YWx1ZSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogdW5rbm93bikge1xuICAgICAgICAgIHRoaXMuZXJyb3JIYW5kbGVyPy5oYW5kbGVFcnJvcihlcnIpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIHNldEFjdGl2ZUNvbnN1bWVyKHByZXZpb3VzQ29uc3VtZXIpO1xuICAgIH1cbiAgfVxufVxuXG4vKiogR2V0cyB0aGUgb3duaW5nIGBEZXN0cm95UmVmYCBmb3IgdGhlIGdpdmVuIG91dHB1dC4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRPdXRwdXREZXN0cm95UmVmKHJlZjogT3V0cHV0UmVmPHVua25vd24+KTogRGVzdHJveVJlZiB8IHVuZGVmaW5lZCB7XG4gIHJldHVybiByZWYuZGVzdHJveVJlZjtcbn1cbiJdfQ==