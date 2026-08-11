import test from "node:test";
import assert from "node:assert/strict";

import handler from "../api/health.js";

function mockResponse() {
  return {
    statusCode:200,
    headers:{},
    body:null,
    setHeader(name, value) {
      this.headers[name] = value;
      return this;
    },
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test("health endpoint returns ok", () => {
  const response = mockResponse();
  handler({ method:"GET" }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.service, "wallstreethustler");
});

test("health endpoint rejects non-GET requests", () => {
  const response = mockResponse();
  handler({ method:"POST" }, response);
  assert.equal(response.statusCode, 405);
  assert.equal(response.body.ok, false);
  assert.equal(response.headers.Allow, "GET");
});
