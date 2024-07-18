/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { defaultEquals } from './equality';
import { consumerAfterComputation, consumerBeforeComputation, producerAccessed, producerUpdateValueVersion, REACTIVE_NODE, SIGNAL, } from './graph';
/**
 * Create a computed signal which derives a reactive value from an expression.
 */
export function createComputed(computation) {
    const node = Object.create(COMPUTED_NODE);
    node.computation = computation;
    const computed = () => {
        // Check if the value needs updating before returning it.
        producerUpdateValueVersion(node);
        // Record that someone looked at this signal.
        producerAccessed(node);
        if (node.value === ERRORED) {
            throw node.error;
        }
        return node.value;
    };
    computed[SIGNAL] = node;
    return computed;
}
/**
 * A dedicated symbol used before a computed value has been calculated for the first time.
 * Explicitly typed as `any` so we can use it as signal's value.
 */
const UNSET = /* @__PURE__ */ Symbol('UNSET');
/**
 * A dedicated symbol used in place of a computed signal value to indicate that a given computation
 * is in progress. Used to detect cycles in computation chains.
 * Explicitly typed as `any` so we can use it as signal's value.
 */
const COMPUTING = /* @__PURE__ */ Symbol('COMPUTING');
/**
 * A dedicated symbol used in place of a computed signal value to indicate that a given computation
 * failed. The thrown error is cached until the computation gets dirty again.
 * Explicitly typed as `any` so we can use it as signal's value.
 */
const ERRORED = /* @__PURE__ */ Symbol('ERRORED');
// Note: Using an IIFE here to ensure that the spread assignment is not considered
// a side-effect, ending up preserving `COMPUTED_NODE` and `REACTIVE_NODE`.
// TODO: remove when https://github.com/evanw/esbuild/issues/3392 is resolved.
const COMPUTED_NODE = /* @__PURE__ */ (() => {
    return {
        ...REACTIVE_NODE,
        value: UNSET,
        dirty: true,
        error: null,
        equal: defaultEquals,
        producerMustRecompute(node) {
            // Force a recomputation if there's no current value, or if the current value is in the
            // process of being calculated (which should throw an error).
            return node.value === UNSET || node.value === COMPUTING;
        },
        producerRecomputeValue(node) {
            if (node.value === COMPUTING) {
                // Our computation somehow led to a cyclic read of itself.
                throw new Error('Detected cycle in computations.');
            }
            const oldValue = node.value;
            node.value = COMPUTING;
            const prevConsumer = consumerBeforeComputation(node);
            let newValue;
            try {
                newValue = node.computation();
            }
            catch (err) {
                newValue = ERRORED;
                node.error = err;
            }
            finally {
                consumerAfterComputation(node, prevConsumer);
            }
            if (oldValue !== UNSET &&
                oldValue !== ERRORED &&
                newValue !== ERRORED &&
                node.equal(oldValue, newValue)) {
                // No change to `valueVersion` - old and new values are
                // semantically equivalent.
                node.value = oldValue;
                return;
            }
            node.value = newValue;
            node.version++;
        },
    };
})();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcHV0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb3JlL3ByaW1pdGl2ZXMvc2lnbmFscy9zcmMvY29tcHV0ZWQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUFDLGFBQWEsRUFBa0IsTUFBTSxZQUFZLENBQUM7QUFDMUQsT0FBTyxFQUNMLHdCQUF3QixFQUN4Qix5QkFBeUIsRUFDekIsZ0JBQWdCLEVBQ2hCLDBCQUEwQixFQUMxQixhQUFhLEVBRWIsTUFBTSxHQUNQLE1BQU0sU0FBUyxDQUFDO0FBZ0NqQjs7R0FFRztBQUNILE1BQU0sVUFBVSxjQUFjLENBQUksV0FBb0I7SUFDcEQsTUFBTSxJQUFJLEdBQW9CLE1BQU0sQ0FBQyxNQUFNLENBQUMsYUFBYSxDQUFDLENBQUM7SUFDM0QsSUFBSSxDQUFDLFdBQVcsR0FBRyxXQUFXLENBQUM7SUFFL0IsTUFBTSxRQUFRLEdBQUcsR0FBRyxFQUFFO1FBQ3BCLHlEQUF5RDtRQUN6RCwwQkFBMEIsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUVqQyw2Q0FBNkM7UUFDN0MsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLENBQUM7UUFFdkIsSUFBSSxJQUFJLENBQUMsS0FBSyxLQUFLLE9BQU8sRUFBRSxDQUFDO1lBQzNCLE1BQU0sSUFBSSxDQUFDLEtBQUssQ0FBQztRQUNuQixDQUFDO1FBRUQsT0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDO0lBQ3BCLENBQUMsQ0FBQztJQUNELFFBQThCLENBQUMsTUFBTSxDQUFDLEdBQUcsSUFBSSxDQUFDO0lBQy9DLE9BQU8sUUFBd0MsQ0FBQztBQUNsRCxDQUFDO0FBRUQ7OztHQUdHO0FBQ0gsTUFBTSxLQUFLLEdBQVEsZUFBZSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQztBQUVuRDs7OztHQUlHO0FBQ0gsTUFBTSxTQUFTLEdBQVEsZUFBZSxDQUFDLE1BQU0sQ0FBQyxXQUFXLENBQUMsQ0FBQztBQUUzRDs7OztHQUlHO0FBQ0gsTUFBTSxPQUFPLEdBQVEsZUFBZSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQztBQUV2RCxrRkFBa0Y7QUFDbEYsMkVBQTJFO0FBQzNFLDhFQUE4RTtBQUM5RSxNQUFNLGFBQWEsR0FBRyxlQUFlLENBQUMsQ0FBQyxHQUFHLEVBQUU7SUFDMUMsT0FBTztRQUNMLEdBQUcsYUFBYTtRQUNoQixLQUFLLEVBQUUsS0FBSztRQUNaLEtBQUssRUFBRSxJQUFJO1FBQ1gsS0FBSyxFQUFFLElBQUk7UUFDWCxLQUFLLEVBQUUsYUFBYTtRQUVwQixxQkFBcUIsQ0FBQyxJQUEyQjtZQUMvQyx1RkFBdUY7WUFDdkYsNkRBQTZEO1lBQzdELE9BQU8sSUFBSSxDQUFDLEtBQUssS0FBSyxLQUFLLElBQUksSUFBSSxDQUFDLEtBQUssS0FBSyxTQUFTLENBQUM7UUFDMUQsQ0FBQztRQUVELHNCQUFzQixDQUFDLElBQTJCO1lBQ2hELElBQUksSUFBSSxDQUFDLEtBQUssS0FBSyxTQUFTLEVBQUUsQ0FBQztnQkFDN0IsMERBQTBEO2dCQUMxRCxNQUFNLElBQUksS0FBSyxDQUFDLGlDQUFpQyxDQUFDLENBQUM7WUFDckQsQ0FBQztZQUVELE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUM7WUFDNUIsSUFBSSxDQUFDLEtBQUssR0FBRyxTQUFTLENBQUM7WUFFdkIsTUFBTSxZQUFZLEdBQUcseUJBQXlCLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDckQsSUFBSSxRQUFpQixDQUFDO1lBQ3RCLElBQUksQ0FBQztnQkFDSCxRQUFRLEdBQUcsSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO1lBQ2hDLENBQUM7WUFBQyxPQUFPLEdBQUcsRUFBRSxDQUFDO2dCQUNiLFFBQVEsR0FBRyxPQUFPLENBQUM7Z0JBQ25CLElBQUksQ0FBQyxLQUFLLEdBQUcsR0FBRyxDQUFDO1lBQ25CLENBQUM7b0JBQVMsQ0FBQztnQkFDVCx3QkFBd0IsQ0FBQyxJQUFJLEVBQUUsWUFBWSxDQUFDLENBQUM7WUFDL0MsQ0FBQztZQUVELElBQ0UsUUFBUSxLQUFLLEtBQUs7Z0JBQ2xCLFFBQVEsS0FBSyxPQUFPO2dCQUNwQixRQUFRLEtBQUssT0FBTztnQkFDcEIsSUFBSSxDQUFDLEtBQUssQ0FBQyxRQUFRLEVBQUUsUUFBUSxDQUFDLEVBQzlCLENBQUM7Z0JBQ0QsdURBQXVEO2dCQUN2RCwyQkFBMkI7Z0JBQzNCLElBQUksQ0FBQyxLQUFLLEdBQUcsUUFBUSxDQUFDO2dCQUN0QixPQUFPO1lBQ1QsQ0FBQztZQUVELElBQUksQ0FBQyxLQUFLLEdBQUcsUUFBUSxDQUFDO1lBQ3RCLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUNqQixDQUFDO0tBQ0YsQ0FBQztBQUNKLENBQUMsQ0FBQyxFQUFFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtkZWZhdWx0RXF1YWxzLCBWYWx1ZUVxdWFsaXR5Rm59IGZyb20gJy4vZXF1YWxpdHknO1xuaW1wb3J0IHtcbiAgY29uc3VtZXJBZnRlckNvbXB1dGF0aW9uLFxuICBjb25zdW1lckJlZm9yZUNvbXB1dGF0aW9uLFxuICBwcm9kdWNlckFjY2Vzc2VkLFxuICBwcm9kdWNlclVwZGF0ZVZhbHVlVmVyc2lvbixcbiAgUkVBQ1RJVkVfTk9ERSxcbiAgUmVhY3RpdmVOb2RlLFxuICBTSUdOQUwsXG59IGZyb20gJy4vZ3JhcGgnO1xuXG4vKipcbiAqIEEgY29tcHV0YXRpb24sIHdoaWNoIGRlcml2ZXMgYSB2YWx1ZSBmcm9tIGEgZGVjbGFyYXRpdmUgcmVhY3RpdmUgZXhwcmVzc2lvbi5cbiAqXG4gKiBgQ29tcHV0ZWRgcyBhcmUgYm90aCBwcm9kdWNlcnMgYW5kIGNvbnN1bWVycyBvZiByZWFjdGl2aXR5LlxuICovXG5leHBvcnQgaW50ZXJmYWNlIENvbXB1dGVkTm9kZTxUPiBleHRlbmRzIFJlYWN0aXZlTm9kZSB7XG4gIC8qKlxuICAgKiBDdXJyZW50IHZhbHVlIG9mIHRoZSBjb21wdXRhdGlvbiwgb3Igb25lIG9mIHRoZSBzZW50aW5lbCB2YWx1ZXMgYWJvdmUgKGBVTlNFVGAsIGBDT01QVVRJTkdgLFxuICAgKiBgRVJST1JgKS5cbiAgICovXG4gIHZhbHVlOiBUO1xuXG4gIC8qKlxuICAgKiBJZiBgdmFsdWVgIGlzIGBFUlJPUkVEYCwgdGhlIGVycm9yIGNhdWdodCBmcm9tIHRoZSBsYXN0IGNvbXB1dGF0aW9uIGF0dGVtcHQgd2hpY2ggd2lsbFxuICAgKiBiZSByZS10aHJvd24uXG4gICAqL1xuICBlcnJvcjogdW5rbm93bjtcblxuICAvKipcbiAgICogVGhlIGNvbXB1dGF0aW9uIGZ1bmN0aW9uIHdoaWNoIHdpbGwgcHJvZHVjZSBhIG5ldyB2YWx1ZS5cbiAgICovXG4gIGNvbXB1dGF0aW9uOiAoKSA9PiBUO1xuXG4gIGVxdWFsOiBWYWx1ZUVxdWFsaXR5Rm48VD47XG59XG5cbmV4cG9ydCB0eXBlIENvbXB1dGVkR2V0dGVyPFQ+ID0gKCgpID0+IFQpICYge1xuICBbU0lHTkFMXTogQ29tcHV0ZWROb2RlPFQ+O1xufTtcblxuLyoqXG4gKiBDcmVhdGUgYSBjb21wdXRlZCBzaWduYWwgd2hpY2ggZGVyaXZlcyBhIHJlYWN0aXZlIHZhbHVlIGZyb20gYW4gZXhwcmVzc2lvbi5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUNvbXB1dGVkPFQ+KGNvbXB1dGF0aW9uOiAoKSA9PiBUKTogQ29tcHV0ZWRHZXR0ZXI8VD4ge1xuICBjb25zdCBub2RlOiBDb21wdXRlZE5vZGU8VD4gPSBPYmplY3QuY3JlYXRlKENPTVBVVEVEX05PREUpO1xuICBub2RlLmNvbXB1dGF0aW9uID0gY29tcHV0YXRpb247XG5cbiAgY29uc3QgY29tcHV0ZWQgPSAoKSA9PiB7XG4gICAgLy8gQ2hlY2sgaWYgdGhlIHZhbHVlIG5lZWRzIHVwZGF0aW5nIGJlZm9yZSByZXR1cm5pbmcgaXQuXG4gICAgcHJvZHVjZXJVcGRhdGVWYWx1ZVZlcnNpb24obm9kZSk7XG5cbiAgICAvLyBSZWNvcmQgdGhhdCBzb21lb25lIGxvb2tlZCBhdCB0aGlzIHNpZ25hbC5cbiAgICBwcm9kdWNlckFjY2Vzc2VkKG5vZGUpO1xuXG4gICAgaWYgKG5vZGUudmFsdWUgPT09IEVSUk9SRUQpIHtcbiAgICAgIHRocm93IG5vZGUuZXJyb3I7XG4gICAgfVxuXG4gICAgcmV0dXJuIG5vZGUudmFsdWU7XG4gIH07XG4gIChjb21wdXRlZCBhcyBDb21wdXRlZEdldHRlcjxUPilbU0lHTkFMXSA9IG5vZGU7XG4gIHJldHVybiBjb21wdXRlZCBhcyB1bmtub3duIGFzIENvbXB1dGVkR2V0dGVyPFQ+O1xufVxuXG4vKipcbiAqIEEgZGVkaWNhdGVkIHN5bWJvbCB1c2VkIGJlZm9yZSBhIGNvbXB1dGVkIHZhbHVlIGhhcyBiZWVuIGNhbGN1bGF0ZWQgZm9yIHRoZSBmaXJzdCB0aW1lLlxuICogRXhwbGljaXRseSB0eXBlZCBhcyBgYW55YCBzbyB3ZSBjYW4gdXNlIGl0IGFzIHNpZ25hbCdzIHZhbHVlLlxuICovXG5jb25zdCBVTlNFVDogYW55ID0gLyogQF9fUFVSRV9fICovIFN5bWJvbCgnVU5TRVQnKTtcblxuLyoqXG4gKiBBIGRlZGljYXRlZCBzeW1ib2wgdXNlZCBpbiBwbGFjZSBvZiBhIGNvbXB1dGVkIHNpZ25hbCB2YWx1ZSB0byBpbmRpY2F0ZSB0aGF0IGEgZ2l2ZW4gY29tcHV0YXRpb25cbiAqIGlzIGluIHByb2dyZXNzLiBVc2VkIHRvIGRldGVjdCBjeWNsZXMgaW4gY29tcHV0YXRpb24gY2hhaW5zLlxuICogRXhwbGljaXRseSB0eXBlZCBhcyBgYW55YCBzbyB3ZSBjYW4gdXNlIGl0IGFzIHNpZ25hbCdzIHZhbHVlLlxuICovXG5jb25zdCBDT01QVVRJTkc6IGFueSA9IC8qIEBfX1BVUkVfXyAqLyBTeW1ib2woJ0NPTVBVVElORycpO1xuXG4vKipcbiAqIEEgZGVkaWNhdGVkIHN5bWJvbCB1c2VkIGluIHBsYWNlIG9mIGEgY29tcHV0ZWQgc2lnbmFsIHZhbHVlIHRvIGluZGljYXRlIHRoYXQgYSBnaXZlbiBjb21wdXRhdGlvblxuICogZmFpbGVkLiBUaGUgdGhyb3duIGVycm9yIGlzIGNhY2hlZCB1bnRpbCB0aGUgY29tcHV0YXRpb24gZ2V0cyBkaXJ0eSBhZ2Fpbi5cbiAqIEV4cGxpY2l0bHkgdHlwZWQgYXMgYGFueWAgc28gd2UgY2FuIHVzZSBpdCBhcyBzaWduYWwncyB2YWx1ZS5cbiAqL1xuY29uc3QgRVJST1JFRDogYW55ID0gLyogQF9fUFVSRV9fICovIFN5bWJvbCgnRVJST1JFRCcpO1xuXG4vLyBOb3RlOiBVc2luZyBhbiBJSUZFIGhlcmUgdG8gZW5zdXJlIHRoYXQgdGhlIHNwcmVhZCBhc3NpZ25tZW50IGlzIG5vdCBjb25zaWRlcmVkXG4vLyBhIHNpZGUtZWZmZWN0LCBlbmRpbmcgdXAgcHJlc2VydmluZyBgQ09NUFVURURfTk9ERWAgYW5kIGBSRUFDVElWRV9OT0RFYC5cbi8vIFRPRE86IHJlbW92ZSB3aGVuIGh0dHBzOi8vZ2l0aHViLmNvbS9ldmFudy9lc2J1aWxkL2lzc3Vlcy8zMzkyIGlzIHJlc29sdmVkLlxuY29uc3QgQ09NUFVURURfTk9ERSA9IC8qIEBfX1BVUkVfXyAqLyAoKCkgPT4ge1xuICByZXR1cm4ge1xuICAgIC4uLlJFQUNUSVZFX05PREUsXG4gICAgdmFsdWU6IFVOU0VULFxuICAgIGRpcnR5OiB0cnVlLFxuICAgIGVycm9yOiBudWxsLFxuICAgIGVxdWFsOiBkZWZhdWx0RXF1YWxzLFxuXG4gICAgcHJvZHVjZXJNdXN0UmVjb21wdXRlKG5vZGU6IENvbXB1dGVkTm9kZTx1bmtub3duPik6IGJvb2xlYW4ge1xuICAgICAgLy8gRm9yY2UgYSByZWNvbXB1dGF0aW9uIGlmIHRoZXJlJ3Mgbm8gY3VycmVudCB2YWx1ZSwgb3IgaWYgdGhlIGN1cnJlbnQgdmFsdWUgaXMgaW4gdGhlXG4gICAgICAvLyBwcm9jZXNzIG9mIGJlaW5nIGNhbGN1bGF0ZWQgKHdoaWNoIHNob3VsZCB0aHJvdyBhbiBlcnJvcikuXG4gICAgICByZXR1cm4gbm9kZS52YWx1ZSA9PT0gVU5TRVQgfHwgbm9kZS52YWx1ZSA9PT0gQ09NUFVUSU5HO1xuICAgIH0sXG5cbiAgICBwcm9kdWNlclJlY29tcHV0ZVZhbHVlKG5vZGU6IENvbXB1dGVkTm9kZTx1bmtub3duPik6IHZvaWQge1xuICAgICAgaWYgKG5vZGUudmFsdWUgPT09IENPTVBVVElORykge1xuICAgICAgICAvLyBPdXIgY29tcHV0YXRpb24gc29tZWhvdyBsZWQgdG8gYSBjeWNsaWMgcmVhZCBvZiBpdHNlbGYuXG4gICAgICAgIHRocm93IG5ldyBFcnJvcignRGV0ZWN0ZWQgY3ljbGUgaW4gY29tcHV0YXRpb25zLicpO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBvbGRWYWx1ZSA9IG5vZGUudmFsdWU7XG4gICAgICBub2RlLnZhbHVlID0gQ09NUFVUSU5HO1xuXG4gICAgICBjb25zdCBwcmV2Q29uc3VtZXIgPSBjb25zdW1lckJlZm9yZUNvbXB1dGF0aW9uKG5vZGUpO1xuICAgICAgbGV0IG5ld1ZhbHVlOiB1bmtub3duO1xuICAgICAgdHJ5IHtcbiAgICAgICAgbmV3VmFsdWUgPSBub2RlLmNvbXB1dGF0aW9uKCk7XG4gICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgbmV3VmFsdWUgPSBFUlJPUkVEO1xuICAgICAgICBub2RlLmVycm9yID0gZXJyO1xuICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgY29uc3VtZXJBZnRlckNvbXB1dGF0aW9uKG5vZGUsIHByZXZDb25zdW1lcik7XG4gICAgICB9XG5cbiAgICAgIGlmIChcbiAgICAgICAgb2xkVmFsdWUgIT09IFVOU0VUICYmXG4gICAgICAgIG9sZFZhbHVlICE9PSBFUlJPUkVEICYmXG4gICAgICAgIG5ld1ZhbHVlICE9PSBFUlJPUkVEICYmXG4gICAgICAgIG5vZGUuZXF1YWwob2xkVmFsdWUsIG5ld1ZhbHVlKVxuICAgICAgKSB7XG4gICAgICAgIC8vIE5vIGNoYW5nZSB0byBgdmFsdWVWZXJzaW9uYCAtIG9sZCBhbmQgbmV3IHZhbHVlcyBhcmVcbiAgICAgICAgLy8gc2VtYW50aWNhbGx5IGVxdWl2YWxlbnQuXG4gICAgICAgIG5vZGUudmFsdWUgPSBvbGRWYWx1ZTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBub2RlLnZhbHVlID0gbmV3VmFsdWU7XG4gICAgICBub2RlLnZlcnNpb24rKztcbiAgICB9LFxuICB9O1xufSkoKTtcbiJdfQ==