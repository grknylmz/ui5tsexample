export class Constants {
    static readonly API_BASE_URL: string = "/api/";
    static readonly REFRESH_DOCUMENTS_INTERVAL = 10000; //10 seconds
    static readonly GROUP_HEADER_FIELDS = "headerFields";
    static readonly GROUP_LINE_ITME_FIELDS = "lineItemFields";
    static readonly UPLOAD_FILE_SIZE_LIMIT = 50; //50 MB
    static readonly UPLOAD_FILE_COUNT_LIMIT = 50;
    static readonly UPLOAD_CONCURRENCY = 5; //max num of files upload at same time
    static readonly VALID_FILE_TYPES = ['pdf', 'jpg', 'jpeg', 'png', 'tif', 'tiff'];
    static readonly FEATURE_NOT_ENABLED_STATUS_CODE = 404;
    static CLIENT_ID = "c_00"; //This value will always contains  latest user choice of client id
    static readonly DEFAULT_LANGUAGE = "en";
    static readonly DEFAULT_FILE_TYPE = "application/pdf";
    static readonly SUPPORTED_THEMES = [
        'sap_fiori_3',
        'sap_fiori_3_hcb',
        'sap_fiori_3_hcw'
    ]
    static readonly EMPTY_VALUE_PLACEHOLDER = "<EMPTY_VALUE>"
    static readonly EMPTY_VALUE_PLACEHOLDER_TEXT = "Empty value"
    static readonly ALLOWED_CHARS = /^[a-zA-Z0-9_,-.&$#~]+$/;
}
