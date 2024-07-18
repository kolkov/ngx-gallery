/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { HttpHeaders } from './headers';
/**
 * Type enumeration for the different kinds of `HttpEvent`.
 *
 * @publicApi
 */
export var HttpEventType;
(function (HttpEventType) {
    /**
     * The request was sent out over the wire.
     */
    HttpEventType[HttpEventType["Sent"] = 0] = "Sent";
    /**
     * An upload progress event was received.
     *
     * Note: The `FetchBackend` doesn't support progress report on uploads.
     */
    HttpEventType[HttpEventType["UploadProgress"] = 1] = "UploadProgress";
    /**
     * The response status code and headers were received.
     */
    HttpEventType[HttpEventType["ResponseHeader"] = 2] = "ResponseHeader";
    /**
     * A download progress event was received.
     */
    HttpEventType[HttpEventType["DownloadProgress"] = 3] = "DownloadProgress";
    /**
     * The full response including the body was received.
     */
    HttpEventType[HttpEventType["Response"] = 4] = "Response";
    /**
     * A custom event from an interceptor or a backend.
     */
    HttpEventType[HttpEventType["User"] = 5] = "User";
})(HttpEventType || (HttpEventType = {}));
/**
 * Base class for both `HttpResponse` and `HttpHeaderResponse`.
 *
 * @publicApi
 */
export class HttpResponseBase {
    /**
     * Super-constructor for all responses.
     *
     * The single parameter accepted is an initialization hash. Any properties
     * of the response passed there will override the default values.
     */
    constructor(init, defaultStatus = 200, defaultStatusText = 'OK') {
        // If the hash has values passed, use them to initialize the response.
        // Otherwise use the default values.
        this.headers = init.headers || new HttpHeaders();
        this.status = init.status !== undefined ? init.status : defaultStatus;
        this.statusText = init.statusText || defaultStatusText;
        this.url = init.url || null;
        // Cache the ok value to avoid defining a getter.
        this.ok = this.status >= 200 && this.status < 300;
    }
}
/**
 * A partial HTTP response which only includes the status and header data,
 * but no response body.
 *
 * `HttpHeaderResponse` is a `HttpEvent` available on the response
 * event stream, only when progress events are requested.
 *
 * @publicApi
 */
export class HttpHeaderResponse extends HttpResponseBase {
    /**
     * Create a new `HttpHeaderResponse` with the given parameters.
     */
    constructor(init = {}) {
        super(init);
        this.type = HttpEventType.ResponseHeader;
    }
    /**
     * Copy this `HttpHeaderResponse`, overriding its contents with the
     * given parameter hash.
     */
    clone(update = {}) {
        // Perform a straightforward initialization of the new HttpHeaderResponse,
        // overriding the current parameters with new ones if given.
        return new HttpHeaderResponse({
            headers: update.headers || this.headers,
            status: update.status !== undefined ? update.status : this.status,
            statusText: update.statusText || this.statusText,
            url: update.url || this.url || undefined,
        });
    }
}
/**
 * A full HTTP response, including a typed response body (which may be `null`
 * if one was not returned).
 *
 * `HttpResponse` is a `HttpEvent` available on the response event
 * stream.
 *
 * @publicApi
 */
export class HttpResponse extends HttpResponseBase {
    /**
     * Construct a new `HttpResponse`.
     */
    constructor(init = {}) {
        super(init);
        this.type = HttpEventType.Response;
        this.body = init.body !== undefined ? init.body : null;
    }
    clone(update = {}) {
        return new HttpResponse({
            body: update.body !== undefined ? update.body : this.body,
            headers: update.headers || this.headers,
            status: update.status !== undefined ? update.status : this.status,
            statusText: update.statusText || this.statusText,
            url: update.url || this.url || undefined,
        });
    }
}
/**
 * A response that represents an error or failure, either from a
 * non-successful HTTP status, an error while executing the request,
 * or some other failure which occurred during the parsing of the response.
 *
 * Any error returned on the `Observable` response stream will be
 * wrapped in an `HttpErrorResponse` to provide additional context about
 * the state of the HTTP layer when the error occurred. The error property
 * will contain either a wrapped Error object or the error response returned
 * from the server.
 *
 * @publicApi
 */
export class HttpErrorResponse extends HttpResponseBase {
    constructor(init) {
        // Initialize with a default status of 0 / Unknown Error.
        super(init, 0, 'Unknown Error');
        this.name = 'HttpErrorResponse';
        /**
         * Errors are never okay, even when the status code is in the 2xx success range.
         */
        this.ok = false;
        // If the response was successful, then this was a parse error. Otherwise, it was
        // a protocol-level failure of some sort. Either the request failed in transit
        // or the server returned an unsuccessful status code.
        if (this.status >= 200 && this.status < 300) {
            this.message = `Http failure during parsing for ${init.url || '(unknown url)'}`;
        }
        else {
            this.message = `Http failure response for ${init.url || '(unknown url)'}: ${init.status} ${init.statusText}`;
        }
        this.error = init.error || null;
    }
}
/**
 * We use these constant to prevent pulling the whole HttpStatusCode enum
 * Those are the only ones referenced directly by the framework
 */
export const HTTP_STATUS_CODE_OK = 200;
export const HTTP_STATUS_CODE_NO_CONTENT = 204;
/**
 * Http status codes.
 * As per https://www.iana.org/assignments/http-status-codes/http-status-codes.xhtml
 * @publicApi
 */
export var HttpStatusCode;
(function (HttpStatusCode) {
    HttpStatusCode[HttpStatusCode["Continue"] = 100] = "Continue";
    HttpStatusCode[HttpStatusCode["SwitchingProtocols"] = 101] = "SwitchingProtocols";
    HttpStatusCode[HttpStatusCode["Processing"] = 102] = "Processing";
    HttpStatusCode[HttpStatusCode["EarlyHints"] = 103] = "EarlyHints";
    HttpStatusCode[HttpStatusCode["Ok"] = 200] = "Ok";
    HttpStatusCode[HttpStatusCode["Created"] = 201] = "Created";
    HttpStatusCode[HttpStatusCode["Accepted"] = 202] = "Accepted";
    HttpStatusCode[HttpStatusCode["NonAuthoritativeInformation"] = 203] = "NonAuthoritativeInformation";
    HttpStatusCode[HttpStatusCode["NoContent"] = 204] = "NoContent";
    HttpStatusCode[HttpStatusCode["ResetContent"] = 205] = "ResetContent";
    HttpStatusCode[HttpStatusCode["PartialContent"] = 206] = "PartialContent";
    HttpStatusCode[HttpStatusCode["MultiStatus"] = 207] = "MultiStatus";
    HttpStatusCode[HttpStatusCode["AlreadyReported"] = 208] = "AlreadyReported";
    HttpStatusCode[HttpStatusCode["ImUsed"] = 226] = "ImUsed";
    HttpStatusCode[HttpStatusCode["MultipleChoices"] = 300] = "MultipleChoices";
    HttpStatusCode[HttpStatusCode["MovedPermanently"] = 301] = "MovedPermanently";
    HttpStatusCode[HttpStatusCode["Found"] = 302] = "Found";
    HttpStatusCode[HttpStatusCode["SeeOther"] = 303] = "SeeOther";
    HttpStatusCode[HttpStatusCode["NotModified"] = 304] = "NotModified";
    HttpStatusCode[HttpStatusCode["UseProxy"] = 305] = "UseProxy";
    HttpStatusCode[HttpStatusCode["Unused"] = 306] = "Unused";
    HttpStatusCode[HttpStatusCode["TemporaryRedirect"] = 307] = "TemporaryRedirect";
    HttpStatusCode[HttpStatusCode["PermanentRedirect"] = 308] = "PermanentRedirect";
    HttpStatusCode[HttpStatusCode["BadRequest"] = 400] = "BadRequest";
    HttpStatusCode[HttpStatusCode["Unauthorized"] = 401] = "Unauthorized";
    HttpStatusCode[HttpStatusCode["PaymentRequired"] = 402] = "PaymentRequired";
    HttpStatusCode[HttpStatusCode["Forbidden"] = 403] = "Forbidden";
    HttpStatusCode[HttpStatusCode["NotFound"] = 404] = "NotFound";
    HttpStatusCode[HttpStatusCode["MethodNotAllowed"] = 405] = "MethodNotAllowed";
    HttpStatusCode[HttpStatusCode["NotAcceptable"] = 406] = "NotAcceptable";
    HttpStatusCode[HttpStatusCode["ProxyAuthenticationRequired"] = 407] = "ProxyAuthenticationRequired";
    HttpStatusCode[HttpStatusCode["RequestTimeout"] = 408] = "RequestTimeout";
    HttpStatusCode[HttpStatusCode["Conflict"] = 409] = "Conflict";
    HttpStatusCode[HttpStatusCode["Gone"] = 410] = "Gone";
    HttpStatusCode[HttpStatusCode["LengthRequired"] = 411] = "LengthRequired";
    HttpStatusCode[HttpStatusCode["PreconditionFailed"] = 412] = "PreconditionFailed";
    HttpStatusCode[HttpStatusCode["PayloadTooLarge"] = 413] = "PayloadTooLarge";
    HttpStatusCode[HttpStatusCode["UriTooLong"] = 414] = "UriTooLong";
    HttpStatusCode[HttpStatusCode["UnsupportedMediaType"] = 415] = "UnsupportedMediaType";
    HttpStatusCode[HttpStatusCode["RangeNotSatisfiable"] = 416] = "RangeNotSatisfiable";
    HttpStatusCode[HttpStatusCode["ExpectationFailed"] = 417] = "ExpectationFailed";
    HttpStatusCode[HttpStatusCode["ImATeapot"] = 418] = "ImATeapot";
    HttpStatusCode[HttpStatusCode["MisdirectedRequest"] = 421] = "MisdirectedRequest";
    HttpStatusCode[HttpStatusCode["UnprocessableEntity"] = 422] = "UnprocessableEntity";
    HttpStatusCode[HttpStatusCode["Locked"] = 423] = "Locked";
    HttpStatusCode[HttpStatusCode["FailedDependency"] = 424] = "FailedDependency";
    HttpStatusCode[HttpStatusCode["TooEarly"] = 425] = "TooEarly";
    HttpStatusCode[HttpStatusCode["UpgradeRequired"] = 426] = "UpgradeRequired";
    HttpStatusCode[HttpStatusCode["PreconditionRequired"] = 428] = "PreconditionRequired";
    HttpStatusCode[HttpStatusCode["TooManyRequests"] = 429] = "TooManyRequests";
    HttpStatusCode[HttpStatusCode["RequestHeaderFieldsTooLarge"] = 431] = "RequestHeaderFieldsTooLarge";
    HttpStatusCode[HttpStatusCode["UnavailableForLegalReasons"] = 451] = "UnavailableForLegalReasons";
    HttpStatusCode[HttpStatusCode["InternalServerError"] = 500] = "InternalServerError";
    HttpStatusCode[HttpStatusCode["NotImplemented"] = 501] = "NotImplemented";
    HttpStatusCode[HttpStatusCode["BadGateway"] = 502] = "BadGateway";
    HttpStatusCode[HttpStatusCode["ServiceUnavailable"] = 503] = "ServiceUnavailable";
    HttpStatusCode[HttpStatusCode["GatewayTimeout"] = 504] = "GatewayTimeout";
    HttpStatusCode[HttpStatusCode["HttpVersionNotSupported"] = 505] = "HttpVersionNotSupported";
    HttpStatusCode[HttpStatusCode["VariantAlsoNegotiates"] = 506] = "VariantAlsoNegotiates";
    HttpStatusCode[HttpStatusCode["InsufficientStorage"] = 507] = "InsufficientStorage";
    HttpStatusCode[HttpStatusCode["LoopDetected"] = 508] = "LoopDetected";
    HttpStatusCode[HttpStatusCode["NotExtended"] = 510] = "NotExtended";
    HttpStatusCode[HttpStatusCode["NetworkAuthenticationRequired"] = 511] = "NetworkAuthenticationRequired";
})(HttpStatusCode || (HttpStatusCode = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVzcG9uc2UuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21tb24vaHR0cC9zcmMvcmVzcG9uc2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUFDLFdBQVcsRUFBQyxNQUFNLFdBQVcsQ0FBQztBQUV0Qzs7OztHQUlHO0FBQ0gsTUFBTSxDQUFOLElBQVksYUFnQ1g7QUFoQ0QsV0FBWSxhQUFhO0lBQ3ZCOztPQUVHO0lBQ0gsaURBQUksQ0FBQTtJQUVKOzs7O09BSUc7SUFDSCxxRUFBYyxDQUFBO0lBRWQ7O09BRUc7SUFDSCxxRUFBYyxDQUFBO0lBRWQ7O09BRUc7SUFDSCx5RUFBZ0IsQ0FBQTtJQUVoQjs7T0FFRztJQUNILHlEQUFRLENBQUE7SUFFUjs7T0FFRztJQUNILGlEQUFJLENBQUE7QUFDTixDQUFDLEVBaENXLGFBQWEsS0FBYixhQUFhLFFBZ0N4QjtBQXNHRDs7OztHQUlHO0FBQ0gsTUFBTSxPQUFnQixnQkFBZ0I7SUFrQ3BDOzs7OztPQUtHO0lBQ0gsWUFDRSxJQUtDLEVBQ0QsZ0JBQXdCLEdBQUcsRUFDM0Isb0JBQTRCLElBQUk7UUFFaEMsc0VBQXNFO1FBQ3RFLG9DQUFvQztRQUNwQyxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQyxPQUFPLElBQUksSUFBSSxXQUFXLEVBQUUsQ0FBQztRQUNqRCxJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxNQUFNLEtBQUssU0FBUyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxhQUFhLENBQUM7UUFDdEUsSUFBSSxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUMsVUFBVSxJQUFJLGlCQUFpQixDQUFDO1FBQ3ZELElBQUksQ0FBQyxHQUFHLEdBQUcsSUFBSSxDQUFDLEdBQUcsSUFBSSxJQUFJLENBQUM7UUFFNUIsaURBQWlEO1FBQ2pELElBQUks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QTtJQUNwQixpRkFBd0IsQ0FBQTtJQUN4QiwyRUFBcUIsQ0FBQTtJQUNyQixpRUFBZ0IsQ0FBQTtJQUNoQixxRkFBMEIsQ0FBQTtJQUMxQixtRkFBeUIsQ0FBQTtJQUN6QiwrRUFBdUIsQ0FBQTtJQUN2QiwrREFBZSxDQUFBO0lBQ2YsaUZBQXdCLENBQUE7SUFDeEIsbUZBQXlCLENBQUE7SUFDekIseURBQVksQ0FBQTtJQUNaLDZFQUFzQixDQUFBO0lBQ3RCLDZEQUFjLENBQUE7SUFDZCwyRUFBcUIsQ0FBQTtJQUNyQixxRkFBMEIsQ0FBQTtJQUMxQiwyRUFBcUIsQ0FBQTtJQUNyQixtR0FBaUMsQ0FBQTtJQUNqQyxpR0FBZ0MsQ0FBQTtJQUVoQyxtRkFBeUIsQ0FBQTtJQUN6Qix5RUFBb0IsQ0FBQTtJQUNwQixpRUFBZ0IsQ0FBQTtJQUNoQixpRkFBd0IsQ0FBQTtJQUN4Qix5RUFBb0IsQ0FBQTtJQUNwQiwyRkFBNkIsQ0FBQTtJQUM3Qix1RkFBMkIsQ0FBQTtJQUMzQixtRkFBeUIsQ0FBQTtJQUN6QixxRUFBa0IsQ0FBQTtJQUNsQixtRUFBaUIsQ0FBQTtJQUNqQix1R0FBbUMsQ0FBQTtBQUNyQyxDQUFDLEVBcEVXLGNBQWMsS0FBZCxjQUFjLFFBb0V6QiIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge0h0dHBIZWFkZXJzfSBmcm9tICcuL2hlYWRlcnMnO1xuXG4vKipcbiAqIFR5cGUgZW51bWVyYXRpb24gZm9yIHRoZSBkaWZmZXJlbnQga2luZHMgb2YgYEh0dHBFdmVudGAuXG4gKlxuICogQHB1YmxpY0FwaVxuICovXG5leHBvcnQgZW51bSBIdHRwRXZlbnRUeXBlIHtcbiAgLyoqXG4gICAqIFRoZSByZXF1ZXN0IHdhcyBzZW50IG91dCBvdmVyIHRoZSB3aXJlLlxuICAgKi9cbiAgU2VudCxcblxuICAvKipcbiAgICogQW4gdXBsb2FkIHByb2dyZXNzIGV2ZW50IHdhcyByZWNlaXZlZC5cbiAgICpcbiAgICogTm90ZTogVGhlIGBGZXRjaEJhY2tlbmRgIGRvZXNuJ3Qgc3VwcG9ydCBwcm9ncmVzcyByZXBvcnQgb24gdXBsb2Fkcy5cbiAgICovXG4gIFVwbG9hZFByb2dyZXNzLFxuXG4gIC8qKlxuICAgKiBUaGUgcmVzcG9uc2Ugc3RhdHVzIGNvZGUgYW5kIGhlYWRlcnMgd2VyZSByZWNlaXZlZC5cbiAgICovXG4gIFJlc3BvbnNlSGVhZGVyLFxuXG4gIC8qKlxuICAgKiBBIGRvd25sb2FkIHByb2dyZXNzIGV2ZW50IHdhcyByZWNlaXZlZC5cbiAgICovXG4gIERvd25sb2FkUHJvZ3Jlc3MsXG5cbiAgLyoqXG4gICAqIFRoZSBmdWxsIHJlc3BvbnNlIGluY2x1ZGluZyB0aGUgYm9keSB3YXMgcmVjZWl2ZWQuXG4gICAqL1xuICBSZXNwb25zZSxcblxuICAvKipcbiAgICogQSBjdXN0b20gZXZlbnQgZnJvbSBhbiBpbnRlcmNlcHRvciBvciBhIGJhY2tlbmQuXG4gICAqL1xuICBVc2VyLFxufVxuXG4vKipcbiAqIEJhc2UgaW50ZXJmYWNlIGZvciBwcm9ncmVzcyBldmVudHMuXG4gKlxuICogQHB1YmxpY0FwaVxuICovXG5leHBvcnQgaW50ZXJmYWNlIEh0dHBQcm9ncmVzc0V2ZW50IHtcbiAgLyoqXG4gICAqIFByb2dyZXNzIGV2ZW50IHR5cGUgaXMgZWl0aGVyIHVwbG9hZCBvciBkb3dubG9hZC5cbiAgICovXG4gIHR5cGU6IEh0dHBFdmVudFR5cGUuRG93bmxvYWRQcm9ncmVzcyB8IEh0dHBFdmVudFR5cGUuVXBsb2FkUHJvZ3Jlc3M7XG5cbiAgLyoqXG4gICAqIE51bWJlciBvZiBieXRlcyB1cGxvYWRlZCBvciBkb3dubG9hZGVkLlxuICAgKi9cbiAgbG9hZGVkOiBudW1iZXI7XG5cbiAgLyoqXG4gICAqIFRvdGFsIG51bWJlciBvZiBieXRlcyB0byB1cGxvYWQgb3IgZG93bmxvYWQuIERlcGVuZGluZyBvbiB0aGUgcmVxdWVzdCBvclxuICAgKiByZXNwb25zZSwgdGhpcyBtYXkgbm90IGJlIGNvbXB1dGFibGUgYW5kIHRodXMgbWF5IG5vdCBiZSBwcmVzZW50LlxuICAgKi9cbiAgdG90YWw/OiBudW1iZXI7XG59XG5cbi8qKlxuICogQSBkb3dubG9hZCBwcm9ncmVzcyBldmVudC5cbiAqXG4gKiBAcHVibGljQXBpXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgSHR0cERvd25sb2FkUHJvZ3Jlc3NFdmVudCBleHRlbmRzIEh0dHBQcm9ncmVzc0V2ZW50IHtcbiAgdHlwZTogSHR0cEV2ZW50VHlwZS5Eb3dubG9hZFByb2dyZXNzO1xuXG4gIC8qKlxuICAgKiBUaGUgcGFydGlhbCByZXNwb25zZSBib2R5IGFzIGRvd25sb2FkZWQgc28gZmFyLlxuICAgKlxuICAgKiBPbmx5IHByZXNlbnQgaWYgdGhlIHJlc3BvbnNlVHlwZSB3YXMgYHRleHRgLlxuICAgKi9cbiAgcGFydGlhbFRleHQ/OiBzdHJpbmc7XG59XG5cbi8qKlxuICogQW4gdXBsb2FkIHByb2dyZXNzIGV2ZW50LlxuICpcbiAqIE5vdGU6IFRoZSBgRmV0Y2hCYWNrZW5kYCBkb2Vzbid0IHN1cHBvcnQgcHJvZ3Jlc3MgcmVwb3J0IG9uIHVwbG9hZHMuXG4gKlxuICogQHB1YmxpY0FwaVxuICovXG5leHBvcnQgaW50ZXJmYWNlIEh0dHBVcGxvYWRQcm9ncmVzc0V2ZW50IGV4dGVuZHMgSHR0cFByb2dyZXNzRXZlbnQge1xuICB0eXBlOiBIdHRwRXZlbnRUeXBlLlVwbG9hZFByb2dyZXNzO1xufVxuXG4vKipcbiAqIEFuIGV2ZW50IGluZGljYXRpbmcgdGhhdCB0aGUgcmVxdWVzdCB3YXMgc2VudCB0byB0aGUgc2VydmVyLiBVc2VmdWxcbiAqIHdoZW4gYSByZXF1ZXN0IG1heSBiZSByZXRyaWVkIG11bHRpcGxlIHRpbWVzLCB0byBkaXN0aW5ndWlzaCBiZXR3ZWVuXG4gKiByZXRyaWVzIG9uIHRoZSBmaW5hbCBldmVudCBzdHJlYW0uXG4gKlxuICogQHB1YmxpY0FwaVxuICovXG5leHBvcnQgaW50ZXJmYWNlIEh0dHBTZW50RXZlbnQge1xuICB0eXBlOiBIdHRwRXZlbnRUeXBlLlNlbnQ7XG59XG5cbi8qKlxuICogQSB1c2VyLWRlZmluZWQgZXZlbnQuXG4gKlxuICogR3JvdXBpbmcgYWxsIGN1c3RvbSBldmVudHMgdW5kZXIgdGhpcyB0eXBlIGVuc3VyZXMgdGhleSB3aWxsIGJlIGhhbmRsZWRcbiAqIGFuZCBmb3J3YXJkZWQgYnkgYWxsIGltcGxlbWVudGF0aW9ucyBvZiBpbnRlcmNlcHRvcnMuXG4gKlxuICogQHB1YmxpY0FwaVxuICovXG5leHBvcnQgaW50ZXJmYWNlIEh0dHBVc2VyRXZlbnQ8VD4ge1xuICB0eXBlOiBIdHRwRXZlbnRUeXBlLlVzZXI7XG59XG5cbi8qKlxuICogQW4gZXJyb3IgdGhhdCByZXByZXNlbnRzIGEgZmFpbGVkIGF0dGVtcHQgdG8gSlNPTi5wYXJzZSB0ZXh0IGNvbWluZyBiYWNrXG4gKiBmcm9tIHRoZSBzZXJ2ZXIuXG4gKlxuICogSXQgYnVuZGxlcyB0aGUgRXJyb3Igb2JqZWN0IHdpdGggdGhlIGFjdHVhbCByZXNwb25zZSBib2R5IHRoYXQgZmFpbGVkIHRvIHBhcnNlLlxuICpcbiAqXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgSHR0cEpzb25QYXJzZUVycm9yIHtcbiAgZXJyb3I6IEVycm9yO1xuICB0ZXh0OiBzdHJpbmc7XG59XG5cbi8qKlxuICogVW5pb24gdHlwZSBmb3IgYWxsIHBvc3NpYmxlIGV2ZW50cyBvbiB0aGUgcmVzcG9uc2Ugc3RyZWFtLlxuICpcbiAqIFR5cGVkIGFjY29yZGluZyB0byB0aGUgZXhwZWN0ZWQgdHlwZSBvZiB0aGUgcmVzcG9uc2UuXG4gKlxuICogQHB1YmxpY0FwaVxuICovXG5leHBvcnQgdHlwZSBIdHRwRXZlbnQ8VD4gPVxuICB8IEh0dHBTZW50RXZlbnRcbiAgfCBIdHRwSGVhZGVyUmVzcG9uc2VcbiAgfCBIdHRwUmVzcG9uc2U8VD5cbiAgfCBIdHRwUHJvZ3Jlc3NFdmVudFxuICB8IEh0dHBVc2VyRXZlbnQ8VD47XG5cbi8qKlxuICogQmFzZSBjbGFzcyBmb3IgYm90aCBgSHR0cFJlc3BvbnNlYCBhbmQgYEh0dHBIZWFkZXJSZXNwb25zZWAuXG4gKlxuICogQHB1YmxpY0FwaVxuICovXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgSHR0cFJlc3BvbnNlQmFzZSB7XG4gIC8qKlxuICAgKiBBbGwgcmVzcG9uc2UgaGVhZGVycy5cbiAgICovXG4gIHJlYWRvbmx5IGhlYWRlcnM6IEh0dHBIZWFkZXJzO1xuXG4gIC8qKlxuICAgKiBSZXNwb25zZSBzdGF0dXMgY29kZS5cbiAgICovXG4gIHJlYWRvbmx5IHN0YXR1czogbnVtYmVyO1xuXG4gIC8qKlxuICAgKiBUZXh0dWFsIGRlc2NyaXB0aW9uIG9mIHJlc3BvbnNlIHN0YXR1cyBjb2RlLCBkZWZhdWx0cyB0byBPSy5cbiAgICpcbiAgICogRG8gbm90IGRlcGVuZCBvbiB0aGlzLlxuICAgKi9cbiAgcmVhZG9ubHkgc3RhdHVzVGV4dDogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiBVUkwgb2YgdGhlIHJlc291cmNlIHJldHJpZXZlZCwgb3IgbnVsbCBpZiBub3QgYXZhaWxhYmxlLlxuICAgKi9cbiAgcmVhZG9ubHkgdXJsOiBzdHJpbmcgfCBudWxsO1xuXG4gIC8qKlxuICAgKiBXaGV0aGVyIHRoZSBzdGF0dXMgY29kZSBmYWxscyBpbiB0aGUgMnh4IHJhbmdlLlxuICAgKi9cbiAgcmVhZG9ubHkgb2s6IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIFR5cGUgb2YgdGhlIHJlc3BvbnNlLCBuYXJyb3dlZCB0byBlaXRoZXIgdGhlIGZ1bGwgcmVzcG9uc2Ugb3IgdGhlIGhlYWRlci5cbiAgICovXG4gIC8vIFRPRE8oaXNzdWUvMjQ1NzEpOiByZW1vdmUgJyEnLlxuICByZWFkb25seSB0eXBlITogSHR0cEV2ZW50VHlwZS5SZXNwb25zZSB8IEh0dHBFdmVudFR5cGUuUmVzcG9uc2VIZWFkZXI7XG5cbiAgLyoqXG4gICAqIFN1cGVyLWNvbnN0cnVjdG9yIGZvciBhbGwgcmVzcG9uc2VzLlxuICAgKlxuICAgKiBUaGUgc2luZ2xlIHBhcmFtZXRlciBhY2NlcHRlZCBpcyBhbiBpbml0aWFsaXphdGlvbiBoYXNoLiBBbnkgcHJvcGVydGllc1xuICAgKiBvZiB0aGUgcmVzcG9uc2UgcGFzc2VkIHRoZXJlIHdpbGwgb3ZlcnJpZGUgdGhlIGRlZmF1bHQgdmFsdWVzLlxuICAgKi9cbiAgY29uc3RydWN0b3IoXG4gICAgaW5pdDoge1xuICAgICAgaGVhZGVycz86IEh0dHBIZWFkZXJzO1xuICAgICAgc3RhdHVzPzogbnVtYmVyO1xuICAgICAgc3RhdHVzVGV4dD86IHN0cmluZztcbiAgICAgIHVybD86IHN0cmluZztcbiAgICB9LFxuICAgIGRlZmF1bHRTdGF0dXM6IG51bWJlciA9IDIwMCxcbiAgICBkZWZhdWx0U3RhdHVzVGV4dDogc3RyaW5nID0gJ09LJyxcbiAgKSB7XG4gICAgLy8gSWYgdGhlIGhhc2ggaGFzIHZhbHVlcyBwYXNzZWQsIHVzZSB0aGVtIHRvIGluaXRpYWxpemUgdGhlIHJlc3BvbnNlLlxuICAgIC8vIE90aGVyd2lzZSB1c2UgdGhlIGRlZmF1bHQgdmFsdWVzLlxuICAgIHRoaXMuaGVhZGVycyA9IGluaXQuaGVhZGVycyB8fCBuZXcgSHR0cEhlYWRlcnMoKTtcbiAgICB0aGlzLnN0YXR1cyA9IGluaXQuc3RhdHVzICE9PSB1bmRlZmluZWQgPyBpbml0LnN0YXR1cyA6IGRlZmF1bHRTdGF0dXM7XG4gICAgdGhpcy5zdGF0dXNUZXh0ID0gaW5pdC5zdGF0dXNUZXh0IHx8IGRlZmF1bHRTdGF0dXNUZXh0O1xuICAgIHRoaXMudXJsID0gaW5pdC51cmwgfHwgbnVsbDtcblxuICAgIC8vIENhY2hlIHRoZSBvayB2YWx1ZSB0byBhdm9pZCBkZWZpbmluZyBhIGdldHRlci5cbiAgICB0aGlzLm9rID0gdGhpcy5zdGF0dXMgPj0gMjAwICYmIHRoaXMuc3RhdHVzIDwgMzAwO1xuICB9XG59XG5cbi8qKlxuICogQSBwYXJ0aWFsIEhUVFAgcmVzcG9uc2Ugd2hpY2ggb25seSBpbmNsdWRlcyB0aGUgc3RhdHVzIGFuZCBoZWFkZXIgZGF0YSxcbiAqIGJ1dCBubyByZXNwb25zZSBib2R5LlxuICpcbiAqIGBIdHRwSGVhZGVyUmVzcG9uc2VgIGlzIGEgYEh0dHBFdmVudGAgYXZhaWxhYmxlIG9uIHRoZSByZXNwb25zZVxuICogZXZlbnQgc3RyZWFtLCBvbmx5IHdoZW4gcHJvZ3Jlc3MgZXZlbnRzIGFyZSByZXF1ZXN0ZWQuXG4gKlxuICogQHB1YmxpY0FwaVxuICovXG5leHBvcnQgY2xhc3MgSHR0cEhlYWRlclJlc3BvbnNlIGV4dGVuZHMgSHR0cFJlc3BvbnNlQmFzZSB7XG4gIC8qKlxuICAgKiBDcmVhdGUgYSBuZXcgYEh0dHBIZWFkZXJSZXNwb25zZWAgd2l0aCB0aGUgZ2l2ZW4gcGFyYW1ldGVycy5cbiAgICovXG4gIGNvbnN0cnVjdG9yKFxuICAgIGluaXQ6IHtcbiAgICAgIGhlYWRlcnM/OiBIdHRwSGVhZGVycztcbiAgICAgIHN0YXR1cz86IG51bWJlcjtcbiAgICAgIHN0YXR1c1RleHQ/OiBzdHJpbmc7XG4gICAgICB1cmw/OiBzdHJpbmc7XG4gICAgfSA9IHt9LFxuICApIHtcbiAgICBzdXBlcihpbml0KTtcbiAgfVxuXG4gIG92ZXJyaWRlIHJlYWRvbmx5IHR5cGU6IEh0dHBFdmVudFR5cGUuUmVzcG9uc2VIZWFkZXIgPSBIdHRwRXZlbnRUeXBlLlJlc3BvbnNlSGVhZGVyO1xuXG4gIC8qKlxuICAgKiBDb3B5IHRoaXMgYEh0dHBIZWFkZXJSZXNwb25zZWAsIG92ZXJyaWRpbmcgaXRzIGNvbnRlbnRzIHdpdGggdGhlXG4gICAqIGdpdmVuIHBhcmFtZXRlciBoYXNoLlxuICAgKi9cbiAgY2xvbmUoXG4gICAgdXBkYXRlOiB7aGVhZGVycz86IEh0dHBIZWFkZXJzOyBzdGF0dXM/OiBudW1iZXI7IHN0YXR1c1RleHQ/OiBzdHJpbmc7IHVybD86IHN0cmluZ30gPSB7fSxcbiAgKTogSHR0cEhlYWRlclJlc3BvbnNlIHtcbiAgICAvLyBQZXJmb3JtIGEgc3RyYWlnaHRmb3J3YXJkIGluaXRpYWxpemF0aW9uIG9mIHRoZSBuZXcgSHR0cEhlYWRlclJlc3BvbnNlLFxuICAgIC8vIG92ZXJyaWRpbmcgdGhlIGN1cnJlbnQgcGFyYW1ldGVycyB3aXRoIG5ldyBvbmVzIGlmIGdpdmVuLlxuICAgIHJldHVybiBuZXcgSHR0cEhlYWRlclJlc3BvbnNlKHtcbiAgICAgIGhlYWRlcnM6IHVwZGF0ZS5oZWFkZXJzIHx8IHRoaXMuaGVhZGVycyxcbiAgICAgIHN0YXR1czogdXBkYXRlLnN0YXR1cyAhPT0gdW5kZWZpbmVkID8gdXBkYXRlLnN0YXR1cyA6IHRoaXMuc3RhdHVzLFxuICAgICAgc3RhdHVzVGV4dDogdXBkYXRlLnN0YXR1c1RleHQgfHwgdGhpcy5zdGF0dXNUZXh0LFxuICAgICAgdXJsOiB1cGRhdGUudXJsIHx8IHRoaXMudXJsIHx8IHVuZGVmaW5lZCxcbiAgICB9KTtcbiAgfVxufVxuXG4vKipcbiAqIEEgZnVsbCBIVFRQIHJlc3BvbnNlLCBpbmNsdWRpbmcgYSB0eXBlZCByZXNwb25zZSBib2R5ICh3aGljaCBtYXkgYmUgYG51bGxgXG4gKiBpZiBvbmUgd2FzIG5vdCByZXR1cm5lZCkuXG4gKlxuICogYEh0dHBSZXNwb25zZWAgaXMgYSBgSHR0cEV2ZW50YCBhdmFpbGFibGUgb24gdGhlIHJlc3BvbnNlIGV2ZW50XG4gKiBzdHJlYW0uXG4gKlxuICogQHB1YmxpY0FwaVxuICovXG5leHBvcnQgY2xhc3MgSHR0cFJlc3BvbnNlPFQ+IGV4dGVuZHMgSHR0cFJlc3BvbnNlQmFzZSB7XG4gIC8qKlxuICAgKiBUaGUgcmVzcG9uc2UgYm9keSwgb3IgYG51bGxgIGlmIG9uZSB3YXMgbm90IHJldHVybmVkLlxuICAgKi9cbiAgcmVhZG9ubHkgYm9keTogVCB8IG51bGw7XG5cbiAgLyoqXG4gICAqIENvbnN0cnVjdCBhIG5ldyBgSHR0cFJlc3BvbnNlYC5cbiAgICovXG4gIGNvbnN0cnVjdG9yKFxuICAgIGluaXQ6IHtcbiAgICAgIGJvZHk/OiBUIHwgbnVsbDtcbiAgICAgIGhlYWRlcnM/OiBIdHRwSGVhZGVycztcbiAgICAgIHN0YXR1cz86IG51bWJlcjtcbiAgICAgIHN0YXR1c1RleHQ/OiBzdHJpbmc7XG4gICAgICB1cmw/OiBzdHJpbmc7XG4gICAgfSA9IHt9LFxuICApIHtcbiAgICBzdXBlcihpbml0KTtcbiAgICB0aGlzLmJvZHkgPSBpbml0LmJvZHkgIT09IHVuZGVmaW5lZCA/IGluaXQuYm9keSA6IG51bGw7XG4gIH1cblxuICBvdmVycmlkZSByZWFkb25seSB0eXBlOiBIdHRwRXZlbnRUeXBlLlJlc3BvbnNlID0gSHR0cEV2ZW50VHlwZS5SZXNwb25zZTtcblxuICBjbG9uZSgpOiBIdHRwUmVzcG9uc2U8VD47XG4gIGNsb25lKHVwZGF0ZToge1xuICAgIGhlYWRlcnM/OiBIdHRwSGVhZGVycztcbiAgICBzdGF0dXM/OiBudW1iZXI7XG4gICAgc3RhdHVzVGV4dD86IHN0cmluZztcbiAgICB1cmw/OiBzdHJpbmc7XG4gIH0pOiBIdHRwUmVzcG9uc2U8VD47XG4gIGNsb25lPFY+KHVwZGF0ZToge1xuICAgIGJvZHk/OiBWIHwgbnVsbDtcbiAgICBoZWFkZXJzPzogSHR0cEhlYWRlcnM7XG4gICAgc3RhdHVzPzogbnVtYmVyO1xuICAgIHN0YXR1c1RleHQ/OiBzdHJpbmc7XG4gICAgdXJsPzogc3RyaW5nO1xuICB9KTogSHR0cFJlc3BvbnNlPFY+O1xuICBjbG9uZShcbiAgICB1cGRhdGU6IHtcbiAgICAgIGJvZHk/OiBhbnkgfCBudWxsO1xuICAgICAgaGVhZGVycz86IEh0dHBIZWFkZXJzO1xuICAgICAgc3RhdHVzPzogbnVtYmVyO1xuICAgICAgc3RhdHVzVGV4dD86IHN0cmluZztcbiAgICAgIHVybD86IHN0cmluZztcbiAgICB9ID0ge30sXG4gICk6IEh0dHBSZXNwb25zZTxhbnk+IHtcbiAgICByZXR1cm4gbmV3IEh0dHBSZXNwb25zZTxhbnk+KHtcbiAgICAgIGJvZHk6IHVwZGF0ZS5ib2R5ICE9PSB1bmRlZmluZWQgPyB1cGRhdGUuYm9keSA6IHRoaXMuYm9keSxcbiAgICAgIGhlYWRlcnM6IHVwZGF0ZS5oZWFkZXJzIHx8IHRoaXMuaGVhZGVycyxcbiAgICAgIHN0YXR1czogdXBkYXRlLnN0YXR1cyAhPT0gdW5kZWZpbmVkID8gdXBkYXRlLnN0YXR1cyA6IHRoaXMuc3RhdHVzLFxuICAgICAgc3RhdHVzVGV4dDogdXBkYXRlLnN0YXR1c1RleHQgfHwgdGhpcy5zdGF0dXNUZXh0LFxuICAgICAgdXJsOiB1cGRhdGUudXJsIHx8IHRoaXMudXJsIHx8IHVuZGVmaW5lZCxcbiAgICB9KTtcbiAgfVxufVxuXG4vKipcbiAqIEEgcmVzcG9uc2UgdGhhdCByZXByZXNlbnRzIGFuIGVycm9yIG9yIGZhaWx1cmUsIGVpdGhlciBmcm9tIGFcbiAqIG5vbi1zdWNjZXNzZnVsIEhUVFAgc3RhdHVzLCBhbiBlcnJvciB3aGlsZSBleGVjdXRpbmcgdGhlIHJlcXVlc3QsXG4gKiBvciBzb21lIG90aGVyIGZhaWx1cmUgd2hpY2ggb2NjdXJyZWQgZHVyaW5nIHRoZSBwYXJzaW5nIG9mIHRoZSByZXNwb25zZS5cbiAqXG4gKiBBbnkgZXJyb3IgcmV0dXJuZWQgb24gdGhlIGBPYnNlcnZhYmxlYCByZXNwb25zZSBzdHJlYW0gd2lsbCBiZVxuICogd3JhcHBlZCBpbiBhbiBgSHR0cEVycm9yUmVzcG9uc2VgIHRvIHByb3ZpZGUgYWRkaXRpb25hbCBjb250ZXh0IGFib3V0XG4gKiB0aGUgc3RhdGUgb2YgdGhlIEhUVFAgbGF5ZXIgd2hlbiB0aGUgZXJyb3Igb2NjdXJyZWQuIFRoZSBlcnJvciBwcm9wZXJ0eVxuICogd2lsbCBjb250YWluIGVpdGhlciBhIHdyYXBwZWQgRXJyb3Igb2JqZWN0IG9yIHRoZSBlcnJvciByZXNwb25zZSByZXR1cm5lZFxuICogZnJvbSB0aGUgc2VydmVyLlxuICpcbiAqIEBwdWJsaWNBcGlcbiAqL1xuZXhwb3J0IGNsYXNzIEh0dHBFcnJvclJlc3BvbnNlIGV4dGVuZHMgSHR0cFJlc3BvbnNlQmFzZSBpbXBsZW1lbnRzIEVycm9yIHtcbiAgcmVhZG9ubHkgbmFtZSA9ICdIdHRwRXJyb3JSZXNwb25zZSc7XG4gIHJlYWRvbmx5IG1lc3NhZ2U6IHN0cmluZztcbiAgcmVhZG9ubHkgZXJyb3I6IGFueSB8IG51bGw7XG5cbiAgLyoqXG4gICAqIEVycm9ycyBhcmUgbmV2ZXIgb2theSwgZXZlbiB3aGVuIHRoZSBzdGF0dXMgY29kZSBpcyBpbiB0aGUgMnh4IHN1Y2Nlc3MgcmFuZ2UuXG4gICAqL1xuICBvdmVycmlkZSByZWFkb25seSBvayA9IGZhbHNlO1xuXG4gIGNvbnN0cnVjdG9yKGluaXQ6IHtcbiAgICBlcnJvcj86IGFueTtcbiAgICBoZWFkZXJzPzogSHR0cEhlYWRlcnM7XG4gICAgc3RhdHVzPzogbnVtYmVyO1xuICAgIHN0YXR1c1RleHQ/OiBzdHJpbmc7XG4gICAgdXJsPzogc3RyaW5nO1xuICB9KSB7XG4gICAgLy8gSW5pdGlhbGl6ZSB3aXRoIGEgZGVmYXVsdCBzdGF0dXMgb2YgMCAvIFVua25vd24gRXJyb3IuXG4gICAgc3VwZXIoaW5pdCwgMCwgJ1Vua25vd24gRXJyb3InKTtcblxuICAgIC8vIElmIHRoZSByZXNwb25zZSB3YXMgc3VjY2Vzc2Z1bCwgdGhlbiB0aGlzIHdhcyBhIHBhcnNlIGVycm9yLiBPdGhlcndpc2UsIGl0IHdhc1xuICAgIC8vIGEgcHJvdG9jb2wtbGV2ZWwgZmFpbHVyZSBvZiBzb21lIHNvcnQuIEVpdGhlciB0aGUgcmVxdWVzdCBmYWlsZWQgaW4gdHJhbnNpdFxuICAgIC8vIG9yIHRoZSBzZXJ2ZXIgcmV0dXJuZWQgYW4gdW5zdWNjZXNzZnVsIHN0YXR1cyBjb2RlLlxuICAgIGlmICh0aGlzLnN0YXR1cyA+PSAyMDAgJiYgdGhpcy5zdGF0dXMgPCAzMDApIHtcbiAgICAgIHRoaXMubWVzc2FnZSA9IGBIdHRwIGZhaWx1cmUgZHVyaW5nIHBhcnNpbmcgZm9yICR7aW5pdC51cmwgfHwgJyh1bmtub3duIHVybCknfWA7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMubWVzc2FnZSA9IGBIdHRwIGZhaWx1cmUgcmVzcG9uc2UgZm9yICR7aW5pdC51cmwgfHwgJyh1bmtub3duIHVybCknfTogJHtpbml0LnN0YXR1c30gJHtcbiAgICAgICAgaW5pdC5zdGF0dXNUZXh0XG4gICAgICB9YDtcbiAgICB9XG4gICAgdGhpcy5lcnJvciA9IGluaXQuZXJyb3IgfHwgbnVsbDtcbiAgfVxufVxuXG4vKipcbiAqIFdlIHVzZSB0aGVzZSBjb25zdGFudCB0byBwcmV2ZW50IHB1bGxpbmcgdGhlIHdob2xlIEh0dHBTdGF0dXNDb2RlIGVudW1cbiAqIFRob3NlIGFyZSB0aGUgb25seSBvbmVzIHJlZmVyZW5jZWQgZGlyZWN0bHkgYnkgdGhlIGZyYW1ld29ya1xuICovXG5leHBvcnQgY29uc3QgSFRUUF9TVEFUVVNfQ09ERV9PSyA9IDIwMDtcbmV4cG9ydCBjb25zdCBIVFRQX1NUQVRVU19DT0RFX05PX0NPTlRFTlQgPSAyMDQ7XG5cbi8qKlxuICogSHR0cCBzdGF0dXMgY29kZXMuXG4gKiBBcyBwZXIgaHR0cHM6Ly93d3cuaWFuYS5vcmcvYXNzaWdubWVudHMvaHR0cC1zdGF0dXMtY29kZXMvaHR0cC1zdGF0dXMtY29kZXMueGh0bWxcbiAqIEBwdWJsaWNBcGlcbiAqL1xuZXhwb3J0IGVudW0gSHR0cFN0YXR1c0NvZGUge1xuICBDb250aW51ZSA9IDEwMCxcbiAgU3dpdGNoaW5nUHJvdG9jb2xzID0gMTAxLFxuICBQcm9jZXNzaW5nID0gMTAyLFxuICBFYXJseUhpbnRzID0gMTAzLFxuXG4gIE9rID0gSFRUUF9TVEFUVVNfQ09ERV9PSyxcbiAgQ3JlYXRlZCA9IDIwMSxcbiAgQWNjZXB0ZWQgPSAyMDIsXG4gIE5vbkF1dGhvcml0YXRpdmVJbmZvcm1hdGlvbiA9IDIwMyxcbiAgTm9Db250ZW50ID0gSFRUUF9TVEFUVVNfQ09ERV9OT19DT05URU5ULFxuICBSZXNldENvbnRlbnQgPSAyMDUsXG4gIFBhcnRpYWxDb250ZW50ID0gMjA2LFxuICBNdWx0aVN0YXR1cyA9IDIwNyxcbiAgQWxyZWFkeVJlcG9ydGVkID0gMjA4LFxuICBJbVVzZWQgPSAyMjYsXG5cbiAgTXVsdGlwbGVDaG9pY2VzID0gMzAwLFxuICBNb3ZlZFBlcm1hbmVudGx5ID0gMzAxLFxuICBGb3VuZCA9IDMwMixcbiAgU2VlT3RoZXIgPSAzMDMsXG4gIE5vdE1vZGlmaWVkID0gMzA0LFxuICBVc2VQcm94eSA9IDMwNSxcbiAgVW51c2VkID0gMzA2LFxuICBUZW1wb3JhcnlSZWRpcmVjdCA9IDMwNyxcbiAgUGVybWFuZW50UmVkaXJlY3QgPSAzMDgsXG5cbiAgQmFkUmVxdWVzdCA9IDQwMCxcbiAgVW5hdXRob3JpemVkID0gNDAxLFxuICBQYXltZW50UmVxdWlyZWQgPSA0MDIsXG4gIEZvcmJpZGRlbiA9IDQwMyxcbiAgTm90Rm91bmQgPSA0MDQsXG4gIE1ldGhvZE5vdEFsbG93ZWQgPSA0MDUsXG4gIE5vdEFjY2VwdGFibGUgPSA0MDYsXG4gIFByb3h5QXV0aGVudGljYXRpb25SZXF1aXJlZCA9IDQwNyxcbiAgUmVxdWVzdFRpbWVvdXQgPSA0MDgsXG4gIENvbmZsaWN0ID0gNDA5LFxuICBHb25lID0gNDEwLFxuICBMZW5ndGhSZXF1aXJlZCA9IDQxMSxcbiAgUHJlY29uZGl0aW9uRmFpbGVkID0gNDEyLFxuICBQYXlsb2FkVG9vTGFyZ2UgPSA0MTMsXG4gIFVyaVRvb0xvbmcgPSA0MTQsXG4gIFVuc3VwcG9ydGVkTWVkaWFUeXBlID0gNDE1LFxuICBSYW5nZU5vdFNhdGlzZmlhYmxlID0gNDE2LFxuICBFeHBlY3RhdGlvbkZhaWxlZCA9IDQxNyxcbiAgSW1BVGVhcG90ID0gNDE4LFxuICBNaXNkaXJlY3RlZFJlcXVlc3QgPSA0MjEsXG4gIFVucHJvY2Vzc2FibGVFbnRpdHkgPSA0MjIsXG4gIExvY2tlZCA9IDQyMyxcbiAgRmFpbGVkRGVwZW5kZW5jeSA9IDQyNCxcbiAgVG9vRWFybHkgPSA0MjUsXG4gIFVwZ3JhZGVSZXF1aXJlZCA9IDQyNixcbiAgUHJlY29uZGl0aW9uUmVxdWlyZWQgPSA0MjgsXG4gIFRvb01hbnlSZXF1ZXN0cyA9IDQyOSxcbiAgUmVxdWVzdEhlYWRlckZpZWxkc1Rvb0xhcmdlID0gNDMxLFxuICBVbmF2YWlsYWJsZUZvckxlZ2FsUmVhc29ucyA9IDQ1MSxcblxuICBJbnRlcm5hbFNlcnZlckVycm9yID0gNTAwLFxuICBOb3RJbXBsZW1lbnRlZCA9IDUwMSxcbiAgQmFkR2F0ZXdheSA9IDUwMixcbiAgU2VydmljZVVuYXZhaWxhYmxlID0gNTAzLFxuICBHYXRld2F5VGltZW91dCA9IDUwNCxcbiAgSHR0cFZlcnNpb25Ob3RTdXBwb3J0ZWQgPSA1MDUsXG4gIFZhcmlhbnRBbHNvTmVnb3RpYXRlcyA9IDUwNixcbiAgSW5zdWZmaWNpZW50U3RvcmFnZSA9IDUwNyxcbiAgTG9vcERldGVjdGVkID0gNTA4LFxuICBOb3RFeHRlbmRlZCA9IDUxMCxcbiAgTmV0d29ya0F1dGhlbnRpY2F0aW9uUmVxdWlyZWQgPSA1MTEsXG59XG4iXX0=