# API Patterns

Enforce consistent REST API design patterns across this codebase.

## Route Structure

Follow controller → service → repository layering:
- Controllers handle HTTP request/response only
- Services contain business logic
- Repositories handle data access

## Naming Conventions

- Resources: plural nouns (`/users`, `/orders`)
- Actions: HTTP verbs (GET, POST, PUT, PATCH, DELETE)
- Nested resources: `/users/:id/orders`
- Filter/sort/paginate via query params: `?status=active&sort=created_at&page=2`

## Response Format

All responses follow this envelope:
```json
{
  "data": { ... },
  "meta": { "page": 1, "total": 42 },
  "error": null
}
```

On error:
```json
{
  "data": null,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "User with id 123 not found"
  }
}
```

## Status Codes

- 200: success (GET, PUT, PATCH)
- 201: created (POST)
- 204: no content (DELETE)
- 400: bad request (validation error)
- 401: unauthorized
- 403: forbidden
- 404: not found
- 422: unprocessable entity (business logic error)
- 500: internal server error

## Validation

Validate all inputs at the controller boundary before passing to service. Return 400 with field-level error details.
