// Ticket 26 — safe {{variable}} substitution for notification templates.
//
// The backend must never let template text do anything other than swap in known values, so the
// rules here are deliberately strict:
//   - Only `{{ name }}` tokens are recognised; `name` must match /^[a-zA-Z0-9_]+$/.
//   - A token is replaced by `vars[name]` ONLY when `vars` *owns* that key (hasOwnProperty),
//     so nothing reachable through Object.prototype (`__proto__`, `constructor`, `toString`, …)
//     can ever be pulled into the output.
//   - A missing / null / undefined value renders as an empty string — never the literal token,
//     never "undefined".
//   - Replacement values are inserted literally and the result is NOT re-scanned, so a value
//     that itself contains "{{x}}" cannot trigger a second round of expansion (no recursion,
//     no way to smuggle a token in through data).
//   - Objects / arrays render through a shallow, bounded stringify — a customer never sees raw
//     JSON, and a deeply nested blob can't blow up the message.

// A fresh regex per call — a shared /g regex carries `lastIndex` state between calls and would
// make these functions non-reentrant.
const tokenRegex = () => /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

function stringifyValue(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(stringifyValue).filter((s) => s !== '').join(', ');
  if (typeof value === 'object') {
    try {
      return Object.keys(value)
        .slice(0, 20)
        .map((k) => stringifyValue(value[k]))
        .filter((s) => s !== '')
        .join(' ');
    } catch {
      return '';
    }
  }
  return '';
}

// Replace every {{token}} in `template` using `vars`. Unknown / missing tokens become ''.
function render(template, vars = {}) {
  if (typeof template !== 'string' || template === '') return '';
  const source = vars && typeof vars === 'object' ? vars : {};
  return template.replace(tokenRegex(), (_match, name) =>
    Object.prototype.hasOwnProperty.call(source, name) ? stringifyValue(source[name]) : '',
  );
}

// The distinct variable names a template references, in first-seen order. Used by validation to
// reject a template that mentions a variable the event can't provide, and by the editor to show
// which variables a body uses.
function extractVariables(template) {
  if (typeof template !== 'string' || template === '') return [];
  const re = tokenRegex();
  const found = [];
  let match;
  while ((match = re.exec(template)) !== null) {
    if (!found.includes(match[1])) found.push(match[1]);
  }
  return found;
}

module.exports = { render, extractVariables };
