// Converte uno schema nel formato di Gemini (type: "OBJECT", "STRING"…) in
// JSON Schema standard, quello che accettano i fornitori compatibili OpenAI
// (OpenRouter) per l'output strutturato.
export const geminiToJsonSchema = (schema: any): any => {
    if (Array.isArray(schema)) return schema.map(geminiToJsonSchema);
    if (!schema || typeof schema !== 'object') return schema;

    const out: Record<string, any> = {};
    for (const [key, value] of Object.entries(schema)) {
        if (key === 'type' && typeof value === 'string') {
            out.type = value.toLowerCase();
        } else if (key === 'properties' && value && typeof value === 'object') {
            out.properties = Object.fromEntries(
                Object.entries(value).map(([name, prop]) => [name, geminiToJsonSchema(prop)])
            );
        } else if (key === 'items') {
            out.items = geminiToJsonSchema(value);
        } else if (key !== 'nullable' && key !== 'propertyOrdering') {
            // description, enum, required…: identici nei due formati.
            out[key] = value;
        }
    }
    if (schema.nullable === true && typeof out.type === 'string') out.type = [out.type, 'null'];
    return out;
};
