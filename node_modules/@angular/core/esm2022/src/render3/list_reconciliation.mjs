/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { formatRuntimeError } from '../errors';
import { assertNotSame } from '../util/assert';
import { stringifyForError } from './util/stringify_utils';
/**
 * A type representing the live collection to be reconciled with any new (incoming) collection. This
 * is an adapter class that makes it possible to work with different internal data structures,
 * regardless of the actual values of the incoming collection.
 */
export class LiveCollection {
    destroy(item) {
        // noop by default
    }
    updateValue(index, value) {
        // noop by default
    }
    // operations below could be implemented on top of the operations defined so far, but having
    // them explicitly allow clear expression of intent and potentially more performant
    // implementations
    swap(index1, index2) {
        const startIdx = Math.min(index1, index2);
        const endIdx = Math.max(index1, index2);
        const endItem = this.detach(endIdx);
        if (endIdx - startIdx > 1) {
            const startItem = this.detach(startIdx);
            this.attach(startIdx, endItem);
            this.attach(endIdx, startItem);
        }
        else {
            this.attach(startIdx, endItem);
        }
    }
    move(prevIndex, newIdx) {
        this.attach(newIdx, this.detach(prevIndex));
    }
}
function valuesMatching(liveIdx, liveValue, newIdx, newValue, trackBy) {
    if (liveIdx === newIdx && Object.is(liveValue, newValue)) {
        // matching and no value identity to update
        return 1;
    }
    else if (Object.is(trackBy(liveIdx, liveValue), trackBy(newIdx, newValue))) {
        // matching but requires value identity update
        return -1;
    }
    return 0;
}
function recordDuplicateKeys(keyToIdx, key, idx) {
    const idxSoFar = keyToIdx.get(key);
    if (idxSoFar !== undefined) {
        idxSoFar.add(idx);
    }
    else {
        keyToIdx.set(key, new Set([idx]));
    }
}
/**
 * The live collection reconciliation algorithm that perform various in-place operations, so it
 * reflects the content of the new (incoming) collection.
 *
 * The reconciliation algorithm has 2 code paths:
 * - "fast" path that don't require any memory allocation;
 * - "slow" path that requires additional memory allocation for intermediate data structures used to
 * collect additional information about the live collection.
 * It might happen that the algorithm switches between the two modes in question in a single
 * reconciliation path - generally it tries to stay on the "fast" path as much as possible.
 *
 * The overall complexity of the algorithm is O(n + m) for speed and O(n) for memory (where n is the
 * length of the live collection and m is the length of the incoming collection). Given the problem
 * at hand the complexity / performance constraints makes it impossible to perform the absolute
 * minimum of operation to reconcile the 2 collections. The algorithm makes different tradeoffs to
 * stay within reasonable performance bounds and may apply sub-optimal number of operations in
 * certain situations.
 *
 * @param liveCollection the current, live collection;
 * @param newCollection the new, incoming collection;
 * @param trackByFn key generation function that determines equality between items in the life and
 *     incoming collection;
 */
export function reconcile(liveCollection, newCollection, trackByFn) {
    let detachedItems = undefined;
    let liveKeysInTheFuture = undefined;
    let liveStartIdx = 0;
    let liveEndIdx = liveCollection.length - 1;
    const duplicateKeys = ngDevMode ? new Map() : undefined;
    if (Array.isArray(newCollection)) {
        let newEndIdx = newCollection.length - 1;
        while (liveStartIdx <= liveEndIdx && liveStartIdx <= newEndIdx) {
            // compare from the beginning
            const liveStartValue = liveCollection.at(liveStartIdx);
            const newStartValue = newCollection[liveStartIdx];
            if (ngDevMode) {
                recordDuplicateKeys(duplicateKeys, trackByFn(liveStartIdx, newStartValue), liveStartIdx);
            }
            const isStartMatching = valuesMatching(liveStartIdx, liveStartValue, liveStartIdx, newStartValue, trackByFn);
            if (isStartMatching !== 0) {
                if (isStartMatching < 0) {
                    liveCollection.updateValue(liveStartIdx, newStartValue);
                }
                liveStartIdx++;
                continue;
            }
            // compare from the end
            // TODO(perf): do _all_ the matching from the end
            const liveEndValue = liveCollection.at(liveEndIdx);
            const newEndValue = newCollection[newEndIdx];
            if (ngDevMode) {
                recordDuplicateKeys(duplicateKeys, trackByFn(newEndIdx, newEndValue), newEndIdx);
            }
            const isEndMatching = valuesMatching(liveEndIdx, liveEndValue, newEndIdx, newEndValue, trackByFn);
            if (isEndMatching !== 0) {
                if (isEndMatching < 0) {
                    liveCollection.updateValue(liveEndIdx, newEndValue);
                }
                liveEndIdx--;
                newEndIdx--;
                continue;
            }
            // Detect swap and moves:
            const liveStartKey = trackByFn(liveStartIdx, liveStartValue);
            const liveEndKey = trackByFn(liveEndIdx, liveEndValue);
            const newStartKey = trackByFn(liveStartIdx, newStartValue);
            if (Object.is(newStartKey, liveEndKey)) {
                const newEndKey = trackByFn(newEndIdx, newEndValue);
                // detect swap on both ends;
                if (Object.is(newEndKey, liveStartKey)) {
                    liveCollection.swap(liveStartIdx, liveEndIdx);
                    liveCollection.updateValue(liveEndIdx, newEndValue);
                    newEndIdx--;
                    liveEndIdx--;
                }
                else {
                    // the new item is the same as the live item with the end pointer - this is a move forward
                    // to an earlier index;
                    liveCollection.move(liveEndIdx, liveStartIdx);
                }
                liveCollection.updateValue(liveStartIdx, newStartValue);
                liveStartIdx++;
                continue;
            }
            // Fallback to the slow path: we need to learn more about the content of the live and new
            // collections.
            detachedItems ??= new UniqueValueMultiKeyMap();
            liveKeysInTheFuture ??= initLiveItemsInTheFuture(liveCollection, liveStartIdx, liveEndIdx, trackByFn);
            // Check if I'm inserting a previously detached item: if so, attach it here
            if (attachPreviouslyDetached(liveCollection, detachedItems, liveStartIdx, newStartKey)) {
                liveCollection.updateValue(liveStartIdx, newStartValue);
                liveStartIdx++;
                liveEndIdx++;
            }
            else if (!liveKeysInTheFuture.has(newStartKey)) {
                // Check if we seen a new item that doesn't exist in the old collection and must be INSERTED
                const newItem = liveCollection.create(liveStartIdx, newCollection[liveStartIdx]);
                liveCollection.attach(liveStartIdx, newItem);
                liveStartIdx++;
                liveEndIdx++;
            }
            else {
                // We know that the new item exists later on in old collection but we don't know its index
                // and as the consequence can't move it (don't know where to find it). Detach the old item,
                // hoping that it unlocks the fast path again.
                detachedItems.set(liveStartKey, liveCollection.detach(liveStartIdx));
                liveEndIdx--;
            }
        }
        // Final cleanup steps:
        // - more items in the new collection => insert
        while (liveStartIdx <= newEndIdx) {
            createOrAttach(liveCollection, detachedItems, trackByFn, liveStartIdx, newCollection[liveStartIdx]);
            liveStartIdx++;
        }
    }
    else if (newCollection != null) {
        // iterable - immediately fallback to the slow path
        const newCollectionIterator = newCollection[Symbol.iterator]();
        let newIterationResult = newCollectionIterator.next();
        while (!newIterationResult.done && liveStartIdx <= liveEndIdx) {
            const liveValue = liveCollection.at(liveStartIdx);
            const newValue = newIterationResult.value;
            if (ngDevMode) {
                recordDuplicateKeys(duplicateKeys, trackByFn(liveStartIdx, newValue), liveStartIdx);
            }
            const isStartMatching = valuesMatching(liveStartIdx, liveValue, liveStartIdx, newValue, trackByFn);
            if (isStartMatching !== 0) {
                // found a match - move on, but update value
                if (isStartMatching < 0) {
                    liveCollection.updateValue(liveStartIdx, newValue);
                }
                liveStartIdx++;
                newIterationResult = newCollectionIterator.next();
            }
            else {
                detachedItems ??= new UniqueValueMultiKeyMap();
                liveKeysInTheFuture ??= initLiveItemsInTheFuture(liveCollection, liveStartIdx, liveEndIdx, trackByFn);
                // Check if I'm inserting a previously detached item: if so, attach it here
                const newKey = trackByFn(liveStartIdx, newValue);
                if (attachPreviouslyDetached(liveCollection, detachedItems, liveStartIdx, newKey)) {
                    liveCollection.updateValue(liveStartIdx, newValue);
                    liveStartIdx++;
                    liveEndIdx++;
                    newIterationResult = newCollectionIterator.next();
                }
                else if (!liveKeysInTheFuture.has(newKey)) {
                    liveCollection.attach(liveStartIdx, liveCollection.create(liveStartIdx, newValue));
                    liveStartIdx++;
                    liveEndIdx++;
                    newIterationResult = newCollectionIterator.next();
                }
                else {
                    // it is a move forward - detach the current item without advancing in collections
                    const liveKey = trackByFn(liveStartIdx, liveValue);
                    detachedItems.set(liveKey, liveCollection.detach(liveStartIdx));
                    liveEndIdx--;
                }
            }
        }
        // this is a new item as we run out of the items in the old collection - create or attach a
        // previously detached one
        while (!newIterationResult.done) {
            createOrAttach(liveCollection, detachedItems, trackByFn, liveCollection.length, newIterationResult.value);
            newIterationResult = newCollectionIterator.next();
        }
    }
    // Cleanups common to the array and iterable:
    // - more items in the live collection => delete starting from the end;
    while (liveStartIdx <= liveEndIdx) {
        liveCollection.destroy(liveCollection.detach(liveEndIdx--));
    }
    // - destroy items that were detached but never attached again.
    detachedItems?.forEach((item) => {
        liveCollection.destroy(item);
    });
    // report duplicate keys (dev mode only)
    if (ngDevMode) {
        let duplicatedKeysMsg = [];
        for (const [key, idxSet] of duplicateKeys) {
            if (idxSet.size > 1) {
                const idx = [...idxSet].sort((a, b) => a - b);
                for (let i = 1; i < idx.length; i++) {
                    duplicatedKeysMsg.push(`key "${stringifyForError(key)}" at index "${idx[i - 1]}" and "${idx[i]}"`);
                }
            }
        }
        if (duplicatedKeysMsg.length > 0) {
            const message = formatRuntimeError(-955 /* RuntimeErrorCode.LOOP_TRACK_DUPLICATE_KEYS */, 'The provided track expression resulted in duplicated keys for a given collection. ' +
                'Adjust the tracking expression such that it uniquely identifies all the items in the collection. ' +
                'Duplicated keys were: \n' +
                duplicatedKeysMsg.join(', \n') +
                '.');
            // tslint:disable-next-line:no-console
            console.warn(message);
        }
    }
}
function attachPreviouslyDetached(prevCollection, detachedItems, index, key) {
    if (detachedItems !== undefined && detachedItems.has(key)) {
        prevCollection.attach(index, detachedItems.get(key));
        detachedItems.delete(key);
        return true;
    }
    return false;
}
function createOrAttach(liveCollection, detachedItems, trackByFn, index, value) {
    if (!attachPreviouslyDetached(liveCollection, detachedItems, index, trackByFn(index, value))) {
        const newItem = liveCollection.create(index, value);
        liveCollection.attach(index, newItem);
    }
    else {
        liveCollection.updateValue(index, value);
    }
}
function initLiveItemsInTheFuture(liveCollection, start, end, trackByFn) {
    const keys = new Set();
    for (let i = start; i <= end; i++) {
        keys.add(trackByFn(i, liveCollection.at(i)));
    }
    return keys;
}
/**
 * A specific, partial implementation of the Map interface with the following characteristics:
 * - allows multiple values for a given key;
 * - maintain FIFO order for multiple values corresponding to a given key;
 * - assumes that all values are unique.
 *
 * The implementation aims at having the minimal overhead for cases where keys are _not_ duplicated
 * (the most common case in the list reconciliation algorithm). To achieve this, the first value for
 * a given key is stored in a regular map. Then, when more values are set for a given key, we
 * maintain a form of linked list in a separate map. To maintain this linked list we assume that all
 * values (in the entire collection) are unique.
 */
export class UniqueValueMultiKeyMap {
    constructor() {
        // A map from a key to the first value corresponding to this key.
        this.kvMap = new Map();
        // A map that acts as a linked list of values - each value maps to the next value in this "linked
        // list" (this only works if values are unique). Allocated lazily to avoid memory consumption when
        // there are no duplicated values.
        this._vMap = undefined;
    }
    has(key) {
        return this.kvMap.has(key);
    }
    delete(key) {
        if (!this.has(key))
            return false;
        const value = this.kvMap.get(key);
        if (this._vMap !== undefined && this._vMap.has(value)) {
            this.kvMap.set(key, this._vMap.get(value));
            this._vMap.delete(value);
        }
        else {
            this.kvMap.delete(key);
        }
        return true;
    }
    get(key) {
        return this.kvMap.get(key);
    }
    set(key, value) {
        if (this.kvMap.has(key)) {
            let prevValue = this.kvMap.get(key);
            ngDevMode &&
                assertNotSame(prevValue, value, `Detected a duplicated value ${value} for the key ${key}`);
            if (this._vMap === undefined) {
                this._vMap = new Map();
            }
            const vMap = this._vMap;
            while (vMap.has(prevValue)) {
                prevValue = vMap.get(prevValue);
            }
            vMap.set(prevValue, value);
        }
        else {
            this.kvMap.set(key, value);
        }
    }
    forEach(cb) {
        for (let [key, value] of this.kvMap) {
            cb(value, key);
            if (this._vMap !== undefined) {
                const vMap = this._vMap;
                while (vMap.has(value)) {
                    value = vMap.get(value);
                    cb(value, key);
                }
            }
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGlzdF9yZWNvbmNpbGlhdGlvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvcmUvc3JjL3JlbmRlcjMvbGlzdF9yZWNvbmNpbGlhdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFHSCxPQUFPLEVBQUMsa0JBQWtCLEVBQW1CLE1BQU0sV0FBVyxDQUFDO0FBQy9ELE9BQU8sRUFBQyxhQUFhLEVBQUMsTUFBTSxnQkFBZ0IsQ0FBQztBQUU3QyxPQUFPLEVBQUMsaUJBQWlCLEVBQUMsTUFBTSx3QkFBd0IsQ0FBQztBQUV6RDs7OztHQUlHO0FBQ0gsTUFBTSxPQUFnQixjQUFjO0lBTWxDLE9BQU8sQ0FBQyxJQUFPO1FBQ2Isa0JBQWtCO0lBQ3BCLENBQUM7SUFDRCxXQUFXLENBQUMsS0FBYSxFQUFFLEtBQVE7UUFDakMsa0JBQWtCO0lBQ3BCLENBQUM7SUFFRCw0RkFBNEY7SUFDNUYsbUZBQW1GO0lBQ25GLGtCQUFrQjtJQUNsQixJQUFJLENBQUMsTUFBYyxFQUFFLE1BQWM7UUFDakMsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFDMUMsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFDeEMsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUNwQyxJQUFJLE1BQU0sR0FBRyxRQUFRLEdBQUcsQ0FBQyxFQUFFLENBQUM7WUFDMUIsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUN4QyxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsRUFBRSxPQUFPLENBQUMsQ0FBQztZQUMvQixJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRSxTQUFTLENB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LENBQUM7SUFDSCxDQUFDO0NBQ0YiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtUcmFja0J5RnVuY3Rpb259IGZyb20gJy4uL2NoYW5nZV9kZXRlY3Rpb24nO1xuaW1wb3J0IHtmb3JtYXRSdW50aW1lRXJyb3IsIFJ1bnRpbWVFcnJvckNvZGV9IGZyb20gJy4uL2Vycm9ycyc7XG5pbXBvcnQge2Fzc2VydE5vdFNhbWV9IGZyb20gJy4uL3V0aWwvYXNzZXJ0JztcblxuaW1wb3J0IHtzdHJpbmdpZnlGb3JFcnJvcn0gZnJvbSAnLi91dGlsL3N0cmluZ2lmeV91dGlscyc7XG5cbi8qKlxuICogQSB0eXBlIHJlcHJlc2VudGluZyB0aGUgbGl2ZSBjb2xsZWN0aW9uIHRvIGJlIHJlY29uY2lsZWQgd2l0aCBhbnkgbmV3IChpbmNvbWluZykgY29sbGVjdGlvbi4gVGhpc1xuICogaXMgYW4gYWRhcHRlciBjbGFzcyB0aGF0IG1ha2VzIGl0IHBvc3NpYmxlIHRvIHdvcmsgd2l0aCBkaWZmZXJlbnQgaW50ZXJuYWwgZGF0YSBzdHJ1Y3R1cmVzLFxuICogcmVnYXJkbGVzcyBvZiB0aGUgYWN0dWFsIHZhbHVlcyBvZiB0aGUgaW5jb21pbmcgY29sbGVjdGlvbi5cbiAqL1xuZXhwb3J0IGFic3RyYWN0IGNsYXNzIExpdmVDb2xsZWN0aW9uPFQsIFY+IHtcbiAgYWJzdHJhY3QgZ2V0IGxlbmd0aCgpOiBudW1iZXI7XG4gIGFic3RyYWN0IGF0KGluZGV4OiBudW1iZXIpOiBWO1xuICBhYnN0cmFjdCBhdHRhY2goaW5kZXg6IG51bWJlciwgaXRlbTogVCk6IHZvaWQ7XG4gIGFic3RyYWN0IGRldGFjaChpbmRleDogbnVtYmVyKTogVDtcbiAgYWJzdHJhY3QgY3JlYXRlKGluZGV4OiBudW1iZXIsIHZhbHVlOiBWKTogVDtcbiAgZGVzdHJveShpdGVtOiBUKTogdm9pZCB7XG4gICAgLy8gbm9vcCBieSBkZWZhdWx0XG4gIH1cbiAgdXBkYXRlVmFsdWUoaW5kZXg6IG51bWJlciwgdmFsdWU6IFYpOiB2b2lkIHtcbiAgICAvLyBub29wIGJ5IGRlZmF1bHRcbiAgfVxuXG4gIC8vIG9wZXJhdGlvbnMgYmVsb3cgY291bGQgYmUgaW1wbGVtZW50ZWQgb24gdG9wIG9mIHRoZSBvcGVyYXRpb25zIGRlZmluZWQgc28gZmFyLCBidXQgaGF2aW5nXG4gIC8vIHRoZW0gZXhwbGljaXRseSBhbGxvdyBjbGVhciBleHByZXNzaW9uIG9mIGludGVudCBhbmQgcG90ZW50aWFsbHkgbW9yZSBwZXJmb3JtYW50XG4gIC8vIGltcGxlbWVudGF0aW9uc1xuICBzd2FwKGluZGV4MTogbnVtYmVyLCBpbmRleDI6IG51bWJlcik6IHZvaWQge1xuICAgIGNvbnN0IHN0YXJ0SWR4ID0gTWF0aC5taW4oaW5kZXgxLCBpbmRleDIpO1xuICAgIGNvbnN0IGVuZElkeCA9IE1hdGgubWF4KGluZGV4MSwgaW5kZXgyKTtcbiAgICBjb25zdCBlbmRJdGVtID0gdGhpcy5kZXRhY2goZW5kSWR4KTtcbiAgICBpZiAoZW5kSWR4IC0gc3RhcnRJZHggPiAxKSB7XG4gICAgICBjb25zdCBzdGFydEl0ZW0gPSB0aGlzLmRldGFjaChzdGFydElkeCk7XG4gICAgICB0aGlzLmF0dGFjaChzdGFydElkeCwgZW5kSXRlbSk7XG4gICAgICB0aGlzLmF0dGFjaChlbmRJZHgsIHN0YXJ0SXRlbSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuYXR0YWNoKHN0YXJ0SWR4LCBlbmRJdGVtKTtcbiAgICB9XG4gIH1cbiAgbW92ZShwcmV2SW5kZXg6IG51bWJlciwgbmV3SWR4OiBudW1iZXIpOiB2b2lkIHtcbiAgICB0aGlzLmF0dGFjaChuZXdJZHgsIHRoaXMuZGV0YWNoKHByZXZJbmRleCkpO1xuICB9XG59XG5cbmZ1bmN0aW9uIHZhbHVlc01hdGNoaW5nPFY+KFxuICBsaXZlSWR4OiBudW1iZXIsXG4gIGxpdmVWYWx1ZTogVixcbiAgbmV3SWR4OiBudW1iZXIsXG4gIG5ld1ZhbHVlOiBWLFxuICB0cmFja0J5OiBUcmFja0J5RnVuY3Rpb248Vj4sXG4pOiBudW1iZXIge1xuICBpZiAobGl2ZUlkeCA9PT0gbmV3SWR4ICYmIE9iamVjdC5pcyhsaXZlVmFsdWUsIG5ld1ZhbHVlKSkge1xuICAgIC8vIG1hdGNoaW5nIGFuZCBubyB2YWx1ZSBpZGVudGl0eSB0byB1cGRhdGVcbiAgICByZXR1cm4gMTtcbiAgfSBlbHNlIGlmIChPYmplY3QuaXModHJhY2tCeShsaXZlSWR4LCBsaXZlVmFsdWUpLCB0cmFja0J5KG5ld0lkeCwgbmV3VmFsdWUpKSkge1xuICAgIC8vIG1hdGNoaW5nIGJ1dCByZXF1aXJlcyB2YWx1ZSBpZGVudGl0eSB1cGRhdGVcbiAgICByZXR1cm4gLTE7XG4gIH1cblxuICByZXR1cm4gMDtcbn1cblxuZnVuY3Rpb24gcmVjb3JkRHVwbGljYXRlS2V5cyhrZXlUb0lkeDogTWFwPHVua25vd24sIFNldDxudW1iZXI+Piwga2V5OiB1bmtub3duLCBpZHg6IG51bWJlcik6IHZvaWQge1xuICBjb25zdCBpZHhTb0ZhciA9IGtleVRvSWR4LmdldChrZXkpO1xuXG4gIGlmIChpZHhTb0ZhciAhPT0gdW5kZWZpbmVkKSB7XG4gICAgaWR4U29GYXIuYWRkKGlkeCk7XG4gIH0gZWxzZSB7XG4gICAga2V5VG9JZHguc2V0KGtleSwgbmV3IFNldChbaWR4XSkpO1xuICB9XG59XG5cbi8qKlxuICogVGhlIGxpdmUgY29sbGVjdGlvbiByZWNvbmNpbGlhdGlvbiBhbGdvcml0aG0gdGhhdCBwZXJmb3JtIHZhcmlvdXMgaW4tcGxhY2Ugb3BlcmF0aW9ucywgc28gaXRcbiAqIHJlZmxlY3RzIHRoZSBjb250ZW50IG9mIHRoZSBuZXcgKGluY29taW5nKSBjb2xsZWN0aW9uLlxuICpcbiAqIFRoZSByZWNvbmNpbGlhdGlvbiBhbGdvcml0aG0gaGFzIDIgY29kZSBwYXRoczpcbiAqIC0gXCJmYXN0XCIgcGF0aCB0aGF0IGRvbid0IHJlcXVpcmUgYW55IG1lbW9yeSBhbGxvY2F0aW9uO1xuICogLSBcInNsb3dcIiBwYXRoIHRoYXQgcmVxdWlyZXMgYWRkaXRpb25hbCBtZW1vcnkgYWxsb2NhdGlvbiBmb3IgaW50ZXJtZWRpYXRlIGRhdGEgc3RydWN0dXJlcyB1c2VkIHRvXG4gKiBjb2xsZWN0IGFkZGl0aW9uYWwgaW5mb3JtYXRpb24gYWJvdXQgdGhlIGxpdmUgY29sbGVjdGlvbi5cbiAqIEl0IG1pZ2h0IGhhcHBlbiB0aGF0IHRoZSBhbGdvcml0aG0gc3dpdGNoZXMgYmV0d2VlbiB0aGUgdHdvIG1vZGVzIGluIHF1ZXN0aW9uIGluIGEgc2luZ2xlXG4gKiByZWNvbmNpbGlhdGlvbiBwYXRoIC0gZ2VuZXJhbGx5IGl0IHRyaWVzIHRvIHN0YXkgb24gdGhlIFwiZmFzdFwiIHBhdGggYXMgbXVjaCBhcyBwb3NzaWJsZS5cbiAqXG4gKiBUaGUgb3ZlcmFsbCBjb21wbGV4aXR5IG9mIHRoZSBhbGdvcml0aG0gaXMgTyhuICsgbSkgZm9yIHNwZWVkIGFuZCBPKG4pIGZvciBtZW1vcnkgKHdoZXJlIG4gaXMgdGhlXG4gKiBsZW5ndGggb2YgdGhlIGxpdmUgY29sbGVjdGlvbiBhbmQgbSBpcyB0aGUgbGVuZ3RoIG9mIHRoZSBpbmNvbWluZyBjb2xsZWN0aW9uKS4gR2l2ZW4gdGhlIHByb2JsZW1cbiAqIGF0IGhhbmQgdGhlIGNvbXBsZXhpdHkgLyBwZXJmb3JtYW5jZSBjb25zdHJhaW50cyBtYWtlcyBpdCBpbXBvc3NpYmxlIHRvIHBlcmZvcm0gdGhlIGFic29sdXRlXG4gKiBtaW5pbXVtIG9mIG9wZXJhdGlvbiB0byByZWNvbmNpbGUgdGhlIDIgY29sbGVjdGlvbnMuIFRoZSBhbGdvcml0aG0gbWFrZXMgZGlmZmVyZW50IHRyYWRlb2ZmcyB0b1xuICogc3RheSB3aXRoaW4gcmVhc29uYWJsZSBwZXJmb3JtYW5jZSBib3VuZHMgYW5kIG1heSBhcHBseSBzdWItb3B0aW1hbCBudW1iZXIgb2Ygb3BlcmF0aW9ucyBpblxuICogY2VydGFpbiBzaXR1YXRpb25zLlxuICpcbiAqIEBwYXJhbSBsaXZlQ29sbGVjdGlvbiB0aGUgY3VycmVudCwgbGl2ZSBjb2xsZWN0aW9uO1xuICogQHBhcmFtIG5ld0NvbGxlY3Rpb24gdGhlIG5ldywgaW5jb21pbmcgY29sbGVjdGlvbjtcbiAqIEBwYXJhbSB0cmFja0J5Rm4ga2V5IGdlbmVyYXRpb24gZnVuY3Rpb24gdGhhdCBkZXRlcm1pbmVzIGVxdWFsaXR5IGJldHdlZW4gaXRlbXMgaW4gdGhlIGxpZmUgYW5kXG4gKiAgICAgaW5jb21pbmcgY29sbGVjdGlvbjtcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlY29uY2lsZTxULCBWPihcbiAgbGl2ZUNvbGxlY3Rpb246IExpdmVDb2xsZWN0aW9uPFQsIFY+LFxuICBuZXdDb2xsZWN0aW9uOiBJdGVyYWJsZTxWPiB8IHVuZGVmaW5lZCB8IG51bGwsXG4gIHRyYWNrQnlGbjogVHJhY2tCeUZ1bmN0aW9uPFY+LFxuKTogdm9pZCB7XG4gIGxldCBkZXRhY2hlZEl0ZW1zOiBVbmlxdWVWYWx1ZU11bHRpS2V5TWFwPHVua25vd24sIFQ+IHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuICBsZXQgbGl2ZUtleXNJblRoZUZ1dHVyZTogU2V0PHVua25vd24+IHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG4gIGxldCBsaXZlU3RhcnRJZHggPSAwO1xuICBsZXQgbGl2ZUVuZElkeCA9IGxpdmVDb2xsZWN0aW9uLmxlbmd0aCAtIDE7XG5cbiAgY29uc3QgZHVwbGljYXRlS2V5cyA9IG5nRGV2TW9kZSA/IG5ldyBNYXA8dW5rbm93biwgU2V0PG51bWJlcj4+KCkgOiB1bmRlZmluZWQ7XG5cbiAgaWYgKEFycmF5LmlzQXJyYXkobmV3Q29sbGVjdGlvbikpIHtcbiAgICBsZXQgbmV3RW5kSWR4ID0gbmV3Q29sbGVjdGlvbi5sZW5ndGggLSAxO1xuXG4gICAgd2hpbGUgKGxpdmVTdGFydElkeCA8PSBsaXZlRW5kSWR4ICYmIGxpdmVTdGFydElkeCA8PSBuZXdFbmRJZHgpIHtcbiAgICAgIC8vIGNvbXBhcmUgZnJvbSB0aGUgYmVnaW5uaW5nXG4gICAgICBjb25zdCBsaXZlU3RhcnRWYWx1ZSA9IGxpdmVDb2xsZWN0aW9uLmF0KGxpdmVTdGFydElkeCk7XG4gICAgICBjb25zdCBuZXdTdGFydFZhbHVlID0gbmV3Q29sbGVjdGlvbltsaXZlU3RhcnRJZHhdO1xuXG4gICAgICBpZiAobmdEZXZNb2RlKSB7XG4gICAgICAgIHJlY29yZER1cGxpY2F0ZUtleXMoZHVwbGljYXRlS2V5cyEsIHRyYWNrQnlGbihsaXZlU3RhcnRJZHgsIG5ld1N0YXJ0VmFsdWUpLCBsaXZlU3RhcnRJZHgpO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBpc1N0YXJ0TWF0Y2hpbmcgPSB2YWx1ZXNNYXRjaGluZyhcbiAgICAgICAgbGl2ZVN0YXJ0SWR4LFxuICAgICAgICBsaXZlU3RhcnRWYWx1ZSxcbiAgICAgICAgbGl2ZVN0YXJ0SWR4LFxuICAgICAgICBuZXdTdGFydFZhbHVlLFxuICAgICAgICB0cmFja0J5Rm4sXG4gICAgICApO1xuICAgICAgaWYgKGlzU3RhcnRNYXRjaGluZyAhPT0gMCkge1xuICAgICAgICBpZiAoaXNTdGFydE1hdGNoaW5nIDwgMCkge1xuICAgICAgICAgIGxpdmVDb2xsZWN0aW9uLnVwZGF0ZVZhbHVlKGxpdmVTdGFydElkeCwgbmV3U3RhcnRWYWx1ZSk7XG4gICAgICAgIH1cbiAgICAgICAgbGl2ZVN0YXJ0SWR4Kys7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICAvLyBjb21wYXJlIGZyb20gdGhlIGVuZFxuICAgICAgLy8gVE9ETyhwZXJmKTogZG8gX2FsbF8gdGhlIG1hdGNoaW5nIGZyb20gdGhlIGVuZFxuICAgICAgY29uc3QgbGl2ZUVuZFZhbHVlID0gbGl2ZUNvbGxlY3Rpb24uYXQobGl2ZUVuZElkeCk7XG4gICAgICBjb25zdCBuZXdFbmRWYWx1ZSA9IG5ld0NvbGxlY3Rpb25bbmV3RW5kSWR4XTtcblxuICAgICAgaWYgKG5nRGV2TW9kZSkge1xuICAgICAgICByZWNvcmREdXBsaWNhdGVLZXlzKGR1cGxpY2F0ZUtleXMhLCB0cmFja0J5Rm4obmV3RW5kSWR4LCBuZXdFbmRWYWx1ZSksIG5ld0VuZElkeCk7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGlzRW5kTWF0Y2hpbmcgPSB2YWx1ZXNNYXRjaGluZyhcbiAgICAgICAgbGl2ZUVuZElkeCxcbiAgICAgICAgbGl2ZUVuZFZhbHVlLFxuICAgICAgICBuZXdFbmRJZHgsXG4gICAgICAgIG5ld0VuZFZhbHVlLFxuICAgICAgICB0cmFja0J5Rm4sXG4gICAgICApO1xuICAgICAgaWYgKGlzRW5kTWF0Y2hpbmcgIT09IDApIHtcbiAgICAgICAgaWYgKGlzRW5kTWF0Y2hpbmcgPCAwKSB7XG4gICAgICAgICAgbGl2ZUNvbGxlY3Rpb24udXBkYXRlVmFsdWUobGl2ZUVuZElkeCwgbmV3RW5kVmFsdWUpO1xuICAgICAgICB9XG4gICAgICAgIGxpdmVFbmRJZHgtLTtcbiAgICAgICAgbmV3RW5kSWR4LS07XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICAvLyBEZXRlY3Qgc3dhcCBhbmQgbW92ZXM6XG4gICAgICBjb25zdCBsaXZlU3RhcnRLZXkgPSB0cmFja0J5Rm4obGl2ZVN0YXJ0SWR4LCBsaXZlU3RhcnRWYWx1ZSk7XG4gICAgICBjb25zdCBsaXZlRW5kS2V5ID0gdHJhY2tCeUZuKGxpdmVFbmRJZHgsIGxpdmVFbmRWYWx1ZSk7XG4gICAgICBjb25zdCBuZXdTdGFydEtleSA9IHRyYWNrQnlGbihsaXZlU3RhcnRJZHgsIG5ld1N0YXJ0VmFsdWUpO1xuICAgICAgaWYgKE9iamVjdC5pcyhuZXdTdGFydEtleSwgbGl2ZUVuZEtleSkpIHtcbiAgICAgICAgY29uc3QgbmV3RW5kS2V5ID0gdHJhY2tCeUZuKG5ld0VuZElkeCwgbmV3RW5kVmFsdWUpO1xuICAgICAgICAvLyBkZXRlY3Qgc3dhcCBvbiBib3RoIGVuZHM7XG4gICAgICAgIGlmIChPYmplY3QuaXMobmV3RW5kS2V5LCBsaXZlU3RhcnRLZXkpKSB7XG4gICAgICAgICAgbGl2ZUNvbGxlY3Rpb24uc3dhcChsaXZlU3RhcnRJZHgsIGxpdmVFbmRJZHgpO1xuICAgICAgICAgIGxpdmVDb2xsZWN0aW9uLnVwZGF0ZVZhbHVlKGxpdmVFbmRJZHgsIG5ld0VuZFZhbHVlKTtcbiAgICAgICAgICBuZXdFbmRJZHgtLTtcbiAgICAgICAgICBsaXZlRW5kSWR4LS07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gdGhlIG5ldyBpdGVtIGlzIHRoZSBzYW1lIGFzIHRoZSBsaXZlIGl0ZW0gd2l0aCB0aGUgZW5kIHBvaW50ZXIgLSB0aGlzIGlzIGEgbW92ZSBmb3J3YXJkXG4gICAgICAgICAgLy8gdG8gYW4gZWFybGllciBpbmRleDtcbiAgICAgICAgICBsaXZlQ29sbGVjdGlvbi5tb3ZlKGxpdmVFbmRJZHgsIGxpdmVTdGFydElkeCk7XG4gICAgICAgIH1cbiAgICAgICAgbGl2ZUNvbGxlY3Rpb24udXBkYXRlVmFsdWUobGl2ZVN0YXJ0SWR4LCBuZXdTdGFydFZhbHVlKTtcbiAgICAgICAgbGl2ZVN0YXJ0SWR4Kys7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICAvLyBGYWxsYmFjayB0byB0aGUgc2xvdyBwYXRoOiB3ZSBuZWVkIHRvIGxlYXJuIG1vcmUgYWJvdXQgdGhlIGNvbnRlbnQgb2YgdGhlIGxpdmUgYW5kIG5ld1xuICAgICAgLy8gY29sbGVjdGlvbnMuXG4gICAgICBkZXRhY2hlZEl0ZW1zID8/PSBuZXcgVW5pcXVlVmFsdWVNdWx0aUtleU1hcCgpO1xuICAgICAgbGl2ZUtleXNJblRoZUZ1dHVyZSA/Pz0gaW5pdExpdmVJdGVtc0luVGhlRnV0dXJlKFxuICAgICAgICBsaXZlQ29sbGVjdGlvbixcbiAgICAgICAgbGl2ZVN0YXJ0SWR4LFxuICAgICAgICBsaXZlRW5kSWR4LFxuICAgICAgICB0cmFja0J5Rm4sXG4gICAgICApO1xuXG4gICAgICAvLyBDaGVjayBpZiBJJ20gaW5zZXJ0aW5nIGEgcHJldmlvdXNseSBkZXRhY2hlZCBpdGVtOiBpZiBzbywgYXR0YWNoIGl0IGhlcmVcbiAgICAgIGlmIChhdHRhY2hQcmV2aW91c2x5RGV0YWNoZWQobGl2ZUNvbGxlY3Rpb24sIGRldGFjaGVkSXRlbXMsIGxpdmVTdGFydElkeCwgbmV3U3RhcnRLZXkpKSB7XG4gICAgICAgIGxpdmVDb2xsZWN0aW9uLnVwZGF0ZVZhbHVlKGxpdmVTdGFydElkeCwgbmV3U3RhcnRWYWx1ZSk7XG4gICAgICAgIGxpdmVTdGFydElkeCsrO1xuICAgICAgICBsaXZlRW5kSWR4Kys7XG4gICAgICB9IGVsc2UgaWYgKCFsaXZlS2V5c0luVGhlRnV0dXJlLmhhcyhuZXdTdGFydEtleSkpIHtcbiAgICAgICAgLy8gQ2hlY2sgaWYgd2Ugc2VlbiBhIG5ldyBpdGVtIHRoYXQgZG9lc24ndCBleGlzdCBpbiB0aGUgb2xkIGNvbGxlY3Rpb24gYW5kIG11c3QgYmUgSU5TRVJURURcbiAgICAgICAgY29uc3QgbmV3SXRlbSA9IGxpdmVDb2xsZWN0aW9uLmNyZWF0ZShsaXZlU3RhcnRJZHgsIG5ld0NvbGxlY3Rpb25bbGl2ZVN0YXJ0SWR4XSk7XG4gICAgICAgIGxpdmVDb2xsZWN0aW9uLmF0dGFjaChsaXZlU3RhcnRJZHgsIG5ld0l0ZW0pO1xuICAgICAgICBsaXZlU3RhcnRJZHgrKztcbiAgICAgICAgbGl2ZUVuZElkeCsrO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gV2Uga25vdyB0aGF0IHRoZSBuZXcgaXRlbSBleGlzdHMgbGF0ZXIgb24gaW4gb2xkIGNvbGxlY3Rpb24gYnV0IHdlIGRvbid0IGtub3cgaXRzIGluZGV4XG4gICAgICAgIC8vIGFuZCBhcyB0aGUgY29uc2VxdWVuY2UgY2FuJ3QgbW92ZSBpdCAoZG9uJ3Qga25vdyB3aGVyZSB0byBmaW5kIGl0KS4gRGV0YWNoIHRoZSBvbGQgaXRlbSxcbiAgICAgICAgLy8gaG9waW5nIHRoYXQgaXQgdW5sb2NrcyB0aGUgZmFzdCBwYXRoIGFnYWluLlxuICAgICAgICBkZXRhY2hlZEl0ZW1zLnNldChsaXZlU3RhcnRLZXksIGxpdmVDb2xsZWN0aW9uLmRldGFjaChsaXZlU3RhcnRJZHgpKTtcbiAgICAgICAgbGl2ZUVuZElkeC0tO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIEZpbmFsIGNsZWFudXAgc3RlcHM6XG4gICAgLy8gLSBtb3JlIGl0ZW1zIGluIHRoZSBuZXcgY29sbGVjdGlvbiA9PiBpbnNlcnRcbiAgICB3aGlsZSAobGl2ZVN0YXJ0SWR4IDw9IG5ld0VuZElkeCkge1xuICAgICAgY3JlYXRlT3JBdHRhY2goXG4gICAgICAgIGxpdmVDb2xsZWN0aW9uLFxuICAgICAgICBkZXRhY2hlZEl0ZW1zLFxuICAgICAgICB0cmFja0J5Rm4sXG4gICAgICAgIGxpdmVTdGFydElkeCxcbiAgICAgICAgbmV3Q29sbGVjdGlvbltsaXZlU3RhcnRJZHhdLFxuICAgICAgKTtcbiAgICAgIGxpdmVTdGFydElkeCsrO1xuICAgIH1cbiAgfSBlbHNlIGlmIChuZXdDb2xsZWN0aW9uICE9IG51bGwpIHtcbiAgICAvLyBpdGVyYWJsZSAtIGltbWVkaWF0ZWx5IGZhbGxiYWNrIHRvIHRoZSBzbG93IHBhdGhcbiAgICBjb25zdCBuZXdDb2xsZWN0aW9uSXRlcmF0b3IgPSBuZXdDb2xsZWN0aW9uW1N5bWJvbC5pdGVyYXRvcl0oKTtcbiAgICBsZXQgbmV3SXRlcmF0aW9uUmVzdWx0ID0gbmV3Q29sbGVjdGlvbkl0ZXJhdG9yLm5leHQoKTtcbiAgICB3aGlsZSAoIW5ld0l0ZXJhdGlvblJlc3VsdC5kb25lICYmIGxpdmVTdGFydElkeCA8PSBsaXZlRW5kSWR4KSB7XG4gICAgICBjb25zdCBsaXZlVmFsdWUgPSBsaXZlQ29sbGVjdGlvbi5hdChsaXZlU3RhcnRJZHgpO1xuICAgICAgY29uc3QgbmV3VmFsdWUgPSBuZXdJdGVyYXRpb25SZXN1bHQudmFsdWU7XG5cbiAgICAgIGlmIChuZ0Rldk1vZGUpIHtcbiAgICAgICAgcmVjb3JkRHVwbGljYXRlS2V5cyhkdXBsaWNhdGVLZXlzISwgdHJhY2tCeUZuKGxpdmVTdGFydElkeCwgbmV3VmFsdWUpLCBsaXZlU3RhcnRJZHgpO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBpc1N0YXJ0TWF0Y2hpbmcgPSB2YWx1ZXNNYXRjaGluZyhcbiAgICAgICAgbGl2ZVN0YXJ0SWR4LFxuICAgICAgICBsaXZlVmFsdWUsXG4gICAgICAgIGxpdmVTdGFydElkeCxcbiAgICAgICAgbmV3VmFsdWUsXG4gICAgICAgIHRyYWNrQnlGbixcbiAgICAgICk7XG4gICAgICBpZiAoaXNTdGFydE1hdGNoaW5nICE9PSAwKSB7XG4gICAgICAgIC8vIGZvdW5kIGEgbWF0Y2ggLSBtb3ZlIG9uLCBidXQgdXBkYXRlIHZhbHVlXG4gICAgICAgIGlmIChpc1N0YXJ0TWF0Y2hpbmcgPCAwKSB7XG4gICAgICAgICAgbGl2ZUNvbGxlY3Rpb24udXBkYXRlVmFsdWUobGl2ZVN0YXJ0SWR4LCBuZXdWYWx1ZSk7XG4gICAgICAgIH1cbiAgICAgICAgbGl2ZVN0YXJ0SWR4Kys7XG4gICAgICAgIG5ld0l0ZXJhdGlvblJlc3VsdCA9IG5ld0NvbGxlY3Rpb25JdGVyYXRvci5uZXh0KCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBkZXRhY2hlZEl0ZW1zID8/PSBuZXcgVW5pcXVlVmFsdWVNdWx0aUtleU1hcCgpO1xuICAgICAgICBsaXZlS2V5c0luVGhlRnV0dXJlID8/PSBpbml0TGl2ZUl0ZW1zSW5UaGVGdXR1cmUoXG4gICAgICAgICAgbGl2ZUNvbGxlY3Rpb24sXG4gICAgICAgICAgbGl2ZVN0YXJ0SWR4LFxuICAgICAgICAgIGxpdmVFbmRJZHgsXG4gICAgICAgICAgdHJhY2tCeUZuLFxuICAgICAgICApO1xuXG4gICAgICAgIC8vIENoZWNrIGlmIEknbSBpbnNlcnRpbmcgYSBwcmV2aW91c2x5IGRldGFjaGVkIGl0ZW06IGlmIHNvLCBhdHRhY2ggaXQgaGVyZVxuICAgICAgICBjb25zdCBuZXdLZXkgPSB0cmFja0J5Rm4obGl2ZVN0YXJ0SWR4LCBuZXdWYWx1ZSk7XG4gICAgICAgIGlmIChhdHRhY2hQcmV2aW91c2x5RGV0YWNoZWQobGl2ZUNvbGxlY3Rpb24sIGRldGFjaGVkSXRlbXMsIGxpdmVTdGFydElkeCwgbmV3S2V5KSkge1xuICAgICAgICAgIGxpdmVDb2xsZWN0aW9uLnVwZGF0ZVZhbHVlKGxpdmVTdGFydElkeCwgbmV3VmFsdWUpO1xuICAgICAgICAgIGxpdmVTdGFydElkeCsrO1xuICAgICAgICAgIGxpdmVFbmRJZHgrKztcbiAgICAgICAgICBuZXdJdGVyYXRpb25SZXN1bHQgPSBuZXdDb2xsZWN0aW9uSXRlcmF0b3IubmV4dCgpO1xuICAgICAgICB9IGVsc2UgaWYgKCFsaXZlS2V5c0luVGhlRnV0dXJlLmhhcyhuZXdLZXkpKSB7XG4gICAgICAgICAgbGl2ZUNvbGxlY3Rpb24uYXR0YWNoKGxpdmVTdGFydElkeCwgbGl2ZUNvbGxlY3Rpb24uY3JlYXRlKGxpdmVTdGFydElkeCwgbmV3VmFsdWUpKTtcbiAgICAgICAgICBsaXZlU3RhcnRJZHgrKztcbiAgICAgICAgICBsaXZlRW5kSWR4Kys7XG4gICAgICAgICAgbmV3SXRlcmF0aW9uUmVzdWx0ID0gbmV3Q29sbGVjdGlvbkl0ZXJhdG9yLm5leHQoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBpdCBpcyBhIG1vdmUgZm9yd2FyZCAtIGRldGFjaCB0aGUgY3VycmVudCBpdGVtIHdpdGhvdXQgYWR2YW5jaW5nIGluIGNvbGxlY3Rpb25zXG4gICAgICAgICAgY29uc3QgbGl2ZUtleSA9IHRyYWNrQnlGbihsaXZlU3RhcnRJZHgsIGxpdmVWYWx1ZSk7XG4gICAgICAgICAgZGV0YWNoZWRJdGVtcy5zZXQobGl2ZUtleSwgbGl2ZUNvbGxlY3Rpb24uZGV0YWNoKGxpdmVTdGFydElkeCkpO1xuICAgICAgICAgIGxpdmVFbmRJZHgtLTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIC8vIHRoaXMgaXMgYSBuZXcgaXRlbSBhcyB3ZSBydW4gb3V0IG9mIHRoZSBpdGVtcyBpbiB0aGUgb2xkIGNvbGxlY3Rpb24gLSBjcmVhdGUgb3IgYXR0YWNoIGFcbiAgICAvLyBwcmV2aW91c2x5IGRldGFjaGVkIG9uZVxuICAgIHdoaWxlICghbmV3SXRlcmF0aW9uUmVzdWx0LmRvbmUpIHtcbiAgICAgIGNyZWF0ZU9yQXR0YWNoKFxuICAgICAgICBsaXZlQ29sbGVjdGlvbixcbiAgICAgICAgZGV0YWNoZWRJdGVtcyxcbiAgICAgICAgdHJhY2tCeUZuLFxuICAgICAgICBsaXZlQ29sbGVjdGlvbi5sZW5ndGgsXG4gICAgICAgIG5ld0l0ZXJhdGlvblJlc3VsdC52YWx1ZSxcbiAgICAgICk7XG4gICAgICBuZXdJdGVyYXRpb25SZXN1bHQgPSBuZXdDb2xsZWN0aW9uSXRlcmF0b3IubmV4dCgpO1xuICAgIH1cbiAgfVxuXG4gIC8vIENsZWFudXBzIGNvbW1vbiB0byB0aGUgYXJyYXkgYW5kIGl0ZXJhYmxlOlxuICAvLyAtIG1vcmUgaXRlbXMgaW4gdGhlIGxpdmUgY29sbGVjdGlvbiA9PiBkZWxldGUgc3RhcnRpbmcgZnJvbSB0aGUgZW5kO1xuICB3aGlsZSAobGl2ZVN0YXJ0SWR4IDw9IGxpdmVFbmRJZHgpIHtcbiAgICBsaXZlQ29sbGVjdGlvbi5kZXN0cm95KGxpdmVDb2xsZWN0aW9uLmRldGFjaChsaXZlRW5kSWR4LS0pKTtcbiAgfVxuXG4gIC8vIC0gZGVzdHJveSBpdGVtcyB0aGF0IHdlcmUgZGV0YWNoZWQgYnV0IG5ldmVyIGF0dGFjaGVkIGFnYWluLlxuICBkZXRhY2hlZEl0ZW1zPy5mb3JFYWNoKChpdGVtKSA9PiB7XG4gICAgbGl2ZUNvbGxlY3Rpb24uZGVzdHJveShpdGVtKTtcbiAgfSk7XG5cbiAgLy8gcmVwb3J0IGR1cGxpY2F0ZSBrZXlzIChkZXYgbW9kZSBvbmx5KVxuICBpZiAobmdEZXZNb2RlKSB7XG4gICAgbGV0IGR1cGxpY2F0ZWRLZXlzTXNnID0gW107XG4gICAgZm9yIChjb25zdCBba2V5LCBpZHhTZXRdIG9mIGR1cGxpY2F0ZUtleXMhKSB7XG4gICAgICBpZiAoaWR4U2V0LnNpemUgPiAxKSB7XG4gICAgICAgIGNvbnN0IGlkeCA9IFsuLi5pZHhTZXRdLnNvcnQoKGEsIGIpID0+IGEgLSBiKTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDE7IGkgPCBpZHgubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICBkdXBsaWNhdGVkS2V5c01zZy5wdXNoKFxuICAgICAgICAgICAgYGtleSBcIiR7c3RyaW5naWZ5Rm9yRXJyb3Ioa2V5KX1cIiBhdCBpbmRleCBcIiR7aWR4W2kgLSAxXX1cIiBhbmQgXCIke2lkeFtpXX1cImAsXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChkdXBsaWNhdGVkS2V5c01zZy5sZW5ndGggPiAwKSB7XG4gICAgICBjb25zdCBtZXNzYWdlID0gZm9ybWF0UnVudGltZUVycm9yKFxuICAgICAgICBSdW50aW1lRXJyb3JDb2RlLkxPT1BfVFJBQ0tfRFVQTElDQVRFX0tFWVMsXG4gICAgICAgICdUaGUgcHJvdmlkZWQgdHJhY2sgZXhwcmVzc2lvbiByZXN1bHRlZCBpbiBkdXBsaWNhdGVkIGtleXMgZm9yIGEgZ2l2ZW4gY29sbGVjdGlvbi4gJyArXG4gICAgICAgICAgJ0FkanVzdCB0aGUgdHJhY2tpbmcgZXhwcmVzc2lvbiBzdWNoIHRoYXQgaXQgdW5pcXVlbHkgaWRlbnRpZmllcyBhbGwgdGhlIGl0ZW1zIGluIHRoZSBjb2xsZWN0aW9uLiAnICtcbiAgICAgICAgICAnRHVwbGljYXRlZCBrZXlzIHdlcmU6IFxcbicgK1xuICAgICAgICAgIGR1cGxpY2F0ZWRLZXlzTXNnLmpvaW4oJywgXFxuJykgK1xuICAgICAgICAgICcuJyxcbiAgICAgICk7XG5cbiAgICAgIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTpuby1jb25zb2xlXG4gICAgICBjb25zb2xlLndhcm4obWVzc2FnZSk7XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIGF0dGFjaFByZXZpb3VzbHlEZXRhY2hlZDxULCBWPihcbiAgcHJldkNvbGxlY3Rpb246IExpdmVDb2xsZWN0aW9uPFQsIFY+LFxuICBkZXRhY2hlZEl0ZW1zOiBVbmlxdWVWYWx1ZU11bHRpS2V5TWFwPHVua25vd24sIFQ+IHwgdW5kZWZpbmVkLFxuICBpbmRleDogbnVtYmVyLFxuICBrZXk6IHVua25vd24sXG4pOiBib29sZWFuIHtcbiAgaWYgKGRldGFjaGVkSXRlbXMgIT09IHVuZGVmaW5lZCAmJiBkZXRhY2hlZEl0ZW1zLmhhcyhrZXkpKSB7XG4gICAgcHJldkNvbGxlY3Rpb24uYXR0YWNoKGluZGV4LCBkZXRhY2hlZEl0ZW1zLmdldChrZXkpISk7XG4gICAgZGV0YWNoZWRJdGVtcy5kZWxldGUoa2V5KTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuICByZXR1cm4gZmFsc2U7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZU9yQXR0YWNoPFQsIFY+KFxuICBsaXZlQ29sbGVjdGlvbjogTGl2ZUNvbGxlY3Rpb248VCwgVj4sXG4gIGRldGFjaGVkSXRlbXM6IFVuaXF1ZVZhbHVlTXVsdGlLZXlNYXA8dW5rbm93biwgVD4gfCB1bmRlZmluZWQsXG4gIHRyYWNrQnlGbjogVHJhY2tCeUZ1bmN0aW9uPHVua25vd24+LFxuICBpbmRleDogbnVtYmVyLFxuICB2YWx1ZTogVixcbikge1xuICBpZiAoIWF0dGFjaFByZXZpb3VzbHlEZXRhY2hlZChsaXZlQ29sbGVjdGlvbiwgZGV0YWNoZWRJdGVtcywgaW5kZXgsIHRyYWNrQnlGbihpbmRleCwgdmFsdWUpKSkge1xuICAgIGNvbnN0IG5ld0l0ZW0gPSBsaXZlQ29sbGVjdGlvbi5jcmVhdGUoaW5kZXgsIHZhbHVlKTtcbiAgICBsaXZlQ29sbGVjdGlvbi5hdHRhY2goaW5kZXgsIG5ld0l0ZW0pO1xuICB9IGVsc2Uge1xuICAgIGxpdmVDb2xsZWN0aW9uLnVwZGF0ZVZhbHVlKGluZGV4LCB2YWx1ZSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gaW5pdExpdmVJdGVtc0luVGhlRnV0dXJlPFQ+KFxuICBsaXZlQ29sbGVjdGlvbjogTGl2ZUNvbGxlY3Rpb248dW5rbm93biwgdW5rbm93bj4sXG4gIHN0YXJ0OiBudW1iZXIsXG4gIGVuZDogbnVtYmVyLFxuICB0cmFja0J5Rm46IFRyYWNrQnlGdW5jdGlvbjx1bmtub3duPixcbik6IFNldDx1bmtub3duPiB7XG4gIGNvbnN0IGtleXMgPSBuZXcgU2V0KCk7XG4gIGZvciAobGV0IGkgPSBzdGFydDsgaSA8PSBlbmQ7IGkrKykge1xuICAgIGtleXMuYWRkKHRyYWNrQnlGbihpLCBsaXZlQ29sbGVjdGlvbi5hdChpKSkpO1xuICB9XG4gIHJldHVybiBrZXlzO1xufVxuXG4vKipcbiAqIEEgc3BlY2lmaWMsIHBhcnRpYWwgaW1wbGVtZW50YXRpb24gb2YgdGhlIE1hcCBpbnRlcmZhY2Ugd2l0aCB0aGUgZm9sbG93aW5nIGNoYXJhY3RlcmlzdGljczpcbiAqIC0gYWxsb3dzIG11bHRpcGxlIHZhbHVlcyBmb3IgYSBnaXZlbiBrZXk7XG4gKiAtIG1haW50YWluIEZJRk8gb3JkZXIgZm9yIG11bHRpcGxlIHZhbHVlcyBjb3JyZXNwb25kaW5nIHRvIGEgZ2l2ZW4ga2V5O1xuICogLSBhc3N1bWVzIHRoYXQgYWxsIHZhbHVlcyBhcmUgdW5pcXVlLlxuICpcbiAqIFRoZSBpbXBsZW1lbnRhdGlvbiBhaW1zIGF0IGhhdmluZyB0aGUgbWluaW1hbCBvdmVyaGVhZCBmb3IgY2FzZXMgd2hlcmUga2V5cyBhcmUgX25vdF8gZHVwbGljYXRlZFxuICogKHRoZSBtb3N0IGNvbW1vbiBjYXNlIGluIHRoZSBsaXN0IHJlY29uY2lsaWF0aW9uIGFsZ29yaXRobSkuIFRvIGFjaGlldmUgdGhpcywgdGhlIGZpcnN0IHZhbHVlIGZvclxuICogYSBnaXZlbiBrZXkgaXMgc3RvcmVkIGluIGEgcmVndWxhciBtYXAuIFRoZW4sIHdoZW4gbW9yZSB2YWx1ZXMgYXJlIHNldCBmb3IgYSBnaXZlbiBrZXksIHdlXG4gKiBtYWludGFpbiBhIGZvcm0gb2YgbGlua2VkIGxpc3QgaW4gYSBzZXBhcmF0ZSBtYXAuIFRvIG1haW50YWluIHRoaXMgbGlua2VkIGxpc3Qgd2UgYXNzdW1lIHRoYXQgYWxsXG4gKiB2YWx1ZXMgKGluIHRoZSBlbnRpcmUgY29sbGVjdGlvbikgYXJlIHVuaXF1ZS5cbiAqL1xuZXhwb3J0IGNsYXNzIFVuaXF1ZVZhbHVlTXVsdGlLZXlNYXA8SywgVj4ge1xuICAvLyBBIG1hcCBmcm9tIGEga2V5IHRvIHRoZSBmaXJzdCB2YWx1ZSBjb3JyZXNwb25kaW5nIHRvIHRoaXMga2V5LlxuICBwcml2YXRlIGt2TWFwID0gbmV3IE1hcDxLLCBWPigpO1xuICAvLyBBIG1hcCB0aGF0IGFjdHMgYXMgYSBsaW5rZWQgbGlzdCBvZiB2YWx1ZXMgLSBlYWNoIHZhbHVlIG1hcHMgdG8gdGhlIG5leHQgdmFsdWUgaW4gdGhpcyBcImxpbmtlZFxuICAvLyBsaXN0XCIgKHRoaXMgb25seSB3b3JrcyBpZiB2YWx1ZXMgYXJlIHVuaXF1ZSkuIEFsbG9jYXRlZCBsYXppbHkgdG8gYXZvaWQgbWVtb3J5IGNvbnN1bXB0aW9uIHdoZW5cbiAgLy8gdGhlcmUgYXJlIG5vIGR1cGxpY2F0ZWQgdmFsdWVzLlxuICBwcml2YXRlIF92TWFwOiBNYXA8ViwgVj4gfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cbiAgaGFzKGtleTogSyk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLmt2TWFwLmhhcyhrZXkpO1xuICB9XG5cbiAgZGVsZXRlKGtleTogSyk6IGJvb2xlYW4ge1xuICAgIGlmICghdGhpcy5oYXMoa2V5KSkgcmV0dXJuIGZhbHNlO1xuXG4gICAgY29uc3QgdmFsdWUgPSB0aGlzLmt2TWFwLmdldChrZXkpITtcbiAgICBpZiAodGhpcy5fdk1hcCAhPT0gdW5kZWZpbmVkICYmIHRoaXMuX3ZNYXAuaGFzKHZhbHVlKSkge1xuICAgICAgdGhpcy5rdk1hcC5zZXQoa2V5LCB0aGlzLl92TWFwLmdldCh2YWx1ZSkhKTtcbiAgICAgIHRoaXMuX3ZNYXAuZGVsZXRlKHZhbHVlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5rdk1hcC5kZWxldGUoa2V5KTtcbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIGdldChrZXk6IEspOiBWIHwgdW5kZWZpbmVkIHtcbiAgICByZXR1cm4gdGhpcy5rdk1hcC5nZXQoa2V5KTtcbiAgfVxuXG4gIHNldChrZXk6IEssIHZhbHVlOiBWKTogdm9pZCB7XG4gICAgaWYgKHRoaXMua3ZNYXAuaGFzKGtleSkpIHtcbiAgICAgIGxldCBwcmV2VmFsdWUgPSB0aGlzLmt2TWFwLmdldChrZXkpITtcbiAgICAgIG5nRGV2TW9kZSAmJlxuICAgICAgICBhc3NlcnROb3RTYW1lKHByZXZWYWx1ZSwgdmFsdWUsIGBEZXRlY3RlZCBhIGR1cGxpY2F0ZWQgdmFsdWUgJHt2YWx1ZX0gZm9yIHRoZSBrZXkgJHtrZXl9YCk7XG5cbiAgICAgIGlmICh0aGlzLl92TWFwID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgdGhpcy5fdk1hcCA9IG5ldyBNYXAoKTtcbiAgICAgIH1cblxuICAgICAgY29uc3Qgdk1hcCA9IHRoaXMuX3ZNYXA7XG4gICAgICB3aGlsZSAodk1hcC5oYXMocHJldlZhbHVlKSkge1xuICAgICAgICBwcmV2VmFsdWUgPSB2TWFwLmdldChwcmV2VmFsdWUpITtcbiAgICAgIH1cbiAgICAgIHZNYXAuc2V0KHByZXZWYWx1ZSwgdmFsdWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmt2TWFwLnNldChrZXksIHZhbHVlKTtcbiAgICB9XG4gIH1cblxuICBmb3JFYWNoKGNiOiAodjogViwgazogSykgPT4gdm9pZCkge1xuICAgIGZvciAobGV0IFtrZXksIHZhbHVlXSBvZiB0aGlzLmt2TWFwKSB7XG4gICAgICBjYih2YWx1ZSwga2V5KTtcbiAgICAgIGlmICh0aGlzLl92TWFwICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgY29uc3Qgdk1hcCA9IHRoaXMuX3ZNYXA7XG4gICAgICAgIHdoaWxlICh2TWFwLmhhcyh2YWx1ZSkpIHtcbiAgICAgICAgICB2YWx1ZSA9IHZNYXAuZ2V0KHZhbHVlKSE7XG4gICAgICAgICAgY2IodmFsdWUsIGtleSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbiJdfQ==