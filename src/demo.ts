export const baseline = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites><testsuite name="storefront">
<testcase classname="checkout" name="accepts a valid payment" time="0.42" />
<testcase classname="checkout" name="applies a discount code" time="0.28"><failure message="Expected total 80, received 100">AssertionError: discount was not applied</failure></testcase>
<testcase classname="catalog" name="loads the product feed" time="0.31" />
<testcase classname="catalog" name="filters by availability" time="0.12" />
<testcase classname="account" name="refreshes an expired session" time="0.18"><error message="Session store unavailable">ConnectionError: local session fixture</error></testcase>
<testcase classname="account" name="uses the legacy sign-in flow" time="0.22" />
<testcase classname="checkout" name="accepts a gift card" time="0"><skipped message="Waiting for fixture" /></testcase>
<testcase classname="catalog" name="renders a product card" time="0.08" />
</testsuite></testsuites>`;
export const current = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites><testsuite name="storefront">
<testcase classname="checkout" name="accepts a valid payment" time="0.56"><failure message="Expected 200, received 422">AssertionError: payment request rejected\n  at checkout.spec.ts:42</failure></testcase>
<testcase classname="checkout" name="applies a discount code" time="0.24" />
<testcase classname="catalog" name="loads the product feed" time="1.27" />
<testcase classname="catalog" name="filters by availability" time="0.14" />
<testcase classname="account" name="refreshes an expired session" time="0.20"><error message="Session store unavailable">ConnectionError: local session fixture</error></testcase>
<testcase classname="account" name="signs in with a passkey" time="0.34" />
<testcase classname="checkout" name="accepts a gift card" time="0.16" />
<testcase classname="catalog" name="renders a product card" time="0.09" />
</testsuite></testsuites>`;
