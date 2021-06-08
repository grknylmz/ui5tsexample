export interface IAjaxPayload<T> {
    data: T;
    status: JQuery.Ajax.SuccessTextStatus;
    xhr: JQuery.jqXHR<any>;
}

export enum HttpMethod {
    GET = "GET",
    POST = "POST",
    PUT = "PUT",
    PATCH = "PATCH",
    DELETE = "DELETE",
}

export enum ContentType {
    APPLICATION_JSON = "application/json",
    APPLICATION_OCTET_STREAM = "application/octet-stream",
}

export enum DataType {
    JSON = "json",
}

export class ServiceCall {

    /**
     * http request.
     * @param ajaxOptions Ajax options.
     *    url
     *    [methoid="GET"]
     *    [contentType="application/json"]
     *    [dataType="json"]
     *    [headers]
     *    ...
     */
    public static request<T>(ajaxOptions: JQueryAjaxSettings): Promise<IAjaxPayload<T>> {
        return new Promise((resolve, reject) => {
            this.addDefaults(ajaxOptions);

            ServiceCall.addFunction(ajaxOptions, "success", function(data: T, status, xhr) {
                resolve({data, status, xhr});
            });

            ServiceCall.addFunction(ajaxOptions, "error", function(xhr, textStatus, errorThrown) {
                if (xhr.status === 401) {
                    sap.m.URLHelper.redirect("/logout");
                } else if (xhr.status === 403) {
                    sap.ui.getCore().getEventBus().publish(
                        "security",
                        "permissionDenied",
                        {url: ajaxOptions.url, method: ajaxOptions.method});
                } else {
                    reject(arguments); // [xhr, textStatus, errorThrown]
                }
            });
            // every service call must go through here
            // tslint:disable-next-line:ban
            $.ajax(ajaxOptions);
        }).then(({data, status, xhr}) => {
            // we do it here, since otherwise cypress gets the wrong window
            return {data, status, xhr};
        });
    }

    /**
     * http GET request.
     * @param url The URL.
     * @param [ajaxOptions] The AJAX options.
     */
    public static get<T>(url: string, ajaxOptions?: JQueryAjaxSettings): Promise<IAjaxPayload<T>> {
        ajaxOptions = {
            ...ajaxOptions,
            url,
            method: HttpMethod.GET,
        };
        return ServiceCall.request(ajaxOptions);
    }

    /**
     * http POST request.
     * @param url The URL.
     * @param [data] The data.
     * @param [ajaxOptions] The AJAX options.
     */
    public static post<T>(url: string, ajaxOptions?: JQueryAjaxSettings, data?: any): Promise<IAjaxPayload<T>> {
        return ServiceCall.request({
            ...ajaxOptions,
            url,
            method: HttpMethod.POST,
            data,
        });
    }

    /**
     * http PUT request.
     * @param url The URL.
     * @param [data] The data.
     * @param [ajaxOptions] The AJAX options.
     */
    public static put<T>(url: string, ajaxOptions?: JQueryAjaxSettings, data?: any): Promise<IAjaxPayload<T>> {
        return ServiceCall.request({
            ...ajaxOptions,
            url,
            method: HttpMethod.PUT,
            data,
        });
    }

    /**
     * http PATCH request.
     * @param url The URL.
     * @param [data] The data.
     * @param [ajaxOptions] The AJAX options.
     */
    public static patch<T>(url: string, ajaxOptions?: JQueryAjaxSettings, data?: any): Promise<IAjaxPayload<T>> {
        return ServiceCall.request({
            ...ajaxOptions,
            url,
            method: HttpMethod.PATCH,
            data,
        });
    }

    /**
     * http DELETE request.
     * @param url The URL.
     * @param [ajaxOptions] The AJAX options.
     */
    public static delete<T>(url: string, ajaxOptions?: JQueryAjaxSettings): Promise<IAjaxPayload<T>> {
        return ServiceCall.request({
            ...ajaxOptions,
            url,
            method: HttpMethod.DELETE,
        });
    }

    private static addFunction(ajaxOptions: JQueryAjaxSettings, prop: string, func: any): void {
        if (ajaxOptions[prop]) {
            const a = [];
            a.push(func);
            a.push(ajaxOptions[prop]);
            ajaxOptions[prop] = a;
        } else {
            ajaxOptions[prop] = func;
        }
    }

    private static addDefaults(ajaxOptions: JQueryAjaxSettings): void {
        // Check method
        if (!ajaxOptions.method) {
            if (ajaxOptions.type) {
                // type is obsolate
                ajaxOptions.method = ajaxOptions.type;
                delete ajaxOptions.type;
            }
        }
        // Set default contentType
        if (!ajaxOptions.contentType || (ajaxOptions.headers && !ajaxOptions.headers.contentType)) {
            ajaxOptions.contentType = ContentType.APPLICATION_JSON;
        }

        // Set default dataType
        if (!ajaxOptions.dataType || (ajaxOptions.headers && !ajaxOptions.headers.accept)) {
            ajaxOptions.dataType = DataType.JSON;
        }

        // set default timeout
        if (!ajaxOptions.timeout) {
            ajaxOptions.timeout = 60000;
        }

        // Set default X-CSRF-Token
        if (["POST", "PUT", "DELETE", "PATCH"].includes(ajaxOptions.method)) {
            if (ajaxOptions.headers === undefined) {
                ajaxOptions.headers = {};
            }
            ajaxOptions.headers["X-CSRF-Token"] = localStorage.getItem("csrf_token");
        }
    }
}
