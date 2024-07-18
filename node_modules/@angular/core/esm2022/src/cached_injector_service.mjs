/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { ɵɵdefineInjectable as defineInjectable } from './di/interface/defs';
import { createEnvironmentInjector } from './render3/ng_module_ref';
/**
 * A service used by the framework to create and cache injector instances.
 *
 * This service is used to create a single injector instance for each defer
 * block definition, to avoid creating an injector for each defer block instance
 * of a certain type.
 */
export class CachedInjectorService {
    constructor() {
        this.cachedInjectors = new Map();
    }
    getOrCreateInjector(key, parentInjector, providers, debugName) {
        if (!this.cachedInjectors.has(key)) {
            const injector = providers.length > 0
                ? createEnvironmentInjector(providers, parentInjector, debugName)
                : null;
            this.cachedInjectors.set(key, injector);
        }
        return this.cachedInjectors.get(key);
    }
    ngOnDestroy() {
        try {
            for (const injector of this.cachedInjectors.values()) {
                if (injector !== null) {
                    injector.destroy();
                }
            }
        }
        finally {
            this.cachedInjectors.clear();
        }
    }
    /** @nocollapse */
    static { this.ɵprov = defineInjectable({
        token: CachedInjectorService,
        providedIn: 'environment',
        factory: () => new CachedInjectorService(),
    }); }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2FjaGVkX2luamVjdG9yX3NlcnZpY2UuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb3JlL3NyYy9jYWNoZWRfaW5qZWN0b3Jfc2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEVBQUMsa0JBQWtCLElBQUksZ0JBQWdCLEVBQUMsTUFBTSxxQkFBcUIsQ0FBQztBQUkzRSxPQUFPLEVBQUMseUJBQXlCLEVBQUMsTUFBTSx5QkFBeUIsQ0FBQztBQUVsRTs7Ozs7O0dBTUc7QUFDSCxNQUFNLE9BQU8scUJBQXFCO0lBQWxDO1FBQ1Usb0JBQWUsR0FBRyxJQUFJLEdBQUcsRUFBdUMsQ0FBQztJQW9DM0UsQ0FBQztJQWxDQyxtQkFBbUIsQ0FDakIsR0FBWSxFQUNaLGNBQW1DLEVBQ25DLFNBQXFCLEVBQ3JCLFNBQWtCO1FBRWxCLElBQUksQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDO1lBQ25DLE1BQU0sUUFBUSxHQUNaLFNBQVMsQ0FBQyxNQUFNLEdBQUcsQ0FBQztnQkFDbEIsQ0FBQyxDQUFDLHlCQUF5QixDQUFDLFNBQVMsRUFBRSxjQUFjLEVBQUUsU0FBUyxDQUFDO2dCQUNqRSxDQUFDLENBQUMsSUFBSSxDQUFDO1lBQ1gsSUFBSSxDQUFDLGVBQWUsQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLFFBQVEsQ0FBQyxDQUFDO1FBQzFDLENBQUM7UUFDRCxPQUFPLElBQUksQ0FBQyxlQUFlLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBRSxDQUFDO0lBQ3hDLENBQUM7SUFFRCxXQUFXO1FBQ1QsSUFBSSxDQUFDO1lBQ0gsS0FBSyxNQUFNLFFBQVEsSUFBSSxJQUFJLENBQUMsZUFBZSxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUM7Z0JBQ3JELElBQUksUUFBUSxLQUFLLElBQUksRUFBRSxDQUFDO29CQUN0QixRQUFRLENBQUMsT0FBTyxFQUFFLENBQUM7Z0JBQ3JCLENBQUM7WUFDSCxDQUFDO1FBQ0gsQ0FBQztnQkFBUyxDQUFDO1lBQ1QsSUFBSSxDQUFDLGVBQWUsQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUMvQixDQUFDO0lBQ0gsQ0FBQztJQUVELGtCQUFrQjthQUNYLFVBQUssR0FBNkIsZ0JBQWdCLENBQUM7UUFDeEQsS0FBSyxFQUFFLHFCQUFxQjtRQUM1QixVQUFVLEVBQUUsYUFBYTtRQUN6QixPQUFPLEVBQUUsR0FBRyxFQUFFLENBQUMsSUFBSSxxQkFBcUIsRUFBRTtLQUMzQyxDQUFDLEFBSlUsQ0FJVCIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge8m1ybVkZWZpbmVJbmplY3RhYmxlIGFzIGRlZmluZUluamVjdGFibGV9IGZyb20gJy4vZGkvaW50ZXJmYWNlL2RlZnMnO1xuaW1wb3J0IHtQcm92aWRlcn0gZnJvbSAnLi9kaS9pbnRlcmZhY2UvcHJvdmlkZXInO1xuaW1wb3J0IHtFbnZpcm9ubWVudEluamVjdG9yfSBmcm9tICcuL2RpL3IzX2luamVjdG9yJztcbmltcG9ydCB7T25EZXN0cm95fSBmcm9tICcuL2ludGVyZmFjZS9saWZlY3ljbGVfaG9va3MnO1xuaW1wb3J0IHtjcmVhdGVFbnZpcm9ubWVudEluamVjdG9yfSBmcm9tICcuL3JlbmRlcjMvbmdfbW9kdWxlX3JlZic7XG5cbi8qKlxuICogQSBzZXJ2aWNlIHVzZWQgYnkgdGhlIGZyYW1ld29yayB0byBjcmVhdGUgYW5kIGNhY2hlIGluamVjdG9yIGluc3RhbmNlcy5cbiAqXG4gKiBUaGlzIHNlcnZpY2UgaXMgdXNlZCB0byBjcmVhdGUgYSBzaW5nbGUgaW5qZWN0b3IgaW5zdGFuY2UgZm9yIGVhY2ggZGVmZXJcbiAqIGJsb2NrIGRlZmluaXRpb24sIHRvIGF2b2lkIGNyZWF0aW5nIGFuIGluamVjdG9yIGZvciBlYWNoIGRlZmVyIGJsb2NrIGluc3RhbmNlXG4gKiBvZiBhIGNlcnRhaW4gdHlwZS5cbiAqL1xuZXhwb3J0IGNsYXNzIENhY2hlZEluamVjdG9yU2VydmljZSBpbXBsZW1lbnRzIE9uRGVzdHJveSB7XG4gIHByaXZhdGUgY2FjaGVkSW5qZWN0b3JzID0gbmV3IE1hcDx1bmtub3duLCBFbnZpcm9ubWVudEluamVjdG9yIHwgbnVsbD4oKTtcblxuICBnZXRPckNyZWF0ZUluamVjdG9yKFxuICAgIGtleTogdW5rbm93bixcbiAgICBwYXJlbnRJbmplY3RvcjogRW52aXJvbm1lbnRJbmplY3RvcixcbiAgICBwcm92aWRlcnM6IFByb3ZpZGVyW10sXG4gICAgZGVidWdOYW1lPzogc3RyaW5nLFxuICApIHtcbiAgICBpZiAoIXRoaXMuY2FjaGVkSW5qZWN0b3JzLmhhcyhrZXkpKSB7XG4gICAgICBjb25zdCBpbmplY3RvciA9XG4gICAgICAgIHByb3ZpZGVycy5sZW5ndGggPiAwXG4gICAgICAgICAgPyBjcmVhdGVFbnZpcm9ubWVudEluamVjdG9yKHByb3ZpZGVycywgcGFyZW50SW5qZWN0b3IsIGRlYnVnTmFtZSlcbiAgICAgICAgICA6IG51bGw7XG4gICAgICB0aGlzLmNhY2hlZEluamVjdG9ycy5zZXQoa2V5LCBpbmplY3Rvcik7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmNhY2hlZEluamVjdG9ycy5nZXQoa2V5KSE7XG4gIH1cblxuICBuZ09uRGVzdHJveSgpIHtcbiAgICB0cnkge1xuICAgICAgZm9yIChjb25zdCBpbmplY3RvciBvZiB0aGlzLmNhY2hlZEluamVjdG9ycy52YWx1ZXMoKSkge1xuICAgICAgICBpZiAoaW5qZWN0b3IgIT09IG51bGwpIHtcbiAgICAgICAgICBpbmplY3Rvci5kZXN0cm95KCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGZpbmFsbHkge1xuICAgICAgdGhpcy5jYWNoZWRJbmplY3RvcnMuY2xlYXIoKTtcbiAgICB9XG4gIH1cblxuICAvKiogQG5vY29sbGFwc2UgKi9cbiAgc3RhdGljIMm1cHJvdiA9IC8qKiBAcHVyZU9yQnJlYWtNeUNvZGUgKi8gZGVmaW5lSW5qZWN0YWJsZSh7XG4gICAgdG9rZW46IENhY2hlZEluamVjdG9yU2VydmljZSxcbiAgICBwcm92aWRlZEluOiAnZW52aXJvbm1lbnQnLFxuICAgIGZhY3Rvcnk6ICgpID0+IG5ldyBDYWNoZWRJbmplY3RvclNlcnZpY2UoKSxcbiAgfSk7XG59XG4iXX0=