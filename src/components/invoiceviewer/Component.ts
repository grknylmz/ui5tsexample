import {BaseComponent, BaseComponentClass, smartExtendComponent} from "../basecomponent/BaseComponent";

export class InvoiceViewerComponentClass extends BaseComponentClass {

    public init(): void {
        BaseComponentClass.prototype.init.apply(this, arguments);
        const oModel = new sap.ui.model.json.JSONModel();
        this.setModel(oModel);
        this.getRouter().attachRouteMatched(null, (event) => {
        });
        this.getRouter().initialize();
    }

    public createContent(): sap.ui.core.mvc.View {
        return sap.ui.view({
            viewName: "sap.bdp.components.invoiceviewer.view.FlexibleColumnLayout",
            type: "XML",
        });
    }

    /**
     * Returns an instance of the semantic helper
     * @returns {sap.f.FlexibleColumnLayoutSemanticHelper} An instance of the semantic helper
     */
    public getHelper(): sap.f.FlexibleColumnLayoutSemanticHelper {
        const oFCL = this.getRootControl().byId("fcl") as sap.f.FlexibleColumnLayout,
            oParams = jQuery.sap.getUriParameters(),
            oSettings = {
                defaultTwoColumnLayoutType: sap.f.LayoutType.TwoColumnsMidExpanded,
                defaultThreeColumnLayoutType: sap.f.LayoutType.ThreeColumnsMidExpanded,
                mode: oParams.get("mode"),
                initialColumnsCount: oParams.get("initial"),
                maxColumnsCount: oParams.get("max"),
            };

        // RISK: This will make Flexible column layout always opens in at max 2 column mode even on a desktop
        oFCL.getMaxColumnsCount = function() {
            const maxColumnCount = this.__proto__.getMaxColumnsCount.apply(this, arguments)
            return maxColumnCount >= 2 ? 2 : maxColumnCount;
        }
        return sap.f.FlexibleColumnLayoutSemanticHelper.getInstanceFor(oFCL, oSettings);
    }

    public getI18ResourceForId(key: string): string {
        const oResourceBundle = this.getModel('i18n');
        const ret: string = oResourceBundle.getResourceBundle().getText(key);
        return ret === key ? key : ret;
    }
}

export const InvoiceViewerComponent = smartExtendComponent(BaseComponent, "sap.bdp.components.invoiceviewer", InvoiceViewerComponentClass, {manifest: "json"});

sap.ui.define("sap/bdp/components/invoiceviewer/Component", [
    "sap/ui/core/UIComponent",
    "sap/ui/model/json/JSONModel",
    "sap/f/FlexibleColumnLayoutSemanticHelper",
    "sap/f/FlexibleColumnLayout"
], function () {
    require("./view/Detail.view.xml");
    require("./view/DetailDetail.view.xml");
    require("./view/FlexibleColumnLayout.view.xml");
    require("./view/Master.view.xml");
    require("./view/MasterFilterDialog.fragment.xml");
    require("./view/MasterSortDialog.fragment.xml");
    require("./view/Settings.view.xml");
    require("./view/UploadDocument.view.xml");
    require("./view/ReviewPage.fragment.xml");
    return InvoiceViewerComponent;
});
