# Ship three containers and leave AWS for later

Local and deployed behavior should match: a static client, a stateless API, and PostgreSQL, finding each other by name on one network. Docker Compose (or Podman with the same file) runs `web`, `api`, and `postgres`. The API key for recommendations is injected only into the API container. The API stays stateless so a later host can run more than one replica against one database.

Considered options: API Gateway, Lambda, RDS, and Terraform now. A gateway only forwards HTTP; it does not run household checks, receipt parsing, or recommendations. Putting the API behind one would mean rewriting it as functions. A later move can keep these images. That work is not part of this build.
