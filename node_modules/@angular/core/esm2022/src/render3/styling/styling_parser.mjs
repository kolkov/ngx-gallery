/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { assertEqual, throwError } from '../../util/assert';
// Global state of the parser. (This makes parser non-reentrant, but that is not an issue)
const parserState = {
    textEnd: 0,
    key: 0,
    keyEnd: 0,
    value: 0,
    valueEnd: 0,
};
/**
 * Retrieves the last parsed `key` of style.
 * @param text the text to substring the key from.
 */
export function getLastParsedKey(text) {
    return text.substring(parserState.key, parserState.keyEnd);
}
/**
 * Retrieves the last parsed `value` of style.
 * @param text the text to substring the key from.
 */
export function getLastParsedValue(text) {
    return text.substring(parserState.value, parserState.valueEnd);
}
/**
 * Initializes `className` string for parsing and parses the first token.
 *
 * This function is intended to be used in this format:
 * ```
 * for (let i = parseClassName(text); i >= 0; i = parseClassNameNext(text, i)) {
 *   const key = getLastParsedKey();
 *   ...
 * }
 * ```
 * @param text `className` to parse
 * @returns index where the next invocation of `parseClassNameNext` should resume.
 */
export function parseClassName(text) {
    resetParserState(text);
    return parseClassNameNext(text, consumeWhitespace(text, 0, parserState.textEnd));
}
/**
 * Parses next `className` token.
 *
 * This function is intended to be used in this format:
 * ```
 * for (let i = parseClassName(text); i >= 0; i = parseClassNameNext(text, i)) {
 *   const key = getLastParsedKey();
 *   ...
 * }
 * ```
 *
 * @param text `className` to parse
 * @param index where the parsing should resume.
 * @returns index where the next invocation of `parseClassNameNext` should resume.
 */
export function parseClassNameNext(text, index) {
    const end = parserState.textEnd;
    if (end === index) {
        return -1;
    }
    index = parserState.keyEnd = consumeClassToken(text, (parserState.key = index), end);
    return consumeWhitespace(text, index, end);
}
/**
 * Initializes `cssText` string for parsing and parses the first key/values.
 *
 * This function is intended to be used in this format:
 * ```
 * for (let i = parseStyle(text); i >= 0; i = parseStyleNext(text, i))) {
 *   const key = getLastParsedKey();
 *   const value = getLastParsedValue();
 *   ...
 * }
 * ```
 * @param text `cssText` to parse
 * @returns index where the next invocation of `parseStyleNext` should resume.
 */
export function parseStyle(text) {
    resetParserState(text);
    return parseStyleNext(text, consumeWhitespace(text, 0, parserState.textEnd));
}
/**
 * Parses the next `cssText` key/values.
 *
 * This function is intended to be used in this format:
 * ```
 * for (let i = parseStyle(text); i >= 0; i = parseStyleNext(text, i))) {
 *   const key = getLastParsedKey();
 *   const value = getLastParsedValue();
 *   ...
 * }
 *
 * @param text `cssText` to parse
 * @param index where the parsing should resume.
 * @returns index where the next invocation of `parseStyleNext` should resume.
 */
export function parseStyleNext(text, startIndex) {
    const end = parserState.textEnd;
    let index = (parserState.key = consumeWhitespace(text, startIndex, end));
    if (end === index) {
        // we reached an end so just quit
        return -1;
    }
    index = parserState.keyEnd = consumeStyleKey(text, index, end);
    index = consumeSeparator(text, index, end, 58 /* CharCode.COLON */);
    index = parserState.value = consumeWhitespace(text, index, end);
    index = parserState.valueEnd = consumeStyleValue(text, index, end);
    return consumeSeparator(text, index, end, 59 /* CharCode.SEMI_COLON */);
}
/**
 * Reset the global state of the styling parser.
 * @param text The styling text to parse.
 */
export function resetParserState(text) {
    parserState.key = 0;
    parserState.keyEnd = 0;
    parserState.value = 0;
    parserState.valueEnd = 0;
    parserState.textEnd = text.length;
}
/**
 * Returns index of next non-whitespace character.
 *
 * @param text Text to scan
 * @param startIndex Starting index of character where the scan should start.
 * @param endIndex Ending index of character where the scan should end.
 * @returns Index of next non-whitespace character (May be the same as `start` if no whitespace at
 *          that location.)
 */
export function consumeWhitespace(text, startIndex, endIndex) {
    while (startIndex < endIndex && text.charCodeAt(startIndex) <= 32 /* CharCode.SPACE */) {
        startIndex++;
    }
    return startIndex;
}
/**
 * Returns index of last char in class token.
 *
 * @param text Text to scan
 * @param startIndex Starting index of character where the scan should start.
 * @param endIndex Ending index of character where the scan should end.
 * @returns Index after last char in class token.
 */
export function consumeClassToken(text, startIndex, endIndex) {
    while (startIndex < endIndex && text.charCodeAt(startIndex) > 32 /* CharCode.SPACE */) {
        startIndex++;
    }
    return startIndex;
}
/**
 * Consumes all of the characters belonging to style key and token.
 *
 * @param text Text to scan
 * @param startIndex Starting index of character where the scan should start.
 * @param endIndex Ending index of character where the scan should end.
 * @returns Index after last style key character.
 */
export function consumeStyleKey(text, startIndex, endIndex) {
    let ch;
    while (startIndex < endIndex &&
        ((ch = text.charCodeAt(startIndex)) === 45 /* CharCode.DASH */ ||
            ch === 95 /* CharCode.UNDERSCORE */ ||
            ((ch & -33 /* CharCode.UPPER_CASE */) >= 65 /* CharCode.A */ && (ch & -33 /* CharCode.UPPER_CASE */) <= 90 /* CharCode.Z */) ||
            (ch >= 48 /* CharCode.ZERO */ && ch <= 57 /* CharCode.NINE */))) {
        startIndex++;
    }
    return startIndex;
}
/**
 * Consumes all whitespace and the separator `:` after the style key.
 *
 * @param text Text to scan
 * @param startIndex Starting index of character where the scan should start.
 * @param endIndex Ending index of character where the scan should end.
 * @returns Index after separator and surrounding whitespace.
 */
export function consumeSeparator(text, startIndex, endIndex, separator) {
    startIndex = consumeWhitespace(text, startIndex, endIndex);
    if (startIndex < endIndex) {
        if (ngDevMode && text.charCodeAt(startIndex) !== separator) {
            malformedStyleError(text, String.fromCharCode(separator), startIndex);
        }
        startIndex++;
    }
    return startIndex;
}
/**
 * Consumes style value honoring `url()` and `""` text.
 *
 * @param text Text to scan
 * @param startIndex Starting index of character where the scan should start.
 * @param endIndex Ending index of character where the scan should end.
 * @returns Index after last style value character.
 */
export function consumeStyleValue(text, startIndex, endIndex) {
    let ch1 = -1; // 1st previous character
    let ch2 = -1; // 2nd previous character
    let ch3 = -1; // 3rd previous character
    let i = startIndex;
    let lastChIndex = i;
    while (i < endIndex) {
        const ch = text.charCodeAt(i++);
        if (ch === 59 /* CharCode.SEMI_COLON */) {
            return lastChIndex;
        }
        else if (ch === 34 /* CharCode.DOUBLE_QUOTE */ || ch === 39 /* CharCode.SINGLE_QUOTE */) {
            lastChIndex = i = consumeQuotedText(text, ch, i, endIndex);
        }
        else if (startIndex === i - 4 && // We have seen only 4 characters so far "URL(" (Ignore "foo_URL()")
            ch3 === 85 /* CharCode.U */ &&
            ch2 === 82 /* CharCode.R */ &&
            ch1 === 76 /* CharCode.L */ &&
            ch === 40 /* CharCode.OPEN_PAREN */) {
            lastChIndex = i = consumeQuotedText(text, 41 /* CharCode.CLOSE_PAREN */, i, endIndex);
        }
        else if (ch > 32 /* CharCode.SPACE */) {
            // if we have a non-whitespace character then capture its location
            lastChIndex = i;
        }
        ch3 = ch2;
        ch2 = ch1;
        ch1 = ch & -33 /* CharCode.UPPER_CASE */;
    }
    return lastChIndex;
}
/**
 * Consumes all of the quoted characters.
 *
 * @param text Text to scan
 * @param quoteCharCode CharCode of either `"` or `'` quote or `)` for `url(...)`.
 * @param startIndex Starting index of character where the scan should start.
 * @param endIndex Ending index of character where the scan should end.
 * @returns Index after quoted characters.
 */
export function consumeQuotedText(text, quoteCharCode, startIndex, endIndex) {
    let ch1 = -1; // 1st previous character
    let index = startIndex;
    while (index < endIndex) {
        const ch = text.charCodeAt(index++);
        if (ch == quoteCharCode && ch1 !== 92 /* CharCode.BACK_SLASH */) {
            return index;
        }
        if (ch == 92 /* CharCode.BACK_SLASH */ && ch1 === 92 /* CharCode.BACK_SLASH */) {
            // two back slashes cancel each other out. For example `"\\"` should properly end the
            // quotation. (It should not assume that the last `"` is escaped.)
            ch1 = 0;
        }
        else {
            ch1 = ch;
        }
    }
    throw ngDevMode
        ? malformedStyleError(text, String.fromCharCode(quoteCharCode), endIndex)
        : new Error();
}
function malformedStyleError(text, expecting, index) {
    ngDevMode && assertEqual(typeof text === 'string', true, 'String expected here');
    throw throwError(`Malformed style at location ${index} in string '` +
        text.substring(0, index) +
        '[>>' +
        text.substring(index, index + 1) +
        '<<]' +
        text.slice(index + 1) +
        `'. Expecting '${expecting}'.`);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3R5bGluZ19wYXJzZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb3JlL3NyYy9yZW5kZXIzL3N0eWxpbmcvc3R5bGluZ19wYXJzZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUFDLFdBQVcsRUFBRSxVQUFVLEVBQUMsTUFBTSxtQkFBbUIsQ0FBQztBQWtDMUQsMEZBQTBGO0FBQzFGLE1BQU0sV0FBVyxHQUFnQjtJQUMvQixPQUFPLEVBQUUsQ0FBQztJQUNWLEdBQUcsRUFBRSxDQUFDO0lBQ04sTUFBTSxFQUFFLENBQUM7SUFDVCxLQUFLLEVBQUUsQ0FBQztJQUNSLFFBQVEsRUFBRSxDQUFDO0NBQ1osQ0FBQztBQUVGOzs7R0FHRztBQUNILE1BQU0sVUFBVSxnQkFBZ0IsQ0FBQyxJQUFZO0lBQzNDLE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUMsR0FBRyxFQUFFLFdBQVcsQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUM3RCxDQUFDO0FBRUQ7OztHQUdHO0FBQ0gsTUFBTSxVQUFVLGtCQUFrQixDQUFDLElBQVk7SUFDN0MsT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDLFdBQVcsQ0FBQyxLQUFLLEVBQUUsV0FBVyxDQUFDLFFBQVEsQ0FBQyxDQUFDO0FBQ2pFLENBQUM7QUFFRDs7Ozs7Ozs7Ozs7O0dBWUc7QUFDSCxNQUFNLFVBQVUsY0FBYyxDQUFDLElBQVk7SUFDekMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDdkIsT0FBTyxrQkFBa0IsQ0FBQyxJQUFJLEVBQUUsaUJBQWlCLENBQUMsSUFBSSxFQUFFLENBQUMsRUFBRSxXQUFXLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztBQUNuRixDQUFDO0FBRUQ7Ozs7Ozs7Ozs7Ozs7O0dBY0c7QUFDSCxNQUFNLFVBQVUsa0JBQWtCLENBQUMsSUFBWSxFQUFFLEtBQWE7SUFDNUQsTUFBTSxHQUFHLEdBQUcsV0FBVyxDQUFDLE9BQU8sQ0FBQztJQUNoQyxJQUFJLEdBQUcsS0FBSyxLQUFLLEVBQUUsQ0FBQztRQUNsQixPQUFPLENBQUMsQ0FBQyxDQUFDO0lBQ1osQ0FBQztJQUNELEtBQUssR0FBRyxXQUFXLENBQUMsTUFBTSxHQUFHLGlCQUFpQixDQUFDLElBQUksRUFBRSxDQUFDLFdBQVcsQ0FBQyxHQUFHLEdBQUcsS0FBSyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUM7SUFDckYsT0FBTyxpQkFBaUIsQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0FBQzdDLENBQUM7QUFFRDs7Ozs7Ozs7Ozs7OztHQWFHO0FBQ0gsTUFBTSxVQUFVLFVBQVUsQ0FBQyxJQUFZO0lBQ3JDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3ZCLE9BQU8sY0FBYyxDQUFDLElBQUksRUFBRSxpQkFBaUIsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxFQUFFLFdBQVcsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO0FBQy9FLENBQUM7QUFFRDs7Ozs7Ozs7Ozs7Ozs7R0FjRztBQUNILE1BQU0sVUFBVSxjQUFjLENBQUMsSUFBWSxFQUFFLFVBQWtCO0lBQzdELE1BQU0sR0FBRyxHQUFHLFdBQVcsQ0FBQyxPQUFPLENBQUM7SUFDaEMsSUFBSSxLQUFLLEdBQUcsQ0FBQyxXQUFXLENBQUMsR0FBRyxHQUFHLGlCQUFpQixDQUFDLElBQUksRUFBRSxVQUFVLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQztJQUN6RSxJQUFJLEdBQUcsS0FBSyxLQUFLLEVBQUUsQ0FBQztRQUNsQixpQ0FBaUM7UUFDakMsT0FBTyxDQUFDLENBQUMsQ0FBQztJQUNaLENBQUM7SUFDRCxLQUFLLEdBQUcsV0FBVyxDQUFDLE1BQU0sR0FBRyxlQUFlLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQztJQUMvRCxLQUFLLEdBQUcsZ0JBQWdCLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxHQUFHLDBCQUFpQixDQUFDO0lBQzNELEtBQUssR0FBRyxXQUFXLENBQUMsS0FBSyxHQUFHLGlCQUFpQixDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUM7SUFDaEUsS0FBSyxHQUFHLFdBQVcsQ0FBQyxRQUFRLEdBQUcsaUJBQWlCLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQztJQUNuRSxPQUFPLGdCQUFnQixDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsR0FBRywrQkFBc0IsQ0FBQztBQUNqRSxDQUFDO0FBRUQ7OztHQUdHO0FBQ0gsTUFBTSxVQUFVLGdCQUFnQixDQUFDLElBQVk7SUFDM0MsV0FBVyxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUM7SUFDcEIsV0FBVyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUM7SUFDdkIsV0FBVyxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUM7SUFDdEIsV0FBVyxDQUFDLFFBQVEsR0FBRyxDQUFDLENBQUM7SUFDekIsV0FBVyxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDO0FBQ3BDLENBQUM7QUFFRDs7Ozs7Ozs7R0FRRztBQUNILE1BQU0sVUFBVSxpQkFBaUIsQ0FBQyxJQUFZLEVBQUUsVUFBa0IsRUFBRSxRQUFnQjtJQUNsRixPQUFPLFVBQVUsR0FBRyxRQUFRLElBQUksSUFBSSxDQUFDLFVBQVUsQ0FBQyxVQUFVLENBQUMsMkJBQWtCLEVBQUUsQ0FBQztRQUM5RSxVQUFVLEVBQUUsQ0FBQztJQUNmLENBQUM7SUFDRCxPQUFPLFVBQVUsQ0FBQztBQUNwQixDQUFDO0FBRUQ7Ozs7Ozs7R0FPRztBQUNILE1BQU0sVUFBVSxpQkFBaUIsQ0FBQyxJQUFZLEVBQUUsVUFBa0IsRUFBRSxRQUFnQjtJQUNsRixPQUFPLFVBQVUsR0FBRyxRQUFRLElBQUksSUFBSSxDQUFDLFVBQVUsQ0FBQyxVQUFVLENBQUMsMEJBQWlCLEVBQUUsQ0FBQztRQUM3RSxVQUFVLEVBQUUsQ0FBQztJQUNmLENBQUM7SUFDRCxPQUFPLFVBQVUsQ0FBQztBQUNwQixDQUFDO0FBRUQ7Ozs7Ozs7R0FPRztBQUNILE1BQU0sVUFBVSxlQUFlLENBQUMsSUFBWSxFQUFFLFVBQWtCLEVBQUUsUUFBZ0I7SUFDaEYsSUFBSSxFQUFVLENBQUM7SUFDZixPQUNFLFVBQVUsR0FBRyxRQUFRO1FBQ3JCLENBQUMsQ0FBQyxFQUFFLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxVQUFVLENBQUMsQ0FBQywyQkFBa0I7WUFDbkQsRUFBRSxpQ0FBd0I7WUFDMUIsQ0FBQyxDQUFDLEVBQUUsZ0NBQXNCLENBQUMsdUJBQWMsSUFBSSxDQUFDLEVBQUUsZ0NBQXNCLENBQUMsdUJBQWMsQ0FBQztZQUN0RixDQUFDLEVBQUUsMEJBQWlCLElBQUksRUFBRSwwQkFBaUIsQ0FBQyxDQUFDLEVBQy9DLENBQUM7UUFDRCxVQUFVLEVBQUUsQ0FBQztJQUNmLENBQUM7SUFDRCxPQUFPLFVBQVUsQ0FBQztBQUNwQixDQUFDO0FBRUQ7Ozs7Ozs7R0FPRztBQUNILE1BQU0sVUFBVSxnQkFBZ0IsQ0FDOUIsSUFBWSxFQUNaLFVBQWtCLEVBQ2xCLFFBQWdCLEVBQ2hCLFNBQWlCO0lBRWpCLFVBQVUsR0FBRyxpQkFBaUIsQ0FBQyxJQUFJLEVBQUUsVUFBVSxFQUFFLFFBQVEsQ0FBQyxDQUFDO0lBQzNELElBQUksVUFBVSxHQUFHLFFBQVEsRUFBRSxDQUFDO1FBQzFCLElBQUksU0FBUyxJQUFJLElBQUksQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDLEtBQUssU0FBUyxFQUFFLENBQUM7WUFDM0QsbUJBQW1CLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxZQUFZLENBQUMsU0FBUyxDQUFDLEVBQUUsVUFBVSxDQUFDLENBQUM7UUFDeEUsQ0FBQztRQUNELFVBQVUsRUFBRSxDQUFDO0lBQ2YsQ0FBQztJQUNELE9BQU8sVUFBVSxDQUFDO0FBQ3BCLENBQUM7QUFFRDs7Ozs7OztHQU9HO0FBQ0gsTUFBTSxVQUFVLGlCQUFpQixDQUFDLElBQVksRUFBRSxVQUFrQixFQUFFLFFBQWdCO0lBQ2xGLElBQUksR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMseUJBQXlCO0lBQ3ZDLElBQUksR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMseUJBQXlCO0lBQ3ZDLElBQUksR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMseUJBQXlCO0lBQ3ZDLElBQUksQ0FBQyxHQUFHLFVBQVUsQ0FBQztJQUNuQixJQUFJLFdBQVcsR0FBRyxDQUFDLENBQUM7SUFDcEIsT0FBTyxDQUFDLEdBQUcsUUFBUSxFQUFFLENBQUM7UUFDcEIsTUFBTSxFQUFFLEdBQVcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQ3hDLElBQUksRUFBRSxpQ0FBd0IsRUFBRSxDQUFDO1lBQy9CLE9BQU8sV0FBVyxDQUFDO1FBQ3JCLENBQUM7YUFBTSxJQUFJLEVBQUUsbUNBQTBCLElBQUksRUFBRSxtQ0FBMEIsRUFBRSxDQUFDO1lBQ3hFLFdBQVcsR0FBRyxDQUFDLEdBQUcsaUJBQWlCLENBQUMsSUFBSSxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFDN0QsQ0FBQzthQUFNLElBQ0wsVUFBVSxLQUFLLENBQUMsR0FBRyxDQUFDLElBQUksb0VBQW9FO1lBQzVGLEdBQUcsd0JBQWU7WUFDbEIsR0FBRyx3QkFBZTtZQUNsQixHQUFHLHdCQUFlO1lBQ2xCLEVBQUUsaUNBQXdCLEVBQzFCLENBQUM7WUFDRCxXQUFXLEdBQUcsQ0FBQyxHQUFHLGlCQUFpQixDQUFDLElBQUksaUNBQXdCLENBQUMsRUFBRSxRQUFRLENBQUMsQ0FBQztRQUMvRSxDQUFDO2FBQU0sSUFBSSxFQUFFLDBCQUFpQixFQUFFLENBQUM7WUFDL0Isa0VBQWtFO1lBQ2xFLFdBQVcsR0FBRyxDQUFDLENBQUM7UUFDbEIsQ0FBQztRQUNELEdBQUcsR0FBRyxHQUFHLENBQUM7UUFDVixHQUFHLEdBQUcsR0FBRyxDQUFDO1FBQ1YsR0FBRyxHQUFHLEVBQUUsZ0NBQXNCLENBQUM7SUFDakMsQ0FBQztJQUNELE9BQU8sV0FBVyxDQUFDO0FBQ3JCLENBQUM7QUFFRDs7Ozs7Ozs7R0FRRztBQUNILE1BQU0sVUFBVSxpQkFBaUIsQ0FDL0IsSUFBWSxFQUNaLGFBQXFCLEVBQ3JCLFVBQWtCLEVBQ2xCLFFBQWdCO0lBRWhCLElBQUksR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMseUJBQXlCO0lBQ3ZDLElBQUksS0FBSyxHQUFHLFVBQVUsQ0FBQztJQUN2QixPQUFPLEtBQUssR0FBRyxRQUFRLEVBQUUsQ0FBQztRQUN4QixNQUFNLEVBQUUsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUM7UUFDcEMsSUFBSSxFQUFFLElBQUksYUFBYSxJQUFJLEdBQUcsaUNBQXdCLEVBQUUsQ0FBQztZQUN2RCxPQUFPLEtBQUssQ0FBQztRQUNmLENBQUM7UUFDRCxJQUFJLEVBQUUsZ0NBQXVCLElBQUksR0FBRyxpQ0FBd0IsRUFBRSxDQUFDO1lBQzdELHFGQUFxRjtZQUNyRixrRUFBa0U7WUFDbEUsR0FBRyxHQUFHLENBQUMsQ0FBQztRQUNWLENBQUM7YUFBTSxDQUFDO1lBQ04sR0FBRyxHQUFHLEVBQUUsQ0FBQztRQUNYLENBQUM7SUFDSCxDQUFDO0lBQ0QsTUFBTSxTQUFTO1FBQ2IsQ0FBQyxDQUFDLG1CQUFtQixDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsWUFBWSxDQUFDLGFBQWEsQ0FBQyxFQUFFLFFBQVEsQ0FBQztRQUN6RSxDQUFDLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQztBQUNsQixDQUFDO0FBRUQsU0FBUyxtQkFBbUIsQ0FBQyxJQUFZLEVBQUUsU0FBaUIsRUFBRSxLQUFhO0lBQ3pFLFNBQVMsSUFBSSxXQUFXLENBQUMsT0FBTyxJQUFJLEtBQUssUUFBUSxFQUFFLElBQUksRUFBRSxzQkFBc0IsQ0FBQyxDQUFDO0lBQ2pGLE1BQU0sVUFBVSxDQUNkLCtCQUErQixLQUFLLGNBQWM7UUFDaEQsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUUsS0FBSyxDQUFDO1FBQ3hCLEtBQUs7UUFDTCxJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssRUFBRSxLQUFLLEdBQUcsQ0FBQyxDQUFDO1FBQ2hDLEtBQUs7UUFDTCxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUM7UUFDckIsaUJBQWlCLFNBQVMsSUFBSSxDQUNqQyxDQUFDO0FBQ0osQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge2Fzc2VydEVxdWFsLCB0aHJvd0Vycm9yfSBmcm9tICcuLi8uLi91dGlsL2Fzc2VydCc7XG5pbXBvcnQge0NoYXJDb2RlfSBmcm9tICcuLi8uLi91dGlsL2NoYXJfY29kZSc7XG5cbi8qKlxuICogU3RvcmVzIHRoZSBsb2NhdGlvbnMgb2Yga2V5L3ZhbHVlIGluZGV4ZXMgd2hpbGUgcGFyc2luZyBzdHlsaW5nLlxuICpcbiAqIEluIGNhc2Ugb2YgYGNzc1RleHRgIHBhcnNpbmcgdGhlIGluZGV4ZXMgYXJlIGxpa2Ugc286XG4gKiBgYGBcbiAqICAgXCJrZXkxOiB2YWx1ZTE7IGtleTI6IHZhbHVlMjsga2V5MzogdmFsdWUzXCJcbiAqICAgICAgICAgICAgICAgICAgXiAgIF4gXiAgICAgXiAgICAgICAgICAgICBeXG4gKiAgICAgICAgICAgICAgICAgIHwgICB8IHwgICAgIHwgICAgICAgICAgICAgKy0tIHRleHRFbmRcbiAqICAgICAgICAgICAgICAgICAgfCAgIHwgfCAgICAgKy0tLS0tLS0tLS0tLS0tLS0gdmFsdWVFbmRcbiAqICAgICAgICAgICAgICAgICAgfCAgIHwgKy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gdmFsdWVcbiAqICAgICAgICAgICAgICAgICAgfCAgICstLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0ga2V5RW5kXG4gKiAgICAgICAgICAgICAgICAgICstLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tIGtleVxuICogYGBgXG4gKlxuICogSW4gY2FzZSBvZiBgY2xhc3NOYW1lYCBwYXJzaW5nIHRoZSBpbmRleGVzIGFyZSBsaWtlIHNvOlxuICogYGBgXG4gKiAgIFwia2V5MSBrZXkyIGtleTNcIlxuICogICAgICAgICBeICAgXiAgICBeXG4gKiAgICAgICAgIHwgICB8ICAgICstLSB0ZXh0RW5kXG4gKiAgICAgICAgIHwgICArLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tIGtleUVuZFxuICogICAgICAgICArLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSBrZXlcbiAqIGBgYFxuICogTk9URTogYHZhbHVlYCBhbmQgYHZhbHVlRW5kYCBhcmUgdXNlZCBvbmx5IGZvciBzdHlsZXMsIG5vdCBjbGFzc2VzLlxuICovXG5pbnRlcmZhY2UgUGFyc2VyU3RhdGUge1xuICB0ZXh0RW5kOiBudW1iZXI7XG4gIGtleTogbnVtYmVyO1xuICBrZXlFbmQ6IG51bWJlcjtcbiAgdmFsdWU6IG51bWJlcjtcbiAgdmFsdWVFbmQ6IG51bWJlcjtcbn1cbi8vIEdsb2JhbCBzdGF0ZSBvZiB0aGUgcGFyc2VyLiAoVGhpcyBtYWtlcyBwYXJzZXIgbm9uLXJlZW50cmFudCwgYnV0IHRoYXQgaXMgbm90IGFuIGlzc3VlKVxuY29uc3QgcGFyc2VyU3RhdGU6IFBhcnNlclN0YXRlID0ge1xuICB0ZXh0RW5kOiAwLFxuICBrZXk6IDAsXG4gIGtleUVuZDogMCxcbiAgdmFsdWU6IDAsXG4gIHZhbHVlRW5kOiAwLFxufTtcblxuLyoqXG4gKiBSZXRyaWV2ZXMgdGhlIGxhc3QgcGFyc2VkIGBrZXlgIG9mIHN0eWxlLlxuICogQHBhcmFtIHRleHQgdGhlIHRleHQgdG8gc3Vic3RyaW5nIHRoZSBrZXkgZnJvbS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldExhc3RQYXJzZWRLZXkodGV4dDogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIHRleHQuc3Vic3RyaW5nKHBhcnNlclN0YXRlLmtleSwgcGFyc2VyU3RhdGUua2V5RW5kKTtcbn1cblxuLyoqXG4gKiBSZXRyaWV2ZXMgdGhlIGxhc3QgcGFyc2VkIGB2YWx1ZWAgb2Ygc3R5bGUuXG4gKiBAcGFyYW0gdGV4dCB0aGUgdGV4dCB0byBzdWJzdHJpbmcgdGhlIGtleSBmcm9tLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0TGFzdFBhcnNlZFZhbHVlKHRleHQ6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiB0ZXh0LnN1YnN0cmluZyhwYXJzZXJTdGF0ZS52YWx1ZSwgcGFyc2VyU3RhdGUudmFsdWVFbmQpO1xufVxuXG4vKipcbiAqIEluaXRpYWxpemVzIGBjbGFzc05hbWVgIHN0cmluZyBmb3IgcGFyc2luZyBhbmQgcGFyc2VzIHRoZSBmaXJzdCB0b2tlbi5cbiAqXG4gKiBUaGlzIGZ1bmN0aW9uIGlzIGludGVuZGVkIHRvIGJlIHVzZWQgaW4gdGhpcyBmb3JtYXQ6XG4gKiBgYGBcbiAqIGZvciAobGV0IGkgPSBwYXJzZUNsYXNzTmFtZSh0ZXh0KTsgaSA+PSAwOyBpID0gcGFyc2VDbGFzc05hbWVOZXh0KHRleHQsIGkpKSB7XG4gKiAgIGNvbnN0IGtleSA9IGdldExhc3RQYXJzZWRLZXkoKTtcbiAqICAgLi4uXG4gKiB9XG4gKiBgYGBcbiAqIEBwYXJhbSB0ZXh0IGBjbGFzc05hbWVgIHRvIHBhcnNlXG4gKiBAcmV0dXJucyBpbmRleCB3aGVyZSB0aGUgbmV4dCBpbnZvY2F0aW9uIG9mIGBwYXJzZUNsYXNzTmFtZU5leHRgIHNob3VsZCByZXN1bWUuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZUNsYXNzTmFtZSh0ZXh0OiBzdHJpbmcpOiBudW1iZXIge1xuICByZXNldFBhcnNlclN0YXRlKHRleHQpO1xuICByZXR1cm4gcGFyc2VDbGFzc05hbWVOZXh0KHRleHQsIGNvbnN1bWVXaGl0ZXNwYWNlKHRleHQsIDAsIHBhcnNlclN0YXRlLnRleHRFbmQpKTtcbn1cblxuLyoqXG4gKiBQYXJzZXMgbmV4dCBgY2xhc3NOYW1lYCB0b2tlbi5cbiAqXG4gKiBUaGlzIGZ1bmN0aW9uIGlzIGludGVuZGVkIHRvIGJlIHVzZWQgaW4gdGhpcyBmb3JtYXQ6XG4gKiBgYGBcbiAqIGZvciAobGV0IGkgPSBwYXJzZUNsYXNzTmFtZSh0ZXh0KTsgaSA+PSAwOyBpID0gcGFyc2VDbGFzc05hbWVOZXh0KHRleHQsIGkpKSB7XG4gKiAgIGNvbnN0IGtleSA9IGdldExhc3RQYXJzZWRLZXkoKTtcbiAqICAgLi4uXG4gKiB9XG4gKiBgYGBcbiAqXG4gKiBAcGFyYW0gdGV4dCBgY2xhc3NOYW1lYCB0byBwYXJzZVxuICogQHBhcmFtIGluZGV4IHdoZXJlIHRoZSBwYXJzaW5nIHNob3VsZCByZXN1bWUuXG4gKiBAcmV0dXJucyBpbmRleCB3aGVyZSB0aGUgbmV4dCBpbnZvY2F0aW9uIG9mIGBwYXJzZUNsYXNzTmFtZU5leHRgIHNob3VsZCByZXN1bWUuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZUNsYXNzTmFtZU5leHQodGV4dDogc3RyaW5nLCBpbmRleDogbnVtYmVyKTogbnVtYmVyIHtcbiAgY29uc3QgZW5kID0gcGFyc2VyU3RhdGUudGV4dEVuZDtcbiAgaWYgKGVuZCA9PT0gaW5kZXgpIHtcbiAgICByZXR1cm4gLTE7XG4gIH1cbiAgaW5kZXggPSBwYXJzZXJTdGF0ZS5rZXlFbmQgPSBjb25zdW1lQ2xhc3NUb2tlbih0ZXh0LCAocGFyc2VyU3RhdGUua2V5ID0gaW5kZXgpLCBlbmQpO1xuICByZXR1cm4gY29uc3VtZVdoaXRlc3BhY2UodGV4dCwgaW5kZXgsIGVuZCk7XG59XG5cbi8qKlxuICogSW5pdGlhbGl6ZXMgYGNzc1RleHRgIHN0cmluZyBmb3IgcGFyc2luZyBhbmQgcGFyc2VzIHRoZSBmaXJzdCBrZXkvdmFsdWVzLlxuICpcbiAqIFRoaXMgZnVuY3Rpb24gaXMgaW50ZW5kZWQgdG8gYmUgdXNlZCBpbiB0aGlzIGZvcm1hdDpcbiAqIGBgYFxuICogZm9yIChsZXQgaSA9IHBhcnNlU3R5bGUodGV4dCk7IGkgPj0gMDsgaSA9IHBhcnNlU3R5bGVOZXh0KHRleHQsIGkpKSkge1xuICogICBjb25zdCBrZXkgPSBnZXRMYXN0UGFyc2VkS2V5KCk7XG4gKiAgIGNvbnN0IHZhbHVlID0gZ2V0TGFzdFBhcnNlZFZhbHVlKCk7XG4gKiAgIC4uLlxuICogfVxuICogYGBgXG4gKiBAcGFyYW0gdGV4dCBgY3NzVGV4dGAgdG8gcGFyc2VcbiAqIEByZXR1cm5zIGluZGV4IHdoZXJlIHRoZSBuZXh0IGludm9jYXRpb24gb2YgYHBhcnNlU3R5bGVOZXh0YCBzaG91bGQgcmVzdW1lLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VTdHlsZSh0ZXh0OiBzdHJpbmcpOiBudW1iZXIge1xuICByZXNldFBhcnNlclN0YXRlKHRleHQpO1xuICByZXR1cm4gcGFyc2VTdHlsZU5leHQodGV4dCwgY29uc3VtZVdoaXRlc3BhY2UodGV4dCwgMCwgcGFyc2VyU3RhdGUudGV4dEVuZCkpO1xufVxuXG4vKipcbiAqIFBhcnNlcyB0aGUgbmV4dCBgY3NzVGV4dGAga2V5L3ZhbHVlcy5cbiAqXG4gKiBUaGlzIGZ1bmN0aW9uIGlzIGludGVuZGVkIHRvIGJlIHVzZWQgaW4gdGhpcyBmb3JtYXQ6XG4gKiBgYGBcbiAqIGZvciAobGV0IGkgPSBwYXJzZVN0eWxlKHRleHQpOyBpID49IDA7IGkgPSBwYXJzZVN0eWxlTmV4dCh0ZXh0LCBpKSkpIHtcbiAqICAgY29uc3Qga2V5ID0gZ2V0TGFzdFBhcnNlZEtleSgpO1xuICogICBjb25zdCB2YWx1ZSA9IGdldExhc3RQYXJzZWRWYWx1ZSgpO1xuICogICAuLi5cbiAqIH1cbiAqXG4gKiBAcGFyYW0gdGV4dCBgY3NzVGV4dGAgdG8gcGFyc2VcbiAqIEBwYXJhbSBpbmRleCB3aGVyZSB0aGUgcGFyc2luZyBzaG91bGQgcmVzdW1lLlxuICogQHJldHVybnMgaW5kZXggd2hlcmUgdGhlIG5leHQgaW52b2NhdGlvbiBvZiBgcGFyc2VTdHlsZU5leHRgIHNob3VsZCByZXN1bWUuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZVN0eWxlTmV4dCh0ZXh0OiBzdHJpbmcsIHN0YXJ0SW5kZXg6IG51bWJlcik6IG51bWJlciB7XG4gIGNvbnN0IGVuZCA9IHBhcnNlclN0YXRlLnRleHRFbmQ7XG4gIGxldCBpbmRleCA9IChwYXJzZXJTdGF0ZS5rZXkgPSBjb25zdW1lV2hpdGVzcGFjZSh0ZXh0LCBzdGFydEluZGV4LCBlbmQpKTtcbiAgaWYgKGVuZCA9PT0gaW5kZXgpIHtcbiAgICAvLyB3ZSByZWFjaGVkIGFuIGVuZCBzbyBqdXN0IHF1aXRcbiAgICByZXR1cm4gLTE7XG4gIH1cbiAgaW5kZXggPSBwYXJzZXJTdGF0ZS5rZXlFbmQgPSBjb25zdW1lU3R5bGVLZXkodGV4dCwgaW5kZXgsIGVuZCk7XG4gIGluZGV4ID0gY29uc3VtZVNlcGFyYXRvcih0ZXh0LCBpbmRleCwgZW5kLCBDaGFyQ29kZS5DT0xPTik7XG4gIGluZGV4ID0gcGFyc2VyU3RhdGUudmFsdWUgPSBjb25zdW1lV2hpdGVzcGFjZSh0ZXh0LCBpbmRleCwgZW5kKTtcbiAgaW5kZXggPSBwYXJzZXJTdGF0ZS52YWx1ZUVuZCA9IGNvbnN1bWVTdHlsZVZhbHVlKHRleHQsIGluZGV4LCBlbmQpO1xuICByZXR1cm4gY29uc3VtZVNlcGFyYXRvcih0ZXh0LCBpbmRleCwgZW5kLCBDaGFyQ29kZS5TRU1JX0NPTE9OKTtcbn1cblxuLyoqXG4gKiBSZXNldCB0aGUgZ2xvYmFsIHN0YXRlIG9mIHRoZSBzdHlsaW5nIHBhcnNlci5cbiAqIEBwYXJhbSB0ZXh0IFRoZSBzdHlsaW5nIHRleHQgdG8gcGFyc2UuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZXNldFBhcnNlclN0YXRlKHRleHQ6IHN0cmluZyk6IHZvaWQge1xuICBwYXJzZXJTdGF0ZS5rZXkgPSAwO1xuICBwYXJzZXJTdGF0ZS5rZXlFbmQgPSAwO1xuICBwYXJzZXJTdGF0ZS52YWx1ZSA9IDA7XG4gIHBhcnNlclN0YXRlLnZhbHVlRW5kID0gMDtcbiAgcGFyc2VyU3RhdGUudGV4dEVuZCA9IHRleHQubGVuZ3RoO1xufVxuXG4vKipcbiAqIFJldHVybnMgaW5kZXggb2YgbmV4dCBub24td2hpdGVzcGFjZSBjaGFyYWN0ZXIuXG4gKlxuICogQHBhcmFtIHRleHQgVGV4dCB0byBzY2FuXG4gKiBAcGFyYW0gc3RhcnRJbmRleCBTdGFydGluZyBpbmRleCBvZiBjaGFyYWN0ZXIgd2hlcmUgdGhlIHNjYW4gc2hvdWxkIHN0YXJ0LlxuICogQHBhcmFtIGVuZEluZGV4IEVuZGluZyBpbmRleCBvZiBjaGFyYWN0ZXIgd2hlcmUgdGhlIHNjYW4gc2hvdWxkIGVuZC5cbiAqIEByZXR1cm5zIEluZGV4IG9mIG5leHQgbm9uLXdoaXRlc3BhY2UgY2hhcmFjdGVyIChNYXkgYmUgdGhlIHNhbWUgYXMgYHN0YXJ0YCBpZiBubyB3aGl0ZXNwYWNlIGF0XG4gKiAgICAgICAgICB0aGF0IGxvY2F0aW9uLilcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbnN1bWVXaGl0ZXNwYWNlKHRleHQ6IHN0cmluZywgc3RhcnRJbmRleDogbnVtYmVyLCBlbmRJbmRleDogbnVtYmVyKTogbnVtYmVyIHtcbiAgd2hpbGUgKHN0YXJ0SW5kZXggPCBlbmRJbmRleCAmJiB0ZXh0LmNoYXJDb2RlQXQoc3RhcnRJbmRleCkgPD0gQ2hhckNvZGUuU1BBQ0UpIHtcbiAgICBzdGFydEluZGV4Kys7XG4gIH1cbiAgcmV0dXJuIHN0YXJ0SW5kZXg7XG59XG5cbi8qKlxuICogUmV0dXJucyBpbmRleCBvZiBsYXN0IGNoYXIgaW4gY2xhc3MgdG9rZW4uXG4gKlxuICogQHBhcmFtIHRleHQgVGV4dCB0byBzY2FuXG4gKiBAcGFyYW0gc3RhcnRJbmRleCBTdGFydGluZyBpbmRleCBvZiBjaGFyYWN0ZXIgd2hlcmUgdGhlIHNjYW4gc2hvdWxkIHN0YXJ0LlxuICogQHBhcmFtIGVuZEluZGV4IEVuZGluZyBpbmRleCBvZiBjaGFyYWN0ZXIgd2hlcmUgdGhlIHNjYW4gc2hvdWxkIGVuZC5cbiAqIEByZXR1cm5zIEluZGV4IGFmdGVyIGxhc3QgY2hhciBpbiBjbGFzcyB0b2tlbi5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbnN1bWVDbGFzc1Rva2VuKHRleHQ6IHN0cmluZywgc3RhcnRJbmRleDogbnVtYmVyLCBlbmRJbmRleDogbnVtYmVyKTogbnVtYmVyIHtcbiAgd2hpbGUgKHN0YXJ0SW5kZXggPCBlbmRJbmRleCAmJiB0ZXh0LmNoYXJDb2RlQXQoc3RhcnRJbmRleCkgPiBDaGFyQ29kZS5TUEFDRSkge1xuICAgIHN0YXJ0SW5kZXgrKztcbiAgfVxuICByZXR1cm4gc3RhcnRJbmRleDtcbn1cblxuLyoqXG4gKiBDb25zdW1lcyBhbGwgb2YgdGhlIGNoYXJhY3RlcnMgYmVsb25naW5nIHRvIHN0eWxlIGtleSBhbmQgdG9rZW4uXG4gKlxuICogQHBhcmFtIHRleHQgVGV4dCB0byBzY2FuXG4gKiBAcGFyYW0gc3RhcnRJbmRleCBTdGFydGluZyBpbmRleCBvZiBjaGFyYWN0ZXIgd2hlcmUgdGhlIHNjYW4gc2hvdWxkIHN0YXJ0LlxuICogQHBhcmFtIGVuZEluZGV4IEVuZGluZyBpbmRleCBvZiBjaGFyYWN0ZXIgd2hlcmUgdGhlIHNjYW4gc2hvdWxkIGVuZC5cbiAqIEByZXR1cm5zIEluZGV4IGFmdGVyIGxhc3Qgc3R5bGUga2V5IGNoYXJhY3Rlci5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbnN1bWVTdHlsZUtleSh0ZXh0OiBzdHJpbmcsIHN0YXJ0SW5kZXg6IG51bWJlciwgZW5kSW5kZXg6IG51bWJlcik6IG51bWJlciB7XG4gIGxldCBjaDogbnVtYmVyO1xuICB3aGlsZSAoXG4gICAgc3RhcnRJbmRleCA8IGVuZEluZGV4ICYmXG4gICAgKChjaCA9IHRleHQuY2hhckNvZGVBdChzdGFydEluZGV4KSkgPT09IENoYXJDb2RlLkRBU0ggfHxcbiAgICAgIGNoID09PSBDaGFyQ29kZS5VTkRFUlNDT1JFIHx8XG4gICAgICAoKGNoICYgQ2hhckNvZGUuVVBQRVJfQ0FTRSkgPj0gQ2hhckNvZGUuQSAmJiAoY2ggJiBDaGFyQ29kZS5VUFBFUl9DQVNFKSA8PSBDaGFyQ29kZS5aKSB8fFxuICAgICAgKGNoID49IENoYXJDb2RlLlpFUk8gJiYgY2ggPD0gQ2hhckNvZGUuTklORSkpXG4gICkge1xuICAgIHN0YXJ0SW5kZXgrKztcbiAgfVxuICByZXR1cm4gc3RhcnRJbmRleDtcbn1cblxuLyoqXG4gKiBDb25zdW1lcyBhbGwgd2hpdGVzcGFjZSBhbmQgdGhlIHNlcGFyYXRvciBgOmAgYWZ0ZXIgdGhlIHN0eWxlIGtleS5cbiAqXG4gKiBAcGFyYW0gdGV4dCBUZXh0IHRvIHNjYW5cbiAqIEBwYXJhbSBzdGFydEluZGV4IFN0YXJ0aW5nIGluZGV4IG9mIGNoYXJhY3RlciB3aGVyZSB0aGUgc2NhbiBzaG91bGQgc3RhcnQuXG4gKiBAcGFyYW0gZW5kSW5kZXggRW5kaW5nIGluZGV4IG9mIGNoYXJhY3RlciB3aGVyZSB0aGUgc2NhbiBzaG91bGQgZW5kLlxuICogQHJldHVybnMgSW5kZXggYWZ0ZXIgc2VwYXJhdG9yIGFuZCBzdXJyb3VuZGluZyB3aGl0ZXNwYWNlLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY29uc3VtZVNlcGFyYXRvcihcbiAgdGV4dDogc3RyaW5nLFxuICBzdGFydEluZGV4OiBudW1iZXIsXG4gIGVuZEluZGV4OiBudW1iZXIsXG4gIHNlcGFyYXRvcjogbnVtYmVyLFxuKTogbnVtYmVyIHtcbiAgc3RhcnRJbmRleCA9IGNvbnN1bWVXaGl0ZXNwYWNlKHRleHQsIHN0YXJ0SW5kZXgsIGVuZEluZGV4KTtcbiAgaWYgKHN0YXJ0SW5kZXggPCBlbmRJbmRleCkge1xuICAgIGlmIChuZ0Rldk1vZGUgJiYgdGV4dC5jaGFyQ29kZUF0KHN0YXJ0SW5kZXgpICE9PSBzZXBhcmF0b3IpIHtcbiAgICAgIG1hbGZvcm1lZFN0eWxlRXJyb3IodGV4dCwgU3RyaW5nLmZyb21DaGFyQ29kZShzZXBhcmF0b3IpLCBzdGFydEluZGV4KTtcbiAgICB9XG4gICAgc3RhcnRJbmRleCsrO1xuICB9XG4gIHJldHVybiBzdGFydEluZGV4O1xufVxuXG4vKipcbiAqIENvbnN1bWVzIHN0eWxlIHZhbHVlIGhvbm9yaW5nIGB1cmwoKWAgYW5kIGBcIlwiYCB0ZXh0LlxuICpcbiAqIEBwYXJhbSB0ZXh0IFRleHQgdG8gc2NhblxuICogQHBhcmFtIHN0YXJ0SW5kZXggU3RhcnRpbmcgaW5kZXggb2YgY2hhcmFjdGVyIHdoZXJlIHRoZSBzY2FuIHNob3VsZCBzdGFydC5cbiAqIEBwYXJhbSBlbmRJbmRleCBFbmRpbmcgaW5kZXggb2YgY2hhcmFjdGVyIHdoZXJlIHRoZSBzY2FuIHNob3VsZCBlbmQuXG4gKiBAcmV0dXJucyBJbmRleCBhZnRlciBsYXN0IHN0eWxlIHZhbHVlIGNoYXJhY3Rlci5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbnN1bWVTdHlsZVZhbHVlKHRleHQ6IHN0cmluZywgc3RhcnRJbmRleDogbnVtYmVyLCBlbmRJbmRleDogbnVtYmVyKTogbnVtYmVyIHtcbiAgbGV0IGNoMSA9IC0xOyAvLyAxc3QgcHJldmlvdXMgY2hhcmFjdGVyXG4gIGxldCBjaDIgPSAtMTsgLy8gMm5kIHByZXZpb3VzIGNoYXJhY3RlclxuICBsZXQgY2gzID0gLTE7IC8vIDNyZCBwcmV2aW91cyBjaGFyYWN0ZXJcbiAgbGV0IGkgPSBzdGFydEluZGV4O1xuICBsZXQgbGFzdENoSW5kZXggPSBpO1xuICB3aGlsZSAoaSA8IGVuZEluZGV4KSB7XG4gICAgY29uc3QgY2g6IG51bWJlciA9IHRleHQuY2hhckNvZGVBdChpKyspO1xuICAgIGlmIChjaCA9PT0gQ2hhckNvZGUuU0VNSV9DT0xPTikge1xuICAgICAgcmV0dXJuIGxhc3RDaEluZGV4O1xuICAgIH0gZWxzZSBpZiAoY2ggPT09IENoYXJDb2RlLkRPVUJMRV9RVU9URSB8fCBjaCA9PT0gQ2hhckNvZGUuU0lOR0xFX1FVT1RFKSB7XG4gICAgICBsYXN0Q2hJbmRleCA9IGkgPSBjb25zdW1lUXVvdGVkVGV4dCh0ZXh0LCBjaCwgaSwgZW5kSW5kZXgpO1xuICAgIH0gZWxzZSBpZiAoXG4gICAgICBzdGFydEluZGV4ID09PSBpIC0gNCAmJiAvLyBXZSBoYXZlIHNlZW4gb25seSA0IGNoYXJhY3RlcnMgc28gZmFyIFwiVVJMKFwiIChJZ25vcmUgXCJmb29fVVJMKClcIilcbiAgICAgIGNoMyA9PT0gQ2hhckNvZGUuVSAmJlxuICAgICAgY2gyID09PSBDaGFyQ29kZS5SICYmXG4gICAgICBjaDEgPT09IENoYXJDb2RlLkwgJiZcbiAgICAgIGNoID09PSBDaGFyQ29kZS5PUEVOX1BBUkVOXG4gICAgKSB7XG4gICAgICBsYXN0Q2hJbmRleCA9IGkgPSBjb25zdW1lUXVvdGVkVGV4dCh0ZXh0LCBDaGFyQ29kZS5DTE9TRV9QQVJFTiwgaSwgZW5kSW5kZXgpO1xuICAgIH0gZWxzZSBpZiAoY2ggPiBDaGFyQ29kZS5TUEFDRSkge1xuICAgICAgLy8gaWYgd2UgaGF2ZSBhIG5vbi13aGl0ZXNwYWNlIGNoYXJhY3RlciB0aGVuIGNhcHR1cmUgaXRzIGxvY2F0aW9uXG4gICAgICBsYXN0Q2hJbmRleCA9IGk7XG4gICAgfVxuICAgIGNoMyA9IGNoMjtcbiAgICBjaDIgPSBjaDE7XG4gICAgY2gxID0gY2ggJiBDaGFyQ29kZS5VUFBFUl9DQVNFO1xuICB9XG4gIHJldHVybiBsYXN0Q2hJbmRleDtcbn1cblxuLyoqXG4gKiBDb25zdW1lcyBhbGwgb2YgdGhlIHF1b3RlZCBjaGFyYWN0ZXJzLlxuICpcbiAqIEBwYXJhbSB0ZXh0IFRleHQgdG8gc2NhblxuICogQHBhcmFtIHF1b3RlQ2hhckNvZGUgQ2hhckNvZGUgb2YgZWl0aGVyIGBcImAgb3IgYCdgIHF1b3RlIG9yIGApYCBmb3IgYHVybCguLi4pYC5cbiAqIEBwYXJhbSBzdGFydEluZGV4IFN0YXJ0aW5nIGluZGV4IG9mIGNoYXJhY3RlciB3aGVyZSB0aGUgc2NhbiBzaG91bGQgc3RhcnQuXG4gKiBAcGFyYW0gZW5kSW5kZXggRW5kaW5nIGluZGV4IG9mIGNoYXJhY3RlciB3aGVyZSB0aGUgc2NhbiBzaG91bGQgZW5kLlxuICogQHJldHVybnMgSW5kZXggYWZ0ZXIgcXVvdGVkIGNoYXJhY3RlcnMuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb25zdW1lUXVvdGVkVGV4dChcbiAgdGV4dDogc3RyaW5nLFxuICBxdW90ZUNoYXJDb2RlOiBudW1iZXIsXG4gIHN0YXJ0SW5kZXg6IG51bWJlcixcbiAgZW5kSW5kZXg6IG51bWJlcixcbik6IG51bWJlciB7XG4gIGxldCBjaDEgPSAtMTsgLy8gMXN0IHByZXZpb3VzIGNoYXJhY3RlclxuICBsZXQgaW5kZXggPSBzdGFydEluZGV4O1xuICB3aGlsZSAoaW5kZXggPCBlbmRJbmRleCkge1xuICAgIGNvbnN0IGNoID0gdGV4dC5jaGFyQ29kZUF0KGluZGV4KyspO1xuICAgIGlmIChjaCA9PSBxdW90ZUNoYXJDb2RlICYmIGNoMSAhPT0gQ2hhckNvZGUuQkFDS19TTEFTSCkge1xuICAgICAgcmV0dXJuIGluZGV4O1xuICAgIH1cbiAgICBpZiAoY2ggPT0gQ2hhckNvZGUuQkFDS19TTEFTSCAmJiBjaDEgPT09IENoYXJDb2RlLkJBQ0tfU0xBU0gpIHtcbiAgICAgIC8vIHR3byBiYWNrIHNsYXNoZXMgY2FuY2VsIGVhY2ggb3RoZXIgb3V0LiBGb3IgZXhhbXBsZSBgXCJcXFxcXCJgIHNob3VsZCBwcm9wZXJseSBlbmQgdGhlXG4gICAgICAvLyBxdW90YXRpb24uIChJdCBzaG91bGQgbm90IGFzc3VtZSB0aGF0IHRoZSBsYXN0IGBcImAgaXMgZXNjYXBlZC4pXG4gICAgICBjaDEgPSAwO1xuICAgIH0gZWxzZSB7XG4gICAgICBjaDEgPSBjaDtcbiAgICB9XG4gIH1cbiAgdGhyb3cgbmdEZXZNb2RlXG4gICAgPyBtYWxmb3JtZWRTdHlsZUVycm9yKHRleHQsIFN0cmluZy5mcm9tQ2hhckNvZGUocXVvdGVDaGFyQ29kZSksIGVuZEluZGV4KVxuICAgIDogbmV3IEVycm9yKCk7XG59XG5cbmZ1bmN0aW9uIG1hbGZvcm1lZFN0eWxlRXJyb3IodGV4dDogc3RyaW5nLCBleHBlY3Rpbmc6IHN0cmluZywgaW5kZXg6IG51bWJlcik6IG5ldmVyIHtcbiAgbmdEZXZNb2RlICYmIGFzc2VydEVxdWFsKHR5cGVvZiB0ZXh0ID09PSAnc3RyaW5nJywgdHJ1ZSwgJ1N0cmluZyBleHBlY3RlZCBoZXJlJyk7XG4gIHRocm93IHRocm93RXJyb3IoXG4gICAgYE1hbGZvcm1lZCBzdHlsZSBhdCBsb2NhdGlvbiAke2luZGV4fSBpbiBzdHJpbmcgJ2AgK1xuICAgICAgdGV4dC5zdWJzdHJpbmcoMCwgaW5kZXgpICtcbiAgICAgICdbPj4nICtcbiAgICAgIHRleHQuc3Vic3RyaW5nKGluZGV4LCBpbmRleCArIDEpICtcbiAgICAgICc8PF0nICtcbiAgICAgIHRleHQuc2xpY2UoaW5kZXggKyAxKSArXG4gICAgICBgJy4gRXhwZWN0aW5nICcke2V4cGVjdGluZ30nLmAsXG4gICk7XG59XG4iXX0=