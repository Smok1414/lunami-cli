export function wrapText(text, width) {
    if (width <= 0)
        return [text];
    const lines = text.split('\n');
    const result = [];
    for (const line of lines) {
        if (line.length <= width) {
            result.push(line);
            continue;
        }
        let remaining = line;
        while (remaining.length > width) {
            let splitIndex = remaining.lastIndexOf(' ', width);
            if (splitIndex <= 0) {
                splitIndex = width;
            }
            result.push(remaining.slice(0, splitIndex).trimEnd());
            remaining = remaining.slice(splitIndex).trimStart();
        }
        if (remaining.length > 0) {
            result.push(remaining);
        }
    }
    return result;
}
/** Перенос с учётом префикса (◆, время, иконка) — иначе строки вылезают за терминал и «склеиваются». */
export function wrapMultilineText(text, outerWidth, reservedForLine) {
    const result = [];
    let lineIndex = 0;
    for (const logicalLine of text.split('\n')) {
        const contentWidth = Math.max(8, outerWidth - reservedForLine(lineIndex));
        const wrapped = wrapText(logicalLine, contentWidth);
        for (const line of wrapped) {
            result.push(line);
            lineIndex += 1;
        }
        if (wrapped.length === 0) {
            result.push('');
            lineIndex += 1;
        }
    }
    return result;
}
export function estimateMessageLines(text, textWidth) {
    const visibleText = text.replace(/\t/g, '  ');
    return wrapText(visibleText, textWidth).length;
}
