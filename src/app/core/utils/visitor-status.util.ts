/**
 * Whether this browser had visited the store before the current page load.
 *
 * Read once, when this module is first evaluated — before Angular boots and before the first API
 * call, whose interceptor creates `lk-guest-id` for every visitor. Reading it later would always
 * find the id and report everybody as a returning visitor.
 */
const RETURNING_VISITOR: boolean = (() => {
  try {
    return typeof window !== 'undefined' && !!window.localStorage?.getItem('lk-guest-id');
  } catch {
    return false;
  }
})();

export function isReturningVisitor(): boolean {
  return RETURNING_VISITOR;
}
