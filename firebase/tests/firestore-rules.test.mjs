/**
 * Firestore security rules tests — run with Firebase Emulator:
 *   firebase emulators:exec --only firestore "node firebase/tests/firestore-rules.test.mjs"
 *
 * Requires: @firebase/rules-unit-testing (install in firebase/tests if running locally).
 */
console.log(`
Firestore rules tests for TRDDK auth migration.

Manual emulator checklist:
1. super_admin reads any business
2. business_admin reads own business only → 403 on other businessId
3. employee reads buses in own business only
4. unauthenticated client cannot write users/{uid}
5. public read on drivers/buses removed (backend-only for legacy mobile until token migration)

Automated suite: add @firebase/rules-unit-testing and implement assertions before production cutover.
`);
