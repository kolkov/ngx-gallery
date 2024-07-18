/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { ɵfindLocaleData, ɵgetLocaleCurrencyCode, ɵgetLocalePluralCase, ɵLocaleDataIndex, } from '@angular/core';
import { CURRENCIES_EN } from './currencies';
/**
 * Format styles that can be used to represent numbers.
 * @see {@link getLocaleNumberFormat}
 * @see [Internationalization (i18n) Guide](guide/i18n)
 *
 * @publicApi
 *
 * @deprecated `getLocaleNumberFormat` is deprecated
 */
export var NumberFormatStyle;
(function (NumberFormatStyle) {
    NumberFormatStyle[NumberFormatStyle["Decimal"] = 0] = "Decimal";
    NumberFormatStyle[NumberFormatStyle["Percent"] = 1] = "Percent";
    NumberFormatStyle[NumberFormatStyle["Currency"] = 2] = "Currency";
    NumberFormatStyle[NumberFormatStyle["Scientific"] = 3] = "Scientific";
})(NumberFormatStyle || (NumberFormatStyle = {}));
/**
 * Plurality cases used for translating plurals to different languages.
 *
 * @see {@link NgPlural}
 * @see {@link NgPluralCase}
 * @see [Internationalization (i18n) Guide](guide/i18n)
 *
 * @publicApi
 *
 * @deprecated `getLocalePluralCase` is deprecated
 */
export var Plural;
(function (Plural) {
    Plural[Plural["Zero"] = 0] = "Zero";
    Plural[Plural["One"] = 1] = "One";
    Plural[Plural["Two"] = 2] = "Two";
    Plural[Plural["Few"] = 3] = "Few";
    Plural[Plural["Many"] = 4] = "Many";
    Plural[Plural["Other"] = 5] = "Other";
})(Plural || (Plural = {}));
/**
 * Context-dependant translation forms for strings.
 * Typically the standalone version is for the nominative form of the word,
 * and the format version is used for the genitive case.
 * @see [CLDR website](http://cldr.unicode.org/translation/date-time-1/date-time#TOC-Standalone-vs.-Format-Styles)
 * @see [Internationalization (i18n) Guide](guide/i18n)
 *
 * @publicApi
 *
 * @deprecated locale data getters are deprecated
 */
export var FormStyle;
(function (FormStyle) {
    FormStyle[FormStyle["Format"] = 0] = "Format";
    FormStyle[FormStyle["Standalone"] = 1] = "Standalone";
})(FormStyle || (FormStyle = {}));
/**
 * String widths available for translations.
 * The specific character widths are locale-specific.
 * Examples are given for the word "Sunday" in English.
 *
 * @publicApi
 *
 * @deprecated locale data getters are deprecated
 */
export var TranslationWidth;
(function (TranslationWidth) {
    /** 1 character for `en-US`. For example: 'S' */
    TranslationWidth[TranslationWidth["Narrow"] = 0] = "Narrow";
    /** 3 characters for `en-US`. For example: 'Sun' */
    TranslationWidth[TranslationWidth["Abbreviated"] = 1] = "Abbreviated";
    /** Full length for `en-US`. For example: "Sunday" */
    TranslationWidth[TranslationWidth["Wide"] = 2] = "Wide";
    /** 2 characters for `en-US`, For example: "Su" */
    TranslationWidth[TranslationWidth["Short"] = 3] = "Short";
})(TranslationWidth || (TranslationWidth = {}));
/**
 * String widths available for date-time formats.
 * The specific character widths are locale-specific.
 * Examples are given for `en-US`.
 *
 * @see {@link getLocaleDateFormat}
 * @see {@link getLocaleTimeFormat}
 * @see {@link getLocaleDateTimeFormat}
 * @see [Internationalization (i18n) Guide](guide/i18n)
 * @publicApi
 *
 * @deprecated Date locale data getters are deprecated
 */
export var FormatWidth;
(function (FormatWidth) {
    /**
     * For `en-US`, `'M/d/yy, h:mm a'`
     * (Example: `6/15/15, 9:03 AM`)
     */
    FormatWidth[FormatWidth["Short"] = 0] = "Short";
    /**
     * For `en-US`, `'MMM d, y, h:mm:ss a'`
     * (Example: `Jun 15, 2015, 9:03:01 AM`)
     */
    FormatWidth[FormatWidth["Medium"] = 1] = "Medium";
    /**
     * For `en-US`, `'MMMM d, y, h:mm:ss a z'`
     * (Example: `June 15, 2015 at 9:03:01 AM GMT+1`)
     */
    FormatWidth[FormatWidth["Long"] = 2] = "Long";
    /**
     * For `en-US`, `'EEEE, MMMM d, y, h:mm:ss a zzzz'`
     * (Example: `Monday, June 15, 2015 at 9:03:01 AM GMT+01:00`)
     */
    FormatWidth[FormatWidth["Full"] = 3] = "Full";
})(FormatWidth || (FormatWidth = {}));
// This needs to be an object literal, rather than an enum, because TypeScript 5.4+
// doesn't allow numeric keys and we have `Infinity` and `NaN`.
/**
 * Symbols that can be used to replace placeholders in number patterns.
 * Examples are based on `en-US` values.
 *
 * @see {@link getLocaleNumberSymbol}
 * @see [Internationalization (i18n) Guide](guide/i18n)
 *
 * @publicApi
 *
 * @deprecated `getLocaleNumberSymbol` is deprecated
 *
 * @object-literal-as-enum
 */
export const NumberSymbol = {
    /**
     * Decimal separator.
     * For `en-US`, the dot character.
     * Example: 2,345`.`67
     */
    Decimal: 0,
    /**
     * Grouping separator, typically for thousands.
     * For `en-US`, the comma character.
     * Example: 2`,`345.67
     */
    Group: 1,
    /**
     * List-item separator.
     * Example: "one, two, and three"
     */
    List: 2,
    /**
     * Sign for percentage (out of 100).
     * Example: 23.4%
     */
    PercentSign: 3,
    /**
     * Sign for positive numbers.
     * Example: +23
     */
    PlusSign: 4,
    /**
     * Sign for negative numbers.
     * Example: -23
     */
    MinusSign: 5,
    /**
     * Computer notation for exponential value (n times a power of 10).
     * Example: 1.2E3
     */
    Exponential: 6,
    /**
     * Human-readable format of exponential.
     * Example: 1.2x103
     */
    SuperscriptingExponent: 7,
    /**
     * Sign for permille (out of 1000).
     * Example: 23.4‰
     */
    PerMille: 8,
    /**
     * Infinity, can be used with plus and minus.
     * Example: ∞, +∞, -∞
     */
    Infinity: 9,
    /**
     * Not a number.
     * Example: NaN
     */
    NaN: 10,
    /**
     * Symbol used between time units.
     * Example: 10:52
     */
    TimeSeparator: 11,
    /**
     * Decimal separator for currency values (fallback to `Decimal`).
     * Example: $2,345.67
     */
    CurrencyDecimal: 12,
    /**
     * Group separator for currency values (fallback to `Group`).
     * Example: $2,345.67
     */
    CurrencyGroup: 13,
};
/**
 * The value for each day of the week, based on the `en-US` locale
 *
 * @publicApi
 *
 * @deprecated Week locale getters are deprecated
 */
export var WeekDay;
(function (WeekDay) {
    WeekDay[WeekDay["Sunday"] = 0] = "Sunday";
    WeekDay[WeekDay["Monday"] = 1] = "Monday";
    WeekDay[WeekDay["Tuesday"] = 2] = "Tuesday";
    WeekDay[WeekDay["Wednesday"] = 3] = "Wednesday";
    WeekDay[WeekDay["Thursday"] = 4] = "Thursday";
    WeekDay[WeekDay["Friday"] = 5] = "Friday";
    WeekDay[WeekDay["Saturday"] = 6] = "Saturday";
})(WeekDay || (WeekDay = {}));
/**
 * Retrieves the locale ID from the currently loaded locale.
 * The loaded locale could be, for example, a global one rather than a regional one.
 * @param locale A locale code, such as `fr-FR`.
 * @returns The locale code. For example, `fr`.
 * @see [Internationalization (i18n) Guide](guide/i18n)
 *
 * @publicApi
 *
 * @deprecated Angular recommends relying on the `Intl` API for i18n.
 * This function serves no purpose when relying on the `Intl` API.
 */
export function getLocaleId(locale) {
    return ɵfindLocaleData(locale)[ɵLocaleDataIndex.LocaleId];
}
/**
 * Retrieves day period strings for the given locale.
 *
 * @param locale A locale code for the locale format rules to use.
 * @param formStyle The required grammatical form.
 * @param width The required character width.
 * @returns An array of localized period strings. For example, `[AM, PM]` for `en-US`.
 * @see [Internationalization (i18n) Guide](guide/i18n)
 *
 * @publicApi
 *
 * @deprecated Angular recommends relying on the `Intl` API for i18n.
 * Use `Intl.DateTimeFormat` for date formating instead.
 */
export function getLocaleDayPeriods(locale, formStyle, width) {
    const data = ɵfindLocaleData(locale);
    const amPmData = [
        data[ɵLocaleDataIndex.DayPeriodsFormat],
        data[ɵLocaleDataIndex.DayPeriodsStandalone],
    ];
    const amPm = getLastDefinedValue(amPmData, formStyle);
    return getLastDefinedValue(amPm, width);
}
/**
 * Retrieves days of the week for the given locale, using the Gregorian calendar.
 *
 * @param locale A locale code for the locale format rules to use.
 * @param formStyle The required grammatical form.
 * @param width The required character width.
 * @returns An array of localized name strings.
 * For example,`[Sunday, Monday, ... Saturday]` for `en-US`.
 * @see [Internationalization (i18n) Guide](guide/i18n)
 *
 * @publicApi
 *
 * @deprecated Angular recommends relying on the `Intl` API for i18n.
 * Use `Intl.DateTimeFormat` for date formating instead.
 */
export function getLocaleDayNames(locale, formStyle, width) {
    const data = ɵfindLocaleData(locale);
    const daysData = [
        data[ɵLocaleDataIndex.DaysFormat],
        data[ɵLocaleDataIndex.DaysStandalone],
    ];
    const days = getLastDefinedValue(daysData, formStyle);
    return getLastDefinedValue(days, width);
}
/**
 * Retrieves months of the year for the given locale, using the Gregorian calendar.
 *
 * @param locale A locale code for the locale format rules to use.
 * @param formStyle The required grammatical form.
 * @param width The required character width.
 * @returns An array of localized name strings.
 * For example,  `[January, February, ...]` for `en-US`.
 * @see [Internationalization (i18n) Guide](guide/i18n)
 *
 * @publicApi
 *
 * @deprecated Angular recommends relying on the `Intl` API for i18n.
 * Use `Intl.DateTimeFormat` for date formating instead.
 */
export function getLocaleMonthNames(locale, formStyle, width) {
    const data = ɵfindLocaleData(locale);
    const monthsData = [
        data[ɵLocaleDataIndex.MonthsFormat],
        data[ɵLocaleDataIndex.MonthsStandalone],
    ];
    const months = getLastDefinedValue(monthsData, formStyle);
    return getLastDefinedValue(months, width);
}
/**
 * Retrieves Gregorian-calendar eras for the given locale.
 * @param locale A locale code for the locale format rules to use.
 * @param width The required character width.

 * @returns An array of localized era strings.
 * For example, `[AD, BC]` for `en-US`.
 * @see [Internationalization (i18n) Guide](guide/i18n)
 *
 * @publicApi
 *
 * @deprecated Angular recommends relying on the `Intl` API for i18n.
 * Use `Intl.DateTimeFormat` for date formating instead.
 */
export function getLocaleEraNames(locale, width) {
    const data = ɵfindLocaleData(locale);
    const erasData = data[ɵLocaleDataIndex.Eras];
    return getLastDefinedValue(erasData, width);
}
/**
 * Retrieves the first day of the week for the given locale.
 *
 * @param locale A locale code for the locale format rules to use.
 * @returns A day index number, using the 0-based week-day index for `en-US`
 * (Sunday = 0, Monday = 1, ...).
 * For example, for `fr-FR`, returns 1 to indicate that the first day is Monday.
 * @see [Internationalization (i18n) Guide](guide/i18n)
 *
 * @publicApi
 *
 * @deprecated Angular recommends relying on the `Intl` API for i18n.
 * Intl's [`getWeekInfo`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Locale/getWeekInfo) has partial support (Chromium M99 & Safari 17).
 * You may want to rely on the following alternatives:
 * - Libraries like [`Luxon`](https://moment.github.io/luxon/#/) rely on `Intl` but fallback on the ISO 8601 definition (monday) if `getWeekInfo` is not supported.
 * - Other librairies like [`date-fns`](https://date-fns.org/), [`day.js`](https://day.js.org/en/) or [`weekstart`](https://www.npmjs.com/package/weekstart) library provide their own locale based data for the first day of the week.
 */
export function getLocaleFirstDayOfWeek(locale) {
    const data = ɵfindLocaleData(locale);
    return data[ɵLocaleDataIndex.FirstDayOfWeek];
}
/**
 * Range of week days that are considered the week-end for the given locale.
 *
 * @param locale A locale code for the locale format rules to use.
 * @returns The range of day values, `[startDay, endDay]`.
 * @see [Internationalization (i18n) Guide](guide/i18n)
 *
 * @publicApi
 *
 * @deprecated Angular recommends relying on the `Intl` API for i18n.
 * Intl's [`getWeekInfo`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Locale/getWeekInfo) has partial support (Chromium M99 & Safari 17).
 * Libraries like [`Luxon`](https://moment.github.io/luxon/#/) rely on `Intl` but fallback on the ISO 8601 definition (Saturday+Sunday) if `getWeekInfo` is not supported .
 */
export function getLocaleWeekEndRange(locale) {
    const data = ɵfindLocaleData(locale);
    return data[ɵLocaleDataIndex.WeekendRange];
}
/**
 * Retrieves a localized date-value formatting string.
 *
 * @param locale A locale code for the locale format rules to use.
 * @param width The format type.
 * @returns The localized formatting string.
 * @see {@link FormatWidth}
 * @see [Internationalization (i18n) Guide](guide/i18n)
 *
 * @publicApi
 *
 * @deprecated Angular recommends relying on the `Intl` API for i18n.
 * Use `Intl.DateTimeFormat` for date formating instead.
 */
export function getLocaleDateFormat(locale, width) {
    const data = ɵfindLocaleData(locale);
    return getLastDefinedValue(data[ɵLocaleDataIndex.DateFormat], width);
}
/**
 * Retrieves a localized time-value formatting string.
 *
 * @param locale A locale code for the locale format rules to use.
 * @param width The format type.
 * @returns The localized formatting string.
 * @see {@link FormatWidth}
 * @see [Internationalization (i18n) Guide](guide/i18n)

 * @publicApi
 * @deprecated Angular recommends relying on the `Intl` API for i18n.
 * Use `Intl.DateTimeFormat` for date formating instead.
 */
export function getLocaleTimeFormat(locale, width) {
    const data = ɵfindLocaleData(locale);
    return getLastDefinedValue(data[ɵLocaleDataIndex.TimeFormat], width);
}
/**
 * Retrieves a localized date-time formatting string.
 *
 * @param locale A locale code for the locale format rules to use.
 * @param width The format type.
 * @returns The localized formatting string.
 * @see {@link FormatWidth}
 * @see [Internationalization (i18n) Guide](guide/i18n)
 *
 * @publicApi
 *
 * @deprecated Angular recommends relying on the `Intl` API for i18n.
 * Use `Intl.DateTimeFormat` for date formating instead.
 */
export function getLocaleDateTimeFormat(locale, width) {
    const data = ɵfindLocaleData(locale);
    const dateTimeFormatData = data[ɵLocaleDataIndex.DateTimeFormat];
    return getLastDefinedValue(dateTimeFormatData, width);
}
/**
 * Retrieves a localized number symbol that can be used to replace placeholders in number formats.
 * @param locale The locale code.
 * @param symbol The symbol to localize. Must be one of `NumberSymbol`.
 * @returns The character for the localized symbol.
 * @see {@link NumberSymbol}
 * @see [Internationalization (i18n) Guide](guide/i18n)
 *
 * @publicApi
 *
 * @deprecated Angular recommends relying on the `Intl` API for i18n.
 * Use `Intl.NumberFormat` to format numbers instead.
 */
export function getLocaleNumberSymbol(locale, symbol) {
    const data = ɵfindLocaleData(locale);
    const res = data[ɵLocaleDataIndex.NumberSymbols][symbol];
    if (typeof res === 'undefined') {
        if (symbol === NumberSymbol.CurrencyDecimal) {
            return data[ɵLocaleDataIndex.NumberSymbols][NumberSymbol.Decimal];
        }
        else if (symbol === NumberSymbol.CurrencyGroup) {
            return data[ɵLocaleDataIndex.NumberSymbols][NumberSymbol.Group];
        }
    }
    return res;
}
/**
 * Retrieves a number format for a given locale.
 *
 * Numbers are formatted using patterns, like `#,###.00`. For example, the pattern `#,###.00`
 * when used to format the number 12345.678 could result in "12'345,678". That would happen if the
 * grouping separator for your language is an apostrophe, and the decimal separator is a comma.
 *
 * <b>Important:</b> The characters `.` `,` `0` `#` (and others below) are special placeholders
 * that stand for the decimal separator, and so on, and are NOT real characters.
 * You must NOT "translate" the placeholders. For example, don't change `.` to `,` even though in
 * your language the decimal point is written with a comma. The symbols should be replaced by the
 * local equivalents, using the appropriate `NumberSymbol` for your language.
 *
 * Here are the special characters used in number patterns:
 *
 * | Symbol | Meaning |
 * |--------|---------|
 * | . | Replaced automatically by the character used for the decimal point. |
 * | , | Replaced by the "grouping" (thousands) separator. |
 * | 0 | Replaced by a digit (or zero if there aren't enough digits). |
 * | # | Replaced by a digit (or nothing if there aren't enough). |
 * | ¤ | Replaced by a currency symbol, such as $ or USD. |
 * | % | Marks a percent format. The % symbol may change position, but must be retained. |
 * | E | Marks a scientific format. The E symbol may change position, but must be retained. |
 * | ' | Special characters used as literal characters are quoted with ASCII single quotes. |
 *
 * @param locale A locale code for the locale format rules to use.
 * @param type The type of numeric value to be formatted (such as `Decimal` or `Currency`.)
 * @returns The localized format string.
 * @see {@link NumberFormatStyle}
 * @see [CLDR website](http://cldr.unicode.org/translation/number-patterns)
 * @see [Internationalization (i18n) Guide](guide/i18n)
 *
 * @publicApi
 *
 * @deprecated Angular recommends relying on the `Intl` API for i18n.
 * Let `Intl.NumberFormat` determine the number format instead
 */
export function getLocaleNumberFormat(locale, type) {
    const data = ɵfindLocaleData(locale);
    return data[ɵLocaleDataIndex.NumberFormats][type];
}
/**
 * Retrieves the symbol used to represent the currency for the main country
 * corresponding to a given locale. For example, '$' for `en-US`.
 *
 * @param locale A locale code for the locale format rules to use.
 * @returns The localized symbol character,
 * or `null` if the main country cannot be determined.
 * @see [Internationalization (i18n) Guide](guide/i18n)
 *
 * @publicApi
 *
 * @deprecated Use the `Intl` API to format a currency with from currency code
 */
export function getLocaleCurrencySymbol(locale) {
    const data = ɵfindLocaleData(locale);
    return data[ɵLocaleDataIndex.CurrencySymbol] || null;
}
/**
 * Retrieves the name of the currency for the main country corresponding
 * to a given locale. For example, 'US Dollar' for `en-US`.
 * @param locale A locale code for the locale format rules to use.
 * @returns The currency name,
 * or `null` if the main country cannot be determined.
 * @see [Internationalization (i18n) Guide](guide/i18n)
 *
 * @publicApi
 *
 * @deprecated Use the `Intl` API to format a currency with from currency code
 */
export function getLocaleCurrencyName(locale) {
    const data = ɵfindLocaleData(locale);
    return data[ɵLocaleDataIndex.CurrencyName] || null;
}
/**
 * Retrieves the default currency code for the given locale.
 *
 * The default is defined as the first currency which is still in use.
 *
 * @param locale The code of the locale whose currency code we want.
 * @returns The code of the default currency for the given locale.
 *
 * @publicApi
 *
 * @deprecated We recommend you create a map of locale to ISO 4217 currency codes.
 * Time relative currency data is provided by the CLDR project. See https://www.unicode.org/cldr/charts/44/supplemental/detailed_territory_currency_information.html
 */
export function getLocaleCurrencyCode(locale) {
    return ɵgetLocaleCurrencyCode(locale);
}
/**
 * Retrieves the currency values for a given locale.
 * @param locale A locale code for the locale format rules to use.
 * @returns The currency values.
 * @see [Internationalization (i18n) Guide](guide/i18n)
 */
function getLocaleCurrencies(locale) {
    const data = ɵfindLocaleData(locale);
    return data[ɵLocaleDataIndex.Currencies];
}
/**
 * @publicApi
 *
 * @deprecated Angular recommends relying on the `Intl` API for i18n.
 * Use `Intl.PluralRules` instead
 */
export const getLocalePluralCase = ɵgetLocalePluralCase;
function checkFullData(data) {
    if (!data[ɵLocaleDataIndex.ExtraData]) {
        throw new Error(`Missing extra locale data for the locale "${data[ɵLocaleDataIndex.LocaleId]}". Use "registerLocaleData" to load new data. See the "I18n guide" on angular.io to know more.`);
    }
}
/**
 * Retrieves locale-specific rules used to determine which day period to use
 * when more than one period is defined for a locale.
 *
 * There is a rule for each defined day period. The
 * first rule is applied to the first day period and so on.
 * Fall back to AM/PM when no rules are available.
 *
 * A rule can specify a period as time range, or as a single time value.
 *
 * This functionality is only available when you have loaded the full locale data.
 * See the ["I18n guide"](guide/i18n/format-data-locale).
 *
 * @param locale A locale code for the locale format rules to use.
 * @returns The rules for the locale, a single time value or array of *from-time, to-time*,
 * or null if no periods are available.
 *
 * @see {@link getLocaleExtraDayPeriods}
 * @see [Internationalization (i18n) Guide](guide/i18n)
 *
 * @publicApi
 *
 * @deprecated Angular recommends relying on the `Intl` API for i18n.
 * Let `Intl.DateTimeFormat` determine the day period instead.
 */
export function getLocaleExtraDayPeriodRules(locale) {
    const data = ɵfindLocaleData(locale);
    checkFullData(data);
    const rules = data[ɵLocaleDataIndex.ExtraData][2 /* ɵExtraLocaleDataIndex.ExtraDayPeriodsRules */] || [];
    return rules.map((rule) => {
        if (typeof rule === 'string') {
            return extractTime(rule);
        }
        return [extractTime(rule[0]), extractTime(rule[1])];
    });
}
/**
 * Retrieves locale-specific day periods, which indicate roughly how a day is broken up
 * in different languages.
 * For example, for `en-US`, periods are morning, noon, afternoon, evening, and midnight.
 *
 * This functionality is only available when you have loaded the full locale data.
 * See the ["I18n guide"](guide/i18n/format-data-locale).
 *
 * @param locale A locale code for the locale format rules to use.
 * @param formStyle The required grammatical form.
 * @param width The required character width.
 * @returns The translated day-period strings.
 * @see {@link getLocaleExtraDayPeriodRules}
 * @see [Internationalization (i18n) Guide](guide/i18n)
 *
 * @publicApi
 *
 * @deprecated Angular recommends relying on the `Intl` API for i18n.
 * To extract a day period use `Intl.DateTimeFormat` with the `dayPeriod` option instead.
 */
export function getLocaleExtraDayPeriods(locale, formStyle, width) {
    const data = ɵfindLocaleData(locale);
    checkFullData(data);
    const dayPeriodsData = [
        data[ɵLocaleDataIndex.ExtraData][0 /* ɵExtraLocaleDataIndex.ExtraDayPeriodFormats */],
        data[ɵLocaleDataIndex.ExtraData][1 /* ɵExtraLocaleDataIndex.ExtraDayPeriodStandalone */],
    ];
    const dayPeriods = getLastDefinedValue(dayPeriodsData, formStyle) || [];
    return getLastDefinedValue(dayPeriods, width) || [];
}
/**
 * Retrieves the writing direction of a specified locale
 * @param locale A locale code for the locale format rules to use.
 * @publicApi
 * @returns 'rtl' or 'ltr'
 * @see [Internationalization (i18n) Guide](guide/i18n)
 *
 * @deprecated Angular recommends relying on the `Intl` API for i18n.
 * For dates and numbers, let `Intl.DateTimeFormat()` and `Intl.NumberFormat()` determine the writing direction.
 * The `Intl` alternative [`getTextInfo`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Locale/getTextInfo).
 * has only partial support (Chromium M99 & Safari 17).
 * 3rd party alternatives like [`rtl-detect`](https://www.npmjs.com/package/rtl-detect) can work around this issue.
 */
export function getLocaleDirection(locale) {
    const data = ɵfindLocaleData(locale);
    return data[ɵLocaleDataIndex.Directionality];
}
/**
 * Retrieves the first value that is defined in an array, going backwards from an index position.
 *
 * To avoid repeating the same data (as when the "format" and "standalone" forms are the same)
 * add the first value to the locale data arrays, and add other values only if they are different.
 *
 * @param data The data array to retrieve from.
 * @param index A 0-based index into the array to start from.
 * @returns The value immediately before the given index position.
 * @see [Internationalization (i18n) Guide](guide/i18n)
 *
 */
function getLastDefinedValue(data, index) {
    for (let i = index; i > -1; i--) {
        if (typeof data[i] !== 'undefined') {
            return data[i];
        }
    }
    throw new Error('Locale data API: locale data undefined');
}
/**
 * Extracts the hours and minutes from a string like "15:45"
 */
function extractTime(time) {
    const [h, m] = time.split(':');
    return { hours: +h, minutes: +m };
}
/**
 * Retrieves the currency symbol for a given currency code.
 *
 * For example, for the default `en-US` locale, the code `USD` can
 * be represented by the narrow symbol `$` or the wide symbol `US$`.
 *
 * @param code The currency code.
 * @param format The format, `wide` or `narrow`.
 * @param locale A locale code for the locale format rules to use.
 *
 * @returns The symbol, or the currency code if no symbol is available.
 * @see [Internationalization (i18n) Guide](guide/i18n)
 *
 * @publicApi
 *
 * @deprecated Angular recommends relying on the `Intl` API for i18n.
 * You can use `Intl.NumberFormat().formatToParts()` to extract the currency symbol.
 * For example: `Intl.NumberFormat('en', {style:'currency', currency: 'USD'}).formatToParts().find(part => part.type === 'currency').value`
 * returns `$` for USD currency code in the `en` locale.
 * Note: `US$` is a currency symbol for the `en-ca` locale but not the `en-us` locale.
 */
export function getCurrencySymbol(code, format, locale = 'en') {
    const currency = getLocaleCurrencies(locale)[code] || CURRENCIES_EN[code] || [];
    const symbolNarrow = currency[1 /* ɵCurrencyIndex.SymbolNarrow */];
    if (format === 'narrow' && typeof symbolNarrow === 'string') {
        return symbolNarrow;
    }
    return currency[0 /* ɵCurrencyIndex.Symbol */] || code;
}
// Most currencies have cents, that's why the default is 2
const DEFAULT_NB_OF_CURRENCY_DIGITS = 2;
/**
 * Reports the number of decimal digits for a given currency.
 * The value depends upon the presence of cents in that particular currency.
 *
 * @param code The currency code.
 * @returns The number of decimal digits, typically 0 or 2.
 * @see [Internationalization (i18n) Guide](guide/i18n)
 *
 * @publicApi
 *
 * @deprecated Angular recommends relying on the `Intl` API for i18n.
 * This function should not be used anymore. Let `Intl.NumberFormat` determine the number of digits to display for the currency
 */
export function getNumberOfCurrencyDigits(code) {
    let digits;
    const currency = CURRENCIES_EN[code];
    if (currency) {
        digits = currency[2 /* ɵCurrencyIndex.NbOfDigits */];
    }
    return typeof digits === 'number' ? digits : DEFAULT_NB_OF_CURRENCY_DIGITS;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibG9jYWxlX2RhdGFfYXBpLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tbW9uL3NyYy9pMThuL2xvY2FsZV9kYXRhX2FwaS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEVBR0wsZUFBZSxFQUNmLHNCQUFzQixFQUN0QixvQkFBb0IsRUFDcEIsZ0JBQWdCLEdBQ2pCLE1BQU0sZUFBZSxDQUFDO0FBRXZCLE9BQU8sRUFBQyxhQUFhLEVBQW9CLE1BQU0sY0FBYyxDQUFDO0FBRTlEOzs7Ozs7OztHQVFHO0FBQ0gsTUFBTSxDQUFOLElBQVksaUJBS1g7QUFMRCxXQUFZLGlCQUFpQjtJQUMzQiwrREFBTyxDQUFBO0lBQ1AsK0RBQU8sQ0FBQTtJQUNQLGlFQUFRLENBQUE7SUFDUixxRUFBVSxDQUFBO0FBQ1osQ0FBQyxFQUxXLGlCQUFpQixLQUFqQixpQkFBaUIsUUFLNUI7QUFFRDs7Ozs7Ozs7OztHQVVHO0FBQ0gsTUFBTSxDQUFOLElBQVksTUFPWDtBQVBELFdBQVksTUFBTTtJQUNoQixtQ0FBUSxDQUFBO0lBQ1IsaUNBQU8sQ0FBQTtJQUNQLGlDQUFPLENBQUE7SUFDUCxpQ0FBTyxDQUFBO0lBQ1AsbUNBQVEsQ0FBQTtJQUNSLHFDQUFTLENBQUE7QUFDWCxDQUFDLEVBUFcsTUFBTSxLQUFOLE1BQU0sUUFPakI7QUFFRDs7Ozs7Ozs7OztHQVVHO0FBQ0gsTUFBTSxDQUFOLElBQVksU0FHWDtBQUhELFdBQVksU0FBUztJQUNuQiw2Q0FBTSxDQUFBO0lBQ04scURBQVUsQ0FBQTtBQUNaLENBQUMsRUFIVyxTQUFTLEtBQVQsU0FBUyxRQUdwQjtBQUVEOzs7Ozs7OztHQVFHO0FBQ0gsTUFBTSxDQUFOLElBQVksZ0JBU1g7QUFURCxXQUFZLGdCQUFnQjtJQUMxQixnREFBZ0Q7SUFDaEQsMkRBQU0sQ0FBQTtJQUNOLG1EQUFtRDtJQUNuRCxxRUFBVyxDQUFB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QUMsQ0FBQyxDQUFDLDZCQUE2QixDQUFDO0FBQzdFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtcbiAgybVDdXJyZW5jeUluZGV4LFxuICDJtUV4dHJhTG9jYWxlRGF0YUluZGV4LFxuICDJtWZpbmRMb2NhbGVEYXRhLFxuICDJtWdldExvY2FsZUN1cnJlbmN5Q29kZSxcbiAgybVnZXRMb2NhbGVQbHVyYWxDYXNlLFxuICDJtUxvY2FsZURhdGFJbmRleCxcbn0gZnJvbSAnQGFuZ3VsYXIvY29yZSc7XG5cbmltcG9ydCB7Q1VSUkVOQ0lFU19FTiwgQ3VycmVuY2llc1N5bWJvbHN9IGZyb20gJy4vY3VycmVuY2llcyc7XG5cbi8qKlxuICogRm9ybWF0IHN0eWxlcyB0aGF0IGNhbiBiZSB1c2VkIHRvIHJlcHJlc2VudCBudW1iZXJzLlxuICogQHNlZSB7QGxpbmsgZ2V0TG9jYWxlTnVtYmVyRm9ybWF0fVxuICogQHNlZSBbSW50ZXJuYXRpb25hbGl6YXRpb24gKGkxOG4pIEd1aWRlXShndWlkZS9pMThuKVxuICpcbiAqIEBwdWJsaWNBcGlcbiAqXG4gKiBAZGVwcmVjYXRlZCBgZ2V0TG9jYWxlTnVtYmVyRm9ybWF0YCBpcyBkZXByZWNhdGVkXG4gKi9cbmV4cG9ydCBlbnVtIE51bWJlckZvcm1hdFN0eWxlIHtcbiAgRGVjaW1hbCxcbiAgUGVyY2VudCxcbiAgQ3VycmVuY3ksXG4gIFNjaWVudGlmaWMsXG59XG5cbi8qKlxuICogUGx1cmFsaXR5IGNhc2VzIHVzZWQgZm9yIHRyYW5zbGF0aW5nIHBsdXJhbHMgdG8gZGlmZmVyZW50IGxhbmd1YWdlcy5cbiAqXG4gKiBAc2VlIHtAbGluayBOZ1BsdXJhbH1cbiAqIEBzZWUge0BsaW5rIE5nUGx1cmFsQ2FzZX1cbiAqIEBzZWUgW0ludGVybmF0aW9uYWxpemF0aW9uIChpMThuKSBHdWlkZV0oZ3VpZGUvaTE4bilcbiAqXG4gKiBAcHVibGljQXBpXG4gKlxuICogQGRlcHJlY2F0ZWQgYGdldExvY2FsZVBsdXJhbENhc2VgIGlzIGRlcHJlY2F0ZWRcbiAqL1xuZXhwb3J0IGVudW0gUGx1cmFsIHtcbiAgWmVybyA9IDAsXG4gIE9uZSA9IDEsXG4gIFR3byA9IDIsXG4gIEZldyA9IDMsXG4gIE1hbnkgPSA0LFxuICBPdGhlciA9IDUsXG59XG5cbi8qKlxuICogQ29udGV4dC1kZXBlbmRhbnQgdHJhbnNsYXRpb24gZm9ybXMgZm9yIHN0cmluZ3MuXG4gKiBUeXBpY2FsbHkgdGhlIHN0YW5kYWxvbmUgdmVyc2lvbiBpcyBmb3IgdGhlIG5vbWluYXRpdmUgZm9ybSBvZiB0aGUgd29yZCxcbiAqIGFuZCB0aGUgZm9ybWF0IHZlcnNpb24gaXMgdXNlZCBmb3IgdGhlIGdlbml0aXZlIGNhc2UuXG4gKiBAc2VlIFtDTERSIHdlYnNpdGVdKGh0dHA6Ly9jbGRyLnVuaWNvZGUub3JnL3RyYW5zbGF0aW9uL2RhdGUtdGltZS0xL2RhdGUtdGltZSNUT0MtU3RhbmRhbG9uZS12cy4tRm9ybWF0LVN0eWxlcylcbiAqIEBzZWUgW0ludGVybmF0aW9uYWxpemF0aW9uIChpMThuKSBHdWlkZV0oZ3VpZGUvaTE4bilcbiAqXG4gKiBAcHVibGljQXBpXG4gKlxuICogQGRlcHJlY2F0ZWQgbG9jYWxlIGRhdGEgZ2V0dGVycyBhcmUgZGVwcmVjYXRlZFxuICovXG5leHBvcnQgZW51bSBGb3JtU3R5bGUge1xuICBGb3JtYXQsXG4gIFN0YW5kYWxvbmUsXG59XG5cbi8qKlxuICogU3RyaW5nIHdpZHRocyBhdmFpbGFibGUgZm9yIHRyYW5zbGF0aW9ucy5cbiAqIFRoZSBzcGVjaWZpYyBjaGFyYWN0ZXIgd2lkdGhzIGFyZSBsb2NhbGUtc3BlY2lmaWMuXG4gKiBFeGFtcGxlcyBhcmUgZ2l2ZW4gZm9yIHRoZSB3b3JkIFwiU3VuZGF5XCIgaW4gRW5nbGlzaC5cbiAqXG4gKiBAcHVibGljQXBpXG4gKlxuICogQGRlcHJlY2F0ZWQgbG9jYWxlIGRhdGEgZ2V0dGVycyBhcmUgZGVwcmVjYXRlZFxuICovXG5leHBvcnQgZW51bSBUcmFuc2xhdGlvbldpZHRoIHtcbiAgLyoqIDEgY2hhcmFjdGVyIGZvciBgZW4tVVNgLiBGb3IgZXhhbXBsZTogJ1MnICovXG4gIE5hcnJvdyxcbiAgLyoqIDMgY2hhcmFjdGVycyBmb3IgYGVuLVVTYC4gRm9yIGV4YW1wbGU6ICdTdW4nICovXG4gIEFiYnJldmlhdGVkLFxuICAvKiogRnVsbCBsZW5ndGggZm9yIGBlbi1VU2AuIEZvciBleGFtcGxlOiBcIlN1bmRheVwiICovXG4gIFdpZGUsXG4gIC8qKiAyIGNoYXJhY3RlcnMgZm9yIGBlbi1VU2AsIEZvciBleGFtcGxlOiBcIlN1XCIgKi9cbiAgU2hvcnQsXG59XG5cbi8qKlxuICogU3RyaW5nIHdpZHRocyBhdmFpbGFibGUgZm9yIGRhdGUtdGltZSBmb3JtYXRzLlxuICogVGhlIHNwZWNpZmljIGNoYXJhY3RlciB3aWR0aHMgYXJlIGxvY2FsZS1zcGVjaWZpYy5cbiAqIEV4YW1wbGVzIGFyZSBnaXZlbiBmb3IgYGVuLVVTYC5cbiAqXG4gKiBAc2VlIHtAbGluayBnZXRMb2NhbGVEYXRlRm9ybWF0fVxuICogQHNlZSB7QGxpbmsgZ2V0TG9jYWxlVGltZUZvcm1hdH1cbiAqIEBzZWUge0BsaW5rIGdldExvY2FsZURhdGVUaW1lRm9ybWF0fVxuICogQHNlZSBbSW50ZXJuYXRpb25hbGl6YXRpb24gKGkxOG4pIEd1aWRlXShndWlkZS9pMThuKVxuICogQHB1YmxpY0FwaVxuICpcbiAqIEBkZXByZWNhdGVkIERhdGUgbG9jYWxlIGRhdGEgZ2V0dGVycyBhcmUgZGVwcmVjYXRlZFxuICovXG5leHBvcnQgZW51bSBGb3JtYXRXaWR0aCB7XG4gIC8qKlxuICAgKiBGb3IgYGVuLVVTYCwgYCdNL2QveXksIGg6bW0gYSdgXG4gICAqIChFeGFtcGxlOiBgNi8xNS8xNSwgOTowMyBBTWApXG4gICAqL1xuICBTaG9ydCxcbiAgLyoqXG4gICAqIEZvciBgZW4tVVNgLCBgJ01NTSBkLCB5LCBoOm1tOnNzIGEnYFxuICAgKiAoRXhhbXBsZTogYEp1biAxNSwgMjAxNSwgOTowMzowMSBBTWApXG4gICAqL1xuICBNZWRpdW0sXG4gIC8qKlxuICAgKiBGb3IgYGVuLVVTYCwgYCdNTU1NIGQsIHksIGg6bW06c3MgYSB6J2BcbiAgICogKEV4YW1wbGU6IGBKdW5lIDE1LCAyMDE1IGF0IDk6MDM6MDEgQU0gR01UKzFgKVxuICAgKi9cbiAgTG9uZyxcbiAgLyoqXG4gICAqIEZvciBgZW4tVVNgLCBgJ0VFRUUsIE1NTU0gZCwgeSwgaDptbTpzcyBhIHp6enonYFxuICAgKiAoRXhhbXBsZTogYE1vbmRheSwgSnVuZSAxNSwgMjAxNSBhdCA5OjAzOjAxIEFNIEdNVCswMTowMGApXG4gICAqL1xuICBGdWxsLFxufVxuXG4vLyBUaGlzIG5lZWRzIHRvIGJlIGFuIG9iamVjdCBsaXRlcmFsLCByYXRoZXIgdGhhbiBhbiBlbnVtLCBiZWNhdXNlIFR5cGVTY3JpcHQgNS40K1xuLy8gZG9lc24ndCBhbGxvdyBudW1lcmljIGtleXMgYW5kIHdlIGhhdmUgYEluZmluaXR5YCBhbmQgYE5hTmAuXG4vKipcbiAqIFN5bWJvbHMgdGhhdCBjYW4gYmUgdXNlZCB0byByZXBsYWNlIHBsYWNlaG9sZGVycyBpbiBudW1iZXIgcGF0dGVybnMuXG4gKiBFeGFtcGxlcyBhcmUgYmFzZWQgb24gYGVuLVVTYCB2YWx1ZXMuXG4gKlxuICogQHNlZSB7QGxpbmsgZ2V0TG9jYWxlTnVtYmVyU3ltYm9sfVxuICogQHNlZSBbSW50ZXJuYXRpb25hbGl6YXRpb24gKGkxOG4pIEd1aWRlXShndWlkZS9pMThuKVxuICpcbiAqIEBwdWJsaWNBcGlcbiAqXG4gKiBAZGVwcmVjYXRlZCBgZ2V0TG9jYWxlTnVtYmVyU3ltYm9sYCBpcyBkZXByZWNhdGVkXG4gKlxuICogQG9iamVjdC1saXRlcmFsLWFzLWVudW1cbiAqL1xuZXhwb3J0IGNvbnN0IE51bWJlclN5bWJvbCA9IHtcbiAgLyoqXG4gICAqIERlY2ltYWwgc2VwYXJhdG9yLlxuICAgKiBGb3IgYGVuLVVTYCwgdGhlIGRvdCBjaGFyYWN0ZXIuXG4gICAqIEV4YW1wbGU6IDIsMzQ1YC5gNjdcbiAgICovXG4gIERlY2ltYWw6IDAsXG4gIC8qKlxuICAgKiBHcm91cGluZyBzZXBhcmF0b3IsIHR5cGljYWxseSBmb3IgdGhvdXNhbmRzLlxuICAgKiBGb3IgYGVuLVVTYCwgdGhlIGNvbW1hIGNoYXJhY3Rlci5cbiAgICogRXhhbXBsZTogMmAsYDM0NS42N1xuICAgKi9cbiAgR3JvdXA6IDEsXG4gIC8qKlxuICAgKiBMaXN0LWl0ZW0gc2VwYXJhdG9yLlxuICAgKiBFeGFtcGxlOiBcIm9uZSwgdHdvLCBhbmQgdGhyZWVcIlxuICAgKi9cbiAgTGlzdDogMixcbiAgLyoqXG4gICAqIFNpZ24gZm9yIHBlcmNlbnRhZ2UgKG91dCBvZiAxMDApLlxuICAgKiBFeGFtcGxlOiAyMy40JVxuICAgKi9cbiAgUGVyY2VudFNpZ246IDMsXG4gIC8qKlxuICAgKiBTaWduIGZvciBwb3NpdGl2ZSBudW1iZXJzLlxuICAgKiBFeGFtcGxlOiArMjNcbiAgICovXG4gIFBsdXNTaWduOiA0LFxuICAvKipcbiAgICogU2lnbiBmb3IgbmVnYXRpdmUgbnVtYmVycy5cbiAgICogRXhhbXBsZTogLTIzXG4gICAqL1xuICBNaW51c1NpZ246IDUsXG4gIC8qKlxuICAgKiBDb21wdXRlciBub3RhdGlvbiBmb3IgZXhwb25lbnRpYWwgdmFsdWUgKG4gdGltZXMgYSBwb3dlciBvZiAxMCkuXG4gICAqIEV4YW1wbGU6IDEuMkUzXG4gICAqL1xuICBFeHBvbmVudGlhbDogNixcbiAgLyoqXG4gICAqIEh1bWFuLXJlYWRhYmxlIGZvcm1hdCBvZiBleHBvbmVudGlhbC5cbiAgICogRXhhbXBsZTogMS4yeDEwM1xuICAgKi9cbiAgU3VwZXJzY3JpcHRpbmdFeHBvbmVudDogNyxcbiAgLyoqXG4gICAqIFNpZ24gZm9yIHBlcm1pbGxlIChvdXQgb2YgMTAwMCkuXG4gICAqIEV4YW1wbGU6IDIzLjTigLBcbiAgICovXG4gIFBlck1pbGxlOiA4LFxuICAvKipcbiAgICogSW5maW5pdHksIGNhbiBiZSB1c2VkIHdpdGggcGx1cyBhbmQgbWludXMuXG4gICAqIEV4YW1wbGU6IOKIniwgK+KIniwgLeKInlxuICAgKi9cbiAgSW5maW5pdHk6IDksXG4gIC8qKlxuICAgKiBOb3QgYSBudW1iZXIuXG4gICAqIEV4YW1wbGU6IE5hTlxuICAgKi9cbiAgTmFOOiAxMCxcbiAgLyoqXG4gICAqIFN5bWJvbCB1c2VkIGJldHdlZW4gdGltZSB1bml0cy5cbiAgICogRXhhbXBsZTogMTA6NTJcbiAgICovXG4gIFRpbWVTZXBhcmF0b3I6IDExLFxuICAvKipcbiAgICogRGVjaW1hbCBzZXBhcmF0b3IgZm9yIGN1cnJlbmN5IHZhbHVlcyAoZmFsbGJhY2sgdG8gYERlY2ltYWxgKS5cbiAgICogRXhhbXBsZTogJDIsMzQ1LjY3XG4gICAqL1xuICBDdXJyZW5jeURlY2ltYWw6IDEyLFxuICAvKipcbiAgICogR3JvdXAgc2VwYXJhdG9yIGZvciBjdXJyZW5jeSB2YWx1ZXMgKGZhbGxiYWNrIHRvIGBHcm91cGApLlxuICAgKiBFeGFtcGxlOiAkMiwzNDUuNjdcbiAgICovXG4gIEN1cnJlbmN5R3JvdXA6IDEzLFxufSBhcyBjb25zdDtcblxuZXhwb3J0IHR5cGUgTnVtYmVyU3ltYm9sID0gKHR5cGVvZiBOdW1iZXJTeW1ib2wpW2tleW9mIHR5cGVvZiBOdW1iZXJTeW1ib2xdO1xuXG4vKipcbiAqIFRoZSB2YWx1ZSBmb3IgZWFjaCBkYXkgb2YgdGhlIHdlZWssIGJhc2VkIG9uIHRoZSBgZW4tVVNgIGxvY2FsZVxuICpcbiAqIEBwdWJsaWNBcGlcbiAqXG4gKiBAZGVwcmVjYXRlZCBXZWVrIGxvY2FsZSBnZXR0ZXJzIGFyZSBkZXByZWNhdGVkXG4gKi9cbmV4cG9ydCBlbnVtIFdlZWtEYXkge1xuICBTdW5kYXkgPSAwLFxuICBNb25kYXksXG4gIFR1ZXNkYXksXG4gIFdlZG5lc2RheSxcbiAgVGh1cnNkYXksXG4gIEZyaWRheSxcbiAgU2F0dXJkYXksXG59XG5cbi8qKlxuICogUmV0cmlldmVzIHRoZSBsb2NhbGUgSUQgZnJvbSB0aGUgY3VycmVudGx5IGxvYWRlZCBsb2NhbGUuXG4gKiBUaGUgbG9hZGVkIGxvY2FsZSBjb3VsZCBiZSwgZm9yIGV4YW1wbGUsIGEgZ2xvYmFsIG9uZSByYXRoZXIgdGhhbiBhIHJlZ2lvbmFsIG9uZS5cbiAqIEBwYXJhbSBsb2NhbGUgQSBsb2NhbGUgY29kZSwgc3VjaCBhcyBgZnItRlJgLlxuICogQHJldHVybnMgVGhlIGxvY2FsZSBjb2RlLiBGb3IgZXhhbXBsZSwgYGZyYC5cbiAqIEBzZWUgW0ludGVybmF0aW9uYWxpemF0aW9uIChpMThuKSBHdWlkZV0oZ3VpZGUvaTE4bilcbiAqXG4gKiBAcHVibGljQXBpXG4gKlxuICogQGRlcHJlY2F0ZWQgQW5ndWxhciByZWNvbW1lbmRzIHJlbHlpbmcgb24gdGhlIGBJbnRsYCBBUEkgZm9yIGkxOG4uXG4gKiBUaGlzIGZ1bmN0aW9uIHNlcnZlcyBubyBwdXJwb3NlIHdoZW4gcmVseWluZyBvbiB0aGUgYEludGxgIEFQSS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldExvY2FsZUlkKGxvY2FsZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIMm1ZmluZExvY2FsZURhdGEobG9jYWxlKVvJtUxvY2FsZURhdGFJbmRleC5Mb2NhbGVJZF07XG59XG5cbi8qKlxuICogUmV0cmlldmVzIGRheSBwZXJpb2Qgc3RyaW5ncyBmb3IgdGhlIGdpdmVuIGxvY2FsZS5cbiAqXG4gKiBAcGFyYW0gbG9jYWxlIEEgbG9jYWxlIGNvZGUgZm9yIHRoZSBsb2NhbGUgZm9ybWF0IHJ1bGVzIHRvIHVzZS5cbiAqIEBwYXJhbSBmb3JtU3R5bGUgVGhlIHJlcXVpcmVkIGdyYW1tYXRpY2FsIGZvcm0uXG4gKiBAcGFyYW0gd2lkdGggVGhlIHJlcXVpcmVkIGNoYXJhY3RlciB3aWR0aC5cbiAqIEByZXR1cm5zIEFuIGFycmF5IG9mIGxvY2FsaXplZCBwZXJpb2Qgc3RyaW5ncy4gRm9yIGV4YW1wbGUsIGBbQU0sIFBNXWAgZm9yIGBlbi1VU2AuXG4gKiBAc2VlIFtJbnRlcm5hdGlvbmFsaXphdGlvbiAoaTE4bikgR3VpZGVdKGd1aWRlL2kxOG4pXG4gKlxuICogQHB1YmxpY0FwaVxuICpcbiAqIEBkZXByZWNhdGVkIEFuZ3VsYXIgcmVjb21tZW5kcyByZWx5aW5nIG9uIHRoZSBgSW50bGAgQVBJIGZvciBpMThuLlxuICogVXNlIGBJbnRsLkRhdGVUaW1lRm9ybWF0YCBmb3IgZGF0ZSBmb3JtYXRpbmcgaW5zdGVhZC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldExvY2FsZURheVBlcmlvZHMoXG4gIGxvY2FsZTogc3RyaW5nLFxuICBmb3JtU3R5bGU6IEZvcm1TdHlsZSxcbiAgd2lkdGg6IFRyYW5zbGF0aW9uV2lkdGgsXG4pOiBSZWFkb25seTxbc3RyaW5nLCBzdHJpbmddPiB7XG4gIGNvbnN0IGRhdGEgPSDJtWZpbmRMb2NhbGVEYXRhKGxvY2FsZSk7XG4gIGNvbnN0IGFtUG1EYXRhID0gPFtzdHJpbmcsIHN0cmluZ11bXVtdPltcbiAgICBkYXRhW8m1TG9jYWxlRGF0YUluZGV4LkRheVBlcmlvZHNGb3JtYXRdLFxuICAgIGRhdGFbybVMb2NhbGVEYXRhSW5kZXguRGF5UGVyaW9kc1N0YW5kYWxvbmVdLFxuICBdO1xuICBjb25zdCBhbVBtID0gZ2V0TGFzdERlZmluZWRWYWx1ZShhbVBtRGF0YSwgZm9ybVN0eWxlKTtcbiAgcmV0dXJuIGdldExhc3REZWZpbmVkVmFsdWUoYW1QbSwgd2lkdGgpO1xufVxuXG4vKipcbiAqIFJldHJpZXZlcyBkYXlzIG9mIHRoZSB3ZWVrIGZvciB0aGUgZ2l2ZW4gbG9jYWxlLCB1c2luZyB0aGUgR3JlZ29yaWFuIGNhbGVuZGFyLlxuICpcbiAqIEBwYXJhbSBsb2NhbGUgQSBsb2NhbGUgY29kZSBmb3IgdGhlIGxvY2FsZSBmb3JtYXQgcnVsZXMgdG8gdXNlLlxuICogQHBhcmFtIGZvcm1TdHlsZSBUaGUgcmVxdWlyZWQgZ3JhbW1hdGljYWwgZm9ybS5cbiAqIEBwYXJhbSB3aWR0aCBUaGUgcmVxdWlyZWQgY2hhcmFjdGVyIHdpZHRoLlxuICogQHJldHVybnMgQW4gYXJyYXkgb2YgbG9jYWxpemVkIG5hbWUgc3RyaW5ncy5cbiAqIEZvciBleGFtcGxlLGBbU3VuZGF5LCBNb25kYXksIC4uLiBTYXR1cmRheV1gIGZvciBgZW4tVVNgLlxuICogQHNlZSBbSW50ZXJuYXRpb25hbGl6YXRpb24gKGkxOG4pIEd1aWRlXShndWlkZS9pMThuKVxuICpcbiAqIEBwdWJsaWNBcGlcbiAqXG4gKiBAZGVwcmVjYXRlZCBBbmd1bGFyIHJlY29tbWVuZHMgcmVseWluZyBvbiB0aGUgYEludGxgIEFQSSBmb3IgaTE4bi5cbiAqIFVzZSBgSW50bC5EYXRlVGltZUZvcm1hdGAgZm9yIGRhdGUgZm9ybWF0aW5nIGluc3RlYWQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRMb2NhbGVEYXlOYW1lcyhcbiAgbG9jYWxlOiBzdHJpbmcsXG4gIGZvcm1TdHlsZTogRm9ybVN0eWxlLFxuICB3aWR0aDogVHJhbnNsYXRpb25XaWR0aCxcbik6IFJlYWRvbmx5QXJyYXk8c3RyaW5nPiB7XG4gIGNvbnN0IGRhdGEgPSDJtWZpbmRMb2NhbGVEYXRhKGxvY2FsZSk7XG4gIGNvbnN0IGRheXNEYXRhID0gPHN0cmluZ1tdW11bXT5bXG4gICAgZGF0YVvJtUxvY2FsZURhdGFJbmRleC5EYXlzRm9ybWF0XSxcbiAgICBkYXRhW8m1TG9jYWxlRGF0YUluZGV4LkRheXNTdGFuZGFsb25lXSxcbiAgXTtcbiAgY29uc3QgZGF5cyA9IGdldExhc3REZWZpbmVkVmFsdWUoZGF5c0RhdGEsIGZvcm1TdHlsZSk7XG4gIHJldHVybiBnZXRMYXN0RGVmaW5lZFZhbHVlKGRheXMsIHdpZHRoKTtcbn1cblxuLyoqXG4gKiBSZXRyaWV2ZXMgbW9udGhzIG9mIHRoZSB5ZWFyIGZvciB0aGUgZ2l2ZW4gbG9jYWxlLCB1c2luZyB0aGUgR3JlZ29yaWFuIGNhbGVuZGFyLlxuICpcbiAqIEBwYXJhbSBsb2NhbGUgQSBsb2NhbGUgY29kZSBmb3IgdGhlIGxvY2FsZSBmb3JtYXQgcnVsZXMgdG8gdXNlLlxuICogQHBhcmFtIGZvcm1TdHlsZSBUaGUgcmVxdWlyZWQgZ3JhbW1hdGljYWwgZm9ybS5cbiAqIEBwYXJhbSB3aWR0aCBUaGUgcmVxdWlyZWQgY2hhcmFjdGVyIHdpZHRoLlxuICogQHJldHVybnMgQW4gYXJyYXkgb2YgbG9jYWxpemVkIG5hbWUgc3RyaW5ncy5cbiAqIEZvciBleGFtcGxlLCAgYFtKYW51YXJ5LCBGZWJydWFyeSwgLi4uXWAgZm9yIGBlbi1VU2AuXG4gKiBAc2VlIFtJbnRlcm5hdGlvbmFsaXphdGlvbiAoaTE4bikgR3VpZGVdKGd1aWRlL2kxOG4pXG4gKlxuICogQHB1YmxpY0FwaVxuICpcbiAqIEBkZXByZWNhdGVkIEFuZ3VsYXIgcmVjb21tZW5kcyByZWx5aW5nIG9uIHRoZSBgSW50bGAgQVBJIGZvciBpMThuLlxuICogVXNlIGBJbnRsLkRhdGVUaW1lRm9ybWF0YCBmb3IgZGF0ZSBmb3JtYXRpbmcgaW5zdGVhZC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldExvY2FsZU1vbnRoTmFtZXMoXG4gIGxvY2FsZTogc3RyaW5nLFxuICBmb3JtU3R5bGU6IEZvcm1TdHlsZSxcbiAgd2lkdGg6IFRyYW5zbGF0aW9uV2lkdGgsXG4pOiBSZWFkb25seUFycmF5PHN0cmluZz4ge1xuICBjb25zdCBkYXRhID0gybVmaW5kTG9jYWxlRGF0YShsb2NhbGUpO1xuICBjb25zdCBtb250aHNEYXRhID0gPHN0cmluZ1tdW11bXT5bXG4gICAgZGF0YVvJtUxvY2FsZURhdGFJbmRleC5Nb250aHNGb3JtYXRdLFxuICAgIGRhdGFbybVMb2NhbGVEYXRhSW5kZXguTW9udGhzU3RhbmRhbG9uZV0sXG4gIF07XG4gIGNvbnN0IG1vbnRocyA9IGdldExhc3REZWZpbmVkVmFsdWUobW9udGhzRGF0YSwgZm9ybVN0eWxlKTtcbiAgcmV0dXJuIGdldExhc3REZWZpbmVkVmFsdWUobW9udGhzLCB3aWR0aCk7XG59XG5cbi8qKlxuICogUmV0cmlldmVzIEdyZWdvcmlhbi1jYWxlbmRhciBlcmFzIGZvciB0aGUgZ2l2ZW4gbG9jYWxlLlxuICogQHBhcmFtIGxvY2FsZSBBIGxvY2FsZSBjb2RlIGZvciB0aGUgbG9jYWxlIGZvcm1hdCBydWxlcyB0byB1c2UuXG4gKiBAcGFyYW0gd2lkdGggVGhlIHJlcXVpcmVkIGNoYXJhY3RlciB3aWR0aC5cblxuICogQHJldHVybnMgQW4gYXJyYXkgb2YgbG9jYWxpemVkIGVyYSBzdHJpbmdzLlxuICogRm9yIGV4YW1wbGUsIGBbQUQsIEJDXWAgZm9yIGBlbi1VU2AuXG4gKiBAc2VlIFtJbnRlcm5hdGlvbmFsaXphdGlvbiAoaTE4bikgR3VpZGVdKGd1aWRlL2kxOG4pXG4gKlxuICogQHB1YmxpY0FwaVxuICpcbiAqIEBkZXByZWNhdGVkIEFuZ3VsYXIgcmVjb21tZW5kcyByZWx5aW5nIG9uIHRoZSBgSW50bGAgQVBJIGZvciBpMThuLlxuICogVXNlIGBJbnRsLkRhdGVUaW1lRm9ybWF0YCBmb3IgZGF0ZSBmb3JtYXRpbmcgaW5zdGVhZC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldExvY2FsZUVyYU5hbWVzKFxuICBsb2NhbGU6IHN0cmluZyxcbiAgd2lkdGg6IFRyYW5zbGF0aW9uV2lkdGgsXG4pOiBSZWFkb25seTxbc3RyaW5nLCBzdHJpbmddPiB7XG4gIGNvbnN0IGRhdGEgPSDJtWZpbmRMb2NhbGVEYXRhKGxvY2FsZSk7XG4gIGNvbnN0IGVyYXNEYXRhID0gPFtzdHJpbmcsIHN0cmluZ11bXT5kYXRhW8m1TG9jYWxlRGF0YUluZGV4LkVyYXNdO1xuICByZXR1cm4gZ2V0TGFzdERlZmluZWRWYWx1ZShlcmFzRGF0YSwgd2lkdGgpO1xufVxuXG4vKipcbiAqIFJldHJpZXZlcyB0aGUgZmlyc3QgZGF5IG9mIHRoZSB3ZWVrIGZvciB0aGUgZ2l2ZW4gbG9jYWxlLlxuICpcbiAqIEBwYXJhbSBsb2NhbGUgQSBsb2NhbGUgY29kZSBmb3IgdGhlIGxvY2FsZSBmb3JtYXQgcnVsZXMgdG8gdXNlLlxuICogQHJldHVybnMgQSBkYXkgaW5kZXggbnVtYmVyLCB1c2luZyB0aGUgMC1iYXNlZCB3ZWVrLWRheSBpbmRleCBmb3IgYGVuLVVTYFxuICogKFN1bmRheSA9IDAsIE1vbmRheSA9IDEsIC4uLikuXG4gKiBGb3IgZXhhbXBsZSwgZm9yIGBmci1GUmAsIHJldHVybnMgMSB0byBpbmRpY2F0ZSB0aGF0IHRoZSBmaXJzdCBkYXkgaXMgTW9uZGF5LlxuICogQHNlZSBbSW50ZXJuYXRpb25hbGl6YXRpb24gKGkxOG4pIEd1aWRlXShndWlkZS9pMThuKVxuICpcbiAqIEBwdWJsaWNBcGlcbiAqXG4gKiBAZGVwcmVjYXRlZCBBbmd1bGFyIHJlY29tbWVuZHMgcmVseWluZyBvbiB0aGUgYEludGxgIEFQSSBmb3IgaTE4bi5cbiAqIEludGwncyBbYGdldFdlZWtJbmZvYF0oaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvSmF2YVNjcmlwdC9SZWZlcmVuY2UvR2xvYmFsX09iamVjdHMvSW50bC9Mb2NhbGUvZ2V0V2Vla0luZm8pIGhhcyBwYXJ0aWFsIHN1cHBvcnQgKENocm9taXVtIE05OSAmIFNhZmFyaSAxNykuXG4gKiBZb3UgbWF5IHdhbnQgdG8gcmVseSBvbiB0aGUgZm9sbG93aW5nIGFsdGVybmF0aXZlczpcbiAqIC0gTGlicmFyaWVzIGxpa2UgW2BMdXhvbmBdKGh0dHBzOi8vbW9tZW50LmdpdGh1Yi5pby9sdXhvbi8jLykgcmVseSBvbiBgSW50bGAgYnV0IGZhbGxiYWNrIG9uIHRoZSBJU08gODYwMSBkZWZpbml0aW9uIChtb25kYXkpIGlmIGBnZXRXZWVrSW5mb2AgaXMgbm90IHN1cHBvcnRlZC5cbiAqIC0gT3RoZXIgbGlicmFpcmllcyBsaWtlIFtgZGF0ZS1mbnNgXShodHRwczovL2RhdGUtZm5zLm9yZy8pLCBbYGRheS5qc2BdKGh0dHBzOi8vZGF5LmpzLm9yZy9lbi8pIG9yIFtgd2Vla3N0YXJ0YF0oaHR0cHM6Ly93d3cubnBtanMuY29tL3BhY2thZ2Uvd2Vla3N0YXJ0KSBsaWJyYXJ5IHByb3ZpZGUgdGhlaXIgb3duIGxvY2FsZSBiYXNlZCBkYXRhIGZvciB0aGUgZmlyc3QgZGF5IG9mIHRoZSB3ZWVrLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0TG9jYWxlRmlyc3REYXlPZldlZWsobG9jYWxlOiBzdHJpbmcpOiBXZWVrRGF5IHtcbiAgY29uc3QgZGF0YSA9IMm1ZmluZExvY2FsZURhdGEobG9jYWxlKTtcbiAgcmV0dXJuIGRhdGFbybVMb2NhbGVEYXRhSW5kZXguRmlyc3REYXlPZldlZWtdO1xufVxuXG4vKipcbiAqIFJhbmdlIG9mIHdlZWsgZGF5cyB0aGF0IGFyZSBjb25zaWRlcmVkIHRoZSB3ZWVrLWVuZCBmb3IgdGhlIGdpdmVuIGxvY2FsZS5cbiAqXG4gKiBAcGFyYW0gbG9jYWxlIEEgbG9jYWxlIGNvZGUgZm9yIHRoZSBsb2NhbGUgZm9ybWF0IHJ1bGVzIHRvIHVzZS5cbiAqIEByZXR1cm5zIFRoZSByYW5nZSBvZiBkYXkgdmFsdWVzLCBgW3N0YXJ0RGF5LCBlbmREYXldYC5cbiAqIEBzZWUgW0ludGVybmF0aW9uYWxpemF0aW9uIChpMThuKSBHdWlkZV0oZ3VpZGUvaTE4bilcbiAqXG4gKiBAcHVibGljQXBpXG4gKlxuICogQGRlcHJlY2F0ZWQgQW5ndWxhciByZWNvbW1lbmRzIHJlbHlpbmcgb24gdGhlIGBJbnRsYCBBUEkgZm9yIGkxOG4uXG4gKiBJbnRsJ3MgW2BnZXRXZWVrSW5mb2BdKGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0phdmFTY3JpcHQvUmVmZXJlbmNlL0dsb2JhbF9PYmplY3RzL0ludGwvTG9jYWxlL2dldFdlZWtJbmZvKSBoYXMgcGFydGlhbCBzdXBwb3J0IChDaHJvbWl1bSBNOTkgJiBTYWZhcmkgMTcpLlxuICogTGlicmFyaWVzIGxpa2UgW2BMdXhvbmBdKGh0dHBzOi8vbW9tZW50LmdpdGh1Yi5pby9sdXhvbi8jLykgcmVseSBvbiBgSW50bGAgYnV0IGZhbGxiYWNrIG9uIHRoZSBJU08gODYwMSBkZWZpbml0aW9uIChTYXR1cmRheStTdW5kYXkpIGlmIGBnZXRXZWVrSW5mb2AgaXMgbm90IHN1cHBvcnRlZCAuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRMb2NhbGVXZWVrRW5kUmFuZ2UobG9jYWxlOiBzdHJpbmcpOiBbV2Vla0RheSwgV2Vla0RheV0ge1xuICBjb25zdCBkYXRhID0gybVmaW5kTG9jYWxlRGF0YShsb2NhbGUpO1xuICByZXR1cm4gZGF0YVvJtUxvY2FsZURhdGFJbmRleC5XZWVrZW5kUmFuZ2VdO1xufVxuXG4vKipcbiAqIFJldHJpZXZlcyBhIGxvY2FsaXplZCBkYXRlLXZhbHVlIGZvcm1hdHRpbmcgc3RyaW5nLlxuICpcbiAqIEBwYXJhbSBsb2NhbGUgQSBsb2NhbGUgY29kZSBmb3IgdGhlIGxvY2FsZSBmb3JtYXQgcnVsZXMgdG8gdXNlLlxuICogQHBhcmFtIHdpZHRoIFRoZSBmb3JtYXQgdHlwZS5cbiAqIEByZXR1cm5zIFRoZSBsb2NhbGl6ZWQgZm9ybWF0dGluZyBzdHJpbmcuXG4gKiBAc2VlIHtAbGluayBGb3JtYXRXaWR0aH1cbiAqIEBzZWUgW0ludGVybmF0aW9uYWxpemF0aW9uIChpMThuKSBHdWlkZV0oZ3VpZGUvaTE4bilcbiAqXG4gKiBAcHVibGljQXBpXG4gKlxuICogQGRlcHJlY2F0ZWQgQW5ndWxhciByZWNvbW1lbmRzIHJlbHlpbmcgb24gdGhlIGBJbnRsYCBBUEkgZm9yIGkxOG4uXG4gKiBVc2UgYEludGwuRGF0ZVRpbWVGb3JtYXRgIGZvciBkYXRlIGZvcm1hdGluZyBpbnN0ZWFkLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0TG9jYWxlRGF0ZUZvcm1hdChsb2NhbGU6IHN0cmluZywgd2lkdGg6IEZvcm1hdFdpZHRoKTogc3RyaW5nIHtcbiAgY29uc3QgZGF0YSA9IMm1ZmluZExvY2FsZURhdGEobG9jYWxlKTtcbiAgcmV0dXJuIGdldExhc3REZWZpbmVkVmFsdWUoZGF0YVvJtUxvY2FsZURhdGFJbmRleC5EYXRlRm9ybWF0XSwgd2lkdGgpO1xufVxuXG4vKipcbiAqIFJldHJpZXZlcyBhIGxvY2FsaXplZCB0aW1lLXZhbHVlIGZvcm1hdHRpbmcgc3RyaW5nLlxuICpcbiAqIEBwYXJhbSBsb2NhbGUgQSBsb2NhbGUgY29kZSBmb3IgdGhlIGxvY2FsZSBmb3JtYXQgcnVsZXMgdG8gdXNlLlxuICogQHBhcmFtIHdpZHRoIFRoZSBmb3JtYXQgdHlwZS5cbiAqIEByZXR1cm5zIFRoZSBsb2NhbGl6ZWQgZm9ybWF0dGluZyBzdHJpbmcuXG4gKiBAc2VlIHtAbGluayBGb3JtYXRXaWR0aH1cbiAqIEBzZWUgW0ludGVybmF0aW9uYWxpemF0aW9uIChpMThuKSBHdWlkZV0oZ3VpZGUvaTE4bilcblxuICogQHB1YmxpY0FwaVxuICogQGRlcHJlY2F0ZWQgQW5ndWxhciByZWNvbW1lbmRzIHJlbHlpbmcgb24gdGhlIGBJbnRsYCBBUEkgZm9yIGkxOG4uXG4gKiBVc2UgYEludGwuRGF0ZVRpbWVGb3JtYXRgIGZvciBkYXRlIGZvcm1hdGluZyBpbnN0ZWFkLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0TG9jYWxlVGltZUZvcm1hdChsb2NhbGU6IHN0cmluZywgd2lkdGg6IEZvcm1hdFdpZHRoKTogc3RyaW5nIHtcbiAgY29uc3QgZGF0YSA9IMm1ZmluZExvY2FsZURhdGEobG9jYWxlKTtcbiAgcmV0dXJuIGdldExhc3REZWZpbmVkVmFsdWUoZGF0YVvJtUxvY2FsZURhdGFJbmRleC5UaW1lRm9ybWF0XSwgd2lkdGgpO1xufVxuXG4vKipcbiAqIFJldHJpZXZlcyBhIGxvY2FsaXplZCBkYXRlLXRpbWUgZm9ybWF0dGluZyBzdHJpbmcuXG4gKlxuICogQHBhcmFtIGxvY2FsZSBBIGxvY2FsZSBjb2RlIGZvciB0aGUgbG9jYWxlIGZvcm1hdCBydWxlcyB0byB1c2UuXG4gKiBAcGFyYW0gd2lkdGggVGhlIGZvcm1hdCB0eXBlLlxuICogQHJldHVybnMgVGhlIGxvY2FsaXplZCBmb3JtYXR0aW5nIHN0cmluZy5cbiAqIEBzZWUge0BsaW5rIEZvcm1hdFdpZHRofVxuICogQHNlZSBbSW50ZXJuYXRpb25hbGl6YXRpb24gKGkxOG4pIEd1aWRlXShndWlkZS9pMThuKVxuICpcbiAqIEBwdWJsaWNBcGlcbiAqXG4gKiBAZGVwcmVjYXRlZCBBbmd1bGFyIHJlY29tbWVuZHMgcmVseWluZyBvbiB0aGUgYEludGxgIEFQSSBmb3IgaTE4bi5cbiAqIFVzZSBgSW50bC5EYXRlVGltZUZvcm1hdGAgZm9yIGRhdGUgZm9ybWF0aW5nIGluc3RlYWQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRMb2NhbGVEYXRlVGltZUZvcm1hdChsb2NhbGU6IHN0cmluZywgd2lkdGg6IEZvcm1hdFdpZHRoKTogc3RyaW5nIHtcbiAgY29uc3QgZGF0YSA9IMm1ZmluZExvY2FsZURhdGEobG9jYWxlKTtcbiAgY29uc3QgZGF0ZVRpbWVGb3JtYXREYXRhID0gPHN0cmluZ1tdPmRhdGFbybVMb2NhbGVEYXRhSW5kZXguRGF0ZVRpbWVGb3JtYXRdO1xuICByZXR1cm4gZ2V0TGFzdERlZmluZWRWYWx1ZShkYXRlVGltZUZvcm1hdERhdGEsIHdpZHRoKTtcbn1cblxuLyoqXG4gKiBSZXRyaWV2ZXMgYSBsb2NhbGl6ZWQgbnVtYmVyIHN5bWJvbCB0aGF0IGNhbiBiZSB1c2VkIHRvIHJlcGxhY2UgcGxhY2Vob2xkZXJzIGluIG51bWJlciBmb3JtYXRzLlxuICogQHBhcmFtIGxvY2FsZSBUaGUgbG9jYWxlIGNvZGUuXG4gKiBAcGFyYW0gc3ltYm9sIFRoZSBzeW1ib2wgdG8gbG9jYWxpemUuIE11c3QgYmUgb25lIG9mIGBOdW1iZXJTeW1ib2xgLlxuICogQHJldHVybnMgVGhlIGNoYXJhY3RlciBmb3IgdGhlIGxvY2FsaXplZCBzeW1ib2wuXG4gKiBAc2VlIHtAbGluayBOdW1iZXJTeW1ib2x9XG4gKiBAc2VlIFtJbnRlcm5hdGlvbmFsaXphdGlvbiAoaTE4bikgR3VpZGVdKGd1aWRlL2kxOG4pXG4gKlxuICogQHB1YmxpY0FwaVxuICpcbiAqIEBkZXByZWNhdGVkIEFuZ3VsYXIgcmVjb21tZW5kcyByZWx5aW5nIG9uIHRoZSBgSW50bGAgQVBJIGZvciBpMThuLlxuICogVXNlIGBJbnRsLk51bWJlckZvcm1hdGAgdG8gZm9ybWF0IG51bWJlcnMgaW5zdGVhZC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldExvY2FsZU51bWJlclN5bWJvbChsb2NhbGU6IHN0cmluZywgc3ltYm9sOiBOdW1iZXJTeW1ib2wpOiBzdHJpbmcge1xuICBjb25zdCBkYXRhID0gybVmaW5kTG9jYWxlRGF0YShsb2NhbGUpO1xuICBjb25zdCByZXMgPSBkYXRhW8m1TG9jYWxlRGF0YUluZGV4Lk51bWJlclN5bWJvbHNdW3N5bWJvbF07XG4gIGlmICh0eXBlb2YgcmVzID09PSAndW5kZWZpbmVkJykge1xuICAgIGlmIChzeW1ib2wgPT09IE51bWJlclN5bWJvbC5DdXJyZW5jeURlY2ltYWwpIHtcbiAgICAgIHJldHVybiBkYXRhW8m1TG9jYWxlRGF0YUluZGV4Lk51bWJlclN5bWJvbHNdW051bWJlclN5bWJvbC5EZWNpbWFsXTtcbiAgICB9IGVsc2UgaWYgKHN5bWJvbCA9PT0gTnVtYmVyU3ltYm9sLkN1cnJlbmN5R3JvdXApIHtcbiAgICAgIHJldHVybiBkYXRhW8m1TG9jYWxlRGF0YUluZGV4Lk51bWJlclN5bWJvbHNdW051bWJlclN5bWJvbC5Hcm91cF07XG4gICAgfVxuICB9XG4gIHJldHVybiByZXM7XG59XG5cbi8qKlxuICogUmV0cmlldmVzIGEgbnVtYmVyIGZvcm1hdCBmb3IgYSBnaXZlbiBsb2NhbGUuXG4gKlxuICogTnVtYmVycyBhcmUgZm9ybWF0dGVkIHVzaW5nIHBhdHRlcm5zLCBsaWtlIGAjLCMjIy4wMGAuIEZvciBleGFtcGxlLCB0aGUgcGF0dGVybiBgIywjIyMuMDBgXG4gKiB3aGVuIHVzZWQgdG8gZm9ybWF0IHRoZSBudW1iZXIgMTIzNDUuNjc4IGNvdWxkIHJlc3VsdCBpbiBcIjEyJzM0NSw2NzhcIi4gVGhhdCB3b3VsZCBoYXBwZW4gaWYgdGhlXG4gKiBncm91cGluZyBzZXBhcmF0b3IgZm9yIHlvdXIgbGFuZ3VhZ2UgaXMgYW4gYXBvc3Ryb3BoZSwgYW5kIHRoZSBkZWNpbWFsIHNlcGFyYXRvciBpcyBhIGNvbW1hLlxuICpcbiAqIDxiPkltcG9ydGFudDo8L2I+IFRoZSBjaGFyYWN0ZXJzIGAuYCBgLGAgYDBgIGAjYCAoYW5kIG90aGVycyBiZWxvdykgYXJlIHNwZWNpYWwgcGxhY2Vob2xkZXJzXG4gKiB0aGF0IHN0YW5kIGZvciB0aGUgZGVjaW1hbCBzZXBhcmF0b3IsIGFuZCBzbyBvbiwgYW5kIGFyZSBOT1QgcmVhbCBjaGFyYWN0ZXJzLlxuICogWW91IG11c3QgTk9UIFwidHJhbnNsYXRlXCIgdGhlIHBsYWNlaG9sZGVycy4gRm9yIGV4YW1wbGUsIGRvbid0IGNoYW5nZSBgLmAgdG8gYCxgIGV2ZW4gdGhvdWdoIGluXG4gKiB5b3VyIGxhbmd1YWdlIHRoZSBkZWNpbWFsIHBvaW50IGlzIHdyaXR0ZW4gd2l0aCBhIGNvbW1hLiBUaGUgc3ltYm9scyBzaG91bGQgYmUgcmVwbGFjZWQgYnkgdGhlXG4gKiBsb2NhbCBlcXVpdmFsZW50cywgdXNpbmcgdGhlIGFwcHJvcHJpYXRlIGBOdW1iZXJTeW1ib2xgIGZvciB5b3VyIGxhbmd1YWdlLlxuICpcbiAqIEhlcmUgYXJlIHRoZSBzcGVjaWFsIGNoYXJhY3RlcnMgdXNlZCBpbiBudW1iZXIgcGF0dGVybnM6XG4gKlxuICogfCBTeW1ib2wgfCBNZWFuaW5nIHxcbiAqIHwtLS0tLS0tLXwtLS0tLS0tLS18XG4gKiB8IC4gfCBSZXBsYWNlZCBhdXRvbWF0aWNhbGx5IGJ5IHRoZSBjaGFyYWN0ZXIgdXNlZCBmb3IgdGhlIGRlY2ltYWwgcG9pbnQuIHxcbiAqIHwgLCB8IFJlcGxhY2VkIGJ5IHRoZSBcImdyb3VwaW5nXCIgKHRob3VzYW5kcykgc2VwYXJhdG9yLiB8XG4gKiB8IDAgfCBSZXBsYWNlZCBieSBhIGRpZ2l0IChvciB6ZXJvIGlmIHRoZXJlIGFyZW4ndCBlbm91Z2ggZGlnaXRzKS4gfFxuICogfCAjIHwgUmVwbGFjZWQgYnkgYSBkaWdpdCAob3Igbm90aGluZyBpZiB0aGVyZSBhcmVuJ3QgZW5vdWdoKS4gfFxuICogfCDCpCB8IFJlcGxhY2VkIGJ5IGEgY3VycmVuY3kgc3ltYm9sLCBzdWNoIGFzICQgb3IgVVNELiB8XG4gKiB8ICUgfCBNYXJrcyBhIHBlcmNlbnQgZm9ybWF0LiBUaGUgJSBzeW1ib2wgbWF5IGNoYW5nZSBwb3NpdGlvbiwgYnV0IG11c3QgYmUgcmV0YWluZWQuIHxcbiAqIHwgRSB8IE1hcmtzIGEgc2NpZW50aWZpYyBmb3JtYXQuIFRoZSBFIHN5bWJvbCBtYXkgY2hhbmdlIHBvc2l0aW9uLCBidXQgbXVzdCBiZSByZXRhaW5lZC4gfFxuICogfCAnIHwgU3BlY2lhbCBjaGFyYWN0ZXJzIHVzZWQgYXMgbGl0ZXJhbCBjaGFyYWN0ZXJzIGFyZSBxdW90ZWQgd2l0aCBBU0NJSSBzaW5nbGUgcXVvdGVzLiB8XG4gKlxuICogQHBhcmFtIGxvY2FsZSBBIGxvY2FsZSBjb2RlIGZvciB0aGUgbG9jYWxlIGZvcm1hdCBydWxlcyB0byB1c2UuXG4gKiBAcGFyYW0gdHlwZSBUaGUgdHlwZSBvZiBudW1lcmljIHZhbHVlIHRvIGJlIGZvcm1hdHRlZCAoc3VjaCBhcyBgRGVjaW1hbGAgb3IgYEN1cnJlbmN5YC4pXG4gKiBAcmV0dXJucyBUaGUgbG9jYWxpemVkIGZvcm1hdCBzdHJpbmcuXG4gKiBAc2VlIHtAbGluayBOdW1iZXJGb3JtYXRTdHlsZX1cbiAqIEBzZWUgW0NMRFIgd2Vic2l0ZV0oaHR0cDovL2NsZHIudW5pY29kZS5vcmcvdHJhbnNsYXRpb24vbnVtYmVyLXBhdHRlcm5zKVxuICogQHNlZSBbSW50ZXJuYXRpb25hbGl6YXRpb24gKGkxOG4pIEd1aWRlXShndWlkZS9pMThuKVxuICpcbiAqIEBwdWJsaWNBcGlcbiAqXG4gKiBAZGVwcmVjYXRlZCBBbmd1bGFyIHJlY29tbWVuZHMgcmVseWluZyBvbiB0aGUgYEludGxgIEFQSSBmb3IgaTE4bi5cbiAqIExldCBgSW50bC5OdW1iZXJGb3JtYXRgIGRldGVybWluZSB0aGUgbnVtYmVyIGZvcm1hdCBpbnN0ZWFkXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRMb2NhbGVOdW1iZXJGb3JtYXQobG9jYWxlOiBzdHJpbmcsIHR5cGU6IE51bWJlckZvcm1hdFN0eWxlKTogc3RyaW5nIHtcbiAgY29uc3QgZGF0YSA9IMm1ZmluZExvY2FsZURhdGEobG9jYWxlKTtcbiAgcmV0dXJuIGRhdGFbybVMb2NhbGVEYXRhSW5kZXguTnVtYmVyRm9ybWF0c11bdHlwZV07XG59XG5cbi8qKlxuICogUmV0cmlldmVzIHRoZSBzeW1ib2wgdXNlZCB0byByZXByZXNlbnQgdGhlIGN1cnJlbmN5IGZvciB0aGUgbWFpbiBjb3VudHJ5XG4gKiBjb3JyZXNwb25kaW5nIHRvIGEgZ2l2ZW4gbG9jYWxlLiBGb3IgZXhhbXBsZSwgJyQnIGZvciBgZW4tVVNgLlxuICpcbiAqIEBwYXJhbSBsb2NhbGUgQSBsb2NhbGUgY29kZSBmb3IgdGhlIGxvY2FsZSBmb3JtYXQgcnVsZXMgdG8gdXNlLlxuICogQHJldHVybnMgVGhlIGxvY2FsaXplZCBzeW1ib2wgY2hhcmFjdGVyLFxuICogb3IgYG51bGxgIGlmIHRoZSBtYWluIGNvdW50cnkgY2Fubm90IGJlIGRldGVybWluZWQuXG4gKiBAc2VlIFtJbnRlcm5hdGlvbmFsaXphdGlvbiAoaTE4bikgR3VpZGVdKGd1aWRlL2kxOG4pXG4gKlxuICogQHB1YmxpY0FwaVxuICpcbiAqIEBkZXByZWNhdGVkIFVzZSB0aGUgYEludGxgIEFQSSB0byBmb3JtYXQgYSBjdXJyZW5jeSB3aXRoIGZyb20gY3VycmVuY3kgY29kZVxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0TG9jYWxlQ3VycmVuY3lTeW1ib2wobG9jYWxlOiBzdHJpbmcpOiBzdHJpbmcgfCBudWxsIHtcbiAgY29uc3QgZGF0YSA9IMm1ZmluZExvY2FsZURhdGEobG9jYWxlKTtcbiAgcmV0dXJuIGRhdGFbybVMb2NhbGVEYXRhSW5kZXguQ3VycmVuY3lTeW1ib2xdIHx8IG51bGw7XG59XG5cbi8qKlxuICogUmV0cmlldmVzIHRoZSBuYW1lIG9mIHRoZSBjdXJyZW5jeSBmb3IgdGhlIG1haW4gY291bnRyeSBjb3JyZXNwb25kaW5nXG4gKiB0byBhIGdpdmVuIGxvY2FsZS4gRm9yIGV4YW1wbGUsICdVUyBEb2xsYXInIGZvciBgZW4tVVNgLlxuICogQHBhcmFtIGxvY2FsZSBBIGxvY2FsZSBjb2RlIGZvciB0aGUgbG9jYWxlIGZvcm1hdCBydWxlcyB0byB1c2UuXG4gKiBAcmV0dXJucyBUaGUgY3VycmVuY3kgbmFtZSxcbiAqIG9yIGBudWxsYCBpZiB0aGUgbWFpbiBjb3VudHJ5IGNhbm5vdCBiZSBkZXRlcm1pbmVkLlxuICogQHNlZSBbSW50ZXJuYXRpb25hbGl6YXRpb24gKGkxOG4pIEd1aWRlXShndWlkZS9pMThuKVxuICpcbiAqIEBwdWJsaWNBcGlcbiAqXG4gKiBAZGVwcmVjYXRlZCBVc2UgdGhlIGBJbnRsYCBBUEkgdG8gZm9ybWF0IGEgY3VycmVuY3kgd2l0aCBmcm9tIGN1cnJlbmN5IGNvZGVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldExvY2FsZUN1cnJlbmN5TmFtZShsb2NhbGU6IHN0cmluZyk6IHN0cmluZyB8IG51bGwge1xuICBjb25zdCBkYXRhID0gybVmaW5kTG9jYWxlRGF0YShsb2NhbGUpO1xuICByZXR1cm4gZGF0YVvJtUxvY2FsZURhdGFJbmRleC5DdXJyZW5jeU5hbWVdIHx8IG51bGw7XG59XG5cbi8qKlxuICogUmV0cmlldmVzIHRoZSBkZWZhdWx0IGN1cnJlbmN5IGNvZGUgZm9yIHRoZSBnaXZlbiBsb2NhbGUuXG4gKlxuICogVGhlIGRlZmF1bHQgaXMgZGVmaW5lZCBhcyB0aGUgZmlyc3QgY3VycmVuY3kgd2hpY2ggaXMgc3RpbGwgaW4gdXNlLlxuICpcbiAqIEBwYXJhbSBsb2NhbGUgVGhlIGNvZGUgb2YgdGhlIGxvY2FsZSB3aG9zZSBjdXJyZW5jeSBjb2RlIHdlIHdhbnQuXG4gKiBAcmV0dXJucyBUaGUgY29kZSBvZiB0aGUgZGVmYXVsdCBjdXJyZW5jeSBmb3IgdGhlIGdpdmVuIGxvY2FsZS5cbiAqXG4gKiBAcHVibGljQXBpXG4gKlxuICogQGRlcHJlY2F0ZWQgV2UgcmVjb21tZW5kIHlvdSBjcmVhdGUgYSBtYXAgb2YgbG9jYWxlIHRvIElTTyA0MjE3IGN1cnJlbmN5IGNvZGVzLlxuICogVGltZSByZWxhdGl2ZSBjdXJyZW5jeSBkYXRhIGlzIHByb3ZpZGVkIGJ5IHRoZSBDTERSIHByb2plY3QuIFNlZSBodHRwczovL3d3dy51bmljb2RlLm9yZy9jbGRyL2NoYXJ0cy80NC9zdXBwbGVtZW50YWwvZGV0YWlsZWRfdGVycml0b3J5X2N1cnJlbmN5X2luZm9ybWF0aW9uLmh0bWxcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldExvY2FsZUN1cnJlbmN5Q29kZShsb2NhbGU6IHN0cmluZyk6IHN0cmluZyB8IG51bGwge1xuICByZXR1cm4gybVnZXRMb2NhbGVDdXJyZW5jeUNvZGUobG9jYWxlKTtcbn1cblxuLyoqXG4gKiBSZXRyaWV2ZXMgdGhlIGN1cnJlbmN5IHZhbHVlcyBmb3IgYSBnaXZlbiBsb2NhbGUuXG4gKiBAcGFyYW0gbG9jYWxlIEEgbG9jYWxlIGNvZGUgZm9yIHRoZSBsb2NhbGUgZm9ybWF0IHJ1bGVzIHRvIHVzZS5cbiAqIEByZXR1cm5zIFRoZSBjdXJyZW5jeSB2YWx1ZXMuXG4gKiBAc2VlIFtJbnRlcm5hdGlvbmFsaXphdGlvbiAoaTE4bikgR3VpZGVdKGd1aWRlL2kxOG4pXG4gKi9cbmZ1bmN0aW9uIGdldExvY2FsZUN1cnJlbmNpZXMobG9jYWxlOiBzdHJpbmcpOiB7W2NvZGU6IHN0cmluZ106IEN1cnJlbmNpZXNTeW1ib2xzfSB7XG4gIGNvbnN0IGRhdGEgPSDJtWZpbmRMb2NhbGVEYXRhKGxvY2FsZSk7XG4gIHJldHVybiBkYXRhW8m1TG9jYWxlRGF0YUluZGV4LkN1cnJlbmNpZXNdO1xufVxuXG4vKipcbiAqIEBwdWJsaWNBcGlcbiAqXG4gKiBAZGVwcmVjYXRlZCBBbmd1bGFyIHJlY29tbWVuZHMgcmVseWluZyBvbiB0aGUgYEludGxgIEFQSSBmb3IgaTE4bi5cbiAqIFVzZSBgSW50bC5QbHVyYWxSdWxlc2AgaW5zdGVhZFxuICovXG5leHBvcnQgY29uc3QgZ2V0TG9jYWxlUGx1cmFsQ2FzZTogKGxvY2FsZTogc3RyaW5nKSA9PiAodmFsdWU6IG51bWJlcikgPT4gUGx1cmFsID1cbiAgybVnZXRMb2NhbGVQbHVyYWxDYXNlO1xuXG5mdW5jdGlvbiBjaGVja0Z1bGxEYXRhKGRhdGE6IGFueSkge1xuICBpZiAoIWRhdGFbybVMb2NhbGVEYXRhSW5kZXguRXh0cmFEYXRhXSkge1xuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgIGBNaXNzaW5nIGV4dHJhIGxvY2FsZSBkYXRhIGZvciB0aGUgbG9jYWxlIFwiJHtcbiAgICAgICAgZGF0YVvJtUxvY2FsZURhdGFJbmRleC5Mb2NhbGVJZF1cbiAgICAgIH1cIi4gVXNlIFwicmVnaXN0ZXJMb2NhbGVEYXRhXCIgdG8gbG9hZCBuZXcgZGF0YS4gU2VlIHRoZSBcIkkxOG4gZ3VpZGVcIiBvbiBhbmd1bGFyLmlvIHRvIGtub3cgbW9yZS5gLFxuICAgICk7XG4gIH1cbn1cblxuLyoqXG4gKiBSZXRyaWV2ZXMgbG9jYWxlLXNwZWNpZmljIHJ1bGVzIHVzZWQgdG8gZGV0ZXJtaW5lIHdoaWNoIGRheSBwZXJpb2QgdG8gdXNlXG4gKiB3aGVuIG1vcmUgdGhhbiBvbmUgcGVyaW9kIGlzIGRlZmluZWQgZm9yIGEgbG9jYWxlLlxuICpcbiAqIFRoZXJlIGlzIGEgcnVsZSBmb3IgZWFjaCBkZWZpbmVkIGRheSBwZXJpb2QuIFRoZVxuICogZmlyc3QgcnVsZSBpcyBhcHBsaWVkIHRvIHRoZSBmaXJzdCBkYXkgcGVyaW9kIGFuZCBzbyBvbi5cbiAqIEZhbGwgYmFjayB0byBBTS9QTSB3aGVuIG5vIHJ1bGVzIGFyZSBhdmFpbGFibGUuXG4gKlxuICogQSBydWxlIGNhbiBzcGVjaWZ5IGEgcGVyaW9kIGFzIHRpbWUgcmFuZ2UsIG9yIGFzIGEgc2luZ2xlIHRpbWUgdmFsdWUuXG4gKlxuICogVGhpcyBmdW5jdGlvbmFsaXR5IGlzIG9ubHkgYXZhaWxhYmxlIHdoZW4geW91IGhhdmUgbG9hZGVkIHRoZSBmdWxsIGxvY2FsZSBkYXRhLlxuICogU2VlIHRoZSBbXCJJMThuIGd1aWRlXCJdKGd1aWRlL2kxOG4vZm9ybWF0LWRhdGEtbG9jYWxlKS5cbiAqXG4gKiBAcGFyYW0gbG9jYWxlIEEgbG9jYWxlIGNvZGUgZm9yIHRoZSBsb2NhbGUgZm9ybWF0IHJ1bGVzIHRvIHVzZS5cbiAqIEByZXR1cm5zIFRoZSBydWxlcyBmb3IgdGhlIGxvY2FsZSwgYSBzaW5nbGUgdGltZSB2YWx1ZSBvciBhcnJheSBvZiAqZnJvbS10aW1lLCB0by10aW1lKixcbiAqIG9yIG51bGwgaWYgbm8gcGVyaW9kcyBhcmUgYXZhaWxhYmxlLlxuICpcbiAqIEBzZWUge0BsaW5rIGdldExvY2FsZUV4dHJhRGF5UGVyaW9kc31cbiAqIEBzZWUgW0ludGVybmF0aW9uYWxpemF0aW9uIChpMThuKSBHdWlkZV0oZ3VpZGUvaTE4bilcbiAqXG4gKiBAcHVibGljQXBpXG4gKlxuICogQGRlcHJlY2F0ZWQgQW5ndWxhciByZWNvbW1lbmRzIHJlbHlpbmcgb24gdGhlIGBJbnRsYCBBUEkgZm9yIGkxOG4uXG4gKiBMZXQgYEludGwuRGF0ZVRpbWVGb3JtYXRgIGRldGVybWluZSB0aGUgZGF5IHBlcmlvZCBpbnN0ZWFkLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0TG9jYWxlRXh0cmFEYXlQZXJpb2RSdWxlcyhsb2NhbGU6IHN0cmluZyk6IChUaW1lIHwgW1RpbWUsIFRpbWVdKVtdIHtcbiAgY29uc3QgZGF0YSA9IMm1ZmluZExvY2FsZURhdGEobG9jYWxlKTtcbiAgY2hlY2tGdWxsRGF0YShkYXRhKTtcbiAgY29uc3QgcnVsZXMgPSBkYXRhW8m1TG9jYWxlRGF0YUluZGV4LkV4dHJhRGF0YV1bybVFeHRyYUxvY2FsZURhdGFJbmRleC5FeHRyYURheVBlcmlvZHNSdWxlc10gfHwgW107XG4gIHJldHVybiBydWxlcy5tYXAoKHJ1bGU6IHN0cmluZyB8IFtzdHJpbmcsIHN0cmluZ10pID0+IHtcbiAgICBpZiAodHlwZW9mIHJ1bGUgPT09ICdzdHJpbmcnKSB7XG4gICAgICByZXR1cm4gZXh0cmFjdFRpbWUocnVsZSk7XG4gICAgfVxuICAgIHJldHVybiBbZXh0cmFjdFRpbWUocnVsZVswXSksIGV4dHJhY3RUaW1lKHJ1bGVbMV0pXTtcbiAgfSk7XG59XG5cbi8qKlxuICogUmV0cmlldmVzIGxvY2FsZS1zcGVjaWZpYyBkYXkgcGVyaW9kcywgd2hpY2ggaW5kaWNhdGUgcm91Z2hseSBob3cgYSBkYXkgaXMgYnJva2VuIHVwXG4gKiBpbiBkaWZmZXJlbnQgbGFuZ3VhZ2VzLlxuICogRm9yIGV4YW1wbGUsIGZvciBgZW4tVVNgLCBwZXJpb2RzIGFyZSBtb3JuaW5nLCBub29uLCBhZnRlcm5vb24sIGV2ZW5pbmcsIGFuZCBtaWRuaWdodC5cbiAqXG4gKiBUaGlzIGZ1bmN0aW9uYWxpdHkgaXMgb25seSBhdmFpbGFibGUgd2hlbiB5b3UgaGF2ZSBsb2FkZWQgdGhlIGZ1bGwgbG9jYWxlIGRhdGEuXG4gKiBTZWUgdGhlIFtcIkkxOG4gZ3VpZGVcIl0oZ3VpZGUvaTE4bi9mb3JtYXQtZGF0YS1sb2NhbGUpLlxuICpcbiAqIEBwYXJhbSBsb2NhbGUgQSBsb2NhbGUgY29kZSBmb3IgdGhlIGxvY2FsZSBmb3JtYXQgcnVsZXMgdG8gdXNlLlxuICogQHBhcmFtIGZvcm1TdHlsZSBUaGUgcmVxdWlyZWQgZ3JhbW1hdGljYWwgZm9ybS5cbiAqIEBwYXJhbSB3aWR0aCBUaGUgcmVxdWlyZWQgY2hhcmFjdGVyIHdpZHRoLlxuICogQHJldHVybnMgVGhlIHRyYW5zbGF0ZWQgZGF5LXBlcmlvZCBzdHJpbmdzLlxuICogQHNlZSB7QGxpbmsgZ2V0TG9jYWxlRXh0cmFEYXlQZXJpb2RSdWxlc31cbiAqIEBzZWUgW0ludGVybmF0aW9uYWxpemF0aW9uIChpMThuKSBHdWlkZV0oZ3VpZGUvaTE4bilcbiAqXG4gKiBAcHVibGljQXBpXG4gKlxuICogQGRlcHJlY2F0ZWQgQW5ndWxhciByZWNvbW1lbmRzIHJlbHlpbmcgb24gdGhlIGBJbnRsYCBBUEkgZm9yIGkxOG4uXG4gKiBUbyBleHRyYWN0IGEgZGF5IHBlcmlvZCB1c2UgYEludGwuRGF0ZVRpbWVGb3JtYXRgIHdpdGggdGhlIGBkYXlQZXJpb2RgIG9wdGlvbiBpbnN0ZWFkLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0TG9jYWxlRXh0cmFEYXlQZXJpb2RzKFxuICBsb2NhbGU6IHN0cmluZyxcbiAgZm9ybVN0eWxlOiBGb3JtU3R5bGUsXG4gIHdpZHRoOiBUcmFuc2xhdGlvbldpZHRoLFxuKTogc3RyaW5nW10ge1xuICBjb25zdCBkYXRhID0gybVmaW5kTG9jYWxlRGF0YShsb2NhbGUpO1xuICBjaGVja0Z1bGxEYXRhKGRhdGEpO1xuICBjb25zdCBkYXlQZXJpb2RzRGF0YSA9IDxzdHJpbmdbXVtdW10+W1xuICAgIGRhdGFbybVMb2NhbGVEYXRhSW5kZXguRXh0cmFEYXRhXVvJtUV4dHJhTG9jYWxlRGF0YUluZGV4LkV4dHJhRGF5UGVyaW9kRm9ybWF0c10sXG4gICAgZGF0YVvJtUxvY2FsZURhdGFJbmRleC5FeHRyYURhdGFdW8m1RXh0cmFMb2NhbGVEYXRhSW5kZXguRXh0cmFEYXlQZXJpb2RTdGFuZGFsb25lXSxcbiAgXTtcbiAgY29uc3QgZGF5UGVyaW9kcyA9IGdldExhc3REZWZpbmVkVmFsdWUoZGF5UGVyaW9kc0RhdGEsIGZvcm1TdHlsZSkgfHwgW107XG4gIHJldHVybiBnZXRMYXN0RGVmaW5lZFZhbHVlKGRheVBlcmlvZHMsIHdpZHRoKSB8fCBbXTtcbn1cblxuLyoqXG4gKiBSZXRyaWV2ZXMgdGhlIHdyaXRpbmcgZGlyZWN0aW9uIG9mIGEgc3BlY2lmaWVkIGxvY2FsZVxuICogQHBhcmFtIGxvY2FsZSBBIGxvY2FsZSBjb2RlIGZvciB0aGUgbG9jYWxlIGZvcm1hdCBydWxlcyB0byB1c2UuXG4gKiBAcHVibGljQXBpXG4gKiBAcmV0dXJucyAncnRsJyBvciAnbHRyJ1xuICogQHNlZSBbSW50ZXJuYXRpb25hbGl6YXRpb24gKGkxOG4pIEd1aWRlXShndWlkZS9pMThuKVxuICpcbiAqIEBkZXByZWNhdGVkIEFuZ3VsYXIgcmVjb21tZW5kcyByZWx5aW5nIG9uIHRoZSBgSW50bGAgQVBJIGZvciBpMThuLlxuICogRm9yIGRhdGVzIGFuZCBudW1iZXJzLCBsZXQgYEludGwuRGF0ZVRpbWVGb3JtYXQoKWAgYW5kIGBJbnRsLk51bWJlckZvcm1hdCgpYCBkZXRlcm1pbmUgdGhlIHdyaXRpbmcgZGlyZWN0aW9uLlxuICogVGhlIGBJbnRsYCBhbHRlcm5hdGl2ZSBbYGdldFRleHRJbmZvYF0oaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvSmF2YVNjcmlwdC9SZWZlcmVuY2UvR2xvYmFsX09iamVjdHMvSW50bC9Mb2NhbGUvZ2V0VGV4dEluZm8pLlxuICogaGFzIG9ubHkgcGFydGlhbCBzdXBwb3J0IChDaHJvbWl1bSBNOTkgJiBTYWZhcmkgMTcpLlxuICogM3JkIHBhcnR5IGFsdGVybmF0aXZlcyBsaWtlIFtgcnRsLWRldGVjdGBdKGh0dHBzOi8vd3d3Lm5wbWpzLmNvbS9wYWNrYWdlL3J0bC1kZXRlY3QpIGNhbiB3b3JrIGFyb3VuZCB0aGlzIGlzc3VlLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0TG9jYWxlRGlyZWN0aW9uKGxvY2FsZTogc3RyaW5nKTogJ2x0cicgfCAncnRsJyB7XG4gIGNvbnN0IGRhdGEgPSDJtWZpbmRMb2NhbGVEYXRhKGxvY2FsZSk7XG4gIHJldHVybiBkYXRhW8m1TG9jYWxlRGF0YUluZGV4LkRpcmVjdGlvbmFsaXR5XTtcbn1cblxuLyoqXG4gKiBSZXRyaWV2ZXMgdGhlIGZpcnN0IHZhbHVlIHRoYXQgaXMgZGVmaW5lZCBpbiBhbiBhcnJheSwgZ29pbmcgYmFja3dhcmRzIGZyb20gYW4gaW5kZXggcG9zaXRpb24uXG4gKlxuICogVG8gYXZvaWQgcmVwZWF0aW5nIHRoZSBzYW1lIGRhdGEgKGFzIHdoZW4gdGhlIFwiZm9ybWF0XCIgYW5kIFwic3RhbmRhbG9uZVwiIGZvcm1zIGFyZSB0aGUgc2FtZSlcbiAqIGFkZCB0aGUgZmlyc3QgdmFsdWUgdG8gdGhlIGxvY2FsZSBkYXRhIGFycmF5cywgYW5kIGFkZCBvdGhlciB2YWx1ZXMgb25seSBpZiB0aGV5IGFyZSBkaWZmZXJlbnQuXG4gKlxuICogQHBhcmFtIGRhdGEgVGhlIGRhdGEgYXJyYXkgdG8gcmV0cmlldmUgZnJvbS5cbiAqIEBwYXJhbSBpbmRleCBBIDAtYmFzZWQgaW5kZXggaW50byB0aGUgYXJyYXkgdG8gc3RhcnQgZnJvbS5cbiAqIEByZXR1cm5zIFRoZSB2YWx1ZSBpbW1lZGlhdGVseSBiZWZvcmUgdGhlIGdpdmVuIGluZGV4IHBvc2l0aW9uLlxuICogQHNlZSBbSW50ZXJuYXRpb25hbGl6YXRpb24gKGkxOG4pIEd1aWRlXShndWlkZS9pMThuKVxuICpcbiAqL1xuZnVuY3Rpb24gZ2V0TGFzdERlZmluZWRWYWx1ZTxUPihkYXRhOiBUW10sIGluZGV4OiBudW1iZXIpOiBUIHtcbiAgZm9yIChsZXQgaSA9IGluZGV4OyBpID4gLTE7IGktLSkge1xuICAgIGlmICh0eXBlb2YgZGF0YVtpXSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIHJldHVybiBkYXRhW2ldO1xuICAgIH1cbiAgfVxuICB0aHJvdyBuZXcgRXJyb3IoJ0xvY2FsZSBkYXRhIEFQSTogbG9jYWxlIGRhdGEgdW5kZWZpbmVkJyk7XG59XG5cbi8qKlxuICogUmVwcmVzZW50cyBhIHRpbWUgdmFsdWUgd2l0aCBob3VycyBhbmQgbWludXRlcy5cbiAqXG4gKiBAcHVibGljQXBpXG4gKlxuICogQGRlcHJlY2F0ZWQgTG9jYWxlIGRhdGUgZ2V0dGVycyBhcmUgZGVwcmVjYXRlZFxuICovXG5leHBvcnQgdHlwZSBUaW1lID0ge1xuICBob3VyczogbnVtYmVyO1xuICBtaW51dGVzOiBudW1iZXI7XG59O1xuXG4vKipcbiAqIEV4dHJhY3RzIHRoZSBob3VycyBhbmQgbWludXRlcyBmcm9tIGEgc3RyaW5nIGxpa2UgXCIxNTo0NVwiXG4gKi9cbmZ1bmN0aW9uIGV4dHJhY3RUaW1lKHRpbWU6IHN0cmluZyk6IFRpbWUge1xuICBjb25zdCBbaCwgbV0gPSB0aW1lLnNwbGl0KCc6Jyk7XG4gIHJldHVybiB7aG91cnM6ICtoLCBtaW51dGVzOiArbX07XG59XG5cbi8qKlxuICogUmV0cmlldmVzIHRoZSBjdXJyZW5jeSBzeW1ib2wgZm9yIGEgZ2l2ZW4gY3VycmVuY3kgY29kZS5cbiAqXG4gKiBGb3IgZXhhbXBsZSwgZm9yIHRoZSBkZWZhdWx0IGBlbi1VU2AgbG9jYWxlLCB0aGUgY29kZSBgVVNEYCBjYW5cbiAqIGJlIHJlcHJlc2VudGVkIGJ5IHRoZSBuYXJyb3cgc3ltYm9sIGAkYCBvciB0aGUgd2lkZSBzeW1ib2wgYFVTJGAuXG4gKlxuICogQHBhcmFtIGNvZGUgVGhlIGN1cnJlbmN5IGNvZGUuXG4gKiBAcGFyYW0gZm9ybWF0IFRoZSBmb3JtYXQsIGB3aWRlYCBvciBgbmFycm93YC5cbiAqIEBwYXJhbSBsb2NhbGUgQSBsb2NhbGUgY29kZSBmb3IgdGhlIGxvY2FsZSBmb3JtYXQgcnVsZXMgdG8gdXNlLlxuICpcbiAqIEByZXR1cm5zIFRoZSBzeW1ib2wsIG9yIHRoZSBjdXJyZW5jeSBjb2RlIGlmIG5vIHN5bWJvbCBpcyBhdmFpbGFibGUuXG4gKiBAc2VlIFtJbnRlcm5hdGlvbmFsaXphdGlvbiAoaTE4bikgR3VpZGVdKGd1aWRlL2kxOG4pXG4gKlxuICogQHB1YmxpY0FwaVxuICpcbiAqIEBkZXByZWNhdGVkIEFuZ3VsYXIgcmVjb21tZW5kcyByZWx5aW5nIG9uIHRoZSBgSW50bGAgQVBJIGZvciBpMThuLlxuICogWW91IGNhbiB1c2UgYEludGwuTnVtYmVyRm9ybWF0KCkuZm9ybWF0VG9QYXJ0cygpYCB0byBleHRyYWN0IHRoZSBjdXJyZW5jeSBzeW1ib2wuXG4gKiBGb3IgZXhhbXBsZTogYEludGwuTnVtYmVyRm9ybWF0KCdlbicsIHtzdHlsZTonY3VycmVuY3knLCBjdXJyZW5jeTogJ1VTRCd9KS5mb3JtYXRUb1BhcnRzKCkuZmluZChwYXJ0ID0+IHBhcnQudHlwZSA9PT0gJ2N1cnJlbmN5JykudmFsdWVgXG4gKiByZXR1cm5zIGAkYCBmb3IgVVNEIGN1cnJlbmN5IGNvZGUgaW4gdGhlIGBlbmAgbG9jYWxlLlxuICogTm90ZTogYFVTJGAgaXMgYSBjdXJyZW5jeSBzeW1ib2wgZm9yIHRoZSBgZW4tY2FgIGxvY2FsZSBidXQgbm90IHRoZSBgZW4tdXNgIGxvY2FsZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldEN1cnJlbmN5U3ltYm9sKGNvZGU6IHN0cmluZywgZm9ybWF0OiAnd2lkZScgfCAnbmFycm93JywgbG9jYWxlID0gJ2VuJyk6IHN0cmluZyB7XG4gIGNvbnN0IGN1cnJlbmN5ID0gZ2V0TG9jYWxlQ3VycmVuY2llcyhsb2NhbGUpW2NvZGVdIHx8IENVUlJFTkNJRVNfRU5bY29kZV0gfHwgW107XG4gIGNvbnN0IHN5bWJvbE5hcnJvdyA9IGN1cnJlbmN5W8m1Q3VycmVuY3lJbmRleC5TeW1ib2xOYXJyb3ddO1xuXG4gIGlmIChmb3JtYXQgPT09ICduYXJyb3cnICYmIHR5cGVvZiBzeW1ib2xOYXJyb3cgPT09ICdzdHJpbmcnKSB7XG4gICAgcmV0dXJuIHN5bWJvbE5hcnJvdztcbiAgfVxuXG4gIHJldHVybiBjdXJyZW5jeVvJtUN1cnJlbmN5SW5kZXguU3ltYm9sXSB8fCBjb2RlO1xufVxuXG4vLyBNb3N0IGN1cnJlbmNpZXMgaGF2ZSBjZW50cywgdGhhdCdzIHdoeSB0aGUgZGVmYXVsdCBpcyAyXG5jb25zdCBERUZBVUxUX05CX09GX0NVUlJFTkNZX0RJR0lUUyA9IDI7XG5cbi8qKlxuICogUmVwb3J0cyB0aGUgbnVtYmVyIG9mIGRlY2ltYWwgZGlnaXRzIGZvciBhIGdpdmVuIGN1cnJlbmN5LlxuICogVGhlIHZhbHVlIGRlcGVuZHMgdXBvbiB0aGUgcHJlc2VuY2Ugb2YgY2VudHMgaW4gdGhhdCBwYXJ0aWN1bGFyIGN1cnJlbmN5LlxuICpcbiAqIEBwYXJhbSBjb2RlIFRoZSBjdXJyZW5jeSBjb2RlLlxuICogQHJldHVybnMgVGhlIG51bWJlciBvZiBkZWNpbWFsIGRpZ2l0cywgdHlwaWNhbGx5IDAgb3IgMi5cbiAqIEBzZWUgW0ludGVybmF0aW9uYWxpemF0aW9uIChpMThuKSBHdWlkZV0oZ3VpZGUvaTE4bilcbiAqXG4gKiBAcHVibGljQXBpXG4gKlxuICogQGRlcHJlY2F0ZWQgQW5ndWxhciByZWNvbW1lbmRzIHJlbHlpbmcgb24gdGhlIGBJbnRsYCBBUEkgZm9yIGkxOG4uXG4gKiBUaGlzIGZ1bmN0aW9uIHNob3VsZCBub3QgYmUgdXNlZCBhbnltb3JlLiBMZXQgYEludGwuTnVtYmVyRm9ybWF0YCBkZXRlcm1pbmUgdGhlIG51bWJlciBvZiBkaWdpdHMgdG8gZGlzcGxheSBmb3IgdGhlIGN1cnJlbmN5XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXROdW1iZXJPZkN1cnJlbmN5RGlnaXRzKGNvZGU6IHN0cmluZyk6IG51bWJlciB7XG4gIGxldCBkaWdpdHM7XG4gIGNvbnN0IGN1cnJlbmN5ID0gQ1VSUkVOQ0lFU19FTltjb2RlXTtcbiAgaWYgKGN1cnJlbmN5KSB7XG4gICAgZGlnaXRzID0gY3VycmVuY3lbybVDdXJyZW5jeUluZGV4Lk5iT2ZEaWdpdHNdO1xuICB9XG4gIHJldHVybiB0eXBlb2YgZGlnaXRzID09PSAnbnVtYmVyJyA/IGRpZ2l0cyA6IERFRkFVTFRfTkJfT0ZfQ1VSUkVOQ1lfRElHSVRTO1xufVxuIl19