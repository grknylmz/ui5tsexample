import {
    BaseController,
    BaseControllerClass,
    smartExtend
} from "../../basecomponent/controller/BaseController.controller";

class SettingsControllerClass extends BaseControllerClass {
    
    protected oRouter: sap.ui.core.routing.Router;
    protected _bDescendingSort: boolean;

    onInit() {
        this.oRouter = sap.ui.core.UIComponent.getRouterFor(this);
        this._bDescendingSort = false;
    }
}

export const SettingsController = smartExtend(BaseController, "sap.bdp.components.invoiceviewer.controller.Settings", SettingsControllerClass);
sap.ui.define("sap/bdp/components/invoiceviewer/controller/Settings.controller", [
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    'sap/ui/model/Sorter',
    'sap/m/MessageBox'
], () => SettingsController);
