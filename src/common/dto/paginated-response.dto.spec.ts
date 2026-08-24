import { createPaginatedResponse } from './paginated-response.dto';

describe('createPaginatedResponse', () => {
  it('computes page flags for the first page', () => {
    const result = createPaginatedResponse(['a', 'b'], 5, 1, 2);

    expect(result.meta).toEqual({
      total: 5,
      page: 1,
      limit: 2,
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: false,
    });
  });

  it('computes page flags for the last page', () => {
    const result = createPaginatedResponse(['e'], 5, 3, 2);

    expect(result.meta.hasNextPage).toBe(false);
    expect(result.meta.hasPreviousPage).toBe(true);
    expect(result.meta.totalPages).toBe(3);
  });
});
