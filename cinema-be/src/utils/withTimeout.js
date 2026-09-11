// Races `promise` against a timer. Used by the webhook pipeline so a hung provider
// processor can never block a webhook (or the retry sweep) forever.
function withTimeout(promise, ms, message = `Operation timed out after ${ms}ms`) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([Promise.resolve(promise), timeout]).finally(() => clearTimeout(timer));
}

module.exports = { withTimeout };
