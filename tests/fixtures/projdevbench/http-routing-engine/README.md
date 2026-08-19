# HTTP Routing Engine Specification

Implement a `Router` class in `router.js` (or `index.js`) supporting parameterized routes and wildcards.

## API:
- `add(method: string, path: string, handler: Function): void`
- `match(method: string, path: string): { handler: Function, params: Record<string, string> } | null`

## Supported Route Patterns:
1. Static paths: `/users/profile`
2. Named parameters: `/users/:id` -> `{ id: '123' }`
3. Multi-parameters: `/orgs/:orgId/repos/:repoId` -> `{ orgId: 'meta', repoId: 'harness' }`
4. Wildcards: `/static/*path` -> `{ path: 'images/logo.png' }`

## Constraints:
- Match should be case-sensitive for methods (`GET`, `POST`) and paths.
- Exact static segments take precedence over parameters.
