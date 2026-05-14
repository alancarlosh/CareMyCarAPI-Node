const OrdersService = require('../src/modules/orders/orders.service');

describe('orders service compatibility helpers', () => {
  it('validates status transitions like Flask', () => {
    expect(OrdersService.transitionError('pending', 'confirmed')).toBeNull();
    expect(OrdersService.transitionError('confirmed', 'delivered')).toBeNull();
    expect(OrdersService.transitionError('delivered', 'pending')).toBe('invalid status transition: delivered -> pending');
  });

  it('parses report dates with YYYY-MM-DD validation', () => {
    const parsed = OrdersService.parseReportDate('2024-02-29');
    expect(OrdersService.formatDate(parsed.date)).toBe('2024-02-29');
    expect(OrdersService.parseReportDate('2024-02-30')).toEqual({ error: 'date must use YYYY-MM-DD format' });
  });

  it('matches Flask integer conversion behavior for query values', () => {
    expect(OrdersService.parseInteger('10')).toBe(10);
    expect(OrdersService.parseInteger('10.5')).toBeNull();
    expect(OrdersService.parsePagination({ page: 'x', limit: '20' })).toEqual({
      error: 'page/limit must be integer',
    });
  });
});
