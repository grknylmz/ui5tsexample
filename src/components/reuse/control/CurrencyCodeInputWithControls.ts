import {currencyCodes} from "../utility/CurrencyCodes";
import {Parser} from "../utility/Parser";
import { AbstractInputWithControls } from "./AbstractInputWithControls";
import {InvalidCurrencyStringError} from "./InputWithControlError";

declare const jQuery: any;
jQuery.sap.declare("sap.bdp.components.reuse.control.CurrencyCodeInputWithControls");

AbstractInputWithControls.extend("sap.bdp.components.reuse.control.CurrencyCodeInputWithControls", {
    metadata: {
        properties: {
            ...AbstractInputWithControls.getMetadata().properties,
        },
        events: {
            saveButtonPress: {},
            onInputBoxClick: {
                parameters: {},
            },
        },
    },
    fragment: require("./InputWithControls.control.xml"),

    currencyCodeModel : new sap.ui.model.json.JSONModel(currencyCodes),

    initInput: function() {
        this.input = this.byId("currencyInput");
        this.input.setVisible(true);
        this.currencyCodeModel.setSizeLimit(200);
        this.setModel(this.currencyCodeModel, "currencyCodes");
        this._oValueHelpDialog = new sap.m.SelectDialog({
            title: "Currencies",
            items: {
                path : "currencyCodes>/",
                templateShareable: true,
                template: new sap.m.DisplayListItem({
                    value: "{currencyCodes>code}",
                    label: "{currencyCodes>name}",
                }),
            },
            search: this.onValueHelpDialogSearch.bind(this),
            confirm: this.onValueHelpDialogClose.bind(this),
            cancel: this.onValueHelpDialogClose.bind(this),
        });
        this.addDependent(this._oValueHelpDialog);
    },

    onValueHelpRequest: function(oEvent) {
        const sInputValue = oEvent.getSource().getSelectedKey();
        // Create a filter for the binding
        this._oValueHelpDialog.getBinding("items")
        .filter([new sap.ui.model.Filter("code", sap.ui.model.FilterOperator.Contains, sInputValue)]);
        // Open ValueHelpDialog filtered by the input's value
        this._oValueHelpDialog.open(sInputValue);

    },

    onValueHelpDialogSearch: function(oEvent) {
        const sValue = oEvent.getParameter("value");
        const codeFilter = new sap.ui.model.Filter("code", sap.ui.model.FilterOperator.StartsWith, sValue);
        const nameFilter = new sap.ui.model.Filter("name", sap.ui.model.FilterOperator.StartsWith, sValue);
        const oFilter = new sap.ui.model.Filter({filters: [codeFilter, nameFilter], and: false});

        oEvent.getSource().getBinding("items").filter([oFilter]);
    },

    onValueHelpDialogClose: function(oEvent) {
        const oSelectedItem = oEvent.getParameter("selectedItem");
        oEvent.getSource().getBinding("items").filter([]);

        if (!oSelectedItem) {
            return;
        }

        const value = oSelectedItem.getValue();
        this.updateValue(value);
    },

    postRendering: function() {
        this.input.ontap = oEvent => {
            if (!this.input.getEditable() && $(oEvent.target).is("input")) {
                this.fireEvent("onInputBoxClick", {});
            } else {
                sap.m.Input.prototype.ontap.call(this.input, oEvent);
            }
        };
    },

    validateValue: function(value: string) {
        const currecyISOCode = Parser.parseCurrency(value);
        if (currecyISOCode === null) {
            throw new InvalidCurrencyStringError(`${value} is not valid currency`);
        }
        return `${currecyISOCode}`;

    },
});

export const CurrencyCodeInputWithControls = sap.bdp.components.reuse.control.CurrencyCodeInputWithControls;
