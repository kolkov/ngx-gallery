/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { RuntimeError } from '../errors';
import { global } from '../util/global';
import localeEn from './locale_en';
/**
 * This const is used to store the locale data registered with `registerLocaleData`
 */
let LOCALE_DATA = {};
/**
 * Register locale data to be used internally by Angular. See the
 * ["I18n guide"](guide/i18n/format-data-locale) to know how to import additional locale
 * data.
 *
 * The signature `registerLocaleData(data: any, extraData?: any)` is deprecated since v5.1
 */
export function registerLocaleData(data, localeId, extraData) {
    if (typeof localeId !== 'string') {
        extraData = localeId;
        localeId = data[LocaleDataIndex.LocaleId];
    }
    localeId = localeId.toLowerCase().replace(/_/g, '-');
    LOCALE_DATA[localeId] = data;
    if (extraData) {
        LOCALE_DATA[localeId][LocaleDataIndex.ExtraData] = extraData;
    }
}
/**
 * Finds the locale data for a given locale.
 *
 * @param locale The locale code.
 * @returns The locale data.
 * @see [Internationalization (i18n) Guide](https://angular.io/guide/i18n)
 */
export function findLocaleData(locale) {
    const normalizedLocale = normalizeLocale(locale);
    let match = getLocaleData(normalizedLocale);
    if (match) {
        return match;
    }
    // let's try to find a parent locale
    const parentLocale = normalizedLocale.split('-')[0];
    match = getLocaleData(parentLocale);
    if (match) {
        return match;
    }
    if (parentLocale === 'en') {
        return localeEn;
    }
    throw new RuntimeError(701 /* RuntimeErrorCode.MISSING_LOCALE_DATA */, ngDevMode && `Missing locale data for the locale "${locale}".`);
}
/**
 * Retrieves the default currency code for the given locale.
 *
 * The default is defined as the first currency which is still in use.
 *
 * @param locale The code of the locale whose currency code we want.
 * @returns The code of the default currency for the given locale.
 *
 */
export function getLocaleCurrencyCode(locale) {
    const data = findLocaleData(locale);
    return data[LocaleDataIndex.CurrencyCode] || null;
}
/**
 * Retrieves the plural function used by ICU expressions to determine the plural case to use
 * for a given locale.
 * @param locale A locale code for the locale format rules to use.
 * @returns The plural function for the locale.
 * @see {@link NgPlural}
 * @see [Internationalization (i18n) Guide](guide/i18n)
 */
export function getLocalePluralCase(locale) {
    const data = findLocaleData(locale);
    return data[LocaleDataIndex.PluralCase];
}
/**
 * Helper function to get the given `normalizedLocale` from `LOCALE_DATA`
 * or from the global `ng.common.locale`.
 */
export function getLocaleData(normalizedLocale) {
    if (!(normalizedLocale in LOCALE_DATA)) {
        LOCALE_DATA[normalizedLocale] =
            global.ng &&
                global.ng.common &&
                global.ng.common.locales &&
                global.ng.common.locales[normalizedLocale];
    }
    return LOCALE_DATA[normalizedLocale];
}
/**
 * Helper function to remove all the locale data from `LOCALE_DATA`.
 */
export function unregisterAllLocaleData() {
    LOCALE_DATA = {};
}
/**
 * Index of each type of locale data from the locale data array
 */
export var LocaleDataIndex;
(function (LocaleDataIndex) {
    LocaleDataIndex[LocaleDataIndex["LocaleId"] = 0] = "LocaleId";
    LocaleDataIndex[LocaleDataIndex["DayPeriodsFormat"] = 1] = "DayPeriodsFormat";
    LocaleDataIndex[LocaleDataIndex["DayPeriodsStandalone"] = 2] = "DayPeriodsStandalone";
    LocaleDataIndex[LocaleDataIndex["DaysFormat"] = 3] = "DaysFormat";
    LocaleDataIndex[LocaleDataIndex["DaysStandalone"] = 4] = "DaysStandalone";
    LocaleDataIndex[LocaleDataIndex["MonthsFormat"] = 5] = "MonthsFormat";
    LocaleDataIndex[LocaleDataIndex["MonthsStandalone"] = 6] = "MonthsStandalone";
    LocaleDataIndex[LocaleDataIndex["Eras"] = 7] = "Eras";
    LocaleDataIndex[LocaleDataIndex["FirstDayOfWeek"] = 8] = "FirstDayOfWeek";
    LocaleDataIndex[LocaleDataIndex["WeekendRange"] = 9] = "WeekendRange";
    LocaleDataIndex[LocaleDataIndex["DateFormat"] = 10] = "DateFormat";
    LocaleDataIndex[LocaleDataIndex["TimeFormat"] = 11] = "TimeFormat";
    LocaleDataIndex[LocaleDataIndex["DateTimeFormat"] = 12] = "DateTimeFormat";
    LocaleDataIndex[LocaleDataIndex["NumberSymbols"] = 13] = "NumberSymbols";
    LocaleDataIndex[LocaleDataIndex["NumberFormats"] = 14] = "NumberFormats";
    LocaleDataIndex[LocaleDataIndex["CurrencyCode"] = 15] = "CurrencyCode";
    LocaleDataIndex[LocaleDataIndex["CurrencySymbol"] = 16] = "CurrencySymbol";
    LocaleDataIndex[LocaleDataIndex["CurrencyName"] = 17] = "CurrencyName";
    LocaleDataIndex[LocaleDataIndex["Currencies"] = 18] = "Currencies";
    LocaleDataIndex[LocaleDataIndex["Directionality"] = 19] = "Directionality";
    LocaleDataIndex[LocaleDataIndex["PluralCase"] = 20] = "PluralCase";
    LocaleDataIndex[LocaleDataIndex["ExtraData"] = 21] = "ExtraData";
})(LocaleDataIndex || (LocaleDataIndex = {}));
/**
 * Returns the canonical form of a locale name - lowercase with `_` replaced with `-`.
 */
function normalizeLocale(locale) {
    return locale.toLowerCase().replace(/_/g, '-');
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibG9jYWxlX2RhdGFfYXBpLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29yZS9zcmMvaTE4bi9sb2NhbGVfZGF0YV9hcGkudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBQ0gsT0FBTyxFQUFDLFlBQVksRUFBbUIsTUFBTSxXQUFXLENBQUM7QUFDekQsT0FBTyxFQUFDLE1BQU0sRUFBQyxNQUFNLGdCQUFnQixDQUFDO0FBRXRDLE9BQU8sUUFBUSxNQUFNLGFBQWEsQ0FBQztBQUVuQzs7R0FFRztBQUNILElBQUksV0FBVyxHQUE4QixFQUFFLENBQUM7QUFFaEQ7Ozs7OztHQU1HO0FBQ0gsTUFBTSxVQUFVLGtCQUFrQixDQUFDLElBQVMsRUFBRSxRQUF1QixFQUFFLFNBQWU7SUFDcEYsSUFBSSxPQUFPLFFBQVEsS0FBSyxRQUFRLEVBQUUsQ0FBQztRQUNqQyxTQUFTLEdBQUcsUUFBUSxDQUFDO1FBQ3JCLFFBQVEsR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQzVDLENBQUM7SUFFRCxRQUFRLEdBQUcsUUFBUSxDQUFDLFdBQVcsRUFBRSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUM7SUFFckQsV0FBVyxDQUFDLFFBQVEsQ0FBQyxHQUFHLElBQUksQ0FBQztJQUU3QixJQUFJLFNBQVMsRUFBRSxDQUFDO1FBQ2QsV0FBVyxDQUFDLFFBQVEsQ0FBQyxDQUFDLGVBQWUsQ0FBQyxTQUFTLENBQUMsR0FBRyxTQUFTLENBQUM7SUFDL0QsQ0FBQztBQUNILENBQUM7QUFFRDs7Ozs7O0dBTUc7QUFDSCxNQUFNLFVBQVUsY0FBYyxDQUFDLE1BQWM7SUFDM0MsTUFBTSxnQkFBZ0IsR0FBRyxlQUFlLENBQUMsTUFBTSxDQUFDLENBQUM7SUFFakQsSUFBSSxLQUFLLEdBQUcsYUFBYSxDQUFDLGdCQUFnQixDQUFDLENBQUM7SUFDNUMsSUFBSSxLQUFLLEVBQUUsQ0FBQztRQUNWLE9BQU8sS0FBSyxDQUFDO0lBQ2YsQ0FBQztJQUVELG9DQUFvQztJQUNwQyxNQUFNLFlBQVksR0FBRyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDcEQsS0FBSyxHQUFHLGFBQWEsQ0FBQyxZQUFZLENBQUMsQ0FBQztJQUNwQyxJQUFJLEtBQUssRUFBRSxDQUFDO1FBQ1YsT0FBTyxLQUFLLENBQUM7SUFDZixDQUFDO0lBRUQsSUFBSSxZQUFZLEtBQUssSUFBSSxFQUFFLENBQUM7UUFDMUIsT0FBTyxRQUFRLENBQUM7SUFDbEIsQ0FBQztJQUVELE1BQU0sSUFBSSxZQUFZLGlEQUVwQixTQUFTLElBQUksdUNBQXVDLE1BQU0sSUFBSSxDQUMvRCxDQUFDO0FBQ0osQ0FBQztBQUVEOzs7Ozs7OztHQVFHO0FBQ0gsTUFBTSxVQUFVLHFCQUFxQixDQUFDLE1BQWM7SUFDbEQsTUFBTSxJQUFJLEdBQUcsY0FBYyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQ3BDLE9BQU8sSUFBSSxDQUFDLGVBQWUsQ0FBQyxZQUFZLENBQUMsSUFBSSxJQUFJLENBQUM7QUFDcEQsQ0FBQztBQUVEOzs7Ozs7O0dBT0c7QUFDSCxNQUFNLFVBQVUsbUJBQW1CLENBQUMsTUFBYztJQUNoRCxNQUFNLElBQUksR0FBRyxjQUFjLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDcEMsT0FBTyxJQUFJLENBQUMsZUFBZSxDQUFDLFVBQVUsQ0FBQyxDQUFDO0FBQzFDLENBQUM7QUFFRDs7O0dBR0c7QUFDSCxNQUFNLFVBQVUsYUFBYSxDQUFDLGdCQUF3QjtJQUNwRCxJQUFJLENBQUMsQ0FBQyxnQkFBZ0IsSUFBSSxXQUFXLENBQUMsRUFBRSxDQUFDO1FBQ3ZDLFdBQVcsQ0FBQyxnQkFBZ0IsQ0FBQztZQUMzQixNQUFNLENBQUMsRUFBRTtnQkFDVCxNQUFNLENBQUMsRUFBRSxDQUFDLE1BQU07Z0JBQ2hCLE1BQU0sQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLE9BQU87Z0JBQ3hCLE1BQU0sQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO0lBQy9DLENBQUM7SUFDRCxPQUFPLFdBQVcsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO0FBQ3ZDLENBQUM7QUFFRDs7R0FFRztBQUNILE1BQU0sVUFBVSx1QkFBdUI7SUFDckMsV0FBVyxHQUFHLEVBQUUsQ0FBQztBQUNuQixDQUFDO0FBRUQ7O0dBRUc7QUFDSCxNQUFNLENBQU4sSUFBWSxlQXVCWDtBQXZCRCxXQUFZLGVBQWU7SUFDekIsNkRBQVksQ0FBQTtJQUNaLDZFQUFnQixDQUFBO0lBQ2hCLHFGQUFvQixDQUFBO0lBQ3BCLGlFQUFVLENBQUE7SUFDVix5RUFBYyxDQUFBO0lBQ2QscUVBQVksQ0FBQTtJQUNaLDZFQUFnQixDQUFBO0lBQ2hCLHFEQUFJLENBQUE7SUFDSix5RUFBYyxDQUFBO0lBQ2QscUVBQVksQ0FBQTtJQUNaLGtFQUFVLENBQUE7SUFDVixrRUFBVSxDQUFBO0lBQ1YsMEVBQWMsQ0FBQTtJQUNkLHdFQUFhLENBQUE7SUFDYix3RUFBYSxDQUFBO0lBQ2Isc0VBQVksQ0FBQTtJQUNaLDBFQUFjLENBQUE7SUFDZCxzRUFBWSxDQUFBO0lBQ1osa0VBQVUsQ0FBQTtJQUNWLDBFQUFjLENBQUE7SUFDZCxrRUFBVSxDQUFBO0lBQ1YsZ0VBQVMsQ0FBQTtBQUNYLENBQUMsRUF2QlcsZUFBZSxLQUFmLGVBQWUsUUF1QjFCO0FBb0JEOztHQUVHO0FBQ0gsU0FBUyxlQUFlLENBQUMsTUFBYztJQUNyQyxPQUFPLE1BQU0sQ0FBQyxXQUFXLEVBQUUsQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxDQUFDO0FBQ2pELENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmltcG9ydCB7UnVudGltZUVycm9yLCBSdW50aW1lRXJyb3JDb2RlfSBmcm9tICcuLi9lcnJvcnMnO1xuaW1wb3J0IHtnbG9iYWx9IGZyb20gJy4uL3V0aWwvZ2xvYmFsJztcblxuaW1wb3J0IGxvY2FsZUVuIGZyb20gJy4vbG9jYWxlX2VuJztcblxuLyoqXG4gKiBUaGlzIGNvbnN0IGlzIHVzZWQgdG8gc3RvcmUgdGhlIGxvY2FsZSBkYXRhIHJlZ2lzdGVyZWQgd2l0aCBgcmVnaXN0ZXJMb2NhbGVEYXRhYFxuICovXG5sZXQgTE9DQUxFX0RBVEE6IHtbbG9jYWxlSWQ6IHN0cmluZ106IGFueX0gPSB7fTtcblxuLyoqXG4gKiBSZWdpc3RlciBsb2NhbGUgZGF0YSB0byBiZSB1c2VkIGludGVybmFsbHkgYnkgQW5ndWxhci4gU2VlIHRoZVxuICogW1wiSTE4biBndWlkZVwiXShndWlkZS9pMThuL2Zvcm1hdC1kYXRhLWxvY2FsZSkgdG8ga25vdyBob3cgdG8gaW1wb3J0IGFkZGl0aW9uYWwgbG9jYWxlXG4gKiBkYXRhLlxuICpcbiAqIFRoZSBzaWduYXR1cmUgYHJlZ2lzdGVyTG9jYWxlRGF0YShkYXRhOiBhbnksIGV4dHJhRGF0YT86IGFueSlgIGlzIGRlcHJlY2F0ZWQgc2luY2UgdjUuMVxuICovXG5leHBvcnQgZnVuY3Rpb24gcmVnaXN0ZXJMb2NhbGVEYXRhKGRhdGE6IGFueSwgbG9jYWxlSWQ/OiBzdHJpbmcgfCBhbnksIGV4dHJhRGF0YT86IGFueSk6IHZvaWQge1xuICBpZiAodHlwZW9mIGxvY2FsZUlkICE9PSAnc3RyaW5nJykge1xuICAgIGV4dHJhRGF0YSA9IGxvY2FsZUlkO1xuICAgIGxvY2FsZUlkID0gZGF0YVtMb2NhbGVEYXRhSW5kZXguTG9jYWxlSWRdO1xuICB9XG5cbiAgbG9jYWxlSWQgPSBsb2NhbGVJZC50b0xvd2VyQ2FzZSgpLnJlcGxhY2UoL18vZywgJy0nKTtcblxuICBMT0NBTEVfREFUQVtsb2NhbGVJZF0gPSBkYXRhO1xuXG4gIGlmIChleHRyYURhdGEpIHtcbiAgICBMT0NBTEVfREFUQVtsb2NhbGVJZF1bTG9jYWxlRGF0YUluZGV4LkV4dHJhRGF0YV0gPSBleHRyYURhdGE7XG4gIH1cbn1cblxuLyoqXG4gKiBGaW5kcyB0aGUgbG9jYWxlIGRhdGEgZm9yIGEgZ2l2ZW4gbG9jYWxlLlxuICpcbiAqIEBwYXJhbSBsb2NhbGUgVGhlIGxvY2FsZSBjb2RlLlxuICogQHJldHVybnMgVGhlIGxvY2FsZSBkYXRhLlxuICogQHNlZSBbSW50ZXJuYXRpb25hbGl6YXRpb24gKGkxOG4pIEd1aWRlXShodHRwczovL2FuZ3VsYXIuaW8vZ3VpZGUvaTE4bilcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGZpbmRMb2NhbGVEYXRhKGxvY2FsZTogc3RyaW5nKTogYW55IHtcbiAgY29uc3Qgbm9ybWFsaXplZExvY2FsZSA9IG5vcm1hbGl6ZUxvY2FsZShsb2NhbGUpO1xuXG4gIGxldCBtYXRjaCA9IGdldExvY2FsZURhdGEobm9ybWFsaXplZExvY2FsZSk7XG4gIGlmIChtYXRjaCkge1xuICAgIHJldHVybiBtYXRjaDtcbiAgfVxuXG4gIC8vIGxldCdzIHRyeSB0byBmaW5kIGEgcGFyZW50IGxvY2FsZVxuICBjb25zdCBwYXJlbnRMb2NhbGUgPSBub3JtYWxpemVkTG9jYWxlLnNwbGl0KCctJylbMF07XG4gIG1hdGNoID0gZ2V0TG9jYWxlRGF0YShwYXJlbnRMb2NhbGUpO1xuICBpZiAobWF0Y2gpIHtcbiAgICByZXR1cm4gbWF0Y2g7XG4gIH1cblxuICBpZiAocGFyZW50TG9jYWxlID09PSAnZW4nKSB7XG4gICAgcmV0dXJuIGxvY2FsZUVuO1xuICB9XG5cbiAgdGhyb3cgbmV3IFJ1bnRpbWVFcnJvcihcbiAgICBSdW50aW1lRXJyb3JDb2RlLk1JU1NJTkdfTE9DQUxFX0RBVEEsXG4gICAgbmdEZXZNb2RlICYmIGBNaXNzaW5nIGxvY2FsZSBkYXRhIGZvciB0aGUgbG9jYWxlIFwiJHtsb2NhbGV9XCIuYCxcbiAgKTtcbn1cblxuLyoqXG4gKiBSZXRyaWV2ZXMgdGhlIGRlZmF1bHQgY3VycmVuY3kgY29kZSBmb3IgdGhlIGdpdmVuIGxvY2FsZS5cbiAqXG4gKiBUaGUgZGVmYXVsdCBpcyBkZWZpbmVkIGFzIHRoZSBmaXJzdCBjdXJyZW5jeSB3aGljaCBpcyBzdGlsbCBpbiB1c2UuXG4gKlxuICogQHBhcmFtIGxvY2FsZSBUaGUgY29kZSBvZiB0aGUgbG9jYWxlIHdob3NlIGN1cnJlbmN5IGNvZGUgd2Ugd2FudC5cbiAqIEByZXR1cm5zIFRoZSBjb2RlIG9mIHRoZSBkZWZhdWx0IGN1cnJlbmN5IGZvciB0aGUgZ2l2ZW4gbG9jYWxlLlxuICpcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldExvY2FsZUN1cnJlbmN5Q29kZShsb2NhbGU6IHN0cmluZyk6IHN0cmluZyB8IG51bGwge1xuICBjb25zdCBkYXRhID0gZmluZExvY2FsZURhdGEobG9jYWxlKTtcbiAgcmV0dXJuIGRhdGFbTG9jYWxlRGF0YUluZGV4LkN1cnJlbmN5Q29kZV0gfHwgbnVsbDtcbn1cblxuLyoqXG4gKiBSZXRyaWV2ZXMgdGhlIHBsdXJhbCBmdW5jdGlvbiB1c2VkIGJ5IElDVSBleHByZXNzaW9ucyB0byBkZXRlcm1pbmUgdGhlIHBsdXJhbCBjYXNlIHRvIHVzZVxuICogZm9yIGEgZ2l2ZW4gbG9jYWxlLlxuICogQHBhcmFtIGxvY2FsZSBBIGxvY2FsZSBjb2RlIGZvciB0aGUgbG9jYWxlIGZvcm1hdCBydWxlcyB0byB1c2UuXG4gKiBAcmV0dXJucyBUaGUgcGx1cmFsIGZ1bmN0aW9uIGZvciB0aGUgbG9jYWxlLlxuICogQHNlZSB7QGxpbmsgTmdQbHVyYWx9XG4gKiBAc2VlIFtJbnRlcm5hdGlvbmFsaXphdGlvbiAoaTE4bikgR3VpZGVdKGd1aWRlL2kxOG4pXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRMb2NhbGVQbHVyYWxDYXNlKGxvY2FsZTogc3RyaW5nKTogKHZhbHVlOiBudW1iZXIpID0+IG51bWJlciB7XG4gIGNvbnN0IGRhdGEgPSBmaW5kTG9jYWxlRGF0YShsb2NhbGUpO1xuICByZXR1cm4gZGF0YVtMb2NhbGVEYXRhSW5kZXguUGx1cmFsQ2FzZV07XG59XG5cbi8qKlxuICogSGVscGVyIGZ1bmN0aW9uIHRvIGdldCB0aGUgZ2l2ZW4gYG5vcm1hbGl6ZWRMb2NhbGVgIGZyb20gYExPQ0FMRV9EQVRBYFxuICogb3IgZnJvbSB0aGUgZ2xvYmFsIGBuZy5jb21tb24ubG9jYWxlYC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldExvY2FsZURhdGEobm9ybWFsaXplZExvY2FsZTogc3RyaW5nKTogYW55IHtcbiAgaWYgKCEobm9ybWFsaXplZExvY2FsZSBpbiBMT0NBTEVfREFUQSkpIHtcbiAgICBMT0NBTEVfREFUQVtub3JtYWxpemVkTG9jYWxlXSA9XG4gICAgICBnbG9iYWwubmcgJiZcbiAgICAgIGdsb2JhbC5uZy5jb21tb24gJiZcbiAgICAgIGdsb2JhbC5uZy5jb21tb24ubG9jYWxlcyAmJlxuICAgICAgZ2xvYmFsLm5nLmNvbW1vbi5sb2NhbGVzW25vcm1hbGl6ZWRMb2NhbGVdO1xuICB9XG4gIHJldHVybiBMT0NBTEVfREFUQVtub3JtYWxpemVkTG9jYWxlXTtcbn1cblxuLyoqXG4gKiBIZWxwZXIgZnVuY3Rpb24gdG8gcmVtb3ZlIGFsbCB0aGUgbG9jYWxlIGRhdGEgZnJvbSBgTE9DQUxFX0RBVEFgLlxuICovXG5leHBvcnQgZnVuY3Rpb24gdW5yZWdpc3RlckFsbExvY2FsZURhdGEoKSB7XG4gIExPQ0FMRV9EQVRBID0ge307XG59XG5cbi8qKlxuICogSW5kZXggb2YgZWFjaCB0eXBlIG9mIGxvY2FsZSBkYXRhIGZyb20gdGhlIGxvY2FsZSBkYXRhIGFycmF5XG4gKi9cbmV4cG9ydCBlbnVtIExvY2FsZURhdGFJbmRleCB7XG4gIExvY2FsZUlkID0gMCxcbiAgRGF5UGVyaW9kc0Zvcm1hdCxcbiAgRGF5UGVyaW9kc1N0YW5kYWxvbmUsXG4gIERheXNGb3JtYXQsXG4gIERheXNTdGFuZGFsb25lLFxuICBNb250aHNGb3JtYXQsXG4gIE1vbnRoc1N0YW5kYWxvbmUsXG4gIEVyYXMsXG4gIEZpcnN0RGF5T2ZXZWVrLFxuICBXZWVrZW5kUmFuZ2UsXG4gIERhdGVGb3JtYXQsXG4gIFRpbWVGb3JtYXQsXG4gIERhdGVUaW1lRm9ybWF0LFxuICBOdW1iZXJTeW1ib2xzLFxuICBOdW1iZXJGb3JtYXRzLFxuICBDdXJyZW5jeUNvZGUsXG4gIEN1cnJlbmN5U3ltYm9sLFxuICBDdXJyZW5jeU5hbWUsXG4gIEN1cnJlbmNpZXMsXG4gIERpcmVjdGlvbmFsaXR5LFxuICBQbHVyYWxDYXNlLFxuICBFeHRyYURhdGEsXG59XG5cbi8qKlxuICogSW5kZXggb2YgZWFjaCB0eXBlIG9mIGxvY2FsZSBkYXRhIGZyb20gdGhlIGV4dHJhIGxvY2FsZSBkYXRhIGFycmF5XG4gKi9cbmV4cG9ydCBjb25zdCBlbnVtIEV4dHJhTG9jYWxlRGF0YUluZGV4IHtcbiAgRXh0cmFEYXlQZXJpb2RGb3JtYXRzID0gMCxcbiAgRXh0cmFEYXlQZXJpb2RTdGFuZGFsb25lLFxuICBFeHRyYURheVBlcmlvZHNSdWxlcyxcbn1cblxuLyoqXG4gKiBJbmRleCBvZiBlYWNoIHZhbHVlIGluIGN1cnJlbmN5IGRhdGEgKHVzZWQgdG8gZGVzY3JpYmUgQ1VSUkVOQ0lFU19FTiBpbiBjdXJyZW5jaWVzLnRzKVxuICovXG5leHBvcnQgY29uc3QgZW51bSBDdXJyZW5jeUluZGV4IHtcbiAgU3ltYm9sID0gMCxcbiAgU3ltYm9sTmFycm93LFxuICBOYk9mRGlnaXRzLFxufVxuXG4vKipcbiAqIFJldHVybnMgdGhlIGNhbm9uaWNhbCBmb3JtIG9mIGEgbG9jYWxlIG5hbWUgLSBsb3dlcmNhc2Ugd2l0aCBgX2AgcmVwbGFjZWQgd2l0aCBgLWAuXG4gKi9cbmZ1bmN0aW9uIG5vcm1hbGl6ZUxvY2FsZShsb2NhbGU6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBsb2NhbGUudG9Mb3dlckNhc2UoKS5yZXBsYWNlKC9fL2csICctJyk7XG59XG4iXX0=