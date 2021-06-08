import {
    BaseController,
    BaseControllerClass,
    smartExtend
} from "../../basecomponent/controller/BaseController.controller";
import {InvoiceViewerComponentClass} from "../Component";
import {Logger} from "../../reuse/utility/Helper";
import {Constants} from "../../reuse/utility/Constants";
import {capabilityLabelFormatter, capabilityDescriptionFormatter, documentTypeFormatter} from "../../reuse/utility/Formatter";
import {DoxClient} from "../../reuse/utility/DoxClient"
import * as R from "ramda";
import {get} from 'lodash';

class UploadDocumentControllerClass extends BaseControllerClass {
    protected oRouter: sap.ui.core.routing.Router;
    protected oModel: any;
    protected _wizard: any;
    protected _oNavContainer: any;
    protected _oWizardContentPage: any;
    protected model: any;
    protected _oWizardReviewPage: any;
    protected documentType: any;
    protected selectedHeaderFields: any;
    protected selectedLineItemColumns: any;
    protected _extraction: any;
    protected oResourceBundle: any;
    protected _timeId: any;
    protected toUploadItemsClone = [];
    protected supportedExtractionFields: any;
    protected templateNames = [];
    protected templateId = "";
    protected bTemplateEnabled = false;
    static readonly CSRF_HEADER = "X-Csrf-Token";
    static readonly ERR_FILE_CNT_KEY = "/errorFilesCount";
    static readonly SELECT_COUNT_KEY = "/selectedCount";
    static readonly SELECT_DOCUMENT_TYPE = "/selectedDocumentType";
    static readonly SELECT_ERR_FILE_SZ_CNT_KEY = "/selectedErrorFileSzCount";
    static readonly SELECT_ERR_FILE_TYPE_CNT = "/selectedErrorFileTypeCount";
    static readonly TEMPLATE_ENABLED_KEY = "/bTemplateEnabled";


    getFileUploader() {
        // @ts-ignore
        const DoxUploader = new sap.m.upload.Uploader.extend('sap.dox.CustomUploader', {
            metadata: {}
        });

        DoxUploader.prototype.setDoxUploadOptions = function (data) {
            Logger.logInfo("setDoxOptions");
            this.doxUploadOptions = data;
        };

        DoxUploader.prototype.uploadItem = function (oItem, aHeaders) {
            Logger.logInfo(`uploadItem: ${this.doxUploadOptions}`);
            this.fireUploadStarted({item: oItem});
            this.setUploadUrl("/api/document/jobs");

            // @ts-ignore
            const oXhr = new window.XMLHttpRequest(),
                that = this, //note: store this in that for later reference, this is from sample UI5 code
                oRequestHandler = {
                    xhr: oXhr,
                    item: oItem
                };

            oXhr.open("POST", this.getUploadUrl(), true);

            if (aHeaders) {
                aHeaders.forEach(function (oHeader) {
                    oXhr.setRequestHeader(oHeader.getKey(), oHeader.getText());
                });
            }

            if (this.doxUploadOptions && this.doxUploadOptions.settings) {
                if (this.doxUploadOptions.settings['headers'] && this.doxUploadOptions.settings['headers'][UploadDocumentControllerClass.CSRF_HEADER]) {
                    oXhr.setRequestHeader(UploadDocumentControllerClass.CSRF_HEADER, this.doxUploadOptions.settings['headers'][UploadDocumentControllerClass.CSRF_HEADER]);
                    Logger.logInfo("csrf token set");
                }
            }

            oXhr.upload.addEventListener("progress", function (oEvent) {
                that.fireUploadProgressed({
                    item: oItem,
                    loaded: oEvent.loaded,
                    total: oEvent.total,
                    aborted: false
                });
            });

            oXhr.onreadystatechange = function () {
                const oHandler = that._mRequestHandlers[oItem.getId()];
                // @ts-ignore
                if (this.readyState === window.XMLHttpRequest.DONE && !oHandler.aborted) {
                    that.fireUploadCompleted({
                        item: oItem, status: this.status, statusText: this.statusText,
                        responseText: this.responseText
                    });
                }
            };

            this._mRequestHandlers[oItem.getId()] = oRequestHandler;
            const formData = new FormData();

            formData.append("options", this.doxUploadOptions.optionsStr);
            formData.append("file", oItem.getFileObject());

            oXhr.send(formData);

            this.fireUploadStarted({item: oItem});

        }

        return new DoxUploader();
    }

    onFileUploadEnd(oEvent) {
        const item = oEvent.getParameters().item,
            status = oEvent.getParameters().status,
            statusText = oEvent.getParameters().statusText,
            responseText = oEvent.getParameters().responseText;
        Logger.logInfo(`onFileUploadEnd, state: ${item.getUploadState()}, status: ${status}, statusText: ${statusText}`);

        this.handleUploadResponse(status, responseText, statusText, item);

        const uploadModel = this.getOwnerComponent().getModel('uploadItems');
        let errorFileCount = 0;
        // @ts-ignore
        for (const _itm of sap.ui.getCore().byId("UploadSet2").getIncompleteItems()) {
            // @ts-ignore
            if (_itm && _itm.getUploadState() === sap.m.UploadState.Error) {
                errorFileCount++;
            }
        }
        uploadModel.setProperty(UploadDocumentControllerClass.ERR_FILE_CNT_KEY, errorFileCount);

        this.handleUploadPostProcess();
    }

    private handleUploadPostProcess() {
        const uploadSet2 = sap.ui.getCore().byId("UploadSet2") as any;
        const oItems = uploadSet2.getIncompleteItems() || [];
        let bFinished = true, bHasError = false;
        for (let i = 0; i < oItems.length; i++) {
            // @ts-ignore
            if (oItems[i].getUploadState() === sap.m.UploadState.Ready) {
                uploadSet2.uploadItem(oItems[i]);
                Logger.logInfo(`started uploading next item, i = ${i}`);
                bFinished = false;
                break;
                // @ts-ignore
            } else if (oItems[i].getUploadState() === sap.m.UploadState.Uploading) {
                bFinished = false;
                // @ts-ignore
            } else if (oItems[i].getUploadState() === sap.m.UploadState.Error) {
                bHasError = true;
            }
        }

        for (const i of uploadSet2.getItems()) {
            i.setVisibleEdit(false);
        }

        this.showErrorOrSendNotification(bHasError, bFinished);
    }

    private showErrorOrSendNotification(bHasError: boolean, bFinished: boolean) {
        if (bHasError) {
            (sap.ui.getCore().byId("btnReviewRetry") as sap.m.Button).setVisible(true);
            (sap.ui.getCore().byId("cfmUpdBtn") as sap.m.Button).setVisible(false);
        }

        if (bFinished) {
            (sap.ui.getCore().byId("reviewBar") as any).setBusy(false);
            sap.ui.getCore().getEventBus().publish(
                'InvoiceViewerChannel',
                'DocumentUpload',
                {'msg': 'Document uploaded'});
        }
        if (bFinished && !bHasError) {
            sap.m.MessageToast.show("All selected file(s) are uploaded", {
                duration: 2000,
                closeOnBrowserNavigation: false
            });
            this.handleUploadDocumentCancel();
        }
    }

    private handleUploadResponse(status, responseText, statusText, item) {
        if (status < 200 || status >= 300) {
            const oStatus = new sap.m.ObjectStatus();
            let errorCode = null, errorMsg = null;
            if (responseText) {
                try {
                    const responseJson = JSON.parse(responseText);
                    errorMsg = responseJson.error.message;
                    errorCode = responseJson.error.code; //not always available
                } catch (e) {
                    Logger.logInfo("Error getting error message, use status text;", e);
                    errorCode = errorMsg = null;
                }
            }
            if (errorMsg) {
                // @ts-ignore
                oStatus.setActive(true).setTitle(this.decodeLabel("lb_upload_status"))
                    .setText(`Error - ${errorMsg} (Code: ${errorCode || status})`)
                    .setState(sap.ui.core.ValueState.Error);
            } else {
                // @ts-ignore
                oStatus.setActive(true).setTitle(this.decodeLabel("lb_upload_status")).setText(`Error - ${statusText} (Code: ${status})`)
                    .setState(sap.ui.core.ValueState.Error);
            }
            item.destroyStatuses().addStatus(oStatus);
            // @ts-ignore
            item.setUploadState(sap.m.UploadState.Error);
        } else {
            // @ts-ignore
            item.setUploadState(sap.m.UploadState.Complete);
        }
    }

    onInit() {
        this.oRouter = (this.getOwnerComponent() as InvoiceViewerComponentClass).getRouter();
        this.oModel = this.getOwnerComponent().getModel();
        this._wizard = this.byId("DocumentUploadWizard");
        this._oNavContainer = this.byId("wizardNavContainer");
        this._oWizardContentPage = this.byId("wizardContentPage");
        this.oResourceBundle = this.getView().getModel('i18n');

        this.supportedExtractionFields = this.getOwnerComponent().getModel("supportedExtractionFields").getObject("/");

        this.model = new sap.ui.model.json.JSONModel();
        this.model.setData({});
        this.getView().setModel(this.model);
        this.model.setProperty("/selectedHeaderFields", []);
        this.model.setProperty("/selectedLineItemColumns", []);

        this.bTemplateEnabled = false;
        this.model.setProperty(UploadDocumentControllerClass.TEMPLATE_ENABLED_KEY, false);

        sap.ui.core.Fragment.load({
            name: "sap.bdp.components.invoiceviewer.view.ReviewPage",
            controller: this
        }).then(function (oWizardReviewPage) {
            this._oWizardReviewPage = oWizardReviewPage;
            this._oNavContainer.addPage(this._oWizardReviewPage);

            const uploadSet2 = sap.ui.getCore().byId("UploadSet2") as any;

            const oCustomUploader = this.getFileUploader();

            uploadSet2.setUploader(oCustomUploader);
            uploadSet2.registerUploaderEvents(oCustomUploader);

            oCustomUploader.attachUploadCompleted(null, this.onFileUploadEnd, this);
            oCustomUploader.attachUploadAborted(null, this.onFileUploadEnd, this);

            uploadSet2.getDefaultFileUploader().setMultiple(true);
            uploadSet2.getDefaultFileUploader().setFileType(Constants.VALID_FILE_TYPES);
            uploadSet2.getDefaultFileUploader().setVisible(false);

            uploadSet2.attachBeforeItemAdded(null, this.onBeforeItemAdded, this);

        }.bind(this));

        const uploadSet = this.byId('UploadSet') as any;
        const oCustomUploader = this.getFileUploader();

        uploadSet.setUploader(oCustomUploader);

        uploadSet.getDefaultFileUploader().setMultiple(true);
        uploadSet.getDefaultFileUploader().setFileType(Constants.VALID_FILE_TYPES);
        uploadSet.getDefaultFileUploader().setStyle("Emphasized");
        uploadSet.getDefaultFileUploader().setIconOnly(true);
        uploadSet.getDefaultFileUploader().setIconFirst(true);

        uploadSet.attachFileSizeExceeded(null, this.onFileSizeExceeded, this);

        this.getOwnerComponent().setModel(new sap.ui.model.json.JSONModel(), 'uploadItems');
        this.getOwnerComponent().getModel('uploadItems').setProperty(UploadDocumentControllerClass.SELECT_COUNT_KEY, 0);
        this.getOwnerComponent().getModel('uploadItems').setProperty(UploadDocumentControllerClass.SELECT_DOCUMENT_TYPE, "invoice");

        sap.ui.getCore().getEventBus().subscribe(
            'InvoiceViewerChannel',
            'ResetUploadFiles',
            this.onResetValues,
            this);
    }

    setTemplateNamesForDocType(docType = "invoice", language = "en") {
        if (this.bTemplateEnabled) {
            //cache by docType & language for performance (future work)
            let names = (this.templateNames || []).filter(item => {
                return item.documentType === docType && item.isActive;
            });
            names.forEach(item => {
                item.GroupName = "Templates";
            });
            if (names.length > 0) {
                names = [{GroupName: "", id: "detect", name: "Detect automatically"}].concat(names);
            }
            this.getView().setModel(new sap.ui.model.json.JSONModel(names), "templateNames");
        }
    }

    retryFailedDocs(oEvent) {
        const uploadSet2 = sap.ui.getCore().byId("UploadSet2") as any;
        const oItems = uploadSet2.getIncompleteItems() || [];

        for (const _item of oItems) {
            // @ts-ignore
            if (_item.getUploadState() === sap.m.UploadState.Error) {
                // @ts-ignore
                _item.setUploadState(sap.m.UploadState.Ready);
            }
        }

        this.uploadHandler();
    }

    onUploadDone(oEvent) {
        const uploadItem = oEvent.getParameters().item;
        Logger.logInfo(`onUploadDone, updateState: ${uploadItem.getUploadState()}`);
        const oStatus = new sap.m.ObjectStatus();
        // @ts-ignore
        if (uploadItem.getUploadState() === sap.m.UploadState.Error) {

            // @ts-ignore
            oStatus.setActive(true).setTitle(this.decodeLabel("lb_upload_status")).setText("Error")
                .setState(sap.ui.core.ValueState.Error);
        } else {
            // @ts-ignore
            oStatus.setActive(true).setTitle(this.decodeLabel("lb_upload_status")).setText("Success")
                .setState(sap.ui.core.ValueState.Success);
        }
        uploadItem.setVisibleEdit(false);
        uploadItem.destroyStatuses().addStatus(oStatus);
    }

    onBeforeItemAdded(oEvt: sap.ui.base.Event) {
        oEvt.cancelBubble();
        oEvt.preventDefault();
    }

    onUploadTerminated(oEvent) {
        const uploadItem = oEvent.getParameters().item;
        const oStatus = new sap.m.ObjectStatus();
        // @ts-ignore
        oStatus.setActive(true).setTitle(this.decodeLabel("lb_upload_status")).setText("Terminated")
            .setState(sap.ui.core.ValueState.Error);
        uploadItem.destroyStatuses().addStatus(oStatus);
    }

    onFileSizeExceeded(oEvent) {
        const uploadItem = oEvent.getParameters().item;
        const oStatus = new sap.m.ObjectStatus();
        // @ts-ignore
        oStatus.setActive(false).setTitle("File Size Error")
            .setText(`Exceeded limit of ${Constants.UPLOAD_FILE_SIZE_LIMIT} MB`)
            .setState(sap.ui.core.ValueState.Error);
        uploadItem.addStatus(oStatus);
        oEvent.bCancelBubble = false;
        this._wizard.invalidateStep(this.byId("SelectFileStep"));
    }

    getSelectedFilesCount() {
        const uploadSet = this.byId('UploadSet') as any;
        return uploadSet.getIncompleteItems().length;
    }

    validateFiles(uploadSet: any) {
        // @ts-ignore
        const fileCount = uploadSet.getIncompleteItems().length;
        // @ts-ignore
        const errorFileSzCount = uploadSet.getIncompleteItems().filter(item => {
            return item && item.getStatuses().length > 0 &&
                //@ts-ignore
                item.getStatuses().some((s) => {
                    return s.getState() === sap.ui.core.ValueState.Error
                        && (s.getTitle() || '').indexOf("File Size") >= 0
                })
        }).length;

        // @ts-ignore
        const errorFileTypeCount = uploadSet.getIncompleteItems().filter(item => {
            return item && item.getStatuses().length > 0 &&
                //@ts-ignore
                item.getStatuses().some((s) => {
                    return s.getState() === sap.ui.core.ValueState.Error
                        && (s.getTitle() || '').indexOf("File Type") >= 0
                });
        }).length;

        this.getOwnerComponent().getModel('uploadItems')
            .setProperty(UploadDocumentControllerClass.SELECT_COUNT_KEY, fileCount);
        this.getOwnerComponent().getModel('uploadItems')
            .setProperty(UploadDocumentControllerClass.SELECT_ERR_FILE_SZ_CNT_KEY, errorFileSzCount);
        this.getOwnerComponent().getModel('uploadItems')
            .setProperty(UploadDocumentControllerClass.SELECT_ERR_FILE_TYPE_CNT, errorFileTypeCount);

        return [fileCount, errorFileSzCount, errorFileTypeCount];
    }

    onUploadItemsChange() {

        const [fileCount, errorFileSzCount, errorFileTypeCount] = this.validateFiles(this.byId('UploadSet'));

        if (fileCount <= 0 || fileCount > Constants.UPLOAD_FILE_COUNT_LIMIT || errorFileSzCount > 0 || errorFileTypeCount > 0) {
            this._wizard.invalidateStep(this.byId("SelectFileStep"));
        } else {
            this._wizard.validateStep(this.byId("SelectFileStep"));
        }
    }

    uploadItemAdded(oEvent) {
        const item = oEvent.getParameters().item;
        item.attachModelContextChange(null, this.onUploadItemsChange, this);
        item.setVisibleEdit(false);
        const f = item.getFileObject();
        if (item.getAttributes().length === 0) {
            const attr = new sap.m.ObjectAttribute();
            // @ts-ignore
            attr.setTitle('File Size');
            attr.setText(`${Math.round((f.size / 1024.0 / 1024.0 + Number.EPSILON) * 100) / 100} MB`);
            // @ts-ignore
            attr.setActive(false);
            item.addAttribute(attr);
        }

        if (!Constants.VALID_FILE_TYPES.some((fileType) => {
            return item.getFileName().toLowerCase().endsWith(`.${fileType}`);
        })) {
            const oStatus = new sap.m.ObjectStatus();
            // @ts-ignore
            oStatus.setActive(false).setTitle("File Type Error")
                .setText(`Supported types are ${Constants.VALID_FILE_TYPES.join(', ')}.`)
                .setState(sap.ui.core.ValueState.Error);
            item.addStatus(oStatus);
        }

        this.onUploadItemsChange();
    }

    onValidateStep1(oEvent) {
        var aFieldGroup = oEvent.getParameters().fieldGroupIds;
        if (aFieldGroup.indexOf("MyGroup") > -1) {
            //do validation
            oEvent.bCancelBubble = false; //stop bubbling to the parent control
        }
    }

    onAfterRendering(): void {
        this.onResetValues();
        // following is for firefox
        window.setTimeout(function () {
            sap.ui.getCore().getEventBus().publish(
                'InvoiceViewerChannel',
                'ResetUploadFiles',
                {});
        }, 500);
    }

    /**
     * Load the previously submitted header & line item fields selection for the document type
     * @param documentType
     */
    loadPreviousOptions(documentType) {
        try {
            const optionsStr = localStorage.getItem(`upload_options${documentType ? documentType : ""}`);
            if (optionsStr) {
                const options = JSON.parse(optionsStr);

                this.loadFieldsOption(options, "HeaderFieldsTable", "headerFields");

                this.loadFieldsOption(options, "LineItemsTable", "lineItemFields");
            }
        } catch (e) {
            Logger.logError(e);
        }
    }

    private loadFieldsOption(options, tableName, fieldsName) {
        const table = this.byId(tableName) as sap.ui.table.Table;
        const selections = [];
        const rows = table.getRows();
        for (let _idx = 0; _idx < rows.length; _idx++) {
            if (options.extraction[fieldsName].indexOf(rows[_idx].getCells()[0].getCustomData()[0].getValue()) >= 0) {
                selections.push(_idx);
            }
        }
        if (selections.length > 0) {
            table.clearSelection();
            for (const idx of selections) {
                table.addSelectionInterval(idx, idx);
            }
        }
    }

    /**
     * When reset, system start over again by reset file upload component and document type,
     * reload previous used header & line items fields
     * @param sChannelId
     * @param sEventId
     * @param sData
     */
    onResetValues(sChannelId?, sEventId?, sData?) {
        this.getOwnerComponent().getModel('uploadItems').setProperty(UploadDocumentControllerClass.SELECT_DOCUMENT_TYPE, "invoice");
        (this.byId('templateId') as any).setSelectedKey("");
        this.setTemplateNamesForDocType("invoice");
        this.loadPreviousOptions("");
        this.changeWizardByDocType("invoice");
        (this.byId("UploadSet") as any).destroyIncompleteItems().destroyItems();

        const uploadModel = this.getOwnerComponent().getModel('uploadItems') as sap.ui.model.json.JSONModel;
        if (uploadModel) {
            uploadModel.setProperty(UploadDocumentControllerClass.ERR_FILE_CNT_KEY, 0);
            uploadModel.setProperty(UploadDocumentControllerClass.SELECT_COUNT_KEY, 0);
            uploadModel.setProperty(UploadDocumentControllerClass.SELECT_ERR_FILE_SZ_CNT_KEY, 0);
            uploadModel.setProperty(UploadDocumentControllerClass.SELECT_ERR_FILE_TYPE_CNT, 0);
        }
        ['lkStep1', 'lkStep2', 'lkStep3', 'cfmUpdBtn'].forEach((s) => {
            const element = sap.ui.getCore().byId(s) as any;
            if (element) {
                element.setEnabled(true);
            }
        });
        (sap.ui.getCore().byId("btnReviewRetry") as sap.m.Button).setVisible(false);
        (sap.ui.getCore().byId("cfmUpdBtn") as sap.m.Button).setVisible(true);
        DoxClient.getTemplateInfoById().then((data: any) => {
            this.templateNames = (data && data.results) || [];
            if (this.templateNames && this.templateNames.length > 0) {
                this.bTemplateEnabled = true;
                this.model.setProperty(UploadDocumentControllerClass.TEMPLATE_ENABLED_KEY, true);
            }
        }).finally(() => this.setTemplateNamesForDocType("invoice"));
    }

    decodeLabel(key) {
        this.oResourceBundle = this.oResourceBundle || this.getView().getModel('i18n');
        return this.oResourceBundle.getResourceBundle().getText(key);
    }

    documentTypeFormatter(type) {
        this.oResourceBundle = this.oResourceBundle || this.getView().getModel('i18n');
        return documentTypeFormatter(type, this.oResourceBundle.getResourceBundle());
    }

    decodeHeaderLabel(key, documentType) {
        this.oResourceBundle = this.oResourceBundle || this.getView().getModel('i18n');
        //grab the document type 
        const selectedDocType = (this.byId('DocumentType') as any).getSelectedItem();
        this.documentType = (selectedDocType && selectedDocType.getKey()) || '';
       return capabilityLabelFormatter(key, this.oResourceBundle.getResourceBundle(), true, documentType);
    }

    decodeHeaderDescription(key, documentType) {
        this.oResourceBundle = this.oResourceBundle || this.getView().getModel('i18n');
        const selectedDocType = (this.byId('DocumentType') as any).getSelectedItem();
        this.documentType = (selectedDocType && selectedDocType.getKey()) || '';
        return capabilityDescriptionFormatter(key, this.oResourceBundle.getResourceBundle(), true, documentType);
    }

    decodeLineItemLabel(key, documentType) {
        this.oResourceBundle = this.oResourceBundle || this.getView().getModel('i18n');
        const selectedDocType = (this.byId('DocumentType') as any).getSelectedItem();
        this.documentType = (selectedDocType && selectedDocType.getKey()) || '';
        return capabilityLabelFormatter(key, this.oResourceBundle.getResourceBundle(), false, documentType);
    }

    decodeLineItemDescription(key, documentType) {
        this.oResourceBundle = this.oResourceBundle || this.getView().getModel('i18n');
        const selectedDocType = (this.byId('DocumentType') as any).getSelectedItem();
        this.documentType = (selectedDocType && selectedDocType.getKey()) || '';
        return capabilityDescriptionFormatter(key, this.oResourceBundle.getResourceBundle(), false, documentType);
    }

    /**
     * Triggered when user decided to edit step one
     * Move back by two steps
     */
    editStepOne() {
        this._oNavContainer.backToPage(this._oWizardContentPage.getId());
        this._wizard.previousStep();
        this._wizard.previousStep();
    }

    /**
     * Triggered when user decided to edit step two
     * Move back by one step
     */
    editStepTwo() {
        this._oNavContainer.backToPage(this._oWizardContentPage.getId());
        this._wizard.previousStep();
    }

    /**
     * Edit step three
     */
    editStepThree() {
        this._oNavContainer.backToPage(this._oWizardContentPage.getId());
    }

    /**
     * User cancel file upload, go back to step 1 (file upload step)
     * Reset/invalid wizard for all steps
     * Also reset file upload input, document type choice
     * Reload previously submitted header & line item fields
     */
    handleUploadDocumentCancel() {
        const sNextLayout = this.oModel.getProperty("/actionButtonsInfo/midColumn/closeColumn");
        this.oRouter.navTo("master", {layout: sNextLayout});
        const firstStep = this._wizard.getSteps()[0];
        this._wizard.previousStep();
        this._wizard.previousStep();
        this._wizard.invalidate();
        this._wizard.invalidateStep(firstStep);
        this.onResetValues();
        this.backToWizardContent();
    }

    uploadWizardCompletedHandler() {
        this._oNavContainer.to(this._oWizardReviewPage);
        const selectedDocType = (this.byId('DocumentType') as any).getSelectedItem();
        this.documentType = (selectedDocType && selectedDocType.getKey()) || '';
        this.model.setProperty("/documentType", (selectedDocType && selectedDocType.getText()) || '');

        const selectedTemplateId = (this.byId('templateId') as any).getSelectedItem();
        this.templateId = (selectedTemplateId && selectedTemplateId.getKey()) || '';
        this.model.setProperty("/templateId", (selectedTemplateId && selectedTemplateId.getText()) || 'n/a');

        const headerItems = (this.byId('HeaderFieldsTable') as any).getRows().map(
            item => item.getBindingContext('supportedExtractionFields').getObject());
        let selectedIndices = (this.byId('HeaderFieldsTable') as any).getSelectedIndices();
        this.selectedHeaderFields = [];
        for (const _idx of selectedIndices) {
            this.selectedHeaderFields.push(headerItems[_idx]);
        }
        Logger.logInfo(this.selectedHeaderFields);

        const lineItemColumns = (this.byId('LineItemsTable') as any).getRows().map(
            item => item.getBindingContext('supportedExtractionFields').getObject());
        selectedIndices = (this.byId('LineItemsTable') as any).getSelectedIndices();
        this.selectedLineItemColumns = [];
        for (const _idx of selectedIndices) {
            this.selectedLineItemColumns.push(lineItemColumns[_idx]);
        }
        this.model.setProperty("/selectedHeaderFields", this.selectedHeaderFields);
        this.model.setProperty("/selectedHeaderFieldsCount", this.selectedHeaderFields.length);
        this.model.setProperty("/selectedLineItemColumns", this.selectedLineItemColumns);
        this.model.setProperty("/selectedLineItemColumnsCount", this.selectedLineItemColumns.length);
        this.model.setProperty("/selectedHeaderFieldsText",
            this.selectedHeaderFields.map(i => new Object({text: `${this.decodeHeaderLabel(i.name, this.documentType)}`})));
        this.model.setProperty("/selectedLineItemColumnsText",
            this.selectedLineItemColumns.map(i => new Object({text: `${this.decodeLineItemLabel(i.name, this.documentType)}`})));

        Logger.logInfo(this.selectedLineItemColumns);

        const uploadSet = this.byId('UploadSet') as any;
        const toUploadItemsClone = [];
        uploadSet.getIncompleteItems().forEach((oItem) => {
            const oItemClone = oItem.clone();
            oItemClone._setFileObject(oItem.getFileObject());
            oItemClone.setVisibleEdit(false);
            oItemClone.setEnabledEdit(false);
            oItemClone.setEnabledRemove(false);
            toUploadItemsClone.push(oItemClone);
        });
        this.toUploadItemsClone = toUploadItemsClone;

        this._oNavContainer.to(this._oWizardReviewPage);
    }

    backToWizardContent() {
        this._oNavContainer.backToPage(this._oWizardContentPage.getId());
    }

    /**
     * Validate if selected header field is valid for selected document type
     * It will eventually from capabilities API (currently from Constants)
     * @param fieldsType
     * @param documentType
     * @param selectedHeaderField
     */
    isValidField(fieldsType, documentType, selectedHeaderField) {
        let ret = true;
        if (documentType) {
            ret = get(R.find(R.propEq('name', selectedHeaderField), this.supportedExtractionFields[fieldsType]) || [],
                'supportedDocumentTypes', []).indexOf(documentType) >= 0;
        }
        return ret;
    }

    /**
     * Upload to dox-api
     * Calls POST /documents/jobs endpoint
     */
    uploadHandler() {
        Logger.logInfo("Prepare to upload file");

        const uploadSet2 = sap.ui.getCore().byId("UploadSet2") as any;
        const [fileCount, errorFileSzCount, errorFileTypeCount] = this.validateFiles(uploadSet2);
        if (fileCount <= 0 || fileCount > Constants.UPLOAD_FILE_COUNT_LIMIT || errorFileSzCount > 0 || errorFileTypeCount > 0) {
            Logger.logError(`Validation failed: fileCount: ${fileCount}; errorFileSzCount: ${errorFileSzCount}; 
                errorFileTypeCount: ${errorFileTypeCount}`)
            return;
        }

        const selectedDocType = (this.byId('DocumentType') as any).getSelectedItem(), formData = new FormData(),
            options = this.getUploadOptions(selectedDocType);

        const selectedTemplateId = (this.byId("templateId") as any).getSelectedItem();
        if (selectedTemplateId && selectedTemplateId.getKey()) {
            options['templateId'] = selectedTemplateId.getKey();
        }

        this.prepareFieldsOptions(options);

        const optionsStr = JSON.stringify(options);
        formData.append("options", optionsStr);

        const settings = this.getUploadSettings(formData);

        if (localStorage.getItem('csrf_token')) {
            settings['headers'][UploadDocumentControllerClass.CSRF_HEADER] = localStorage.getItem('csrf_token');
        }

        try {
            localStorage.setItem(`upload_options${options.documentType ? options.documentType : ''}`, optionsStr);
        } catch (e) {
            Logger.logError("Error in saving locally");
            Logger.logError(e);
        }

        this.freezeButtons();

        this.uploadPendingItems(uploadSet2, this.getUploadCallbacks(), settings, optionsStr);

        Logger.logInfo("End of file upload");
    }

    private freezeButtons() {
        (sap.ui.getCore().byId("reviewBar") as any).setBusy(true);
        ['lkStep1', 'lkStep2', 'lkStep3', 'cfmUpdBtn'].forEach((s) => {
            (sap.ui.getCore().byId(s) as any).setEnabled(false);
        });
    }

    private prepareFieldsOptions(options: { enrichment: {}; clientId: string; documentType: any; extraction: { headerFields: any[]; lineItemFields: any[] } }) {
        for (const item of this.selectedHeaderFields) {
            const selectedHeaderField = item.name;
            if (this.isValidField('headerFields', options.documentType, selectedHeaderField)) {
                options.extraction.headerFields.push(selectedHeaderField);
            }
        }

        for (const item of this.selectedLineItemColumns) {
            const selectedField = item.name
            if (this.isValidField('lineItemFields', options.documentType, selectedField)) {
                options.extraction.lineItemFields.push(selectedField);
            }
        }
    }

    private uploadPendingItems(uploadSet2, callBacks: { always: () => void; fail: (res) => void; done: (res) => void }, settings: object, optionsStr: string) {
        const uploadModel = this.getOwnerComponent().getModel('uploadItems') as sap.ui.model.json.JSONModel;
        if (uploadModel) {
            uploadModel.setProperty(UploadDocumentControllerClass.ERR_FILE_CNT_KEY, 0);
        }

        const oItems = uploadSet2.getIncompleteItems() || [];
        uploadSet2.getUploader().setDoxUploadOptions({
            callBacks: callBacks,
            settings: settings,
            optionsStr: optionsStr
        });
        for (let i = 0, count = 0; count < Constants.UPLOAD_CONCURRENCY && i < oItems.length; i++) {
            // @ts-ignore
            if (oItems[i].getUploadState() === sap.m.UploadState.Ready) {
                uploadSet2.uploadItem(oItems[i]);
                count++;
            }
        }
    }

    private getUploadOptions(selectedDocType) {
        return {
            "extraction": {
                "headerFields": [],
                "lineItemFields": []
            },
            "clientId": Constants.CLIENT_ID,
            "documentType": (selectedDocType && selectedDocType.getKey()) || '',
            "enrichment": {}
        };
    }

    private getUploadSettings(formData: FormData) {
        return {
            "async": true,
            "crossDomain": true,
            "url": "/api/document/jobs",
            "method": "POST",
            "headers": {
                "cache-control": "no-cache"
            },
            "processData": false,
            "contentType": false,
            "mimeType": "multipart/form-data",
            "data": formData
        };
    }

    private getUploadCallbacks() {
        return {
            done: res => {
                const sNextLayout = this.oModel.getProperty("/actionButtonsInfo/midColumn/closeColumn");
                this.oRouter.navTo("master", {layout: sNextLayout});
                const firstStep = this._wizard.getSteps()[0];
                this._wizard.previousStep();
                this._wizard.previousStep();
                this._wizard.invalidate();
                this._wizard.invalidateStep(firstStep);
                this.backToWizardContent();

                //following is to refresh document listDocuments column, so uploaded document could appear there
                sap.ui.getCore().getEventBus().publish(
                    'InvoiceViewerChannel',
                    'DocumentUpload',
                    {'msg': 'Document uploaded'});

                Logger.logInfo(`Document uploaded: ${res}`);
            },
            fail: res => {
                let msg = 'upload error encountered.';
                try {
                    msg = JSON.parse(res.responseText)['error']['message'];
                } catch (e) {
                    Logger.logError(e);
                }
                sap.m.MessageBox.error(`Document uploaded failed: ${msg}`);
                Logger.logError(`Document upload failed: ${msg}, ${res}`);
            },
            always: () => {
                //(this.byId('wizardNavContainer') as any).setBusy(false);
            }
        };
    }

    selectLineItemActivate() {
        this.validateSomeExtractionFieldsAreSelected();
    }

    validateSomeExtractionFieldsAreSelected() {
        if ((this.byId('HeaderFieldsTable') as any).getSelectedIndices().length === 0 &&
            (this.byId('LineItemsTable') as any).getSelectedIndices().length === 0) {
            this._wizard.invalidateStep(this.byId("SelectLineItemColumnsStep"));
        } else {
            this._wizard.validateStep(this.byId("SelectLineItemColumnsStep"));
        }
    }

    onAfterNavigate(oEvent) {
        if (oEvent.getParameters('to').toId === 'wizardReviewPage') {
            const uploadSet2 = sap.ui.getCore().byId("UploadSet2");
            // @ts-ignore
            uploadSet2.destroyIncompleteItems().destroyItems();
            (this.toUploadItemsClone || []).forEach((oItem) => {
                // @ts-ignore
                uploadSet2.addIncompleteItem(oItem);
            });
        }
    }

    changeWizardByDocType(docType) {
        ['HeaderFieldsTable', 'LineItemsTable'].forEach((tableName) => {
            this.filterTableByDocType(docType, tableName);
        });
        setTimeout(x => {
            this.loadPreviousOptions(docType);
        }, 0);
    }

    /**
     * Document type "invoice" and "paymentAdvice" have different set of valid header fields and line item fields
     * Following is to make when different document type is selected, its corresponding valid set of fields are
     * displayed. If no document type is selected, all fields could be used.
     * @param docType
     * @param tableName
     */
    filterTableByDocType(docType, tableName) {
        const filters = [new sap.ui.model.Filter('supportedDocumentTypes', function (supportedDocumentTypes) {
            return !docType || supportedDocumentTypes && supportedDocumentTypes.indexOf(docType) >= 0;
        })];
        (this.getView().byId(tableName).getBinding("rows") as any).filter(
            new sap.ui.model.Filter({filters: filters, and: true}), "Application");
        const visibleCount = (this.getView().byId(tableName) as any).getBinding('rows').getLength();
        (this.getView().byId(tableName) as any).setVisibleRowCount(R.max(visibleCount, 1));
    }

    documentTypeChanged(oEvent) {
        const documentType = oEvent.getParameters()['selectedItem'].getKey();
        this.changeWizardByDocType(documentType);
        (this.byId('templateId') as any).setSelectedKey("");
        this.setTemplateNamesForDocType(documentType);
    }
}

export const UploadDocumentController = smartExtend(BaseController, "sap.bdp.components.invoiceviewer.controller.UploadDocument", UploadDocumentControllerClass);
sap.ui.define("sap/bdp/components/invoiceviewer/controller/UploadDocument.controller", [
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/mvc/Controller",
    "sap/ui/layout/VerticalLayout",
    "sap/ui/core/HTML",
    "sap/ui/core/ResizeHandler",
    "sap/ui/core/Fragment",
    "sap/ui/model/Filter"
], () => UploadDocumentController);
