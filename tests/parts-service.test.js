const PartsService = require('../src/modules/parts/parts.service');

describe('parts service compatibility', () => {
  it('builds options from maintenance_costs.csv', async () => {
    const options = await PartsService.getOptions('Toyota');

    expect(options.categories).toContain('frenos');
    expect(options.makes).toContain('Toyota');
    expect(options.models).toEqual(expect.arrayContaining(['Corolla', 'Hilux']));
    expect(options.years[0]).toBe(new Date().getUTCFullYear() + 1);
    expect(options.years[options.years.length - 1]).toBe(1980);
  });

  it('validates create payload with Flask-compatible errors', async () => {
    await expect(PartsService.validateCreatePayload({})).resolves.toEqual({
      errors: [
        'name es obligatorio',
        'category es obligatorio',
        'make es obligatorio',
        'year es obligatorio',
        'model es obligatorio',
        'price es obligatorio',
        'quantity es obligatorio',
      ],
    });

    await expect(
      PartsService.validateCreatePayload({
        name: 'Filtro',
        category: 'wrong',
        make: 'Toyota',
        year: 2024,
        model: 'Corolla',
        price: 10,
        quantity: 1,
      }),
    ).resolves.toEqual({ error: 'Categoría inválida' });
  });

  it('rejects decimal string integers like Flask int conversion', () => {
    expect(PartsService.parsePagination({ page: '1.5', limit: '20' })).toEqual({
      error: 'page/limit deben ser enteros',
    });
  });
});
