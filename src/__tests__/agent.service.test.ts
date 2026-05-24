import {describe, expect, it, afterEach, jest} from '@jest/globals';
import {AgentService} from '../app/agent/agent.service.js';
import {LunaticEngine} from '../core/agent/lunatic.js';
import {setAgentMode} from '../state.js';

describe('AgentService', () => {
  afterEach(() => {
    setAgentMode('auto');
    jest.restoreAllMocks();
  });

  it('routes global lunatic mode through the autonomous engine', async () => {
    setAgentMode('lunatic');
    const runSpy = jest
      .spyOn(LunaticEngine.prototype, 'run')
      .mockImplementation(async () => []);

    const service = new AgentService();

    await service.run({
      history: [],
      onEvent: () => {}
    });

    expect(runSpy).toHaveBeenCalledTimes(1);
    expect(runSpy.mock.calls[0]?.[0].mode).toBe('lunatic');
  });
});
