# When to Mock

Mock at **system boundaries** only, when replacing the real dependency helps isolate the behavior under test.

Common cases:

- **External APIs and services** (payment, email, geocoding, etc.): use mocks or fakes when the external service is not the subject of the test.
- **Time and randomness:** inject a clock or random-number source so behavior is deterministic.
- **File system:** use a fake or mock when testing logic that does not depend on actual filesystem semantics. Use real temporary files when filesystem behavior is part of the contract.
- **Databases:** follow the project's database-testing policy. For Caravan, do not mock the database in integration tests. Integration tests that validate database behavior must use real test instances of Postgres and Redis. A unit test may replace a repository interface with a mock or fake when testing the unit's logic, if that interface already exists as a legitimate part of the architecture, but that does not replace database integration tests.

Don't mock:

- Your own classes or modules when doing so couples tests to implementation details.
- Internal collaborators merely to make tests easier to write.
- A dependency whose actual behavior is part of the contract being tested.

**Project policy takes precedence:** when these general guidelines conflict with `docs/project/development.md`, follow the project document.

## Designing for Mockability

Don't design interfaces only for mocks. Create an interface, repository layer or port only for a real boundary (an external service or a port the project's architecture defines), never just to make a test easier to write.

At system boundaries, design interfaces that are easy to mock:

**1. Use dependency injection**

Pass external dependencies in rather than creating them internally:

```typescript
// Easy to mock
function processPayment(order, paymentClient) {
  return paymentClient.charge(order.total);
}

// Hard to mock
function processPayment(order) {
  const client = new StripeClient(process.env.STRIPE_KEY);
  return client.charge(order.total);
}
```

**2. Prefer SDK-style interfaces over generic fetchers**

Create specific functions for each external operation instead of one generic function with conditional logic:

```typescript
// GOOD: Each function is independently mockable
const api = {
  getUser: (id) => fetch(`/users/${id}`),
  getOrders: (userId) => fetch(`/users/${userId}/orders`),
  createOrder: (data) => fetch('/orders', { method: 'POST', body: data }),
};

// BAD: Mocking requires conditional logic inside the mock
const api = {
  fetch: (endpoint, options) => fetch(endpoint, options),
};
```

The SDK approach means:
- Each mock returns one specific shape
- No conditional logic in test setup
- Easier to see which endpoints a test exercises
- Type safety per endpoint
