import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import postcss from 'postcss';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('../src/', import.meta.url));
const definitions = new Set(['styles/theme.css', 'styles/visualColors.ts']);
const literal = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{4}|[0-9a-f]{3})(?![0-9a-f])|(?:rgb|hsl)a?\(/i;
const utility = /(?:^|[\s:])(?:bg|text|border(?:-[trblxy])?|ring(?:-offset)?|divide|outline|fill|stroke|decoration|placeholder|accent|from|via|to|shadow)-(?:white|black|gray|slate|zinc|stone|neutral|green|emerald|red|blue|amber|yellow|orange|purple|indigo|pink|cyan|teal|violet|lime|rose|sky|fuchsia)(?:-\d+)?(?=\b|\/)/;
const named = /^(?:white|black|gray|grey|red|green|blue|orange|yellow|purple|pink|gold|lime|cyan|navy)$/i;
const failures = [];
let files = 0;
for (const relative of fs.readdirSync(source, { recursive: true })) {
    const name = relative.replaceAll('\\', '/');
    if (!/\.(?:css|tsx?|jsx?)$/.test(name) || /(?:__tests__|__fixtures__|\.test\.)/.test(name) || definitions.has(name)) continue;
    const text = fs.readFileSync(path.join(source, relative), 'utf8');
    files++;
    const fail = (line, value) => failures.push(`${name}:${line}: ${value.slice(0, 130)}`);
    if (name.endsWith('.css')) {
        postcss.parse(text).walkDecls(declaration => {
            if (literal.test(declaration.value) || named.test(declaration.value)) fail(declaration.source.start.line, declaration.prop);
        });
    } else {
        const ast = ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true);
        const visit = node => {
            if (ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
                const value = node.text;
                const colourAttribute = /^(?:color|background(?:Color)?|borderColor|fill|stroke|bgColor|fgColor)$/.test(node.parent?.name?.getText(ast) || '');
                if (literal.test(value) || utility.test(value) || (colourAttribute && named.test(value))) fail(ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1, value);
            }
            ts.forEachChild(node, visit);
        };
        visit(ast);
    }
}
if (failures.length) {
    console.error('Use shared semantic theme tokens (fixed visual paint belongs in visualColors.ts):\n' + failures.join('\n'));
    process.exitCode = 1;
} else {
    console.log(`Theme colour guard passed: ${files} production source files; palette confined to ${definitions.size} definition files.`);
}
