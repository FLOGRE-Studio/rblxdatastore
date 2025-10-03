export function deepFreezeObject<T extends object>(object: T): Readonly<T> {
    if (typeOf(object) !== "table") error("Cannot deep freeze object. The object is not a table.");
    table.freeze(object);

    for (const [, v] of pairs(object)) {
        if (typeIs(v, "table")) deepFreezeObject(v);
    }

    return object;
}