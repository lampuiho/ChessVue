## Naming conventions
- Capitalised abbreviations should be treated as words in Pascal/camel, e.g., `HttpRequest` not `HTTPRequest`.
- Pascal case for classes, interfaces, types, and enums, and vue module names
- singular form if there is suffix
- private fields use underscore prefix
- interfaces should start with I
- UK spelling

## Coding style
- prefer compact code, avoid line space. add line space if only two section of code is clearly unrelated, at which point a comment to separate is prefered or if long enough, refactor into private function. This includes no line space closing bracket and another scope such as functions, if else, etc.
- functions preferally be under 35 lines. more than that should try to make meaningful refactor into private functions
- if there is only a single line insdie if statement, prefer oneliner so as to avoid code folding. use scope only if too long.
- add semi-colon for every line of typescript