/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { RuntimeError } from '../../errors';
import { isListLikeIterable, iterateListLike } from '../../util/iterable';
import { stringify } from '../../util/stringify';
export class DefaultIterableDifferFactory {
    constructor() { }
    supports(obj) {
        return isListLikeIterable(obj);
    }
    create(trackByFn) {
        return new DefaultIterableDiffer(trackByFn);
    }
}
const trackByIdentity = (index, item) => item;
/**
 * @deprecated v4.0.0 - Should not be part of public API.
 * @publicApi
 */
export class DefaultIterableDiffer {
    constructor(trackByFn) {
        this.length = 0;
        // Keeps track of the used records at any point in time (during & across `_check()` calls)
        this._linkedRecords = null;
        // Keeps track of the removed records at any point in time during `_check()` calls.
        this._unlinkedRecords = null;
        this._previousItHead = null;
        this._itHead = null;
        this._itTail = null;
        this._additionsHead = null;
        this._additionsTail = null;
        this._movesHead = null;
        this._movesTail = null;
        this._removalsHead = null;
        this._removalsTail = null;
        // Keeps track of records where custom track by is the same, but item identity has changed
        this._identityChangesHead = null;
        this._identityChangesTail = null;
        this._trackByFn = trackByFn || trackByIdentity;
    }
    forEachItem(fn) {
        let record;
        for (record = this._itHead; record !== null; record = record._next) {
            fn(record);
        }
    }
    forEachOperation(fn) {
        let nextIt = this._itHead;
        let nextRemove = this._removalsHead;
        let addRemoveOffset = 0;
        let moveOffsets = null;
        while (nextIt || nextRemove) {
            // Figure out which is the next record to process
            // Order: remove, add, move
            const record = !nextRemove ||
                (nextIt &&
                    nextIt.currentIndex < getPreviousIndex(nextRemove, addRemoveOffset, moveOffsets))
                ? nextIt
                : nextRemove;
            const adjPreviousIndex = getPreviousIndex(record, addRemoveOffset, moveOffsets);
            const currentIndex = record.currentIndex;
            // consume the item, and adjust the addRemoveOffset and update moveDistance if necessary
            if (record === nextRemove) {
                addRemoveOffset--;
                nextRemove = nextRemove._nextRemoved;
            }
            else {
                nextIt = nextIt._next;
                if (record.previousIndex == null) {
                    addRemoveOffset++;
                }
                else {
                    // INVARIANT:  currentIndex < previousIndex
                    if (!moveOffsets)
                        moveOffsets = [];
                    const localMovePreviousIndex = adjPreviousIndex - addRemoveOffset;
                    const localCurrentIndex = currentIndex - addRemoveOffset;
                    if (localMovePreviousIndex != localCurrentIndex) {
                        for (let i = 0; i < localMovePreviousIndex; i++) {
                            const offset = i < moveOffsets.length ? moveOffsets[i] : (moveOffsets[i] = 0);
                            const index = offset + i;
                            if (localCurrentIndex <= index && index < localMovePreviousIndex) {
                                moveOffsets[i] = offset + 1;
                            }
                        }
                        const previousIndex = record.previousIndex;
                        moveOffsets[previousIndex] = localCurrentIndex - localMovePreviousIndex;
                    }
                }
            }
            if (adjPreviousIndex !== currentIndex) {
                fn(record, adjPreviousIndex, currentIndex);
            }
        }
    }
    forEachPreviousItem(fn) {
        let record;
        for (record = this._previousItHead; record !== null; record = record._nextPrevious) {
            fn(record);
        }
    }
    forEachAddedItem(fn) {
        let record;
        for (record = this._additionsHead; record !== null; record = record._nextAdded) {
            fn(record);
        }
    }
    forEachMovedItem(fn) {
        let record;
        for (record = this._movesHead; record !== null; record = record._nextMoved) {
            fn(record);
        }
    }
    forEachRemovedItem(fn) {
        let record;
        for (record = this._removalsHead; record !== null; record = record._nextRemoved) {
            fn(record);
        }
    }
    forEachIdentityChange(fn) {
        let record;
        for (record = this._identityChangesHead; record !== null; record = record._nextIdentityChange) {
            fn(record);
        }
    }
    diff(collection) {
        if (collection == null)
            collection = [];
        if (!isListLikeIterable(collection)) {
            throw new RuntimeError(900 /* RuntimeErrorCode.INVALID_DIFFER_INPUT */, ngDevMode &&
                `Error trying to diff '${stringify(collection)}'. Only arrays and iterables are allowed`);
        }
        if (this.check(collection)) {
            return this;
        }
        else {
            return null;
        }
    }
    onDestroy() { }
    check(collection) {
        this._reset();
        let record = this._itHead;
        let mayBeDirty = false;
        let index;
        let item;
        let itemTrackBy;
        if (Array.isArray(collection)) {
            this.length = collection.length;
            for (let index = 0; index < this.length; index++) {
                item = collection[index];
                itemTrackBy = this._trackByFn(index, item);
                if (record === null || !Object.is(record.trackById, itemTrackBy)) {
                    record = this._mismatch(record, item, itemTrackBy, index);
                    mayBeDirty = true;
                }
                else {
                    if (mayBeDirty) {
                        // TODO(misko): can we limit this to duplicates only?
                        record = this._verifyReinsertion(record, item, itemTrackBy, index);
                    }
                    if (!Object.is(record.item, item))
                        this._addIdentityChange(record, item);
                }
                record = record._next;
            }
        }
        else {
            index = 0;
            iterateListLike(collection, (item) => {
                itemTrackBy = this._trackByFn(index, item);
                if (record === null || !Object.is(record.trackById, itemTrackBy)) {
                    record = this._mismatch(record, item, itemTrackBy, index);
                    mayBeDirty = true;
                }
                else {
                    if (mayBeDirty) {
                        // TODO(misko): can we limit this to duplicates only?
                        record = this._verifyReinsertion(record, item, itemTrackBy, index);
                    }
                    if (!Object.is(record.item, item))
                        this._addIdentityChange(record, item);
                }
                record = record._next;
                index++;
            });
            this.length = index;
        }
        this._truncate(record);
        this.collection = collection;
        return this.isDirty;
    }
    /* CollectionChanges is considered dirty if it has any additions, moves, removals, or identity
     * changes.
     */
    get isDirty() {
        return (this._additionsHead !== null ||
            this._movesHead !== null ||
            this._removalsHead !== null ||
            this._identityChangesHead !== null);
    }
    /**
     * Reset the state of the change objects to show no changes. This means set previousKey to
     * currentKey, and clear all of the queues (additions, moves, removals).
     * Set the previousIndexes of moved and added items to their currentIndexes
     * Reset the list of additions, moves and removals
     *
     * @internal
     */
    _reset() {
        if (this.isDirty) {
            let record;
            for (record = this._previousItHead = this._itHead; record !== null; record = record._next) {
                record._nextPrevious = record._next;
            }
            for (record = this._additionsHead; record !== null; record = record._nextAdded) {
                record.previousIndex = record.currentIndex;
            }
            this._additionsHead = this._additionsTail = null;
            for (record = this._movesHead; record !== null; record = record._nextMoved) {
                record.previousIndex = record.currentIndex;
            }
            this._movesHead = this._movesTail = null;
            this._removalsHead = this._removalsTail = null;
            this._identityChangesHead = this._identityChangesTail = null;
            // TODO(vicb): when assert gets supported
            // assert(!this.isDirty);
        }
    }
    /**
     * This is the core function which handles differences between collections.
     *
     * - `record` is the record which we saw at this position last time. If null then it is a new
     *   item.
     * - `item` is the current item in the collection
     * - `index` is the position of the item in the collection
     *
     * @internal
     */
    _mismatch(record, item, itemTrackBy, index) {
        // The previous record after which we will append the current one.
        let previousRecord;
        if (record === null) {
            previousRecord = this._itTail;
        }
        else {
            previousRecord = record._prev;
            // Remove the record from the collection since we know it does not match the item.
            this._remove(record);
        }
        // See if we have evicted the item, which used to be at some anterior position of _itHead list.
        record = this._unlinkedRecords === null ? null : this._unlinkedRecords.get(itemTrackBy, null);
        if (record !== null) {
            // It is an item which we have evicted earlier: reinsert it back into the list.
            // But first we need to check if identity changed, so we can update in view if necessary.
            if (!Object.is(record.item, item))
                this._addIdentityChange(record, item);
            this._reinsertAfter(record, previousRecord, index);
        }
        else {
            // Attempt to see if the item is at some posterior position of _itHead list.
            record = this._linkedRecords === null ? null : this._linkedRecords.get(itemTrackBy, index);
            if (record !== null) {
                // We have the item in _itHead at/after `index` position. We need to move it forward in the
                // collection.
                // But first we need to check if identity changed, so we can update in view if necessary.
                if (!Object.is(record.item, item))
                    this._addIdentityChange(record, item);
                this._moveAfter(record, previousRecord, index);
            }
            else {
                // It is a new item: add it.
                record = this._addAfter(new IterableChangeRecord_(item, itemTrackBy), previousRecord, index);
            }
        }
        return record;
    }
    /**
     * This check is only needed if an array contains duplicates. (Short circuit of nothing dirty)
     *
     * Use case: `[a, a]` => `[b, a, a]`
     *
     * If we did not have this check then the insertion of `b` would:
     *   1) evict first `a`
     *   2) insert `b` at `0` index.
     *   3) leave `a` at index `1` as is. <-- this is wrong!
     *   3) reinsert `a` at index 2. <-- this is wrong!
     *
     * The correct behavior is:
     *   1) evict first `a`
     *   2) insert `b` at `0` index.
     *   3) reinsert `a` at index 1.
     *   3) move `a` at from `1` to `2`.
     *
     *
     * Double check that we have not evicted a duplicate item. We need to check if the item type may
     * have already been removed:
     * The insertion of b will evict the first 'a'. If we don't reinsert it now it will be reinserted
     * at the end. Which will show up as the two 'a's switching position. This is incorrect, since a
     * better way to think of it is as insert of 'b' rather then switch 'a' with 'b' and then add 'a'
     * at the end.
     *
     * @internal
     */
    _verifyReinsertion(record, item, itemTrackBy, index) {
        let reinsertRecord = this._unlinkedRecords === null ? null : this._unlinkedRecords.get(itemTrackBy, null);
        if (reinsertRecord !== null) {
            record = this._reinsertAfter(reinsertRecord, record._prev, index);
        }
        else if (record.currentIndex != index) {
            record.currentIndex = index;
            this._addToMoves(record, index);
        }
        return record;
    }
    /**
     * Get rid of any excess {@link IterableChangeRecord_}s from the previous collection
     *
     * - `record` The first excess {@link IterableChangeRecord_}.
     *
     * @internal
     */
    _truncate(record) {
        // Anything after that needs to be removed;
        while (record !== null) {
            const nextRecord = record._next;
            this._addToRemovals(this._unlink(record));
            record = nextRecord;
        }
        if (this._unlinkedRecords !== null) {
            this._unlinkedRecords.clear();
        }
        if (this._additionsTail !== null) {
            this._additionsTail._nextAdded = null;
        }
        if (this._movesTail !== null) {
            this._movesTail._nextMoved = null;
        }
        if (this._itTail !== null) {
            this._itTail._next = null;
        }
        if (this._removalsTail !== null) {
            this._removalsTail._nextRemoved = null;
        }
        if (this._identityChangesTail !== null) {
            this._identityChangesTail._nextIdentityChange = null;
        }
    }
    /** @internal */
    _reinsertAfter(record, prevRecord, index) {
        if (this._unlinkedRecords !== null) {
            this._unlinkedRecords.remove(record);
        }
        const prev = record._prevRemoved;
        const next = record._nextRemoved;
        if (prev === null) {
            this._removalsHead = next;
        }
        else {
            prev._nextRemoved = next;
        }
        if (next === null) {
            this._removalsTail = prev;
        }
        else {
            next._prevRemoved = prev;
        }
        this._insertAfter(record, prevRecord, index);
        this._addToMoves(record, index);
        return record;
    }
    /** @internal */
    _moveAfter(record, prevRecord, index) {
        this._unlink(record);
        this._insertAfter(record, prevRecord, index);
        this._addToMoves(record, index);
        return record;
    }
    /** @internal */
    _addAfter(record, prevRecord, index) {
        this._insertAfter(record, prevRecord, index);
        if (this._additionsTail === null) {
            // TODO(vicb):
            // assert(this._additionsHead === null);
            this._additionsTail = this._additionsHead = record;
        }
        else {
            // TODO(vicb):
            // assert(_additionsTail._nextAdded === null);
            // assert(record._nextAdded === null);
            this._additionsTail = this._additionsTail._nextAdded = record;
        }
        return record;
    }
    /** @internal */
    _insertAfter(record, prevRecord, index) {
        // TODO(vicb):
        // assert(record != prevRecord);
        // assert(record._next === null);
        // assert(record._prev === null);
        const next = prevRecord === null ? this._itHead : prevRecord._next;
        // TODO(vicb):
        // assert(next != record);
        // assert(prevRecord != record);
        record._next = next;
        record._prev = prevRecord;
        if (next === null) {
            this._itTail = record;
        }
        else {
            next._prev = record;
        }
        if (prevRecord === null) {
            this._itHead = record;
        }
        else {
            prevRecord._next = record;
        }
        if (this._linkedRecords === null) {
            this._linkedRecords = new _DuplicateMap();
        }
        this._linkedRecords.put(record);
        record.currentIndex = index;
        return record;
    }
    /** @internal */
    _remove(record) {
        return this._addToRemovals(this._unlink(record));
    }
    /** @internal */
    _unlink(record) {
        if (this._linkedRecords !== null) {
            this._linkedRecords.remove(record);
        }
        const prev = record._prev;
        const next = record._next;
        // TODO(vicb):
        // assert((record._prev = null) === null);
        // assert((record._next = null) === null);
        if (prev === null) {
            this._itHead = next;
        }
        else {
            prev._next = next;
        }
        if (next === null) {
            this._itTail = prev;
        }
        else {
            next._prev = prev;
        }
        return record;
    }
    /** @internal */
    _addToMoves(record, toIndex) {
        // TODO(vicb):
        // assert(record._nextMoved === null);
        if (record.previousIndex === toIndex) {
            return record;
        }
        if (this._movesTail === null) {
            // TODO(vicb):
            // assert(_movesHead === null);
            this._movesTail = this._movesHead = record;
        }
        else {
            // TODO(vicb):
            // assert(_movesTail._nextMoved === null);
            this._movesTail = this._movesTail._nextMoved = record;
        }
        return record;
    }
    _addToRemovals(record) {
        if (this._unlinkedRecords === null) {
            this._unlinkedRecords = new _DuplicateMap();
        }
        this._unlinkedRecords.put(record);
        record.currentIndex = null;
        record._nextRemoved = null;
        if (this._removalsTail === null) {
            // TODO(vicb):
            // assert(_removalsHead === null);
            this._removalsTail = this._removalsHead = record;
            record._prevRemoved = null;
        }
        else {
            // TODO(vicb):
            // assert(_removalsTail._nextRemoved === null);
            // assert(record._nextRemoved === null);
            record._prevRemoved = this._removalsTail;
            this._removalsTail = this._removalsTail._nextRemoved = record;
        }
        return record;
    }
    /** @internal */
    _addIdentityChange(record, item) {
        record.item = item;
        if (this._identityChangesTail === null) {
            this._identityChangesTail = this._identityChangesHead = record;
        }
        else {
            this._identityChangesTail = this._identityChangesTail._nextIdentityChange = record;
        }
        return record;
    }
}
export class IterableChangeRecord_ {
    constructor(item, trackById) {
        this.item = item;
        this.trackById = trackById;
        this.currentIndex = null;
        this.previousIndex = null;
        /** @internal */
        this._nextPrevious = null;
        /** @internal */
        this._prev = null;
        /** @internal */
        this._next = null;
        /** @internal */
        this._prevDup = null;
        /** @internal */
        this._nextDup = null;
        /** @internal */
        this._prevRemoved = null;
        /** @internal */
        this._nextRemoved = null;
        /** @internal */
        this._nextAdded = null;
        /** @internal */
        this._nextMoved = null;
        /** @internal */
        this._nextIdentityChange = null;
    }
}
// A linked list of IterableChangeRecords with the same IterableChangeRecord_.item
class _DuplicateItemRecordList {
    constructor() {
        /** @internal */
        this._head = null;
        /** @internal */
        this._tail = null;
    }
    /**
     * Append the record to the list of duplicates.
     *
     * Note: by design all records in the list of duplicates hold the same value in record.item.
     */
    add(record) {
        if (this._head === null) {
            this._head = this._tail = record;
            record._nextDup = null;
            record._prevDup = null;
        }
        else {
            // TODO(vicb):
            // assert(record.item ==  _head.item ||
            //       record.item is num && record.item.isNaN && _head.item is num && _head.item.isNaN);
            this._tail._nextDup = record;
            record._prevDup = this._tail;
            record._nextDup = null;
            this._tail = record;
        }
    }
    // Returns a IterableChangeRecord_ having IterableChangeRecord_.trackById == trackById and
    // IterableChangeRecord_.currentIndex >= atOrAfterIndex
    get(trackById, atOrAfterIndex) {
        let record;
        for (record = this._head; record !== null; record = record._nextDup) {
            if ((atOrAfterIndex === null || atOrAfterIndex <= record.currentIndex) &&
                Object.is(record.trackById, trackById)) {
                return record;
            }
        }
        return null;
    }
    /**
     * Remove one {@link IterableChangeRecord_} from the list of duplicates.
     *
     * Returns whether the list of duplicates is empty.
     */
    remove(record) {
        // TODO(vicb):
        // assert(() {
        //  // verify that the record being removed is in the list.
        //  for (IterableChangeRecord_ cursor = _head; cursor != null; cursor = cursor._nextDup) {
        //    if (identical(cursor, record)) return true;
        //  }
        //  return false;
        //});
        const prev = record._prevDup;
        const next = record._nextDup;
        if (prev === null) {
            this._head = next;
        }
        else {
            prev._nextDup = next;
        }
        if (next === null) {
            this._tail = prev;
        }
        else {
            next._prevDup = prev;
        }
        return this._head === null;
    }
}
class _DuplicateMap {
    constructor() {
        this.map = new Map();
    }
    put(record) {
        const key = record.trackById;
        let duplicates = this.map.get(key);
        if (!duplicates) {
            duplicates = new _DuplicateItemRecordList();
            this.map.set(key, duplicates);
        }
        duplicates.add(record);
    }
    /**
     * Retrieve the `value` using key. Because the IterableChangeRecord_ value may be one which we
     * have already iterated over, we use the `atOrAfterIndex` to pretend it is not there.
     *
     * Use case: `[a, b, c, a, a]` if we are at index `3` which is the second `a` then asking if we
     * have any more `a`s needs to return the second `a`.
     */
    get(trackById, atOrAfterIndex) {
        const key = trackById;
        const recordList = this.map.get(key);
        return recordList ? recordList.get(trackById, atOrAfterIndex) : null;
    }
    /**
     * Removes a {@link IterableChangeRecord_} from the list of duplicates.
     *
     * The list of duplicates also is removed from the map if it gets empty.
     */
    remove(record) {
        const key = record.trackById;
        const recordList = this.map.get(key);
        // Remove the list of duplicates when it gets empty
        if (recordList.remove(record)) {
            this.map.delete(key);
        }
        return record;
    }
    get isEmpty() {
        return this.map.size === 0;
    }
    clear() {
        this.map.clear();
    }
}
function getPreviousIndex(item, addRemoveOffset, moveOffsets) {
    const previousIndex = item.previousIndex;
    if (previousIndex === null)
        return previousIndex;
    let moveOffset = 0;
    if (moveOffsets && previousIndex < moveOffsets.length) {
        moveOffset = moveOffsets[previousIndex];
    }
    return previousIndex + addRemoveOffset + moveOffset;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVmYXVsdF9pdGVyYWJsZV9kaWZmZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb3JlL3NyYy9jaGFuZ2VfZGV0ZWN0aW9uL2RpZmZlcnMvZGVmYXVsdF9pdGVyYWJsZV9kaWZmZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUFDLFlBQVksRUFBbUIsTUFBTSxjQUFjLENBQUM7QUFFNUQsT0FBTyxFQUFDLGtCQUFrQixFQUFFLGVBQWUsRUFBQyxNQUFNLHFCQUFxQixDQUFDO0FBQ3hFLE9BQU8sRUFBQyxTQUFTLEVBQUMsTUFBTSxzQkFBc0IsQ0FBQztBQVcvQyxNQUFNLE9BQU8sNEJBQTRCO0lBQ3ZDLGdCQUFlLENBQUM7SUFDaEIsUUFBUSxDQUFDLEdBQThCO1FBQ3JDLE9BQU8sa0JBQWtCLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDakMsQ0FBQztJQUVELE1BQU0sQ0FBSSxTQUE4QjtRQUN0QyxPQUFPLElBQUkscUJBQXFCLENBQUksU0FBUyxDQUFDLENBQUM7SUFDakQsQ0FBQztDQUNGO0FBRUQsTUFBTSxlQUFlLEdBQUcsQ0FBQyxLQUFhLEVBQUUsSUFBUyxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUM7QUFFM0Q7OztHQUdHO0FBQ0gsTUFBTSxPQUFPLHFCQUFxQjtJQXNCaEMsWUFBWSxTQUE4QjtRQXJCMUIsV0FBTSxHQUFXLENBQUMsQ0FBQztRQUduQywwRkFBMEY7UUFDbEYsbUJBQWMsR0FBNEIsSUFBSSxDQUFDO1FBQ3ZELG1GQUFtRjtRQUMzRSxxQkFBZ0IsR0FBNEIsSUFBSSxDQUFDO1FBQ2pELG9CQUFlLEdBQW9DLElBQUksQ0FBQztRQUN4RCxZQUFPLEdBQW9DLElBQUksQ0FBQztRQUNoRCxZQUFPLEdBQW9DLElBQUksQ0FBQztRQUNoRCxtQkFBYyxHQUFvQyxJQUFJLENBQUM7UUFDdkQsbUJBQWMsR0FBb0MsSUFB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LE9BQU87UUFDVCxPQUFPLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxLQUFLLENBQUMsQ0FBQztJQUM3QixDQUFDO0lBRUQsS0FBSztRQUNILElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxFQUFFLENBQUM7SUFDbkIsQ0FBQztDQUNGO0FBRUQsU0FBUyxnQkFBZ0IsQ0FDdkIsSUFBUyxFQUNULGVBQXVCLEVBQ3ZCLFdBQTRCO0lBRTVCLE1BQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxhQUFhLENBQUM7SUFDekMsSUFBSSxhQUFhLEtBQUssSUFBSTtRQUFFLE9BQU8sYUFBYSxDQUFDO0lBQ2pELElBQUksVUFBVSxHQUFHLENBQUMsQ0FBQztJQUNuQixJQUFJLFdBQVcsSUFBSSxhQUFhLEdBQUcsV0FBVyxDQUFDLE1BQU0sRUFBRSxDQUFDO1FBQ3RELFVBQVUsR0FBRyxXQUFXLENBQUMsYUFBYSxDQUFDLENBQUM7SUFDMUMsQ0FBQztJQUNELE9BQU8sYUFBYSxHQUFHLGVBQWUsR0FBRyxVQUFVLENBQUM7QUFDdEQsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge1J1bnRpbWVFcnJvciwgUnVudGltZUVycm9yQ29kZX0gZnJvbSAnLi4vLi4vZXJyb3JzJztcbmltcG9ydCB7V3JpdGFibGV9IGZyb20gJy4uLy4uL2ludGVyZmFjZS90eXBlJztcbmltcG9ydCB7aXNMaXN0TGlrZUl0ZXJhYmxlLCBpdGVyYXRlTGlzdExpa2V9IGZyb20gJy4uLy4uL3V0aWwvaXRlcmFibGUnO1xuaW1wb3J0IHtzdHJpbmdpZnl9IGZyb20gJy4uLy4uL3V0aWwvc3RyaW5naWZ5JztcblxuaW1wb3J0IHtcbiAgSXRlcmFibGVDaGFuZ2VSZWNvcmQsXG4gIEl0ZXJhYmxlQ2hhbmdlcyxcbiAgSXRlcmFibGVEaWZmZXIsXG4gIEl0ZXJhYmxlRGlmZmVyRmFjdG9yeSxcbiAgTmdJdGVyYWJsZSxcbiAgVHJhY2tCeUZ1bmN0aW9uLFxufSBmcm9tICcuL2l0ZXJhYmxlX2RpZmZlcnMnO1xuXG5leHBvcnQgY2xhc3MgRGVmYXVsdEl0ZXJhYmxlRGlmZmVyRmFjdG9yeSBpbXBsZW1lbnRzIEl0ZXJhYmxlRGlmZmVyRmFjdG9yeSB7XG4gIGNvbnN0cnVjdG9yKCkge31cbiAgc3VwcG9ydHMob2JqOiBPYmplY3QgfCBudWxsIHwgdW5kZWZpbmVkKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGlzTGlzdExpa2VJdGVyYWJsZShvYmopO1xuICB9XG5cbiAgY3JlYXRlPFY+KHRyYWNrQnlGbj86IFRyYWNrQnlGdW5jdGlvbjxWPik6IERlZmF1bHRJdGVyYWJsZURpZmZlcjxWPiB7XG4gICAgcmV0dXJuIG5ldyBEZWZhdWx0SXRlcmFibGVEaWZmZXI8Vj4odHJhY2tCeUZuKTtcbiAgfVxufVxuXG5jb25zdCB0cmFja0J5SWRlbnRpdHkgPSAoaW5kZXg6IG51bWJlciwgaXRlbTogYW55KSA9PiBpdGVtO1xuXG4vKipcbiAqIEBkZXByZWNhdGVkIHY0LjAuMCAtIFNob3VsZCBub3QgYmUgcGFydCBvZiBwdWJsaWMgQVBJLlxuICogQHB1YmxpY0FwaVxuICovXG5leHBvcnQgY2xhc3MgRGVmYXVsdEl0ZXJhYmxlRGlmZmVyPFY+IGltcGxlbWVudHMgSXRlcmFibGVEaWZmZXI8Vj4sIEl0ZXJhYmxlQ2hhbmdlczxWPiB7XG4gIHB1YmxpYyByZWFkb25seSBsZW5ndGg6IG51bWJlciA9IDA7XG4gIC8vIFRPRE86IGNvbmZpcm0gdGhlIHVzYWdlIG9mIGBjb2xsZWN0aW9uYCBhcyBpdCdzIHVudXNlZCwgcmVhZG9ubHkgYW5kIG9uIGEgbm9uIHB1YmxpYyBBUEkuXG4gIHB1YmxpYyByZWFkb25seSBjb2xsZWN0aW9uITogVltdIHwgSXRlcmFibGU8Vj4gfCBudWxsO1xuICAvLyBLZWVwcyB0cmFjayBvZiB0aGUgdXNlZCByZWNvcmRzIGF0IGFueSBwb2ludCBpbiB0aW1lIChkdXJpbmcgJiBhY3Jvc3MgYF9jaGVjaygpYCBjYWxscylcbiAgcHJpdmF0ZSBfbGlua2VkUmVjb3JkczogX0R1cGxpY2F0ZU1hcDxWPiB8IG51bGwgPSBudWxsO1xuICAvLyBLZWVwcyB0cmFjayBvZiB0aGUgcmVtb3ZlZCByZWNvcmRzIGF0IGFueSBwb2ludCBpbiB0aW1lIGR1cmluZyBgX2NoZWNrKClgIGNhbGxzLlxuICBwcml2YXRlIF91bmxpbmtlZFJlY29yZHM6IF9EdXBsaWNhdGVNYXA8Vj4gfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBfcHJldmlvdXNJdEhlYWQ6IEl0ZXJhYmxlQ2hhbmdlUmVjb3JkXzxWPiB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIF9pdEhlYWQ6IEl0ZXJhYmxlQ2hhbmdlUmVjb3JkXzxWPiB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIF9pdFRhaWw6IEl0ZXJhYmxlQ2hhbmdlUmVjb3JkXzxWPiB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIF9hZGRpdGlvbnNIZWFkOiBJdGVyYWJsZUNoYW5nZVJlY29yZF88Vj4gfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBfYWRkaXRpb25zVGFpbDogSXRlcmFibGVDaGFuZ2VSZWNvcmRfPFY+IHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgX21vdmVzSGVhZDogSXRlcmFibGVDaGFuZ2VSZWNvcmRfPFY+IHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgX21vdmVzVGFpbDogSXRlcmFibGVDaGFuZ2VSZWNvcmRfPFY+IHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgX3JlbW92YWxzSGVhZDogSXRlcmFibGVDaGFuZ2VSZWNvcmRfPFY+IHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgX3JlbW92YWxzVGFpbDogSXRlcmFibGVDaGFuZ2VSZWNvcmRfPFY+IHwgbnVsbCA9IG51bGw7XG4gIC8vIEtlZXBzIHRyYWNrIG9mIHJlY29yZHMgd2hlcmUgY3VzdG9tIHRyYWNrIGJ5IGlzIHRoZSBzYW1lLCBidXQgaXRlbSBpZGVudGl0eSBoYXMgY2hhbmdlZFxuICBwcml2YXRlIF9pZGVudGl0eUNoYW5nZXNIZWFkOiBJdGVyYWJsZUNoYW5nZVJlY29yZF88Vj4gfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBfaWRlbnRpdHlDaGFuZ2VzVGFpbDogSXRlcmFibGVDaGFuZ2VSZWNvcmRfPFY+IHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgX3RyYWNrQnlGbjogVHJhY2tCeUZ1bmN0aW9uPFY+O1xuXG4gIGNvbnN0cnVjdG9yKHRyYWNrQnlGbj86IFRyYWNrQnlGdW5jdGlvbjxWPikge1xuICAgIHRoaXMuX3RyYWNrQnlGbiA9IHRyYWNrQnlGbiB8fCB0cmFja0J5SWRlbnRpdHk7XG4gIH1cblxuICBmb3JFYWNoSXRlbShmbjogKHJlY29yZDogSXRlcmFibGVDaGFuZ2VSZWNvcmRfPFY+KSA9PiB2b2lkKSB7XG4gICAgbGV0IHJlY29yZDogSXRlcmFibGVDaGFuZ2VSZWNvcmRfPFY+IHwgbnVsbDtcbiAgICBmb3IgKHJlY29yZCA9IHRoaXMuX2l0SGVhZDsgcmVjb3JkICE9PSBudWxsOyByZWNvcmQgPSByZWNvcmQuX25leHQpIHtcbiAgICAgIGZuKHJlY29yZCk7XG4gICAgfVxuICB9XG5cbiAgZm9yRWFjaE9wZXJhdGlvbihcbiAgICBmbjogKFxuICAgICAgaXRlbTogSXRlcmFibGVDaGFuZ2VSZWNvcmQ8Vj4sXG4gICAgICBwcmV2aW91c0luZGV4OiBudW1iZXIgfCBudWxsLFxuICAgICAgY3VycmVudEluZGV4OiBudW1iZXIgfCBudWxsLFxuICAgICkgPT4gdm9pZCxcbiAgKSB7XG4gICAgbGV0IG5leHRJdCA9IHRoaXMuX2l0SGVhZDtcbiAgICBsZXQgbmV4dFJlbW92ZSA9IHRoaXMuX3JlbW92YWxzSGVhZDtcbiAgICBsZXQgYWRkUmVtb3ZlT2Zmc2V0ID0gMDtcbiAgICBsZXQgbW92ZU9mZnNldHM6IG51bWJlcltdIHwgbnVsbCA9IG51bGw7XG4gICAgd2hpbGUgKG5leHRJdCB8fCBuZXh0UmVtb3ZlKSB7XG4gICAgICAvLyBGaWd1cmUgb3V0IHdoaWNoIGlzIHRoZSBuZXh0IHJlY29yZCB0byBwcm9jZXNzXG4gICAgICAvLyBPcmRlcjogcmVtb3ZlLCBhZGQsIG1vdmVcbiAgICAgIGNvbnN0IHJlY29yZDogSXRlcmFibGVDaGFuZ2VSZWNvcmQ8Vj4gPVxuICAgICAgICAhbmV4dFJlbW92ZSB8fFxuICAgICAgICAobmV4dEl0ICYmXG4gICAgICAgICAgbmV4dEl0LmN1cnJlbnRJbmRleCEgPCBnZXRQcmV2aW91c0luZGV4KG5leHRSZW1vdmUsIGFkZFJlbW92ZU9mZnNldCwgbW92ZU9mZnNldHMpKVxuICAgICAgICAgID8gbmV4dEl0IVxuICAgICAgICAgIDogbmV4dFJlbW92ZTtcbiAgICAgIGNvbnN0IGFkalByZXZpb3VzSW5kZXggPSBnZXRQcmV2aW91c0luZGV4KHJlY29yZCwgYWRkUmVtb3ZlT2Zmc2V0LCBtb3ZlT2Zmc2V0cyk7XG4gICAgICBjb25zdCBjdXJyZW50SW5kZXggPSByZWNvcmQuY3VycmVudEluZGV4O1xuXG4gICAgICAvLyBjb25zdW1lIHRoZSBpdGVtLCBhbmQgYWRqdXN0IHRoZSBhZGRSZW1vdmVPZmZzZXQgYW5kIHVwZGF0ZSBtb3ZlRGlzdGFuY2UgaWYgbmVjZXNzYXJ5XG4gICAgICBpZiAocmVjb3JkID09PSBuZXh0UmVtb3ZlKSB7XG4gICAgICAgIGFkZFJlbW92ZU9mZnNldC0tO1xuICAgICAgICBuZXh0UmVtb3ZlID0gbmV4dFJlbW92ZS5fbmV4dFJlbW92ZWQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBuZXh0SXQgPSBuZXh0SXQhLl9uZXh0O1xuICAgICAgICBpZiAocmVjb3JkLnByZXZpb3VzSW5kZXggPT0gbnVsbCkge1xuICAgICAgICAgIGFkZFJlbW92ZU9mZnNldCsrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIElOVkFSSUFOVDogIGN1cnJlbnRJbmRleCA8IHByZXZpb3VzSW5kZXhcbiAgICAgICAgICBpZiAoIW1vdmVPZmZzZXRzKSBtb3ZlT2Zmc2V0cyA9IFtdO1xuICAgICAgICAgIGNvbnN0IGxvY2FsTW92ZVByZXZpb3VzSW5kZXggPSBhZGpQcmV2aW91c0luZGV4IC0gYWRkUmVtb3ZlT2Zmc2V0O1xuICAgICAgICAgIGNvbnN0IGxvY2FsQ3VycmVudEluZGV4ID0gY3VycmVudEluZGV4ISAtIGFkZFJlbW92ZU9mZnNldDtcbiAgICAgICAgICBpZiAobG9jYWxNb3ZlUHJldmlvdXNJbmRleCAhPSBsb2NhbEN1cnJlbnRJbmRleCkge1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsb2NhbE1vdmVQcmV2aW91c0luZGV4OyBpKyspIHtcbiAgICAgICAgICAgICAgY29uc3Qgb2Zmc2V0ID0gaSA8IG1vdmVPZmZzZXRzLmxlbmd0aCA/IG1vdmVPZmZzZXRzW2ldIDogKG1vdmVPZmZzZXRzW2ldID0gMCk7XG4gICAgICAgICAgICAgIGNvbnN0IGluZGV4ID0gb2Zmc2V0ICsgaTtcbiAgICAgICAgICAgICAgaWYgKGxvY2FsQ3VycmVudEluZGV4IDw9IGluZGV4ICYmIGluZGV4IDwgbG9jYWxNb3ZlUHJldmlvdXNJbmRleCkge1xuICAgICAgICAgICAgICAgIG1vdmVPZmZzZXRzW2ldID0gb2Zmc2V0ICsgMTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgcHJldmlvdXNJbmRleCA9IHJlY29yZC5wcmV2aW91c0luZGV4O1xuICAgICAgICAgICAgbW92ZU9mZnNldHNbcHJldmlvdXNJbmRleF0gPSBsb2NhbEN1cnJlbnRJbmRleCAtIGxvY2FsTW92ZVByZXZpb3VzSW5kZXg7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChhZGpQcmV2aW91c0luZGV4ICE9PSBjdXJyZW50SW5kZXgpIHtcbiAgICAgICAgZm4ocmVjb3JkLCBhZGpQcmV2aW91c0luZGV4LCBjdXJyZW50SW5kZXgpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGZvckVhY2hQcmV2aW91c0l0ZW0oZm46IChyZWNvcmQ6IEl0ZXJhYmxlQ2hhbmdlUmVjb3JkXzxWPikgPT4gdm9pZCkge1xuICAgIGxldCByZWNvcmQ6IEl0ZXJhYmxlQ2hhbmdlUmVjb3JkXzxWPiB8IG51bGw7XG4gICAgZm9yIChyZWNvcmQgPSB0aGlzLl9wcmV2aW91c0l0SGVhZDsgcmVjb3JkICE9PSBudWxsOyByZWNvcmQgPSByZWNvcmQuX25leHRQcmV2aW91cykge1xuICAgICAgZm4ocmVjb3JkKTtcbiAgICB9XG4gIH1cblxuICBmb3JFYWNoQWRkZWRJdGVtKGZuOiAocmVjb3JkOiBJdGVyYWJsZUNoYW5nZVJlY29yZF88Vj4pID0+IHZvaWQpIHtcbiAgICBsZXQgcmVjb3JkOiBJdGVyYWJsZUNoYW5nZVJlY29yZF88Vj4gfCBudWxsO1xuICAgIGZvciAocmVjb3JkID0gdGhpcy5fYWRkaXRpb25zSGVhZDsgcmVjb3JkICE9PSBudWxsOyByZWNvcmQgPSByZWNvcmQuX25leHRBZGRlZCkge1xuICAgICAgZm4ocmVjb3JkKTtcbiAgICB9XG4gIH1cblxuICBmb3JFYWNoTW92ZWRJdGVtKGZuOiAocmVjb3JkOiBJdGVyYWJsZUNoYW5nZVJlY29yZF88Vj4pID0+IHZvaWQpIHtcbiAgICBsZXQgcmVjb3JkOiBJdGVyYWJsZUNoYW5nZVJlY29yZF88Vj4gfCBudWxsO1xuICAgIGZvciAocmVjb3JkID0gdGhpcy5fbW92ZXNIZWFkOyByZWNvcmQgIT09IG51bGw7IHJlY29yZCA9IHJlY29yZC5fbmV4dE1vdmVkKSB7XG4gICAgICBmbihyZWNvcmQpO1xuICAgIH1cbiAgfVxuXG4gIGZvckVhY2hSZW1vdmVkSXRlbShmbjogKHJlY29yZDogSXRlcmFibGVDaGFuZ2VSZWNvcmRfPFY+KSA9PiB2b2lkKSB7XG4gICAgbGV0IHJlY29yZDogSXRlcmFibGVDaGFuZ2VSZWNvcmRfPFY+IHwgbnVsbDtcbiAgICBmb3IgKHJlY29yZCA9IHRoaXMuX3JlbW92YWxzSGVhZDsgcmVjb3JkICE9PSBudWxsOyByZWNvcmQgPSByZWNvcmQuX25leHRSZW1vdmVkKSB7XG4gICAgICBmbihyZWNvcmQpO1xuICAgIH1cbiAgfVxuXG4gIGZvckVhY2hJZGVudGl0eUNoYW5nZShmbjogKHJlY29yZDogSXRlcmFibGVDaGFuZ2VSZWNvcmRfPFY+KSA9PiB2b2lkKSB7XG4gICAgbGV0IHJlY29yZDogSXRlcmFibGVDaGFuZ2VSZWNvcmRfPFY+IHwgbnVsbDtcbiAgICBmb3IgKHJlY29yZCA9IHRoaXMuX2lkZW50aXR5Q2hhbmdlc0hlYWQ7IHJlY29yZCAhPT0gbnVsbDsgcmVjb3JkID0gcmVjb3JkLl9uZXh0SWRlbnRpdHlDaGFuZ2UpIHtcbiAgICAgIGZuKHJlY29yZCk7XG4gICAgfVxuICB9XG5cbiAgZGlmZihjb2xsZWN0aW9uOiBOZ0l0ZXJhYmxlPFY+IHwgbnVsbCB8IHVuZGVmaW5lZCk6IERlZmF1bHRJdGVyYWJsZURpZmZlcjxWPiB8IG51bGwge1xuICAgIGlmIChjb2xsZWN0aW9uID09IG51bGwpIGNvbGxlY3Rpb24gPSBbXTtcbiAgICBpZiAoIWlzTGlzdExpa2VJdGVyYWJsZShjb2xsZWN0aW9uKSkge1xuICAgICAgdGhyb3cgbmV3IFJ1bnRpbWVFcnJvcihcbiAgICAgICAgUnVudGltZUVycm9yQ29kZS5JTlZBTElEX0RJRkZFUl9JTlBVVCxcbiAgICAgICAgbmdEZXZNb2RlICYmXG4gICAgICAgICAgYEVycm9yIHRyeWluZyB0byBkaWZmICcke3N0cmluZ2lmeShjb2xsZWN0aW9uKX0nLiBPbmx5IGFycmF5cyBhbmQgaXRlcmFibGVzIGFyZSBhbGxvd2VkYCxcbiAgICAgICk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuY2hlY2soY29sbGVjdGlvbikpIHtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cblxuICBvbkRlc3Ryb3koKSB7fVxuXG4gIGNoZWNrKGNvbGxlY3Rpb246IE5nSXRlcmFibGU8Vj4pOiBib29sZWFuIHtcbiAgICB0aGlzLl9yZXNldCgpO1xuXG4gICAgbGV0IHJlY29yZDogSXRlcmFibGVDaGFuZ2VSZWNvcmRfPFY+IHwgbnVsbCA9IHRoaXMuX2l0SGVhZDtcbiAgICBsZXQgbWF5QmVEaXJ0eTogYm9vbGVhbiA9IGZhbHNlO1xuICAgIGxldCBpbmRleDogbnVtYmVyO1xuICAgIGxldCBpdGVtOiBWO1xuICAgIGxldCBpdGVtVHJhY2tCeTogYW55O1xuICAgIGlmIChBcnJheS5pc0FycmF5KGNvbGxlY3Rpb24pKSB7XG4gICAgICAodGhpcyBhcyBXcml0YWJsZTx0aGlzPikubGVuZ3RoID0gY29sbGVjdGlvbi5sZW5ndGg7XG5cbiAgICAgIGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCB0aGlzLmxlbmd0aDsgaW5kZXgrKykge1xuICAgICAgICBpdGVtID0gY29sbGVjdGlvbltpbmRleF07XG4gICAgICAgIGl0ZW1UcmFja0J5ID0gdGhpcy5fdHJhY2tCeUZuKGluZGV4LCBpdGVtKTtcbiAgICAgICAgaWYgKHJlY29yZCA9PT0gbnVsbCB8fCAhT2JqZWN0LmlzKHJlY29yZC50cmFja0J5SWQsIGl0ZW1UcmFja0J5KSkge1xuICAgICAgICAgIHJlY29yZCA9IHRoaXMuX21pc21hdGNoKHJlY29yZCwgaXRlbSwgaXRlbVRyYWNrQnksIGluZGV4KTtcbiAgICAgICAgICBtYXlCZURpcnR5ID0gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBpZiAobWF5QmVEaXJ0eSkge1xuICAgICAgICAgICAgLy8gVE9ETyhtaXNrbyk6IGNhbiB3ZSBsaW1pdCB0aGlzIHRvIGR1cGxpY2F0ZXMgb25seT9cbiAgICAgICAgICAgIHJlY29yZCA9IHRoaXMuX3ZlcmlmeVJlaW5zZXJ0aW9uKHJlY29yZCwgaXRlbSwgaXRlbVRyYWNrQnksIGluZGV4KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKCFPYmplY3QuaXMocmVjb3JkLml0ZW0sIGl0ZW0pKSB0aGlzLl9hZGRJZGVudGl0eUNoYW5nZShyZWNvcmQsIGl0ZW0pO1xuICAgICAgICB9XG5cbiAgICAgICAgcmVjb3JkID0gcmVjb3JkLl9uZXh0O1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBpbmRleCA9IDA7XG4gICAgICBpdGVyYXRlTGlzdExpa2UoY29sbGVjdGlvbiwgKGl0ZW06IFYpID0+IHtcbiAgICAgICAgaXRlbVRyYWNrQnkgPSB0aGlzLl90cmFja0J5Rm4oaW5kZXgsIGl0ZW0pO1xuICAgICAgICBpZiAocmVjb3JkID09PSBudWxsIHx8ICFPYmplY3QuaXMocmVjb3JkLnRyYWNrQnlJZCwgaXRlbVRyYWNrQnkpKSB7XG4gICAgICAgICAgcmVjb3JkID0gdGhpcy5fbWlzbWF0Y2gocmVjb3JkLCBpdGVtLCBpdGVtVHJhY2tCeSwgaW5kZXgpO1xuICAgICAgICAgIG1heUJlRGlydHkgPSB0cnVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGlmIChtYXlCZURpcnR5KSB7XG4gICAgICAgICAgICAvLyBUT0RPKG1pc2tvKTogY2FuIHdlIGxpbWl0IHRoaXMgdG8gZHVwbGljYXRlcyBvbmx5P1xuICAgICAgICAgICAgcmVjb3JkID0gdGhpcy5fdmVyaWZ5UmVpbnNlcnRpb24ocmVjb3JkLCBpdGVtLCBpdGVtVHJhY2tCeSwgaW5kZXgpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoIU9iamVjdC5pcyhyZWNvcmQuaXRlbSwgaXRlbSkpIHRoaXMuX2FkZElkZW50aXR5Q2hhbmdlKHJlY29yZCwgaXRlbSk7XG4gICAgICAgIH1cbiAgICAgICAgcmVjb3JkID0gcmVjb3JkLl9uZXh0O1xuICAgICAgICBpbmRleCsrO1xuICAgICAgfSk7XG4gICAgICAodGhpcyBhcyBXcml0YWJsZTx0aGlzPikubGVuZ3RoID0gaW5kZXg7XG4gICAgfVxuXG4gICAgdGhpcy5fdHJ1bmNhdGUocmVjb3JkKTtcbiAgICAodGhpcyBhcyBXcml0YWJsZTx0aGlzPikuY29sbGVjdGlvbiA9IGNvbGxlY3Rpb247XG4gICAgcmV0dXJuIHRoaXMuaXNEaXJ0eTtcbiAgfVxuXG4gIC8qIENvbGxlY3Rpb25DaGFuZ2VzIGlzIGNvbnNpZGVyZWQgZGlydHkgaWYgaXQgaGFzIGFueSBhZGRpdGlvbnMsIG1vdmVzLCByZW1vdmFscywgb3IgaWRlbnRpdHlcbiAgICogY2hhbmdlcy5cbiAgICovXG4gIGdldCBpc0RpcnR5KCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiAoXG4gICAgICB0aGlzLl9hZGRpdGlvbnNIZWFkICE9PSBudWxsIHx8XG4gICAgICB0aGlzLl9tb3Zlc0hlYWQgIT09IG51bGwgfHxcbiAgICAgIHRoaXMuX3JlbW92YWxzSGVhZCAhPT0gbnVsbCB8fFxuICAgICAgdGhpcy5faWRlbnRpdHlDaGFuZ2VzSGVhZCAhPT0gbnVsbFxuICAgICk7XG4gIH1cblxuICAvKipcbiAgICogUmVzZXQgdGhlIHN0YXRlIG9mIHRoZSBjaGFuZ2Ugb2JqZWN0cyB0byBzaG93IG5vIGNoYW5nZXMuIFRoaXMgbWVhbnMgc2V0IHByZXZpb3VzS2V5IHRvXG4gICAqIGN1cnJlbnRLZXksIGFuZCBjbGVhciBhbGwgb2YgdGhlIHF1ZXVlcyAoYWRkaXRpb25zLCBtb3ZlcywgcmVtb3ZhbHMpLlxuICAgKiBTZXQgdGhlIHByZXZpb3VzSW5kZXhlcyBvZiBtb3ZlZCBhbmQgYWRkZWQgaXRlbXMgdG8gdGhlaXIgY3VycmVudEluZGV4ZXNcbiAgICogUmVzZXQgdGhlIGxpc3Qgb2YgYWRkaXRpb25zLCBtb3ZlcyBhbmQgcmVtb3ZhbHNcbiAgICpcbiAgICogQGludGVybmFsXG4gICAqL1xuICBfcmVzZXQoKSB7XG4gICAgaWYgKHRoaXMuaXNEaXJ0eSkge1xuICAgICAgbGV0IHJlY29yZDogSXRlcmFibGVDaGFuZ2VSZWNvcmRfPFY+IHwgbnVsbDtcblxuICAgICAgZm9yIChyZWNvcmQgPSB0aGlzLl9wcmV2aW91c0l0SGVhZCA9IHRoaXMuX2l0SGVhZDsgcmVjb3JkICE9PSBudWxsOyByZWNvcmQgPSByZWNvcmQuX25leHQpIHtcbiAgICAgICAgcmVjb3JkLl9uZXh0UHJldmlvdXMgPSByZWNvcmQuX25leHQ7XG4gICAgICB9XG5cbiAgICAgIGZvciAocmVjb3JkID0gdGhpcy5fYWRkaXRpb25zSGVhZDsgcmVjb3JkICE9PSBudWxsOyByZWNvcmQgPSByZWNvcmQuX25leHRBZGRlZCkge1xuICAgICAgICByZWNvcmQucHJldmlvdXNJbmRleCA9IHJlY29yZC5jdXJyZW50SW5kZXg7XG4gICAgICB9XG4gICAgICB0aGlzLl9hZGRpdGlvbnNIZWFkID0gdGhpcy5fYWRkaXRpb25zVGFpbCA9IG51bGw7XG5cbiAgICAgIGZvciAocmVjb3JkID0gdGhpcy5fbW92ZXNIZWFkOyByZWNvcmQgIT09IG51bGw7IHJlY29yZCA9IHJlY29yZC5fbmV4dE1vdmVkKSB7XG4gICAgICAgIHJlY29yZC5wcmV2aW91c0luZGV4ID0gcmVjb3JkLmN1cnJlbnRJbmRleDtcbiAgICAgIH1cbiAgICAgIHRoaXMuX21vdmVzSGVhZCA9IHRoaXMuX21vdmVzVGFpbCA9IG51bGw7XG4gICAgICB0aGlzLl9yZW1vdmFsc0hlYWQgPSB0aGlzLl9yZW1vdmFsc1RhaWwgPSBudWxsO1xuICAgICAgdGhpcy5faWRlbnRpdHlDaGFuZ2VzSGVhZCA9IHRoaXMuX2lkZW50aXR5Q2hhbmdlc1RhaWwgPSBudWxsO1xuXG4gICAgICAvLyBUT0RPKHZpY2IpOiB3aGVuIGFzc2VydCBnZXRzIHN1cHBvcnRlZFxuICAgICAgLy8gYXNzZXJ0KCF0aGlzLmlzRGlydHkpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBUaGlzIGlzIHRoZSBjb3JlIGZ1bmN0aW9uIHdoaWNoIGhhbmRsZXMgZGlmZmVyZW5jZXMgYmV0d2VlbiBjb2xsZWN0aW9ucy5cbiAgICpcbiAgICogLSBgcmVjb3JkYCBpcyB0aGUgcmVjb3JkIHdoaWNoIHdlIHNhdyBhdCB0aGlzIHBvc2l0aW9uIGxhc3QgdGltZS4gSWYgbnVsbCB0aGVuIGl0IGlzIGEgbmV3XG4gICAqICAgaXRlbS5cbiAgICogLSBgaXRlbWAgaXMgdGhlIGN1cnJlbnQgaXRlbSBpbiB0aGUgY29sbGVjdGlvblxuICAgKiAtIGBpbmRleGAgaXMgdGhlIHBvc2l0aW9uIG9mIHRoZSBpdGVtIGluIHRoZSBjb2xsZWN0aW9uXG4gICAqXG4gICAqIEBpbnRlcm5hbFxuICAgKi9cbiAgX21pc21hdGNoKFxuICAgIHJlY29yZDogSXRlcmFibGVDaGFuZ2VSZWNvcmRfPFY+IHwgbnVsbCxcbiAgICBpdGVtOiBWLFxuICAgIGl0ZW1UcmFja0J5OiBhbnksXG4gICAgaW5kZXg6IG51bWJlcixcbiAgKTogSXRlcmFibGVDaGFuZ2VSZWNvcmRfPFY+IHtcbiAgICAvLyBUaGUgcHJldmlvdXMgcmVjb3JkIGFmdGVyIHdoaWNoIHdlIHdpbGwgYXBwZW5kIHRoZSBjdXJyZW50IG9uZS5cbiAgICBsZXQgcHJldmlvdXNSZWNvcmQ6IEl0ZXJhYmxlQ2hhbmdlUmVjb3JkXzxWPiB8IG51bGw7XG5cbiAgICBpZiAocmVjb3JkID09PSBudWxsKSB7XG4gICAgICBwcmV2aW91c1JlY29yZCA9IHRoaXMuX2l0VGFpbDtcbiAgICB9IGVsc2Uge1xuICAgICAgcHJldmlvdXNSZWNvcmQgPSByZWNvcmQuX3ByZXY7XG4gICAgICAvLyBSZW1vdmUgdGhlIHJlY29yZCBmcm9tIHRoZSBjb2xsZWN0aW9uIHNpbmNlIHdlIGtub3cgaXQgZG9lcyBub3QgbWF0Y2ggdGhlIGl0ZW0uXG4gICAgICB0aGlzLl9yZW1vdmUocmVjb3JkKTtcbiAgICB9XG5cbiAgICAvLyBTZWUgaWYgd2UgaGF2ZSBldmljdGVkIHRoZSBpdGVtLCB3aGljaCB1c2VkIHRvIGJlIGF0IHNvbWUgYW50ZXJpb3IgcG9zaXRpb24gb2YgX2l0SGVhZCBsaXN0LlxuICAgIHJlY29yZCA9IHRoaXMuX3VubGlua2VkUmVjb3JkcyA9PT0gbnVsbCA/IG51bGwgOiB0aGlzLl91bmxpbmtlZFJlY29yZHMuZ2V0KGl0ZW1UcmFja0J5LCBudWxsKTtcbiAgICBpZiAocmVjb3JkICE9PSBudWxsKSB7XG4gICAgICAvLyBJdCBpcyBhbiBpdGVtIHdoaWNoIHdlIGhhdmUgZXZpY3RlZCBlYXJsaWVyOiByZWluc2VydCBpdCBiYWNrIGludG8gdGhlIGxpc3QuXG4gICAgICAvLyBCdXQgZmlyc3Qgd2UgbmVlZCB0byBjaGVjayBpZiBpZGVudGl0eSBjaGFuZ2VkLCBzbyB3ZSBjYW4gdXBkYXRlIGluIHZpZXcgaWYgbmVjZXNzYXJ5LlxuICAgICAgaWYgKCFPYmplY3QuaXMocmVjb3JkLml0ZW0sIGl0ZW0pKSB0aGlzLl9hZGRJZGVudGl0eUNoYW5nZShyZWNvcmQsIGl0ZW0pO1xuXG4gICAgICB0aGlzLl9yZWluc2VydEFmdGVyKHJlY29yZCwgcHJldmlvdXNSZWNvcmQsIGluZGV4KTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gQXR0ZW1wdCB0byBzZWUgaWYgdGhlIGl0ZW0gaXMgYXQgc29tZSBwb3N0ZXJpb3IgcG9zaXRpb24gb2YgX2l0SGVhZCBsaXN0LlxuICAgICAgcmVjb3JkID0gdGhpcy5fbGlua2VkUmVjb3JkcyA9PT0gbnVsbCA/IG51bGwgOiB0aGlzLl9saW5rZWRSZWNvcmRzLmdldChpdGVtVHJhY2tCeSwgaW5kZXgpO1xuICAgICAgaWYgKHJlY29yZCAhPT0gbnVsbCkge1xuICAgICAgICAvLyBXZSBoYXZlIHRoZSBpdGVtIGluIF9pdEhlYWQgYXQvYWZ0ZXIgYGluZGV4YCBwb3NpdGlvbi4gV2UgbmVlZCB0byBtb3ZlIGl0IGZvcndhcmQgaW4gdGhlXG4gICAgICAgIC8vIGNvbGxlY3Rpb24uXG4gICAgICAgIC8vIEJ1dCBmaXJzdCB3ZSBuZWVkIHRvIGNoZWNrIGlmIGlkZW50aXR5IGNoYW5nZWQsIHNvIHdlIGNhbiB1cGRhdGUgaW4gdmlldyBpZiBuZWNlc3NhcnkuXG4gICAgICAgIGlmICghT2JqZWN0LmlzKHJlY29yZC5pdGVtLCBpdGVtKSkgdGhpcy5fYWRkSWRlbnRpdHlDaGFuZ2UocmVjb3JkLCBpdGVtKTtcblxuICAgICAgICB0aGlzLl9tb3ZlQWZ0ZXIocmVjb3JkLCBwcmV2aW91c1JlY29yZCwgaW5kZXgpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gSXQgaXMgYSBuZXcgaXRlbTogYWRkIGl0LlxuICAgICAgICByZWNvcmQgPSB0aGlzLl9hZGRBZnRlcihcbiAgICAgICAgICBuZXcgSXRlcmFibGVDaGFuZ2VSZWNvcmRfPFY+KGl0ZW0sIGl0ZW1UcmFja0J5KSxcbiAgICAgICAgICBwcmV2aW91c1JlY29yZCxcbiAgICAgICAgICBpbmRleCxcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJlY29yZDtcbiAgfVxuXG4gIC8qKlxuICAgKiBUaGlzIGNoZWNrIGlzIG9ubHkgbmVlZGVkIGlmIGFuIGFycmF5IGNvbnRhaW5zIGR1cGxpY2F0ZXMuIChTaG9ydCBjaXJjdWl0IG9mIG5vdGhpbmcgZGlydHkpXG4gICAqXG4gICAqIFVzZSBjYXNlOiBgW2EsIGFdYCA9PiBgW2IsIGEsIGFdYFxuICAgKlxuICAgKiBJZiB3ZSBkaWQgbm90IGhhdmUgdGhpcyBjaGVjayB0aGVuIHRoZSBpbnNlcnRpb24gb2YgYGJgIHdvdWxkOlxuICAgKiAgIDEpIGV2aWN0IGZpcnN0IGBhYFxuICAgKiAgIDIpIGluc2VydCBgYmAgYXQgYDBgIGluZGV4LlxuICAgKiAgIDMpIGxlYXZlIGBhYCBhdCBpbmRleCBgMWAgYXMgaXMuIDwtLSB0aGlzIGlzIHdyb25nIVxuICAgKiAgIDMpIHJlaW5zZXJ0IGBhYCBhdCBpbmRleCAyLiA8LS0gdGhpcyBpcyB3cm9uZyFcbiAgICpcbiAgICogVGhlIGNvcnJlY3QgYmVoYXZpb3IgaXM6XG4gICAqICAgMSkgZXZpY3QgZmlyc3QgYGFgXG4gICAqICAgMikgaW5zZXJ0IGBiYCBhdCBgMGAgaW5kZXguXG4gICAqICAgMykgcmVpbnNlcnQgYGFgIGF0IGluZGV4IDEuXG4gICAqICAgMykgbW92ZSBgYWAgYXQgZnJvbSBgMWAgdG8gYDJgLlxuICAgKlxuICAgKlxuICAgKiBEb3VibGUgY2hlY2sgdGhhdCB3ZSBoYXZlIG5vdCBldmljdGVkIGEgZHVwbGljYXRlIGl0ZW0uIFdlIG5lZWQgdG8gY2hlY2sgaWYgdGhlIGl0ZW0gdHlwZSBtYXlcbiAgICogaGF2ZSBhbHJlYWR5IGJlZW4gcmVtb3ZlZDpcbiAgICogVGhlIGluc2VydGlvbiBvZiBiIHdpbGwgZXZpY3QgdGhlIGZpcnN0ICdhJy4gSWYgd2UgZG9uJ3QgcmVpbnNlcnQgaXQgbm93IGl0IHdpbGwgYmUgcmVpbnNlcnRlZFxuICAgKiBhdCB0aGUgZW5kLiBXaGljaCB3aWxsIHNob3cgdXAgYXMgdGhlIHR3byAnYSdzIHN3aXRjaGluZyBwb3NpdGlvbi4gVGhpcyBpcyBpbmNvcnJlY3QsIHNpbmNlIGFcbiAgICogYmV0dGVyIHdheSB0byB0aGluayBvZiBpdCBpcyBhcyBpbnNlcnQgb2YgJ2InIHJhdGhlciB0aGVuIHN3aXRjaCAnYScgd2l0aCAnYicgYW5kIHRoZW4gYWRkICdhJ1xuICAgKiBhdCB0aGUgZW5kLlxuICAgKlxuICAgKiBAaW50ZXJuYWxcbiAgICovXG4gIF92ZXJpZnlSZWluc2VydGlvbihcbiAgICByZWNvcmQ6IEl0ZXJhYmxlQ2hhbmdlUmVjb3JkXzxWPixcbiAgICBpdGVtOiBWLFxuICAgIGl0ZW1UcmFja0J5OiBhbnksXG4gICAgaW5kZXg6IG51bWJlcixcbiAgKTogSXRlcmFibGVDaGFuZ2VSZWNvcmRfPFY+IHtcbiAgICBsZXQgcmVpbnNlcnRSZWNvcmQ6IEl0ZXJhYmxlQ2hhbmdlUmVjb3JkXzxWPiB8IG51bGwgPVxuICAgICAgdGhpcy5fdW5saW5rZWRSZWNvcmRzID09PSBudWxsID8gbnVsbCA6IHRoaXMuX3VubGlua2VkUmVjb3Jkcy5nZXQoaXRlbVRyYWNrQnksIG51bGwpO1xuICAgIGlmIChyZWluc2VydFJlY29yZCAhPT0gbnVsbCkge1xuICAgICAgcmVjb3JkID0gdGhpcy5fcmVpbnNlcnRBZnRlcihyZWluc2VydFJlY29yZCwgcmVjb3JkLl9wcmV2ISwgaW5kZXgpO1xuICAgIH0gZWxzZSBpZiAocmVjb3JkLmN1cnJlbnRJbmRleCAhPSBpbmRleCkge1xuICAgICAgcmVjb3JkLmN1cnJlbnRJbmRleCA9IGluZGV4O1xuICAgICAgdGhpcy5fYWRkVG9Nb3ZlcyhyZWNvcmQsIGluZGV4KTtcbiAgICB9XG4gICAgcmV0dXJuIHJlY29yZDtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgcmlkIG9mIGFueSBleGNlc3Mge0BsaW5rIEl0ZXJhYmxlQ2hhbmdlUmVjb3JkX31zIGZyb20gdGhlIHByZXZpb3VzIGNvbGxlY3Rpb25cbiAgICpcbiAgICogLSBgcmVjb3JkYCBUaGUgZmlyc3QgZXhjZXNzIHtAbGluayBJdGVyYWJsZUNoYW5nZVJlY29yZF99LlxuICAgKlxuICAgKiBAaW50ZXJuYWxcbiAgICovXG4gIF90cnVuY2F0ZShyZWNvcmQ6IEl0ZXJhYmxlQ2hhbmdlUmVjb3JkXzxWPiB8IG51bGwpIHtcbiAgICAvLyBBbnl0aGluZyBhZnRlciB0aGF0IG5lZWRzIHRvIGJlIHJlbW92ZWQ7XG4gICAgd2hpbGUgKHJlY29yZCAhPT0gbnVsbCkge1xuICAgICAgY29uc3QgbmV4dFJlY29yZDogSXRlcmFibGVDaGFuZ2VSZWNvcmRfPFY+IHwgbnVsbCA9IHJlY29yZC5fbmV4dDtcbiAgICAgIHRoaXMuX2FkZFRvUmVtb3ZhbHModGhpcy5fdW5saW5rKHJlY29yZCkpO1xuICAgICAgcmVjb3JkID0gbmV4dFJlY29yZDtcbiAgICB9XG4gICAgaWYgKHRoaXMuX3VubGlua2VkUmVjb3JkcyAhPT0gbnVsbCkge1xuICAgICAgdGhpcy5fdW5saW5rZWRSZWNvcmRzLmNsZWFyKCk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX2FkZGl0aW9uc1RhaWwgIT09IG51bGwpIHtcbiAgICAgIHRoaXMuX2FkZGl0aW9uc1RhaWwuX25leHRBZGRlZCA9IG51bGw7XG4gICAgfVxuICAgIGlmICh0aGlzLl9tb3Zlc1RhaWwgIT09IG51bGwpIHtcbiAgICAgIHRoaXMuX21vdmVzVGFpbC5fbmV4dE1vdmVkID0gbnVsbDtcbiAgICB9XG4gICAgaWYgKHRoaXMuX2l0VGFpbCAhPT0gbnVsbCkge1xuICAgICAgdGhpcy5faXRUYWlsLl9uZXh0ID0gbnVsbDtcbiAgICB9XG4gICAgaWYgKHRoaXMuX3JlbW92YWxzVGFpbCAhPT0gbnVsbCkge1xuICAgICAgdGhpcy5fcmVtb3ZhbHNUYWlsLl9uZXh0UmVtb3ZlZCA9IG51bGw7XG4gICAgfVxuICAgIGlmICh0aGlzLl9pZGVudGl0eUNoYW5nZXNUYWlsICE9PSBudWxsKSB7XG4gICAgICB0aGlzLl9pZGVudGl0eUNoYW5nZXNUYWlsLl9uZXh0SWRlbnRpdHlDaGFuZ2UgPSBudWxsO1xuICAgIH1cbiAgfVxuXG4gIC8qKiBAaW50ZXJuYWwgKi9cbiAgX3JlaW5zZXJ0QWZ0ZXIoXG4gICAgcmVjb3JkOiBJdGVyYWJsZUNoYW5nZVJlY29yZF88Vj4sXG4gICAgcHJldlJlY29yZDogSXRlcmFibGVDaGFuZ2VSZWNvcmRfPFY+IHwgbnVsbCxcbiAgICBpbmRleDogbnVtYmVyLFxuICApOiBJdGVyYWJsZUNoYW5nZVJlY29yZF88Vj4ge1xuICAgIGlmICh0aGlzLl91bmxpbmtlZFJlY29yZHMgIT09IG51bGwpIHtcbiAgICAgIHRoaXMuX3VubGlua2VkUmVjb3Jkcy5yZW1vdmUocmVjb3JkKTtcbiAgICB9XG4gICAgY29uc3QgcHJldiA9IHJlY29yZC5fcHJldlJlbW92ZWQ7XG4gICAgY29uc3QgbmV4dCA9IHJlY29yZC5fbmV4dFJlbW92ZWQ7XG5cbiAgICBpZiAocHJldiA9PT0gbnVsbCkge1xuICAgICAgdGhpcy5fcmVtb3ZhbHNIZWFkID0gbmV4dDtcbiAgICB9IGVsc2Uge1xuICAgICAgcHJldi5fbmV4dFJlbW92ZWQgPSBuZXh0O1xuICAgIH1cbiAgICBpZiAobmV4dCA9PT0gbnVsbCkge1xuICAgICAgdGhpcy5fcmVtb3ZhbHNUYWlsID0gcHJldjtcbiAgICB9IGVsc2Uge1xuICAgICAgbmV4dC5fcHJldlJlbW92ZWQgPSBwcmV2O1xuICAgIH1cblxuICAgIHRoaXMuX2luc2VydEFmdGVyKHJlY29yZCwgcHJldlJlY29yZCwgaW5kZXgpO1xuICAgIHRoaXMuX2FkZFRvTW92ZXMocmVjb3JkLCBpbmRleCk7XG4gICAgcmV0dXJuIHJlY29yZDtcbiAgfVxuXG4gIC8qKiBAaW50ZXJuYWwgKi9cbiAgX21vdmVBZnRlcihcbiAgICByZWNvcmQ6IEl0ZXJhYmxlQ2hhbmdlUmVjb3JkXzxWPixcbiAgICBwcmV2UmVjb3JkOiBJdGVyYWJsZUNoYW5nZVJlY29yZF88Vj4gfCBudWxsLFxuICAgIGluZGV4OiBudW1iZXIsXG4gICk6IEl0ZXJhYmxlQ2hhbmdlUmVjb3JkXzxWPiB7XG4gICAgdGhpcy5fdW5saW5rKHJlY29yZCk7XG4gICAgdGhpcy5faW5zZXJ0QWZ0ZXIocmVjb3JkLCBwcmV2UmVjb3JkLCBpbmRleCk7XG4gICAgdGhpcy5fYWRkVG9Nb3ZlcyhyZWNvcmQsIGluZGV4KTtcbiAgICByZXR1cm4gcmVjb3JkO1xuICB9XG5cbiAgLyoqIEBpbnRlcm5hbCAqL1xuICBfYWRkQWZ0ZXIoXG4gICAgcmVjb3JkOiBJdGVyYWJsZUNoYW5nZVJlY29yZF88Vj4sXG4gICAgcHJldlJlY29yZDogSXRlcmFibGVDaGFuZ2VSZWNvcmRfPFY+IHwgbnVsbCxcbiAgICBpbmRleDogbnVtYmVyLFxuICApOiBJdGVyYWJsZUNoYW5nZVJlY29yZF88Vj4ge1xuICAgIHRoaXMuX2luc2VydEFmdGVyKHJlY29yZCwgcHJldlJlY29yZCwgaW5kZXgpO1xuXG4gICAgaWYgKHRoaXMuX2FkZGl0aW9uc1RhaWwgPT09IG51bGwpIHtcbiAgICAgIC8vIFRPRE8odmljYik6XG4gICAgICAvLyBhc3NlcnQodGhpcy5fYWRkaXRpb25zSGVhZCA9PT0gbnVsbCk7XG4gICAgICB0aGlzLl9hZGRpdGlvbnNUYWlsID0gdGhpcy5fYWRkaXRpb25zSGVhZCA9IHJlY29yZDtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gVE9ETyh2aWNiKTpcbiAgICAgIC8vIGFzc2VydChfYWRkaXRpb25zVGFpbC5fbmV4dEFkZGVkID09PSBudWxsKTtcbiAgICAgIC8vIGFzc2VydChyZWNvcmQuX25leHRBZGRlZCA9PT0gbnVsbCk7XG4gICAgICB0aGlzLl9hZGRpdGlvbnNUYWlsID0gdGhpcy5fYWRkaXRpb25zVGFpbC5fbmV4dEFkZGVkID0gcmVjb3JkO1xuICAgIH1cbiAgICByZXR1cm4gcmVjb3JkO1xuICB9XG5cbiAgLyoqIEBpbnRlcm5hbCAqL1xuICBfaW5zZXJ0QWZ0ZXIoXG4gICAgcmVjb3JkOiBJdGVyYWJsZUNoYW5nZVJlY29yZF88Vj4sXG4gICAgcHJldlJlY29yZDogSXRlcmFibGVDaGFuZ2VSZWNvcmRfPFY+IHwgbnVsbCxcbiAgICBpbmRleDogbnVtYmVyLFxuICApOiBJdGVyYWJsZUNoYW5nZVJlY29yZF88Vj4ge1xuICAgIC8vIFRPRE8odmljYik6XG4gICAgLy8gYXNzZXJ0KHJlY29yZCAhPSBwcmV2UmVjb3JkKTtcbiAgICAvLyBhc3NlcnQocmVjb3JkLl9uZXh0ID09PSBudWxsKTtcbiAgICAvLyBhc3NlcnQocmVjb3JkLl9wcmV2ID09PSBudWxsKTtcblxuICAgIGNvbnN0IG5leHQ6IEl0ZXJhYmxlQ2hhbmdlUmVjb3JkXzxWPiB8IG51bGwgPVxuICAgICAgcHJldlJlY29yZCA9PT0gbnVsbCA/IHRoaXMuX2l0SGVhZCA6IHByZXZSZWNvcmQuX25leHQ7XG4gICAgLy8gVE9ETyh2aWNiKTpcbiAgICAvLyBhc3NlcnQobmV4dCAhPSByZWNvcmQpO1xuICAgIC8vIGFzc2VydChwcmV2UmVjb3JkICE9IHJlY29yZCk7XG4gICAgcmVjb3JkLl9uZXh0ID0gbmV4dDtcbiAgICByZWNvcmQuX3ByZXYgPSBwcmV2UmVjb3JkO1xuICAgIGlmIChuZXh0ID09PSBudWxsKSB7XG4gICAgICB0aGlzLl9pdFRhaWwgPSByZWNvcmQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIG5leHQuX3ByZXYgPSByZWNvcmQ7XG4gICAgfVxuICAgIGlmIChwcmV2UmVjb3JkID09PSBudWxsKSB7XG4gICAgICB0aGlzLl9pdEhlYWQgPSByZWNvcmQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIHByZXZSZWNvcmQuX25leHQgPSByZWNvcmQ7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX2xpbmtlZFJlY29yZHMgPT09IG51bGwpIHtcbiAgICAgIHRoaXMuX2xpbmtlZFJlY29yZHMgPSBuZXcgX0R1cGxpY2F0ZU1hcDxWPigpO1xuICAgIH1cbiAgICB0aGlzLl9saW5rZWRSZWNvcmRzLnB1dChyZWNvcmQpO1xuXG4gICAgcmVjb3JkLmN1cnJlbnRJbmRleCA9IGluZGV4O1xuICAgIHJldHVybiByZWNvcmQ7XG4gIH1cblxuICAvKiogQGludGVybmFsICovXG4gIF9yZW1vdmUocmVjb3JkOiBJdGVyYWJsZUNoYW5nZVJlY29yZF88Vj4pOiBJdGVyYWJsZUNoYW5nZVJlY29yZF88Vj4ge1xuICAgIHJldHVybiB0aGlzLl9hZGRUb1JlbW92YWxzKHRoaXMuX3VubGluayhyZWNvcmQpKTtcbiAgfVxuXG4gIC8qKiBAaW50ZXJuYWwgKi9cbiAgX3VubGluayhyZWNvcmQ6IEl0ZXJhYmxlQ2hhbmdlUmVjb3JkXzxWPik6IEl0ZXJhYmxlQ2hhbmdlUmVjb3JkXzxWPiB7XG4gICAgaWYgKHRoaXMuX2xpbmtlZFJlY29yZHMgIT09IG51bGwpIHtcbiAgICAgIHRoaXMuX2xpbmtlZFJlY29yZHMucmVtb3ZlKHJlY29yZCk7XG4gICAgfVxuXG4gICAgY29uc3QgcHJldiA9IHJlY29yZC5fcHJldjtcbiAgICBjb25zdCBuZXh0ID0gcmVjb3JkLl9uZXh0O1xuXG4gICAgLy8gVE9ETyh2aWNiKTpcbiAgICAvLyBhc3NlcnQoKHJlY29yZC5fcHJldiA9IG51bGwpID09PSBudWxsKTtcbiAgICAvLyBhc3NlcnQoKHJlY29yZC5fbmV4dCA9IG51bGwpID09PSBudWxsKTtcblxuICAgIGlmIChwcmV2ID09PSBudWxsKSB7XG4gICAgICB0aGlzLl9pdEhlYWQgPSBuZXh0O1xuICAgIH0gZWxzZSB7XG4gICAgICBwcmV2Ll9uZXh0ID0gbmV4dDtcbiAgICB9XG4gICAgaWYgKG5leHQgPT09IG51bGwpIHtcbiAgICAgIHRoaXMuX2l0VGFpbCA9IHByZXY7XG4gICAgfSBlbHNlIHtcbiAgICAgIG5leHQuX3ByZXYgPSBwcmV2O1xuICAgIH1cblxuICAgIHJldHVybiByZWNvcmQ7XG4gIH1cblxuICAvKiogQGludGVybmFsICovXG4gIF9hZGRUb01vdmVzKHJlY29yZDogSXRlcmFibGVDaGFuZ2VSZWNvcmRfPFY+LCB0b0luZGV4OiBudW1iZXIpOiBJdGVyYWJsZUNoYW5nZVJlY29yZF88Vj4ge1xuICAgIC8vIFRPRE8odmljYik6XG4gICAgLy8gYXNzZXJ0KHJlY29yZC5fbmV4dE1vdmVkID09PSBudWxsKTtcblxuICAgIGlmIChyZWNvcmQucHJldmlvdXNJbmRleCA9PT0gdG9JbmRleCkge1xuICAgICAgcmV0dXJuIHJlY29yZDtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5fbW92ZXNUYWlsID09PSBudWxsKSB7XG4gICAgICAvLyBUT0RPKHZpY2IpOlxuICAgICAgLy8gYXNzZXJ0KF9tb3Zlc0hlYWQgPT09IG51bGwpO1xuICAgICAgdGhpcy5fbW92ZXNUYWlsID0gdGhpcy5fbW92ZXNIZWFkID0gcmVjb3JkO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBUT0RPKHZpY2IpOlxuICAgICAgLy8gYXNzZXJ0KF9tb3Zlc1RhaWwuX25leHRNb3ZlZCA9PT0gbnVsbCk7XG4gICAgICB0aGlzLl9tb3Zlc1RhaWwgPSB0aGlzLl9tb3Zlc1RhaWwuX25leHRNb3ZlZCA9IHJlY29yZDtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVjb3JkO1xuICB9XG5cbiAgcHJpdmF0ZSBfYWRkVG9SZW1vdmFscyhyZWNvcmQ6IEl0ZXJhYmxlQ2hhbmdlUmVjb3JkXzxWPik6IEl0ZXJhYmxlQ2hhbmdlUmVjb3JkXzxWPiB7XG4gICAgaWYgKHRoaXMuX3VubGlua2VkUmVjb3JkcyA9PT0gbnVsbCkge1xuICAgICAgdGhpcy5fdW5saW5rZWRSZWNvcmRzID0gbmV3IF9EdXBsaWNhdGVNYXA8Vj4oKTtcbiAgICB9XG4gICAgdGhpcy5fdW5saW5rZWRSZWNvcmRzLnB1dChyZWNvcmQpO1xuICAgIHJlY29yZC5jdXJyZW50SW5kZXggPSBudWxsO1xuICAgIHJlY29yZC5fbmV4dFJlbW92ZWQgPSBudWxsO1xuXG4gICAgaWYgKHRoaXMuX3JlbW92YWxzVGFpbCA9PT0gbnVsbCkge1xuICAgICAgLy8gVE9ETyh2aWNiKTpcbiAgICAgIC8vIGFzc2VydChfcmVtb3ZhbHNIZWFkID09PSBudWxsKTtcbiAgICAgIHRoaXMuX3JlbW92YWxzVGFpbCA9IHRoaXMuX3JlbW92YWxzSGVhZCA9IHJlY29yZDtcbiAgICAgIHJlY29yZC5fcHJldlJlbW92ZWQgPSBudWxsO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBUT0RPKHZpY2IpOlxuICAgICAgLy8gYXNzZXJ0KF9yZW1vdmFsc1RhaWwuX25leHRSZW1vdmVkID09PSBudWxsKTtcbiAgICAgIC8vIGFzc2VydChyZWNvcmQuX25leHRSZW1vdmVkID09PSBudWxsKTtcbiAgICAgIHJlY29yZC5fcHJldlJlbW92ZWQgPSB0aGlzLl9yZW1vdmFsc1RhaWw7XG4gICAgICB0aGlzLl9yZW1vdmFsc1RhaWwgPSB0aGlzLl9yZW1vdmFsc1RhaWwuX25leHRSZW1vdmVkID0gcmVjb3JkO1xuICAgIH1cbiAgICByZXR1cm4gcmVjb3JkO1xuICB9XG5cbiAgLyoqIEBpbnRlcm5hbCAqL1xuICBfYWRkSWRlbnRpdHlDaGFuZ2UocmVjb3JkOiBJdGVyYWJsZUNoYW5nZVJlY29yZF88Vj4sIGl0ZW06IFYpIHtcbiAgICByZWNvcmQuaXRlbSA9IGl0ZW07XG4gICAgaWYgKHRoaXMuX2lkZW50aXR5Q2hhbmdlc1RhaWwgPT09IG51bGwpIHtcbiAgICAgIHRoaXMuX2lkZW50aXR5Q2hhbmdlc1RhaWwgPSB0aGlzLl9pZGVudGl0eUNoYW5nZXNIZWFkID0gcmVjb3JkO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9pZGVudGl0eUNoYW5nZXNUYWlsID0gdGhpcy5faWRlbnRpdHlDaGFuZ2VzVGFpbC5fbmV4dElkZW50aXR5Q2hhbmdlID0gcmVjb3JkO1xuICAgIH1cbiAgICByZXR1cm4gcmVjb3JkO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBJdGVyYWJsZUNoYW5nZVJlY29yZF88Vj4gaW1wbGVtZW50cyBJdGVyYWJsZUNoYW5nZVJlY29yZDxWPiB7XG4gIGN1cnJlbnRJbmRleDogbnVtYmVyIHwgbnVsbCA9IG51bGw7XG4gIHByZXZpb3VzSW5kZXg6IG51bWJlciB8IG51bGwgPSBudWxsO1xuXG4gIC8qKiBAaW50ZXJuYWwgKi9cbiAgX25leHRQcmV2aW91czogSXRlcmFibGVDaGFuZ2VSZWNvcmRfPFY+IHwgbnVsbCA9IG51bGw7XG4gIC8qKiBAaW50ZXJuYWwgKi9cbiAgX3ByZXY6IEl0ZXJhYmxlQ2hhbmdlUmVjb3JkXzxWPiB8IG51bGwgPSBudWxsO1xuICAvKiogQGludGVybmFsICovXG4gIF9uZXh0OiBJdGVyYWJsZUNoYW5nZVJlY29yZF88Vj4gfCBudWxsID0gbnVsbDtcbiAgLyoqIEBpbnRlcm5hbCAqL1xuICBfcHJldkR1cDogSXRlcmFibGVDaGFuZ2VSZWNvcmRfPFY+IHwgbnVsbCA9IG51bGw7XG4gIC8qKiBAaW50ZXJuYWwgKi9cbiAgX25leHREdXA6IEl0ZXJhYmxlQ2hhbmdlUmVjb3JkXzxWPiB8IG51bGwgPSBudWxsO1xuICAvKiogQGludGVybmFsICovXG4gIF9wcmV2UmVtb3ZlZDogSXRlcmFibGVDaGFuZ2VSZWNvcmRfPFY+IHwgbnVsbCA9IG51bGw7XG4gIC8qKiBAaW50ZXJuYWwgKi9cbiAgX25leHRSZW1vdmVkOiBJdGVyYWJsZUNoYW5nZVJlY29yZF88Vj4gfCBudWxsID0gbnVsbDtcbiAgLyoqIEBpbnRlcm5hbCAqL1xuICBfbmV4dEFkZGVkOiBJdGVyYWJsZUNoYW5nZVJlY29yZF88Vj4gfCBudWxsID0gbnVsbDtcbiAgLyoqIEBpbnRlcm5hbCAqL1xuICBfbmV4dE1vdmVkOiBJdGVyYWJsZUNoYW5nZVJlY29yZF88Vj4gfCBudWxsID0gbnVsbDtcbiAgLyoqIEBpbnRlcm5hbCAqL1xuICBfbmV4dElkZW50aXR5Q2hhbmdlOiBJdGVyYWJsZUNoYW5nZVJlY29yZF88Vj4gfCBudWxsID0gbnVsbDtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBwdWJsaWMgaXRlbTogVixcbiAgICBwdWJsaWMgdHJhY2tCeUlkOiBhbnksXG4gICkge31cbn1cblxuLy8gQSBsaW5rZWQgbGlzdCBvZiBJdGVyYWJsZUNoYW5nZVJlY29yZHMgd2l0aCB0aGUgc2FtZSBJdGVyYWJsZUNoYW5nZVJlY29yZF8uaXRlbVxuY2xhc3MgX0R1cGxpY2F0ZUl0ZW1SZWNvcmRMaXN0PFY+IHtcbiAgLyoqIEBpbnRlcm5hbCAqL1xuICBfaGVhZDogSXRlcmFibGVDaGFuZ2VSZWNvcmRfPFY+IHwgbnVsbCA9IG51bGw7XG4gIC8qKiBAaW50ZXJuYWwgKi9cbiAgX3RhaWw6IEl0ZXJhYmxlQ2hhbmdlUmVjb3JkXzxWPiB8IG51bGwgPSBudWxsO1xuXG4gIC8qKlxuICAgKiBBcHBlbmQgdGhlIHJlY29yZCB0byB0aGUgbGlzdCBvZiBkdXBsaWNhdGVzLlxuICAgKlxuICAgKiBOb3RlOiBieSBkZXNpZ24gYWxsIHJlY29yZHMgaW4gdGhlIGxpc3Qgb2YgZHVwbGljYXRlcyBob2xkIHRoZSBzYW1lIHZhbHVlIGluIHJlY29yZC5pdGVtLlxuICAgKi9cbiAgYWRkKHJlY29yZDogSXRlcmFibGVDaGFuZ2VSZWNvcmRfPFY+KTogdm9pZCB7XG4gICAgaWYgKHRoaXMuX2hlYWQgPT09IG51bGwpIHtcbiAgICAgIHRoaXMuX2hlYWQgPSB0aGlzLl90YWlsID0gcmVjb3JkO1xuICAgICAgcmVjb3JkLl9uZXh0RHVwID0gbnVsbDtcbiAgICAgIHJlY29yZC5fcHJldkR1cCA9IG51bGw7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFRPRE8odmljYik6XG4gICAgICAvLyBhc3NlcnQocmVjb3JkLml0ZW0gPT0gIF9oZWFkLml0ZW0gfHxcbiAgICAgIC8vICAgICAgIHJlY29yZC5pdGVtIGlzIG51bSAmJiByZWNvcmQuaXRlbS5pc05hTiAmJiBfaGVhZC5pdGVtIGlzIG51bSAmJiBfaGVhZC5pdGVtLmlzTmFOKTtcbiAgICAgIHRoaXMuX3RhaWwhLl9uZXh0RHVwID0gcmVjb3JkO1xuICAgICAgcmVjb3JkLl9wcmV2RHVwID0gdGhpcy5fdGFpbDtcbiAgICAgIHJlY29yZC5fbmV4dER1cCA9IG51bGw7XG4gICAgICB0aGlzLl90YWlsID0gcmVjb3JkO1xuICAgIH1cbiAgfVxuXG4gIC8vIFJldHVybnMgYSBJdGVyYWJsZUNoYW5nZVJlY29yZF8gaGF2aW5nIEl0ZXJhYmxlQ2hhbmdlUmVjb3JkXy50cmFja0J5SWQgPT0gdHJhY2tCeUlkIGFuZFxuICAvLyBJdGVyYWJsZUNoYW5nZVJlY29yZF8uY3VycmVudEluZGV4ID49IGF0T3JBZnRlckluZGV4XG4gIGdldCh0cmFja0J5SWQ6IGFueSwgYXRPckFmdGVySW5kZXg6IG51bWJlciB8IG51bGwpOiBJdGVyYWJsZUNoYW5nZVJlY29yZF88Vj4gfCBudWxsIHtcbiAgICBsZXQgcmVjb3JkOiBJdGVyYWJsZUNoYW5nZVJlY29yZF88Vj4gfCBudWxsO1xuICAgIGZvciAocmVjb3JkID0gdGhpcy5faGVhZDsgcmVjb3JkICE9PSBudWxsOyByZWNvcmQgPSByZWNvcmQuX25leHREdXApIHtcbiAgICAgIGlmIChcbiAgICAgICAgKGF0T3JBZnRlckluZGV4ID09PSBudWxsIHx8IGF0T3JBZnRlckluZGV4IDw9IHJlY29yZC5jdXJyZW50SW5kZXghKSAmJlxuICAgICAgICBPYmplY3QuaXMocmVjb3JkLnRyYWNrQnlJZCwgdHJhY2tCeUlkKVxuICAgICAgKSB7XG4gICAgICAgIHJldHVybiByZWNvcmQ7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlbW92ZSBvbmUge0BsaW5rIEl0ZXJhYmxlQ2hhbmdlUmVjb3JkX30gZnJvbSB0aGUgbGlzdCBvZiBkdXBsaWNhdGVzLlxuICAgKlxuICAgKiBSZXR1cm5zIHdoZXRoZXIgdGhlIGxpc3Qgb2YgZHVwbGljYXRlcyBpcyBlbXB0eS5cbiAgICovXG4gIHJlbW92ZShyZWNvcmQ6IEl0ZXJhYmxlQ2hhbmdlUmVjb3JkXzxWPik6IGJvb2xlYW4ge1xuICAgIC8vIFRPRE8odmljYik6XG4gICAgLy8gYXNzZXJ0KCgpIHtcbiAgICAvLyAgLy8gdmVyaWZ5IHRoYXQgdGhlIHJlY29yZCBiZWluZyByZW1vdmVkIGlzIGluIHRoZSBsaXN0LlxuICAgIC8vICBmb3IgKEl0ZXJhYmxlQ2hhbmdlUmVjb3JkXyBjdXJzb3IgPSBfaGVhZDsgY3Vyc29yICE9IG51bGw7IGN1cnNvciA9IGN1cnNvci5fbmV4dER1cCkge1xuICAgIC8vICAgIGlmIChpZGVudGljYWwoY3Vyc29yLCByZWNvcmQpKSByZXR1cm4gdHJ1ZTtcbiAgICAvLyAgfVxuICAgIC8vICByZXR1cm4gZmFsc2U7XG4gICAgLy99KTtcblxuICAgIGNvbnN0IHByZXY6IEl0ZXJhYmxlQ2hhbmdlUmVjb3JkXzxWPiB8IG51bGwgPSByZWNvcmQuX3ByZXZEdXA7XG4gICAgY29uc3QgbmV4dDogSXRlcmFibGVDaGFuZ2VSZWNvcmRfPFY+IHwgbnVsbCA9IHJlY29yZC5fbmV4dER1cDtcbiAgICBpZiAocHJldiA9PT0gbnVsbCkge1xuICAgICAgdGhpcy5faGVhZCA9IG5leHQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIHByZXYuX25leHREdXAgPSBuZXh0O1xuICAgIH1cbiAgICBpZiAobmV4dCA9PT0gbnVsbCkge1xuICAgICAgdGhpcy5fdGFpbCA9IHByZXY7XG4gICAgfSBlbHNlIHtcbiAgICAgIG5leHQuX3ByZXZEdXAgPSBwcmV2O1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5faGVhZCA9PT0gbnVsbDtcbiAgfVxufVxuXG5jbGFzcyBfRHVwbGljYXRlTWFwPFY+IHtcbiAgbWFwID0gbmV3IE1hcDxhbnksIF9EdXBsaWNhdGVJdGVtUmVjb3JkTGlzdDxWPj4oKTtcblxuICBwdXQocmVjb3JkOiBJdGVyYWJsZUNoYW5nZVJlY29yZF88Vj4pIHtcbiAgICBjb25zdCBrZXkgPSByZWNvcmQudHJhY2tCeUlkO1xuXG4gICAgbGV0IGR1cGxpY2F0ZXMgPSB0aGlzLm1hcC5nZXQoa2V5KTtcbiAgICBpZiAoIWR1cGxpY2F0ZXMpIHtcbiAgICAgIGR1cGxpY2F0ZXMgPSBuZXcgX0R1cGxpY2F0ZUl0ZW1SZWNvcmRMaXN0PFY+KCk7XG4gICAgICB0aGlzLm1hcC5zZXQoa2V5LCBkdXBsaWNhdGVzKTtcbiAgICB9XG4gICAgZHVwbGljYXRlcy5hZGQocmVjb3JkKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXRyaWV2ZSB0aGUgYHZhbHVlYCB1c2luZyBrZXkuIEJlY2F1c2UgdGhlIEl0ZXJhYmxlQ2hhbmdlUmVjb3JkXyB2YWx1ZSBtYXkgYmUgb25lIHdoaWNoIHdlXG4gICAqIGhhdmUgYWxyZWFkeSBpdGVyYXRlZCBvdmVyLCB3ZSB1c2UgdGhlIGBhdE9yQWZ0ZXJJbmRleGAgdG8gcHJldGVuZCBpdCBpcyBub3QgdGhlcmUuXG4gICAqXG4gICAqIFVzZSBjYXNlOiBgW2EsIGIsIGMsIGEsIGFdYCBpZiB3ZSBhcmUgYXQgaW5kZXggYDNgIHdoaWNoIGlzIHRoZSBzZWNvbmQgYGFgIHRoZW4gYXNraW5nIGlmIHdlXG4gICAqIGhhdmUgYW55IG1vcmUgYGFgcyBuZWVkcyB0byByZXR1cm4gdGhlIHNlY29uZCBgYWAuXG4gICAqL1xuICBnZXQodHJhY2tCeUlkOiBhbnksIGF0T3JBZnRlckluZGV4OiBudW1iZXIgfCBudWxsKTogSXRlcmFibGVDaGFuZ2VSZWNvcmRfPFY+IHwgbnVsbCB7XG4gICAgY29uc3Qga2V5ID0gdHJhY2tCeUlkO1xuICAgIGNvbnN0IHJlY29yZExpc3QgPSB0aGlzLm1hcC5nZXQoa2V5KTtcbiAgICByZXR1cm4gcmVjb3JkTGlzdCA/IHJlY29yZExpc3QuZ2V0KHRyYWNrQnlJZCwgYXRPckFmdGVySW5kZXgpIDogbnVsbDtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmVzIGEge0BsaW5rIEl0ZXJhYmxlQ2hhbmdlUmVjb3JkX30gZnJvbSB0aGUgbGlzdCBvZiBkdXBsaWNhdGVzLlxuICAgKlxuICAgKiBUaGUgbGlzdCBvZiBkdXBsaWNhdGVzIGFsc28gaXMgcmVtb3ZlZCBmcm9tIHRoZSBtYXAgaWYgaXQgZ2V0cyBlbXB0eS5cbiAgICovXG4gIHJlbW92ZShyZWNvcmQ6IEl0ZXJhYmxlQ2hhbmdlUmVjb3JkXzxWPik6IEl0ZXJhYmxlQ2hhbmdlUmVjb3JkXzxWPiB7XG4gICAgY29uc3Qga2V5ID0gcmVjb3JkLnRyYWNrQnlJZDtcbiAgICBjb25zdCByZWNvcmRMaXN0OiBfRHVwbGljYXRlSXRlbVJlY29yZExpc3Q8Vj4gPSB0aGlzLm1hcC5nZXQoa2V5KSE7XG4gICAgLy8gUmVtb3ZlIHRoZSBsaXN0IG9mIGR1cGxpY2F0ZXMgd2hlbiBpdCBnZXRzIGVtcHR5XG4gICAgaWYgKHJlY29yZExpc3QucmVtb3ZlKHJlY29yZCkpIHtcbiAgICAgIHRoaXMubWFwLmRlbGV0ZShrZXkpO1xuICAgIH1cbiAgICByZXR1cm4gcmVjb3JkO1xuICB9XG5cbiAgZ2V0IGlzRW1wdHkoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMubWFwLnNpemUgPT09IDA7XG4gIH1cblxuICBjbGVhcigpIHtcbiAgICB0aGlzLm1hcC5jbGVhcigpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGdldFByZXZpb3VzSW5kZXgoXG4gIGl0ZW06IGFueSxcbiAgYWRkUmVtb3ZlT2Zmc2V0OiBudW1iZXIsXG4gIG1vdmVPZmZzZXRzOiBudW1iZXJbXSB8IG51bGwsXG4pOiBudW1iZXIge1xuICBjb25zdCBwcmV2aW91c0luZGV4ID0gaXRlbS5wcmV2aW91c0luZGV4O1xuICBpZiAocHJldmlvdXNJbmRleCA9PT0gbnVsbCkgcmV0dXJuIHByZXZpb3VzSW5kZXg7XG4gIGxldCBtb3ZlT2Zmc2V0ID0gMDtcbiAgaWYgKG1vdmVPZmZzZXRzICYmIHByZXZpb3VzSW5kZXggPCBtb3ZlT2Zmc2V0cy5sZW5ndGgpIHtcbiAgICBtb3ZlT2Zmc2V0ID0gbW92ZU9mZnNldHNbcHJldmlvdXNJbmRleF07XG4gIH1cbiAgcmV0dXJuIHByZXZpb3VzSW5kZXggKyBhZGRSZW1vdmVPZmZzZXQgKyBtb3ZlT2Zmc2V0O1xufVxuIl19