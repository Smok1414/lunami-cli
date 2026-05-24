import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { Box, Text } from 'ink';
import { flattenModelGroups } from '../../models.js';
import { useBlink } from '../hooks/useBlink.js';
import { t } from '../../i18n.js';
export function ModelPicker({ groups, search, loading = false, selectedIndex, customMode, customInput, theme }) {
    const caretVisible = useBlink();
    const flatModels = flattenModelGroups(groups);
    const renderItems = [];
    renderItems.push({ type: 'custom' });
    groups.forEach((group, groupIndex) => {
        renderItems.push({ type: 'group', label: group.label, icon: group.icon, isFirst: groupIndex === 0 });
        group.models.forEach((model) => {
            const flatIndex = flatModels.indexOf(model);
            renderItems.push({ type: 'model', model, index: flatIndex });
        });
    });
    const maxVisibleItems = 12;
    let targetIndex = 0;
    if (customMode || selectedIndex === 0) {
        targetIndex = 0;
    }
    else {
        targetIndex = renderItems.findIndex(i => i.type === 'model' && i.index === selectedIndex - 1);
        if (targetIndex === -1)
            targetIndex = 0;
    }
    let startIndex = 0;
    if (renderItems.length > maxVisibleItems) {
        startIndex = targetIndex - Math.floor(maxVisibleItems / 2);
        if (startIndex < 0)
            startIndex = 0;
        if (startIndex + maxVisibleItems > renderItems.length) {
            startIndex = renderItems.length - maxVisibleItems;
        }
    }
    const visibleItems = renderItems.slice(startIndex, startIndex + maxVisibleItems);
    return (_jsxs(Box, { flexDirection: "column", children: [!customMode && (_jsxs(Text, { color: search ? theme.assistant : theme.muted, children: ["(", t('search_prompt'), " ", search, caretVisible ? '█' : ' ', ")"] })), startIndex > 0 && _jsxs(Text, { color: theme.modalDim, children: ["  ", t('hidden_above'), " (", startIndex, ")..."] }), visibleItems.map((item, i) => {
                if (item.type === 'custom') {
                    return (_jsxs(Text, { color: customMode || selectedIndex === 0 ? theme.modalTitle : theme.muted, bold: customMode || selectedIndex === 0, children: [customMode || selectedIndex === 0 ? '  ❯ ' : '    ', t('enter_model'), " ", customMode ? `${customInput}${caretVisible ? '█' : ' '}` : ''] }, "custom"));
                }
                if (item.type === 'group') {
                    return (_jsxs(Box, { flexDirection: "column", children: [i > 0 && _jsx(Text, { children: " " }), _jsxs(Text, { color: theme.modalDim, children: ['  ', item.icon, " ", _jsx(Text, { color: theme.assistant, bold: true, children: item.label })] })] }, `g-${item.label}`));
                }
                if (item.type === 'model') {
                    const sel = item.index === selectedIndex - 1 && !customMode;
                    return (_jsxs(Text, { color: sel ? theme.modalTitle : theme.muted, bold: sel, children: [sel ? '  ❯ ' : '    ', item.model] }, `m-${item.model}`));
                }
                return null;
            }), startIndex + maxVisibleItems < renderItems.length && (_jsxs(Text, { color: theme.modalDim, children: ["  ", t('hidden_below'), " (", renderItems.length - (startIndex + maxVisibleItems), ")..."] })), loading && _jsxs(Text, { color: theme.muted, children: ["  ", t('loading_models')] }), _jsxs(Text, { color: theme.muted, children: ["  ", t('nav_hint')] })] }));
}
