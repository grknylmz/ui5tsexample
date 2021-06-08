import _ from "lodash";
import {Logger} from "../../reuse/utility/Helper";

export class BaseControllerClass extends sap.ui.core.mvc.Controller {
    public onInit(): void {
        // @ts-ignore
        _.map((x: number) => x + 1, [1, 2, 3]);
    }

    logError(msg: string, details?: string, component?: string): void {
        if (!component) {
            component = this.getView().getControllerName();
        }
        Logger.logError(msg, details, component);
    }

    logInfo(msg: string, details?: string, component?: string, supportInfo?: Function): void {
        if (!component) {
            component = this.getView().getControllerName();
        }
        Logger.logInfo(msg, details, component, supportInfo);
    }

    hasPermission(permission: string, account: {permissions: string[]}): boolean {
        if (permission.startsWith("/") && permission.endsWith("/")) {
            const permRe = new RegExp(`^${permission.substr(1, permission.length - 2)}$`);
            return account.permissions.reduce((acc, perm) => acc || permRe.test(perm), false);
        } else {
            return account.permissions.includes(permission);
        }
    }
}

export function smartExtend<S extends typeof sap.ui.core.mvc.Controller, T extends S>(superClass: S, name: string, clazz: T): T {
    const initObject: any = {};
    const instance = new clazz("");
    const methods = Object.getOwnPropertyDescriptors(clazz.prototype);
    const properties = Object.getOwnPropertyDescriptors(instance);
    for (const propertyName in properties) {
        initObject[propertyName] = instance[propertyName];
    }
    for (const methodName in methods) {
        if (methodName !== "constructor") {
            initObject[methodName] = methods[methodName].value;
        }
    }

    return superClass.extend<T>(name, initObject);
}

export const BaseController = smartExtend(sap.ui.core.mvc.Controller, "sap.bdp.components.basecomponent.controller.BaseController", BaseControllerClass);

sap.ui.define("sap/bdp/components/basecomponent/controller/BaseController.controller", [], function() {
    return BaseController;
});
