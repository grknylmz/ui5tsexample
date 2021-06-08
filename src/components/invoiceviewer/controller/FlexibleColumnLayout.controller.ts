import {
    BaseController,
    BaseControllerClass,
    smartExtend,
} from "../../basecomponent/controller/BaseController.controller";
import {InvoiceViewerComponentClass} from "../Component";

class FlexibleColumnLayoutControllerClass extends BaseControllerClass {
    private router: sap.ui.core.routing.Router;
    private currentRouteName: any;
    private currentProduct: any;
    private currentSupplier: any;

    onInit() {
        require("../css/styles.css");
        this.router = sap.ui.core.UIComponent.getRouterFor(this);
        this.router.attachRouteMatched(this.onRouteMatched, this);
        this.router.attachBeforeRouteMatched(this.onBeforeRouteMatched, this);
        sap.ui.getCore().getEventBus().subscribe(
            'ShellChannel',
            'ClientChanged',
            () => this.router.navTo("master", {}),
            this);
    }

    onBeforeRouteMatched(oEvent) {

        const oModel = this.getOwnerComponent().getModel();

        let sLayout = oEvent.getParameters().arguments.layout;

        // If there is no layout parameter, query for the default level 0 layout (normally OneColumn)
        if (!sLayout) {
            const oNextUIState = (this.getOwnerComponent() as InvoiceViewerComponentClass).getHelper().getNextUIState(0);
            sLayout = oNextUIState.layout;
        }

        // Update the layout of the FlexibleColumnLayout
        if (sLayout) {
            oModel.setProperty("/layout", sLayout);
        }
        sap.ui.getCore().setModel(new sap.ui.model.json.JSONModel({"rootPage": "invoiceviewer"}), "rootPage");
    }

    onRouteMatched(oEvent) {
        const sRouteName = oEvent.getParameter("name"),
            oArguments = oEvent.getParameter("arguments");

        this._updateUIElements();

        // Save the current route name
        this.currentRouteName = sRouteName;
        this.currentProduct = oArguments.product;
        this.currentSupplier = oArguments.supplier;
    }

    onStateChanged(oEvent) {
        const bIsNavigationArrow = oEvent.getParameter("isNavigationArrow"),
            sLayout = oEvent.getParameter("layout");

        this._updateUIElements();

        // Replace the URL with the new layout if a navigation arrow was used
        if (bIsNavigationArrow) {
            this.router.navTo(this.currentRouteName, {
                layout: sLayout,
                product: this.currentProduct,
                supplier: this.currentSupplier
            }, true);
        }
    }

    // Update the close/fullscreen buttons visibility
    _updateUIElements() {
        const oModel = this.getOwnerComponent().getModel() as sap.ui.model.json.JSONModel;
        const oUIState = (this.getOwnerComponent() as InvoiceViewerComponentClass).getHelper().getCurrentUIState();
        oModel.setData(oUIState);
    }

    onExit() {
        this.router.detachRouteMatched(this.onRouteMatched, this);
        this.router.detachBeforeRouteMatched(this.onBeforeRouteMatched, this);
    }

}

export const FlexibleColumnLayoutController = smartExtend(BaseController, "sap.bdp.components.invoiceviewer.controller.FlexibleColumnLayout", FlexibleColumnLayoutControllerClass);
sap.ui.define("sap/bdp/components/invoiceviewer/controller/FlexibleColumnLayout.controller", [
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/mvc/Controller",
], () => FlexibleColumnLayoutController);
