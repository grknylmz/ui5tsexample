import * as R from "ramda";
import { Constants } from "../utility/Constants";

declare const jQuery: any;
jQuery.sap.declare("sap.bdp.components.reuse.control.AbstractInputWithControls");

type ErrorChecker = (value: string, page: number, bbox: sap.bdp.components.reuse.control.Bbox) => string|undefined;
const defaultValue: string = "";
const defaultStatus: string = "";
const defaultPage: number = 1;
const defaultBbox: sap.bdp.components.reuse.control.Bbox = {"x": 0.0, "y": 0.0, "w": 0.0, "h": 0.0};
sap.ui.core.XMLComposite.extend("sap.bdp.components.reuse.control.AbstractInputWithControls", {

    metadata: {
        properties: {
            value: {
                type: "string",
                defaultValue: defaultValue,
            },
            oldValue: {
                type: "string",
                defaultValue: defaultValue,
            },
            bbox: {
                type: "object",
                defaultValue: defaultBbox,
            },
            oldBbox: {
                type: "object",
                defaultValue: defaultBbox,
            },
            page: {
                type: "int",
                defaultValue: defaultPage,
            },
            oldPage: {
                type: "int",
                defaultValue: defaultPage,
            },
            editable: {
                type: "boolean",
                defaultValue: true,
            },
            showButton: {
                type: "boolean",
                defaultValue: true,
            },
            inputWidth: {
                type: "string",
                defaultValue: "10em",
            },
            errorChecker: {
                type: "function",
                defaultValue: () => undefined,
            },
            confidence: {
                type:"object",
                defaultValue: null,
            },
            status: {
                type:"string",
                defaultValue: defaultStatus,
            }
        },
        events: {
            saveButtonPress: {
                parameters : {
                    value: {type: "string"},
                    bbox: {type: "object"},
                    onSaveSuccessful: {type: "function"},
                    onSaveFailed: {type: "function"},
                },
            },
            changeValue: {
                parameters: {
                    value: {type: "string"},
                    bbox: {type: "object"},
                    page: {type: "int"},
                },
            },
        },
    },
    fragment: require("./InputWithControls.control.xml"),

    init: function() {
        sap.ui.core.XMLComposite.prototype.init.apply(this, arguments);
        this.initInput();
        this.input.setWidth(this.getWidth());
        this.input.setFieldGroupIds(['extrationField']);
        (this.input).setLayoutData(new sap.m.FlexItemData({"growFactor": 1}))
        this.byId("outerBox").insertItem(this.input);
        this.setModel(new sap.ui.model.json.JSONModel({
            confidence: null,
        }));
    },

    initInput: function() {
        throw Error("Method not implemented");
    },

    postRendering: function() {
        throw Error("Method not implemented");
    },

    onAfterRendering: function() {
        this.setValue(this.getValue());
        this.setEditable(this.getProperty("editable"));
        this.input.setShowValueStateMessage(false);
        this.postRendering();
        this.byId("saveBtn").setVisible(this.getProperty("showButton"));
        this.byId("cancelBtn").setVisible(this.getProperty("showButton"));
        this.refreshState();
    },

    setValue: function(value: string) {
        this.setProperty("value", value);
        if(value === Constants.EMPTY_VALUE_PLACEHOLDER) {
            this.input.setPlaceholder(Constants.EMPTY_VALUE_PLACEHOLDER_TEXT)
            this.input.setValue("")
        } else {
            this.input.setPlaceholder("")
            this.input.setValue(value);
        }
        this.refreshState();
    },

    setOldValue: function(value: string) {
        this.setProperty("oldValue", value);
        this.refreshState();
    },

    setBbox: function(bbox: object) {
        this.setProperty("bbox", bbox);
        this.refreshState();
    },

    setOldBbox: function(bbox: object) {
        this.setProperty("oldBbox", bbox);
        this.refreshState();
    },
    
    setConfidence: function(confidence: object){
        this.setProperty("confidence", confidence)
        this.getModel().setProperty("/confidence", confidence)   
    },

    decodeTooltip(confidence){
        if (this.getProperty("status") !== "CONFIRMED"){
            if (confidence != null && typeof confidence.confidence === "undefined") {
                return ``
            } else if(confidence != null && confidence.value === null){
                return `Confidence: NA`
            } else if (confidence != null) {
                const formattedConfidence = Math.round((confidence.confidence + Number.EPSILON) * 100) / 100
                const roundedConfidence = formattedConfidence*100
                return `Confidence: ${roundedConfidence}%`
            } 
        } else return ``
    },

    setPage: function(page: number) {
        this.setProperty("page", page);
        this.refreshState();
    },

    setOldPage: function(page: number) {
        this.setProperty("oldPage", page);
        this.refreshState();
    },

    getErrorChecker: function(): ErrorChecker {
        return this.getProperty("errorChecker");
    },

    setErrorChecker: function(checker: ErrorChecker) {
        this.setProperty("errorChecker", checker);
    },

    setValueState: function(state: sap.ui.core.ValueState) {
        this.input.setValueState(state);
    },

    setEditable: function(editable: boolean) {
        this.setProperty("editable", editable);
        this.input.setEditable(editable);
    },

    onSaveButtonPress: function() {
        this.fireEvent("saveButtonPress", {
            value: this.getValue(),
            onSaveSuccessful: this.onSaveSuccessful.bind(this),
            onSaveFailed: this.onSaveFailed.bind(this),
        });
    },

    onSaveSuccessful: function() {
        this.setValueState(sap.ui.core.ValueState.None);
        this.oldValue = this.getValue();
        this.refreshState();
    },

    onSaveFailed: function() {
        this.setValueState(sap.ui.core.ValueState.Error);
    },

    onCancelButtonPress: function() {
        this.setValueState(sap.ui.core.ValueState.None);
        this.setValue(this.oldValue);
        this.refreshState();
    },

    validateValue: function(newValue) {
        return newValue;
    },

    updateValue: function(newValue, bbox, page) {
        newValue = this.validateValue(newValue);
        this.setValue(newValue);
        if (page !== undefined) {
            this.setPage(page);
        }
        if (bbox !== undefined) {
            this.setBbox(bbox);
        }
        this.refreshState();
        if (this.notificationTimerId > 0) {
            clearTimeout(this.notificationTimerId);
        }
        this.notificationTimerId = setTimeout(() => {
            this.notifyValueChange(null);
            this.notificationTimerId = -1;
        },1000)
    },

    notifyValueChange: function(oEvent) {
        this.fireEvent("changeValue", {
            "value": this.getValue(),
            "page": this.getPage(),
            "bbox": this.getBbox(),
        });
    },

    refreshState: function() {
        const checker: ErrorChecker = this.getProperty("errorChecker");
        const error = checker(this.getValue(), this.getPage(), this.getBbox());
        if (error === undefined) {
            const hasValueChanged = !(R.equals(this.getValue(), this.getOldValue()) &&
                R.equals(this.getBbox(), this.getOldBbox()) &&
                R.equals(this.getPage(), this.getOldPage()));
            this.setValueState(hasValueChanged ? sap.ui.core.ValueState.Information : sap.ui.core.ValueState.None);
            this.input.setValueStateText(null);
            this.input.setShowValueStateMessage(false);
            this.byId("saveBtn").setEnabled(hasValueChanged);
            this.byId("cancelBtn").setEnabled(hasValueChanged);
        } else {
            this.setValueState(sap.ui.core.ValueState.Error);
            this.input.setValueStateText(error);
            this.input.setShowValueStateMessage(true);
            this.byId("saveBtn").setEnabled(false);
            this.byId("cancelBtn").setEnabled(true);
        }
    },

    focus: function() {
        this.input.focus(true);
    },
});

export const AbstractInputWithControls = sap.bdp.components.reuse.control.AbstractInputWithControls;
