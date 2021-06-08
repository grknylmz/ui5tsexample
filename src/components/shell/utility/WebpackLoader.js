function pathOnly(href) {
    var p = href.search(/[?#]/);
    return p < 0 ? href : href.slice(0, p);
}

// Inject WebPack loading to SAPUI5 LoaderExtensions. Currently we only inject the async flows
sap.ui.define("sap/bdp/components/shell/utility/WebpackLoader", ["sap/base/util/LoaderExtensions"], function(LoaderExtensions) {
    var oldloadResource = LoaderExtensions.loadResource;
    LoaderExtensions.loadResource = function(sResourceName, mOptions) {
        var async = false;
        if (typeof sResourceName === "string") {
            async = mOptions && mOptions.async;
        } else {
            async = sResourceName && sResourceName.async;
        }
        if (async) {
            return loadChunk(sResourceName, mOptions).then((m) => m || oldloadResource(sResourceName, mOptions));
        }
        return oldloadResource(sResourceName, mOptions);
    }
});
async function loadChunk(sResourceName, mOptions) {
    if (typeof sResourceName === "string") {
        mOptions = mOptions || {};
    } else {
        mOptions = sResourceName || {};
        sResourceName = mOptions.name;
    }
    if (!sResourceName) {
        // Note: this is simplified and very heuristic variant of ui5loader.guessResourceName - which I unfortunately can't use directly
        sResourceName = pathOnly(mOptions.url);
        var i = sResourceName.indexOf("/components/");
        sResourceName = "sap/bdp" + sResourceName.substring(i);
    }
    switch (sResourceName) {
        case "sap/bdp/components/invoiceviewer/manifest.json":
            await
            import ( /* webpackChunkName: "invoiceviewer" */ "../../invoiceviewer/manifest.json");
            break;
        case "sap/bdp/components/template/manifest.json":
            await
            import ( /* webpackChunkName: "template" */ "../../template/manifest.json");
            break;
    }
    return null; // As content is SAPUI5 preloaded, the original loader will now find it.
}