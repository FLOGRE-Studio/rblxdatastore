export interface Migration<DataSchema> {
    backwardsCompatible: boolean,
    migrate: (data: Partial<DataSchema> & Record<string, unknown>) => Partial<DataSchema> & Record<string, unknown>,
}