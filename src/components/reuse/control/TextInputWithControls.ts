import {Parser} from "../utility/Parser";
import { AbstractInputWithControls } from "./AbstractInputWithControls";
import {InvalidNumberStringError} from "./InputWithControlError";

declare const jQuery: any;
jQuery.sap.declare("sap.bdp.components.reuse.control.TextInputWithControls");

AbstractInputWithControls.extend("sap.bdp.components.reuse.control.TextInputWithControls", {
    metadata: {
        properties: {
            ...AbstractInputWithControls.getMetadata().properties,
            type: {
                type : "string",
                defaultValue : "Text",
            },
        },
        events: {
            saveButtonPress: {},
            onInputBoxClick: {
                parameters: {},
            },
        },
    },
    fragment: require("./InputWithControls.control.xml"),

    initInput: function() {
        this.input = this.byId("textInput");
        this.input.setVisible(true);
        this.input.setType(this.getProperty("type"));
        this.input.setShowSuggestion(false);
        this.input.oninput = oEvent => {
            if (oEvent.target.checkValidity()) {
                this.updateValue(oEvent.target.value);
            } else {
                this.input.setValueState(sap.ui.core.ValueState.Error);
            }
        };
    },

    postRendering: function() {
        this.input.$().find("input")[0].autocomplete = "off"
        this.input.ontap = oEvent => {
            this.fireEvent("onInputBoxClick", {});
        };
    },

    /*
    * Overrides setType method of the component to set this text in the button
    */
    setType: function(sType: string) {
        this.input.setType(sType);
    },

    getType: function() {
        return this.input.getType();
    },

    validateValue: function(value: string) {
        if (this.input.getType() === sap.m.InputType.Number) {
            const floatValue = Parser.parseFloat(value);
            if (floatValue === null && value !== '') {
                throw new InvalidNumberStringError(`${value} is not valid number`);
            }
            return value;
        }
        return value;
    },
});

export const TextInputWithControls = sap.bdp.components.reuse.control.TextInputWithControls;
