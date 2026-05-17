// utils/caseConverter.ts

const snakeToCamel = (str: string) => str.replace(/([-_][a-z])/g, (group) => group.toUpperCase().replace('-', '').replace('_', ''));

export const convertObjectKeys = (obj: any, converter: (key: string) => string): any => {
    if (Array.isArray(obj)) {
        return obj.map(v => convertObjectKeys(v, converter));
    } else if (obj !== null && typeof obj === 'object') {
        return Object.keys(obj).reduce((acc, key) => {
            acc[converter(key)] = convertObjectKeys(obj[key], converter);
            return acc;
        }, {} as any);
    }
    return obj;
};

export const keysToCamel = (obj: any) => convertObjectKeys(obj, snakeToCamel);
