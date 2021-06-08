import * as R from "ramda";
import {ICoordinates, IDocument, IExtraction, IExtractionUpdate, IMessage} from "../../../../@types/bdp";
import {
    BaseController,
    BaseControllerClass,
    smartExtend,
} from "../../basecomponent/controller/BaseController.controller";
import {DoxClient} from "../../reuse/utility/DoxClient";
import {capabilityLabelFormatter} from "../../reuse/utility/Formatter";
import {Logger} from "../../reuse/utility/Helper";

class DetailDetailControllerClass extends BaseControllerClass {

    protected oRouter: sap.ui.core.routing.Router;
    protected oModel: sap.ui.model.Model;
    protected oResourceBundle: any;
    protected documentType: any;
    protected lineItemsExpandStatus: boolean[];

    onInit() {
        this.oRouter = sap.ui.core.UIComponent.getRouterFor(this);
        this.oModel = this.getOwnerComponent().getModel();
        this.oRouter.getRoute("detailDetail").attachPatternMatched(this.onDocumentMatched, this);
        sap.ui.getCore().getEventBus().subscribe(
            "ExtractionUpdate",
            "ExtractionUpdatedByDetail",
            this.onExtractionUpdatedByDetail,
            this);
        sap.ui.getCore().getEventBus().subscribe(
            "InvoiceViewerChannel",
            "DocumentLoaded",
            this.onDocumentLoaded,
            this);
        if (this.getDocument()) {
            this.onDocumentLoaded();
        }
    }

    getOCRViewer() {
        return sap.ui.getCore().byId("shell---invoiceviewer---detail--oCRViewer") as sap.bdp.components.reuse.control.OCRViewer;
    }

    decodeHeaderLabel(key) {
        this.oResourceBundle = this.oResourceBundle || this.getView().getModel("i18n");
        const docType = this.getOwnerComponent().getModel("document").getProperty("/documentType");
        return capabilityLabelFormatter(key, this.oResourceBundle.getResourceBundle(), true, docType);
    }

    //row highlights
    decodeConfidence(confidence){
        const docStatus = this.getOwnerComponent().getModel("document").getProperty("/status")
        if (docStatus !== 'CONFIRMED'){
            if(confidence != null && confidence.value === null || confidence != null && typeof confidence.confidence === "undefined") { 
                return sap.ui.core.MessageType.None
            } else if (confidence != null) {
                return confidence.confidence >= 0.8 ? sap.ui.core.MessageType.Success : 
                    confidence.confidence >= 0.5 ? sap.ui.core.MessageType.Warning : sap.ui.core.MessageType.Error;
        } else return sap.ui.core.MessageType.None; 
    }}
       

    //Tooltip for confidence
    decodeTooltip(confidence){
        const docStatus = this.getOwnerComponent().getModel("document").getProperty("/status")
        if (docStatus !== 'CONFIRMED'){
            if (confidence != null && typeof confidence.confidence === "undefined") {
                return ``
            } else if(confidence != null && confidence.value === null){
                return `Confidence: NA`
            } else if (confidence != null) {
                const formattedConfidence = Math.round((confidence.confidence + Number.EPSILON) * 100) / 100
                const roundedConfidence = formattedConfidence*100
                return `Confidence: ${roundedConfidence}%`
            } 
        } else return ``;
    }

    decodeLineItemLabel(key, index) {
        this.oResourceBundle = this.oResourceBundle || this.getView().getModel("i18n");
        const docType = this.getOwnerComponent().getModel("document").getProperty("/documentType");
        if (typeof key === "string") {
            return capabilityLabelFormatter(key, this.oResourceBundle.getResourceBundle(), false, docType);
        } else if (typeof index === "number") {
            return `Line Item ${index}`;
        } else {
            return "";
        }
    }

    onExtractionUpdatedByDetail(sChannelId, sEventId, extractionUpdate: IExtractionUpdate) {
        const lineItemIndexMatch = extractionUpdate.path.match(/^\/extraction\/lineItems\/(\d+)/);
        if (lineItemIndexMatch === null || lineItemIndexMatch.length < 2) {
            return;
        }
        const lineItemIndex = parseInt(lineItemIndexMatch[1], 10);
        this.scrollToAndToggleLineItem(lineItemIndex, true);
    }

    getDocument(): IDocument|undefined {
        const documentModel = this.getOwnerComponent().getModel("document");
        return (documentModel && documentModel.getData()) ? documentModel.getData() : undefined;
    }

    onChangeHeaderValue(oEvent) {
        sap.ui.getCore().getEventBus().publish(
            "ExtractionUpdate",
            "ExtractionUpdatedByDetailDetail",
            {});
    }

    onChangeLineItemValue(oEvent) {
        sap.ui.getCore().getEventBus().publish(
            "ExtractionUpdate",
            "ExtractionUpdatedByDetailDetail",
            {});
    }

    onHeaderInputBoxClick(oEvent) {
        const data = oEvent.oSource.getParent().data();
        if (this.getOCRViewer().isPopoverOpen) {
            this.getOwnerComponent().getModel("ui").setProperty("/extractionFieldInPopover",
                {key: `headerField-${data.fieldName}`, nuance: Date.now()});
        } else {
            this.focusCoordinatesOnPage(data.page, [data.coordinates]);
        }
    }

    onHeaderItemPress(oEvent) {
        const data = oEvent.getParameter("listItem").data();
        if (this.getOCRViewer().isPopoverOpen) {
            this.getOwnerComponent().getModel("ui").setProperty("/extractionFieldInPopover",
                {key: `headerField-${data.fieldName}`, nuance: Date.now()});
        } else {
            this.focusCoordinatesOnPage(data.page, [data.coordinates]);
        }
    }

    onLineItemInputBoxClick(oEvent) {
        const data = oEvent.oSource.getParent().data();
        if (this.getOCRViewer().isPopoverOpen) {
            this.getOwnerComponent().getModel("ui").setProperty("/extractionFieldInPopover",
                {key: `lineItemField-${data.fieldName}`, rowIndex: data.index, nuance: Date.now()});
        } else {
            this.focusCoordinatesOnPage(data.page, [data.coordinates]);
        }
    }

    onLineItemTableCellClick(oEvent) {
        const sPath = oEvent.getParameter("rowBindingContext").sPath;
        const data = this.getOwnerComponent().getModel("document").getProperty(sPath);
        let pageNumber = 1;
        let coordinatesToFocus = [];
        if ("columns" in data) {
            // order item
            const nonEmptyColumns = R.filter((column : any) => ![undefined, null].includes(column.value), data.columns)
            if(nonEmptyColumns.length > 0) {
                pageNumber = nonEmptyColumns[0].page;
                coordinatesToFocus = R.map(R.prop("coordinates"), data.columns as IExtraction[]);
                this.focusCoordinatesOnPage(pageNumber, coordinatesToFocus);
            }
        } else {
            // column
            pageNumber = data.page;
            if (this.getOCRViewer().isPopoverOpen) {
                this.getOwnerComponent().getModel("ui").setProperty("/extractionFieldInPopover", {
                    key: `lineItemField-${data.name}`,
                    rowIndex: data.index,
                    nuance: Date.now(),
                });
            } else {
                this.focusCoordinatesOnPage(pageNumber, [(data as IExtraction).coordinates]);
            }
        }
    }

    onToggleLineItemRow(oEvent) {
        const numberOfColumns = this.getDocument().extraction.lineItems[0].columns.length;
        const result = R.reduce((acc, expanded) => {
            const [rowIndex, lineItemIndex] = acc;
            if (rowIndex > 0) {
                return [rowIndex - (expanded ? numberOfColumns + 1 : 1), lineItemIndex + 1];
            } else {
                return acc;
            }
        }, [oEvent.getParameter("rowIndex"), 0], this.lineItemsExpandStatus);
        this.lineItemsExpandStatus[result[1]] = oEvent.getParameter("expanded");
    }

    focusCoordinatesOnPage(pageNumber: number, coordinatesToFocus: ICoordinates[]) {
        this.getOwnerComponent().getModel("ui").setProperty("/pageNumber", pageNumber);
        setTimeout(function() {
            this.getOwnerComponent().getModel("ui").setProperty("/coordinatesToFocus", coordinatesToFocus);
        }.bind(this), 300);
    }

    handleFullScreen() {
        const sNextLayout = this.oModel.getProperty("/actionButtonsInfo/endColumn/fullScreen");
        this.oRouter.navTo("detailDetail", {layout: sNextLayout});
    }

    handleExitFullScreen() {
        const sNextLayout = this.oModel.getProperty("/actionButtonsInfo/endColumn/exitFullScreen");
        this.oRouter.navTo("detailDetail", {layout: sNextLayout});
    }

    handleClose() {
        this.setEditMode(false);
        const sNextLayout = this.oModel.getProperty("/actionButtonsInfo/endColumn/closeColumn");
        this.oRouter.navTo("detail", {layout: sNextLayout, document: this.getDocument().id});
        sap.ui.getCore().getEventBus().publish(
            "DetailDetail",
            "closed",
            {});
    }

    onDocumentMatched(oEvent) {
        this.setEditMode(false);
    }

    onDocumentLoaded() {
        this.lineItemsExpandStatus = R.repeat(false, this.getDocument().extraction.lineItems.length);
    }

    refreshModel() {
        const pageView = this.getView();
        pageView.setBusy(true);
        const supportExtractionFields = this.getOwnerComponent().getModel("supportedExtractionFields").getObject("/");
        DoxClient.getDocument(this.getDocument().id, supportExtractionFields, this.oResourceBundle.getResourceBundle()).then(function(document: IDocument) {
            const documentModel = new sap.ui.model.json.JSONModel(document);
            this.getOwnerComponent().setModel(documentModel, "document");
        }.bind(this)).catch(error => {
            sap.m.MessageBox.error("Failed to load document, please try again later");
        }).finally(() => pageView.setBusy(false));
    }

    handleEditPress() {
        this.setEditMode(true);
        this.byId("HeaderList").focus();
    }

    handleConfirmPress() {
        if (!this._checkFieldErrors()) {
            return ;
        }
        this.oResourceBundle = this.oResourceBundle || this.getView().getModel("i18n");
        const confirm_button_text = this.oResourceBundle.getResourceBundle().getText("lb_confirm");
        const cancel_button_text = this.oResourceBundle.getResourceBundle().getText("lb_cancel");
        const confirm_dialog_title = this.oResourceBundle.getResourceBundle().getText("lb_confirm_document_dialog_title");
        const confirm_dialog_message = this.oResourceBundle.getResourceBundle().getText("lb_confirm_document_dialog_message");
        const confirmDialog = new sap.m.Dialog({
            title: confirm_dialog_title,
            type: "Message",
            content: new sap.m.Text({
                text: confirm_dialog_message,
            }),
            state: "Information",
            beginButton: new sap.m.Button({
                type: sap.m.ButtonType.Emphasized,
                text: confirm_button_text,
                press: () => {
                    confirmDialog.close();
                    const pageView = this.getView();
                    pageView.setBusyIndicatorDelay(0).setBusy(true);
                    this.handleSaveThenConfirm();

                },
            }),
            endButton: new sap.m.Button({
                text: cancel_button_text,
                press: function() {
                    confirmDialog.close();
                },
            }),

        });
        confirmDialog.open();
    }

    handleSaveThenConfirm() {
        setTimeout(() => {
            this._saveDocument().then((isSuccessful) => {
                    if (isSuccessful) {
                        this._confirmDocument();
                    }
                },
            );
        }, 0);

    }

    handleCancelPress() {
        this.setEditMode(false);
        this.refreshModel();
    }

    handleSavePress() {
        if (!this._checkFieldErrors()) {
            return ;
        }
        const pageView = this.getView();
        pageView.setBusyIndicatorDelay(0).setBusy(true);
        setTimeout(() => {
            this._saveDocument().then((isSuccessful) => {
                    if (isSuccessful) {
                        this.refreshModel();
                        this.setEditMode(false);
                    }
                },
            );

        }, 0);
    }

    _confirmDocument() {
        const pageView = this.getView();
        pageView.setBusyIndicatorDelay(0).setBusy(true);
        DoxClient.confirmDocument(this.getDocument().id).then(function(resp: IMessage) {
            sap.m.MessageToast.show("Confirmed Successfully");
            this.refreshModel();
        }.bind(this)).catch((error) => {
            sap.m.MessageBox.error("Confirmation Failed: Please Try Again");
            Logger.logError(error);
            pageView.setBusy(false);
        });
    }

    _saveDocument() {
        const pageView = this.getView();
        return DoxClient.updateDocument(this.getDocument()).then(function(resp: IMessage) {
            sap.m.MessageToast.show("Changes are saved successfully");
            this.refreshModel();
            this.setEditMode(false);
            return true;
        }.bind(this)).catch((error) => {
            sap.m.MessageBox.error("Changes could not be saved");
            pageView.setBusy(false);
            Logger.logError(error);
            return false;
        });
    }

    _checkFieldErrors() {
        const fieldWithError = (this.byId("ExtractionResultPanel") as sap.m.Panel).getControlsByFieldGroupId("extrationField").filter(item => {
            return item instanceof sap.m.InputBase && item.getValueState() == "Error";
        });
        if (fieldWithError.length > 0) {
            sap.m.MessageBox.error("Some input field have errors. Please fix the errors");
            return false;
        }
        return true;
    }

    setEditMode(editMode: boolean) {
        this.getOwnerComponent().getModel("ui").setProperty("/editMode", editMode);
    }

    onCollapseAll() {
        const oTreeTable = this.byId("LineItemList") as any;
        oTreeTable.collapseAll();
        this.lineItemsExpandStatus = R.repeat(false, this.getDocument().extraction.lineItems.length);
    }

    onExpandAll() {
        const oTreeTable = this.byId("LineItemList") as any;
        oTreeTable.expandToLevel(1);
        this.lineItemsExpandStatus = R.repeat(true, this.getDocument().extraction.lineItems.length);
    }

    onAddLineItemAbove(oEvent) {
        const index = oEvent.getSource().getBindingContext("document").sPath.match(/^\/extraction\/lineItems\/(\d+)/)[1];
        this.addEmptyLineItem(parseInt(index, 10));
    }

    onAddLineItemBelow(oEvent) {
        const index = oEvent.getSource().getBindingContext("document").sPath.match(/^\/extraction\/lineItems\/(\d+)/)[1];
        this.addEmptyLineItem(parseInt(index, 10) + 1);
    }

    onAppendLineItem(oEvent) {
        this.addEmptyLineItem(this.getDocument().extraction.lineItems.length);
    }

    onDeleteLineItem(oEvent) {
        const supportExtractionFields = this.getOwnerComponent().getModel("supportedExtractionFields").getObject("/");
        const resourceBundle = this.oResourceBundle.getResourceBundle();
        const document = this.getDocument();
        const index = parseInt(oEvent.getSource().getBindingContext("document").sPath.match(/^\/extraction\/lineItems\/(\d+)/)[1], 10);
        document.extraction.lineItems = DoxClient.deleteLineItem(document.extraction.lineItems, index, document.extractionFieldNames, supportExtractionFields, resourceBundle, document.documentType);
        this.getOwnerComponent().getModel("document").refresh(true);
        this.onCollapseAll();
        sap.m.MessageToast.show("Item has been deleted successfully");
    }

    addEmptyLineItem(index: number) {
        const supportExtractionFields = this.getOwnerComponent().getModel("supportedExtractionFields").getObject("/");
        const resourceBundle = this.oResourceBundle.getResourceBundle();
        const document = this.getDocument();
        document.extraction.lineItems = DoxClient.addEmptyLineItem(document.extraction.lineItems, index, document.extractionFieldNames, supportExtractionFields, resourceBundle, document.documentType);
        this.getOwnerComponent().getModel("document").refresh(true);
        this.onCollapseAll();
        this.scrollToAndToggleLineItem(index, true);
        sap.m.MessageToast.show("Item has been added successfully");
    }

    scrollToAndToggleLineItem(index: number, expand: boolean|undefined): void {
        const oTreeTable = this.byId("LineItemList") as sap.ui.table.TreeTable;
        const numberOfExpandedRowsBefore: number = this.lineItemsExpandStatus.filter((x, i) => i < index && x === true).length;
        const numberOfColumns = this.getDocument().extraction.lineItems[0].columns.length;
        oTreeTable.setFirstVisibleRow(index + numberOfColumns * numberOfExpandedRowsBefore);
        setTimeout(function() {
            if (expand !== undefined) {
                const parentRow = oTreeTable.getRows().filter(
                    item => item.getCells()[1].data("fieldName") === null && item.getCells()[1].data("index") === index + 1,
                )[0];
                if (oTreeTable.isExpanded(parentRow.getIndex()) !== expand) {
                    if (expand) {
                        oTreeTable.expand(parentRow.getIndex());
                    } else {
                        oTreeTable.collapse(parentRow.getIndex());
                    }
                }
                this.lineItemsExpandStatus[index] = expand;
            }
        }.bind(this), 0);
    }
}

export const DetailDetailController = smartExtend(BaseController, "sap.bdp.components.invoiceviewer.controller.DetailDetail", DetailDetailControllerClass);
sap.ui.define("sap/bdp/components/invoiceviewer/controller/DetailDetail.controller", [
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/mvc/Controller",
    "sap/ui/table/TreeTable",
], () => DetailDetailController);
