/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { EventEmitter } from '../event_emitter';
import { arrayEquals, flatten } from '../util/array_utils';
function symbolIterator() {
    // @ts-expect-error accessing a private member
    return this._results[Symbol.iterator]();
}
/**
 * An unmodifiable list of items that Angular keeps up to date when the state
 * of the application changes.
 *
 * The type of object that {@link ViewChildren}, {@link ContentChildren}, and {@link QueryList}
 * provide.
 *
 * Implements an iterable interface, therefore it can be used in both ES6
 * javascript `for (var i of items)` loops as well as in Angular templates with
 * `*ngFor="let i of myList"`.
 *
 * Changes can be observed by subscribing to the changes `Observable`.
 *
 * NOTE: In the future this class will implement an `Observable` interface.
 *
 * @usageNotes
 * ### Example
 * ```typescript
 * @Component({...})
 * class Container {
 *   @ViewChildren(Item) items:QueryList<Item>;
 * }
 * ```
 *
 * @publicApi
 */
export class QueryList {
    static { Symbol.iterator; }
    /**
     * Returns `Observable` of `QueryList` notifying the subscriber of changes.
     */
    get changes() {
        return (this._changes ??= new EventEmitter());
    }
    /**
     * @param emitDistinctChangesOnly Whether `QueryList.changes` should fire only when actual change
     *     has occurred. Or if it should fire when query is recomputed. (recomputing could resolve in
     *     the same result)
     */
    constructor(_emitDistinctChangesOnly = false) {
        this._emitDistinctChangesOnly = _emitDistinctChangesOnly;
        this.dirty = true;
        this._onDirty = undefined;
        this._results = [];
        this._changesDetected = false;
        this._changes = undefined;
        this.length = 0;
        this.first = undefined;
        this.last = undefined;
        // This function should be declared on the prototype, but doing so there will cause the class
        // declaration to have side-effects and become not tree-shakable. For this reason we do it in
        // the constructor.
        // [Symbol.iterator](): Iterator<T> { ... }
        const proto = QueryList.prototype;
        if (!proto[Symbol.iterator])
            proto[Symbol.iterator] = symbolIterator;
    }
    /**
     * Returns the QueryList entry at `index`.
     */
    get(index) {
        return this._results[index];
    }
    /**
     * See
     * [Array.map](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map)
     */
    map(fn) {
        return this._results.map(fn);
    }
    filter(fn) {
        return this._results.filter(fn);
    }
    /**
     * See
     * [Array.find](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/find)
     */
    find(fn) {
        return this._results.find(fn);
    }
    /**
     * See
     * [Array.reduce](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/reduce)
     */
    reduce(fn, init) {
        return this._results.reduce(fn, init);
    }
    /**
     * See
     * [Array.forEach](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/forEach)
     */
    forEach(fn) {
        this._results.forEach(fn);
    }
    /**
     * See
     * [Array.some](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/some)
     */
    some(fn) {
        return this._results.some(fn);
    }
    /**
     * Returns a copy of the internal results list as an Array.
     */
    toArray() {
        return this._results.slice();
    }
    toString() {
        return this._results.toString();
    }
    /**
     * Updates the stored data of the query list, and resets the `dirty` flag to `false`, so that
     * on change detection, it will not notify of changes to the queries, unless a new change
     * occurs.
     *
     * @param resultsTree The query results to store
     * @param identityAccessor Optional function for extracting stable object identity from a value
     *    in the array. This function is executed for each element of the query result list while
     *    comparing current query list with the new one (provided as a first argument of the `reset`
     *    function) to detect if the lists are different. If the function is not provided, elements
     *    are compared as is (without any pre-processing).
     */
    reset(resultsTree, identityAccessor) {
        this.dirty = false;
        const newResultFlat = flatten(resultsTree);
        if ((this._changesDetected = !arrayEquals(this._results, newResultFlat, identityAccessor))) {
            this._results = newResultFlat;
            this.length = newResultFlat.length;
            this.last = newResultFlat[this.length - 1];
            this.first = newResultFlat[0];
        }
    }
    /**
     * Triggers a change event by emitting on the `changes` {@link EventEmitter}.
     */
    notifyOnChanges() {
        if (this._changes !== undefined && (this._changesDetected || !this._emitDistinctChangesOnly))
            this._changes.emit(this);
    }
    /** @internal */
    onDirty(cb) {
        this._onDirty = cb;
    }
    /** internal */
    setDirty() {
        this.dirty = true;
        this._onDirty?.();
    }
    /** internal */
    destroy() {
        if (this._changes !== undefined) {
            this._changes.complete();
            this._changes.unsubscribe();
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicXVlcnlfbGlzdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvcmUvc3JjL2xpbmtlci9xdWVyeV9saXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUlILE9BQU8sRUFBQyxZQUFZLEVBQUMsTUFBTSxrQkFBa0IsQ0FBQztBQUU5QyxPQUFPLEVBQUMsV0FBVyxFQUFFLE9BQU8sRUFBQyxNQUFNLHFCQUFxQixDQUFDO0FBRXpELFNBQVMsY0FBYztJQUNyQiw4Q0FBOEM7SUFDOUMsT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDO0FBQzFDLENBQUM7QUFFRDs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztHQXlCRztBQUNILE1BQU0sT0FBTyxTQUFTO2FBMkpuQixNQUFNLENBQUMsUUFBUTtJQWhKaEI7O09BRUc7SUFDSCxJQUFJLE9BQU87UUFDVCxPQUFPLENBQUMsSUFBSSxDQUFDLFFBQVEsS0FBSyxJQUFJLFlBQVksRUFBRSxDQUFDLENBQUM7SUFDaEQsQ0FBQztJQUVEOzs7O09BSUc7SUFDSCxZQUFvQiwyQkFBb0MsS0FBSztRQUF6Qyw2QkFBd0IsR0FBeEIsd0JBQXdCLENBQWlCO1FBdEI3QyxVQUFLLEdBQUcsSUFBSSxDQUFDO1FBQ3JCLGFBQVEsR0FBZ0IsU0FBUyxDQUFDO1FBQ2xDLGFBQVEsR0FBYSxFQUFFLENBQUM7UUFDeEIscUJBQWdCLEdBQVksS0FBSyxDQUFDO1FBQ2xDLGFBQVEsR0FBMkMsU0FBUyxDQUFDO1FBRTVELFdBQU0sR0FBVyxDQUFDLENBQUM7UUFDbkIsVUFBSyxHQUFNLFNBQVUsQ0FBQztRQUN0QixTQUFJLEdBQU0sU0FBVSxDQUFDO1FBZTVCLDZGQUE2RjtRQUM3Riw2RkFBNkY7UUFDN0YsbUJBQW1CO1FBQ25CLDJDQUEyQztRQUMzQyxNQUFNLEtBQUssR0FBRyxTQUFTLENBQUMs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QUFPO1FBQ0wsSUFBSSxJQUFJLENBQUMsUUFBUSxLQUFLLFNBQVMsRUFBRSxDQUFDO1lBQ2hDLElBQUksQ0FBQyxRQUFRLENBQUMsUUFBUSxFQUFFLENBQUM7WUFDekIsSUFBSSxDQUFDLFFBQVEsQ0FBQyxXQUFXLEVBQUUsQ0FBQztRQUM5QixDQUFDO0lBQ0gsQ0FBQztDQVFGIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7T2JzZXJ2YWJsZX0gZnJvbSAncnhqcyc7XG5cbmltcG9ydCB7RXZlbnRFbWl0dGVyfSBmcm9tICcuLi9ldmVudF9lbWl0dGVyJztcbmltcG9ydCB7V3JpdGFibGV9IGZyb20gJy4uL2ludGVyZmFjZS90eXBlJztcbmltcG9ydCB7YXJyYXlFcXVhbHMsIGZsYXR0ZW59IGZyb20gJy4uL3V0aWwvYXJyYXlfdXRpbHMnO1xuXG5mdW5jdGlvbiBzeW1ib2xJdGVyYXRvcjxUPih0aGlzOiBRdWVyeUxpc3Q8VD4pOiBJdGVyYXRvcjxUPiB7XG4gIC8vIEB0cy1leHBlY3QtZXJyb3IgYWNjZXNzaW5nIGEgcHJpdmF0ZSBtZW1iZXJcbiAgcmV0dXJuIHRoaXMuX3Jlc3VsdHNbU3ltYm9sLml0ZXJhdG9yXSgpO1xufVxuXG4vKipcbiAqIEFuIHVubW9kaWZpYWJsZSBsaXN0IG9mIGl0ZW1zIHRoYXQgQW5ndWxhciBrZWVwcyB1cCB0byBkYXRlIHdoZW4gdGhlIHN0YXRlXG4gKiBvZiB0aGUgYXBwbGljYXRpb24gY2hhbmdlcy5cbiAqXG4gKiBUaGUgdHlwZSBvZiBvYmplY3QgdGhhdCB7QGxpbmsgVmlld0NoaWxkcmVufSwge0BsaW5rIENvbnRlbnRDaGlsZHJlbn0sIGFuZCB7QGxpbmsgUXVlcnlMaXN0fVxuICogcHJvdmlkZS5cbiAqXG4gKiBJbXBsZW1lbnRzIGFuIGl0ZXJhYmxlIGludGVyZmFjZSwgdGhlcmVmb3JlIGl0IGNhbiBiZSB1c2VkIGluIGJvdGggRVM2XG4gKiBqYXZhc2NyaXB0IGBmb3IgKHZhciBpIG9mIGl0ZW1zKWAgbG9vcHMgYXMgd2VsbCBhcyBpbiBBbmd1bGFyIHRlbXBsYXRlcyB3aXRoXG4gKiBgKm5nRm9yPVwibGV0IGkgb2YgbXlMaXN0XCJgLlxuICpcbiAqIENoYW5nZXMgY2FuIGJlIG9ic2VydmVkIGJ5IHN1YnNjcmliaW5nIHRvIHRoZSBjaGFuZ2VzIGBPYnNlcnZhYmxlYC5cbiAqXG4gKiBOT1RFOiBJbiB0aGUgZnV0dXJlIHRoaXMgY2xhc3Mgd2lsbCBpbXBsZW1lbnQgYW4gYE9ic2VydmFibGVgIGludGVyZmFjZS5cbiAqXG4gKiBAdXNhZ2VOb3Rlc1xuICogIyMjIEV4YW1wbGVcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIEBDb21wb25lbnQoey4uLn0pXG4gKiBjbGFzcyBDb250YWluZXIge1xuICogICBAVmlld0NoaWxkcmVuKEl0ZW0pIGl0ZW1zOlF1ZXJ5TGlzdDxJdGVtPjtcbiAqIH1cbiAqIGBgYFxuICpcbiAqIEBwdWJsaWNBcGlcbiAqL1xuZXhwb3J0IGNsYXNzIFF1ZXJ5TGlzdDxUPiBpbXBsZW1lbnRzIEl0ZXJhYmxlPFQ+IHtcbiAgcHVibGljIHJlYWRvbmx5IGRpcnR5ID0gdHJ1ZTtcbiAgcHJpdmF0ZSBfb25EaXJ0eT86ICgpID0+IHZvaWQgPSB1bmRlZmluZWQ7XG4gIHByaXZhdGUgX3Jlc3VsdHM6IEFycmF5PFQ+ID0gW107XG4gIHByaXZhdGUgX2NoYW5nZXNEZXRlY3RlZDogYm9vbGVhbiA9IGZhbHNlO1xuICBwcml2YXRlIF9jaGFuZ2VzOiBFdmVudEVtaXR0ZXI8UXVlcnlMaXN0PFQ+PiB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblxuICByZWFkb25seSBsZW5ndGg6IG51bWJlciA9IDA7XG4gIHJlYWRvbmx5IGZpcnN0OiBUID0gdW5kZWZpbmVkITtcbiAgcmVhZG9ubHkgbGFzdDogVCA9IHVuZGVmaW5lZCE7XG5cbiAgLyoqXG4gICAqIFJldHVybnMgYE9ic2VydmFibGVgIG9mIGBRdWVyeUxpc3RgIG5vdGlmeWluZyB0aGUgc3Vic2NyaWJlciBvZiBjaGFuZ2VzLlxuICAgKi9cbiAgZ2V0IGNoYW5nZXMoKTogT2JzZXJ2YWJsZTxhbnk+IHtcbiAgICByZXR1cm4gKHRoaXMuX2NoYW5nZXMgPz89IG5ldyBFdmVudEVtaXR0ZXIoKSk7XG4gIH1cblxuICAvKipcbiAgICogQHBhcmFtIGVtaXREaXN0aW5jdENoYW5nZXNPbmx5IFdoZXRoZXIgYFF1ZXJ5TGlzdC5jaGFuZ2VzYCBzaG91bGQgZmlyZSBvbmx5IHdoZW4gYWN0dWFsIGNoYW5nZVxuICAgKiAgICAgaGFzIG9jY3VycmVkLiBPciBpZiBpdCBzaG91bGQgZmlyZSB3aGVuIHF1ZXJ5IGlzIHJlY29tcHV0ZWQuIChyZWNvbXB1dGluZyBjb3VsZCByZXNvbHZlIGluXG4gICAqICAgICB0aGUgc2FtZSByZXN1bHQpXG4gICAqL1xuICBjb25zdHJ1Y3Rvcihwcml2YXRlIF9lbWl0RGlzdGluY3RDaGFuZ2VzT25seTogYm9vbGVhbiA9IGZhbHNlKSB7XG4gICAgLy8gVGhpcyBmdW5jdGlvbiBzaG91bGQgYmUgZGVjbGFyZWQgb24gdGhlIHByb3RvdHlwZSwgYnV0IGRvaW5nIHNvIHRoZXJlIHdpbGwgY2F1c2UgdGhlIGNsYXNzXG4gICAgLy8gZGVjbGFyYXRpb24gdG8gaGF2ZSBzaWRlLWVmZmVjdHMgYW5kIGJlY29tZSBub3QgdHJlZS1zaGFrYWJsZS4gRm9yIHRoaXMgcmVhc29uIHdlIGRvIGl0IGluXG4gICAgLy8gdGhlIGNvbnN0cnVjdG9yLlxuICAgIC8vIFtTeW1ib2wuaXRlcmF0b3JdKCk6IEl0ZXJhdG9yPFQ+IHsgLi4uIH1cbiAgICBjb25zdCBwcm90byA9IFF1ZXJ5TGlzdC5wcm90b3R5cGU7XG4gICAgaWYgKCFwcm90b1tTeW1ib2wuaXRlcmF0b3JdKSBwcm90b1tTeW1ib2wuaXRlcmF0b3JdID0gc3ltYm9sSXRlcmF0b3I7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJucyB0aGUgUXVlcnlMaXN0IGVudHJ5IGF0IGBpbmRleGAuXG4gICAqL1xuICBnZXQoaW5kZXg6IG51bWJlcik6IFQgfCB1bmRlZmluZWQge1xuICAgIHJldHVybiB0aGlzLl9yZXN1bHRzW2luZGV4XTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTZWVcbiAgICogW0FycmF5Lm1hcF0oaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvSmF2YVNjcmlwdC9SZWZlcmVuY2UvR2xvYmFsX09iamVjdHMvQXJyYXkvbWFwKVxuICAgKi9cbiAgbWFwPFU+KGZuOiAoaXRlbTogVCwgaW5kZXg6IG51bWJlciwgYXJyYXk6IFRbXSkgPT4gVSk6IFVbXSB7XG4gICAgcmV0dXJuIHRoaXMuX3Jlc3VsdHMubWFwKGZuKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTZWVcbiAgICogW0FycmF5LmZpbHRlcl0oaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvSmF2YVNjcmlwdC9SZWZlcmVuY2UvR2xvYmFsX09iamVjdHMvQXJyYXkvZmlsdGVyKVxuICAgKi9cbiAgZmlsdGVyPFMgZXh0ZW5kcyBUPihwcmVkaWNhdGU6ICh2YWx1ZTogVCwgaW5kZXg6IG51bWJlciwgYXJyYXk6IHJlYWRvbmx5IFRbXSkgPT4gdmFsdWUgaXMgUyk6IFNbXTtcbiAgZmlsdGVyKHByZWRpY2F0ZTogKHZhbHVlOiBULCBpbmRleDogbnVtYmVyLCBhcnJheTogcmVhZG9ubHkgVFtdKSA9PiB1bmtub3duKTogVFtdO1xuICBmaWx0ZXIoZm46IChpdGVtOiBULCBpbmRleDogbnVtYmVyLCBhcnJheTogVFtdKSA9PiBib29sZWFuKTogVFtdIHtcbiAgICByZXR1cm4gdGhpcy5fcmVzdWx0cy5maWx0ZXIoZm4pO1xuICB9XG5cbiAgLyoqXG4gICAqIFNlZVxuICAgKiBbQXJyYXkuZmluZF0oaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvSmF2YVNjcmlwdC9SZWZlcmVuY2UvR2xvYmFsX09iamVjdHMvQXJyYXkvZmluZClcbiAgICovXG4gIGZpbmQoZm46IChpdGVtOiBULCBpbmRleDogbnVtYmVyLCBhcnJheTogVFtdKSA9PiBib29sZWFuKTogVCB8IHVuZGVmaW5lZCB7XG4gICAgcmV0dXJuIHRoaXMuX3Jlc3VsdHMuZmluZChmbik7XG4gIH1cblxuICAvKipcbiAgICogU2VlXG4gICAqIFtBcnJheS5yZWR1Y2VdKGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0phdmFTY3JpcHQvUmVmZXJlbmNlL0dsb2JhbF9PYmplY3RzL0FycmF5L3JlZHVjZSlcbiAgICovXG4gIHJlZHVjZTxVPihmbjogKHByZXZWYWx1ZTogVSwgY3VyVmFsdWU6IFQsIGN1ckluZGV4OiBudW1iZXIsIGFycmF5OiBUW10pID0+IFUsIGluaXQ6IFUpOiBVIHtcbiAgICByZXR1cm4gdGhpcy5fcmVzdWx0cy5yZWR1Y2UoZm4sIGluaXQpO1xuICB9XG5cbiAgLyoqXG4gICAqIFNlZVxuICAgKiBbQXJyYXkuZm9yRWFjaF0oaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvSmF2YVNjcmlwdC9SZWZlcmVuY2UvR2xvYmFsX09iamVjdHMvQXJyYXkvZm9yRWFjaClcbiAgICovXG4gIGZvckVhY2goZm46IChpdGVtOiBULCBpbmRleDogbnVtYmVyLCBhcnJheTogVFtdKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgdGhpcy5fcmVzdWx0cy5mb3JFYWNoKGZuKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTZWVcbiAgICogW0FycmF5LnNvbWVdKGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0phdmFTY3JpcHQvUmVmZXJlbmNlL0dsb2JhbF9PYmplY3RzL0FycmF5L3NvbWUpXG4gICAqL1xuICBzb21lKGZuOiAodmFsdWU6IFQsIGluZGV4OiBudW1iZXIsIGFycmF5OiBUW10pID0+IGJvb2xlYW4pOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy5fcmVzdWx0cy5zb21lKGZuKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIGEgY29weSBvZiB0aGUgaW50ZXJuYWwgcmVzdWx0cyBsaXN0IGFzIGFuIEFycmF5LlxuICAgKi9cbiAgdG9BcnJheSgpOiBUW10ge1xuICAgIHJldHVybiB0aGlzLl9yZXN1bHRzLnNsaWNlKCk7XG4gIH1cblxuICB0b1N0cmluZygpOiBzdHJpbmcge1xuICAgIHJldHVybiB0aGlzLl9yZXN1bHRzLnRvU3RyaW5nKCk7XG4gIH1cblxuICAvKipcbiAgICogVXBkYXRlcyB0aGUgc3RvcmVkIGRhdGEgb2YgdGhlIHF1ZXJ5IGxpc3QsIGFuZCByZXNldHMgdGhlIGBkaXJ0eWAgZmxhZyB0byBgZmFsc2VgLCBzbyB0aGF0XG4gICAqIG9uIGNoYW5nZSBkZXRlY3Rpb24sIGl0IHdpbGwgbm90IG5vdGlmeSBvZiBjaGFuZ2VzIHRvIHRoZSBxdWVyaWVzLCB1bmxlc3MgYSBuZXcgY2hhbmdlXG4gICAqIG9jY3Vycy5cbiAgICpcbiAgICogQHBhcmFtIHJlc3VsdHNUcmVlIFRoZSBxdWVyeSByZXN1bHRzIHRvIHN0b3JlXG4gICAqIEBwYXJhbSBpZGVudGl0eUFjY2Vzc29yIE9wdGlvbmFsIGZ1bmN0aW9uIGZvciBleHRyYWN0aW5nIHN0YWJsZSBvYmplY3QgaWRlbnRpdHkgZnJvbSBhIHZhbHVlXG4gICAqICAgIGluIHRoZSBhcnJheS4gVGhpcyBmdW5jdGlvbiBpcyBleGVjdXRlZCBmb3IgZWFjaCBlbGVtZW50IG9mIHRoZSBxdWVyeSByZXN1bHQgbGlzdCB3aGlsZVxuICAgKiAgICBjb21wYXJpbmcgY3VycmVudCBxdWVyeSBsaXN0IHdpdGggdGhlIG5ldyBvbmUgKHByb3ZpZGVkIGFzIGEgZmlyc3QgYXJndW1lbnQgb2YgdGhlIGByZXNldGBcbiAgICogICAgZnVuY3Rpb24pIHRvIGRldGVjdCBpZiB0aGUgbGlzdHMgYXJlIGRpZmZlcmVudC4gSWYgdGhlIGZ1bmN0aW9uIGlzIG5vdCBwcm92aWRlZCwgZWxlbWVudHNcbiAgICogICAgYXJlIGNvbXBhcmVkIGFzIGlzICh3aXRob3V0IGFueSBwcmUtcHJvY2Vzc2luZykuXG4gICAqL1xuICByZXNldChyZXN1bHRzVHJlZTogQXJyYXk8VCB8IGFueVtdPiwgaWRlbnRpdHlBY2Nlc3Nvcj86ICh2YWx1ZTogVCkgPT4gdW5rbm93bik6IHZvaWQge1xuICAgICh0aGlzIGFzIHtkaXJ0eTogYm9vbGVhbn0pLmRpcnR5ID0gZmFsc2U7XG4gICAgY29uc3QgbmV3UmVzdWx0RmxhdCA9IGZsYXR0ZW4ocmVzdWx0c1RyZWUpO1xuICAgIGlmICgodGhpcy5fY2hhbmdlc0RldGVjdGVkID0gIWFycmF5RXF1YWxzKHRoaXMuX3Jlc3VsdHMsIG5ld1Jlc3VsdEZsYXQsIGlkZW50aXR5QWNjZXNzb3IpKSkge1xuICAgICAgdGhpcy5fcmVzdWx0cyA9IG5ld1Jlc3VsdEZsYXQ7XG4gICAgICAodGhpcyBhcyBXcml0YWJsZTx0aGlzPikubGVuZ3RoID0gbmV3UmVzdWx0RmxhdC5sZW5ndGg7XG4gICAgICAodGhpcyBhcyBXcml0YWJsZTx0aGlzPikubGFzdCA9IG5ld1Jlc3VsdEZsYXRbdGhpcy5sZW5ndGggLSAxXTtcbiAgICAgICh0aGlzIGFzIFdyaXRhYmxlPHRoaXM+KS5maXJzdCA9IG5ld1Jlc3VsdEZsYXRbMF07XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFRyaWdnZXJzIGEgY2hhbmdlIGV2ZW50IGJ5IGVtaXR0aW5nIG9uIHRoZSBgY2hhbmdlc2Age0BsaW5rIEV2ZW50RW1pdHRlcn0uXG4gICAqL1xuICBub3RpZnlPbkNoYW5nZXMoKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuX2NoYW5nZXMgIT09IHVuZGVmaW5lZCAmJiAodGhpcy5fY2hhbmdlc0RldGVjdGVkIHx8ICF0aGlzLl9lbWl0RGlzdGluY3RDaGFuZ2VzT25seSkpXG4gICAgICB0aGlzLl9jaGFuZ2VzLmVtaXQodGhpcyk7XG4gIH1cblxuICAvKiogQGludGVybmFsICovXG4gIG9uRGlydHkoY2I6ICgpID0+IHZvaWQpIHtcbiAgICB0aGlzLl9vbkRpcnR5ID0gY2I7XG4gIH1cblxuICAvKiogaW50ZXJuYWwgKi9cbiAgc2V0RGlydHkoKSB7XG4gICAgKHRoaXMgYXMge2RpcnR5OiBib29sZWFufSkuZGlydHkgPSB0cnVlO1xuICAgIHRoaXMuX29uRGlydHk/LigpO1xuICB9XG5cbiAgLyoqIGludGVybmFsICovXG4gIGRlc3Ryb3koKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuX2NoYW5nZXMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhpcy5fY2hhbmdlcy5jb21wbGV0ZSgpO1xuICAgICAgdGhpcy5fY2hhbmdlcy51bnN1YnNjcmliZSgpO1xuICAgIH1cbiAgfVxuXG4gIC8vIFRoZSBpbXBsZW1lbnRhdGlvbiBvZiBgU3ltYm9sLml0ZXJhdG9yYCBzaG91bGQgYmUgZGVjbGFyZWQgaGVyZSwgYnV0IHRoaXMgd291bGQgY2F1c2VcbiAgLy8gdHJlZS1zaGFraW5nIGlzc3VlcyB3aXRoIGBRdWVyeUxpc3QuIFNvIGluc3RlYWQsIGl0J3MgYWRkZWQgaW4gdGhlIGNvbnN0cnVjdG9yIChzZWUgY29tbWVudHNcbiAgLy8gdGhlcmUpIGFuZCB0aGlzIGRlY2xhcmF0aW9uIGlzIGxlZnQgaGVyZSB0byBlbnN1cmUgdGhhdCBUeXBlU2NyaXB0IGNvbnNpZGVycyBRdWVyeUxpc3QgdG9cbiAgLy8gaW1wbGVtZW50IHRoZSBJdGVyYWJsZSBpbnRlcmZhY2UuIFRoaXMgaXMgcmVxdWlyZWQgZm9yIHRlbXBsYXRlIHR5cGUtY2hlY2tpbmcgb2YgTmdGb3IgbG9vcHNcbiAgLy8gb3ZlciBRdWVyeUxpc3RzIHRvIHdvcmsgY29ycmVjdGx5LCBzaW5jZSBRdWVyeUxpc3QgbXVzdCBiZSBhc3NpZ25hYmxlIHRvIE5nSXRlcmFibGUuXG4gIFtTeW1ib2wuaXRlcmF0b3JdITogKCkgPT4gSXRlcmF0b3I8VD47XG59XG4iXX0=