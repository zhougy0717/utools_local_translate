const regexRules = [
    {
        name: "Ensure @startuml/@enduml",
        apply: (content) => {
            let fixed = content.trim();
            if (!fixed.startsWith("@startuml")) {
                fixed = "@startuml\n" + fixed;
            }
            if (!fixed.endsWith("@enduml")) {
                fixed = fixed + "\n@enduml";
            }
            return fixed;
        }
    },
    {
        name: "Fix unclosed quotes",
        apply: (content) => {
            return content.split('\n').map(line => {
                const quoteCount = (line.match(/"/g) || []).length;
                if (quoteCount % 2 !== 0) {
                    return line + '"';
                }
                return line;
            }).join('\n');
        }
    },
    {
        name: "Normalize arrow syntax",
        apply: (content) => {
            // Replace full-width / Unicode arrows with standard ASCII
            let fixed = content;
            fixed = fixed.replace(/\u2013>/g, '->');       // – (U+2013 en dash)
            fixed = fixed.replace(/\u2014>/g, '-->');      // — (U+2014 em dash)
            fixed = fixed.replace(/\u2192/g, '->');         // → (U+2192 right arrow)
            fixed = fixed.replace(/\u21d2/g, '=>');         // ⇒ (U+21D2 right double arrow)
            fixed = fixed.replace(/\u2799/g, '--->');      // ➙ (U+2799 heavy long right arrow)
            return fixed;
        }
    },
    {
        name: "Normalize comma-separated font names",
        apply: (content) => {
            // skinparam defaultFontName "Inter", "sans-serif" → skinparam defaultFontName "Inter"
            // PlantUML only accepts a single font name, not CSS-style fallback lists
            return content.split('\n').map(line => {
                const fontMatch = line.match(
                    /^(\s*skinparam\s+\w*[Ff]ont[Nn]ame\s+)("[^"]*"|[\w-]+)\s*,\s*(".+"|[\w-]+.*)$/i
                );
                if (fontMatch) {
                    return fontMatch[1] + fontMatch[2];
                }
                return line;
            }).join('\n');
        }
    },
    {
        name: "Remove interfaceStyle in activity diagrams",
        apply: (content) => {
            // skinparam interfaceStyle rectangle is only valid for class/component diagrams.
            // In activity diagrams (detected by start/stop/fork keywords), remove it.
            const isActivity = /^\s*(start|stop|fork)\b/m.test(content);
            if (isActivity) {
                return content.split('\n').filter(line =>
                    !/^\s*skinparam\s+interfaceStyle\b/i.test(line)
                ).join('\n');
            }
            return content;
        }
    },
    {
        name: "Convert end partition to brace syntax",
        apply: (content) => {
            // "end partition" is not supported in older PlantUML versions.
            // Convert: partition "Name" #Color\n ... \nend partition
            // To:      partition "Name" #Color {\n ... \n}
            const lines = content.split('\n');
            const result = [];
            const partitionStack = []; // track open partitions without braces

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];

                // Match partition declaration WITHOUT opening brace
                // e.g. "  partition "Name" #Color" or "  partition #Color "Name""
                const partitionNoBrace = /^(\s*)partition\s+(.+)$/i;
                const partitionWithBrace = /^(\s*)partition\s+(.+)\{\s*$/i;

                if (partitionWithBrace.test(line)) {
                    // Already has brace syntax — pass through
                    result.push(line);
                } else if (partitionNoBrace.test(line)) {
                    const match = line.match(partitionNoBrace);
                    const indent = match[1];
                    const rest = match[2].trimEnd();
                    // Push this partition onto the stack for later matching
                    partitionStack.push(indent);
                    result.push(`${indent}partition ${rest} {`);
                } else if (/^\s*end\s+partition\s*$/i.test(line)) {
                    if (partitionStack.length > 0) {
                        const indent = partitionStack.pop();
                        result.push(`${indent}}`);
                    } else {
                        // No matching open partition — leave as-is
                        result.push(line);
                    }
                } else {
                    result.push(line);
                }
            }

            return result.join('\n');
        }
    },
    {
        name: "Normalize floating note to note",
        apply: (content) => {
            // "floating note" is not supported in older PlantUML versions.
            // Convert to plain "note" which is universally supported.
            return content.split('\n').map(line => {
                return line.replace(
                    /^(\s*)floating\s+note\s+(left|right|top|bottom)\b/i,
                    '$1note $2'
                );
            }).join('\n');
        }
    },
    {
        name: "Remove extra blank lines inside diagram",
        apply: (content) => {
            const lines = content.split('\n');
            const result = [];
            let consecutiveEmpty = 0;

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                if (/^\s*$/.test(line)) {
                    consecutiveEmpty++;
                    // Keep at most 1 consecutive empty line inside the diagram body
                    // But always keep empty lines adjacent to @startuml or before @enduml
                    const prevLine = result.length > 0 ? result[result.length - 1] : '';
                    const nextLine = i < lines.length - 1 ? lines[i + 1] : '';
                    const isNearFence = /^\s*@startuml/.test(prevLine) ||
                                        /^\s*@enduml/.test(nextLine);

                    if (consecutiveEmpty <= 1 || isNearFence) {
                        result.push(line);
                    }
                } else {
                    consecutiveEmpty = 0;
                    result.push(line);
                }
            }

            return result.join('\n');
        }
    },
    {
        name: "Sanitize problematic characters",
        apply: (content) => {
            // Remove ASCII control characters except \n, \r, \t
            return content.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
        }
    }
];

module.exports = { regexRules };
