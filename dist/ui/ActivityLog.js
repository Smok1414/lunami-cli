import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from 'ink';
import { formatStepLine } from '../activity.js';
import { t } from '../i18n.js';
export function ActivityLog({ steps, theme, fallbackLabel }) {
    const rows = steps.length > 0
        ? steps
        : fallbackLabel
            ? [{
                    id: 'fallback',
                    kind: 'thought',
                    label: fallbackLabel,
                    status: 'active'
                }]
            : [];
    return (_jsxs(Box, { flexDirection: "column", marginTop: 1, children: [rows.map((step) => {
                const active = step.status === 'active';
                const iconColor = active ? theme.accent : theme.title;
                const textColor = active ? theme.title : theme.muted;
                return (_jsxs(Box, { children: [_jsx(Text, { color: iconColor, children: "\u2B21 " }), _jsx(Text, { color: textColor, bold: active, children: formatStepLine(step) })] }, step.id));
            }), rows.length === 0 ? (_jsx(Text, { color: theme.muted, children: t('agent_thinking') })) : null] }));
}
