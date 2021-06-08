import {
    Starter
} from "./Starter";

sap.ui.getCore().attachInit(async function() {
    patch();
    const app = new Starter("ML-DOX");
    try {
        newApp(app);
    } catch (err) {
        console.error(err);
    }

    function newApp(app) {
        $("body").addClass("sapUiSizeCompact");
        const myApp = new sap.m.App("myApp", {});
        const page1 = app.getControl();
        myApp.addPage(page1);
        myApp.placeAt("content");
    }
});

function patch() {
    const assert = console.assert;
    console.assert = (...args) => {
        if (args.length === 2 && args[0] === false && typeof args[1] === "string" &&
            args[1].startsWith("could not find any translatable text for key '")) {
            return;
        }
        assert(...args);
    }
}