const { render, extractVariables } = require('./templateRenderer');

describe('templateRenderer.render', () => {
  it('substitutes known {{variables}} and tolerates inner whitespace', () => {
    const out = render('Hi {{customer_name}}, seat {{ seat }} for {{movie_name}}', {
      customer_name: 'Lan',
      seat: 'A1',
      movie_name: 'Dune',
    });
    expect(out).toBe('Hi Lan, seat A1 for Dune');
  });

  it('renders a missing / null / undefined variable as an empty string (never the token)', () => {
    expect(render('[{{a}}][{{b}}][{{c}}]', { a: null, b: undefined })).toBe('[][][]');
  });

  it('never reaches through the prototype chain', () => {
    expect(render('{{__proto__}}/{{constructor}}/{{toString}}/{{hasOwnProperty}}', {})).toBe('///');
  });

  it('does not use inherited values even if the key exists on Object.prototype', () => {
    // `toString` is on the prototype, not an own key — must not be pulled in.
    expect(render('x{{toString}}x', {})).toBe('xx');
  });

  it('inserts values literally and does not re-expand a token that appears inside a value', () => {
    const out = render('{{a}}', { a: '{{b}}', b: 'SECRET' });
    expect(out).toBe('{{b}}');
  });

  it('joins array values with a comma and flattens a shallow object', () => {
    expect(render('{{seats}}', { seats: ['A1', 'A2', 'A3'] })).toBe('A1, A2, A3');
    expect(render('{{showtime}}', { showtime: { date: '2026-09-01', time: '19:30' } })).toBe('2026-09-01 19:30');
  });

  it('only accepts [A-Za-z0-9_] token names — anything else is left untouched', () => {
    expect(render('{{ a-b }} {{a.b}} {{a b}}', { 'a-b': 'x' })).toBe('{{ a-b }} {{a.b}} {{a b}}');
  });

  it('returns an empty string for a non-string template', () => {
    expect(render(null)).toBe('');
    expect(render(undefined)).toBe('');
    expect(render(42)).toBe('');
  });

  it('is reentrant — repeated calls are not affected by regex lastIndex state', () => {
    const tpl = 'a {{x}} b {{x}}';
    expect(render(tpl, { x: '1' })).toBe('a 1 b 1');
    expect(render(tpl, { x: '2' })).toBe('a 2 b 2');
  });
});

describe('templateRenderer.extractVariables', () => {
  it('returns the distinct variable names in first-seen order', () => {
    expect(extractVariables('{{b}} {{a}} {{b}} {{c}}')).toEqual(['b', 'a', 'c']);
  });

  it('returns [] when there are no tokens or the input is not a string', () => {
    expect(extractVariables('nothing here')).toEqual([]);
    expect(extractVariables(null)).toEqual([]);
  });
});
