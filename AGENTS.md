## Naming conventions
- Capitalised abbreviations should be treated as words in Pascal/camel, e.g., `HttpRequest` not `HTTPRequest`.
- Pascal case for classes, interfaces, types, and enums, and vue module names
- singular form if there is suffix
- private fields use underscore prefix
- interfaces should start with I
- UK spelling

## Coding style
- prefer compact code, when scopes are related to each other do not add line space. add line space only when potentially a comment should be inserted but can also be left out. THis includes no line space between functions
- functions preferally be under 35 lines. more than that should try to make meaningful refactor into private functions
- if there is only a single line insdie if statement, prefer oneliner so as to avoid code folding. use scope only if too long.
- add semi-colon for every line of typescript