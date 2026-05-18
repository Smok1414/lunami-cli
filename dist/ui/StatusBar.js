import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { t } from '../i18n.js';
export function StatusBar({ status, tokenCount, theme, hasContext, toolLabel, toolChain }) {
    const [waveFrame, setWaveFrame] = useState(0);
    const waveText = t('status_done');
    useEffect(() => {
        if (status === 'DONE') {
            let frame = 0;
            setWaveFrame(0);
            const timer = setInterval(() => {
                frame++;
                setWaveFrame(frame);
                if (frame > waveText.length + 5) {
                    clearInterval(timer);
                }
            }, 50);
            return () => clearInterval(timer);
        }
        setWaveFrame(0);
    }, [status, waveText.length]);
    const statusColor = status === 'ERROR' ? theme.error : status === 'DONE' ? theme.title : theme.assistant;
    const ctxColor = hasContext ? theme.ctxOn : theme.ctxOff;
    const ctxLabel = hasContext ? t('status_ctx_loaded') : t('status_ctx_none');
    let statusElement;
    if (status === 'DONE') {
        if (waveFrame > 0 && waveFrame <= waveText.length + 5) {
            statusElement = (_jsx(Text, { children: waveText.split('').map((char, i) => {
                    const distance = Math.abs(waveFrame - 2 - i);
                    const charColor = distance < 2 ? theme.accent : theme.title;
                    return (_jsx(Text, { color: charColor, children: char }, i));
                }) }));
        }
        else {
            statusElement = (_jsx(Text, { bold: true, color: statusColor, children: waveText }));
        }
    }
    else if (status === 'TOOL' && toolChain && toolChain.names.length > 0) {
        statusElement = (_jsx(Text, { children: toolChain.names.map((name, i) => {
                const isActive = i === toolChain.activeIndex;
                const isDone = i < toolChain.activeIndex;
                const color = isActive ? theme.accent : isDone ? theme.title : theme.muted;
                return (_jsxs(React.Fragment, { children: [i > 0 ? _jsx(Text, { color: theme.muted, children: " \u2192 " }) : null, _jsx(Text, { bold: isActive, color: color, children: isActive ? `[${name}]` : name })] }, i));
            }) }));
    }
    else {
        const statusText = toolLabel && status === 'TOOL' ? `TOOL · ${toolLabel}` : status;
        statusElement = (_jsx(Text, { bold: true, color: statusColor, children: statusText }));
    }
    return (_jsxs(Box, { justifyContent: "space-between", children: [_jsxs(Box, { children: [_jsx(Text, { color: theme.muted, children: t('status_label') }), _jsxs(Text, { color: ctxColor, children: [" ", ctxLabel] })] }), _jsxs(Box, { children: [statusElement, _jsxs(Text, { color: theme.muted, children: [' ', t('status_tokens').toUpperCase(), ": ", tokenCount] })] })] }));
}
