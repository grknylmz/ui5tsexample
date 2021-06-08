import {
    BaseController,
    BaseControllerClass,
    smartExtend
} from "../../basecomponent/controller/BaseController.controller";
import {InvoiceViewerComponentClass} from "../Component";
import {Logger} from "../../reuse/utility/Helper";
import {DoxClient} from "../../reuse/utility/DoxClient";
import {Constants} from "../../reuse/utility/Constants";

import {
    statusFormatter,
    textFormatter,
    dateFormatter,
    documentTypeFormatter,
    statusTooltipFormatter
} from "../../reuse/utility/Formatter";

const MASTER_FILTER_DIALOG_VIEW = "sap.bdp.components.invoiceviewer.view.MasterFilterDialog"
const MASTER_SORT_DIALOG_VIEW = "sap.bdp.components.invoiceviewer.view.MasterSortDialog"

class MasterControllerClass extends BaseControllerClass {
    protected oRouter: sap.ui.core.routing.Router;
    protected _mViewSettingsDialogs: any;
    protected isViewVisible = true;
    protected oResourceBundle : any;

    onInit() {
        this.oRouter = sap.ui.core.UIComponent.getRouterFor(this);
        this._mViewSettingsDialogs = {};
        this.isViewVisible = true;

        //following is for when document is uploaded, refresh the document listDocuments
        sap.ui.getCore().getEventBus().subscribe(
            'InvoiceViewerChannel',
            'DocumentUpload',
            this.loadDocuments,
            this);

        sap.ui.getCore().getEventBus().subscribe(
            'InvoiceViewerChannel',
            'DocumentDeleted',
            this.loadDocuments,
            this);

        sap.ui.getCore().getEventBus().subscribe(
            'ShellChannel',
            'ClientChanged',
            this.loadDocuments,
            this);

        this.loadDocuments(undefined, undefined, undefined, true);
        this.autoRefreshDocuments();
        // when document listing page is invisible, no need refresh the listing table
        this.oRouter.attachBeforeRouteMatched(null, (evt)=>{
            if(evt && evt.getParameters() && 'name' in evt.getParameters()){
                this.isViewVisible = (['templates', "settings"].indexOf(evt.getParameters()['name']) < 0);
            }
        });
        this.oRouter.getRoute("detail").attachPatternMatched(this._onProductMatched, this);
        this.oRouter.getRoute("detailDetail").attachPatternMatched(this._onProductMatched, this);
    }

    _onProductMatched(oEvent) {
        const documentId = oEvent.getParameter("arguments").document
        this.getView().getModel().setProperty("/selectedDocumentId", documentId);     
    }

    /**
     * Refresh document listing table every REFRESH_DOCUMENTS_INTERVAL seconds (10 seconds for now)
     * @param isShowError
     */
    autoRefreshDocuments() {
        if (!document.hidden) {
            this.loadDocuments(undefined, undefined, undefined, false);
        }
        setTimeout(this.autoRefreshDocuments.bind(this), Constants.REFRESH_DOCUMENTS_INTERVAL);
    }

    /**
     * load documents, via calling document jobs api
     * @param sChannelId
     * @param sEventId
     * @param sData
     * @param isShowError
     */
    loadDocuments(sChannelId?, sEventId?, sData?, isShowError = true) {
        if(!sChannelId && !this.isViewVisible){
            return;
        }

        const documentsTable = this.getView().byId("documentsTable") as sap.ui.table.Table;

        if (isShowError) {
            documentsTable.setBusy(true);
        }

        DoxClient.listDocuments().then((data: any) => {
            if (!this.getOwnerComponent().getModel("documents")) {
                const documentsModel = new sap.ui.model.json.JSONModel(data);
                documentsModel.setSizeLimit(10000);
                this.getOwnerComponent().setModel(documentsModel, "documents");
                //default sort by creation date descending order
                (this.getView().byId("documentsTable").getBinding("items") as any)
                    .sort(new sap.ui.model.Sorter("created", true));

            } else {
                //normally, following part triggered by auto refresh
                const _model = this.getOwnerComponent().getModel("documents") as sap.ui.model.json.JSONModel

                _model.forceNoCache(true);
                _model.setData(data);
            }
        }).catch(error => {
            Logger.logError(error);
            if (isShowError) {
                sap.m.MessageBox.error("Failed to load documents, please try again later.");
            }
        }).finally(() => documentsTable.setBusy(false));
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

    formatDocumentType(type) {
        this.oResourceBundle = this.oResourceBundle || this.getView().getModel('i18n');
        return documentTypeFormatter(type, this.oResourceBundle.getResourceBundle());
    }

    formatCount(s) {
        if (s == null || s.length === 0 || (s.length === 1 && s[0].message === 'No documents found.')) {
            return "Documents ( 0 )";
        }
        return `Documents ( ${s.length} )`;
    }

    onCellClick(oEvent) {
        const oNextUIState = (this.getOwnerComponent() as InvoiceViewerComponentClass).getHelper().getNextUIState(1);
        const documentId = oEvent.getParameters().rowBindingContext.getProperty('id');

        this.oRouter.navTo("detail", {layout: oNextUIState.layout, document: documentId});
    }

    /**
     * Client side filtering on fileName
     * @param oEvent
     */
    onSearch(oEvent) {
        const filters = [];
        const sQuery = oEvent.getParameter("query");

        if (sQuery && sQuery.length > 0) {
            filters.push(new sap.ui.model.Filter('fileName', sap.ui.model.FilterOperator.Contains, sQuery));

            (this.getView().byId("documentsTable").getBinding("items") as any).filter(
                new sap.ui.model.Filter({filters: filters, and: false}), "Control");
        } else {
            (this.getView().byId("documentsTable").getBinding("items") as any).filter(null, "Control");
        }
    }

    /**
     * When user clicks the plus button to upload a document
     * @param oEvent
     */
    onAdd(oEvent) {
        sap.ui.getCore().getEventBus().publish(
            'InvoiceViewerChannel',
            'ResetUploadFiles',
            {'msg': 'ResetUploadFiles'});
        const oNextUIState = (this.getOwnerComponent() as InvoiceViewerComponentClass).getHelper().getNextUIState(1);
        this.oRouter.navTo("uploadDocument", {layout: oNextUIState.layout});
    }

    createViewSettingsDialog(sDialogFragmentName) {
        let oDialog = this._mViewSettingsDialogs[sDialogFragmentName];

        if (!oDialog) {
            oDialog = sap.ui.xmlfragment(sDialogFragmentName, this);
            this._mViewSettingsDialogs[sDialogFragmentName] = oDialog;

            if (sap.ui.Device.system.desktop) {
                oDialog.addStyleClass("sapUiSizeCompact");
            }

            this.getView().addDependent(oDialog);
        }
        return oDialog;
    }

    handleSortButtonPressed(oEvent) {
        this.createViewSettingsDialog(MASTER_SORT_DIALOG_VIEW).open();
    }

    handleSortDialogConfirm(oEvent) {
        const oView = this.getView();
        const mParams = oEvent.getParameters();
        const oTable = oView.byId("documentsTable");
        const sPath = mParams.sortItem.getKey();
        const oBinding = oTable.getBinding("items");
        const oSorter = new sap.ui.model.Sorter(sPath, mParams.sortDescending);

        (oBinding as any).sort(oSorter);
    }

    handleFilterDialogReset(oEvent) {
        oEvent.getSource().getFilterItems()[1].getCustomControl().setValue(null);
        oEvent.getSource().getFilterItems()[1].setFilterCount(0);
        oEvent.getSource().getFilterItems()[1].setSelected(false);
    }

    handleFilterDateChange(oEvent) {
        if (MASTER_FILTER_DIALOG_VIEW in this._mViewSettingsDialogs) {
            const oDialog = this._mViewSettingsDialogs[MASTER_FILTER_DIALOG_VIEW]
            const _value = oDialog.getFilterItems()[1].getCustomControl().getValue();
            if (_value) {
                oDialog.getFilterItems()[1].setFilterCount(1);
                oDialog.getFilterItems()[1].setSelected(true);
            } else {
                oDialog.getFilterItems()[1].setFilterCount(0);
                oDialog.getFilterItems()[1].setSelected(false);
            }
        }
    }

    handleFilterDialogConfirm(oEvent) {
        const mParams = oEvent.getParameters();
        const filters = [];

        this.prepareStatusDocTypeFilter(mParams, filters);

        this._mViewSettingsDialogs['filterDateRange'] = oEvent.getSource().getFilterItems()[1].getCustomControl().getValue();

        const fromDt = oEvent.getSource().getFilterItems()[1].getCustomControl().getFrom();
        const toDt = oEvent.getSource().getFilterItems()[1].getCustomControl().getTo();

        this.prepareDtRangeFilter(fromDt, toDt, filters);

        this.filterDocListTable(filters);

        //filter info toolbar
        (this.byId("vsdFilterBar") as sap.m.OverflowToolbar).setVisible(filters.length > 0 ); 
        
        let filteringString = mParams.filterString;
       
        //date formatter
        var oDateFormat = sap.ui.core.format.DateFormat.getDateInstance({
            pattern: "MMM d, yyyy"
        });
        
        const formattedDate = filteringString.replace("Upload Date", "Upload Date" + ' ' + ' (' + oDateFormat.format(fromDt) + ' - ' + oDateFormat.format(toDt) + ')')

        if (filteringString.includes('Upload Date'))  {
            (this.byId("vsdFilterLabel") as sap.m.Text).setText(formattedDate);
        } else {
            (this.byId("vsdFilterLabel") as sap.m.Text).setText(filteringString); 
        };

    }
  
    private filterDocListTable(filters: any[]) {
        if (filters.length > 0) {
            (this.getView().byId("documentsTable").getBinding("items") as any).filter(
                new sap.ui.model.Filter({filters: filters, and: true}), "Application");
        } else {
            (this.getView().byId("documentsTable").getBinding("items") as any).filter(null);
        }
    }

    private prepareDtRangeFilter(fromDt, toDt, filters: any[]) {
        if (fromDt && toDt) {
            filters.push(new sap.ui.model.Filter('created', function (createdDt) {
                if (createdDt) {
                    const dt = typeof (createdDt) == 'string' ? new Date(createdDt) : createdDt;
                    return dt && dt >= fromDt && dt <= toDt;
                }
                return false;
            }));
        }
    }

    private prepareStatusDocTypeFilter(mParams, filters: any[]) {
        ['status', 'documentType'].forEach((keyName) => {
            if (mParams.filterCompoundKeys && mParams.filterCompoundKeys.hasOwnProperty(keyName)) {
                const _filter = mParams.filterCompoundKeys[keyName];
                filters.push(new sap.ui.model.Filter(keyName, function (_key) {
                    return _key && _filter.hasOwnProperty(_key) && _filter[_key];
                }));
            }
        });
    }

    handleFilterDialogCancel(oEvent) {
        const _value = 'filterDateRange' in this._mViewSettingsDialogs ? this._mViewSettingsDialogs['filterDateRange'] : null;
        oEvent.getSource().getFilterItems()[1].getCustomControl().setValue(_value);
        this.handleFilterDateChange(oEvent);
    }

    onListItemPress(oEvent) {
        const oNextUIState = (this.getOwnerComponent() as InvoiceViewerComponentClass).getHelper().getNextUIState(1);
        const ctx = oEvent.getParameter('listItem').getBindingContext("documents");
        const selectedDocId = ctx.getProperty('id');

        ctx.getModel().setProperty('/selectedId', selectedDocId);

        this.oRouter.navTo("detail", {layout: oNextUIState.layout, document: selectedDocId});
    }

    handleFilterButtonPressed(oEvent) {
        const oDialog = this.createViewSettingsDialog(MASTER_FILTER_DIALOG_VIEW);
        const _value = 'filterDateRange' in this._mViewSettingsDialogs ? this._mViewSettingsDialogs['filterDateRange'] : null;
        oDialog.getFilterItems()[1].getCustomControl().setValue(_value);
        this.handleFilterDateChange(oEvent);
        const supportedDocumentTypes = this.getOwnerComponent().getModel("supportedDocumentTypes").getObject("/");
        const documentTypeFilter = oDialog.getFilterItems()[0] as sap.m.ViewSettingsFilterItem;
        if(documentTypeFilter.getItems().length === 0) {
            for (const item of supportedDocumentTypes) {
                documentTypeFilter.addItem(new sap.m.ViewSettingsItem({
                    key: (item.name as string).toUpperCase(),
                    text: this.formatDocumentType(item.name)
                }));
            }
        }
        oDialog.open();
    }

    onExit() {
        let oDialogKey, oDialogValue;

        for (oDialogKey in this._mViewSettingsDialogs) {
            oDialogValue = this._mViewSettingsDialogs[oDialogKey];

            if (oDialogValue && oDialogKey !== 'filterDateRange') {
                this.getView().removeDependent(oDialogValue);
                oDialogValue.destroy();
            }
        }

        this._mViewSettingsDialogs = {};
    }
}

export const MasterController = smartExtend(BaseController, "sap.bdp.components.invoiceviewer.controller.Master", MasterControllerClass);
sap.ui.define("sap/bdp/components/invoiceviewer/controller/Master.controller", [
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    'sap/ui/model/Sorter',
    'sap/m/MessageBox',
    "sap/ui/core/Fragment"
], () => MasterController);
