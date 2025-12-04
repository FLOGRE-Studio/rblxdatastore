function deepFreezeObjectHelper(object: object, encounteredObjects: Set<object>): Readonly<object> {
    if (typeOf(object) !== "table") error("Cannot deep freeze object. The object is not a table.");
    if (encounteredObjects.has(object)) return object;

    encounteredObjects.add(table.freeze(object));

    for (const [, v] of pairs(object)) {
        if (typeIs(v, "table")) deepFreezeObjectHelper(v, encounteredObjects);
    }

    return object;
}

export function deepFreezeObject<T extends object>(object: T): Readonly<T> {
    return deepFreezeObjectHelper(object, new Set()) as Readonly<T>;
}