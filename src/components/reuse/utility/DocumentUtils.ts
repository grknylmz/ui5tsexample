import * as R from "ramda";
import {IDocumentExtraction, IExtraction, ILineItem} from "../../../../@types/bdp";

export class DocumentUtils {
    /**
     * tools to backup/restore documents
     * to create a backup of an extraction, create a field named "__backup" under that extraction
     * and clone the extraction into that field
     */

    public static backupDocEx = DocumentUtils.processDocEx(DocumentUtils.backupExtraction);

    public static restoreDocEx = DocumentUtils.processDocEx(DocumentUtils.restoreExtraction);

    public static deleteDocExBackup = DocumentUtils.processDocEx(DocumentUtils.deleteExtractionBackup);

    public static stashDocEx = DocumentUtils.deleteDocExBackup;

    public static applyStashedDocEx = function(stashedDocEx: IDocumentExtraction, docEx: IDocumentExtraction,
                                               emptyLineItemCreater: (index: number) => ILineItem): IDocumentExtraction {
        return {
            headerFields: R.map(hf => {
                const stashedHfs = R.filter(shf => shf.name === hf.name, stashedDocEx.headerFields);
                return stashedHfs.length === 0 ? hf : {
                    ...stashedHfs[0],
                    __backup: hf.__backup,
                };
            }, docEx.headerFields),
            lineItems: R.addIndex(R.map)((stashedRow: ILineItem, stashedRowIndex: number) => ({
                ...stashedRow,
                columns: R.map(cell => {
                    const stashedCells = R.filter(sCell => sCell.name === cell.name, stashedDocEx.lineItems[stashedRowIndex].columns);
                    return stashedCells.length === 0 ? cell : {
                        ...stashedCells[0],
                        __backup: cell.__backup,
                    };
                }, docEx.lineItems[stashedRowIndex] === undefined ? emptyLineItemCreater(stashedRowIndex).columns : docEx.lineItems[stashedRowIndex].columns),
            }), stashedDocEx.lineItems),
        };
    };

    public static processDocEx(processor: (extraction: IExtraction) => IExtraction): (docEx: IDocumentExtraction) => IDocumentExtraction {
        return (docEx: IDocumentExtraction) => {
            const columnsLens = R.lensPath(["columns"]);
            return {
                headerFields: R.map(processor, docEx.headerFields),
                lineItems: R.map(R.over(columnsLens, R.map(processor)), docEx.lineItems),
            };
        };
    }

    public static backupExtraction(extraction: IExtraction): IExtraction {
        const {__backup, ...extractionWithoutBackup} = extraction;
        return {
            ...extractionWithoutBackup,
            __backup: extractionWithoutBackup,
        };
    }

    public static restoreExtraction(extraction: IExtraction): IExtraction {
        return {
            ...extraction.__backup,
            __backup: extraction.__backup,
        };
    }

    public static deleteExtractionBackup(extraction: IExtraction): IExtraction {
        const {__backup, ...extractionWithoutBackup} = extraction;
        return extractionWithoutBackup;
    }

    public static applyStashedExtraction(stashedExtraction: IExtraction, extraction: IExtraction): IExtraction {
        return {
            ...stashedExtraction,
            __backup: extraction.__backup,
        };
    }
}
