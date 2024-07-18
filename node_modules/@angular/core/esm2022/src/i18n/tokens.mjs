/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { InjectionToken } from '../di/injection_token';
import { inject } from '../di/injector_compatibility';
import { InjectFlags } from '../di/interface/injector';
import { DEFAULT_LOCALE_ID, USD_CURRENCY_CODE } from './localization';
/**
 * Work out the locale from the potential global properties.
 *
 * * Closure Compiler: use `goog.LOCALE`.
 * * Ivy enabled: use `$localize.locale`
 */
export function getGlobalLocale() {
    if (typeof ngI18nClosureMode !== 'undefined' &&
        ngI18nClosureMode &&
        typeof goog !== 'undefined' &&
        goog.LOCALE !== 'en') {
        // * The default `goog.LOCALE` value is `en`, while Angular used `en-US`.
        // * In order to preserve backwards compatibility, we use Angular default value over
        //   Closure Compiler's one.
        return goog.LOCALE;
    }
    else {
        // KEEP `typeof $localize !== 'undefined' && $localize.locale` IN SYNC WITH THE LOCALIZE
        // COMPILE-TIME INLINER.
        //
        // * During compile time inlining of translations the expression will be replaced
        //   with a string literal that is the current locale. Other forms of this expression are not
        //   guaranteed to be replaced.
        //
        // * During runtime translation evaluation, the developer is required to set `$localize.locale`
        //   if required, or just to provide their own `LOCALE_ID` provider.
        return (typeof $localize !== 'undefined' && $localize.locale) || DEFAULT_LOCALE_ID;
    }
}
/**
 * Provide this token to set the locale of your application.
 * It is used for i18n extraction, by i18n pipes (DatePipe, I18nPluralPipe, CurrencyPipe,
 * DecimalPipe and PercentPipe) and by ICU expressions.
 *
 * See the [i18n guide](guide/i18n/locale-id) for more information.
 *
 * @usageNotes
 * ### Example
 *
 * ```typescript
 * import { LOCALE_ID } from '@angular/core';
 * import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
 * import { AppModule } from './app/app.module';
 *
 * platformBrowserDynamic().bootstrapModule(AppModule, {
 *   providers: [{provide: LOCALE_ID, useValue: 'en-US' }]
 * });
 * ```
 *
 * @publicApi
 */
export const LOCALE_ID = new InjectionToken(ngDevMode ? 'LocaleId' : '', {
    providedIn: 'root',
    factory: () => inject(LOCALE_ID, InjectFlags.Optional | InjectFlags.SkipSelf) || getGlobalLocale(),
});
/**
 * Provide this token to set the default currency code your application uses for
 * CurrencyPipe when there is no currency code passed into it. This is only used by
 * CurrencyPipe and has no relation to locale currency. Defaults to USD if not configured.
 *
 * See the [i18n guide](guide/i18n/locale-id) for more information.
 *
 * <div class="alert is-helpful">
 *
 * **Deprecation notice:**
 *
 * The default currency code is currently always `USD` but this is deprecated from v9.
 *
 * **In v10 the default currency code will be taken from the current locale.**
 *
 * If you need the previous behavior then set it by creating a `DEFAULT_CURRENCY_CODE` provider in
 * your application `NgModule`:
 *
 * ```ts
 * {provide: DEFAULT_CURRENCY_CODE, useValue: 'USD'}
 * ```
 *
 * </div>
 *
 * @usageNotes
 * ### Example
 *
 * ```typescript
 * import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
 * import { AppModule } from './app/app.module';
 *
 * platformBrowserDynamic().bootstrapModule(AppModule, {
 *   providers: [{provide: DEFAULT_CURRENCY_CODE, useValue: 'EUR' }]
 * });
 * ```
 *
 * @publicApi
 */
export const DEFAULT_CURRENCY_CODE = new InjectionToken(ngDevMode ? 'DefaultCurrencyCode' : '', {
    providedIn: 'root',
    factory: () => USD_CURRENCY_CODE,
});
/**
 * Use this token at bootstrap to provide the content of your translation file (`xtb`,
 * `xlf` or `xlf2`) when you want to translate your application in another language.
 *
 * See the [i18n guide](guide/i18n/merge) for more information.
 *
 * @usageNotes
 * ### Example
 *
 * ```typescript
 * import { TRANSLATIONS } from '@angular/core';
 * import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
 * import { AppModule } from './app/app.module';
 *
 * // content of your translation file
 * const translations = '....';
 *
 * platformBrowserDynamic().bootstrapModule(AppModule, {
 *   providers: [{provide: TRANSLATIONS, useValue: translations }]
 * });
 * ```
 *
 * @publicApi
 */
export const TRANSLATIONS = new InjectionToken(ngDevMode ? 'Translations' : '');
/**
 * Provide this token at bootstrap to set the format of your {@link TRANSLATIONS}: `xtb`,
 * `xlf` or `xlf2`.
 *
 * See the [i18n guide](guide/i18n/merge) for more information.
 *
 * @usageNotes
 * ### Example
 *
 * ```typescript
 * import { TRANSLATIONS_FORMAT } from '@angular/core';
 * import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
 * import { AppModule } from './app/app.module';
 *
 * platformBrowserDynamic().bootstrapModule(AppModule, {
 *   providers: [{provide: TRANSLATIONS_FORMAT, useValue: 'xlf' }]
 * });
 * ```
 *
 * @publicApi
 */
export const TRANSLATIONS_FORMAT = new InjectionToken(ngDevMode ? 'TranslationsFormat' : '');
/**
 * Use this enum at bootstrap as an option of `bootstrapModule` to define the strategy
 * that the compiler should use in case of missing translations:
 * - Error: throw if you have missing translations.
 * - Warning (default): show a warning in the console and/or shell.
 * - Ignore: do nothing.
 *
 * See the [i18n guide](guide/i18n/merge#report-missing-translations) for more information.
 *
 * @usageNotes
 * ### Example
 * ```typescript
 * import { MissingTranslationStrategy } from '@angular/core';
 * import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
 * import { AppModule } from './app/app.module';
 *
 * platformBrowserDynamic().bootstrapModule(AppModule, {
 *   missingTranslation: MissingTranslationStrategy.Error
 * });
 * ```
 *
 * @publicApi
 */
export var MissingTranslationStrategy;
(function (MissingTranslationStrategy) {
    MissingTranslationStrategy[MissingTranslationStrategy["Error"] = 0] = "Error";
    MissingTranslationStrategy[MissingTranslationStrategy["Warning"] = 1] = "Warning";
    MissingTranslationStrategy[MissingTranslationStrategy["Ignore"] = 2] = "Ignore";
})(MissingTranslationStrategy || (MissingTranslationStrategy = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidG9rZW5zLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29yZS9zcmMvaTE4bi90b2tlbnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUFDLGNBQWMsRUFBQyxNQUFNLHVCQUF1QixDQUFDO0FBQ3JELE9BQU8sRUFBQyxNQUFNLEVBQUMsTUFBTSw4QkFBOEIsQ0FBQztBQUNwRCxPQUFPLEVBQUMsV0FBVyxFQUFDLE1BQU0sMEJBQTBCLENBQUM7QUFFckQsT0FBTyxFQUFDLGlCQUFpQixFQUFFLGlCQUFpQixFQUFDLE1BQU0sZ0JBQWdCLENBQUM7QUFJcEU7Ozs7O0dBS0c7QUFDSCxNQUFNLFVBQVUsZUFBZTtJQUM3QixJQUNFLE9BQU8saUJBQWlCLEtBQUssV0FBVztRQUN4QyxpQkFBaUI7UUFDakIsT0FBTyxJQUFJLEtBQUssV0FBVztRQUMzQixJQUFJLENBQUMsTUFBTSxLQUFLLElBQUksRUFDcEIsQ0FBQztRQUNELHlFQUF5RTtRQUN6RSxvRkFBb0Y7UUFDcEYsNEJBQTRCO1FBQzVCLE9BQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQztJQUNyQixDQUFDO1NBQU0sQ0FBQztRQUNOLHdGQUF3RjtRQUN4Rix3QkFBd0I7UUFDeEIsRUFBRTtRQUNGLGlGQUFpRjtRQUNqRiw2RkFBNkY7UUFDN0YsK0JBQStCO1FBQy9CLEVBQUU7UUFDRiwrRkFBK0Y7UUFDL0Ysb0VBQW9FO1FBQ3BFLE9BQU8sQ0FBQyxPQUFPLFNBQVMsS0FBSyxXQUFXLElBQUksU0FBUyxDQUFDLE1BQU0sQ0FBQyxJQUFJLGlCQUFpQixDQUFDO0lBQ3JGLENBQUM7QUFDSCxDQUFDO0FBRUQ7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztHQXFCRztBQUNILE1BQU0sQ0FBQyxNQUFNLFNBQVMsR0FBMkIsSUFBSSxjQUFjLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRTtJQUMvRixVQUFVLEVBQUUsTUFBTTtJQUNsQixPQUFPLEVBQUUsR0FBRyxFQUFFLENBQ1osTUFBTSxDQUFDLFNBQVMsRUFBRSxXQUFXLENBQUMsUUFBUSxHQUFHLFdBQVcsQ0FBQyxRQUFRLENBQUMsSUFBSSxlQUFlLEVBQUU7Q0FDdEYsQ0FBQyxDQUFDO0FBRUg7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7R0FxQ0c7QUFDSCxNQUFNLENBQUMsTUFBTSxxQkFBcUIsR0FBRyxJQUFJLGNBQWMsQ0FDckQsU0FBUyxDQUFDLENBQUMsQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUN0QztJQUNFLFVBQVUsRUFBRSxNQUFNO0lBQ2xCLE9BQU8sRUFBRSxHQUFHLEVBQUUsQ0FBQyxpQkFBaUI7Q0FDakMsQ0FDRixDQUFDO0FBRUY7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBdUJHO0FBQ0gsTUFBTSxDQUFDLE1BQU0sWUFBWSxHQUFHLElBQUksY0FBYyxDQUFTLFNBQVMsQ0FBQyxDQUFDLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUV4Rjs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7R0FvQkc7QUFDSCxNQUFNLENBQUMsTUFBTSxtQkFBbUIsR0FBRyxJQUFJLGNBQWMsQ0FDbkQsU0FBUyxDQUFDLENBQUMsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUN0QyxDQUFDO0FBRUY7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7R0FzQkc7QUFDSCxNQUFNLENBQU4sSUFBWSwwQkFJWDtBQUpELFdBQVksMEJBQTBCO0lBQ3BDLDZFQUFTLENBQUE7SUFDVCxpRkFBVyxDQUFBO0lBQ1gsK0VBQVUsQ0FBQTtBQUNaLENBQUMsRUFKVywwQkFBMEIsS0FBMUIsMEJBQTBCLFFBSXJDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7SW5qZWN0aW9uVG9rZW59IGZyb20gJy4uL2RpL2luamVjdGlvbl90b2tlbic7XG5pbXBvcnQge2luamVjdH0gZnJvbSAnLi4vZGkvaW5qZWN0b3JfY29tcGF0aWJpbGl0eSc7XG5pbXBvcnQge0luamVjdEZsYWdzfSBmcm9tICcuLi9kaS9pbnRlcmZhY2UvaW5qZWN0b3InO1xuXG5pbXBvcnQge0RFRkFVTFRfTE9DQUxFX0lELCBVU0RfQ1VSUkVOQ1lfQ09ERX0gZnJvbSAnLi9sb2NhbGl6YXRpb24nO1xuXG5kZWNsYXJlIGNvbnN0ICRsb2NhbGl6ZToge2xvY2FsZT86IHN0cmluZ307XG5cbi8qKlxuICogV29yayBvdXQgdGhlIGxvY2FsZSBmcm9tIHRoZSBwb3RlbnRpYWwgZ2xvYmFsIHByb3BlcnRpZXMuXG4gKlxuICogKiBDbG9zdXJlIENvbXBpbGVyOiB1c2UgYGdvb2cuTE9DQUxFYC5cbiAqICogSXZ5IGVuYWJsZWQ6IHVzZSBgJGxvY2FsaXplLmxvY2FsZWBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldEdsb2JhbExvY2FsZSgpOiBzdHJpbmcge1xuICBpZiAoXG4gICAgdHlwZW9mIG5nSTE4bkNsb3N1cmVNb2RlICE9PSAndW5kZWZpbmVkJyAmJlxuICAgIG5nSTE4bkNsb3N1cmVNb2RlICYmXG4gICAgdHlwZW9mIGdvb2cgIT09ICd1bmRlZmluZWQnICYmXG4gICAgZ29vZy5MT0NBTEUgIT09ICdlbidcbiAgKSB7XG4gICAgLy8gKiBUaGUgZGVmYXVsdCBgZ29vZy5MT0NBTEVgIHZhbHVlIGlzIGBlbmAsIHdoaWxlIEFuZ3VsYXIgdXNlZCBgZW4tVVNgLlxuICAgIC8vICogSW4gb3JkZXIgdG8gcHJlc2VydmUgYmFja3dhcmRzIGNvbXBhdGliaWxpdHksIHdlIHVzZSBBbmd1bGFyIGRlZmF1bHQgdmFsdWUgb3ZlclxuICAgIC8vICAgQ2xvc3VyZSBDb21waWxlcidzIG9uZS5cbiAgICByZXR1cm4gZ29vZy5MT0NBTEU7XG4gIH0gZWxzZSB7XG4gICAgLy8gS0VFUCBgdHlwZW9mICRsb2NhbGl6ZSAhPT0gJ3VuZGVmaW5lZCcgJiYgJGxvY2FsaXplLmxvY2FsZWAgSU4gU1lOQyBXSVRIIFRIRSBMT0NBTElaRVxuICAgIC8vIENPTVBJTEUtVElNRSBJTkxJTkVSLlxuICAgIC8vXG4gICAgLy8gKiBEdXJpbmcgY29tcGlsZSB0aW1lIGlubGluaW5nIG9mIHRyYW5zbGF0aW9ucyB0aGUgZXhwcmVzc2lvbiB3aWxsIGJlIHJlcGxhY2VkXG4gICAgLy8gICB3aXRoIGEgc3RyaW5nIGxpdGVyYWwgdGhhdCBpcyB0aGUgY3VycmVudCBsb2NhbGUuIE90aGVyIGZvcm1zIG9mIHRoaXMgZXhwcmVzc2lvbiBhcmUgbm90XG4gICAgLy8gICBndWFyYW50ZWVkIHRvIGJlIHJlcGxhY2VkLlxuICAgIC8vXG4gICAgLy8gKiBEdXJpbmcgcnVudGltZSB0cmFuc2xhdGlvbiBldmFsdWF0aW9uLCB0aGUgZGV2ZWxvcGVyIGlzIHJlcXVpcmVkIHRvIHNldCBgJGxvY2FsaXplLmxvY2FsZWBcbiAgICAvLyAgIGlmIHJlcXVpcmVkLCBvciBqdXN0IHRvIHByb3ZpZGUgdGhlaXIgb3duIGBMT0NBTEVfSURgIHByb3ZpZGVyLlxuICAgIHJldHVybiAodHlwZW9mICRsb2NhbGl6ZSAhPT0gJ3VuZGVmaW5lZCcgJiYgJGxvY2FsaXplLmxvY2FsZSkgfHwgREVGQVVMVF9MT0NBTEVfSUQ7XG4gIH1cbn1cblxuLyoqXG4gKiBQcm92aWRlIHRoaXMgdG9rZW4gdG8gc2V0IHRoZSBsb2NhbGUgb2YgeW91ciBhcHBsaWNhdGlvbi5cbiAqIEl0IGlzIHVzZWQgZm9yIGkxOG4gZXh0cmFjdGlvbiwgYnkgaTE4biBwaXBlcyAoRGF0ZVBpcGUsIEkxOG5QbHVyYWxQaXBlLCBDdXJyZW5jeVBpcGUsXG4gKiBEZWNpbWFsUGlwZSBhbmQgUGVyY2VudFBpcGUpIGFuZCBieSBJQ1UgZXhwcmVzc2lvbnMuXG4gKlxuICogU2VlIHRoZSBbaTE4biBndWlkZV0oZ3VpZGUvaTE4bi9sb2NhbGUtaWQpIGZvciBtb3JlIGluZm9ybWF0aW9uLlxuICpcbiAqIEB1c2FnZU5vdGVzXG4gKiAjIyMgRXhhbXBsZVxuICpcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIGltcG9ydCB7IExPQ0FMRV9JRCB9IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO1xuICogaW1wb3J0IHsgcGxhdGZvcm1Ccm93c2VyRHluYW1pYyB9IGZyb20gJ0Bhbmd1bGFyL3BsYXRmb3JtLWJyb3dzZXItZHluYW1pYyc7XG4gKiBpbXBvcnQgeyBBcHBNb2R1bGUgfSBmcm9tICcuL2FwcC9hcHAubW9kdWxlJztcbiAqXG4gKiBwbGF0Zm9ybUJyb3dzZXJEeW5hbWljKCkuYm9vdHN0cmFwTW9kdWxlKEFwcE1vZHVsZSwge1xuICogICBwcm92aWRlcnM6IFt7cHJvdmlkZTogTE9DQUxFX0lELCB1c2VWYWx1ZTogJ2VuLVVTJyB9XVxuICogfSk7XG4gKiBgYGBcbiAqXG4gKiBAcHVibGljQXBpXG4gKi9cbmV4cG9ydCBjb25zdCBMT0NBTEVfSUQ6IEluamVjdGlvblRva2VuPHN0cmluZz4gPSBuZXcgSW5qZWN0aW9uVG9rZW4obmdEZXZNb2RlID8gJ0xvY2FsZUlkJyA6ICcnLCB7XG4gIHByb3ZpZGVkSW46ICdyb290JyxcbiAgZmFjdG9yeTogKCkgPT5cbiAgICBpbmplY3QoTE9DQUxFX0lELCBJbmplY3RGbGFncy5PcHRpb25hbCB8IEluamVjdEZsYWdzLlNraXBTZWxmKSB8fCBnZXRHbG9iYWxMb2NhbGUoKSxcbn0pO1xuXG4vKipcbiAqIFByb3ZpZGUgdGhpcyB0b2tlbiB0byBzZXQgdGhlIGRlZmF1bHQgY3VycmVuY3kgY29kZSB5b3VyIGFwcGxpY2F0aW9uIHVzZXMgZm9yXG4gKiBDdXJyZW5jeVBpcGUgd2hlbiB0aGVyZSBpcyBubyBjdXJyZW5jeSBjb2RlIHBhc3NlZCBpbnRvIGl0LiBUaGlzIGlzIG9ubHkgdXNlZCBieVxuICogQ3VycmVuY3lQaXBlIGFuZCBoYXMgbm8gcmVsYXRpb24gdG8gbG9jYWxlIGN1cnJlbmN5LiBEZWZhdWx0cyB0byBVU0QgaWYgbm90IGNvbmZpZ3VyZWQuXG4gKlxuICogU2VlIHRoZSBbaTE4biBndWlkZV0oZ3VpZGUvaTE4bi9sb2NhbGUtaWQpIGZvciBtb3JlIGluZm9ybWF0aW9uLlxuICpcbiAqIDxkaXYgY2xhc3M9XCJhbGVydCBpcy1oZWxwZnVsXCI+XG4gKlxuICogKipEZXByZWNhdGlvbiBub3RpY2U6KipcbiAqXG4gKiBUaGUgZGVmYXVsdCBjdXJyZW5jeSBjb2RlIGlzIGN1cnJlbnRseSBhbHdheXMgYFVTRGAgYnV0IHRoaXMgaXMgZGVwcmVjYXRlZCBmcm9tIHY5LlxuICpcbiAqICoqSW4gdjEwIHRoZSBkZWZhdWx0IGN1cnJlbmN5IGNvZGUgd2lsbCBiZSB0YWtlbiBmcm9tIHRoZSBjdXJyZW50IGxvY2FsZS4qKlxuICpcbiAqIElmIHlvdSBuZWVkIHRoZSBwcmV2aW91cyBiZWhhdmlvciB0aGVuIHNldCBpdCBieSBjcmVhdGluZyBhIGBERUZBVUxUX0NVUlJFTkNZX0NPREVgIHByb3ZpZGVyIGluXG4gKiB5b3VyIGFwcGxpY2F0aW9uIGBOZ01vZHVsZWA6XG4gKlxuICogYGBgdHNcbiAqIHtwcm92aWRlOiBERUZBVUxUX0NVUlJFTkNZX0NPREUsIHVzZVZhbHVlOiAnVVNEJ31cbiAqIGBgYFxuICpcbiAqIDwvZGl2PlxuICpcbiAqIEB1c2FnZU5vdGVzXG4gKiAjIyMgRXhhbXBsZVxuICpcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIGltcG9ydCB7IHBsYXRmb3JtQnJvd3NlckR5bmFtaWMgfSBmcm9tICdAYW5ndWxhci9wbGF0Zm9ybS1icm93c2VyLWR5bmFtaWMnO1xuICogaW1wb3J0IHsgQXBwTW9kdWxlIH0gZnJvbSAnLi9hcHAvYXBwLm1vZHVsZSc7XG4gKlxuICogcGxhdGZvcm1Ccm93c2VyRHluYW1pYygpLmJvb3RzdHJhcE1vZHVsZShBcHBNb2R1bGUsIHtcbiAqICAgcHJvdmlkZXJzOiBbe3Byb3ZpZGU6IERFRkFVTFRfQ1VSUkVOQ1lfQ09ERSwgdXNlVmFsdWU6ICdFVVInIH1dXG4gKiB9KTtcbiAqIGBgYFxuICpcbiAqIEBwdWJsaWNBcGlcbiAqL1xuZXhwb3J0IGNvbnN0IERFRkFVTFRfQ1VSUkVOQ1lfQ09ERSA9IG5ldyBJbmplY3Rpb25Ub2tlbjxzdHJpbmc+KFxuICBuZ0Rldk1vZGUgPyAnRGVmYXVsdEN1cnJlbmN5Q29kZScgOiAnJyxcbiAge1xuICAgIHByb3ZpZGVkSW46ICdyb290JyxcbiAgICBmYWN0b3J5OiAoKSA9PiBVU0RfQ1VSUkVOQ1lfQ09ERSxcbiAgfSxcbik7XG5cbi8qKlxuICogVXNlIHRoaXMgdG9rZW4gYXQgYm9vdHN0cmFwIHRvIHByb3ZpZGUgdGhlIGNvbnRlbnQgb2YgeW91ciB0cmFuc2xhdGlvbiBmaWxlIChgeHRiYCxcbiAqIGB4bGZgIG9yIGB4bGYyYCkgd2hlbiB5b3Ugd2FudCB0byB0cmFuc2xhdGUgeW91ciBhcHBsaWNhdGlvbiBpbiBhbm90aGVyIGxhbmd1YWdlLlxuICpcbiAqIFNlZSB0aGUgW2kxOG4gZ3VpZGVdKGd1aWRlL2kxOG4vbWVyZ2UpIGZvciBtb3JlIGluZm9ybWF0aW9uLlxuICpcbiAqIEB1c2FnZU5vdGVzXG4gKiAjIyMgRXhhbXBsZVxuICpcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIGltcG9ydCB7IFRSQU5TTEFUSU9OUyB9IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO1xuICogaW1wb3J0IHsgcGxhdGZvcm1Ccm93c2VyRHluYW1pYyB9IGZyb20gJ0Bhbmd1bGFyL3BsYXRmb3JtLWJyb3dzZXItZHluYW1pYyc7XG4gKiBpbXBvcnQgeyBBcHBNb2R1bGUgfSBmcm9tICcuL2FwcC9hcHAubW9kdWxlJztcbiAqXG4gKiAvLyBjb250ZW50IG9mIHlvdXIgdHJhbnNsYXRpb24gZmlsZVxuICogY29uc3QgdHJhbnNsYXRpb25zID0gJy4uLi4nO1xuICpcbiAqIHBsYXRmb3JtQnJvd3NlckR5bmFtaWMoKS5ib290c3RyYXBNb2R1bGUoQXBwTW9kdWxlLCB7XG4gKiAgIHByb3ZpZGVyczogW3twcm92aWRlOiBUUkFOU0xBVElPTlMsIHVzZVZhbHVlOiB0cmFuc2xhdGlvbnMgfV1cbiAqIH0pO1xuICogYGBgXG4gKlxuICogQHB1YmxpY0FwaVxuICovXG5leHBvcnQgY29uc3QgVFJBTlNMQVRJT05TID0gbmV3IEluamVjdGlvblRva2VuPHN0cmluZz4obmdEZXZNb2RlID8gJ1RyYW5zbGF0aW9ucycgOiAnJyk7XG5cbi8qKlxuICogUHJvdmlkZSB0aGlzIHRva2VuIGF0IGJvb3RzdHJhcCB0byBzZXQgdGhlIGZvcm1hdCBvZiB5b3VyIHtAbGluayBUUkFOU0xBVElPTlN9OiBgeHRiYCxcbiAqIGB4bGZgIG9yIGB4bGYyYC5cbiAqXG4gKiBTZWUgdGhlIFtpMThuIGd1aWRlXShndWlkZS9pMThuL21lcmdlKSBmb3IgbW9yZSBpbmZvcm1hdGlvbi5cbiAqXG4gKiBAdXNhZ2VOb3Rlc1xuICogIyMjIEV4YW1wbGVcbiAqXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiBpbXBvcnQgeyBUUkFOU0xBVElPTlNfRk9STUFUIH0gZnJvbSAnQGFuZ3VsYXIvY29yZSc7XG4gKiBpbXBvcnQgeyBwbGF0Zm9ybUJyb3dzZXJEeW5hbWljIH0gZnJvbSAnQGFuZ3VsYXIvcGxhdGZvcm0tYnJvd3Nlci1keW5hbWljJztcbiAqIGltcG9ydCB7IEFwcE1vZHVsZSB9IGZyb20gJy4vYXBwL2FwcC5tb2R1bGUnO1xuICpcbiAqIHBsYXRmb3JtQnJvd3NlckR5bmFtaWMoKS5ib290c3RyYXBNb2R1bGUoQXBwTW9kdWxlLCB7XG4gKiAgIHByb3ZpZGVyczogW3twcm92aWRlOiBUUkFOU0xBVElPTlNfRk9STUFULCB1c2VWYWx1ZTogJ3hsZicgfV1cbiAqIH0pO1xuICogYGBgXG4gKlxuICogQHB1YmxpY0FwaVxuICovXG5leHBvcnQgY29uc3QgVFJBTlNMQVRJT05TX0ZPUk1BVCA9IG5ldyBJbmplY3Rpb25Ub2tlbjxzdHJpbmc+KFxuICBuZ0Rldk1vZGUgPyAnVHJhbnNsYXRpb25zRm9ybWF0JyA6ICcnLFxuKTtcblxuLyoqXG4gKiBVc2UgdGhpcyBlbnVtIGF0IGJvb3RzdHJhcCBhcyBhbiBvcHRpb24gb2YgYGJvb3RzdHJhcE1vZHVsZWAgdG8gZGVmaW5lIHRoZSBzdHJhdGVneVxuICogdGhhdCB0aGUgY29tcGlsZXIgc2hvdWxkIHVzZSBpbiBjYXNlIG9mIG1pc3NpbmcgdHJhbnNsYXRpb25zOlxuICogLSBFcnJvcjogdGhyb3cgaWYgeW91IGhhdmUgbWlzc2luZyB0cmFuc2xhdGlvbnMuXG4gKiAtIFdhcm5pbmcgKGRlZmF1bHQpOiBzaG93IGEgd2FybmluZyBpbiB0aGUgY29uc29sZSBhbmQvb3Igc2hlbGwuXG4gKiAtIElnbm9yZTogZG8gbm90aGluZy5cbiAqXG4gKiBTZWUgdGhlIFtpMThuIGd1aWRlXShndWlkZS9pMThuL21lcmdlI3JlcG9ydC1taXNzaW5nLXRyYW5zbGF0aW9ucykgZm9yIG1vcmUgaW5mb3JtYXRpb24uXG4gKlxuICogQHVzYWdlTm90ZXNcbiAqICMjIyBFeGFtcGxlXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiBpbXBvcnQgeyBNaXNzaW5nVHJhbnNsYXRpb25TdHJhdGVneSB9IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO1xuICogaW1wb3J0IHsgcGxhdGZvcm1Ccm93c2VyRHluYW1pYyB9IGZyb20gJ0Bhbmd1bGFyL3BsYXRmb3JtLWJyb3dzZXItZHluYW1pYyc7XG4gKiBpbXBvcnQgeyBBcHBNb2R1bGUgfSBmcm9tICcuL2FwcC9hcHAubW9kdWxlJztcbiAqXG4gKiBwbGF0Zm9ybUJyb3dzZXJEeW5hbWljKCkuYm9vdHN0cmFwTW9kdWxlKEFwcE1vZHVsZSwge1xuICogICBtaXNzaW5nVHJhbnNsYXRpb246IE1pc3NpbmdUcmFuc2xhdGlvblN0cmF0ZWd5LkVycm9yXG4gKiB9KTtcbiAqIGBgYFxuICpcbiAqIEBwdWJsaWNBcGlcbiAqL1xuZXhwb3J0IGVudW0gTWlzc2luZ1RyYW5zbGF0aW9uU3RyYXRlZ3kge1xuICBFcnJvciA9IDAsXG4gIFdhcm5pbmcgPSAxLFxuICBJZ25vcmUgPSAyLFxufVxuIl19