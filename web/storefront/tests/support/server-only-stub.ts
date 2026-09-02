/**
 * Test-time stand-in for the `server-only` marker package.
 *
 * `server-only` deliberately throws on import; that is its whole purpose, and it is what
 * keeps a server module out of a browser bundle. Under Vitest the module graph is not a
 * React Server Components graph, so importing a server module to unit-test it would trip
 * that guard.
 *
 * The package itself solves this by exporting an empty module under the `react-server`
 * condition, but that entry point is not reachable by path, so the alias points here
 * instead. Enabling the `react-server` condition globally is not an option: it would put
 * React into server-component mode and make DOM rendering impossible.
 *
 * The guard is unaffected in a real build, where the alias does not exist.
 */
export {};
