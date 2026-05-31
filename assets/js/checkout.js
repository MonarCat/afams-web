async function initiatePayment() {
  if (!cart.length) {
    showToast('Your cart is empty');
    return;
  }

  const email = prompt('Enter your email for order confirmation:');
  if (!email || !email.includes('@')) {
    showToast('Invalid email');
    return;
  }

  const phone = prompt('Your phone number (for delivery):') || '';
  const total = cart.reduce((a, i) => a + effectivePrice(i) * i.qty, 0);

  const handler = PaystackPop.setup({
    key: window.__PAYSTACK_PUBLIC_KEY,
    email,
    amount: total * 100,
    currency: 'KES',
    ref: `SC-${Date.now()}`,
    metadata: {
      custom_fields: [
        { display_name: 'Phone', variable_name: 'phone', value: phone },
        { display_name: 'Subscription', variable_name: 'subscription', value: subMode === 'sub' },
      ],
      cart_json: JSON.stringify(cart),
      sub_mode: subMode,
    },
    callback: (response) => handleSuccess(response.reference, email, phone),
    onClose: () => {},
  });

  handler.openIframe();
}

async function handleSuccess(ref, email, phone) {
  showToast('Confirming your order…');
  try {
    const res = await fetch(`${window.__SUPABASE_URL}/functions/v1/paystack-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reference: ref, email, phone, cart, subMode }),
    });

    if (res.ok) {
      cart = [];
      syncCartUI();
      renderCartItems();
      closeCart();
      showToast('✓ Order confirmed! Check your email.');
    } else {
      showToast('Payment captured. We are confirming your order.');
    }
  } catch {
    showToast("Order received. We'll confirm via email shortly.");
  }
}
