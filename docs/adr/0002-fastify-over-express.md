# Fastify is the API framework

The API is a modular monolith: one plugin per bounded context, routes under `/v1`, schema validation and structured logs by default. Fastify's plugin encapsulation is that boundary. A stateless Fastify process is the unit that can be replicated later. Domain code stays free of the framework and of the database client.

Considered options: Express. It would serve JSON, but it would not give plugin isolation, validation, or logging without extra assembly.
