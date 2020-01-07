# About backend

Backend implementations found here should not know anything about request/response objects, instead basic types should
be the parameters when working with any backend. Collaborators will be provided to the backend.

The current state is not like that as for know we are moving code to where we think it fits better, removing that kind
of dependencies should be addressed in the future.