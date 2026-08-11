// Token-bucket rate limiter for Twelve Data API credit budget.
// Prevents 429s by queuing requests when tokens are low.
export class CreditManager {
  constructor(creditsPerMinute, safetyMargin = 0.8) {
    this.ceiling     = Math.floor(creditsPerMinute * safetyMargin);
    this.tokens      = this.ceiling;
    this.refillRate  = this.ceiling / 60;   // tokens/second
    this.lastRefill  = Date.now();
    this.spent       = 0;
    this.requests    = 0;
  }

  _refill() {
    const now     = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens   = Math.min(this.ceiling, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }

  async consume(cost) {
    this._refill();
    if (this.tokens < cost) {
      const waitMs = Math.ceil((cost - this.tokens) / this.refillRate * 1000) + 100;
      console.log(`[credits] Throttling ${waitMs}ms (need ${cost}, have ${this.tokens.toFixed(1)})`);
      await new Promise(r => setTimeout(r, waitMs));
      this._refill();
    }
    this.tokens  -= cost;
    this.spent   += cost;
    this.requests++;
  }

  estimateScanCost(symbolCount) {
    const total          = symbolCount * 2;
    const minutesNeeded  = total / this.ceiling;
    return { total, minutesNeeded, symbolCount, ceiling: this.ceiling };
  }

  report() {
    return {
      spent:    this.spent,
      requests: this.requests,
      tokens:   +this.tokens.toFixed(1),
      ceiling:  this.ceiling,
    };
  }
}
