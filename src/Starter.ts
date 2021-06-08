import xml2js from "xml2js";

export class Starter {
    protected oView: sap.ui.core.mvc.XMLView;
    private idField: string;

    constructor(id: string) {
        this.idField = id;
        this.preload();
    }

    preload() {
    }

    id(id: string) {
        return this.idField + "---" + id;
    }

    init() {
        const viewName = require("./components/shell/view/Shell.view.xml");
        this.oView = sap.ui.view({
            id: "doxrootapp",
            type: sap.ui.core.mvc.ViewType.XML,
            viewName,
        });

    }

    getControl() {
        if (!this.oView) {
            this.init();
        }
        return this.oView;
    }

}
