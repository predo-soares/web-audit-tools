import { FakeEngine } from '../support/fake-engine'
import { describeEngineViewContract } from '../support/engine-view-contract'

describeEngineViewContract('FakeEngine', () => {
  const engine = new FakeEngine('desktop')
  return {
    engine,
    currentUrl: () => engine.currentUrl,
    simulateMirrorFailure: (log) => engine.simulateMirrorFailure(log),
    isVisible: () => engine.visible,
    isAttached: () => engine.attached
  }
})
