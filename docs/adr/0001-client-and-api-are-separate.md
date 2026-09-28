# The browser client and the API are separate processes

A household app could ship as one web project, with pages and rules in the same deploy. That couples rendering to inventory and recommendations, and a second client would have to grow out of the UI process. Smart Pantry is a React client that only speaks HTTP and a stateless API that owns tenancy, inventory, and recommendations. Shared request types live in one contracts package so the wire format cannot drift. The client has no database and does not decide stock, matches, or nutrition.

Considered options: a single Next.js app with server actions. Rejected because the API would not be its own product, and page rendering would scale together with recommendation work.
