import * as R from "ramda";
import {
    IDocument,
    IDocumentDimensions,
    IDocumentExtraction,
    IExtractionFieldNames, ILineItem, IMessage,
    ISampleDocument, ISampleDocumentJob, ITemplate,
} from "../../../../@types/bdp";
import {JobStatusError} from "../errors/JobStatusError";
import {Constants} from "./Constants";
import {DocumentUtils} from "./DocumentUtils";
import {capabilityLabelFormatter} from "./Formatter";
import {ServiceCall} from "./ServiceCall";

export class DoxClient {

    public static listDocuments(): Promise<IDocument[]> {
        return this._get("document/jobs").then(data => data.results);
    }

    public static listSampleDocuments(templateId: string): Promise<any[]> {
        return this._get(`templates/${templateId}/samples`).then(data => data.results);
    }

    public static listSampleDocumentJobs(templateId: string): Promise<any[]> {
        return this._get(`templates/${templateId}/samples/jobs`).then(data => {
            return data.results.filter(item => !!item.id);
        });
    }

    public static checkSampleDocumentJobStatus(id: string, templateId: string, expectedStatuses: string[]): Promise<ISampleDocumentJob> {
        return this.listSampleDocumentJobs(templateId)
            .then(jobs => jobs.filter(j => j.id === id)[0])
            .then(job => {
                if (expectedStatuses.includes(job.status)) {
                    return job;
                }
                throw new JobStatusError(job, expectedStatuses);
            });
    }

    public static checkDocumentJobStatus(id: string, expectedStatuses: string[]): Promise<any> {
        return this._get(`document/jobs/${id}`)
            .then(job => {
                if (expectedStatuses.includes(job.status)) {
                    return job;
                }
                throw new JobStatusError(job, expectedStatuses);
            });
    }

    public static getDocument(id: string, supportedExtractionFields: any, resourceBundle: any): Promise<IDocument> {
        return this.checkDocumentJobStatus(id, ["DONE", "CONFIRMED"]).then(job => Promise.all([
            job,
            this.getDocumentPages(id),
            this._getDocumentExtractionNames(id),
        ])).then((responses) => {
            return this._payloadToDocument(responses[0], responses[1], responses[2], supportedExtractionFields, resourceBundle);
        });
    }

    public static deleteDocument(id: string): Promise<boolean> {
        return ServiceCall.delete(
            `${Constants.API_BASE_URL}document/jobs`, {
                data: `{"value": ["${id}"]}`,
            }).then(() => true);
    }

    public static updateDocument(document: IDocument): Promise<IMessage> {
        return this._post(`document/jobs/${document.id}`, this._payloadFromDocument(document));
    }

    public static updateTemplate(template: ITemplate): Promise<IMessage> {
        const payload = {
            "id": template.id,
            "clientId": template.clientId,
            "name": template.name,
            "language": template.language,
            "documentType": template.documentType,
            "fileType": template.fileType,
            "description": template.description
        }
        if(template.extraction){
            payload["extraction"] = {
                "headerFields": template.extraction.headerFields.map( item => ({"name": item.name})),
                "lineItemFields": template.extraction.lineItemFields.map( item => ({"name": item.name})),
            };
        };
        return this._post("templates", payload);
    }

    public static confirmDocument(id: string): Promise<IMessage> {
        return this._post(`document/jobs/${id}/confirm`, {});
    }

    public static getTemplate(templateId: string, supportedExtractionFields: any, resourceBundle: any): Promise<ITemplate> {
        return Promise.all([
            this._get(`templates/${templateId}`).then(template => {
                template.extraction.headerFields = template.extraction.headerFields.map(item => {
                    const capability = supportedExtractionFields.headerFields.filter(c => c.name === item.name)[0];
                    return {
                        ...capability,
                        label: capabilityLabelFormatter(capability.name, resourceBundle, true, template.documentType),
                    };
                });
                template.extraction.lineItemFields = template.extraction.lineItemFields.map(item => {
                    const capability = supportedExtractionFields.lineItemFields.filter(c => c.name === item.name)[0];
                    return {
                        ...capability,
                        label: capabilityLabelFormatter(capability.name, resourceBundle, false, template.documentType),
                    };
                });
                return template;
            }),
            this.listSampleDocumentJobs(templateId),
        ]).then((responses) => {
            const [ template, jobs ] = responses;
            return {
                ...template,
                sampleJobs: jobs,
            };
        });
    }

    public static getSampleDocument(id: string, templateId: string, supportedExtractionFields: any, resourceBundle: any): Promise<ISampleDocument> {
        return this.checkSampleDocumentJobStatus(id, templateId, ["DONE"]).then(job => Promise.all([
            this._get(`templates/${templateId}/samples/${id}`),
            job,
            this.getSampleDocumentPages(id, templateId),
            this._getTemplateExtractionNames(templateId),
        ])).then((responses) => {
            return this._payloadToSampleDocument(responses[0], responses[1], responses[2], responses[3], supportedExtractionFields, resourceBundle);
        });
    }

    public static deleteSampleDocument(id: string, templateId: string): Promise<boolean> {
        return ServiceCall.delete(`${Constants.API_BASE_URL}templates/${templateId}/samples/${id}?clientId=${Constants.CLIENT_ID}`, {timeout: 5000})
            .then(() => true);
    }

    public static deleteTemplate(templateId: string): Promise<boolean> {
        return ServiceCall.delete(`${Constants.API_BASE_URL}templates/${templateId}?clientId=${Constants.CLIENT_ID}`, {timeout: 10000})
            .then(() => true);
    }

    static activateTemplate(template_id){
        return this._post(`templates/${template_id}/activate?clientId=${Constants.CLIENT_ID}`, {});
    }

    static deActivateTemplate(template_id){
        return this._post(`templates/${template_id}/deactivate?clientId=${Constants.CLIENT_ID}`, {});
    }

    public static updateSampleDocument(document: ISampleDocument): Promise<IMessage> {
        return this._post(`templates/${document.templateId}/samples/${document.id}`, this._payloadFromSampleDocument(document));
    }

    public static getDocumentPages(id: string): Promise<IDocumentDimensions> {
        return this._get(`document/jobs/${id}/pages/dimensions`).then(data => data.results);
    }

    public static getSampleDocumentPages(id: string, templateId: string): Promise<IDocumentDimensions> {
        return this._get(`templates/${templateId}/samples/${id}/pages/dimensions`);
    }

    public static getDocumentOcrByPage(document: IDocument, pageNo: number): Promise<any> {
        return this._get(`${document.url}/pages/${pageNo}/text`, false).then(data => data.value);
    }

    public static createEmptyLineItem(index: number, extractionFieldNames: IExtractionFieldNames, supportedExtractionFields: any, resourceBundle: any, documentType: string): ILineItem {
        return this._fillLineItem([], index, extractionFieldNames, supportedExtractionFields, resourceBundle, documentType);
    }

    public static addEmptyLineItem(lineItems: ILineItem[], index: number, extractionFieldNames: IExtractionFieldNames, supportedExtractionFields: any, resourceBundle: any, documentType: string): ILineItem[] {
        const [itemsBefore, itemsAfter] = R.splitAt(index, lineItems);
        return [
            ...itemsBefore,
            this.createEmptyLineItem(index, extractionFieldNames, supportedExtractionFields, resourceBundle, documentType),
            ...R.zip(itemsAfter, R.range(index + 1, index + 1 + itemsAfter.length)).map((indexedLi: [any, number]) => {
                const [liPayload, idx] = indexedLi;
                return this._fillLineItem(liPayload, idx, extractionFieldNames, supportedExtractionFields, resourceBundle, documentType);
            }),
        ];
    }

    public static deleteLineItem(lineItems: ILineItem[], index: number, extractionFieldNames: IExtractionFieldNames, supportedExtractionFields: any, resourceBundle: any, documentType: string): ILineItem[] {
        const [itemsBefore, itemsAfter] = R.splitAt(index, lineItems);
        return [
            ...itemsBefore,
            ...R.zip(R.tail(itemsAfter), R.range(index, index + itemsAfter.length - 1)).map((indexedLi: [any, number]) => {
                const [liPayload, idx] = indexedLi;
                return this._fillLineItem(liPayload, idx, extractionFieldNames, supportedExtractionFields, resourceBundle, documentType);
            }),
        ];
    }

    public static _createEmptyExtractionObject(name): any {
        return {
            "name": name,
            "value": null,
            "confidence": 1,
            "page": 1,
            "coordinates": {
                "x": 0.0,
                "y": 0.0,
                "w": 0.0,
                "h": 0.0,
            },
        };
    }

    private static _getDocumentExtractionNames(id: string): Promise<IExtractionFieldNames> {
        return this._get(`document/jobs/${id}/request`).then(data => data.extraction);
    }

    private static _getTemplateExtractionNames(id: string): Promise<IExtractionFieldNames> {
        return this._get(`templates/${id}`).then((data: any) => {
            return {
                headerFields: data.extraction.headerFields.map(field => field.name),
                lineItemFields: data.extraction.lineItemFields.map(field => field.name),
                documentType: data.documentType
            };
        });
    }

    private static _get(resourceUrl: string, prependBaseUrl: boolean = true): Promise<any> {
        const apiUrl: string = prependBaseUrl ? `${Constants.API_BASE_URL}${resourceUrl}` : resourceUrl;
        return ServiceCall.get(apiUrl, {data: {"clientId": Constants.CLIENT_ID}}).then((response: any) => {
            return response.data;
        });
    }

    private static _post(resourceUrl: string, payload: object): Promise<IMessage> {
        const apiUrl: string = `${Constants.API_BASE_URL}${resourceUrl}`;
        return ServiceCall.post(apiUrl, {data: {"clientId": Constants.CLIENT_ID}}, JSON.stringify(payload)).then((response: any) => {
            return response.data;
        });
    }

    private static _payloadToDocument(documentJobPayload: any, dimensions: IDocumentDimensions, extractionFieldNames: IExtractionFieldNames, supportedExtractionFields: any, resourceBundle: any): IDocument {
        const {extraction, ...document} = documentJobPayload;
        if (extraction !== undefined) {
            if (extraction.lineItems === undefined) {
                extraction.lineItems = [];
            }
            document.extraction = DocumentUtils.backupDocEx(this._fillDocEx(extraction, extractionFieldNames, supportedExtractionFields, resourceBundle, document.documentType));
        }
        document.dimensions = dimensions;
        document.pages = Object.keys(dimensions).length;
        document.extractionFieldNames = extractionFieldNames;
        document.url = `${Constants.API_BASE_URL}document/jobs/${document.id}`;
        return document;
    }

    private static _payloadToSampleDocument(samplePayload: any, jobPayload: ISampleDocumentJob, dimensions: IDocumentDimensions, extractionFieldNames: IExtractionFieldNames, supportedExtractionFields: any, resourceBundle: any): ISampleDocument {
        const {sampleDocumentId, annotations, ...document} = samplePayload;
        if (annotations !== undefined) {
            if (annotations.lineItems === undefined) {
                annotations.lineItems = [];
            }
            document.extraction = DocumentUtils.backupDocEx(this._fillDocEx(annotations, extractionFieldNames, supportedExtractionFields, resourceBundle, extractionFieldNames.documentType));
        }
        document.id = sampleDocumentId;
        document.dimensions = dimensions;
        document.pages = Object.keys(dimensions).length;
        document.extractionFieldNames = extractionFieldNames;
        document.status = jobPayload.status;
        document.fileName = jobPayload.fileName;
        document.documentType = extractionFieldNames.documentType;
        document.url = `${Constants.API_BASE_URL}templates/${document.templateId}/samples/${document.id}`;
        return (document);
    }

    private static _payloadFromDocument(document: IDocument): any {
        return {
            id: document.id,
            fileName: document.fileName,
            documentType: document.documentType,
            extraction: this._unfillDocEx(DocumentUtils.deleteDocExBackup(document.extraction)),
        };
    }

    private static _payloadFromSampleDocument(document: ISampleDocument): any {
        return {
            sampleDocumentId: document.id,
            templateId: document.templateId,
            annotations: this._unfillDocEx(DocumentUtils.deleteDocExBackup(document.extraction)),
        };
    }

    private static _fillDocEx(extraction: IDocumentExtraction, extractionFieldNames: IExtractionFieldNames, supportedExtractionFields: any, resourceBundle: any, documentType: string): IDocumentExtraction {
        // make the document/sample document compatible with ocr viewer
        extraction.headerFields = extractionFieldNames.headerFields.map(fieldName => {
            const capability = supportedExtractionFields.headerFields.filter(c => c.name === fieldName)[0];
            let ex = extraction.headerFields.filter(c => c.name === fieldName)[0];
            if (!ex) {
                ex = this._createEmptyExtractionObject(fieldName);
            }
            return {
                ...ex,
                type: capability.type,
                category: capability.category,
                label: capabilityLabelFormatter(ex.name, resourceBundle, true, documentType),
            };
        });
        extraction.lineItems = extraction.lineItems.map((lineItemPayload, index) => {
            return this._fillLineItem(lineItemPayload, index, extractionFieldNames, supportedExtractionFields, resourceBundle, documentType);
        });
        return extraction;
    }

    private static _fillLineItem(lineItemPayload: any[]|ILineItem, index: number, extractionFieldNames: IExtractionFieldNames, supportedExtractionFields: any, resourceBundle: any, documentType: string): ILineItem {
        return {
            index: (index + 1),
            fieldLabel: "Line Item " +  (index + 1),
            columns: extractionFieldNames.lineItemFields.map(column => {
                const capability = supportedExtractionFields.lineItemFields.filter(c => c.name === column)[0];
                let ex;
                if (Array.isArray(lineItemPayload)) {
                    ex = lineItemPayload.filter(c => c.name === column)[0];
                } else if (lineItemPayload.columns) {
                    ex = lineItemPayload.columns.filter(c => c.name === column)[0];
                }
                if (!ex) {
                    ex = this._createEmptyExtractionObject(column);
                }
                return {
                    ...ex,
                    type: capability.type,
                    category: capability.category,
                    index: index,
                    label: capabilityLabelFormatter(ex.name, resourceBundle, false, documentType),
                };
            }),
        };
    }

    private static _unfillDocEx(docEx: IDocumentExtraction): any {
        docEx.headerFields = docEx.headerFields.filter(hf => ![undefined, null, ""].includes(hf.value));
        docEx.headerFields = docEx.headerFields.map(R.omit(["type", "category", "label"])) as any;
        docEx.lineItems = docEx.lineItems.filter(li => li.columns.length > 0)
        docEx.lineItems = docEx.lineItems.map(lineItem => {
            return lineItem.columns.map(R.omit(["type", "category", "index", "label"]));
        }) as any;
        if (docEx.lineItems.length === 0) {
            delete docEx.lineItems;
        }
        return docEx;
    }

    /**
     * @param templateId Returns all template names for the client if id is not provided
     */
    public static getTemplateInfoById(templateId?: string) {
        return ServiceCall.get(
            `${Constants.API_BASE_URL}templates${templateId ? '/'+templateId : ''}`,
            {
                timeout: 10000,
                data: {
                    "clientId": Constants.CLIENT_ID,
                    "includeHeader": false,
                    "includeLineItems": false
                }
            }).then(
            (response: any) => {
                if (response.status === "success") {
                    return response.data;
                }
                return false;
            });
    }
}
