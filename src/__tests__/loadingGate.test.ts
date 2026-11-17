import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  bootstrap: vi.fn(),
  hydrate: vi.fn()
}));

vi.mock('../App', () => ({
  default: () => null,
  hydrateApplicationState: mocks.hydrate
}));
vi.mock('../security/operationalStorage', () => ({
  bootstrapOperationalStorage: mocks.bootstrap
}));
vi.mock('../components/StorageRecoveryGate', () => ({
  default: () => null
}));
vi.mock('../components/CustomizationLauncher', () => ({
  default: () => null
}));

describe('2B-3c application loading gate', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('waits for operational bootstrap before starting hydration and mounts under StrictMode once', async () => {
    document.body.innerHTML = '<div id="root"></div>';
    let resolveBootstrap!: (value: { status: 'ready'; issues: string[] }) => void;
    mocks.bootstrap.mockReturnValue(new Promise((resolve) => { resolveBootstrap = resolve; }));
    mocks.hydrate.mockResolvedValue({});

    await import('../main');

    await vi.waitFor(() => expect(mocks.bootstrap).toHaveBeenCalledTimes(1));
    expect(mocks.hydrate).not.toHaveBeenCalled();

    resolveBootstrap({ status: 'ready', issues: [] });
    await vi.waitFor(() => expect(mocks.hydrate).toHaveBeenCalledTimes(1));
  });
});
