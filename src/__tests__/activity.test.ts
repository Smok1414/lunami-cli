import {
  bumpToolCount,
  createEmptyToolCounts,
  formatStepLine,
  formatWorkLabel
} from '../activity.js';

describe('activity log', () => {
  test('aggregates read and search tools', () => {
    const counts = createEmptyToolCounts();
    bumpToolCount(counts, 'readFile');
    bumpToolCount(counts, 'readFile');
    bumpToolCount(counts, 'tree');
    bumpToolCount(counts, 'search');

    const label = formatWorkLabel(counts);
    expect(label).toContain('3');
    expect(label).toContain('1');
  });

  test('formats done step with duration', () => {
    const line = formatStepLine({
      id: 'thought-0',
      kind: 'thought',
      label: 'Thought',
      status: 'done',
      durationSec: 3
    });

    expect(line).toBe('Thought 3s');
  });
});
