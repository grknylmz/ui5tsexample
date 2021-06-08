import {Account, IDocumentType, IExtractionField} from "../../../../@types/bdp";
import {
    BaseController,
    BaseControllerClass,
    smartExtend,
} from "../../basecomponent/controller/BaseController.controller";
import {Constants} from "../../reuse/utility/Constants";
import {Logger} from "../../reuse/utility/Helper";
import {ServiceCall} from "../../reuse/utility/ServiceCall";
import "../utility/WebpackLoader";
import { DoxClient } from "../../reuse/utility/DoxClient";
declare var Help4: any;

export class MainControllerClass extends BaseControllerClass {
    private router: sap.m.routing.Router;
    public oHelp: any;

    onInit() {
        const routerJson = require("./routing.json");
        const comp: any = new sap.ui.core.UIComponent("shell");

        sap.ui.getCore().setModel(new sap.ui.model.json.JSONModel({"rootPage": "invoiceviewer"}), "rootPage");
        sap.ui.getCore().setModel(new sap.ui.model.json.JSONModel({
            template: false,
        }), "features");
        sap.ui.require(["sap/m/MessageBox"], () =>{
            Promise.all([this.loadAccount(), this.loadCapabilites(), this.loadClient(), this.isTemplateFeatureAvailable()]).then(result => {
                sap.ui.getCore().getModel("features").setProperty("/template", result[3]);
                this.router = new sap.m.routing.Router(routerJson.routes, routerJson.config, comp, routerJson.targets);
                comp._oRouter = this.router;
                this.router.initialize();
                if (this.router.getHashChanger().getHash() === "" || !result[3]) {
                    this.router.getHashChanger().replaceHash("invoiceviewer");
                }
            });
        });
        sap.ui.getCore().applyTheme((localStorage.getItem("userTheme") || "sap_fiori_3"));
        // this.isTemplateFeatureAvailable();
        const bundleName = require("../i18n/i18n.properties");
        this.getView().setModel(
            new sap.ui.model.resource.ResourceModel({
                bundleName,
            }),
            "i18n",
        );

        sap.ui.core.IconPool.registerFont({
            fontFamily: "SAP-icons-TNT",
            fontURI: sap.ui.require.toUrl("sap/tnt/themes/base/fonts/"),
            lazy: true
        });
    }

    onAfterRendering() {
        sap.ui.getCore().getEventBus().subscribe(
            "security",
            "permissionDenied",
            this.showPermissionDenied,
            this);
    }

    hasTemplatePermission(permission: string, account: {permissions: string[]}, templateFeatureEnabled: boolean) {
        return this.hasPermission(permission, account) && templateFeatureEnabled;
    }

    showPermissionDenied(sChannelId, sEventId, sData) {
        const PermissionDeniedDialog: any = this.byId("PermissionDeniedDialogControl");
        if (!PermissionDeniedDialog.isOpen()) {
            PermissionDeniedDialog.setVisible(true);
            PermissionDeniedDialog.open();
        }
    }

    isTemplateFeatureAvailable() {
        return DoxClient.getTemplateInfoById().then((data) => {
            return true;
        }).catch(error => {
            Logger.logError(error);
            return false;
        })
    }

    loadAccount(): Promise<boolean> {
        let account: Account;
        return ServiceCall.get(`${Constants.API_BASE_URL}account`, {
            headers: {
                "X-CSRF-Token": "Fetch",
            },
        }).then((response: any) => {
            localStorage.setItem("csrf_token", response.xhr.getResponseHeader("X-Csrf-Token"));
            account = response.data;
            const accountModel = new sap.ui.model.json.JSONModel(account);
            sap.ui.getCore().setModel(accountModel, "account");
            return true;
        }).catch(error => {
            Logger.logError(error);
            return false;
        });
    }

    loadCapabilites(): Promise<boolean> {
        return ServiceCall.get(`${Constants.API_BASE_URL}capabilities`).then((response: any) => {
            const allCapabilities = response.data;

            const documentTypesModel = new sap.ui.model.json.JSONModel(this.getDocumentTypes(allCapabilities));
            sap.ui.getCore().setModel(documentTypesModel, "supportedDocumentTypes");

            const extractionFieldsModel = new sap.ui.model.json.JSONModel(this.getExtractionFields(allCapabilities));
            sap.ui.getCore().setModel(extractionFieldsModel, "supportedExtractionFields");
            return true;
        }).catch(error => {
            Logger.logError(error);
            let msg = "Please check your connection";
            try {
                msg = error[0].responseJSON.message;
            } catch (e) {
                Logger.logError(e);
            }
            sap.m.MessageBox.error(`Failed to load capabilities: ${msg}`);
            return false;
        });
    }

    loadClient(): Promise<boolean> {
        return new Promise(resolve => {
            // @ts-ignore
            const doxClient = JSON.parse((localStorage.getItem("doxClient") || "{}"));
            if (doxClient && doxClient.id) {
                Constants.CLIENT_ID = doxClient.id;
                sap.ui.getCore().setModel(new sap.ui.model.json.JSONModel(doxClient), "doxClient");

                ServiceCall.get(`${Constants.API_BASE_URL}clients?limit=50000&clientIdStartsWith=${Constants.CLIENT_ID}`, {
                    timeout: 3000,
                }).then((response: any) => {
                    if (response.status === "success") {
                        if ((response.data.payload || []).filter(client => {
                            if (client && client.clientId === Constants.CLIENT_ID) {
                                this.saveChoiceToLocalStorage(client);
                                return true;
                            }
                            return false;
                        }).length === 0) {
                            this.useFirstClient().then((bSuccess) => {
                                if (bSuccess) {
                                    sap.m.MessageBox.warning("Previously used client is not valid anymore, the system is using the first valid client available.");
                                }
                            });
                        }
                    } else {
                        sap.m.MessageBox.error("There's error in initializing the client");
                    }
                });
            } else {
                this.useFirstClient();
            }
            this.notifyUpdateDocList();
            resolve(true);
            return true;
        });
    }

    notifyUpdateDocList() {
        sap.ui.getCore().getEventBus().publish(
            "InvoiceViewerChannel",
            "DocumentUpload",
            {"msg": "Document uploaded"});
    }

    saveChoiceToLocalStorage(client) {
        // @ts-ignore
        localStorage.setItem("doxClient", JSON.stringify({
            id: client.clientId,
            name: client.clientName,
        }));
        sap.ui.getCore().setModel(new sap.ui.model.json.JSONModel({
            id: client.clientId,
            name: client.clientName,
        }), "doxClient");
    }

    useFirstClient() {
        return ServiceCall.get(`${Constants.API_BASE_URL}clients?limit=1`, {
            timeout: 3000,
        }).then((response: any) => {
            const client = (response.data.payload || [])[0];
            if (client && client.clientId) {
                Constants.CLIENT_ID = client.clientId;
                // @ts-ignore
                // sap.ui.util.Storage.put("doxClient", {id: client.clientId, name: client.clientName});
                localStorage.setItem("doxClient", JSON.stringify({id: client.clientId, name: client.clientName}));
                sap.ui.getCore().setModel(new sap.ui.model.json.JSONModel({
                    id: client.clientId,
                    name: client.clientName,
                }), "doxClient");
                return true;
            } else {
                sap.m.MessageBox.error("There's no available client");
                return false;
            }
        });
    }

    getDocumentTypes(allCapabilities: any): IDocumentType[] {
        const documentTypes = [];
        for (const documentType of allCapabilities.documentTypes) {
            documentTypes.push({
                name: documentType,
            });
        }
        return documentTypes;
    }

    getExtractionFields(allCapabilities: any): any {
        const headerFields = [];
        for (const headerField of allCapabilities.extraction.headerFields) {
            headerFields.push(this.createExtractionFieldFromMap(headerField, true));
        }
        const lineItemFields = [];
        for (const lineItemField of allCapabilities.extraction.lineItemFields) {
            lineItemFields.push(this.createExtractionFieldFromMap(lineItemField, false));
        }
        return {
            "headerFields": headerFields,
            "lineItemFields": lineItemFields,
        };
    }

    createExtractionFieldFromMap(field: any, isHeaderField: boolean): IExtractionField {
        return {
            name: field.name,
            type: field.type,
            category: field.category,
            supportedDocumentTypes: field.supportedDocumentTypes,
            // i18IdForLabel: `${prefix}_${field.name}_label`,
            // i18IdForDescription: `${prefix}_${field.name}_desc`,
            // i18IdForCategoryLabel: `${prefix}_category_${field.category}_label`,
            fieldGroup: isHeaderField ? Constants.GROUP_HEADER_FIELDS : Constants.GROUP_LINE_ITME_FIELDS,
        };
    }

    onUserNamePress() {
        const userInfoDialog: any = this.byId("UserInfoDialog");
        userInfoDialog.setVisible(true);
        userInfoDialog.open();
    }

    onCloseUserInfo(){
        const userInfoDialog: any = this.byId("UserInfoDialog");
        userInfoDialog.close();
        userInfoDialog.setVisible(false);
    }

    onUserSettingPress() {
        const userSettingDialog = this.byId("UserSettingDialog") as sap.m.Dialog;
        const radioGroupTheme = this.byId("radioGroupTheme") as sap.m.RadioButtonGroup;

        radioGroupTheme.setSelectedIndex(Constants.SUPPORTED_THEMES.indexOf(localStorage.getItem("userTheme") || 'sap_fiori_3'));
        userSettingDialog.setVisible(true);
        userSettingDialog.open();
    }

    onUserSettingApply() {
        const userSettingDialog = this.byId("UserSettingDialog") as sap.m.Dialog;
        const radioGroupTheme = this.byId("radioGroupTheme") as sap.m.RadioButtonGroup;
        const theme = Constants.SUPPORTED_THEMES[radioGroupTheme.getSelectedIndex()]
        sap.ui.getCore().applyTheme(theme)
        localStorage.setItem("userTheme", theme);
        userSettingDialog.close();
        userSettingDialog.setVisible(false);
    }

    onUserSettingCancel() {
        const userSettingDialog = this.byId("UserSettingDialog") as sap.m.Dialog;
        userSettingDialog.close();
        userSettingDialog.setVisible(false);
    }

    onChangeClientPress(oEvent) {

        const oDialog = this.byId('selClientDlg') as sap.m.Dialog;
        oDialog.setBusyIndicatorDelay(1);
        oDialog.open();
        oDialog.setBusy(true);
        ServiceCall.get(`${Constants.API_BASE_URL}clients?limit=50000`, {
            timeout: 3000
        }).then((response: any) => {
            if (response.status === "success") {
                oDialog.setModel(new sap.ui.model.json.JSONModel({'Clients': response.data.payload || []}));
            } else {
                sap.m.MessageToast.show("There's error during client id retrieval.");
            }
        }).finally(() => {
            oDialog.setBusy(false);
        });

    }

    confirmClient(oEvent) {
        const aContexts = oEvent.getParameter("selectedContexts");
        if (aContexts && aContexts.length) {
            aContexts.map((oContext) => {
                if (oContext.getObject().clientId) {
                    Constants.CLIENT_ID = oContext.getObject().clientId;
                    sap.ui.getCore().getEventBus().publish(
                        'ShellChannel',
                        'ClientChanged',
                        {'msg': 'Document uploaded'});
                    // @ts-ignore
                    //sap.ui.util.Storage.put("doxClient",
                    //    {id: Constants.CLIENT_ID, name: oContext.getObject().clientName});
                    localStorage.setItem("doxClient",
                        JSON.stringify({id: Constants.CLIENT_ID, name: oContext.getObject().clientName}));
                    this.getView().setModel(new sap.ui.model.json.JSONModel({
                        id: Constants.CLIENT_ID,
                        name: oContext.getObject().clientName
                    }), "doxClient");
                }
            });
            const chosenClient = aContexts.map(function (oContext) {
                return `${oContext.getObject().clientName} (${oContext.getObject().clientId})`;
            }).join(", ");
            sap.m.MessageToast.show(`You have chosen ${chosenClient}`);
        }
    }

    onSearch(oEvent) {
        const sValue = oEvent.getParameter("value");
        const oBinding = oEvent.getParameter("itemsBinding");
        oBinding.filter(new sap.ui.model.Filter({
            filters:
                [new sap.ui.model.Filter("clientId", sap.ui.model.FilterOperator.Contains, sValue),
                    new sap.ui.model.Filter("clientName", sap.ui.model.FilterOperator.Contains, sValue)],
            and: false
        }));
    }

    onLogout() {
        sap.m.URLHelper.redirect("/logout");
    }

    onHelpPress() {
        if(!this.oHelp) {
            this.oHelp = Help4.init({

                //---[Generic Integration]---
                type: 'ui5',
                resourceUrl: 'https://webassistant.enable-now.cloud.sap/web_assistant/framework/',

                //---[Backend Configuration]---
                serviceLayerVersion: 'UACP',
                isUACP2: true,
                buttonId: 'doxrootapp--helpButton',
                stateUACP: 'PRODUCTION', // 'DRAFT' or 'PRODUCTION' or 'TEST',
                dataUrlUACP: '/sap/dfa/help/webassistant',
                mediaUrlUACP: 'https://help.sap.com/doc',
                

                //---[Central Configuration]---
                editor: false,
                language: 'en-US',
                carouselOrientation: 'horizontal',
                multipage: true, 

                //---[Content Configuration]---
                product: 'DOCUMENT_INFORMATION_EXTRACTION',
                version: 'SHIP',
                appName: 'document-information-extraction-ui',

                //---[Theme]---
                theme: 'sfsf', //default, hcb, light, sfsf

                //---[Callback Configuration]---
                onHelpBusy: (busy) => {},
                onHelpAvailable: (bAvailable) => {},
                onHelpMinimized: function (bMinimized) {},
                onHelpActive: function (bActive) {},
                onHelpMode: function (mode) {},
                onHelpCarousel: function (bCarousel) {},
                getEnvironmentInfo: function () {},
                onHelpRequireIndent: function (bIndent, indentWidth) {
                    if (bIndent) {
                      document.documentElement.style.marginRight = indentWidth + "px";
                    } else {
                      document.documentElement.style.marginRight = "0";
                    }
                },
                selectors: null
            });  
        }
        this.oHelp.toggle(); 
    }


    onGuidePress() {
        sap.m.URLHelper.redirect("https://help.sap.com/viewer/bad5390e4c4541f2a8d39a74b1d1cdb5/SHIP" +
            "/en-US/f448937bcb3843648f8ab31c043ba679.html#loiob722fe7170af4dd8b171f8394f4376d5", true);
    }

    onDocumentationPress() {
        sap.m.URLHelper.redirect("https://help.sap.com/viewer/product/DOCUMENT_INFORMATION_EXTRACTION", true);
    }

    onCollapseExpandPress() {
        const oToolPage: any = this.byId("toolPage");
        oToolPage.setSideExpanded(!oToolPage.getSideExpanded());
    }

    onItemSelect(oEvent) {
        const key = oEvent.getParameter("item").getKey();
        //const oNextUIState = (this.getOwnerComponent() as InvoiceViewerComponentClass).getHelper().getNextUIState(0); // TODO
        this.router.navTo(key);
    }
}

export const ShellController = smartExtend(BaseController, "sap.bdp.components.shell.controller.Shell", MainControllerClass);

sap.ui.define("sap/bdp/components/shell/controller/Shell.controller", [], function() {
    return ShellController;
});
