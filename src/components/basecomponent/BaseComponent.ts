export abstract class BaseComponentClass extends sap.ui.core.UIComponent {

    public init(): void {
        sap.ui.core.UIComponent.prototype.init.apply(this, arguments);
    }

}

export const BaseComponent = smartExtendComponent(sap.ui.core.UIComponent, "sap.bdp.components.basecomponent.BaseComponent", BaseComponentClass as any);

sap.ui.define("sap/bdp/components/basecomponent/BaseComponent", [], function() {
    return BaseComponent;
});

export function smartExtendComponent<S extends typeof sap.ui.core.Component, T extends S>(superClass: S, name: string, clazz: T, metadata?: IComponentMetadata): T {
    const initObject: any = {};
    const methods = Object.getOwnPropertyDescriptors(clazz.prototype);
    for (const functionName in methods) {
        if (functionName !== "constructor") {
            initObject[functionName] = methods[functionName].value;
        }
    }

    if (metadata) {
        initObject.metadata = metadata;
    }

    return superClass.extend<T>(name, initObject);
}
