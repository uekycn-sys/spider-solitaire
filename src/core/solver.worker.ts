import { solveFromState } from './solver';
import type { SolverRequest, SolverResponse } from './types';

self.onmessage = (event: MessageEvent<SolverRequest>) => {
  const { requestId, state, avoidHashes } = event.data;
  const response: SolverResponse = solveFromState(state, {
    requestId,
    avoidHashes,
  });
  self.postMessage(response);
};
