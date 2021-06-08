import {IDocument, IExtractionUpdate} from "../../../../@types/bdp";
import {
    BaseController,
    BaseControllerClass,
    smartExtend,
} from "../../basecomponent/controller/BaseController.controller";
import {JobStatusError} from "../../reuse/errors/JobStatusError";
import {Constants} from "../../reuse/utility/Constants";
import {DocumentUtils} from "../../reuse/utility/DocumentUtils";
import {DoxClient} from "../../reuse/utility/DoxClient";
import {
    capabilityLabelFormatter,
    dateFormatter,
    documentTypeFormatter,
    statusFormatter,
    statusTooltipFormatter,
    textFormatter,
} from "../../reuse/utility/Formatter";
import {Logger} from "../../reuse/utility/Helper";
import {InvoiceViewerComponentClass} from "../Component";

class DetailControllerClass extends BaseControllerClass {

    protected oRouter: sap.ui.core.routing.Router;
    protected oModel: sap.ui.model.Model;
    protected oResourceBundle: any;

    onInit() {
        this.oRouter = sap.ui.core.UIComponent.getRouterFor(this);
        this.oModel = this.getOwnerComponent().getModel();

        this.oRouter.getRoute("detail").attachPatternMatched(this.onDocumentMatched, this);
        this.oRouter.getRoute("detailDetail").attachPatternMatched(this.onDocumentMatched, this);
        this.oResourceBundle = this.getOwnerComponent().getModel("i18n");

        this.getOwnerComponent().setModel(new sap.ui.model.json.JSONModel({
            editMode: false,
            coordinatesToFocus: [],
            pageNumber: 1,
            extractionFieldInPopover: {
                key: null,
                rowIndex: 0,
            },
        }), "ui");

        sap.ui.getCore().getEventBus().subscribe(
            "ExtractionUpdate",
            "ExtractionUpdatedByDetailDetail",
            this.onExtractionUpdatedByDetailDetail,
            this);

        sap.ui.getCore().getEventBus().subscribe(
            "DetailDetail",
            "closed",
            this.onDetailDetailClosed,
            this);
    }

    onExtractionUpdatedByDetailDetail(oEvent) {
        this.byId("oCRViewer").getBinding("document").refresh(true);
    }

    onDetailDetailClosed(oEvent) {
        this.reloadDocument(this.getDocument().id);
    }

    onAfterRendering() {
        this.byId("oCRViewer").setProperty("scroller", (this.byId("ObjectPageLayout") as any).getScrollDelegate());
    }

    getDocument(): IDocument|undefined {
        const documentModel = this.getOwnerComponent().getModel("document");
        return (documentModel && documentModel.getData()) ? documentModel.getData() : undefined;
    }

    unsetDocumentModel() {
        this.getOwnerComponent().getModel("document").setProperty("/", null);
        this.getOwnerComponent().getModel("document").refresh(true);
    }

    formatText(s) {
        return textFormatter(s);
    }

    formatStatus(s) {
        return statusFormatter(s);
    }

    formatStatusTooltip(s) {
        this.oResourceBundle = this.oResourceBundle || this.getView().getModel('i18n');
        return statusTooltipFormatter(s,this.oResourceBundle.getResourceBundle());
    }

    formatDate(s) {
        return dateFormatter(s);
    }

    formatVisible(s){
        return (s||'').length > 0;
    }

    formatDocumentType(type) {
        return documentTypeFormatter(type, this.oResourceBundle.getResourceBundle());
    }

    formatDocumentIcon(fileName: string | null) {
        return fileName !== null && fileName.endsWith("pdf") ? "sap-icon://pdf-attachment" : "sap-icon://document";
    }

    onExtractionDetails(oEvent) {
        const oNextUIState = (this.getOwnerComponent() as InvoiceViewerComponentClass).getHelper().getNextUIState(2);
        this.oRouter.navTo("detailDetail", {
            layout: oNextUIState.layout,
            document: this.getDocument().id,
        });
    }

    deleteDocument() {
        Logger.logInfo(`Deleting ${this.getDocument().id}`);
        const pageView = this.getView();
        pageView.setBusy(true);
        DoxClient.deleteDocument(this.getDocument().id).then(data => {
            if (data) {
                const sNextLayout = this.oModel.getProperty("/actionButtonsInfo/midColumn/closeColumn");
                this.oRouter.navTo("master", {layout: sNextLayout});
                sap.ui.getCore().getEventBus().publish(
                    "InvoiceViewerChannel",
                    "DocumentDeleted",
                    {"msg": "Document uploaded"});
            }
        }).catch(error => {
            Logger.logError(error);
            sap.m.MessageBox.error("Failed to deleteDocument the document, please try again later");
            pageView.setBusy(false);
        });
    }

    onDeleteDocument(oEvent) {
        const bCompact = !!this.getView().$().closest(".sapUiSizeCompact").length;
        const fileName = this.getOwnerComponent().getModel("document").getProperty("/fileName");
        sap.m.MessageBox.confirm(
            `Delete file ${fileName}?`, {
                styleClass: bCompact ? "sapUiSizeCompact" : "",
                onClose: oAction => {
                    if (oAction === sap.m.MessageBox.Action.OK) {
                        this.deleteDocument();
                    }
                },
            },
        );
    }

    handleFullScreen() {
        const sNextLayout = this.oModel.getProperty("/actionButtonsInfo/midColumn/fullScreen");
        this.oRouter.navTo("detail", {layout: sNextLayout, document: this.getDocument().id});
    }

    handleExitFullScreen() {
        const sNextLayout = this.oModel.getProperty("/actionButtonsInfo/midColumn/exitFullScreen");
        this.oRouter.navTo("detail", {layout: sNextLayout, document: this.getDocument().id});
    }

    handleClose() {
        const sNextLayout = this.oModel.getProperty("/actionButtonsInfo/midColumn/closeColumn");
        this.unsetDocumentModel();
        this.oRouter.navTo("master", {layout: sNextLayout});
    }

    onDocumentMatched(oEvent) {
        const documentId = oEvent.getParameter("arguments").document;
        if (this.getDocument() === undefined || documentId !== this.getDocument().id) {
            this.reloadDocument(documentId).then(() => {
                sap.ui.getCore().getEventBus().publish("InvoiceViewerChannel", "DocumentLoaded");
            });
            this.getOwnerComponent().getModel("ui").setProperty("/pageNumber", 1);
        }
        this.getOwnerComponent().getModel("ui").setProperty("/editMode", false);
        this.getOwnerComponent().getModel("ui").refresh(true);
    }

    reloadDocument(documentId: string): Promise<void> {
        const pageView = this.getView();
        pageView.setBusy(true);
        const supportExtractionFields = this.getOwnerComponent().getModel("supportedExtractionFields").getObject("/");
        return DoxClient.getDocument(documentId, supportExtractionFields, this.oResourceBundle.getResourceBundle()).then((data: IDocument) => {
            this.getOwnerComponent().setModel(new sap.ui.model.json.JSONModel(data), "document");
            const docType = data.documentType;
            const extractionFields = [];

            if (data.templateId) {
                DoxClient.getTemplateInfoById(data.templateId).then(templateDetail=>{
                        if(templateDetail && templateDetail.name){
                            this.getOwnerComponent().getModel("document").setProperty("/templateName", templateDetail.name);
                        }
                    },
                );
            }
            supportExtractionFields.headerFields.forEach(item => {
                if (data.extractionFieldNames.headerFields.includes(item.name)) {
                    extractionFields.push({
                        "name": item.name,
                        "label": capabilityLabelFormatter(item.name, this.oResourceBundle.getResourceBundle(), true, docType),
                        "type": item.type,
                        "groupLabel": "Header Fields",
                        "group": Constants.GROUP_HEADER_FIELDS,
                        "key": `headerField-${item.name}`,
                    });
                }
            });
            supportExtractionFields.lineItemFields.forEach(item => {
                if (data.extractionFieldNames.lineItemFields.includes(item.name)) {
                    extractionFields.push({
                        "name": item.name,
                        "label": capabilityLabelFormatter(item.name, this.oResourceBundle.getResourceBundle(), false, docType),
                        "type": item.type,
                        "groupLabel": "Line Item Fields",
                        "group": Constants.GROUP_LINE_ITME_FIELDS,
                        "key": `lineItemField-${item.name}`,
                    });
                }
            });
            this.getOwnerComponent().setModel(new sap.ui.model.json.JSONModel(extractionFields), "extractionFields");
        }).catch(error => {
            if (error instanceof JobStatusError) {
                this.getOwnerComponent().setModel(new sap.ui.model.json.JSONModel(error.job), "document");
            } else {
                Logger.logError(error);
                sap.m.MessageBox.error("Failed to load document, please try again later");
            }
        }).finally(() => {
            pageView.setBusy(false);
        });
    }

    handleExtractionUpdatedByOCRViewer(oEvent) {
        const extractionUpdate = oEvent.getParameters() as IExtractionUpdate;
        this.getOwnerComponent().getModel("document").setProperty(extractionUpdate.path, extractionUpdate.extraction);
        sap.ui.getCore().getEventBus().publish(
            "ExtractionUpdate",
            "ExtractionUpdatedByDetail",
            extractionUpdate);
        setTimeout(() => this.byId("oCRViewer").getBinding("document").refresh(true), 100);
    }
}

export const DetailController = smartExtend(BaseController, "sap.bdp.components.invoiceviewer.controller.Detail", DetailControllerClass);
sap.ui.define("sap/bdp/components/invoiceviewer/controller/Detail.controller", [
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/mvc/Controller",
    "sap/ui/layout/VerticalLayout",
    "sap/ui/core/HTML",
    "sap/ui/core/ResizeHandler",
], () => DetailController);
