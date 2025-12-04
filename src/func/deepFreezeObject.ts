function deepFreezeObjectHelper(object: object, encounteredObjects: Map<object, object>): Readonly<object> {
    if (typeOf(object) !== "table") error("Cannot deep freeze object. The object is not a table.");
    table.freeze(object);

    for (const [, v] of pairs(object)) {
        if (typeIs(v, "table") && encounteredObjects.get(object) === undefined) deepFreezeObjectHelper(v, encounteredObjects);
    }

    return object;
}

export function deepFreezeObject<T extends object>(object: T): Readonly<T> {
    return deepFreezeObjectHelper(object, new Map()) as Readonly<T>;
}