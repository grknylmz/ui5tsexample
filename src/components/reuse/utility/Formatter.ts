export const statusFormatter = s => s === "DONE" ? "Information" : s === "CONFIRMED" ? "Success" : (s === "PENDING" ? "None": "Error");
export const templateStatusStateFormatter = s => s ? "Success" : "Information";
export const statusTooltipFormatter = function(status, i18ResourcesBundle) {
	const key = status === "DONE" ? "lb_status_tooltip_done" : 
		(status === "CONFIRMED" ? "lb_status_tooltip_confirmed" : 
			(status === "PENDING" ? "lb_status_tooltip_pending": "lb_status_tooltip_failed"));
	return i18ResourcesBundle.getText(key);
}
export const textFormatter = s => s === "DONE" ? "READY" : s ;
export const templateStatusTextFormatter = s => s ? "ACTIVE" : "DRAFT";
export const dateFormatter = s => {
	return (new Date(s)).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};
export const documentTypeFormatter = function(documentType, i18ResourcesBundle) {
	const _key = `lb_document_type_${documentType}`;
	const ret = i18ResourcesBundle.getText(_key);
	return ret === _key ? documentType : ret;
};
export const capabilityLabelFormatter = function(name, i18ResourcesBundle, isHeaderField, docType) {
	const prefix = isHeaderField ? 'hf' : "li"
	const docTypekey = `${prefix}_${name}_${docType}_label`;		
	const key = `${prefix}_${name}_label`;
	const retdocType = i18ResourcesBundle.getText(docTypekey);
	const ret = i18ResourcesBundle.getText(key);
	return retdocType === docTypekey ? (ret === key ? name : ret) : retdocType;

};
export const capabilityDescriptionFormatter = function(name, i18ResourcesBundle, isHeaderField, docType) {
	const prefix = isHeaderField ? 'hf' : "li"
	const docTypekey = `${prefix}_${name}_${docType}_desc`;
	const key = `${prefix}_${name}_desc`;
	const retdocType = i18ResourcesBundle.getText(docTypekey);
	const ret = i18ResourcesBundle.getText(key);
	return retdocType === docTypekey ? (ret === key ? `${name}Description` : ret) : retdocType;		
};

export const capabilityCategoryFormatter = function(name, i18ResourcesBundle, isHeaderField) {
	const prefix = isHeaderField ? 'hf' : "li"
	const _key = `${prefix}_category_${name}_label`;
	const ret = i18ResourcesBundle.getText(_key);
	return ret === _key ? `${name}Category` : ret;
};
