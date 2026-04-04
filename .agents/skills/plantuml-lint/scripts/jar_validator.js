const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

/**
 * Validate PlantUML content using plantuml.jar -syntax check.
 * @param {string} content - The PlantUML source code
 * @param {object} config - Config object with plantuml_jar_path, java_executable
 * @returns {{ok: boolean, errors: Array<{line: number, message: string}>}}
 */
function validateWithJar(content, config) {
    // Write content to temp file
    const tmpDir = fs.mkdtempSync(path.join(osTmpdir(), 'plantuml-lint-'));
    const tmpFile = path.join(tmpDir, `lint-${crypto.randomBytes(4).toString('hex')}.puml`);

    try {
        fs.writeFileSync(tmpFile, content, 'utf8');

        const cmd = `"${config.java_executable}" -jar "${config.plantuml_jar_path}" -syntax "${tmpFile}"`;
        let stdout;
        try {
            stdout = execSync(cmd, {
                encoding: 'utf8',
                timeout: 30000,
                stdio: ['pipe', 'pipe', 'pipe']
            });
        } catch (e) {
            stdout = e.stdout || e.stderr || '';
        }

        // Parse Error line (X) patterns
        const errorRegex = /Error\s+line\s+\((\d+)\)\s*[:\-]?\s*(.*)?/gi;
        const errors = [];
        let match;

        while ((match = errorRegex.exec(stdout)) !== null) {
            errors.push({
                line: parseInt(match[1], 10),
                message: (match[2] || 'Syntax error').trim()
            });
        }

        return {
            ok: errors.length === 0,
            errors: errors
        };
    } finally {
        // Cleanup temp file
        try {
            fs.unlinkSync(tmpFile);
            fs.rmdirSync(tmpDir);
        } catch (_) {
            // Ignore cleanup errors
        }
    }
}

/**
 * Heuristic fix based on error line context.
 * @param {string} content - The full PlantUML content
 * @param {number} errorLine - 1-based error line number
 * @param {string} errorMsg - The error message from plantuml.jar
 * @returns {string} Fixed content
 */
function heuristicFix(content, errorLine, errorMsg) {
    const lines = content.split('\n');
    const idx = errorLine - 1; // Convert to 0-based

    if (idx < 0 || idx >= lines.length) {
        return content;
    }

    const errorMsgLower = errorMsg.toLowerCase();

    // Strategy 1: Missing end keyword (if, while, loop, switch, etc.)
    const blockKeywords = [
        'if', 'while', 'loop', 'switch', 'group',
        'alt', 'opt', 'else', 'fork', 'case',
        'region', 'ref', 'salt', 'state', 'critical'
    ];
    const blockStartRegex = new RegExp(`^\\s*(${blockKeywords.join('|')})\\b`, 'i');
    const blockEndMap = {
        if: 'endif', while: 'endwhile', loop: 'endloop',
        switch: 'endswitch', group: 'endgroup', alt: 'endelse',
        opt: 'endopt', else: 'endif', fork: 'endfork',
        case: 'endswitch', region: 'endregion', ref: 'endref',
        salt: 'endsalt', state: 'endstate', critical: 'endcritical'
    };

    if (errorMsgLower.includes('unexpected token') ||
        errorMsgLower.includes('expecting') ||
        errorMsgLower.includes('syntax error')) {

        // Check if there's an unclosed block keyword before the error line
        let openBlocks = [];
        for (let i = 0; i <= idx && i < lines.length; i++) {
            const m = lines[i].match(blockStartRegex);
            if (m) {
                openBlocks.push({ keyword: m[1].toLowerCase(), line: i + 1 });
            }
            // Check for endXXX keywords that close blocks
            for (const [start, endKey] of Object.entries(blockEndMap)) {
                if (new RegExp(`^\\s*${endKey}\\b`, 'i').test(lines[i])) {
                    // Remove the most recent matching open block
                    const openIdx = openBlocks.findIndex(b => b.keyword === start);
                    if (openIdx >= 0) openBlocks.splice(openIdx, 1);
                }
            }
        }

        // If we have unclosed blocks, add end keywords before @enduml
        if (openBlocks.length > 0) {
            const endLines = [...lines];
            // Find @enduml position and insert before it
            let endumlIdx = endLines.findIndex(l => /^\s*@enduml\s*$/.test(l));
            if (endumlIdx === -1) endumlIdx = endLines.length;

            // Insert end keywords in reverse order (LIFO)
            const inserts = openBlocks.reverse().map(b => blockEndMap[b.keyword]).filter(Boolean);
            endLines.splice(endumlIdx, 0, ...inserts);

            return endLines.join('\n');
        }
    }

    // Strategy 2: Undefined participant/entity/actor/component -> auto-declare
    if (errorMsgLower.includes('undefined') ||
        errorMsgLower.includes('unknown') ||
        errorMsgLower.includes('cannot find')) {
        // Extract identifier from the error line or nearby arrow lines
        const idPattern = /^(\s*)([\w][\w.]*)\s*(->|-->|=>>|<-|<--|<<=|=>|-\\|\\|-)/;
        const idMatch = lines[idx].match(idPattern);
        if (idMatch) {
            const identifier = idMatch[2];
            // Check if this identifier is already declared
            const alreadyDeclared = lines.some(l =>
                new RegExp(`^\\s*(participant|entity|actor|component|interface|usecase|class)\\s+${identifier}\\b`, 'i').test(l)
            );
            if (!alreadyDeclared) {
                const fixed = [...lines];
                // Find position after @startuml to insert declaration
                let insertAfter = fixed.findIndex(l => /^\s*@startuml\s*$/.test(l));
                if (insertAfter >= 0) {
                    fixed.splice(insertAfter + 1, 0, `participant ${identifier}`);
                    return fixed.join('\n');
                }
            }
        }
    }

    // Strategy 3: Illegal/problematic characters on error line
    // Remove control characters except newline/tab/carriage-return
    const cleanedLine = lines[idx].replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    if (cleanedLine !== lines[idx]) {
        lines[idx] = cleanedLine;
        return lines.join('\n');
    }

    // Strategy 4: Fix common syntax issues on error line
    let line = lines[idx];

    // Replace full-width arrows with ASCII
    line = line.replace(/\u2014>/g, '-->');   // → (em dash)
    line = line.replace(/\u2013>/g, '->');     // – (en dash)
    line = line.replace(/–>/g, '->');           // en dash
    line = line.replace(/—>/g, '-->');          // em dash

    if (line !== lines[idx]) {
        lines[idx] = line;
        return lines.join('\n');
    }

    // No fix applied, return original
    return content;
}

/**
 * Main fix loop: validate -> heuristicFix -> retry.
 * @param {string} content - Raw PlantUML content (without fences)
 * @param {object} config - Configuration object
 * @returns {{success: boolean, content: string, attempts: number, fixesApplied: string[]}}
 */
function fixLoop(content, config) {
    const maxRetries = config.max_retries || 3;
    let currentContent = content;
    const fixesApplied = [];

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        const result = validateWithJar(currentContent, config);

        if (result.ok) {
            return {
                success: true,
                content: currentContent,
                attempts: attempt + 1,
                fixesApplied: fixesApplied
            };
        }

        if (result.errors.length === 0) {
            // No parseable errors but jar reported failure — give up
            break;
        }

        const primaryError = result.errors[0];
        console.log(
            `  [Jar Pass] Attempt ${attempt + 1}/${maxRetries}: ` +
            `Error at line ${primaryError.line}: ${primaryError.message}`
        );

        const previousContent = currentContent;
        currentContent = heuristicFix(currentContent, primaryError.line, primaryError.message);

        if (currentContent === previousContent) {
            // heuristicFix couldn't make any change — avoid infinite loop
            console.log(`  [Jar Pass] No fix applied, stopping retries.`);
            break;
        }

        fixesApplied.push(`Attempt ${attempt + 1}: line ${primaryError.line} - ${primaryError.message}`);
    }

    // Final validation to get remaining errors
    const finalResult = validateWithJar(currentContent, config);
    if (!finalResult.ok && finalResult.errors.length > 0) {
        throw new Error(
            `Unfixable after ${maxRetries} attempts. ` +
            `Remaining errors:\n` +
            finalResult.errors.map(e => `  Line ${e.line}: ${e.message}`).join('\n')
        );
    }

    return {
        success: finalResult.ok,
        content: currentContent,
        attempts: maxRetries,
        fixesApplied: fixesApplied
    };
}

/**
 * Cross-platform tmpdir helper.
 */
function osTmpdir() {
    return process.env.TMPDIR || process.env.TEMP || process.env.TMP || '/tmp';
}

module.exports = {
    validateWithJar,
    heuristicFix,
    fixLoop
};
