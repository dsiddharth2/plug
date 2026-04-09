# Code Review

Perform a deep code review of the specified file or selection. Analyze for:

## Security
- Injection vulnerabilities (SQL, command, XSS)
- Authentication and authorization gaps
- Sensitive data exposure
- Insecure dependencies

## Performance
- Algorithmic complexity (O(n²) or worse in hot paths)
- Unnecessary re-renders or recomputations
- Missing indexes or N+1 query patterns
- Memory leaks

## Quality
- Code duplication and abstraction opportunities
- Error handling completeness
- Edge cases not handled
- Dead code

## Output Format

For each issue found:
- **Severity**: Critical / High / Medium / Low
- **Location**: file:line
- **Issue**: brief description
- **Fix**: concrete suggestion or code snippet

End with a summary table of all issues by severity.
