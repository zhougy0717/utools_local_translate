const fs = require('fs');
const path = require('path');
const { regexRules } = require('./regex_rules');
let jarValidator;

/**
 * Load configuration from config.json or environment variables.
 */
function loadConfig() {
    const configPath = path.join(__dirname, '../config.json');
    if (!fs.existsSync(configPath)) {
        throw new Error("Config file missing at " + configPath);
    }
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    // Environment variable overrides
    if (process.env.PLANTUML_JAR_PATH) config.plantuml_jar_path = process.env.PLANTUML_JAR_PATH;
    if (process.env.JAVA_EXECUTABLE) config.java_executable = process.env.JAVA_EXECUTABLE;

    return config;
}

/**
 * Check that required dependencies (plantuml.jar, java) exist.
 */
function checkDependencies(config) {
    // Check plantuml.jar exists
    if (!config.plantuml_jar_path || !fs.existsSync(config.plantuml_jar_path)) {
        throw new Error(
            `plantuml.jar not found at "${config.plantuml_jar_path || '(not configured)'}".\n` +
            `Please update config.json "plantuml_jar_path" with the correct absolute path, ` +
            `or set PLANTUML_JAR_PATH environment variable.`
        );
    }
    // Check java is available (best effort)
    try {
        const { execSync } = require('child_process');
        execSync(`"${config.java_executable || 'java'}" -version`, {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe']
        });
    } catch (e) {
        throw new Error(
            `Java executable not found: "${config.java_executable || 'java'}".\n` +
            `Please install Java or update config.json "java_executable" with the correct path, ` +
            `or set JAVA_EXECUTABLE environment variable.`
        );
    }
}

/**
 * Apply all Regex fix rules to content.
 */
function applyRegexFixes(content) {
    let fixedContent = content;
    for (const rule of regexRules) {
        fixedContent = rule.apply(fixedContent);
    }
    return fixedContent;
}

/**
 * Normalize a PlantUML block to the standard Markdown fence format:
 * ```plantuml
 * @startuml
 * [content]
 * @enduml
 * ```
 */
function normalizeBlock(content) {
    let normalized = content.trim();

    // Ensure starts with @startuml
    const startumlIdx = normalized.indexOf('@startuml');
    if (startumlIdx > 0) {
        normalized = '@startuml\n' + normalized.substring(startumlIdx + '@startuml'.length).trim();
    } else if (!normalized.startsWith('@startuml')) {
        normalized = '@startuml\n' + normalized;
    }

    // Ensure ends with @enduml
    const endumlIdx = normalized.lastIndexOf('@enduml');
    if (endumlIdx >= 0 && endumlIdx !== normalized.length - '@enduml'.length - 1) {
        normalized = normalized.substring(0, endumlIdx).trimEnd() + '\n@enduml';
    } else if (!normalized.endsWith('@enduml')) {
        normalized = normalized.trimEnd() + '\n@enduml';
    }

    return normalized;
}

/**
 * Process a single Markdown file: find all PlantUML blocks and fix them.
 */
function processMarkdown(markdown, config) {
    const blockRegex = /```(plantuml|puml)\s*\n([\s\S]*?)\n```/g;
    let match;
    let result = markdown;
    let blockIndex = 0;
    let hasErrors = false;

    while ((match = blockRegex.exec(markdown)) !== null) {
        blockIndex++;
        const fullMatch = match[0];
        const lang = match[1];
        const rawContent = match[2];

        console.log(`\n--- Block #${blockIndex} (${lang}) ---`);

        // Step 1: Regex Pass (fast fixes)
        let fixed = applyRegexFixes(rawContent);

        // Step 2: Jar Pass (authoritative syntax check via plantuml.jar)
        let jarResult = null;
        if (config) {
            try {
                jarResult = fixLoop(fixed, config);
                fixed = jarResult.content;
                if (jarResult.success) {
                    console.log(`  [Jar Pass] Fixed in ${jarResult.attempts} attempt(s): ${jarResult.fixesApplied.join('; ') || 'No errors found'}`);
                } else {
                    hasErrors = true;
                    console.warn(`  [Jar Pass] Could not fully fix this block.`);
                }
            } catch (err) {
                hasErrors = true;
                console.error(`  [Jar Pass] Error: ${err.message}`);
                // Keep the regex-fixed version even if jar pass fails
            }
        }

        // Step 3: Normalize output format
        fixed = normalizeBlock(fixed);
        const replacement = '```plantuml\n' + fixed + '\n```';

        result = result.replace(fullMatch, replacement);
    }

    return { content: result, hasErrors };
}

/**
 * Lint a single Markdown file.
 */
function lintFile(filePath) {
    let config;
    try {
        config = loadConfig();
        checkDependencies(config);
        // Lazy load jarValidator only when config is valid
        if (!jarValidator) {
            jarValidator = require('./jar_validator');
            global.fixLoop = jarValidator.fixLoop;
        }
    } catch (err) {
        console.error(`Dependency check failed: ${err.message}`);
        console.warn('Proceeding with Regex-only mode (no Jar Pass validation).');
        config = null;
    }

    const absPath = path.resolve(filePath);
    if (!fs.existsSync(absPath)) {
        console.error(`File not found: ${absPath}`);
        process.exit(1);
    }

    const content = fs.readFileSync(absPath, 'utf8');
    const { content: fixedContent, hasErrors } = processMarkdown(content, config);

    if (content !== fixedContent) {
        fs.writeFileSync(absPath, fixedContent);
        console.log(`\n✅ Fixed: ${absPath}`);
    } else {
        console.log(`\n✓ No changes needed: ${absPath}`);
    }

    if (hasErrors) {
        console.log('\n⚠ Some blocks could not be fully auto-fixed. Manual review recommended.');
    }
}

// CLI entry point
const args = process.argv.slice(2);
if (args.length > 0) {
    lintFile(args[0]);
} else {
    console.log("Usage: node linter.js <markdown_file>");
}

module.exports = {
    loadConfig,
    checkDependencies,
    applyRegexFixes,
    normalizeBlock,
    processMarkdown
};
