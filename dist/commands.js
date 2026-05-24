import { t } from './i18n.js';
import { fuzzyMatch } from './ui/uiUtils.js';
export const commands = [
    { name: '/plan', group: 'agent', get description() { return t('cmd_plan'); } },
    { name: '/auto', group: 'agent', get description() { return t('cmd_auto'); } },
    { name: '/yolo', group: 'agent', get description() { return t('cmd_yolo'); } },
    { name: '/lunatic', group: 'agent', get description() { return t('cmd_lunatic'); } },
    { name: '/approve', group: 'agent', get description() { return t('cmd_approve'); } },
    { name: '/deny', group: 'agent', get description() { return t('cmd_deny'); } },
    { name: '/undo', group: 'agent', get description() { return t('cmd_undo'); } },
    { name: '/model', group: 'config', get description() { return t('cmd_model'); } },
    { name: '/api', group: 'config', get description() { return t('cmd_api'); } },
    { name: '/provider', group: 'config', get description() { return t('cmd_provider'); } },
    { name: '/theme', group: 'config', get description() { return t('cmd_theme'); } },
    { name: '/lang', group: 'config', get description() { return t('cmd_lang'); } },
    { name: '/mcp', group: 'config', get description() { return t('cmd_mcp'); } },
    { name: '/session', group: 'session', get description() { return t('cmd_session'); } },
    { name: '/export', group: 'session', get description() { return t('cmd_export'); } },
    { name: '/clear', group: 'session', get description() { return t('cmd_clear'); } },
    { name: '/cd', group: 'workspace', get description() { return t('cmd_cd'); } },
    { name: '/context', group: 'workspace', get description() { return t('cmd_context'); } },
    { name: '/rules', group: 'workspace', get description() { return t('cmd_rules'); } },
    { name: '/tree', group: 'workspace', get description() { return t('cmd_tree'); } }
];
export function filterCommands(query) {
    if (!query.startsWith('/')) {
        return [];
    }
    const search = query.toLowerCase();
    return commands.filter((cmd) => {
        if (cmd.name.startsWith(search)) {
            return true;
        }
        return fuzzyMatch(search, cmd.name) || fuzzyMatch(search.slice(1), cmd.description);
    });
}
