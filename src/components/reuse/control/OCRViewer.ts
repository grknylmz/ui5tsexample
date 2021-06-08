import objectHash from "object-hash";
import * as R from "ramda";
import {
    IAnnotation,
    ICoordinates,
    IDocument,
    IExtraction,
    IExtractionField, IExtractionFieldSelection,
    IExtractionUpdate,
    ILineItem,
    IPage,
} from "../../../../@types/bdp";
import {Constants} from "../utility/Constants";
import {DoxClient} from "../utility/DoxClient";
import {Logger} from "../utility/Helper";
import {Parser} from "../utility/Parser";
import { any } from "sanctuary";

declare const jQuery: any;
jQuery.sap.declare("sap.bdp.components.reuse.control.OCRViewer");

const Properties: any = {
    CURRENT_PAGE: "/currentPage",
    SELECTED_BOX: "/selectedBox",
    IMAGE_HEIGHT: "/imageHeight",
    IMAGE_WIDTH: "/imageWidth",
    ZOOM_PERCENTAGE: "/zoomPercentage",
};

enum ExtractionType {
    HEADERFIELD = "header",
    LINEITEM = "line-item",
}

sap.ui.core.XMLComposite.extend("sap.bdp.components.reuse.control.OCRViewer", {
    metadata: {
        properties: {
            document: {
                type: "object",
                defaultValue: null,
            },
            pageNumber: {
                type: "int",
                defaultValue: 1,
            },
            showAnnotations: {
                type: "boolean",
                defaultValue: false,
            },
            coordinatesToFocus: {
                type: "object",
                defaultValue: [],
            },
            extractionFields: {
                type: "object",
                defaultValue: [],
            },
            extractionFieldInPopover: {
                type: "object",
                defaultValue: {key: null, rowIndex: 0},
            },
            scroller: {
                type: "object",
                defaultValue: null,
            },
            clientId: {
                type: "string",
                defaultValue: "",
            },
            isAnnotationUI: {
                type: "boolean",
                defaultValue: false
            },
        },
        events: {
            extractionUpdate: {
                parameters: {
                    path: {type: "string"},
                    extraction: {type: "object"},
                },
            },
        },
    },
    fragment: require("./OCRViewer.control.xml"),

    loadedImages: [] as string[],
    currentImageSrc: undefined as string|undefined,
    imageResizeTimer: 0 as number,
    isMouseDown: false as boolean,
    isPopoverOpen: false as boolean,
    showPopoverAgainInterval: null as Number,

    init: function() {
        sap.ui.core.XMLComposite.prototype.init.apply(this, arguments);
        this.setModel(new sap.ui.model.json.JSONModel({
            currentPage: null as IPage | null,
            pages: [] as IPage[],
            documentUrl: null as string | null,
            zoomPercentage: 100,
            imageHeight: 0,
            imageWidth: 0,
            showAnnotations: false,
            annotations: [] as IAnnotation[],
            selectedBox: null as ICoordinates | null,
            coordinatesToFocus: [] as ICoordinates[],
            extractionFields: [] as IExtractionField[],
            extractionFieldInPopover: {
                key: null,
                rowIndex: 0,
            } as IExtractionFieldSelection,
            clientId: "" as string,
            isAnnotationUI: false
        }));
        this.setBusyIndicatorDelay(0);
    },

    getDocument: function(): IDocument|null {
        return this.getProperty("document");
    },

    setDocument: function(document: IDocument|null) {
        const previousId = this.getDocument() ? this.getDocument().id : undefined;
        this.setProperty("document", document);
        if (document === null || !isDocumentReady(document)) {
            this.getModel().setProperty("/pages", []);
            this.getModel().setProperty(Properties.CURRENT_PAGE, null);
            this.getModel().setProperty("/documentUrl", null);
            this.currentImageSrc = null;
        } else {
            if (previousId !== document.id) {
                this.setBusy(true);
            }
            const pages = convertDocumentToPages(this.getProperty("document"));
            this.getModel().setProperty("/pages", pages);
            this.getModel().setProperty(Properties.CURRENT_PAGE, pages[this.getPageNumber() - 1]);
            this.getModel().setProperty("/documentUrl", document.url);
            preloadAnnotations(document);
            preloadImages(document, this.getClientId());
        }
        this.getModel().refresh(true);
    },

    getPageNumber: function(): number {
        return this.getProperty("pageNumber");
    },

    setPageNumber: function(pageNumber: number) {
        if (this.getPageNumber() !== pageNumber) {
            this.setBusy(true);
        }
        this.setProperty("pageNumber", pageNumber);
        this.getModel().setProperty(Properties.CURRENT_PAGE, this.getModel().getProperty("/pages")[pageNumber - 1]);
        this.resetSelection()
    },

    getClientId: function(): string {
        return this.getProperty("clientId");
    },

    setClientId: function(clientId: string) {
        this.setProperty("clientId", clientId);
        this.getModel().setProperty("/clientId", clientId);
    },

    setShowAnnotations: function(showAnnotations: boolean) {
        this.setProperty("showAnnotations", showAnnotations);
        this.getModel().setProperty("/showAnnotations", showAnnotations);
        if (showAnnotations) {
            this.byId("pagesContainer").addStyleClass("annotations-enabled")
        } else {
            this.byId("pagesContainer").removeStyleClass("annotations-enabled");
            this.closePopover();
        }
    },

    setCoordinatesToFocus: function(coordinatesToFocus: Array<ICoordinates|undefined>) {
        if (this.getModel().getProperty(Properties.SELECTED_BOX) !== null) {
            return;
        }
    coordinatesToFocus = R.filter(coordinate => coordinate !== undefined && coordinate.w !== 0 && coordinate.h !== 0, coordinatesToFocus);
        this.setProperty("coordinatesToFocus", coordinatesToFocus);
        this.getModel().setProperty("/coordinatesToFocus", coordinatesToFocus);
        const scroller = this.getProperty("scroller");
        const elements = R.map(coodinates => document.getElementById(getDomIdByCoordinates(coodinates)), coordinatesToFocus);
        if (elements.length > 0 && elements[0] !== null) {
            if (scroller !== null) {
                scroller.scrollToElement(elements[0].children[1], 300);
            }
            this.byId("pagesContainer").scrollToElement(elements[0], 300);
            R.forEach(elememt => {
                elememt.classList.add("focus");
                setTimeout(function() {
                    elememt.classList.remove("focus");
                }.bind(this), 1000);
            }, elements);
        }
        this.getModel().setProperty("/coordinatesToFocus", []);
    },

    setExtractionFields: function(extractionFields: IExtractionField[]) {
        this.setProperty("extractionFields", extractionFields);
        this.getModel().setProperty("/extractionFields", extractionFields);
    },

    setExtractionFieldInPopover: function(extractionFieldSelection: IExtractionFieldSelection) {
        this.setProperty("extractionFieldInPopover", extractionFieldSelection);
        this.getModel().setProperty("/extractionFieldInPopover", extractionFieldSelection);

        if (this.shouldShowPopover() && extractionFieldSelection.key !== null) {
            if (!(this.byId("popover") as sap.m.ResponsivePopover).isOpen()) {
                this.showPopover(false);
            }
            this.handlePopoverApply(null);
        }
    },

    setIsAnnotationUI: function(isAnnotationUI: boolean) {
        this.setProperty("isAnnotationUI", isAnnotationUI);
        this.getModel().setProperty("/isAnnotationUI", isAnnotationUI);
    },

    isAnnotationUI: function() {
        return this.getProperty("isAnnotationUI");
    },

    createHeaderFieldsDivs: function(imageHeight: number, imageWidth: number, headerFields: IExtraction[]): string {
        if (imageHeight <= 0 || imageWidth <= 0 || headerFields == null) {
            return "";
        }
        const divs = R.map(createExtractionDiv(imageHeight, imageWidth, ExtractionType.HEADERFIELD, false), R.filter(x => x.value != null, headerFields));
        return `<div>${R.join("", divs)}</div>`;
    },

    createLineItemsDivs: function(imageHeight: number, imageWidth: number, lineItems: ILineItem[]): string {
        if (imageHeight <= 0 || imageWidth <= 0 || lineItems == null) {
            return "";
        }
        const columns = R.flatten(R.map(R.prop("columns"), lineItems));
        const divs = R.map(createExtractionDiv(imageHeight, imageWidth, ExtractionType.LINEITEM, false), columns);
        return `<div>${R.join("", divs)}</div>`;
    },

    createAnnotationsDivs: function(imageHeight: number, imageWidth: number, showAnnotations: boolean, annotations: IAnnotation[], selectedBox: ICoordinates|null): string {
        if (imageHeight <= 0 || imageWidth <= 0 || showAnnotations === false) {
            return "";
        }
        const divs: string[] = R.map(createAnnotationDiv(imageHeight, imageWidth, this.getSelectedAnnotations()), annotations);
        return `<div>${R.join("", divs)}</div>`;
    },

    createSelectedBoxDiv: function(imageHeight: number, imageWidth: number, selectedBox: ICoordinates): string {
        if (imageHeight <= 0 || imageWidth <= 0 || selectedBox === null) {
            return `<div style="display:none; position:absolute; height:0px; width:0px; left:0px; top:0px;"></div>`;
        }
        const top = imageHeight * selectedBox.y - 1;
        const left = imageWidth * selectedBox.x - 1;
        const height = Math.min(imageHeight * selectedBox.h, imageHeight - top);
        const width = Math.min(imageWidth * selectedBox.w, imageWidth - left);
        const cssClass = (this.isMouseDown && !this.resizing) ? "annotation selecting" : "annotation selected";
        const resizerDivs = this.isAnnotationUI() ? `<div class='resizers'>
            <div class='resizer top'></div>
            <div class='resizer right'></div>
            <div class='resizer bottom'></div>
            <div class='resizer left'></div>
        </div>` : ``
        return `<div class="${cssClass}" style="position:absolute; height:${height.toFixed()}px; width:${width.toFixed()}px; left:${left.toFixed()}px; top:${top.toFixed()}px;">
            ${resizerDivs}</div>`;
    },

    onImageLoad(oEvent) {
        const image = oEvent.oSource.getDomRef();
        this.getModel().setProperty(Properties.IMAGE_HEIGHT, image.height);
        this.getModel().setProperty(Properties.IMAGE_WIDTH, image.width);
        if (!this.loadedImages.includes(oEvent.oSource.sId)) {
            sap.ui.core.ResizeHandler.register(
                oEvent.oSource,
                this.resizeImage.bind(this),
            );
            oEvent.oSource.getParent().attachBrowserEvent("mousedown", this.handleMouseDown, this);
            oEvent.oSource.getParent().attachBrowserEvent("mousemove", this.handleMouseDrag, this);
            oEvent.oSource.getParent().attachBrowserEvent("mouseup", this.handleMouseUp, this);
            this.loadedImages.push(oEvent.oSource.sId);
        }
        if (this.currentImageSrc !== oEvent.oSource.mProperties.src) {
            this.currentImageSrc = oEvent.oSource.mProperties.src;
            const dimension = this.getDocument().dimensions[this.getPageNumber().toString(10)];
            DoxClient.getDocumentOcrByPage(this.getDocument(), this.getPageNumber()).then(R.reduce((acc, lineBox: any) => {
                return [
                    ...acc,
                    ...R.map(wordBox => ({
                        text: wordBox.content,
                        pageNumber: this.getPageNumber(),
                        x: wordBox.bbox[0][0] / dimension.width,
                        y: wordBox.bbox[0][1] / dimension.height,
                        w: (wordBox.bbox[1][0] - wordBox.bbox[0][0]) / dimension.width,
                        h: (wordBox.bbox[1][1] - wordBox.bbox[0][1]) / dimension.height,
                    }), lineBox.word_boxes),
                ];
            }, [])).then(annotations => {
                this.getModel().setProperty("/annotations", annotations);
                this.setBusy(false);
            }).catch(error => {
                sap.m.MessageBox.error(`Failed to load OCR annotations: ${error}`);
                this.setBusy(false);
                Logger.logError(error);
            });
        }
    },

    resizeImage(resizeEvent: any) {
        if (this.imageResizeTimer > 0) {
            clearTimeout(this.imageResizeTimer);
        }
        this.getModel().setProperty(Properties.IMAGE_HEIGHT, 0);
        this.getModel().setProperty(Properties.IMAGE_WIDTH, 0);
        this.imageResizeTimer = setTimeout(() => {
            this.getModel().setProperty(Properties.IMAGE_HEIGHT, resizeEvent.size.height);
            this.getModel().setProperty(Properties.IMAGE_WIDTH, resizeEvent.size.width);
            this.imageResizeTimer = 0;
        }, 1000);
    },

    handleMouseDown(event) {
        if (this.getProperty("showAnnotations") !== true) {
            return;
        }

        this.isMouseDown = true;
        this.resizing = null;
        const rect = event.currentTarget.getBoundingClientRect();
        this.initialX = event.clientX - rect.left
        this.initialY = event.clientY - rect.top;
        const orginalEventTarget = event.originalEvent.target.classList;
        if(orginalEventTarget.contains('right') ||
            orginalEventTarget.contains('left') ||
            orginalEventTarget.contains('top') ||
            orginalEventTarget.contains('bottom')) {
            this.resizing = (orginalEventTarget.value.includes('top') ? "TOP" : "") + (orginalEventTarget.value.includes('bottom') ? "BOTTOM" : "") +
                (orginalEventTarget.value.includes('right') ? "RIGHT" : "") + (orginalEventTarget.value.includes('left') ? "LEFT" : "")
            const box: ICoordinates = this.getModel().getProperty(Properties.SELECTED_BOX);
            this.originalWidth = box.w;
            this.originalHeight = box.h;
            this.originalX = box.x;
            this.originalY = box.y;
        } else {
            this.getModel().setProperty(Properties.SELECTED_BOX, {
                x: this.initialX / this.getModel().getProperty(Properties.IMAGE_WIDTH),
                y: this.initialY / this.getModel().getProperty(Properties.IMAGE_HEIGHT),
                w: 0,
                h: 0,
            });
        }
        if ((this.byId("popover") as sap.m.ResponsivePopover).isOpen()) {
            this.closePopover(!!this.resizing);
        }
        (document.activeElement as any).blur();
        return false;
    },

    handleMouseDrag(event) {
        if (this.getProperty("showAnnotations") !== true) {
            return;
        }
        if (!this.isMouseDown) {
            return;
        }
        const rect = event.currentTarget.getBoundingClientRect();
        const offsetX = event.clientX - rect.left;
        const offsetY = event.clientY - rect.top;
        const imageWidth = this.getModel().getProperty(Properties.IMAGE_WIDTH);
        const imageHeight = this.getModel().getProperty(Properties.IMAGE_HEIGHT);

        const x = Math.min(this.initialX, offsetX);
        const y = Math.min(this.initialY, offsetY);
        const w = Math.max(this.initialX, offsetX) - x;
        const h = Math.max(this.initialY, offsetY) - y;
        if(!this.resizing) {
            this.getModel().setProperty(Properties.SELECTED_BOX, {
                x: x / imageWidth,
                y: y / imageHeight,
                w: w / imageWidth,
                h: h / imageHeight,
            });
        } else {
            const x = this.resizing.includes("LEFT") ? this.originalX*imageWidth + (offsetX - this.initialX) : this.originalX*imageWidth;
            const y = this.resizing.includes("TOP") ? this.originalY*imageHeight + (offsetY - this.initialY) : this.originalY*imageHeight;
            let w = this.resizing.includes("RIGHT") ? this.originalWidth*imageWidth + (offsetX - this.initialX) : this.originalWidth*imageWidth;
            let h = this.resizing.includes("BOTTOM") ? this.originalHeight*imageHeight + (offsetY - this.initialY) : this.originalHeight*imageHeight;
            w = this.resizing.includes("LEFT") ? this.originalWidth*imageWidth - (offsetX - this.initialX) : w;
            h = this.resizing.includes("TOP") ? this.originalHeight*imageHeight - (offsetY - this.initialY) : h;
            if (w >= 5 && h >= 5) {
                this.getModel().setProperty(Properties.SELECTED_BOX, {
                    x: x / imageWidth,
                    y: y / imageHeight,
                    w: w / imageWidth,
                    h: h / imageHeight,
                });
            }
        }
    },

    handleMouseUp(event) {
        if (this.getProperty("showAnnotations") !== true) {
            return;
        }
        if (!this.isMouseDown) {
            return;
        }
        this.isMouseDown = false;
        const box: ICoordinates = this.getModel().getProperty(Properties.SELECTED_BOX);
        const selectedAnnotations: IAnnotation[] = this.getSelectedAnnotations()
        if ((!this.isAnnotationUI() && selectedAnnotations.length === 0) || 
            (!this.resizing && selectedAnnotations.length === 0 && (box.w <= 0.000005 || box.h <= 0.000005))) {
            this.getModel().setProperty(Properties.SELECTED_BOX, null);
            return;
        }
        if(!this.resizing && selectedAnnotations.length > 0) {
            this.getModel().setProperty(Properties.SELECTED_BOX, getBoxForAnnotations(selectedAnnotations));
        } else if (!this.resizing) {
            this.getModel().setProperty(Properties.SELECTED_BOX, box);
            this.byId("selectedBoxDivs").getBinding('content').refresh(true)
        }
        this.showPopover(!this.resizing);
        this.resizing = null
    },

    getSelectedAnnotations(): IAnnotation[] {
        const box: ICoordinates = this.getModel().getProperty(Properties.SELECTED_BOX);
        if (box === null) {
            return []
        }
        const annotations: IAnnotation[] = this.getModel().getProperty("/annotations");
        return R.filter(annotation =>
            annotation.x <= box.x + box.w && annotation.x + annotation.w >= box.x &&
            annotation.y <= box.y + box.h && annotation.y + annotation.h >= box.y
            , annotations);
    },

    resetSelection() {
        this.getModel().setProperty(Properties.SELECTED_BOX, null);
    },

    shouldShowPopover: function() {
        return this.getModel().getProperty(Properties.SELECTED_BOX) !== null && !this.isMouseDown;
    },

    showPopover(clearSelection: boolean) {
        const selectedBox = this.byId("selectedBoxDivs");
        const popover = this.byId("popover") as sap.m.ResponsivePopover;
        popover.openBy(selectedBox);
        const textArea = this.byId("selectionPopoverValue") as sap.m.ComboBox;
        const text = R.map(x  => x.text, this.getSelectedAnnotations()).join(" ");
        textArea.setValue(text);
        const stepInput = this.byId("selectionPopoverRowIndex") as sap.m.StepInput;
        stepInput.setVisible(false);
        if (clearSelection) {
            this.getModel().setProperty("/extractionFieldInPopover/key", null);
            textArea.setValueState(sap.ui.core.ValueState.None);
            (this.byId("selectionPopoverApply") as sap.m.Button).setEnabled(false);
        }
        this.isPopoverOpen = true;
    },

    closePopover(resetSelection?: boolean) {
        const popover = this.byId("popover") as sap.m.ResponsivePopover;
        if (popover.isOpen()) {
            popover.close();
        }
        if (resetSelection !== false) {
            this.resetSelection();
        }
        if( !this.resizing) { 
            this.getModel().setProperty("/extractionFieldInPopover/key", null);
        }
        this.isPopoverOpen = false;
    },

    handlePopoverCancel(oEvent) {
        this.closePopover();
    },

    handlePopoverApply(oEvent) {
        this.handlePopoverChange(null);
        if (!(this.byId("selectionPopoverApply") as sap.m.Button).getEnabled()) {
            return;
        }
        const comboBox = this.byId("selectionPopoverFieldComboBox") as sap.m.ComboBox;
        const textArea = this.byId("selectionPopoverValue") as sap.m.TextArea;
        const document: IDocument = this.getProperty("document");
        const fieldName = comboBox.getSelectedItem().data("name");
        const type = comboBox.getSelectedItem().data("type");
        const group = comboBox.getSelectedItem().data("group");

        let value = textArea.getValue();
        if (fieldName === "currencyCode") {
            value = Parser.parseCurrency(value);
        } else if (type === "date") {
            value = Parser.parseDate(value);
        } else if (type === "number") {
            value = Parser.parseFloat(value);
        }

        if (group === Constants.GROUP_HEADER_FIELDS) {
            const headerFieldName = comboBox.getSelectedItem().data("name");
            const hfIndex = R.findIndex(R.propEq("name", headerFieldName))(document.extraction.headerFields);
            const headerField = R.clone(document.extraction.headerFields[hfIndex]);
            headerField.value = (this.isAnnotationUI() ? textArea.getValue() : value) || Constants.EMPTY_VALUE_PLACEHOLDER;
            headerField.confidence = 1;
            headerField.coordinates = this.getModel().getProperty(Properties.SELECTED_BOX);
            headerField.page = this.getModel().getProperty(Properties.CURRENT_PAGE).pageNumber;
            this.fireEvent("extractionUpdate", {
                path: `/extraction/headerFields/${hfIndex}`,
                extraction: headerField,
            } as IExtractionUpdate);
        }

        if (group === Constants.GROUP_LINE_ITME_FIELDS) {
            const stepInput = this.byId("selectionPopoverRowIndex") as sap.m.StepInput;
            const rowIndex = stepInput.getValue() - 1;
            const columnName = comboBox.getSelectedItem().data("name");
            const lineItem = document.extraction.lineItems[rowIndex] as ILineItem;
            const columnIndex = R.findIndex(R.propEq("name", columnName))(document.extraction.lineItems[rowIndex].columns);
            const column = R.clone(lineItem.columns[columnIndex]);
            column.value = (this.isAnnotationUI() ? textArea.getValue() : value) || Constants.EMPTY_VALUE_PLACEHOLDER;
            column.confidence = 1;
            column.coordinates = this.getModel().getProperty(Properties.SELECTED_BOX);
            column.page = this.getModel().getProperty(Properties.CURRENT_PAGE).pageNumber;
            this.fireEvent("extractionUpdate", {
                path: `/extraction/lineItems/${rowIndex}/columns/${columnIndex}`,
                extraction: column,
            } as IExtractionUpdate);
        }
        this.closePopover();
    },

    handlePopoverChange(oEvent) {
        const comboBox = this.byId("selectionPopoverFieldComboBox") as sap.m.ComboBox;
        const textArea = this.byId("selectionPopoverValue") as sap.m.TextArea;
        let valid = false;
        if (comboBox.getSelectedItem()) {
            valid = this._checkTextValidityAndSetValueState(textArea, comboBox.getSelectedItem().data('name'),
                comboBox.getSelectedItem().data("type"));
            const stepInput = this.byId("selectionPopoverRowIndex") as sap.m.StepInput;
            if (comboBox.getSelectedItem().data("group") === Constants.GROUP_LINE_ITME_FIELDS) {
                stepInput.setVisible(true);
                const rowIndex = stepInput.getValue() - 1;
                this.getModel().setProperty("/extractionFieldInPopover/rowIndex", rowIndex);
                const lineItems = (this.getProperty("document") as IDocument).extraction.lineItems;
                if (rowIndex < lineItems.length) {
                    stepInput.setValueStateText(" ");
                    stepInput.setValueState(sap.ui.core.ValueState.Information);
                } else {
                    stepInput.setValueStateText(`max is ${lineItems.length}`);
                    stepInput.setValueState(sap.ui.core.ValueState.Error);
                }
                valid = valid && rowIndex < lineItems.length;
            } else {
                stepInput.setVisible(false);
            }
        } else {
            textArea.setValueState(sap.ui.core.ValueState.None);
        }
        (this.byId("selectionPopoverApply") as sap.m.Button).setEnabled(valid);
    },

    _checkTextValidityAndSetValueState(textArea: sap.m.TextArea, fieldName: string, dataType: string) : boolean {
        const text = textArea.getValue();
        let value = null;
        let valid = false;
        if(fieldName === "currencyCode") {
            value = Parser.parseCurrency(text);
            valid = value !== null;
            valid ? textArea.setValueStateText(`Value : ${value}`) :
                    textArea.setValueStateText(`Invalid Entry, should be a currency ISO code`);
        } else if (dataType === "date") {
            value = Parser.parseDate(text);
            valid = value !== null;
            valid ? textArea.setValueStateText(`Value : ${value}`) :
                textArea.setValueStateText("Invalid Entry, should be a Date");
        } else if (dataType === "number") {
            value = Parser.parseFloat(text);
            valid = value !== null;
            valid ? textArea.setValueStateText(`Value : ${value}`) :
                textArea.setValueStateText("Invalid Entry, should be a Number");
        } else {
            valid = text.length > 0;
            valid ? textArea.setValueStateText(" ") :
                textArea.setValueStateText("Invalid Entry, should not be empty");
        }

        if (valid) {
            textArea.setValueState(sap.ui.core.ValueState.Information);
        } else {
            this.isAnnotationUI() ? textArea.setValueState(sap.ui.core.ValueState.Warning) : textArea.setValueState(sap.ui.core.ValueState.Error);
            textArea.focus();
        }
        return valid || this.isAnnotationUI();
    },

    onZoomIn(oEvent) {
        const currentZoom = this.getModel().getProperty(Properties.ZOOM_PERCENTAGE);
        this.zoom( currentZoom >= 200 ? currentZoom + 40 : currentZoom >= 100 ? currentZoom + 20: currentZoom + 10);
    },

    onZoomOut(oEvent) {
        const currentZoom = this.getModel().getProperty(Properties.ZOOM_PERCENTAGE);
        this.zoom(currentZoom > 200 ? currentZoom - 40 : currentZoom > 100 ? currentZoom - 20: currentZoom - 10)
    },

    onFitWidth(oEvent) {
        this.zoom(100)
    },

    zoom(zoomPercentage: Number) {
        if(zoomPercentage < 50 || zoomPercentage > 400) {
            return;
        }
        this.getModel().setProperty(Properties.ZOOM_PERCENTAGE, zoomPercentage);
        if(this.isPopoverOpen && !this.showPopoverAgainInterval) {
            this.showPopoverAgainInterval = setInterval(() => {
                const selectedBox = this.byId("selectedBoxDivs");
                const popover = this.byId("popover") as sap.m.ResponsivePopover;
                if(selectedBox && selectedBox.getDomRef().style.display === "") {
                    popover.openBy(selectedBox);
                    clearInterval(this.showPopoverAgainInterval);
                    this.showPopoverAgainInterval = null;
                }
            }, 200);
        }
    },

    onFirstPagePress(oEvent) {
        this.setPageNumber(1);
    },

    onLastPagePress(oEvent) {
        const totalPages = this.getModel().getProperty("/pages").length;
        this.setPageNumber(totalPages);
    },

    onNextPagePress(oEvent) {
        const totalPages = this.getModel().getProperty("/pages").length;
        const currentPageNumber: number = this.getModel().getProperty(Properties.CURRENT_PAGE).pageNumber;
        const newPageNumber: number = Math.min(currentPageNumber + 1, totalPages);
        this.setPageNumber(newPageNumber);
    },

    onPrevPagePress(oEvent) {
        const currentPageNumber: number = this.getModel().getProperty(Properties.CURRENT_PAGE).pageNumber;
        const newPageNumber = Math.max(currentPageNumber - 1, 1);
        this.setPageNumber(newPageNumber);
    },

    //select page pagination
    onPageSelectChange(oEvent){
        const select = this.byId("pageSelect") as sap.m.Select;
        const selectedPageNumber = select.getSelectedKey();
        //convert string to integer
        const newPageNumber = Number(selectedPageNumber);
        this.setPageNumber(newPageNumber);
    },

    onSelectorHelp(oEvent) {
        const selectorDialog = (this.byId("selectorHelpPopover") as sap.m.Dialog)
        selectorDialog.setVisible(true);
        selectorDialog.open();
    },

    handleHelpDialogClose(oEvent) {
        const selectorDialog = (this.byId("selectorHelpPopover") as sap.m.Dialog)
        selectorDialog.setVisible(false);
        selectorDialog.close();
    }
});

const convertDocumentToPages = function(document: IDocument): IPage[] {
    if (document.extraction === undefined) {
        return [];
    }
    const headerFields = R.filter(hf => !["", undefined, null].includes(hf.value), document.extraction.headerFields);
    const lineItems = R.filter(li => li.columns.length > 0, document.extraction.lineItems);
    const pageNumbers: number[] = R.range(1, document.pages + 1);
    return R.map(pageNumber => ({
        id: document.id,
        pageNumber: pageNumber,
        headerFields: R.filter(item => {return item.page === pageNumber}, headerFields),
        lineItems: R.filter(lineItem => {
            return R.filter(item => { 
                return item.page === pageNumber && !["", undefined, null].includes(item.value)
            }, lineItem.columns).length > 0
        }, lineItems),
    }), pageNumbers);
};

const getDomIdByCoordinates = function(coordinates: ICoordinates): string {
    return objectHash.MD5(coordinates);
};

const createExtractionDiv = R.curry(function(imageHeight: number, imageWidth: number, extractionType: ExtractionType, isFocused: boolean, extraction: IExtraction): string {
    const top = imageHeight * extraction.coordinates.y - 4;
    const left = imageWidth * extraction.coordinates.x - 4;
    const height = Math.min((imageHeight * extraction.coordinates.h + 2), imageHeight - top - 4);
    const width = Math.min((imageWidth * extraction.coordinates.w + 2), imageWidth - left - 4);
    const right = imageWidth * extraction.coordinates.w + 9;
    const focusClass = isFocused ? "focus" : "";
    const id = getDomIdByCoordinates(extraction.coordinates);
    return `<div id="${id}" class="annotation ${focusClass} ${extractionType}" style="height:${height.toFixed()}px; width: ${width.toFixed()}px; top: ${top.toFixed()}px; left: ${left.toFixed()}px;">
                <span class="value" style="max-width: ${(imageWidth - left - 5).toFixed()}px; min-width: ${width.toFixed()}px">${extraction.value === null ? "" : extraction.value}</span>
                <span class="label" style="right:${right.toFixed()}px;">${extraction.label}:</span>
            </div>`;
});

const createAnnotationDiv = R.curry(function(imageHeight: number, imageWidth: number, selectedAnnotations: IAnnotation[], annotation: IAnnotation): string {
    const top = imageHeight * annotation.y;
    const left = imageWidth * annotation.x;
    const height = imageHeight * annotation.h;
    const width = imageWidth * annotation.w;
    const cssClass = selectedAnnotations.indexOf(annotation) >= 0 ? "ocr-annotation selected" : "ocr-annotation";
    const id = getDomIdByCoordinates(annotation);
    return `<div id="${id}" class="${cssClass}" style="height: ${height.toFixed()}px; width: ${width.toFixed()}px; top: ${top.toFixed()}px; left: ${left.toFixed()}px;"></div>`;
});

const getBoxForAnnotations = function(annotations: IAnnotation[]) {
    const box: ICoordinates = {
        x: Math.min(...R.map(a => a.x, annotations)),
        y: Math.min(...R.map(a => a.y, annotations)),
        w: 0,
        h: 0,
    };
    box.w = Math.max(...R.map(a => a.x + a.w, annotations)) - box.x;
    box.h = Math.max(...R.map(a => a.y + a.h, annotations)) - box.y;
    return box;
};

const preloadAnnotations = function(document: IDocument): void {
    let p = Promise.resolve();
    for (let pageNumber = 1; pageNumber <= document.pages; pageNumber++) {
        p = p.then(() => DoxClient.getDocumentOcrByPage(document, pageNumber))
            .catch(Logger.logError);
    }
};

const preloadImages = function(document: IDocument, clientId: string): void {
    const preloadImage = (src: string) => new Promise<void>((resolve: () => void) => {
        const image = new Image();
        image.onload = resolve;
        image.onerror = resolve;
        image.src = src;
    });

    let p = Promise.resolve();
    for (let pageNumber = 1; pageNumber <= document.pages; pageNumber++) {
        p = p.then(() => preloadImage(`${document.url}/pages/${pageNumber}?clientId=${clientId}`))
            .catch(Logger.logError);
    }
};

const isDocumentReady = function(document: IDocument): boolean {
    return ["DONE", "CONFIRMED"].includes(document.status);
};

export const OCRViewer = sap.bdp.components.reuse.control.OCRViewer;
