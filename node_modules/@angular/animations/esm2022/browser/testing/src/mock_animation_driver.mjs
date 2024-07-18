/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { AUTO_STYLE, NoopAnimationPlayer } from '@angular/animations';
import { ɵallowPreviousPlayerStylesMerge as allowPreviousPlayerStylesMerge, ɵcamelCaseToDashCase, ɵcontainsElement as containsElement, ɵgetParentElement as getParentElement, ɵinvokeQuery as invokeQuery, ɵnormalizeKeyframes as normalizeKeyframes, ɵvalidateStyleProperty as validateStyleProperty, ɵvalidateWebAnimatableStyleProperty, } from '@angular/animations/browser';
/**
 * @publicApi
 */
export class MockAnimationDriver {
    static { this.log = []; }
    validateStyleProperty(prop) {
        return validateStyleProperty(prop);
    }
    validateAnimatableStyleProperty(prop) {
        const cssProp = ɵcamelCaseToDashCase(prop);
        return ɵvalidateWebAnimatableStyleProperty(cssProp);
    }
    containsElement(elm1, elm2) {
        return containsElement(elm1, elm2);
    }
    getParentElement(element) {
        return getParentElement(element);
    }
    query(element, selector, multi) {
        return invokeQuery(element, selector, multi);
    }
    computeStyle(element, prop, defaultValue) {
        return defaultValue || '';
    }
    animate(element, keyframes, duration, delay, easing, previousPlayers = []) {
        const player = new MockAnimationPlayer(element, keyframes, duration, delay, easing, previousPlayers);
        MockAnimationDriver.log.push(player);
        return player;
    }
}
/**
 * @publicApi
 */
export class MockAnimationPlayer extends NoopAnimationPlayer {
    constructor(element, keyframes, duration, delay, easing, previousPlayers) {
        super(duration, delay);
        this.element = element;
        this.keyframes = keyframes;
        this.duration = duration;
        this.delay = delay;
        this.easing = easing;
        this.previousPlayers = previousPlayers;
        this.__finished = false;
        this.__started = false;
        this.previousStyles = new Map();
        this._onInitFns = [];
        this.currentSnapshot = new Map();
        this._keyframes = [];
        this._keyframes = normalizeKeyframes(keyframes);
        if (allowPreviousPlayerStylesMerge(duration, delay)) {
            previousPlayers.forEach((player) => {
                if (player instanceof MockAnimationPlayer) {
                    const styles = player.currentSnapshot;
                    styles.forEach((val, prop) => this.previousStyles.set(prop, val));
                }
            });
        }
    }
    /** @internal */
    onInit(fn) {
        this._onInitFns.push(fn);
    }
    /** @internal */
    init() {
        super.init();
        this._onInitFns.forEach((fn) => fn());
        this._onInitFns = [];
    }
    reset() {
        super.reset();
        this.__started = false;
    }
    finish() {
        super.finish();
        this.__finished = true;
    }
    destroy() {
        super.destroy();
        this.__finished = true;
    }
    /** @internal */
    triggerMicrotask() { }
    play() {
        super.play();
        this.__started = true;
    }
    hasStarted() {
        return this.__started;
    }
    beforeDestroy() {
        const captures = new Map();
        this.previousStyles.forEach((val, prop) => captures.set(prop, val));
        if (this.hasStarted()) {
            // when assembling the captured styles, it's important that
            // we build the keyframe styles in the following order:
            // {other styles within keyframes, ... previousStyles }
            this._keyframes.forEach((kf) => {
                for (let [prop, val] of kf) {
                    if (prop !== 'offset') {
                        captures.set(prop, this.__finished ? val : AUTO_STYLE);
                    }
                }
            });
        }
        this.currentSnapshot = captures;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9ja19hbmltYXRpb25fZHJpdmVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5pbWF0aW9ucy9icm93c2VyL3Rlc3Rpbmcvc3JjL21vY2tfYW5pbWF0aW9uX2RyaXZlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFDSCxPQUFPLEVBQWtCLFVBQVUsRUFBRSxtQkFBbUIsRUFBZ0IsTUFBTSxxQkFBcUIsQ0FBQztBQUNwRyxPQUFPLEVBRUwsK0JBQStCLElBQUksOEJBQThCLEVBQ2pFLG9CQUFvQixFQUNwQixnQkFBZ0IsSUFBSSxlQUFlLEVBQ25DLGlCQUFpQixJQUFJLGdCQUFnQixFQUNyQyxZQUFZLElBQUksV0FBVyxFQUMzQixtQkFBbUIsSUFBSSxrQkFBa0IsRUFDekMsc0JBQXNCLElBQUkscUJBQXFCLEVBQy9DLG1DQUFtQyxHQUNwQyxNQUFNLDZCQUE2QixDQUFDO0FBRXJDOztHQUVHO0FBQ0gsTUFBTSxPQUFPLG1CQUFtQjthQUN2QixRQUFHLEdBQXNCLEVBQUUsQ0FBQztJQUVuQyxxQkFBcUIsQ0FBQyxJQUFZO1FBQ2hDLE9BQU8scUJBQXFCLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDckMsQ0FBQztJQUVELCtCQUErQixDQUFDLElBQVk7UUFDMUMsTUFBTSxPQUFPLEdBQUcsb0JBQW9CLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDM0MsT0FBTyxtQ0FBbUMsQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUN0RCxDQUFDO0lBRUQsZUFBZSxDQUFDLElBQVMsRUFBRSxJQUFTO1FBQ2xDLE9BQU8sZUFBZSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztJQUNyQyxDQUFDO0lBRUQsZ0JBQWdCLENBQUMsT0FBZ0I7UUFDL0IsT0FBTyxnQkFBZ0IsQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUNuQyxDQUFDO0lBRUQsS0FBSyxDQUFDLE9BQVksRUFBRSxR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cHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuaW1wb3J0IHtBbmltYXRpb25QbGF5ZXIsIEFVVE9fU1RZTEUsIE5vb3BBbmltYXRpb25QbGF5ZXIsIMm1U3R5bGVEYXRhTWFwfSBmcm9tICdAYW5ndWxhci9hbmltYXRpb25zJztcbmltcG9ydCB7XG4gIEFuaW1hdGlvbkRyaXZlcixcbiAgybVhbGxvd1ByZXZpb3VzUGxheWVyU3R5bGVzTWVyZ2UgYXMgYWxsb3dQcmV2aW91c1BsYXllclN0eWxlc01lcmdlLFxuICDJtWNhbWVsQ2FzZVRvRGFzaENhc2UsXG4gIMm1Y29udGFpbnNFbGVtZW50IGFzIGNvbnRhaW5zRWxlbWVudCxcbiAgybVnZXRQYXJlbnRFbGVtZW50IGFzIGdldFBhcmVudEVsZW1lbnQsXG4gIMm1aW52b2tlUXVlcnkgYXMgaW52b2tlUXVlcnksXG4gIMm1bm9ybWFsaXplS2V5ZnJhbWVzIGFzIG5vcm1hbGl6ZUtleWZyYW1lcyxcbiAgybV2YWxpZGF0ZVN0eWxlUHJvcGVydHkgYXMgdmFsaWRhdGVTdHlsZVByb3BlcnR5LFxuICDJtXZhbGlkYXRlV2ViQW5pbWF0YWJsZVN0eWxlUHJvcGVydHksXG59IGZyb20gJ0Bhbmd1bGFyL2FuaW1hdGlvbnMvYnJvd3Nlcic7XG5cbi8qKlxuICogQHB1YmxpY0FwaVxuICovXG5leHBvcnQgY2xhc3MgTW9ja0FuaW1hdGlvbkRyaXZlciBpbXBsZW1lbnRzIEFuaW1hdGlvbkRyaXZlciB7XG4gIHN0YXRpYyBsb2c6IEFuaW1hdGlvblBsYXllcltdID0gW107XG5cbiAgdmFsaWRhdGVTdHlsZVByb3BlcnR5KHByb3A6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB2YWxpZGF0ZVN0eWxlUHJvcGVydHkocHJvcCk7XG4gIH1cblxuICB2YWxpZGF0ZUFuaW1hdGFibGVTdHlsZVByb3BlcnR5KHByb3A6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgIGNvbnN0IGNzc1Byb3AgPSDJtWNhbWVsQ2FzZVRvRGFzaENhc2UocHJvcCk7XG4gICAgcmV0dXJuIMm1dmFsaWRhdGVXZWJBbmltYXRhYmxlU3R5bGVQcm9wZXJ0eShjc3NQcm9wKTtcbiAgfVxuXG4gIGNvbnRhaW5zRWxlbWVudChlbG0xOiBhbnksIGVsbTI6IGFueSk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBjb250YWluc0VsZW1lbnQoZWxtMSwgZWxtMik7XG4gIH1cblxuICBnZXRQYXJlbnRFbGVtZW50KGVsZW1lbnQ6IHVua25vd24pOiB1bmtub3duIHtcbiAgICByZXR1cm4gZ2V0UGFyZW50RWxlbWVudChlbGVtZW50KTtcbiAgfVxuXG4gIHF1ZXJ5KGVsZW1lbnQ6IGFueSwgc2VsZWN0b3I6IHN0cmluZywgbXVsdGk6IGJvb2xlYW4pOiBhbnlbXSB7XG4gICAgcmV0dXJuIGludm9rZVF1ZXJ5KGVsZW1lbnQsIHNlbGVjdG9yLCBtdWx0aSk7XG4gIH1cblxuICBjb21wdXRlU3R5bGUoZWxlbWVudDogYW55LCBwcm9wOiBzdHJpbmcsIGRlZmF1bHRWYWx1ZT86IHN0cmluZyk6IHN0cmluZyB7XG4gICAgcmV0dXJuIGRlZmF1bHRWYWx1ZSB8fCAnJztcbiAgfVxuXG4gIGFuaW1hdGUoXG4gICAgZWxlbWVudDogYW55LFxuICAgIGtleWZyYW1lczogQXJyYXk8ybVTdHlsZURhdGFNYXA+LFxuICAgIGR1cmF0aW9uOiBudW1iZXIsXG4gICAgZGVsYXk6IG51bWJlcixcbiAgICBlYXNpbmc6IHN0cmluZyxcbiAgICBwcmV2aW91c1BsYXllcnM6IGFueVtdID0gW10sXG4gICk6IE1vY2tBbmltYXRpb25QbGF5ZXIge1xuICAgIGNvbnN0IHBsYXllciA9IG5ldyBNb2NrQW5pbWF0aW9uUGxheWVyKFxuICAgICAgZWxlbWVudCxcbiAgICAgIGtleWZyYW1lcyxcbiAgICAgIGR1cmF0aW9uLFxuICAgICAgZGVsYXksXG4gICAgICBlYXNpbmcsXG4gICAgICBwcmV2aW91c1BsYXllcnMsXG4gICAgKTtcbiAgICBNb2NrQW5pbWF0aW9uRHJpdmVyLmxvZy5wdXNoKDxBbmltYXRpb25QbGF5ZXI+cGxheWVyKTtcbiAgICByZXR1cm4gcGxheWVyO1xuICB9XG59XG5cbi8qKlxuICogQHB1YmxpY0FwaVxuICovXG5leHBvcnQgY2xhc3MgTW9ja0FuaW1hdGlvblBsYXllciBleHRlbmRzIE5vb3BBbmltYXRpb25QbGF5ZXIge1xuICBwcml2YXRlIF9fZmluaXNoZWQgPSBmYWxzZTtcbiAgcHJpdmF0ZSBfX3N0YXJ0ZWQgPSBmYWxzZTtcbiAgcHVibGljIHByZXZpb3VzU3R5bGVzOiDJtVN0eWxlRGF0YU1hcCA9IG5ldyBNYXAoKTtcbiAgcHJpdmF0ZSBfb25Jbml0Rm5zOiAoKCkgPT4gYW55KVtdID0gW107XG4gIHB1YmxpYyBjdXJyZW50U25hcHNob3Q6IMm1U3R5bGVEYXRhTWFwID0gbmV3IE1hcCgpO1xuICBwcml2YXRlIF9rZXlmcmFtZXM6IEFycmF5PMm1U3R5bGVEYXRhTWFwPiA9IFtdO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHB1YmxpYyBlbGVtZW50OiBhbnksXG4gICAgcHVibGljIGtleWZyYW1lczogQXJyYXk8ybVTdHlsZURhdGFNYXA+LFxuICAgIHB1YmxpYyBkdXJhdGlvbjogbnVtYmVyLFxuICAgIHB1YmxpYyBkZWxheTogbnVtYmVyLFxuICAgIHB1YmxpYyBlYXNpbmc6IHN0cmluZyxcbiAgICBwdWJsaWMgcHJldmlvdXNQbGF5ZXJzOiBhbnlbXSxcbiAgKSB7XG4gICAgc3VwZXIoZHVyYXRpb24sIGRlbGF5KTtcblxuICAgIHRoaXMuX2tleWZyYW1lcyA9IG5vcm1hbGl6ZUtleWZyYW1lcyhrZXlmcmFtZXMpO1xuXG4gICAgaWYgKGFsbG93UHJldmlvdXNQbGF5ZXJTdHlsZXNNZXJnZShkdXJhdGlvbiwgZGVsYXkpKSB7XG4gICAgICBwcmV2aW91c1BsYXllcnMuZm9yRWFjaCgocGxheWVyKSA9PiB7XG4gICAgICAgIGlmIChwbGF5ZXIgaW5zdGFuY2VvZiBNb2NrQW5pbWF0aW9uUGxheWVyKSB7XG4gICAgICAgICAgY29uc3Qgc3R5bGVzID0gcGxheWVyLmN1cnJlbnRTbmFwc2hvdDtcbiAgICAgICAgICBzdHlsZXMuZm9yRWFjaCgodmFsLCBwcm9wKSA9PiB0aGlzLnByZXZpb3VzU3R5bGVzLnNldChwcm9wLCB2YWwpKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgLyoqIEBpbnRlcm5hbCAqL1xuICBvbkluaXQoZm46ICgpID0+IGFueSkge1xuICAgIHRoaXMuX29uSW5pdEZucy5wdXNoKGZuKTtcbiAgfVxuXG4gIC8qKiBAaW50ZXJuYWwgKi9cbiAgb3ZlcnJpZGUgaW5pdCgpIHtcbiAgICBzdXBlci5pbml0KCk7XG4gICAgdGhpcy5fb25Jbml0Rm5zLmZvckVhY2goKGZuKSA9PiBmbigpKTtcbiAgICB0aGlzLl9vbkluaXRGbnMgPSBbXTtcbiAgfVxuXG4gIG92ZXJyaWRlIHJlc2V0KCkge1xuICAgIHN1cGVyLnJlc2V0KCk7XG4gICAgdGhpcy5fX3N0YXJ0ZWQgPSBmYWxzZTtcbiAgfVxuXG4gIG92ZXJyaWRlIGZpbmlzaCgpOiB2b2lkIHtcbiAgICBzdXBlci5maW5pc2goKTtcbiAgICB0aGlzLl9fZmluaXNoZWQgPSB0cnVlO1xuICB9XG5cbiAgb3ZlcnJpZGUgZGVzdHJveSgpOiB2b2lkIHtcbiAgICBzdXBlci5kZXN0cm95KCk7XG4gICAgdGhpcy5fX2ZpbmlzaGVkID0gdHJ1ZTtcbiAgfVxuXG4gIC8qKiBAaW50ZXJuYWwgKi9cbiAgdHJpZ2dlck1pY3JvdGFzaygpIHt9XG5cbiAgb3ZlcnJpZGUgcGxheSgpOiB2b2lkIHtcbiAgICBzdXBlci5wbGF5KCk7XG4gICAgdGhpcy5fX3N0YXJ0ZWQgPSB0cnVlO1xuICB9XG5cbiAgb3ZlcnJpZGUgaGFzU3RhcnRlZCgpIHtcbiAgICByZXR1cm4gdGhpcy5fX3N0YXJ0ZWQ7XG4gIH1cblxuICBiZWZvcmVEZXN0cm95KCkge1xuICAgIGNvbnN0IGNhcHR1cmVzOiDJtVN0eWxlRGF0YU1hcCA9IG5ldyBNYXAoKTtcblxuICAgIHRoaXMucHJldmlvdXNTdHlsZXMuZm9yRWFjaCgodmFsLCBwcm9wKSA9PiBjYXB0dXJlcy5zZXQocHJvcCwgdmFsKSk7XG5cbiAgICBpZiAodGhpcy5oYXNTdGFydGVkKCkpIHtcbiAgICAgIC8vIHdoZW4gYXNzZW1ibGluZyB0aGUgY2FwdHVyZWQgc3R5bGVzLCBpdCdzIGltcG9ydGFudCB0aGF0XG4gICAgICAvLyB3ZSBidWlsZCB0aGUga2V5ZnJhbWUgc3R5bGVzIGluIHRoZSBmb2xsb3dpbmcgb3JkZXI6XG4gICAgICAvLyB7b3RoZXIgc3R5bGVzIHdpdGhpbiBrZXlmcmFtZXMsIC4uLiBwcmV2aW91c1N0eWxlcyB9XG4gICAgICB0aGlzLl9rZXlmcmFtZXMuZm9yRWFjaCgoa2YpID0+IHtcbiAgICAgICAgZm9yIChsZXQgW3Byb3AsIHZhbF0gb2Yga2YpIHtcbiAgICAgICAgICBpZiAocHJvcCAhPT0gJ29mZnNldCcpIHtcbiAgICAgICAgICAgIGNhcHR1cmVzLnNldChwcm9wLCB0aGlzLl9fZmluaXNoZWQgPyB2YWwgOiBBVVRPX1NUWUxFKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHRoaXMuY3VycmVudFNuYXBzaG90ID0gY2FwdHVyZXM7XG4gIH1cbn1cbiJdfQ==