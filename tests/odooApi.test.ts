import type { StockMove } from '../src/types';

const config = {
  url: 'https://odoo.example.invalid',
  db: 'test-only',
  username: 'test-user',
  password: 'test-password',
};
const move: StockMove = {
  product_id: 42,
  product_name: 'Test milk',
  barcode: '6000000000042',
  quantity: 6,
  type: 'in',
  location: 'Main Warehouse',
  timestamp: new Date('2026-10-16T10:00:00Z'),
};

describe('createStockMove', () => {
  let api: typeof import('../src/services/odooApi').default;
  let post: jest.Mock;

  beforeEach(async () => {
    // Each case gets a fresh service, including a fresh authentication session.
    jest.resetModules();
    api = jest.requireActual('../src/services/odooApi').default;
    post = jest.requireMock('axios').post;
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await api.saveConfig(config);
    post.mockResolvedValueOnce({ data: { result: { uid: 7, session_id: 'test-session' } } });
  });

  afterEach(() => jest.restoreAllMocks());

  it.each(['in', 'out'] as const)('confirms a %s transfer only after a valid create response', async type => {
    post.mockResolvedValueOnce({ data: { result: 321 } });

    await expect(api.createStockMove({ ...move, type })).resolves.toBe(true);

    expect(post).toHaveBeenCalledTimes(2);
    expect(post).toHaveBeenLastCalledWith(
      `${config.url}/web/dataset/call_kw`,
      expect.objectContaining({
        params: {
          model: 'stock.picking',
          method: 'create',
          args: [{
            picking_type_id: type === 'in' ? 1 : 2,
            location_id: type === 'in' ? 8 : 12,
            location_dest_id: type === 'in' ? 12 : 9,
            move_lines: [[0, 0, {
              product_id: 42,
              product_uom_qty: 6,
              product_uom: 1,
              name: 'Test milk',
              location_id: type === 'in' ? 8 : 12,
              location_dest_id: type === 'in' ? 12 : 9,
            }]],
          }],
          kwargs: {},
        },
      }),
      { headers: { 'Content-Type': 'application/json', Cookie: 'session_id=test-session' } }
    );
  });

  it.each([false, undefined, null, 0, -1, 1.5, true, '321', {}, [], [321]])(
    'does not confirm an invalid create result: %p',
    async result => {
      post.mockResolvedValueOnce({ data: { result } });
      await expect(api.createStockMove(move)).resolves.toBe(false);
    }
  );

  it('rejects a JSON-RPC error even if the response also contains an ID', async () => {
    post.mockResolvedValueOnce({ data: { result: 321, error: { message: 'Access denied' } } });
    await expect(api.createStockMove(move)).resolves.toBe(false);
  });

  it('rejects an HTTP 200 JSON-RPC error response', async () => {
    post.mockResolvedValueOnce({ data: { error: { message: 'Invalid product' } } });
    await expect(api.createStockMove(move)).resolves.toBe(false);
  });

  it('returns false on a network failure without retrying the create call', async () => {
    post.mockRejectedValueOnce(new Error('Network disconnected'));
    await expect(api.createStockMove(move)).resolves.toBe(false);
    expect(post).toHaveBeenCalledTimes(2);
  });

  it.each([
    { result: false },
    { error: { message: 'Authentication failed' } },
    { result: { uid: 7 } },
  ])('does not submit a transfer after unusable authentication: %p', async data => {
    post.mockReset().mockResolvedValueOnce({ data });
    await expect(api.createStockMove(move)).resolves.toBe(false);
    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][0]).toBe(`${config.url}/web/session/authenticate`);
  });

  it('does not submit a transfer after an authentication network failure', async () => {
    post.mockReset().mockRejectedValueOnce(new Error('Offline'));
    await expect(api.createStockMove(move)).resolves.toBe(false);
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('returns false without making requests when unconfigured', async () => {
    jest.resetModules();
    const unconfiguredApi = jest.requireActual('../src/services/odooApi').default;
    const freshPost = jest.requireMock('axios').post;
    await expect(unconfiguredApi.createStockMove(move)).resolves.toBe(false);
    expect(freshPost).not.toHaveBeenCalled();
  });
});
