import {Parser} from "../utility/Parser";
import { AbstractInputWithControls } from "./AbstractInputWithControls";
import {InvalideDateStringError} from "./InputWithControlError";

declare const jQuery: any;
jQuery.sap.declare("sap.bdp.components.reuse.control.DatePickerWithControls");

AbstractInputWithControls.extend("sap.bdp.components.reuse.control.DatePickerWithControls", {
    metadata: {
        properties: {
            ...AbstractInputWithControls.getMetadata().properties,
            valueFormat: {
                type: "string",
                defaultValue: "yyyy-MM-dd",
            },
            displayFormat: {
                type: "string",
                defaultValue: "yyyy-MM-dd",
            },
        },
        events: {
            ...AbstractInputWithControls.getMetadata().events,
            onInputBoxClick: {
                parameters: {},
            },
        },
    },
    fragment: require("./InputWithControls.control.xml"),

    initInput: function() {
        this.input = this.byId("dateInput");
        this.input.setVisible(true);
        this.input.setValueFormat(this.getProperty("valueFormat"));
        this.input.setDisplayFormat(this.getProperty("displayFormat"));
        this.input.oninput = oEvent => {
            try {
                this.updateValue(oEvent.target.value);
            } catch (error) {
                if (error instanceof InvalideDateStringError) {
                    this.input.setValueState(sap.ui.core.ValueState.Error);
                }
            }
        };
    },

    postRendering: function() {
        const observer = new MutationObserver(function(mutations) {
            this.updateValue((mutations[0].target as any).value);
        }.bind(this));
        observer.observe(this.input.$().find("input")[0], {
            attributes: true,
            attributeFilter: ["aria-expanded"],
        });
        this.input.ontap = oEvent => {
            if ($(oEvent.target).is("input")) {
                this.fireEvent("onInputBoxClick", {});
            }
        };
    },

    validateValue: function(value: string) {
        const dateValueString = Parser.parseDate(value);
        if (dateValueString === null && value !== '') {
            throw new InvalideDateStringError(`${value} is not valid Date`);
        }
        return dateValueString;
    },
});

export const DatePickerWithControls = sap.bdp.components.reuse.control.DatePickerWithControls;
